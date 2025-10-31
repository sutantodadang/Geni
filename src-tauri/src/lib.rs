// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod models;
mod http;
mod commands;

use tauri::{Builder, Manager};
use commands::AppState;
use db::Database;
use http::HttpClient;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Initialize state synchronously in setup
            tauri::async_runtime::block_on(async {
                // Create database
                let db = Database::new().await.expect("Failed to initialize database");
                let http_client = HttpClient::new();
                let state = AppState { db, http_client };

                // Manage the state so it's available to all commands
                app.manage(state);
                println!("Database and HTTP client initialized successfully");
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
            commands::highlight_response,

            // Import/Export commands
            commands::export_collection,
            commands::import_collection,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
