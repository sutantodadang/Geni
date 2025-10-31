use sled::{Db, Tree};
use anyhow::Result;
use uuid::Uuid;
use chrono::Utc;

use crate::models::*;

pub struct Database {
    db: Db,
    collections: Tree,
    requests: Tree,
    environments: Tree,
    history: Tree,
}

impl Database {
    pub async fn new() -> Result<Self> {
        let db = sled::open("geni_db")?;

        let collections = db.open_tree("collections")?;
        let requests = db.open_tree("requests")?;
        let environments = db.open_tree("environments")?;
        let history = db.open_tree("history")?;

        Ok(Self {
            db,
            collections,
            requests,
            environments,
            history,
        })
    }

    pub async fn new_embedded() -> Result<Self> {
        let config = sled::Config::new().temporary(true);
        let db = config.open()?;

        let collections = db.open_tree("collections")?;
        let requests = db.open_tree("requests")?;
        let environments = db.open_tree("environments")?;
        let history = db.open_tree("history")?;

        Ok(Self {
            db,
            collections,
            requests,
            environments,
            history,
        })
    }

    // Collection operations
    pub async fn create_collection(&self, collection: &Collection) -> Result<()> {
        let key = collection.id.to_string();
        let value = serde_json::to_vec(collection)?;
        self.collections.insert(key, value)?;
        self.db.flush()?;
        Ok(())
    }

    pub async fn get_collections(&self) -> Result<Vec<Collection>> {
        let mut collections = Vec::new();

        for item in self.collections.iter() {
            let (_, value) = item?;
            let collection: Collection = serde_json::from_slice(&value)?;
            collections.push(collection);
        }

        // Sort by created_at desc
        collections.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(collections)
    }

    pub async fn delete_collection(&self, id: Uuid) -> Result<()> {
        // Recursively delete this collection and all its children
        self.delete_collection_recursive(id).await?;
        self.db.flush()?;
        Ok(())
    }

    fn delete_collection_recursive(&self, id: Uuid) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<()>> + Send + '_>> {
        Box::pin(async move {
            // First, find and delete all child collections
            let mut child_ids = Vec::new();
            for item in self.collections.iter() {
                let (_, value) = item?;
                let collection: Collection = serde_json::from_slice(&value)?;
                if collection.parent_id == Some(id) {
                    child_ids.push(collection.id);
                }
            }

            // Recursively delete all children
            for child_id in child_ids {
                self.delete_collection_recursive(child_id).await?;
            }

        // Delete all requests in this collection
        let mut request_keys_to_remove = Vec::new();
        for item in self.requests.iter() {
            let (key, value) = item?;
            let request: HttpRequest = serde_json::from_slice(&value)?;
            if request.collection_id == Some(id) {
                request_keys_to_remove.push(key);
            }
        }

        for key in request_keys_to_remove {
            self.requests.remove(key)?;
        }

            // Finally, delete this collection itself
            let key = id.to_string();
            self.collections.remove(key)?;

            Ok(())
        })
    }

    pub async fn move_collection(&self, collection_id: Uuid, new_parent_id: Option<Uuid>) -> Result<()> {
            // Get the collection
            let key = collection_id.to_string();
            if let Some(value) = self.collections.get(&key)? {
                let mut collection: Collection = serde_json::from_slice(&value)?;

                // Update the parent_id
                collection.parent_id = new_parent_id;
                collection.updated_at = Utc::now();

                // Save back to database
                let updated_value = serde_json::to_vec(&collection)?;
                self.collections.insert(key, updated_value)?;
                self.db.flush()?;
            }

            Ok(())
        }

    pub async fn update_collection_auth(&self, collection_id: Uuid, auth: Option<AuthConfig>) -> Result<()> {
        let key = collection_id.to_string();
        if let Some(value) = self.collections.get(&key)? {
            let mut collection: Collection = serde_json::from_slice(&value)?;

            // Update the auth configuration
            collection.auth = auth;
            collection.updated_at = Utc::now();

            // Save back to database
            let updated_value = serde_json::to_vec(&collection)?;
            self.collections.insert(key, updated_value)?;
            self.db.flush()?;
        }

        Ok(())
    }

    pub async fn update_collection_name(&self, collection_id: Uuid, name: String) -> Result<()> {
        let key = collection_id.to_string();
        if let Some(value) = self.collections.get(&key)? {
            let mut collection: Collection = serde_json::from_slice(&value)?;

            // Update the name
            collection.name = name;
            collection.updated_at = Utc::now();

            // Save back to database
            let updated_value = serde_json::to_vec(&collection)?;
            self.collections.insert(key, updated_value)?;
            self.db.flush()?;
        }

        Ok(())
    }

    // Request operations
    pub async fn save_request(&self, request: &HttpRequest) -> Result<HttpRequest> {
        let id = request.id.unwrap_or_else(Uuid::new_v4);
        let now = Utc::now();
        let created_at = request.created_at.unwrap_or(now);

        let saved_request = HttpRequest {
            id: Some(id),
            name: request.name.clone(),
            method: request.method.clone(),
            url: request.url.clone(),
            headers: request.headers.clone(),
            body: request.body.clone(),
            collection_id: request.collection_id,
            created_at: Some(created_at),
            updated_at: Some(now),
        };

        let key = id.to_string();
        let value = serde_json::to_vec(&saved_request)?;
        self.requests.insert(key, value)?;
        self.db.flush()?;

        Ok(saved_request)
    }

    pub async fn get_requests(&self, collection_id: Option<Uuid>) -> Result<Vec<HttpRequest>> {
        let mut requests = Vec::new();

        for item in self.requests.iter() {
            let (_, value) = item?;
            let request: HttpRequest = serde_json::from_slice(&value)?;

            match collection_id {
                Some(id) => {
                    if request.collection_id == Some(id) {
                        requests.push(request);
                    }
                }
                None => {
                    if request.collection_id.is_none() {
                        requests.push(request);
                    }
                }
            }
        }

        // Sort by updated_at desc
        requests.sort_by(|a, b| {
            let a_time = a.updated_at.unwrap_or_else(|| a.created_at.unwrap_or(Utc::now()));
            let b_time = b.updated_at.unwrap_or_else(|| b.created_at.unwrap_or(Utc::now()));
            b_time.cmp(&a_time)
        });

        Ok(requests)
    }

    pub async fn delete_request(&self, id: Uuid) -> Result<()> {
        let key = id.to_string();
        self.requests.remove(key)?;
        self.db.flush()?;
        Ok(())
    }

    pub async fn move_request(&self, request_id: Uuid, new_collection_id: Uuid) -> Result<()> {
        // Get the request
        let key = request_id.to_string();
        if let Some(value) = self.requests.get(&key)? {
            let mut request: HttpRequest = serde_json::from_slice(&value)?;

            // Update the collection_id
            request.collection_id = Some(new_collection_id);
            request.updated_at = Some(Utc::now());

            // Save back to database
            let updated_value = serde_json::to_vec(&request)?;
            self.requests.insert(key, updated_value)?;
            self.db.flush()?;
        }

        Ok(())
    }

    pub async fn move_request_to_collection(&self, request_id: Uuid, new_collection_id: Option<Uuid>) -> Result<()> {
        // Get the request
        let key = request_id.to_string();
        if let Some(value) = self.requests.get(&key)? {
            let mut request: HttpRequest = serde_json::from_slice(&value)?;

            // Update the collection_id (can be None for root)
            request.collection_id = new_collection_id;
            request.updated_at = Some(Utc::now());

            // Save back to database
            let updated_value = serde_json::to_vec(&request)?;
            self.requests.insert(key, updated_value)?;
            self.db.flush()?;
        }

        Ok(())
    }

    pub async fn update_request_name(&self, request_id: Uuid, name: String) -> Result<()> {
        let key = request_id.to_string();
        if let Some(value) = self.requests.get(&key)? {
            let mut request: HttpRequest = serde_json::from_slice(&value)?;

            // Update the name
            request.name = name;
            request.updated_at = Some(Utc::now());

            // Save back to database
            let updated_value = serde_json::to_vec(&request)?;
            self.requests.insert(key, updated_value)?;
            self.db.flush()?;
        }

        Ok(())
    }

    // Environment operations
    pub async fn create_environment(&self, environment: &Environment) -> Result<()> {
        let key = environment.id.to_string();
        let value = serde_json::to_vec(environment)?;
        self.environments.insert(key, value)?;
        self.db.flush()?;
        Ok(())
    }

    pub async fn get_environments(&self) -> Result<Vec<Environment>> {
        let mut environments = Vec::new();

        for item in self.environments.iter() {
            let (_, value) = item?;
            let environment: Environment = serde_json::from_slice(&value)?;
            environments.push(environment);
        }

        // Sort by created_at desc
        environments.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(environments)
    }

    pub async fn set_active_environment(&self, id: Option<Uuid>) -> Result<()> {
        // First, deactivate all environments
        for item in self.environments.iter() {
            let (key, value) = item?;
            let mut environment: Environment = serde_json::from_slice(&value)?;
            environment.is_active = false;
            let updated_value = serde_json::to_vec(&environment)?;
            self.environments.insert(key, updated_value)?;
        }

        // Then activate the selected one if provided
        if let Some(env_id) = id {
            let key = env_id.to_string();
            if let Some(value) = self.environments.get(&key)? {
                let mut environment: Environment = serde_json::from_slice(&value)?;
                environment.is_active = true;
                let updated_value = serde_json::to_vec(&environment)?;
                self.environments.insert(key, updated_value)?;
            }
        }

        self.db.flush()?;
        Ok(())
    }

    pub async fn get_active_environment(&self) -> Result<Option<Environment>> {
        for item in self.environments.iter() {
            let (_, value) = item?;
            let environment: Environment = serde_json::from_slice(&value)?;
            if environment.is_active {
                return Ok(Some(environment));
            }
        }
        Ok(None)
    }

    pub async fn update_environment(&self, id: Uuid, name: String, variables: std::collections::HashMap<String, String>) -> Result<Environment> {
        let key = id.to_string();
        if let Some(value) = self.environments.get(&key)? {
            let mut environment: Environment = serde_json::from_slice(&value)?;

            // Update fields
            environment.name = name;
            environment.variables = variables;
            environment.updated_at = Utc::now();

            // Save back to database
            let updated_value = serde_json::to_vec(&environment)?;
            self.environments.insert(key, updated_value)?;
            self.db.flush()?;

            Ok(environment)
        } else {
            Err(anyhow::anyhow!("Environment not found"))
        }
    }

    pub async fn delete_environment(&self, id: Uuid) -> Result<()> {
        let key = id.to_string();
        self.environments.remove(key)?;
        self.db.flush()?;
        Ok(())
    }

    // History operations
    pub async fn save_to_history(&self, history: &RequestHistory) -> Result<()> {
        let key = history.id.to_string();
        let value = serde_json::to_vec(history)?;
        self.history.insert(key, value)?;
        self.db.flush()?;
        Ok(())
    }

    pub async fn get_history(&self, limit: Option<i32>) -> Result<Vec<RequestHistory>> {
        let mut history = Vec::new();

        for item in self.history.iter() {
            let (_, value) = item?;
            let entry: RequestHistory = serde_json::from_slice(&value)?;
            history.push(entry);
        }

        // Sort by timestamp desc
        history.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

        // Apply limit if provided
        if let Some(limit) = limit {
            history.truncate(limit as usize);
        }

        Ok(history)
    }

    pub async fn clear_history(&self) -> Result<()> {
        self.history.clear()?;
        self.db.flush()?;
        Ok(())
    }
}
