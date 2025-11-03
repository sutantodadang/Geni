use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use reqwest::Client;
use oauth2::{
    AuthUrl, ClientId, ClientSecret, RedirectUrl, TokenUrl,
    basic::BasicClient, AuthorizationCode, CsrfToken, PkceCodeChallenge, Scope,
    TokenResponse as OAuth2TokenResponse, RefreshToken,
};
use crate::models::*;

const GOOGLE_AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_API: &str = "https://www.googleapis.com/drive/v3";

#[derive(Debug, Clone)]
pub struct GoogleDriveClient {
    client: Client,
    oauth_client: BasicClient,
    access_token: Option<String>,
    refresh_token: Option<String>,
    folder_id: Option<String>,
    user_info: Option<GoogleUserInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GoogleUserInfo {
    id: String,
    email: String,
    name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct DriveFile {
    id: Option<String>,
    name: String,
    #[serde(rename = "mimeType")]
    mime_type: String,
    parents: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct DriveFileList {
    files: Vec<DriveFile>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SyncData {
    collections: Vec<Collection>,
    requests: Vec<HttpRequest>,
    environments: Vec<Environment>,
    version: String,
    last_updated: chrono::DateTime<chrono::Utc>,
}

impl GoogleDriveClient {
    pub fn new(client_id: &str, client_secret: &str, redirect_uri: &str) -> Result<Self> {
        let oauth_client = BasicClient::new(
            ClientId::new(client_id.to_string()),
            Some(ClientSecret::new(client_secret.to_string())),
            AuthUrl::new(GOOGLE_AUTH_URL.to_string())?,
            Some(TokenUrl::new(GOOGLE_TOKEN_URL.to_string())?),
        )
        .set_redirect_uri(RedirectUrl::new(redirect_uri.to_string())?);

        Ok(Self {
            client: Client::new(),
            oauth_client,
            access_token: None,
            refresh_token: None,
            folder_id: None,
            user_info: None,
        })
    }

    pub fn generate_auth_url(&self) -> Result<(String, String)> {
        let (pkce_challenge, _pkce_verifier) = PkceCodeChallenge::new_random_sha256();

        let (auth_url, csrf_token) = self.oauth_client
            .authorize_url(CsrfToken::new_random)
            .add_scope(Scope::new("https://www.googleapis.com/auth/drive.file".to_string()))
            .add_scope(Scope::new("https://www.googleapis.com/auth/userinfo.email".to_string()))
            .add_scope(Scope::new("https://www.googleapis.com/auth/userinfo.profile".to_string()))
            .set_pkce_challenge(pkce_challenge)
            .url();

        Ok((auth_url.to_string(), csrf_token.secret().to_string()))
    }

    pub async fn exchange_code(&mut self, code: &str) -> Result<TokenResponse> {
        let token_result = self.oauth_client
            .exchange_code(AuthorizationCode::new(code.to_string()))
            .request_async(oauth2::reqwest::async_http_client)
            .await?;

        self.access_token = Some(token_result.access_token().secret().to_string());
        self.refresh_token = token_result.refresh_token().map(|t| t.secret().to_string());

        // Get user info
        let user_info = self.get_user_info().await?;
        self.user_info = Some(user_info.clone());

        // Create/get Geni folder
        self.ensure_geni_folder().await?;

        Ok(TokenResponse {
            access_token: token_result.access_token().secret().to_string(),
            refresh_token: self.refresh_token.clone(),
            user: User {
                id: user_info.id,
                email: user_info.email,
                name: user_info.name,
            },
        })
    }

    async fn get_user_info(&self) -> Result<GoogleUserInfo> {
        let token = self.access_token.as_ref()
            .ok_or_else(|| anyhow!("Not authenticated"))?;

        let response = self.client
            .get("https://www.googleapis.com/oauth2/v2/userinfo")
            .bearer_auth(token)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow!("Failed to get user info"));
        }

        let user_info: GoogleUserInfo = response.json().await?;
        Ok(user_info)
    }

    async fn ensure_geni_folder(&mut self) -> Result<()> {
        let token = self.access_token.as_ref()
            .ok_or_else(|| anyhow!("Not authenticated"))?;

        // Search for existing Geni folder
        let response = self.client
            .get(&format!("{}/files", GOOGLE_DRIVE_API))
            .bearer_auth(token)
            .query(&[
                ("q", "name='Geni API Client' and mimeType='application/vnd.google-apps.folder' and trashed=false"),
                ("fields", "files(id, name)"),
            ])
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow!("Failed to search for folder"));
        }

        let file_list: DriveFileList = response.json().await?;

        if let Some(folder) = file_list.files.first() {
            self.folder_id = folder.id.clone();
        } else {
            // Create folder
            let folder = DriveFile {
                id: None,
                name: "Geni API Client".to_string(),
                mime_type: "application/vnd.google-apps.folder".to_string(),
                parents: None,
            };

            let response = self.client
                .post(&format!("{}/files", GOOGLE_DRIVE_API))
                .bearer_auth(token)
                .query(&[("fields", "id")])
                .json(&folder)
                .send()
                .await?;

            if !response.status().is_success() {
                return Err(anyhow!("Failed to create folder"));
            }

            let created_folder: DriveFile = response.json().await?;
            self.folder_id = created_folder.id;
        }

        Ok(())
    }

    pub fn is_authenticated(&self) -> bool {
        self.access_token.is_some()
    }

    pub fn sign_out(&mut self) {
        self.access_token = None;
        self.refresh_token = None;
        self.folder_id = None;
        self.user_info = None;
    }

    pub async fn get_current_user(&self) -> Option<User> {
        self.user_info.as_ref().map(|info| User {
            id: info.id.clone(),
            email: info.email.clone(),
            name: info.name.clone(),
        })
    }

    async fn get_or_create_data_file(&self, filename: &str) -> Result<Option<String>> {
        let token = self.access_token.as_ref()
            .ok_or_else(|| anyhow!("Not authenticated"))?;

        let folder_id = self.folder_id.as_ref()
            .ok_or_else(|| anyhow!("Folder not initialized"))?;

        // Search for existing file
        let query = format!("name='{}' and '{}' in parents and trashed=false", filename, folder_id);
        
        let response = self.client
            .get(&format!("{}/files", GOOGLE_DRIVE_API))
            .bearer_auth(token)
            .query(&[
                ("q", query.as_str()),
                ("fields", "files(id, name)"),
            ])
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow!("Failed to search for file"));
        }

        let file_list: DriveFileList = response.json().await?;
        Ok(file_list.files.first().and_then(|f| f.id.clone()))
    }

    pub async fn push_sync(&self, data: SyncPullResponse) -> Result<()> {
        let token = self.access_token.as_ref()
            .ok_or_else(|| anyhow!("Not authenticated"))?;

        let folder_id = self.folder_id.as_ref()
            .ok_or_else(|| anyhow!("Folder not initialized"))?;

        let sync_data = SyncData {
            collections: data.collections,
            requests: data.requests,
            environments: data.environments,
            version: "1.0".to_string(),
            last_updated: chrono::Utc::now(),
        };

        let json_data = serde_json::to_string_pretty(&sync_data)?;

        // Get or create file
        let file_id = self.get_or_create_data_file("geni_data.json").await?;

        if let Some(file_id) = file_id {
            // Update existing file
            let response = self.client
                .patch(&format!("{}/files/{}", GOOGLE_DRIVE_API, file_id))
                .bearer_auth(token)
                .query(&[("uploadType", "media")])
                .header("Content-Type", "application/json")
                .body(json_data)
                .send()
                .await?;

            if !response.status().is_success() {
                return Err(anyhow!("Failed to update file"));
            }
        } else {
            // Create new file
            let metadata = DriveFile {
                id: None,
                name: "geni_data.json".to_string(),
                mime_type: "application/json".to_string(),
                parents: Some(vec![folder_id.clone()]),
            };

            // Use multipart upload
            let boundary = "boundary123456789";
            let metadata_part = format!(
                "--{}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{}\r\n",
                boundary,
                serde_json::to_string(&metadata)?
            );
            let file_part = format!(
                "--{}\r\nContent-Type: application/json\r\n\r\n{}\r\n--{}--",
                boundary,
                json_data,
                boundary
            );

            let body = format!("{}{}", metadata_part, file_part);

            let response = self.client
                .post(&format!("{}/files", GOOGLE_DRIVE_API))
                .bearer_auth(token)
                .query(&[("uploadType", "multipart")])
                .header("Content-Type", format!("multipart/related; boundary={}", boundary))
                .body(body)
                .send()
                .await?;

            if !response.status().is_success() {
                let error = response.text().await?;
                return Err(anyhow!("Failed to create file: {}", error));
            }
        }

        Ok(())
    }

    pub async fn pull_sync(&self) -> Result<SyncPullResponse> {
        let token = self.access_token.as_ref()
            .ok_or_else(|| anyhow!("Not authenticated"))?;

        let file_id = self.get_or_create_data_file("geni_data.json").await?;

        if let Some(file_id) = file_id {
            // Download file content
            let response = self.client
                .get(&format!("{}/files/{}?alt=media", GOOGLE_DRIVE_API, file_id))
                .bearer_auth(token)
                .send()
                .await?;

            if !response.status().is_success() {
                return Err(anyhow!("Failed to download file"));
            }

            let content = response.text().await?;
            let sync_data: SyncData = serde_json::from_str(&content)?;

            Ok(SyncPullResponse {
                collections: sync_data.collections,
                requests: sync_data.requests,
                environments: sync_data.environments,
            })
        } else {
            // No data yet, return empty
            Ok(SyncPullResponse {
                collections: vec![],
                requests: vec![],
                environments: vec![],
            })
        }
    }

    pub async fn refresh_access_token(&mut self) -> Result<()> {
        let refresh_token = self.refresh_token.as_ref()
            .ok_or_else(|| anyhow!("No refresh token available"))?;

        let token_result = self.oauth_client
            .exchange_refresh_token(&RefreshToken::new(refresh_token.clone()))
            .request_async(oauth2::reqwest::async_http_client)
            .await?;

        self.access_token = Some(token_result.access_token().secret().to_string());
        
        if let Some(new_refresh_token) = token_result.refresh_token() {
            self.refresh_token = Some(new_refresh_token.secret().to_string());
        }

        Ok(())
    }
}
