// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
mod http;
mod models;
mod postman;
mod sync;

use commands::AppState;
use db::Database;
use http::HttpClient;
use std::sync::Arc;
use sync::{ProviderConfig, SyncClient, SyncProvider};
use tauri::{Builder, Manager};
use tokio::sync::Mutex;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Initialize state synchronously in setup
            tauri::async_runtime::block_on(async {
                // Get app data directory
                let app_data_dir = app
                    .path()
                    .app_data_dir()
                    .expect("Failed to get app data directory");

                // Create directory if it doesn't exist
                std::fs::create_dir_all(&app_data_dir)
                    .expect("Failed to create app data directory");

                // Create database with proper path
                let db = Database::new_with_path(app_data_dir.join("geni_db"))
                    .await
                    .expect("Failed to initialize database");
                let http_client = HttpClient::new();

                // Initialize sync client with default provider (API Server for demo)
                // TODO: Load from config or settings
                let config = ProviderConfig {
                    provider: SyncProvider::ApiServer,
                    api_server_url: Some("http://localhost:3000".to_string()),
                    supabase_url: None,
                    supabase_api_key: None,
                    supabase_db_uri: None,
                    google_client_id: None,
                    google_client_secret: None,
                    google_redirect_uri: None,
                };

                let sync_client =
                    SyncClient::new(config).expect("Failed to initialize sync client");
                let sync_client = Arc::new(Mutex::new(sync_client));

                let state = AppState {
                    db,
                    http_client,
                    sync_client,
                };

                // Manage the state so it's available to all commands
                app.manage(state);
                println!("Database, HTTP client, and Sync client initialized successfully");
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Basic commands
            greet,
            // HTTP request commands
            commands::send_request,
            // Collection commands
            commands::create_collection,
            commands::get_collections,
            commands::delete_collection,
            commands::move_collection,
            commands::update_collection_auth,
            commands::update_collection_name,
            // Request commands
            commands::save_request,
            commands::get_requests,
            commands::delete_request,
            commands::move_request,
            commands::update_request_name,
            // Environment commands
            commands::create_environment,
            commands::get_environments,
            commands::set_active_environment,
            commands::get_active_environment,
            commands::update_environment,
            commands::delete_environment,
            // History commands
            commands::get_request_history,
            commands::clear_request_history,
            // Utility commands
            commands::format_json,
            commands::validate_url,
            commands::extract_env_variables,
            commands::extract_path_params,
            commands::highlight_response,
            // Import/Export commands
            commands::export_collection,
            commands::import_collection,
            commands::import_postman_collection,
            // Cloud Sync commands - Configuration
            commands::initialize_sync,
            commands::load_saved_sync_config,
            // Cloud Sync commands (API Server)
            commands::api_server_sign_up,
            commands::api_server_sign_in,
            // Cloud Sync commands (Supabase)
            commands::supabase_sign_up,
            commands::supabase_sign_in,
            commands::supabase_create_schema,
            // Cloud Sync commands (Google Drive)
            commands::google_drive_get_auth_url,
            commands::google_drive_exchange_code,
            commands::google_drive_refresh_token,
            // Common sync commands
            commands::logout,
            commands::is_authenticated,
            commands::get_current_user,
            commands::sync_push,
            commands::sync_pull,
            commands::sync_full,
            commands::get_sync_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
