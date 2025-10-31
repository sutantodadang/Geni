use tauri::State;
use anyhow::Result;
use std::collections::HashMap;
use uuid::Uuid;

use crate::db::Database;
use crate::http::{HttpClient, replace_environment_variables};
use crate::models::*;

// State wrapper for database
pub struct AppState {
    pub db: Database,
    pub http_client: HttpClient,
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

    // Replace environment variables in URL
    let url = replace_environment_variables(&payload.url, &env_vars);

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
            RequestBody::Raw { content, content_type } => RequestBody::Raw {
                content: replace_environment_variables(content, &env_vars),
                content_type: replace_environment_variables(content_type, &env_vars),
            },
            RequestBody::Json(value) => {
                let json_str = serde_json::to_string(value).map_err(|e| e.to_string())?;
                let replaced_str = replace_environment_variables(&json_str, &env_vars);
                let replaced_value: serde_json::Value = serde_json::from_str(&replaced_str)
                    .map_err(|e| format!("Invalid JSON after variable replacement: {}", e))?;
                RequestBody::Json(replaced_value)
            },
            RequestBody::FormData(form) => {
                let mut replaced_form = HashMap::new();
                for (key, value) in form {
                    let replaced_key = replace_environment_variables(key, &env_vars);
                    let replaced_value = replace_environment_variables(value, &env_vars);
                    replaced_form.insert(replaced_key, replaced_value);
                }
                RequestBody::FormData(replaced_form)
            },
            RequestBody::UrlEncoded(form) => {
                let mut replaced_form = HashMap::new();
                for (key, value) in form {
                    let replaced_key = replace_environment_variables(key, &env_vars);
                    let replaced_value = replace_environment_variables(value, &env_vars);
                    replaced_form.insert(replaced_key, replaced_value);
                }
                RequestBody::UrlEncoded(replaced_form)
            },
        })
    } else {
        None
    };

    let modified_payload = SendRequestPayload {
        method: payload.method.clone(),
        url,
        headers,
        body,
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
        collection_id: None,
        created_at: Some(chrono::Utc::now()),
        updated_at: Some(chrono::Utc::now()),
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
pub async fn delete_collection(
    id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
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
            collection_id: collection_uuid,
            created_at: Some(chrono::Utc::now()), // Will be preserved by DB if exists
            updated_at: Some(chrono::Utc::now()),
        }
    } else {
        // Create new request
        let mut new_request = HttpRequest::new(payload.name, payload.method, payload.url);
        new_request.headers = payload.headers;
        new_request.body = payload.body;
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

    state
        .db
        .get_requests(uuid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_request(
    id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
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
    state
        .db
        .get_environments()
        .await
        .map_err(|e| e.to_string())
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
pub async fn delete_environment(
    id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;

    // If this environment is active, deactivate it first
    let active_env = state.db.get_active_environment().await.map_err(|e| e.to_string())?;
    if let Some(active) = active_env {
        if active.id == uuid {
            state.db.set_active_environment(None).await.map_err(|e| e.to_string())?;
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
    state
        .db
        .get_history(limit)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clear_request_history(state: State<'_, AppState>) -> Result<(), String> {
    state
        .db
        .clear_history()
        .await
        .map_err(|e| e.to_string())
}

// Utility commands
#[tauri::command]
pub async fn format_json(content: String) -> Result<String, String> {
    let value: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    serde_json::to_string_pretty(&value)
        .map_err(|e| format!("Failed to format JSON: {}", e))
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
        } else if ct_lower.contains("application/javascript") || ct_lower.contains("text/javascript") {
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
    let collections = state.db.get_collections().await.map_err(|e| e.to_string())?;
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
