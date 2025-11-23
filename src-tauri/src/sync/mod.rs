pub mod api_server;
pub mod google_drive;
pub mod supabase;

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};

use self::api_server::ApiServerClient;
use self::google_drive::GoogleDriveClient;
use self::supabase::SupabaseClient;
use crate::models::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SyncProvider {
    #[serde(rename = "api_server")]
    ApiServer,
    Supabase,
    #[serde(rename = "google_drive")]
    GoogleDrive,
}

impl SyncProvider {
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "api_server" | "apiserver" | "api" => Some(Self::ApiServer),
            "supabase" => Some(Self::Supabase),
            "google_drive" | "googledrive" => Some(Self::GoogleDrive),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &str {
        match self {
            Self::ApiServer => "api_server",
            Self::Supabase => "supabase",
            Self::GoogleDrive => "google_drive",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub provider: SyncProvider,
    // API Server config
    pub api_server_url: Option<String>,
    // Supabase config
    pub supabase_url: Option<String>,
    pub supabase_api_key: Option<String>,
    pub supabase_db_uri: Option<String>, // PostgreSQL connection string
    // Google Drive config
    pub google_client_id: Option<String>,
    pub google_client_secret: Option<String>,
    pub google_redirect_uri: Option<String>,
}

impl ProviderConfig {
    pub fn to_json(&self) -> Result<String> {
        serde_json::to_string(self).map_err(|e| anyhow!("Failed to serialize config: {}", e))
    }

    pub fn from_json(json: &str) -> Result<Self> {
        serde_json::from_str(json).map_err(|e| anyhow!("Failed to deserialize config: {}", e))
    }
}

pub enum SyncClient {
    ApiServer(ApiServerClient),
    Supabase(SupabaseClient),
    GoogleDrive(GoogleDriveClient),
}

impl SyncClient {
    pub fn new(config: ProviderConfig) -> Result<Self> {
        match config.provider {
            SyncProvider::ApiServer => {
                let url = config
                    .api_server_url
                    .ok_or_else(|| anyhow!("API Server URL required"))?;
                Ok(Self::ApiServer(ApiServerClient::new(&url)?))
            }
            SyncProvider::Supabase => {
                let url = config
                    .supabase_url
                    .ok_or_else(|| anyhow!("Supabase URL required"))?;
                let api_key = config
                    .supabase_api_key
                    .ok_or_else(|| anyhow!("Supabase API key required"))?;
                Ok(Self::Supabase(SupabaseClient::new_with_db_uri(
                    &url,
                    &api_key,
                    config.supabase_db_uri,
                )?))
            }
            SyncProvider::GoogleDrive => {
                let client_id = config
                    .google_client_id
                    .ok_or_else(|| anyhow!("Google Client ID required"))?;
                let client_secret = config
                    .google_client_secret
                    .ok_or_else(|| anyhow!("Google Client Secret required"))?;
                let redirect_uri = config
                    .google_redirect_uri
                    .ok_or_else(|| anyhow!("Google Redirect URI required"))?;
                Ok(Self::GoogleDrive(GoogleDriveClient::new(
                    &client_id,
                    &client_secret,
                    &redirect_uri,
                )?))
            }
        }
    }

    pub fn new_api_server(url: &str) -> Result<Self> {
        Ok(Self::ApiServer(ApiServerClient::new(url)?))
    }

    pub fn new_supabase(url: &str, api_key: &str) -> Result<Self> {
        Ok(Self::Supabase(SupabaseClient::new(url, api_key)?))
    }

    pub fn new_google_drive(
        client_id: &str,
        client_secret: &str,
        redirect_uri: &str,
    ) -> Result<Self> {
        Ok(Self::GoogleDrive(GoogleDriveClient::new(
            client_id,
            client_secret,
            redirect_uri,
        )?))
    }

    pub fn is_authenticated(&self) -> bool {
        match self {
            Self::ApiServer(client) => client.is_authenticated(),
            Self::Supabase(client) => client.is_authenticated(),
            Self::GoogleDrive(client) => client.is_authenticated(),
        }
    }

    pub fn provider_type(&self) -> SyncProvider {
        match self {
            Self::ApiServer(_) => SyncProvider::ApiServer,
            Self::Supabase(_) => SyncProvider::Supabase,
            Self::GoogleDrive(_) => SyncProvider::GoogleDrive,
        }
    }

    // Auto-create database schema (Supabase only)
    pub async fn ensure_schema(&self) -> Result<()> {
        match self {
            Self::Supabase(client) => client.ensure_schema().await,
            _ => Ok(()), // Other providers don't need schema creation
        }
    }

    // API Server-specific methods
    pub async fn api_server_sign_up(
        &mut self,
        email: &str,
        password: &str,
        name: Option<String>,
    ) -> Result<TokenResponse> {
        match self {
            Self::ApiServer(client) => {
                client
                    .sign_up(email.to_string(), password.to_string(), name)
                    .await
            }
            _ => Err(anyhow!("Not an API Server client")),
        }
    }

    pub async fn api_server_sign_in(
        &mut self,
        email: &str,
        password: &str,
    ) -> Result<TokenResponse> {
        match self {
            Self::ApiServer(client) => {
                client
                    .sign_in(email.to_string(), password.to_string())
                    .await
            }
            _ => Err(anyhow!("Not an API Server client")),
        }
    }

    // Supabase-specific methods
    pub async fn supabase_sign_up(
        &mut self,
        email: &str,
        password: &str,
        name: Option<String>,
    ) -> Result<TokenResponse> {
        match self {
            Self::Supabase(client) => {
                client
                    .sign_up(email.to_string(), password.to_string(), name)
                    .await
            }
            _ => Err(anyhow!("Not a Supabase client")),
        }
    }

    pub async fn supabase_sign_in(&mut self, email: &str, password: &str) -> Result<TokenResponse> {
        match self {
            Self::Supabase(client) => {
                client
                    .sign_in(email.to_string(), password.to_string())
                    .await
            }
            _ => Err(anyhow!("Not a Supabase client")),
        }
    }

    // Google Drive-specific methods
    pub fn google_drive_generate_auth_url(&self) -> Result<(String, String)> {
        match self {
            Self::GoogleDrive(client) => client.generate_auth_url(),
            _ => Err(anyhow!("Not a Google Drive client")),
        }
    }

    pub async fn google_drive_exchange_code(&mut self, code: &str) -> Result<TokenResponse> {
        match self {
            Self::GoogleDrive(client) => client.exchange_code(code).await,
            _ => Err(anyhow!("Not a Google Drive client")),
        }
    }

    pub async fn google_drive_refresh_token(&mut self) -> Result<()> {
        match self {
            Self::GoogleDrive(client) => client.refresh_access_token().await,
            _ => Err(anyhow!("Not a Google Drive client")),
        }
    }

    // Common methods
    pub fn sign_out(&mut self) {
        match self {
            Self::ApiServer(client) => client.sign_out(),
            Self::Supabase(client) => client.sign_out(),
            Self::GoogleDrive(client) => client.sign_out(),
        }
    }

    pub async fn get_current_user(&self) -> Option<User> {
        match self {
            Self::ApiServer(client) => client.get_current_user().await,
            Self::Supabase(client) => client.get_current_user().await,
            Self::GoogleDrive(client) => client.get_current_user().await,
        }
    }

    pub async fn push_sync(
        &self,
        collections: Vec<Collection>,
        requests: Vec<HttpRequest>,
        environments: Vec<Environment>,
    ) -> Result<()> {
        let data = SyncPullResponse {
            collections,
            requests,
            environments,
        };

        match self {
            Self::ApiServer(client) => {
                // API Server: push each item individually with create/update logic
                for collection in &data.collections {
                    if let Some(cloud_id) = &collection.cloud_id {
                        client.update_collection(cloud_id, collection).await?;
                    } else {
                        client.create_collection(collection).await?;
                    }
                }

                for request in &data.requests {
                    if let Some(cloud_id) = &request.cloud_id {
                        client.update_request(cloud_id, request).await?;
                    } else {
                        client.create_request(request).await?;
                    }
                }

                for environment in &data.environments {
                    if let Some(cloud_id) = &environment.cloud_id {
                        client.update_environment(cloud_id, environment).await?;
                    } else {
                        client.create_environment(environment).await?;
                    }
                }

                Ok(())
            }
            Self::Supabase(client) => {
                // Supabase: push each item individually with create/update logic
                for collection in &data.collections {
                    if let Some(cloud_id) = &collection.cloud_id {
                        client.update_collection(cloud_id, collection).await?;
                    } else {
                        client.create_collection(collection).await?;
                    }
                }

                for request in &data.requests {
                    if let Some(cloud_id) = &request.cloud_id {
                        client.update_request(cloud_id, request).await?;
                    } else {
                        client.create_request(request).await?;
                    }
                }

                for environment in &data.environments {
                    if let Some(cloud_id) = &environment.cloud_id {
                        client.update_environment(cloud_id, environment).await?;
                    } else {
                        client.create_environment(environment).await?;
                    }
                }

                Ok(())
            }
            Self::GoogleDrive(client) => {
                // Google Drive: bulk push to JSON file
                client.push_sync(data).await
            }
        }
    }

    pub async fn pull_sync(&self) -> Result<SyncPullResponse> {
        match self {
            Self::ApiServer(client) => {
                let collections = client.get_collections().await?;
                let requests = client.get_requests().await?;
                let environments = client.get_environments().await?;

                Ok(SyncPullResponse {
                    collections,
                    requests,
                    environments,
                })
            }
            Self::Supabase(client) => {
                let collections = client.get_collections().await?;
                let requests = client.get_requests().await?;
                let environments = client.get_environments().await?;

                Ok(SyncPullResponse {
                    collections,
                    requests,
                    environments,
                })
            }
            Self::GoogleDrive(client) => client.pull_sync().await,
        }
    }

    // Individual item operations (mainly for API Server and Supabase)
    pub async fn push_collection(&self, collection: &Collection) -> Result<String> {
        match self {
            Self::ApiServer(client) => {
                if let Some(cloud_id) = &collection.cloud_id {
                    client.update_collection(cloud_id, collection).await?;
                    Ok(cloud_id.clone())
                } else {
                    client.create_collection(collection).await
                }
            }
            Self::Supabase(client) => {
                if let Some(cloud_id) = &collection.cloud_id {
                    client.update_collection(cloud_id, collection).await?;
                    Ok(cloud_id.clone())
                } else {
                    client.create_collection(collection).await
                }
            }
            Self::GoogleDrive(_) => Err(anyhow!(
                "Individual operations not supported for Google Drive, use push_sync instead"
            )),
        }
    }

    pub async fn delete_collection(&self, cloud_id: &str) -> Result<()> {
        match self {
            Self::ApiServer(client) => client.delete_collection(cloud_id).await,
            Self::Supabase(client) => client.delete_collection(cloud_id).await,
            Self::GoogleDrive(_) => {
                Err(anyhow!("Individual delete not supported for Google Drive"))
            }
        }
    }

    pub async fn push_request(&self, request: &HttpRequest) -> Result<String> {
        match self {
            Self::ApiServer(client) => {
                if let Some(cloud_id) = &request.cloud_id {
                    client.update_request(cloud_id, request).await?;
                    Ok(cloud_id.clone())
                } else {
                    client.create_request(request).await
                }
            }
            Self::Supabase(client) => {
                if let Some(cloud_id) = &request.cloud_id {
                    client.update_request(cloud_id, request).await?;
                    Ok(cloud_id.clone())
                } else {
                    client.create_request(request).await
                }
            }
            Self::GoogleDrive(_) => Err(anyhow!(
                "Individual operations not supported for Google Drive, use push_sync instead"
            )),
        }
    }

    pub async fn delete_request(&self, cloud_id: &str) -> Result<()> {
        match self {
            Self::ApiServer(client) => client.delete_request(cloud_id).await,
            Self::Supabase(client) => client.delete_request(cloud_id).await,
            Self::GoogleDrive(_) => {
                Err(anyhow!("Individual delete not supported for Google Drive"))
            }
        }
    }

    pub async fn push_environment(&self, environment: &Environment) -> Result<String> {
        match self {
            Self::ApiServer(client) => {
                if let Some(cloud_id) = &environment.cloud_id {
                    client.update_environment(cloud_id, environment).await?;
                    Ok(cloud_id.clone())
                } else {
                    client.create_environment(environment).await
                }
            }
            Self::Supabase(client) => {
                if let Some(cloud_id) = &environment.cloud_id {
                    client.update_environment(cloud_id, environment).await?;
                    Ok(cloud_id.clone())
                } else {
                    client.create_environment(environment).await
                }
            }
            Self::GoogleDrive(_) => Err(anyhow!(
                "Individual operations not supported for Google Drive, use push_sync instead"
            )),
        }
    }

    pub async fn delete_environment(&self, cloud_id: &str) -> Result<()> {
        match self {
            Self::ApiServer(client) => client.delete_environment(cloud_id).await,
            Self::Supabase(client) => client.delete_environment(cloud_id).await,
            Self::GoogleDrive(_) => {
                Err(anyhow!("Individual delete not supported for Google Drive"))
            }
        }
    }
}

// Sync orchestration
pub struct SyncOrchestrator {
    sync_client: SyncClient,
}

impl SyncOrchestrator {
    pub fn new(sync_client: SyncClient) -> Self {
        Self { sync_client }
    }

    pub async fn perform_full_sync(
        &self,
        local_collections: Vec<Collection>,
        local_requests: Vec<HttpRequest>,
        local_environments: Vec<Environment>,
    ) -> Result<(Vec<Collection>, Vec<HttpRequest>, Vec<Environment>)> {
        // Step 1: Push unsynced items
        let unsynced_collections: Vec<_> = local_collections
            .iter()
            .filter(|c| !c.synced)
            .cloned()
            .collect();
        let unsynced_requests: Vec<_> = local_requests
            .iter()
            .filter(|r| !r.synced)
            .cloned()
            .collect();
        let unsynced_environments: Vec<_> = local_environments
            .iter()
            .filter(|e| !e.synced)
            .cloned()
            .collect();

        if !unsynced_collections.is_empty()
            || !unsynced_requests.is_empty()
            || !unsynced_environments.is_empty()
        {
            self.sync_client
                .push_sync(
                    unsynced_collections,
                    unsynced_requests,
                    unsynced_environments,
                )
                .await?;
        }

        // Step 2: Pull updates from cloud
        let pull_response = self.sync_client.pull_sync().await?;

        Ok((
            pull_response.collections,
            pull_response.requests,
            pull_response.environments,
        ))
    }
}
