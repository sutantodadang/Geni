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
    config: Tree,
}

impl Database {
    pub async fn new() -> Result<Self> {
        let db = sled::open("geni_db")?;

        let collections = db.open_tree("collections")?;
        let requests = db.open_tree("requests")?;
        let environments = db.open_tree("environments")?;
        let history = db.open_tree("history")?;
        let config = db.open_tree("config")?;

        Ok(Self {
            db,
            collections,
            requests,
            environments,
            history,
            config,
        })
    }

    pub async fn new_with_path<P: AsRef<std::path::Path>>(path: P) -> Result<Self> {
        let db = sled::open(path)?;

        let collections = db.open_tree("collections")?;
        let requests = db.open_tree("requests")?;
        let environments = db.open_tree("environments")?;
        let history = db.open_tree("history")?;
        let config = db.open_tree("config")?;

        Ok(Self {
            db,
            collections,
            requests,
            environments,
            history,
            config,
        })
    }

    pub async fn new_embedded() -> Result<Self> {
        let config_db = sled::Config::new().temporary(true);
        let db = config_db.open()?;

        let collections = db.open_tree("collections")?;
        let requests = db.open_tree("requests")?;
        let environments = db.open_tree("environments")?;
        let history = db.open_tree("history")?;
        let config = db.open_tree("config")?;

        Ok(Self {
            db,
            collections,
            requests,
            environments,
            history,
            config,
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
            synced: false,
            version: request.version + 1,
            cloud_id: request.cloud_id.clone(),
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

    // Sync operations
    pub async fn mark_collection_synced(&self, id: Uuid, cloud_id: String, version: i64) -> Result<()> {
        let key = id.to_string();
        if let Some(value) = self.collections.get(&key)? {
            let mut collection: Collection = serde_json::from_slice(&value)?;
            collection.synced = true;
            collection.cloud_id = Some(cloud_id);
            collection.version = version;

            let updated_value = serde_json::to_vec(&collection)?;
            self.collections.insert(key, updated_value)?;
            self.db.flush()?;
        }
        Ok(())
    }

    pub async fn mark_request_synced(&self, id: Uuid, cloud_id: String, version: i64) -> Result<()> {
        let key = id.to_string();
        if let Some(value) = self.requests.get(&key)? {
            let mut request: HttpRequest = serde_json::from_slice(&value)?;
            request.synced = true;
            request.cloud_id = Some(cloud_id);
            request.version = version;

            let updated_value = serde_json::to_vec(&request)?;
            self.requests.insert(key, updated_value)?;
            self.db.flush()?;
        }
        Ok(())
    }

    pub async fn mark_environment_synced(&self, id: Uuid, cloud_id: String, version: i64) -> Result<()> {
        let key = id.to_string();
        if let Some(value) = self.environments.get(&key)? {
            let mut environment: Environment = serde_json::from_slice(&value)?;
            environment.synced = true;
            environment.cloud_id = Some(cloud_id);
            environment.version = version;

            let updated_value = serde_json::to_vec(&environment)?;
            self.environments.insert(key, updated_value)?;
            self.db.flush()?;
        }
        Ok(())
    }

    pub async fn get_unsynced_collections(&self) -> Result<Vec<Collection>> {
        let mut collections = Vec::new();

        for item in self.collections.iter() {
            let (_, value) = item?;
            let collection: Collection = serde_json::from_slice(&value)?;
            if !collection.synced {
                collections.push(collection);
            }
        }

        Ok(collections)
    }

    pub async fn get_unsynced_requests(&self) -> Result<Vec<HttpRequest>> {
        let mut requests = Vec::new();

        for item in self.requests.iter() {
            let (_, value) = item?;
            let request: HttpRequest = serde_json::from_slice(&value)?;
            if !request.synced {
                requests.push(request);
            }
        }

        Ok(requests)
    }

    pub async fn get_unsynced_environments(&self) -> Result<Vec<Environment>> {
        let mut environments = Vec::new();

        for item in self.environments.iter() {
            let (_, value) = item?;
            let environment: Environment = serde_json::from_slice(&value)?;
            if !environment.synced {
                environments.push(environment);
            }
        }

        Ok(environments)
    }

    pub async fn merge_collection(&self, cloud_collection: Collection) -> Result<()> {
        // Check if collection exists locally
        let existing = self.collections
            .iter()
            .find(|item| {
                if let Ok((_, value)) = item {
                    if let Ok(local) = serde_json::from_slice::<Collection>(value) {
                        return local.cloud_id == cloud_collection.cloud_id;
                    }
                }
                false
            });

        if let Some(Ok((key, value))) = existing {
            let mut local: Collection = serde_json::from_slice(&value)?;

            // Conflict resolution: use the latest updated_at
            if cloud_collection.updated_at > local.updated_at || cloud_collection.version > local.version {
                // Cloud is newer, update local
                local.name = cloud_collection.name;
                local.description = cloud_collection.description;
                local.parent_id = cloud_collection.parent_id;
                local.auth = cloud_collection.auth;
                local.updated_at = cloud_collection.updated_at;
                local.version = cloud_collection.version;
                local.synced = true;
                local.cloud_id = cloud_collection.cloud_id;

                let updated_value = serde_json::to_vec(&local)?;
                self.collections.insert(key, updated_value)?;
            }
        } else {
            // New collection from cloud
            let mut new_collection = cloud_collection;
            new_collection.id = Uuid::new_v4(); // Generate new local ID
            new_collection.synced = true;

            let key = new_collection.id.to_string();
            let value = serde_json::to_vec(&new_collection)?;
            self.collections.insert(key, value)?;
        }

        self.db.flush()?;
        Ok(())
    }

    pub async fn merge_request(&self, cloud_request: HttpRequest) -> Result<()> {
        let existing = self.requests
            .iter()
            .find(|item| {
                if let Ok((_, value)) = item {
                    if let Ok(local) = serde_json::from_slice::<HttpRequest>(value) {
                        return local.cloud_id == cloud_request.cloud_id;
                    }
                }
                false
            });

        if let Some(Ok((key, value))) = existing {
            let mut local: HttpRequest = serde_json::from_slice(&value)?;

            let local_updated = local.updated_at.unwrap_or(local.created_at.unwrap_or(Utc::now()));
            let cloud_updated = cloud_request.updated_at.unwrap_or(cloud_request.created_at.unwrap_or(Utc::now()));

            if cloud_updated > local_updated || cloud_request.version > local.version {
                local.name = cloud_request.name;
                local.method = cloud_request.method;
                local.url = cloud_request.url;
                local.headers = cloud_request.headers;
                local.body = cloud_request.body;
                local.collection_id = cloud_request.collection_id;
                local.updated_at = cloud_request.updated_at;
                local.version = cloud_request.version;
                local.synced = true;
                local.cloud_id = cloud_request.cloud_id;

                let updated_value = serde_json::to_vec(&local)?;
                self.requests.insert(key, updated_value)?;
            }
        } else {
            let mut new_request = cloud_request;
            new_request.id = Some(Uuid::new_v4());
            new_request.synced = true;

            let key = new_request.id.unwrap().to_string();
            let value = serde_json::to_vec(&new_request)?;
            self.requests.insert(key, value)?;
        }

        self.db.flush()?;
        Ok(())
    }

    pub async fn merge_environment(&self, cloud_environment: Environment) -> Result<()> {
        let existing = self.environments
            .iter()
            .find(|item| {
                if let Ok((_, value)) = item {
                    if let Ok(local) = serde_json::from_slice::<Environment>(value) {
                        return local.cloud_id == cloud_environment.cloud_id;
                    }
                }
                false
            });

        if let Some(Ok((key, value))) = existing {
            let mut local: Environment = serde_json::from_slice(&value)?;

            if cloud_environment.updated_at > local.updated_at || cloud_environment.version > local.version {
                local.name = cloud_environment.name;
                local.variables = cloud_environment.variables;
                local.updated_at = cloud_environment.updated_at;
                local.version = cloud_environment.version;
                local.synced = true;
                local.cloud_id = cloud_environment.cloud_id;

                let updated_value = serde_json::to_vec(&local)?;
                self.environments.insert(key, updated_value)?;
            }
        } else {
            let mut new_environment = cloud_environment;
            new_environment.id = Uuid::new_v4();
            new_environment.synced = true;
            new_environment.is_active = false; // Don't auto-activate synced environments

            let key = new_environment.id.to_string();
            let value = serde_json::to_vec(&new_environment)?;
            self.environments.insert(key, value)?;
        }

        self.db.flush()?;
        Ok(())
    }
    
    // Config operations for cloud sync settings
    pub async fn save_sync_config(&self, provider: &str, config_json: &str) -> Result<()> {
        let key = format!("sync_provider_{}", provider);
        self.config.insert(key, config_json.as_bytes())?;
        self.db.flush()?;
        Ok(())
    }
    
    pub async fn get_sync_config(&self, provider: &str) -> Result<Option<String>> {
        let key = format!("sync_provider_{}", provider);
        match self.config.get(key)? {
            Some(bytes) => {
                let config_str = String::from_utf8(bytes.to_vec())?;
                Ok(Some(config_str))
            },
            None => Ok(None),
        }
    }
    
    pub async fn get_last_sync_provider(&self) -> Result<Option<String>> {
        match self.config.get("last_sync_provider")? {
            Some(bytes) => {
                let provider = String::from_utf8(bytes.to_vec())?;
                Ok(Some(provider))
            },
            None => Ok(None),
        }
    }
    
    pub async fn set_last_sync_provider(&self, provider: &str) -> Result<()> {
        self.config.insert("last_sync_provider", provider.as_bytes())?;
        self.db.flush()?;
        Ok(())
    }
    
    pub async fn clear_sync_config(&self) -> Result<()> {
        // Remove last sync provider
        self.config.remove("last_sync_provider")?;
        
        // Remove all provider configs
        let providers = ["api_server", "supabase", "google_drive"];
        for provider in &providers {
            let key = format!("sync_provider_{}", provider);
            self.config.remove(key)?;
        }
        
        self.db.flush()?;
        Ok(())
    }
}
