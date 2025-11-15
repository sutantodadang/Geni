use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

use crate::models::{
    AuthConfig, AuthType, BasicAuth, BearerAuth, Collection, HttpMethod, HttpRequest, RequestBody,
};

// Postman Collection v2.1 Format
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanCollection {
    pub info: PostmanInfo,
    pub item: Vec<PostmanItem>,
    #[serde(default)]
    pub auth: Option<PostmanAuth>,
    #[serde(default)]
    pub variable: Vec<PostmanVariable>,
    #[serde(default)]
    pub event: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanInfo {
    pub name: String,
    #[serde(rename = "_postman_id")]
    pub postman_id: Option<String>,
    #[serde(rename = "_exporter_id")]
    pub exporter_id: Option<String>,
    pub description: Option<PostmanDescription>,
    pub schema: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum PostmanDescription {
    String(String),
    Object { content: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanVariable {
    pub key: String,
    pub value: String,
    #[serde(rename = "type")]
    pub var_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum PostmanAuth {
    #[serde(rename = "basic")]
    Basic { basic: Vec<PostmanAuthParam> },
    #[serde(rename = "bearer")]
    Bearer { bearer: Vec<PostmanAuthParam> },
    #[serde(rename = "noauth")]
    NoAuth,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanAuthParam {
    pub key: String,
    pub value: String,
}

// PostmanItem - either a folder or a request
// We need custom deserialization to distinguish between them reliably
#[derive(Debug, Clone, Serialize)]
#[serde(untagged)]
pub enum PostmanItem {
    Folder(PostmanFolder),
    Request(PostmanRequest),
}

impl<'de> Deserialize<'de> for PostmanItem {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let value = serde_json::Value::deserialize(deserializer)?;

        // Check if it has 'item' field -> it's a Folder
        if value.get("item").is_some() {
            let folder: PostmanFolder =
                serde_json::from_value(value).map_err(serde::de::Error::custom)?;
            Ok(PostmanItem::Folder(folder))
        }
        // Check if it has 'request' field -> it's a Request
        else if value.get("request").is_some() {
            let request: PostmanRequest =
                serde_json::from_value(value).map_err(serde::de::Error::custom)?;
            Ok(PostmanItem::Request(request))
        }
        // Neither field present - this is an error
        else {
            Err(serde::de::Error::custom(
                "PostmanItem must have either 'item' (for folders) or 'request' (for requests) field"
            ))
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanFolder {
    pub name: String,
    pub item: Vec<PostmanItem>,
    #[serde(default)]
    pub auth: Option<PostmanAuth>,
    #[serde(default)]
    pub description: Option<PostmanDescription>,
    #[serde(default)]
    pub event: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanRequest {
    pub name: String,
    pub request: PostmanRequestDetails,
    #[serde(default)]
    pub response: Vec<serde_json::Value>,
    #[serde(default)]
    pub event: Vec<serde_json::Value>,
    #[serde(rename = "protocolProfileBehavior")]
    #[serde(default)]
    pub protocol_profile_behavior: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanRequestDetails {
    pub method: String,
    #[serde(default)]
    pub header: Vec<PostmanHeader>,
    pub body: Option<PostmanBody>,
    pub url: Option<PostmanUrl>,
    pub auth: Option<PostmanAuth>,
    pub description: Option<PostmanDescription>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanHeader {
    pub key: String,
    pub value: String,
    #[serde(default)]
    pub disabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanBody {
    pub mode: String,
    pub raw: Option<String>,
    pub urlencoded: Option<Vec<PostmanKeyValue>>,
    pub formdata: Option<Vec<PostmanFormData>>,
    pub options: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanKeyValue {
    pub key: String,
    pub value: String,
    #[serde(default)]
    pub disabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanFormData {
    pub key: String,
    pub value: Option<String>,
    pub src: Option<String>,
    #[serde(rename = "type")]
    pub field_type: String,
    #[serde(default)]
    pub disabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum PostmanUrl {
    String(String),
    Object {
        raw: Option<String>,
        protocol: Option<String>,
        host: Option<Vec<String>>,
        port: Option<String>,
        path: Option<Vec<String>>,
        query: Option<Vec<PostmanKeyValue>>,
        variable: Option<Vec<PostmanVariable>>,
    },
}

// Conversion functions
pub fn convert_postman_collection(
    postman: PostmanCollection,
) -> (Vec<Collection>, Vec<HttpRequest>) {
    let description = match postman.info.description {
        Some(PostmanDescription::String(s)) => Some(s),
        Some(PostmanDescription::Object { content }) => Some(content),
        None => None,
    };

    let auth = postman.auth.as_ref().map(convert_postman_auth);

    let collection = Collection {
        id: Uuid::new_v4(),
        name: postman.info.name,
        description,
        parent_id: None,
        auth,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        synced: false,
        version: 0,
        cloud_id: None,
    };

    let mut collections = vec![collection.clone()];
    let mut requests = Vec::new();
    process_postman_items(
        &postman.item,
        &collection.id,
        None,
        &mut collections,
        &mut requests,
    );

    (collections, requests)
}

fn process_postman_items(
    items: &[PostmanItem],
    collection_id: &Uuid,
    parent_auth: Option<&AuthConfig>,
    collections: &mut Vec<Collection>,
    requests: &mut Vec<HttpRequest>,
) {
    for item in items {
        match item {
            PostmanItem::Request(req) => {
                let request = convert_postman_request(req, collection_id);
                requests.push(request);
            }
            PostmanItem::Folder(folder) => {
                // Create a sub-collection for the folder
                let description = folder.description.as_ref().map(|d| match d {
                    PostmanDescription::String(s) => s.clone(),
                    PostmanDescription::Object { content } => content.clone(),
                });

                let folder_auth = folder.auth.as_ref().map(convert_postman_auth);
                let auth_to_use = folder_auth.or_else(|| parent_auth.cloned());

                let sub_collection = Collection {
                    id: Uuid::new_v4(),
                    name: folder.name.clone(),
                    description,
                    parent_id: Some(*collection_id),
                    auth: auth_to_use.clone(),
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                    synced: false,
                    version: 0,
                    cloud_id: None,
                };

                let sub_collection_id = sub_collection.id;
                collections.push(sub_collection);

                // Process nested items with the new sub-collection ID
                process_postman_items(
                    &folder.item,
                    &sub_collection_id,
                    auth_to_use.as_ref(),
                    collections,
                    requests,
                );
            }
        }
    }
}

fn convert_postman_request(postman: &PostmanRequest, collection_id: &Uuid) -> HttpRequest {
    let method = convert_method(&postman.request.method);
    let url = postman
        .request
        .url
        .as_ref()
        .map(|u| convert_url(u))
        .unwrap_or_else(|| String::from("http://localhost"));
    let headers = convert_headers(&postman.request.header);
    let body = convert_body(&postman.request.body);
    let path_params = extract_path_params(&url);

    HttpRequest {
        id: Some(Uuid::new_v4()),
        name: postman.name.clone(),
        method,
        url,
        headers,
        body,
        path_params,
        collection_id: Some(*collection_id),
        created_at: Some(Utc::now()),
        updated_at: Some(Utc::now()),
        synced: false,
        version: 0,
        cloud_id: None,
    }
}

fn convert_method(method: &str) -> HttpMethod {
    match method.to_uppercase().as_str() {
        "GET" => HttpMethod::GET,
        "POST" => HttpMethod::POST,
        "PUT" => HttpMethod::PUT,
        "DELETE" => HttpMethod::DELETE,
        "PATCH" => HttpMethod::PATCH,
        "HEAD" => HttpMethod::HEAD,
        "OPTIONS" => HttpMethod::OPTIONS,
        _ => HttpMethod::GET,
    }
}

fn convert_url(url: &PostmanUrl) -> String {
    match url {
        PostmanUrl::String(s) => s.clone(),
        PostmanUrl::Object {
            raw,
            protocol,
            host,
            port,
            path,
            query,
            ..
        } => {
            if let Some(raw_url) = raw {
                return raw_url.clone();
            }

            let mut result = String::new();

            if let Some(proto) = protocol {
                result.push_str(proto);
                result.push_str("://");
            }

            if let Some(host_parts) = host {
                result.push_str(&host_parts.join("."));
            }

            if let Some(port_str) = port {
                result.push(':');
                result.push_str(port_str);
            }

            if let Some(path_parts) = path {
                result.push('/');
                result.push_str(&path_parts.join("/"));
            }

            if let Some(query_params) = query {
                if !query_params.is_empty() {
                    result.push('?');
                    let query_string: Vec<String> = query_params
                        .iter()
                        .filter(|q| !q.disabled)
                        .map(|q| format!("{}={}", q.key, q.value))
                        .collect();
                    result.push_str(&query_string.join("&"));
                }
            }

            result
        }
    }
}

fn convert_headers(headers: &Vec<PostmanHeader>) -> HashMap<String, String> {
    let mut result = HashMap::new();

    for header in headers {
        if !header.disabled {
            result.insert(header.key.clone(), header.value.clone());
        }
    }

    result
}

fn convert_body(body: &Option<PostmanBody>) -> Option<RequestBody> {
    body.as_ref().and_then(|b| match b.mode.as_str() {
        "raw" => {
            if let Some(raw_content) = &b.raw {
                // Try to detect if it's JSON
                if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(raw_content) {
                    Some(RequestBody::Json(json_value))
                } else {
                    Some(RequestBody::Raw {
                        content: raw_content.clone(),
                        content_type: "text/plain".to_string(),
                    })
                }
            } else {
                None
            }
        }
        "urlencoded" => {
            if let Some(form_data) = &b.urlencoded {
                let mut data = HashMap::new();
                for item in form_data {
                    if !item.disabled {
                        data.insert(item.key.clone(), item.value.clone());
                    }
                }
                if !data.is_empty() {
                    Some(RequestBody::UrlEncoded(data))
                } else {
                    None
                }
            } else {
                None
            }
        }
        "formdata" => {
            if let Some(form_data) = &b.formdata {
                let mut data = HashMap::new();
                for item in form_data {
                    if !item.disabled {
                        let field = if item.field_type == "file" {
                            crate::models::FormDataField::File {
                                path: item.src.clone().unwrap_or_default(),
                            }
                        } else {
                            crate::models::FormDataField::Text {
                                value: item.value.clone().unwrap_or_default(),
                            }
                        };
                        data.insert(item.key.clone(), field);
                    }
                }
                if !data.is_empty() {
                    Some(RequestBody::FormData(data))
                } else {
                    None
                }
            } else {
                None
            }
        }
        _ => None,
    })
}

fn convert_postman_auth(auth: &PostmanAuth) -> AuthConfig {
    match auth {
        PostmanAuth::Basic { basic } => {
            let mut username = String::new();
            let mut password = String::new();

            for param in basic {
                match param.key.as_str() {
                    "username" => username = param.value.clone(),
                    "password" => password = param.value.clone(),
                    _ => {}
                }
            }

            AuthConfig {
                auth_type: AuthType::Basic,
                basic: Some(BasicAuth { username, password }),
                bearer: None,
            }
        }
        PostmanAuth::Bearer { bearer } => {
            let mut token = String::new();

            for param in bearer {
                if param.key == "token" {
                    token = param.value.clone();
                    break;
                }
            }

            AuthConfig {
                auth_type: AuthType::Bearer,
                basic: None,
                bearer: Some(BearerAuth { token }),
            }
        }
        PostmanAuth::NoAuth => AuthConfig {
            auth_type: AuthType::None,
            basic: None,
            bearer: None,
        },
    }
}

fn extract_path_params(url: &str) -> HashMap<String, String> {
    let mut params = HashMap::new();

    for segment in url.split(&['/', '?', '&', '='][..]) {
        if segment.starts_with(':') {
            let param_name = segment[1..].to_string();
            if !param_name.is_empty() {
                params.insert(param_name, String::new());
            }
        }
    }

    params
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_postman_item_folder() {
        let json = r#"{
            "name": "auth",
            "item": [
                {
                    "name": "Login",
                    "request": {
                        "method": "POST",
                        "url": "http://localhost/login",
                        "header": []
                    }
                }
            ]
        }"#;

        let item: Result<PostmanItem, _> = serde_json::from_str(json);
        assert!(item.is_ok(), "Failed to parse folder: {:?}", item.err());
        assert!(matches!(item.unwrap(), PostmanItem::Folder(_)));
    }

    #[test]
    fn test_parse_postman_item_request() {
        let json = r#"{
            "name": "Login",
            "request": {
                "method": "POST",
                "url": "http://localhost/login",
                "header": []
            }
        }"#;

        let item: Result<PostmanItem, _> = serde_json::from_str(json);
        assert!(item.is_ok(), "Failed to parse request: {:?}", item.err());
        assert!(matches!(item.unwrap(), PostmanItem::Request(_)));
    }

    #[test]
    fn test_parse_postman_item_request_with_event() {
        let json = r#"{
            "event": [
                {
                    "listen": "test",
                    "script": {
                        "exec": [""],
                        "type": "text/javascript"
                    }
                }
            ],
            "name": "Login",
            "request": {
                "body": {
                    "mode": "raw",
                    "options": {
                        "raw": {
                            "language": "json"
                        }
                    },
                    "raw": "{\"email\":\"test@example.com\"}"
                },
                "header": [],
                "method": "POST",
                "url": {
                    "host": ["localhost"],
                    "path": ["api", "v1", "login"],
                    "raw": "http://localhost/api/v1/login"
                }
            },
            "response": []
        }"#;

        let item: Result<PostmanItem, _> = serde_json::from_str(json);
        assert!(
            item.is_ok(),
            "Failed to parse request with event: {:?}",
            item.err()
        );
        assert!(matches!(item.unwrap(), PostmanItem::Request(_)));
    }

    #[test]
    fn test_parse_postman_item_request_with_protocol_profile() {
        let json = r#"{
            "name": "Welcome",
            "protocolProfileBehavior": {
                "disableBodyPruning": true
            },
            "request": {
                "body": {
                    "mode": "raw",
                    "raw": ""
                },
                "description": "Welcome Api",
                "header": [],
                "method": "GET",
                "url": {
                    "host": ["api-adopt-me", "herokuapp", "com"],
                    "path": [""],
                    "protocol": "https",
                    "raw": "https://api-adopt-me.herokuapp.com/"
                }
            },
            "response": []
        }"#;

        let item: Result<PostmanItem, _> = serde_json::from_str(json);
        assert!(
            item.is_ok(),
            "Failed to parse request with protocolProfileBehavior: {:?}",
            item.err()
        );
        assert!(matches!(item.unwrap(), PostmanItem::Request(_)));
    }

    #[test]
    fn test_parse_real_postman_collection() {
        let json =
            std::fs::read_to_string("test_real_postman.json").expect("Failed to read test file");

        let result: Result<PostmanCollection, _> = serde_json::from_str(&json);
        if let Err(e) = &result {
            eprintln!("❌ Parse error: {}", e);
        }
        assert!(
            result.is_ok(),
            "Failed to parse real Postman collection: {:?}",
            result.err()
        );
    }

    #[test]
    fn test_convert_method() {
        assert!(matches!(convert_method("GET"), HttpMethod::GET));
        assert!(matches!(convert_method("post"), HttpMethod::POST));
        assert!(matches!(convert_method("Put"), HttpMethod::PUT));
    }

    #[test]
    fn test_convert_url_string() {
        let url = PostmanUrl::String("https://api.example.com/users".to_string());
        assert_eq!(convert_url(&url), "https://api.example.com/users");
    }
}
