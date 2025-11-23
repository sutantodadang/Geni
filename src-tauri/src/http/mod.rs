use anyhow::Result;
use base64::{engine::general_purpose, Engine as _};
use reqwest::{Client, Method};
use serde_json::Value;
use std::collections::HashMap;
use std::time::{Duration, Instant};
use syntect::highlighting::ThemeSet;
use syntect::html::highlighted_html_for_string;
use syntect::parsing::SyntaxSet;

use crate::models::*;

pub struct HttpClient {
    client: Client,
    syntax_set: SyntaxSet,
    theme_set: ThemeSet,
}

impl HttpClient {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("Geni API Client/0.1.0")
            .build()
            .expect("Failed to create HTTP client");

        let syntax_set = SyntaxSet::load_defaults_newlines();
        let theme_set = ThemeSet::load_defaults();

        Self {
            client,
            syntax_set,
            theme_set,
        }
    }

    pub async fn send_request(&self, payload: SendRequestPayload) -> Result<PrettyResponse> {
        let start_time = Instant::now();

        // Convert method
        let method = match payload.method {
            HttpMethod::GET => Method::GET,
            HttpMethod::POST => Method::POST,
            HttpMethod::PUT => Method::PUT,
            HttpMethod::DELETE => Method::DELETE,
            HttpMethod::PATCH => Method::PATCH,
            HttpMethod::HEAD => Method::HEAD,
            HttpMethod::OPTIONS => Method::OPTIONS,
        };

        // Build request
        let mut request_builder = self.client.request(method, &payload.url);

        // Add headers
        for (key, value) in &payload.headers {
            request_builder = request_builder.header(key, value);
        }

        // Add body if present
        if let Some(body) = &payload.body {
            request_builder = match body {
                RequestBody::Raw {
                    content,
                    content_type,
                } => request_builder
                    .header("Content-Type", content_type)
                    .body(content.clone()),
                RequestBody::Json(value) => request_builder
                    .header("Content-Type", "application/json")
                    .json(value),
                RequestBody::FormData(form) => {
                    let mut form_builder = reqwest::multipart::Form::new();
                    for (key, field) in form {
                        form_builder = match field {
                            FormDataField::Text { value } => {
                                form_builder.text(key.clone(), value.clone())
                            }
                            FormDataField::File { path } => {
                                // Check if file exists
                                let path_obj = std::path::Path::new(path);
                                if !path_obj.exists() {
                                    return Err(anyhow::anyhow!(
                                        "File does not exist at path: '{}'. Please ensure the file path is correct.",
                                        path
                                    ));
                                }

                                // Check if it's a file (not a directory)
                                if !path_obj.is_file() {
                                    return Err(anyhow::anyhow!(
                                        "Path '{}' is not a file. Please select a file, not a directory.",
                                        path
                                    ));
                                }

                                // Read file from path
                                let file_bytes = std::fs::read(path)
                                    .map_err(|e| {
                                        eprintln!("Failed to read file '{}': {}", path, e);
                                        anyhow::anyhow!(
                                            "Failed to read file '{}': {}. Check file permissions and ensure the app has access to this file.",
                                            path, e
                                        )
                                    })?;

                                // Extract filename from path
                                let filename = path_obj
                                    .file_name()
                                    .and_then(|n| n.to_str())
                                    .unwrap_or("file")
                                    .to_string();

                                // Detect MIME type from file extension
                                let mime_type = mime_guess::from_path(path_obj)
                                    .first_or_octet_stream()
                                    .to_string();

                                // Create multipart part with file and proper content type
                                let part = reqwest::multipart::Part::bytes(file_bytes)
                                    .file_name(filename)
                                    .mime_str(&mime_type)
                                    .unwrap_or_else(|_| {
                                        reqwest::multipart::Part::bytes(vec![]).file_name("error")
                                    });

                                form_builder.part(key.clone(), part)
                            }
                        };
                    }
                    request_builder.multipart(form_builder)
                }
                RequestBody::UrlEncoded(form) => request_builder
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .form(form),
            };
        }

        // Set timeout if provided
        if let Some(timeout) = payload.timeout {
            request_builder = request_builder.timeout(Duration::from_secs(timeout));
        }

        // Send request and measure time
        let response = request_builder.send().await?;
        let response_time = start_time.elapsed().as_millis() as u64;

        // Extract response data
        let status = response.status().as_u16();
        let status_text = response
            .status()
            .canonical_reason()
            .unwrap_or("Unknown")
            .to_string();

        // Extract headers
        let mut headers = HashMap::new();
        for (key, value) in response.headers() {
            headers.insert(key.to_string(), value.to_str().unwrap_or("").to_string());
        }

        // Get content type for formatting
        let content_type = headers
            .get("content-type")
            .or_else(|| headers.get("Content-Type"))
            .cloned();

        // Read response body
        let body_bytes = response.bytes().await?;
        let body = String::from_utf8_lossy(&body_bytes).to_string();
        let size = body_bytes.len();

        // Format body based on content type
        let formatted_body = self.format_response_body(&body, &content_type);

        // Generate syntax highlighted body
        let highlighted_body = self.highlight_response_body(&body, &content_type);

        Ok(PrettyResponse {
            status,
            status_text,
            headers,
            body,
            formatted_body,
            highlighted_body,
            response_time,
            size,
        })
    }

    fn format_response_body(&self, body: &str, content_type: &Option<String>) -> Option<String> {
        if body.is_empty() {
            return None;
        }

        // Try to format based on content type
        if let Some(ct) = content_type {
            let ct_lower = ct.to_lowercase();

            if ct_lower.contains("application/json") || ct_lower.contains("text/json") {
                return self.format_json(body);
            } else if ct_lower.contains("application/xml") || ct_lower.contains("text/xml") {
                return self.format_xml(body);
            } else if ct_lower.contains("text/html") {
                return self.format_html(body);
            } else if ct_lower.contains("text/css") {
                return self.format_css(body);
            } else if ct_lower.contains("application/javascript")
                || ct_lower.contains("text/javascript")
            {
                return self.format_javascript(body);
            }
        }

        // Try to auto-detect JSON
        if let Some(formatted) = self.format_json(body) {
            return Some(formatted);
        }

        // Return original if no formatting applied
        None
    }

    fn format_json(&self, body: &str) -> Option<String> {
        // First try to parse and pretty-print JSON
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(body) {
            if let Ok(pretty) = serde_json::to_string_pretty(&value) {
                return Some(pretty);
            }
        }
        None
    }

    fn format_xml(&self, body: &str) -> Option<String> {
        // For now, just return the original XML
        // In the future, we could add XML formatting
        Some(body.to_string())
    }

    fn format_html(&self, body: &str) -> Option<String> {
        // For now, just return the original HTML
        // In the future, we could add HTML formatting
        Some(body.to_string())
    }

    fn format_css(&self, body: &str) -> Option<String> {
        // For now, just return the original CSS
        Some(body.to_string())
    }

    fn format_javascript(&self, body: &str) -> Option<String> {
        // For now, just return the original JavaScript
        Some(body.to_string())
    }

    fn highlight_response_body(&self, body: &str, content_type: &Option<String>) -> Option<String> {
        if body.is_empty() {
            return None;
        }

        // Determine language for syntax highlighting
        let language = if let Some(ct) = content_type {
            let ct_lower = ct.to_lowercase();
            if ct_lower.contains("application/json") || ct_lower.contains("text/json") {
                "json"
            } else if ct_lower.contains("application/xml") || ct_lower.contains("text/xml") {
                "xml"
            } else if ct_lower.contains("text/html") {
                "html"
            } else if ct_lower.contains("text/css") {
                "css"
            } else if ct_lower.contains("application/javascript")
                || ct_lower.contains("text/javascript")
            {
                "javascript"
            } else if ct_lower.contains("text/plain") {
                "txt"
            } else {
                "txt"
            }
        } else {
            // Try to auto-detect JSON
            if serde_json::from_str::<Value>(body).is_ok() {
                "json"
            } else {
                "txt"
            }
        };

        self.highlight_syntax(body, language).ok()
    }

    pub fn highlight_syntax(&self, content: &str, language: &str) -> Result<String> {
        let syntax = self
            .syntax_set
            .find_syntax_by_extension(language)
            .or_else(|| self.syntax_set.find_syntax_by_name(language))
            .unwrap_or_else(|| self.syntax_set.find_syntax_plain_text());

        let theme = &self.theme_set.themes["base16-ocean.dark"];

        let highlighted_html =
            highlighted_html_for_string(content, &self.syntax_set, syntax, theme)?;

        Ok(highlighted_html)
    }

    pub fn highlight_json(&self, json: &str) -> Result<String> {
        // Pretty format the JSON first
        let formatted = if let Ok(value) = serde_json::from_str::<Value>(json) {
            serde_json::to_string_pretty(&value)?
        } else {
            json.to_string()
        };

        self.highlight_syntax(&formatted, "json")
    }

    pub fn highlight_xml(&self, xml: &str) -> Result<String> {
        self.highlight_syntax(xml, "xml")
    }

    pub fn highlight_html(&self, html: &str) -> Result<String> {
        self.highlight_syntax(html, "html")
    }
}

impl Default for HttpClient {
    fn default() -> Self {
        Self::new()
    }
}

pub fn replace_environment_variables(text: &str, variables: &HashMap<String, String>) -> String {
    let mut result = text.to_string();

    for (key, value) in variables {
        let pattern = format!("{{{{{}}}}}", key);
        result = result.replace(&pattern, value);
    }

    result
}

pub fn replace_path_parameters(url: &str, path_params: &HashMap<String, String>) -> String {
    let mut result = url.to_string();

    for (key, value) in path_params {
        let pattern = format!(":{}", key);
        result = result.replace(&pattern, value);
    }

    result
}

pub fn extract_path_parameters(url: &str) -> Vec<String> {
    let mut params = Vec::new();

    for segment in url.split(&['/', '?', '&', '='][..]) {
        if segment.starts_with(':') {
            let param_name = segment[1..].to_string();
            if !param_name.is_empty() {
                params.push(param_name);
            }
        }
    }

    params
}

pub fn extract_environment_variables(text: &str) -> Vec<String> {
    let mut variables = Vec::new();
    let mut chars = text.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch == '{' && chars.peek() == Some(&'{') {
            chars.next(); // consume second '{'
            let mut var_name = String::new();

            while let Some(ch) = chars.next() {
                if ch == '}' && chars.peek() == Some(&'}') {
                    chars.next(); // consume second '}'
                    if !var_name.is_empty() {
                        variables.push(var_name);
                    }
                    break;
                } else {
                    var_name.push(ch);
                }
            }
        }
    }

    variables
}

pub fn generate_auth_headers(auth: &AuthConfig) -> HashMap<String, String> {
    let mut headers = HashMap::new();

    match auth.auth_type {
        AuthType::None => {}
        AuthType::Basic => {
            if let Some(basic) = &auth.basic {
                let credentials = format!("{}:{}", basic.username, basic.password);
                let encoded = general_purpose::STANDARD.encode(credentials.as_bytes());
                headers.insert("Authorization".to_string(), format!("Basic {}", encoded));
            }
        }
        AuthType::Bearer => {
            if let Some(bearer) = &auth.bearer {
                headers.insert(
                    "Authorization".to_string(),
                    format!("Bearer {}", bearer.token),
                );
            }
        }
    }

    headers
}

pub fn merge_headers(
    request_headers: &HashMap<String, String>,
    auth_headers: &HashMap<String, String>,
) -> HashMap<String, String> {
    let mut merged = auth_headers.clone();
    // Request headers override auth headers
    merged.extend(request_headers.clone());
    merged
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_replace_environment_variables() {
        let mut variables = HashMap::new();
        variables.insert(
            "base_url".to_string(),
            "https://api.example.com".to_string(),
        );
        variables.insert("token".to_string(), "abc123".to_string());

        let input = "{{base_url}}/users?token={{token}}";
        let result = replace_environment_variables(input, &variables);

        assert_eq!(result, "https://api.example.com/users?token=abc123");
    }

    #[test]
    fn test_extract_environment_variables() {
        let input = "{{base_url}}/users/{{user_id}}?token={{token}}";
        let variables = extract_environment_variables(input);

        assert_eq!(variables, vec!["base_url", "user_id", "token"]);
    }

    #[test]
    fn test_format_json() {
        let client = HttpClient::new();
        let input = r#"{"name":"John","age":30,"city":"New York"}"#;
        let result = client.format_json(input);

        assert!(result.is_some());
        let formatted = result.unwrap();
        assert!(formatted.contains("  \"name\": \"John\""));
    }
}
