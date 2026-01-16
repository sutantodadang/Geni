use crate::models::{
    Collection, HttpMethod, HttpRequest, RequestBody as ModelRequestBody,
};
use chrono::Utc;
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct OpenApiSpec {
    pub openapi: String,
    pub info: Info,
    pub servers: Option<Vec<Server>>,
    pub paths: HashMap<String, PathItem>,
    pub components: Option<Components>,
}

#[derive(Debug, Deserialize)]
pub struct Info {
    pub title: String,
    pub description: Option<String>,
    pub version: String,
}

#[derive(Debug, Deserialize)]
pub struct Server {
    pub url: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PathItem {
    pub get: Option<Operation>,
    pub post: Option<Operation>,
    pub put: Option<Operation>,
    pub delete: Option<Operation>,
    pub patch: Option<Operation>,
    pub head: Option<Operation>,
    pub options: Option<Operation>,
    pub parameters: Option<Vec<Parameter>>,
}

#[derive(Debug, Deserialize)]
pub struct Operation {
    pub summary: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "operationId")]
    pub operation_id: Option<String>,
    pub parameters: Option<Vec<Parameter>>,
    #[serde(rename = "requestBody")]
    pub request_body: Option<RequestBody>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct Parameter {
    pub name: String,
    #[serde(rename = "in")]
    pub in_loc: String, // "query", "header", "path", "cookie"
    pub required: Option<bool>,
    pub description: Option<String>,
    pub schema: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct RequestBody {
    pub content: HashMap<String, MediaType>,
}

#[derive(Debug, Deserialize)]
pub struct MediaType {
    pub schema: Option<Value>,
    pub example: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct Components {
    pub schemas: Option<HashMap<String, Value>>,
}

fn join_url(base: &str, path: &str) -> String {
    if base.ends_with('/') && path.starts_with('/') {
        format!("{}{}", &base[..base.len() - 1], path)
    } else if !base.ends_with('/') && !path.starts_with('/') {
        format!("{}/{}", base, path)
    } else {
        format!("{}{}", base, path)
    }
}

fn convert_path_params(path: &str) -> String {
    // Convert {param} to :param
    let mut new_path = String::new();
    let mut chars = path.chars().peekable();
    
    while let Some(c) = chars.next() {
        if c == '{' {
            new_path.push(':');
            // Capture param name until }
            while let Some(&next_c) = chars.peek() {
                if next_c == '}' {
                    chars.next(); // consume }
                    break;
                }
                new_path.push(chars.next().unwrap());
            }
        } else {
            new_path.push(c);
        }
    }
    new_path
}

fn resolve_schema_properties(schema: &Value, components: &Option<Components>) -> HashMap<String, Value> {
    let mut properties = HashMap::new();

    // Handle $ref
    if let Some(ref_path) = schema.get("$ref").and_then(|r| r.as_str()) {
        if let Some(comps) = components {
            if let Some(schemas) = &comps.schemas {
                // simple ref resolution: #/components/schemas/SchemaName
                if let Some(schema_name) = ref_path.split('/').last() {
                    if let Some(ref_schema) = schemas.get(schema_name) {
                        return resolve_schema_properties(ref_schema, components);
                    }
                }
            }
        }
    }

    // Handle allOf (merge properties)
    if let Some(all_of) = schema.get("allOf").and_then(|a| a.as_array()) {
        for sub_schema in all_of {
             let sub_props = resolve_schema_properties(sub_schema, components);
             properties.extend(sub_props);
        }
    }

    // Handle direct properties
    if let Some(props) = schema.get("properties").and_then(|p| p.as_object()) {
        for (key, value) in props {
            properties.insert(key.clone(), value.clone());
        }
    }
    
    properties
}

pub fn convert_openapi(spec: OpenApiSpec) -> (Vec<Collection>, Vec<HttpRequest>) {
    let root_collection_id = Uuid::new_v4();
    let root_collection = Collection {
        id: root_collection_id,
        name: spec.info.title,
        description: spec.info.description,
        parent_id: None,
        auth: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        synced: false,
        version: 0,
        cloud_id: None,
    };

    let mut collections = vec![root_collection];
    let mut requests = Vec::new();
    // Map tag name to collection ID
    let mut tag_collections: HashMap<String, Uuid> = HashMap::new();

    // Use the first server URL as the base URL, or default to empty string if not found
    let default_base_url = spec
        .servers
        .as_ref()
        .and_then(|s| s.first())
        .map(|s| s.url.clone())
        .unwrap_or_else(|| "http://localhost".to_string());

    // Group paths by tags (if available) to simulate folders
    for (path, item) in spec.paths {
        // Shared parameters for all operations in this path
        let path_parameters = item.parameters.as_ref();

        let mut add_req = |method: HttpMethod, op: Option<Operation>| {
            if let Some(op) = op {
                // Convert OpenAPI path params {id} to Geni style :id
                let converted_path = convert_path_params(&path);

                let full_url = if !converted_path.starts_with("http") {
                    join_url(&default_base_url, &converted_path)
                } else {
                    converted_path.to_string()
                };

                // Use just the path for the name if no summary/ID
                let name = op
                    .summary
                    .or(op.operation_id)
                    .unwrap_or_else(|| format!("{} {}", method.to_string(), path));

                let mut headers = HashMap::new();
                let mut path_params = HashMap::new();
                let mut query_params = Vec::new();
                
                // Process parameters (both path-level and operation-level)
                let all_params = path_parameters.into_iter().flatten().chain(op.parameters.iter().flatten());
                
                for param in all_params {
                    match param.in_loc.as_str() {
                        "header" => {
                            headers.insert(param.name.clone(), "".to_string());
                        }
                        "path" => {
                            path_params.insert(param.name.clone(), "".to_string());
                        }
                        "query" => {
                            // We use "param=" format to ensure it's recognized as a key with empty value
                            query_params.push(format!("{}=", param.name));
                        }
                        _ => {}
                    }
                }

                // Append query parameters to URL
                let final_url = if !query_params.is_empty() {
                    let separator = if full_url.contains('?') { "&" } else { "?" };
                    format!("{}{}{}", full_url, separator, query_params.join("&"))
                } else {
                    full_url
                };

                // Process body
                let body = if let Some(rb) = op.request_body {
                    if let Some(json_media) = rb.content.get("application/json") {
                        if let Some(example) = &json_media.example {
                            Some(ModelRequestBody::Json(example.clone()))
                        } else if let Some(schema) = &json_media.schema {
                             // Try to resolve schema properties to generate a dummy JSON
                             let properties = resolve_schema_properties(schema, &spec.components);
                             if !properties.is_empty() {
                                 let mut json_obj = serde_json::Map::new();
                                 for (key, _) in properties {
                                     json_obj.insert(key, serde_json::Value::String("".to_string()));
                                 }
                                 Some(ModelRequestBody::Json(serde_json::Value::Object(json_obj)))
                             } else {
                                 Some(ModelRequestBody::Json(serde_json::json!({})))
                             }
                        } else {
                            Some(ModelRequestBody::Json(serde_json::json!({})))
                        }
                    } else if let Some(form) = rb.content.get("application/x-www-form-urlencoded") {
                         let mut form_data = HashMap::new();
                         if let Some(schema) = &form.schema {
                             let properties = resolve_schema_properties(schema, &spec.components);
                             for (key, _) in properties {
                                 form_data.insert(key, "".to_string());
                             }
                         }
                         Some(ModelRequestBody::UrlEncoded(form_data))
                    } else if let Some(form) = rb.content.get("multipart/form-data") {
                         let mut form_data = HashMap::new();
                         if let Some(schema) = &form.schema {
                             let properties = resolve_schema_properties(schema, &spec.components);
                             for (key, val) in properties {
                                 let field = if val.get("format").and_then(|f| f.as_str()) == Some("binary") {
                                     crate::models::FormDataField::File { path: "".to_string() }
                                 } else {
                                     crate::models::FormDataField::Text { value: "".to_string() }
                                 };
                                 form_data.insert(key, field);
                             }
                         }
                         Some(ModelRequestBody::FormData(form_data))
                    } else {
                         None
                    }
                } else {
                    None
                };


                // Determine folder/collection based on tags
                let parent_collection_id = if let Some(tags) = &op.tags {
                    if let Some(first_tag) = tags.first() {
                        if let Some(id) = tag_collections.get(first_tag) {
                            *id
                        } else {
                            // Create new sub-collection for this tag
                            let new_id = Uuid::new_v4();
                            let sub_collection = Collection {
                                id: new_id,
                                name: first_tag.clone(),
                                description: None,
                                parent_id: Some(root_collection_id),
                                auth: None,
                                created_at: Utc::now(),
                                updated_at: Utc::now(),
                                synced: false,
                                version: 0,
                                cloud_id: None,
                            };
                            collections.push(sub_collection);
                            tag_collections.insert(first_tag.clone(), new_id);
                            new_id
                        }
                    } else {
                        root_collection_id
                    }
                } else {
                    root_collection_id
                };
                
                let request = HttpRequest {
                    id: Some(Uuid::new_v4()),
                    name,
                    method,
                    url: final_url,
                    headers,
                    body,
                    path_params,
                    collection_id: Some(parent_collection_id),
                    created_at: Some(Utc::now()),
                    updated_at: Some(Utc::now()),
                    synced: false,
                    version: 0,
                    cloud_id: None,
                };
                requests.push(request);
            }
        };

        add_req(HttpMethod::GET, item.get);
        add_req(HttpMethod::POST, item.post);
        add_req(HttpMethod::PUT, item.put);
        add_req(HttpMethod::DELETE, item.delete);
        add_req(HttpMethod::PATCH, item.patch);
        add_req(HttpMethod::HEAD, item.head);
        add_req(HttpMethod::OPTIONS, item.options);
    }

    (collections, requests)
}
