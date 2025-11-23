use anyhow::Result;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::db::Database;
use crate::http::{replace_environment_variables, replace_path_parameters, HttpClient};
use crate::models::*;
use crate::sync::SyncClient;

// State wrapper for database
pub struct AppState {
    pub db: Database,
    pub http_client: HttpClient,
    pub sync_client: Arc<Mutex<SyncClient>>,
}

#[tauri::command]
pub async fn send_request(
    payload: SendRequestPayload,
    state: State<'_, AppState>,
) -> Result<PrettyResponse, String> {
    // Get active environment variables
    let env_vars = state
        .db
        .get_active_environment()
        .await
        .map_err(|e| e.to_string())?
        .map(|env| env.variables)
        .unwrap_or_default();

    // Replace path parameters first (e.g., :user_id -> 123)
    let url_with_path = replace_path_parameters(&payload.url, &payload.path_params);

    // Then replace environment variables in URL
    let url = replace_environment_variables(&url_with_path, &env_vars);

    // Replace environment variables in headers
    let mut headers = HashMap::new();
    for (key, value) in &payload.headers {
        let replaced_key = replace_environment_variables(key, &env_vars);
        let replaced_value = replace_environment_variables(value, &env_vars);
        headers.insert(replaced_key, replaced_value);
    }

    // Replace environment variables in body
    let body = if let Some(ref body) = payload.body {
        Some(match body {
            RequestBody::Raw {
                content,
                content_type,
            } => RequestBody::Raw {
                content: replace_environment_variables(content, &env_vars),
                content_type: replace_environment_variables(content_type, &env_vars),
            },
            RequestBody::Json(value) => {
                let json_str = serde_json::to_string(value).map_err(|e| e.to_string())?;
                let replaced_str = replace_environment_variables(&json_str, &env_vars);
                let replaced_value: serde_json::Value = serde_json::from_str(&replaced_str)
                    .map_err(|e| format!("Invalid JSON after variable replacement: {}", e))?;
                RequestBody::Json(replaced_value)
            }
            RequestBody::FormData(form) => {
                let mut replaced_form = HashMap::new();
                for (key, field) in form {
                    let replaced_key = replace_environment_variables(key, &env_vars);
                    let replaced_field = match field {
                        FormDataField::Text { value } => FormDataField::Text {
                            value: replace_environment_variables(value, &env_vars),
                        },
                        FormDataField::File { path } => {
                            // Replace environment variables in file path
                            FormDataField::File {
                                path: replace_environment_variables(path, &env_vars),
                            }
                        }
                    };
                    replaced_form.insert(replaced_key, replaced_field);
                }
                RequestBody::FormData(replaced_form)
            }
            RequestBody::UrlEncoded(form) => {
                let mut replaced_form = HashMap::new();
                for (key, value) in form {
                    let replaced_key = replace_environment_variables(key, &env_vars);
                    let replaced_value = replace_environment_variables(value, &env_vars);
                    replaced_form.insert(replaced_key, replaced_value);
                }
                RequestBody::UrlEncoded(replaced_form)
            }
        })
    } else {
        None
    };

    let modified_payload = SendRequestPayload {
        method: payload.method.clone(),
        url,
        headers,
        body,
        path_params: HashMap::new(), // Path params already applied to URL
        timeout: payload.timeout,
    };

    // Send the request
    let response = state
        .http_client
        .send_request(modified_payload)
        .await
        .map_err(|e| e.to_string())?;

    // Create HTTP request and response for history
    let http_request = HttpRequest {
        id: Some(Uuid::new_v4()),
        name: format!("{} {}", payload.method.to_string(), payload.url),
        method: payload.method,
        url: payload.url,
        headers: payload.headers,
        body: payload.body,
        path_params: HashMap::new(),
        collection_id: None,
        created_at: Some(chrono::Utc::now()),
        updated_at: Some(chrono::Utc::now()),
        synced: false,
        version: 0,
        cloud_id: None,
    };

    let http_response = HttpResponse {
        status: response.status,
        status_text: response.status_text.clone(),
        headers: response.headers.clone(),
        body: response.body.clone(),
        response_time: response.response_time,
        size: response.size,
    };

    // Save to history
    let history = RequestHistory::new(http_request, Some(http_response));
    if let Err(e) = state.db.save_to_history(&history).await {
        eprintln!("Failed to save request to history: {}", e);
    }

    Ok(response)
}

// Collection commands
#[tauri::command]
pub async fn create_collection(
    payload: CreateCollectionPayload,
    state: State<'_, AppState>,
) -> Result<Collection, String> {
    let parent_uuid = if let Some(parent_id_str) = payload.parent_id {
        Some(Uuid::parse_str(&parent_id_str).map_err(|e| format!("Invalid parent ID: {}", e))?)
    } else {
        None
    };

    let collection = Collection::new_with_parent(payload.name, payload.description, parent_uuid);
    state
        .db
        .create_collection(&collection)
        .await
        .map_err(|e| e.to_string())?;
    Ok(collection)
}

#[tauri::command]
pub async fn get_collections(state: State<'_, AppState>) -> Result<Vec<Collection>, String> {
    state.db.get_collections().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_collection(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state
        .db
        .delete_collection(uuid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn move_collection(
    collection_id: String,
    new_parent_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let collection_uuid = Uuid::parse_str(&collection_id).map_err(|e| e.to_string())?;
    let parent_uuid = if let Some(parent_id) = new_parent_id {
        Some(Uuid::parse_str(&parent_id).map_err(|e| e.to_string())?)
    } else {
        None
    };

    state
        .db
        .move_collection(collection_uuid, parent_uuid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_collection_auth(
    collection_id: String,
    auth: Option<AuthConfig>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let collection_uuid = Uuid::parse_str(&collection_id).map_err(|e| e.to_string())?;

    state
        .db
        .update_collection_auth(collection_uuid, auth)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_collection_name(
    payload: UpdateCollectionNamePayload,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let collection_uuid = Uuid::parse_str(&payload.collection_id).map_err(|e| e.to_string())?;

    state
        .db
        .update_collection_name(collection_uuid, payload.name)
        .await
        .map_err(|e| e.to_string())
}

// Request commands
#[tauri::command]
pub async fn save_request(
    payload: SaveRequestPayload,
    state: State<'_, AppState>,
) -> Result<HttpRequest, String> {
    // Convert string collection_id to UUID if provided
    let collection_uuid = if let Some(id_str) = &payload.collection_id {
        Some(Uuid::parse_str(id_str).map_err(|e| format!("Invalid collection ID: {}", e))?)
    } else {
        None
    };

    // Parse request ID if provided
    let request_id = if let Some(id_str) = &payload.id {
        Some(Uuid::parse_str(id_str).map_err(|e| format!("Invalid request ID: {}", e))?)
    } else {
        None
    };

    // Create or update the request
    let request = if let Some(id) = request_id {
        // Update existing request with provided ID
        HttpRequest {
            id: Some(id),
            name: payload.name,
            method: payload.method,
            url: payload.url,
            headers: payload.headers,
            body: payload.body,
            path_params: payload.path_params,
            collection_id: collection_uuid,
            created_at: Some(chrono::Utc::now()), // Will be preserved by DB if exists
            updated_at: Some(chrono::Utc::now()),
            synced: false,
            version: 0,
            cloud_id: None,
        }
    } else {
        // Create new request
        let mut new_request = HttpRequest::new(payload.name, payload.method, payload.url);
        new_request.headers = payload.headers;
        new_request.body = payload.body;
        new_request.path_params = payload.path_params;
        new_request.collection_id = collection_uuid;
        new_request
    };

    // Save to database and get the saved request with proper ID
    let saved_request = state
        .db
        .save_request(&request)
        .await
        .map_err(|e| e.to_string())?;

    Ok(saved_request)
}

#[tauri::command]
pub async fn get_requests(
    collection_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<HttpRequest>, String> {
    let uuid = if let Some(id) = collection_id {
        Some(Uuid::parse_str(&id).map_err(|e| e.to_string())?)
    } else {
        None
    };

    state.db.get_requests(uuid).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_request(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state
        .db
        .delete_request(uuid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn move_request(
    request_id: String,
    new_collection_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let request_uuid = Uuid::parse_str(&request_id).map_err(|e| e.to_string())?;

    // Handle moving to root (no collection)
    let collection_uuid = if new_collection_id == "root" {
        None
    } else {
        Some(Uuid::parse_str(&new_collection_id).map_err(|e| e.to_string())?)
    };

    state
        .db
        .move_request_to_collection(request_uuid, collection_uuid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_request_name(
    payload: UpdateRequestNamePayload,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let request_uuid = Uuid::parse_str(&payload.request_id).map_err(|e| e.to_string())?;

    state
        .db
        .update_request_name(request_uuid, payload.name)
        .await
        .map_err(|e| e.to_string())
}

// Environment commands
#[tauri::command]
pub async fn create_environment(
    payload: CreateEnvironmentPayload,
    state: State<'_, AppState>,
) -> Result<Environment, String> {
    let environment = Environment::new(payload.name, payload.variables);
    state
        .db
        .create_environment(&environment)
        .await
        .map_err(|e| e.to_string())?;
    Ok(environment)
}

#[tauri::command]
pub async fn get_environments(state: State<'_, AppState>) -> Result<Vec<Environment>, String> {
    state.db.get_environments().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_active_environment(
    id: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let uuid = if let Some(id) = id {
        Some(Uuid::parse_str(&id).map_err(|e| e.to_string())?)
    } else {
        None
    };

    state
        .db
        .set_active_environment(uuid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_active_environment(
    state: State<'_, AppState>,
) -> Result<Option<Environment>, String> {
    state
        .db
        .get_active_environment()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_environment(
    id: String,
    name: String,
    variables: std::collections::HashMap<String, String>,
    state: State<'_, AppState>,
) -> Result<Environment, String> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state
        .db
        .update_environment(uuid, name, variables)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_environment(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;

    // If this environment is active, deactivate it first
    let active_env = state
        .db
        .get_active_environment()
        .await
        .map_err(|e| e.to_string())?;
    if let Some(active) = active_env {
        if active.id == uuid {
            state
                .db
                .set_active_environment(None)
                .await
                .map_err(|e| e.to_string())?;
        }
    }

    state
        .db
        .delete_environment(uuid)
        .await
        .map_err(|e| e.to_string())
}

// History commands
#[tauri::command]
pub async fn get_request_history(
    limit: Option<i32>,
    state: State<'_, AppState>,
) -> Result<Vec<RequestHistory>, String> {
    state.db.get_history(limit).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clear_request_history(state: State<'_, AppState>) -> Result<(), String> {
    state.db.clear_history().await.map_err(|e| e.to_string())
}

// Utility commands
#[tauri::command]
pub async fn format_json(content: String) -> Result<String, String> {
    let value: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("Invalid JSON: {}", e))?;

    serde_json::to_string_pretty(&value).map_err(|e| format!("Failed to format JSON: {}", e))
}

#[tauri::command]
pub async fn validate_url(url: String) -> Result<bool, String> {
    match reqwest::Url::parse(&url) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub async fn extract_env_variables(text: String) -> Result<Vec<String>, String> {
    Ok(crate::http::extract_environment_variables(&text))
}

#[tauri::command]
pub async fn highlight_response(
    content: String,
    content_type: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let language = if let Some(ct) = &content_type {
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
        } else {
            "txt"
        }
    } else {
        // Try to auto-detect JSON
        if serde_json::from_str::<serde_json::Value>(&content).is_ok() {
            "json"
        } else {
            "txt"
        }
    };

    state
        .http_client
        .highlight_syntax(&content, language)
        .map_err(|e| e.to_string())
}

// Import/Export commands
#[tauri::command]
pub async fn export_collection(
    collection_id: String,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let uuid = Uuid::parse_str(&collection_id).map_err(|e| e.to_string())?;

    // Get collection
    let collections = state
        .db
        .get_collections()
        .await
        .map_err(|e| e.to_string())?;
    let collection = collections
        .into_iter()
        .find(|c| c.id == uuid)
        .ok_or("Collection not found")?;

    // Get requests in collection
    let requests = state
        .db
        .get_requests(Some(uuid))
        .await
        .map_err(|e| e.to_string())?;

    let export_data = serde_json::json!({
        "collection": collection,
        "requests": requests,
        "exported_at": chrono::Utc::now(),
        "version": "1.0"
    });

    Ok(export_data)
}

#[tauri::command]
pub async fn import_collection(
    data: serde_json::Value,
    state: State<'_, AppState>,
) -> Result<Collection, String> {
    let collection_data = data
        .get("collection")
        .ok_or("Invalid export format: missing collection")?;

    let requests_data = data
        .get("requests")
        .ok_or("Invalid export format: missing requests")?;

    // Create new collection with new ID
    let mut collection: Collection = serde_json::from_value(collection_data.clone())
        .map_err(|e| format!("Invalid collection data: {}", e))?;

    collection.id = Uuid::new_v4();
    collection.name = format!("{} (Imported)", collection.name);

    // Save collection
    state
        .db
        .create_collection(&collection)
        .await
        .map_err(|e| e.to_string())?;

    // Import requests
    let requests: Vec<HttpRequest> = serde_json::from_value(requests_data.clone())
        .map_err(|e| format!("Invalid requests data: {}", e))?;

    for mut request in requests {
        request.id = Some(Uuid::new_v4());
        request.collection_id = Some(collection.id);
        request.created_at = Some(chrono::Utc::now());
        request.updated_at = Some(chrono::Utc::now());

        state
            .db
            .save_request(&request)
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(collection)
}

#[tauri::command]
pub async fn import_postman_collection(
    json_data: String,
    state: State<'_, AppState>,
) -> Result<Collection, String> {
    // Parse JSON string directly
    let postman_collection: crate::postman::PostmanCollection = serde_json::from_str(&json_data)
        .map_err(|e| {
            eprintln!("❌ Postman import error: {}", e);
            // Log the problematic area of JSON
            if let Some(line_col) = e.to_string().split("at line ").nth(1) {
                if let Some(line_str) = line_col.split(" column").next() {
                    if let Ok(line_num) = line_str.parse::<usize>() {
                        let lines: Vec<&str> = json_data.lines().collect();
                        if line_num > 0 && line_num <= lines.len() {
                            eprintln!("📍 Context around line {}:", line_num);
                            let start = line_num.saturating_sub(3);
                            let end = (line_num + 2).min(lines.len());
                            for i in start..end {
                                if i == line_num - 1 {
                                    eprintln!(">>> {}: {}", i + 1, lines[i]);
                                } else {
                                    eprintln!("    {}: {}", i + 1, lines[i]);
                                }
                            }
                        }
                    }
                }
            }
            format!("Invalid Postman collection format: {}", e)
        })?;

    // Convert to Geni format
    let (mut collections, requests) =
        crate::postman::convert_postman_collection(postman_collection);

    // Mark the root collection as imported
    if let Some(root_collection) = collections.first_mut() {
        root_collection.name = format!("{} (Imported from Postman)", root_collection.name);
    }

    // Save all collections (root and sub-collections)
    for collection in &collections {
        state
            .db
            .create_collection(collection)
            .await
            .map_err(|e| e.to_string())?;
    }

    // Import all requests
    for request in &requests {
        state
            .db
            .save_request(request)
            .await
            .map_err(|e| e.to_string())?;
    }

    // Return the root collection
    Ok(collections.into_iter().next().unwrap())
}

// Cloud Sync Commands

// Initialize or reconfigure sync client
#[tauri::command]
pub async fn initialize_sync(
    provider: String,
    api_server_url: Option<String>,
    supabase_url: Option<String>,
    supabase_api_key: Option<String>,
    supabase_db_uri: Option<String>,
    google_client_id: Option<String>,
    google_client_secret: Option<String>,
    google_redirect_uri: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    use crate::sync::{ProviderConfig, SyncProvider};

    let sync_provider = SyncProvider::from_str(&provider)
        .ok_or_else(|| format!("Invalid provider: {}", provider))?;

    let config = ProviderConfig {
        provider: sync_provider.clone(),
        api_server_url,
        supabase_url,
        supabase_api_key,
        supabase_db_uri,
        google_client_id,
        google_client_secret,
        google_redirect_uri,
    };

    let new_client = SyncClient::new(config.clone()).map_err(|e| e.to_string())?;

    // Auto-create schema for Supabase if needed
    if sync_provider == SyncProvider::Supabase {
        new_client
            .ensure_schema()
            .await
            .map_err(|e| e.to_string())?;
    }

    let mut client = state.sync_client.lock().await;
    *client = new_client;

    // Save config to database
    let config_json = config.to_json().map_err(|e| e.to_string())?;
    state
        .db
        .save_sync_config(sync_provider.as_str(), &config_json)
        .await
        .map_err(|e| e.to_string())?;

    state
        .db
        .set_last_sync_provider(sync_provider.as_str())
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// Load saved sync configuration
#[tauri::command]
pub async fn load_saved_sync_config(state: State<'_, AppState>) -> Result<Option<String>, String> {
    use crate::sync::ProviderConfig;

    // Get last used provider
    let provider = state
        .db
        .get_last_sync_provider()
        .await
        .map_err(|e| e.to_string())?;

    if let Some(provider_name) = provider {
        // Get config for that provider
        let config_json = state
            .db
            .get_sync_config(&provider_name)
            .await
            .map_err(|e| e.to_string())?;

        if let Some(json) = config_json {
            // Initialize sync client with saved config
            let config = ProviderConfig::from_json(&json).map_err(|e| e.to_string())?;

            let new_client = SyncClient::new(config).map_err(|e| e.to_string())?;

            let mut client = state.sync_client.lock().await;
            *client = new_client;

            // Return the config JSON for the frontend
            return Ok(Some(json));
        }
    }

    Ok(None)
}

// API Server-specific auth commands
#[tauri::command]
pub async fn api_server_sign_up(
    email: String,
    password: String,
    name: Option<String>,
    state: State<'_, AppState>,
) -> Result<TokenResponse, String> {
    let mut client = state.sync_client.lock().await;
    client
        .api_server_sign_up(&email, &password, name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn api_server_sign_in(
    email: String,
    password: String,
    state: State<'_, AppState>,
) -> Result<TokenResponse, String> {
    let mut client = state.sync_client.lock().await;
    client
        .api_server_sign_in(&email, &password)
        .await
        .map_err(|e| e.to_string())
}

// Supabase-specific auth commands
#[tauri::command]
pub async fn supabase_sign_up(
    email: String,
    password: String,
    name: Option<String>,
    state: State<'_, AppState>,
) -> Result<TokenResponse, String> {
    let mut client = state.sync_client.lock().await;
    client
        .supabase_sign_up(&email, &password, name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn supabase_sign_in(
    email: String,
    password: String,
    state: State<'_, AppState>,
) -> Result<TokenResponse, String> {
    let mut client = state.sync_client.lock().await;
    client
        .supabase_sign_in(&email, &password)
        .await
        .map_err(|e| e.to_string())
}

// Google Drive-specific auth commands
#[tauri::command]
pub async fn google_drive_get_auth_url(
    state: State<'_, AppState>,
) -> Result<(String, String), String> {
    let client = state.sync_client.lock().await;
    client
        .google_drive_generate_auth_url()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn google_drive_exchange_code(
    code: String,
    state: State<'_, AppState>,
) -> Result<TokenResponse, String> {
    let mut client = state.sync_client.lock().await;
    client
        .google_drive_exchange_code(&code)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn google_drive_refresh_token(state: State<'_, AppState>) -> Result<(), String> {
    let mut client = state.sync_client.lock().await;
    client
        .google_drive_refresh_token()
        .await
        .map_err(|e| e.to_string())
}

// Common auth commands
#[tauri::command]
pub async fn logout(state: State<'_, AppState>) -> Result<(), String> {
    use crate::sync::{ProviderConfig, SyncClient, SyncProvider};

    // Sign out from current provider
    let mut client = state.sync_client.lock().await;
    client.sign_out();
    drop(client); // Release the lock

    // Clear all sync configuration from database
    state
        .db
        .clear_sync_config()
        .await
        .map_err(|e| e.to_string())?;

    // Reset sync client to default (no provider)
    let default_config = ProviderConfig {
        provider: SyncProvider::ApiServer,
        api_server_url: None,
        supabase_url: None,
        supabase_api_key: None,
        supabase_db_uri: None,
        google_client_id: None,
        google_client_secret: None,
        google_redirect_uri: None,
    };

    let new_client = SyncClient::new(default_config).map_err(|e| e.to_string())?;

    let mut client = state.sync_client.lock().await;
    *client = new_client;

    Ok(())
}

// Supabase schema management
#[tauri::command]
pub async fn supabase_create_schema(state: State<'_, AppState>) -> Result<String, String> {
    let client = state.sync_client.lock().await;
    match client.ensure_schema().await {
        Ok(_) => Ok("Schema created successfully or already exists".to_string()),
        Err(e) => Err(format!("Failed to create schema: {}", e)),
    }
}

#[tauri::command]
pub async fn is_authenticated(state: State<'_, AppState>) -> Result<bool, String> {
    let client = state.sync_client.lock().await;
    Ok(client.is_authenticated())
}

#[tauri::command]
pub async fn get_current_user(state: State<'_, AppState>) -> Result<Option<User>, String> {
    let client = state.sync_client.lock().await;
    Ok(client.get_current_user().await)
}

#[tauri::command]
pub async fn sync_push(state: State<'_, AppState>) -> Result<(), String> {
    // Get unsynced items
    let collections = state
        .db
        .get_unsynced_collections()
        .await
        .map_err(|e| e.to_string())?;

    let requests = state
        .db
        .get_unsynced_requests()
        .await
        .map_err(|e| e.to_string())?;

    let environments = state
        .db
        .get_unsynced_environments()
        .await
        .map_err(|e| e.to_string())?;

    if collections.is_empty() && requests.is_empty() && environments.is_empty() {
        return Ok(()); // Nothing to sync
    }

    let client = state.sync_client.lock().await;

    // Push to cloud
    for collection in collections {
        if let Some(cloud_id) = &collection.cloud_id {
            // Update existing
            client
                .push_collection(&collection)
                .await
                .map_err(|e| e.to_string())?;

            state
                .db
                .mark_collection_synced(collection.id, cloud_id.clone(), collection.version)
                .await
                .map_err(|e| e.to_string())?;
        } else {
            // Create new
            let cloud_id = client
                .push_collection(&collection)
                .await
                .map_err(|e| e.to_string())?;

            state
                .db
                .mark_collection_synced(collection.id, cloud_id, collection.version)
                .await
                .map_err(|e| e.to_string())?;
        }
    }

    for request in requests {
        if let Some(ref cloud_id) = request.cloud_id {
            client
                .push_request(&request)
                .await
                .map_err(|e| e.to_string())?;

            state
                .db
                .mark_request_synced(request.id.unwrap(), cloud_id.clone(), request.version)
                .await
                .map_err(|e| e.to_string())?;
        } else {
            let cloud_id = client
                .push_request(&request)
                .await
                .map_err(|e| e.to_string())?;

            state
                .db
                .mark_request_synced(request.id.unwrap(), cloud_id, request.version)
                .await
                .map_err(|e| e.to_string())?;
        }
    }

    for environment in environments {
        if let Some(ref cloud_id) = environment.cloud_id {
            client
                .push_environment(&environment)
                .await
                .map_err(|e| e.to_string())?;

            state
                .db
                .mark_environment_synced(environment.id, cloud_id.clone(), environment.version)
                .await
                .map_err(|e| e.to_string())?;
        } else {
            let cloud_id = client
                .push_environment(&environment)
                .await
                .map_err(|e| e.to_string())?;

            state
                .db
                .mark_environment_synced(environment.id, cloud_id, environment.version)
                .await
                .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn sync_pull(state: State<'_, AppState>) -> Result<(), String> {
    // Pull from cloud
    let client = state.sync_client.lock().await;
    let pull_response = client.pull_sync().await.map_err(|e| e.to_string())?;

    drop(client); // Release lock before database operations

    // Merge collections
    for collection in pull_response.collections {
        state
            .db
            .merge_collection(collection)
            .await
            .map_err(|e| e.to_string())?;
    }

    // Merge requests
    for request in pull_response.requests {
        state
            .db
            .merge_request(request)
            .await
            .map_err(|e| e.to_string())?;
    }

    // Merge environments
    for environment in pull_response.environments {
        state
            .db
            .merge_environment(environment)
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn sync_full(state: State<'_, AppState>) -> Result<(), String> {
    // First push unsynced items
    sync_push(state.clone()).await?;

    // Then pull updates
    sync_pull(state).await?;

    Ok(())
}

#[tauri::command]
pub async fn get_sync_status(state: State<'_, AppState>) -> Result<SyncStatus, String> {
    let unsynced_collections = state
        .db
        .get_unsynced_collections()
        .await
        .map_err(|e| e.to_string())?;

    let unsynced_requests = state
        .db
        .get_unsynced_requests()
        .await
        .map_err(|e| e.to_string())?;

    let unsynced_environments = state
        .db
        .get_unsynced_environments()
        .await
        .map_err(|e| e.to_string())?;

    let client = state.sync_client.lock().await;
    let is_authenticated = client.is_authenticated();

    Ok(SyncStatus {
        is_authenticated,
        unsynced_collections_count: unsynced_collections.len(),
        unsynced_requests_count: unsynced_requests.len(),
        unsynced_environments_count: unsynced_environments.len(),
        last_sync: None, // You can store this in a separate table if needed
    })
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct SyncStatus {
    pub is_authenticated: bool,
    pub unsynced_collections_count: usize,
    pub unsynced_requests_count: usize,
    pub unsynced_environments_count: usize,
    pub last_sync: Option<chrono::DateTime<chrono::Utc>>,
}

#[tauri::command]
pub async fn extract_path_params(url: String) -> Result<Vec<String>, String> {
    Ok(crate::http::extract_path_parameters(&url))
}
