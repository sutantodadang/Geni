use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use reqwest::Client;
use crate::models::*;

#[derive(Debug, Clone)]
pub struct ApiServerClient {
    client: Client,
    base_url: String,
    access_token: Option<String>,
    refresh_token: Option<String>,
    user_info: Option<ApiUser>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ApiUser {
    id: String,
    email: String,
    name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct LoginRequest {
    email: String,
    password: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct RegisterRequest {
    email: String,
    password: String,
    name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct AuthResponse {
    access_token: String,
    refresh_token: Option<String>,
    user: ApiUser,
}

impl ApiServerClient {
    pub fn new(base_url: &str) -> Result<Self> {
        Ok(Self {
            client: Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
            access_token: None,
            refresh_token: None,
            user_info: None,
        })
    }

    pub async fn sign_up(&mut self, email: String, password: String, name: Option<String>) -> Result<TokenResponse> {
        let request_body = RegisterRequest {
            email: email.clone(),
            password,
            name: name.clone(),
        };

        let response = self.client
            .post(&format!("{}/api/auth/register", self.base_url))
            .json(&request_body)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow!("Registration failed: {}", error_text));
        }

        let auth_response: AuthResponse = response.json().await?;

        self.access_token = Some(auth_response.access_token.clone());
        self.refresh_token = auth_response.refresh_token.clone();
        self.user_info = Some(auth_response.user.clone());

        Ok(TokenResponse {
            access_token: auth_response.access_token,
            refresh_token: auth_response.refresh_token,
            user: User {
                id: auth_response.user.id,
                email: auth_response.user.email,
                name: auth_response.user.name,
            },
        })
    }

    pub async fn sign_in(&mut self, email: String, password: String) -> Result<TokenResponse> {
        let request_body = LoginRequest {
            email,
            password,
        };

        let response = self.client
            .post(&format!("{}/api/auth/login", self.base_url))
            .json(&request_body)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow!("Login failed: {}", error_text));
        }

        let auth_response: AuthResponse = response.json().await?;

        self.access_token = Some(auth_response.access_token.clone());
        self.refresh_token = auth_response.refresh_token.clone();
        self.user_info = Some(auth_response.user.clone());

        Ok(TokenResponse {
            access_token: auth_response.access_token,
            refresh_token: auth_response.refresh_token,
            user: User {
                id: auth_response.user.id,
                email: auth_response.user.email,
                name: auth_response.user.name,
            },
        })
    }

    pub fn is_authenticated(&self) -> bool {
        self.access_token.is_some()
    }

    pub fn sign_out(&mut self) {
        self.access_token = None;
        self.refresh_token = None;
        self.user_info = None;
    }

    pub async fn get_current_user(&self) -> Option<User> {
        self.user_info.as_ref().map(|info| User {
            id: info.id.clone(),
            email: info.email.clone(),
            name: info.name.clone(),
        })
    }

    async fn ensure_authenticated(&self) -> Result<String> {
        self.access_token.clone()
            .ok_or_else(|| anyhow!("Not authenticated"))
    }

    pub async fn create_collection(&self, collection: &Collection) -> Result<String> {
        let token = self.ensure_authenticated().await?;

        let response = self.client
            .post(&format!("{}/api/collections", self.base_url))
            .bearer_auth(&token)
            .json(collection)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow!("Failed to create collection: {}", error_text));
        }

        let created: Collection = response.json().await?;
        Ok(created.cloud_id.unwrap_or_default())
    }

    pub async fn get_collections(&self) -> Result<Vec<Collection>> {
        let token = self.ensure_authenticated().await?;

        let response = self.client
            .get(&format!("{}/api/collections", self.base_url))
            .bearer_auth(&token)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow!("Failed to get collections: {}", error_text));
        }

        let collections: Vec<Collection> = response.json().await?;
        Ok(collections)
    }

    pub async fn update_collection(&self, cloud_id: &str, collection: &Collection) -> Result<()> {
        let token = self.ensure_authenticated().await?;

        let response = self.client
            .put(&format!("{}/api/collections/{}", self.base_url, cloud_id))
            .bearer_auth(&token)
            .json(collection)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow!("Failed to update collection: {}", error_text));
        }

        Ok(())
    }

    pub async fn delete_collection(&self, cloud_id: &str) -> Result<()> {
        let token = self.ensure_authenticated().await?;

        let response = self.client
            .delete(&format!("{}/api/collections/{}", self.base_url, cloud_id))
            .bearer_auth(&token)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow!("Failed to delete collection: {}", error_text));
        }

        Ok(())
    }

    pub async fn create_request(&self, request: &HttpRequest) -> Result<String> {
        let token = self.ensure_authenticated().await?;

        let response = self.client
            .post(&format!("{}/api/requests", self.base_url))
            .bearer_auth(&token)
            .json(request)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow!("Failed to create request: {}", error_text));
        }

        let created: HttpRequest = response.json().await?;
        Ok(created.cloud_id.unwrap_or_default())
    }

    pub async fn get_requests(&self) -> Result<Vec<HttpRequest>> {
        let token = self.ensure_authenticated().await?;

        let response = self.client
            .get(&format!("{}/api/requests", self.base_url))
            .bearer_auth(&token)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow!("Failed to get requests: {}", error_text));
        }

        let requests: Vec<HttpRequest> = response.json().await?;
        Ok(requests)
    }

    pub async fn update_request(&self, cloud_id: &str, request: &HttpRequest) -> Result<()> {
        let token = self.ensure_authenticated().await?;

        let response = self.client
            .put(&format!("{}/api/requests/{}", self.base_url, cloud_id))
            .bearer_auth(&token)
            .json(request)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow!("Failed to update request: {}", error_text));
        }

        Ok(())
    }

    pub async fn delete_request(&self, cloud_id: &str) -> Result<()> {
        let token = self.ensure_authenticated().await?;

        let response = self.client
            .delete(&format!("{}/api/requests/{}", self.base_url, cloud_id))
            .bearer_auth(&token)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow!("Failed to delete request: {}", error_text));
        }

        Ok(())
    }

    pub async fn create_environment(&self, environment: &Environment) -> Result<String> {
        let token = self.ensure_authenticated().await?;

        let response = self.client
            .post(&format!("{}/api/environments", self.base_url))
            .bearer_auth(&token)
            .json(environment)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow!("Failed to create environment: {}", error_text));
        }

        let created: Environment = response.json().await?;
        Ok(created.cloud_id.unwrap_or_default())
    }

    pub async fn get_environments(&self) -> Result<Vec<Environment>> {
        let token = self.ensure_authenticated().await?;

        let response = self.client
            .get(&format!("{}/api/environments", self.base_url))
            .bearer_auth(&token)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow!("Failed to get environments: {}", error_text));
        }

        let environments: Vec<Environment> = response.json().await?;
        Ok(environments)
    }

    pub async fn update_environment(&self, cloud_id: &str, environment: &Environment) -> Result<()> {
        let token = self.ensure_authenticated().await?;

        let response = self.client
            .put(&format!("{}/api/environments/{}", self.base_url, cloud_id))
            .bearer_auth(&token)
            .json(environment)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow!("Failed to update environment: {}", error_text));
        }

        Ok(())
    }

    pub async fn delete_environment(&self, cloud_id: &str) -> Result<()> {
        let token = self.ensure_authenticated().await?;

        let response = self.client
            .delete(&format!("{}/api/environments/{}", self.base_url, cloud_id))
            .bearer_auth(&token)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow!("Failed to delete environment: {}", error_text));
        }

        Ok(())
    }
}
