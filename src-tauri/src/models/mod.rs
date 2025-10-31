use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuthType {
    #[serde(rename = "none")]
    None,
    #[serde(rename = "basic")]
    Basic,
    #[serde(rename = "bearer")]
    Bearer,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BasicAuth {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BearerAuth {
    pub token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthConfig {
    #[serde(rename = "type")]
    pub auth_type: AuthType,
    pub basic: Option<BasicAuth>,
    pub bearer: Option<BearerAuth>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpRequest {
    pub id: Option<Uuid>,
    pub name: String,
    pub method: HttpMethod,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub body: Option<RequestBody>,
    pub collection_id: Option<Uuid>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpResponse {
    pub status: u16,
    pub status_text: String,
    pub headers: HashMap<String, String>,
    pub body: String,
    pub response_time: u64, // in milliseconds
    pub size: usize,        // in bytes
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HttpMethod {
    GET,
    POST,
    PUT,
    DELETE,
    PATCH,
    HEAD,
    OPTIONS,
}

impl ToString for HttpMethod {
    fn to_string(&self) -> String {
        match self {
            HttpMethod::GET => "GET".to_string(),
            HttpMethod::POST => "POST".to_string(),
            HttpMethod::PUT => "PUT".to_string(),
            HttpMethod::DELETE => "DELETE".to_string(),
            HttpMethod::PATCH => "PATCH".to_string(),
            HttpMethod::HEAD => "HEAD".to_string(),
            HttpMethod::OPTIONS => "OPTIONS".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RequestBody {
    Raw { content: String, content_type: String },
    Json(serde_json::Value),
    FormData(HashMap<String, String>),
    UrlEncoded(HashMap<String, String>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Collection {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub parent_id: Option<Uuid>,
    pub auth: Option<AuthConfig>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Environment {
    pub id: Uuid,
    pub name: String,
    pub variables: HashMap<String, String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestHistory {
    pub id: Uuid,
    pub request: HttpRequest,
    pub response: Option<HttpResponse>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SendRequestPayload {
    pub method: HttpMethod,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub body: Option<RequestBody>,
    pub timeout: Option<u64>, // in seconds
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateCollectionPayload {
    pub name: String,
    pub description: Option<String>,
    pub parent_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveRequestPayload {
    pub id: Option<String>,
    pub name: String,
    pub method: HttpMethod,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub body: Option<RequestBody>,
    pub collection_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateEnvironmentPayload {
    pub name: String,
    pub variables: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateCollectionAuthPayload {
    pub collection_id: String,
    pub auth: Option<AuthConfig>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateCollectionNamePayload {
    pub collection_id: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateRequestNamePayload {
    pub request_id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrettyResponse {
    pub status: u16,
    pub status_text: String,
    pub headers: HashMap<String, String>,
    pub body: String,
    pub formatted_body: Option<String>,
    pub highlighted_body: Option<String>,
    pub response_time: u64,
    pub size: usize,
}

impl Default for HttpRequest {
    fn default() -> Self {
        Self {
            id: None,
            name: "New Request".to_string(),
            method: HttpMethod::GET,
            url: "https://".to_string(),
            headers: HashMap::new(),
            body: None,
            collection_id: None,
            created_at: None,
            updated_at: None,
        }
    }
}

impl HttpRequest {
    pub fn new(name: String, method: HttpMethod, url: String) -> Self {
        Self {
            id: Some(Uuid::new_v4()),
            name,
            method,
            url,
            headers: HashMap::new(),
            body: None,
            collection_id: None,
            created_at: Some(Utc::now()),
            updated_at: Some(Utc::now()),
        }
    }
}

impl Collection {
    pub fn new(name: String, description: Option<String>) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            name,
            description,
            parent_id: None,
            auth: None,
            created_at: now,
            updated_at: now,
        }
    }

    pub fn new_with_parent(name: String, description: Option<String>, parent_id: Option<Uuid>) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            name,
            description,
            parent_id,
            auth: None,
            created_at: now,
            updated_at: now,
        }
    }
}

impl Environment {
    pub fn new(name: String, variables: HashMap<String, String>) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            name,
            variables,
            is_active: false,
            created_at: now,
            updated_at: now,
        }
    }
}

impl RequestHistory {
    pub fn new(request: HttpRequest, response: Option<HttpResponse>) -> Self {
        Self {
            id: Uuid::new_v4(),
            request,
            response,
            timestamp: Utc::now(),
        }
    }
}
