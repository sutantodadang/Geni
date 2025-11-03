use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use reqwest::Client;
use postgrest::Postgrest;
use native_tls;
use postgres_native_tls;
use crate::models::*;

#[derive(Clone)]
pub struct SupabaseClient {
    url: String,
    api_key: String,
    client: Client,
    postgrest: Postgrest,
    access_token: Option<String>,
    user_info: Option<User>,
    db_uri: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct AuthResponse {
    access_token: String,
    refresh_token: Option<String>,
    user: SupabaseUser,
}

#[derive(Debug, Serialize, Deserialize)]
struct SupabaseUser {
    id: String,
    email: String,
    #[serde(rename = "user_metadata")]
    user_metadata: Option<UserMetadata>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct UserMetadata {
    name: Option<String>,
}

impl SupabaseClient {
    pub fn new(url: &str, api_key: &str) -> Result<Self> {
        Self::new_with_db_uri(url, api_key, None)
    }

    pub fn new_with_db_uri(url: &str, api_key: &str, db_uri: Option<String>) -> Result<Self> {
        // For PostgREST, we need both apikey and Authorization headers
        let postgrest = Postgrest::new(format!("{}/rest/v1", url))
            .insert_header("apikey", api_key)
            .insert_header("Authorization", &format!("Bearer {}", api_key));

        Ok(Self {
            url: url.to_string(),
            api_key: api_key.to_string(),
            client: Client::new(),
            postgrest,
            access_token: None,
            user_info: None,
            db_uri,
        })
    }

    /// Auto-create database schema if tables don't exist
    pub async fn ensure_schema(&self) -> Result<()> {
        println!("🔍 Checking if database schema exists...");
        
        // If we have a database URI, always try to create schema (idempotent)
        // This is more reliable than checking via PostgREST with anon key
        if let Some(db_uri) = &self.db_uri {
            println!("🔑 Database URI provided, attempting automatic schema creation (idempotent)");
            return self.create_schema_with_postgres(db_uri).await;
        }

        // No database URI - check if tables exist via PostgREST
        // This is less reliable but it's all we can do without direct DB access
        println!("⚠️ No Database URI - checking via PostgREST API (less reliable)");
        match self.postgrest.from("collections").select("id").limit(1).execute().await {
            Ok(response) => {
                let status = response.status();
                let body = response.text().await.unwrap_or_default();
                println!("📊 PostgREST response: status={}, body={}", status, body);
                
                // Check if it's actually a valid response with data structure
                if body.contains("PGRST") || body.contains("relation") || body.contains("does not exist") {
                    println!("❌ Tables don't exist - error response detected");
                    // Return manual instructions
                    let schema_sql = Self::get_schema_sql();
                    return Err(anyhow!(
                        "⚠️ Database tables not found!\n\n\
                        Please create them manually in Supabase:\n\
                        1. Go to https://app.supabase.com\n\
                        2. Select your project\n\
                        3. Click 'SQL Editor' in the left menu\n\
                        4. Click 'New Query'\n\
                        5. Copy and paste the SQL below\n\
                        6. Click 'Run'\n\n\
                        SQL to run:\n{}\n\n\
                        After running the SQL, click 'Create/Verify Database Schema' again to confirm.",
                        schema_sql
                    ));
                }
                
                println!("✅ Schema appears to exist (or RLS is hiding the error)");
                Ok(())
            },
            Err(e) => {
                let err_msg = e.to_string();
                println!("❌ Schema check error: {}", err_msg);
                
                // Check if it's a "table not found" error
                if err_msg.contains("PGRST204") || err_msg.contains("PGRST205") || 
                   err_msg.contains("relation") || err_msg.contains("does not exist") {
                    println!("📋 Tables don't exist, returning manual instructions");
                    let schema_sql = Self::get_schema_sql();
                    return Err(anyhow!(
                        "⚠️ Database tables not found!\n\n\
                        Please create them manually in Supabase:\n\
                        1. Go to https://app.supabase.com\n\
                        2. Select your project\n\
                        3. Click 'SQL Editor' in the left menu\n\
                        4. Click 'New Query'\n\
                        5. Copy and paste the SQL below\n\
                        6. Click 'Run'\n\n\
                        SQL to run:\n{}\n\n\
                        After running the SQL, click 'Create/Verify Database Schema' again to confirm.",
                        schema_sql
                    ));
                }
                
                // Some other error - return it
                Err(anyhow!("Failed to check schema: {}", err_msg))
            }
        }
    }

    fn get_schema_sql() -> &'static str {
        r#"-- Run this SQL in your Supabase SQL Editor (https://app.supabase.com)
-- Go to: SQL Editor -> New Query -> Paste this SQL -> Run

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Collections Table
CREATE TABLE IF NOT EXISTS collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES collections(id) ON DELETE CASCADE,
    auth JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    synced BOOLEAN DEFAULT false,
    version BIGINT DEFAULT 0,
    cloud_id TEXT
);

-- Requests Table
CREATE TABLE IF NOT EXISTS requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    method TEXT NOT NULL,
    url TEXT NOT NULL,
    headers JSONB DEFAULT '{}'::jsonb,
    body JSONB,
    collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    synced BOOLEAN DEFAULT false,
    version BIGINT DEFAULT 0,
    cloud_id TEXT
);

-- Environments Table
CREATE TABLE IF NOT EXISTS environments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    variables JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    synced BOOLEAN DEFAULT false,
    version BIGINT DEFAULT 0,
    cloud_id TEXT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_collections_parent_id ON collections(parent_id);
CREATE INDEX IF NOT EXISTS idx_collections_cloud_id ON collections(cloud_id);
CREATE INDEX IF NOT EXISTS idx_requests_collection_id ON requests(collection_id);
CREATE INDEX IF NOT EXISTS idx_requests_cloud_id ON requests(cloud_id);
CREATE INDEX IF NOT EXISTS idx_environments_is_active ON environments(is_active);
CREATE INDEX IF NOT EXISTS idx_environments_cloud_id ON environments(cloud_id);

-- Disable RLS (for API key access)
ALTER TABLE collections DISABLE ROW LEVEL SECURITY;
ALTER TABLE requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE environments DISABLE ROW LEVEL SECURITY;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers
DROP TRIGGER IF EXISTS update_collections_updated_at ON collections;
CREATE TRIGGER update_collections_updated_at 
    BEFORE UPDATE ON collections 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_requests_updated_at ON requests;
CREATE TRIGGER update_requests_updated_at 
    BEFORE UPDATE ON requests 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_environments_updated_at ON environments;
CREATE TRIGGER update_environments_updated_at 
    BEFORE UPDATE ON environments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();"#
    }

    async fn create_schema_with_postgres(&self, db_uri: &str) -> Result<()> {
        println!("🔄 Attempting to create schema with PostgreSQL URI...");
        
        // Create TLS connector for Supabase with proper settings
        let connector = native_tls::TlsConnector::builder()
            .danger_accept_invalid_certs(true) // Supabase uses self-signed certs in some regions
            .danger_accept_invalid_hostnames(true) // Accept hostname mismatches
            .build()
            .map_err(|e| anyhow!("Failed to create TLS connector: {}", e))?;
        let connector = postgres_native_tls::MakeTlsConnector::new(connector);

        println!("🔌 Connecting to PostgreSQL...");
        // Connect to PostgreSQL directly with TLS
        let (client, connection) = tokio_postgres::connect(db_uri, connector).await
            .map_err(|e| anyhow!("Failed to connect to PostgreSQL: {}.\n\nTroubleshooting:\n1. Make sure your password is correct\n2. Try using the 'Session mode' connection string (port 6543) instead of 'Transaction mode' (port 5432)\n3. Get the connection string from: Supabase Dashboard → Settings → Database → Connection String → URI\n4. The URI should look like: postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-X-region.pooler.supabase.com:6543/postgres", e))?;

        println!("✅ Connected! Spawning connection handler...");
        // Spawn the connection in a separate task
        tokio::spawn(async move {
            if let Err(e) = connection.await {
                eprintln!("PostgreSQL connection error: {}", e);
            }
        });

        println!("📝 Executing schema SQL...");
        // Execute the schema SQL
        let schema_sql = Self::get_schema_sql();
        client.batch_execute(schema_sql).await
            .map_err(|e| anyhow!("Failed to create schema: {}", e))?;

        println!("✅ Schema created successfully!");
        Ok(())
    }

    pub async fn sign_up(&mut self, email: String, password: String, name: Option<String>) -> Result<TokenResponse> {
        let mut body = serde_json::json!({
            "email": email,
            "password": password,
        });

        if let Some(name) = name {
            body["data"] = serde_json::json!({
                "name": name,
            });
        }

        let response = self.client
            .post(&format!("{}/auth/v1/signup", self.url))
            .header("apikey", &self.api_key)
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow!("Sign up failed: {}", error_text));
        }

        let auth_response: AuthResponse = response.json().await?;
        
        let user_name = auth_response.user.user_metadata.clone().and_then(|m| m.name);
        
        self.access_token = Some(auth_response.access_token.clone());
        self.user_info = Some(User {
            id: auth_response.user.id.clone(),
            email: auth_response.user.email.clone(),
            name: user_name.clone(),
        });

        Ok(TokenResponse {
            access_token: auth_response.access_token,
            refresh_token: auth_response.refresh_token,
            user: User {
                id: auth_response.user.id,
                email: auth_response.user.email,
                name: user_name,
            },
        })
    }

    pub async fn sign_in(&mut self, email: String, password: String) -> Result<TokenResponse> {
        let body = serde_json::json!({
            "email": email,
            "password": password,
        });

        let response = self.client
            .post(&format!("{}/auth/v1/token?grant_type=password", self.url))
            .header("apikey", &self.api_key)
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow!("Sign in failed: {}", error_text));
        }

        let auth_response: AuthResponse = response.json().await?;
        
        let user_name = auth_response.user.user_metadata.clone().and_then(|m| m.name);
        
        self.access_token = Some(auth_response.access_token.clone());
        self.user_info = Some(User {
            id: auth_response.user.id.clone(),
            email: auth_response.user.email.clone(),
            name: user_name.clone(),
        });

        Ok(TokenResponse {
            access_token: auth_response.access_token,
            refresh_token: auth_response.refresh_token,
            user: User {
                id: auth_response.user.id,
                email: auth_response.user.email,
                name: user_name,
            },
        })
    }

    pub fn sign_out(&mut self) {
        self.access_token = None;
        self.user_info = None;
    }

    pub fn is_authenticated(&self) -> bool {
        // Supabase is considered authenticated if we have the API key configured
        // The API key itself provides authentication for database operations
        !self.api_key.is_empty()
    }

    pub async fn get_current_user(&self) -> Option<User> {
        // If user_info is available (from sign_up/sign_in), return it
        // Otherwise, create a synthetic user from the API key for display
        if let Some(user) = &self.user_info {
            Some(user.clone())
        } else {
            // Return a synthetic user to indicate Supabase is connected
            Some(User {
                id: "supabase".to_string(),
                email: format!("Connected to {}", self.url),
                name: Some("Supabase Connection".to_string()),
            })
        }
    }

    fn needs_auth_override(&self) -> Option<String> {
        // Only override auth if we have a user access_token (from sign_in/sign_up)
        // If using API key directly, the headers are already set in postgrest client
        self.access_token.as_ref().map(|token| format!("Bearer {}", token))
    }

    // CRUD operations for collections
    pub async fn create_collection(&self, collection: &Collection) -> Result<String> {
        // PostgREST insert expects an array, not a single object
        let items = vec![collection];
        
        let mut builder = self.postgrest
            .from("collections")
            .insert(serde_json::to_string(&items)?);
        
        // Only override auth if we have a user access token
        if let Some(auth) = self.needs_auth_override() {
            builder = builder.auth(&auth);
        }
        
        let response = builder.execute().await?;

        let text = response.text().await?;
        
        #[derive(Deserialize)]
        struct IdResponse {
            id: String,
        }

        let data: Vec<IdResponse> = serde_json::from_str(&text)
            .map_err(|e| anyhow!("Failed to parse collection response: {}. Response text: {}", e, text))?;
        data.first()
            .map(|r| r.id.clone())
            .ok_or_else(|| anyhow!("No ID returned"))
    }

    pub async fn update_collection(&self, cloud_id: &str, collection: &Collection) -> Result<()> {
        let mut builder = self.postgrest
            .from("collections")
            .eq("id", cloud_id)
            .update(serde_json::to_string(collection)?);
        
        if let Some(auth) = self.needs_auth_override() {
            builder = builder.auth(&auth);
        }
        
        builder.execute().await?;
        Ok(())
    }

    pub async fn delete_collection(&self, cloud_id: &str) -> Result<()> {
        let mut builder = self.postgrest
            .from("collections")
            .eq("id", cloud_id)
            .delete();
        
        if let Some(auth) = self.needs_auth_override() {
            builder = builder.auth(&auth);
        }
        
        builder.execute().await?;
        Ok(())
    }

    pub async fn get_collections(&self) -> Result<Vec<Collection>> {
        let mut builder = self.postgrest
            .from("collections")
            .select("*");
        
        if let Some(auth) = self.needs_auth_override() {
            builder = builder.auth(&auth);
        }
        
        let response = builder.execute().await?;

        let text = response.text().await?;
        let collections: Vec<Collection> = serde_json::from_str(&text)?;
        Ok(collections)
    }

    // CRUD operations for requests
    pub async fn create_request(&self, request: &HttpRequest) -> Result<String> {
        // PostgREST insert expects an array, not a single object
        let items = vec![request];
        
        let mut builder = self.postgrest
            .from("requests")
            .insert(serde_json::to_string(&items)?);
        
        if let Some(auth) = self.needs_auth_override() {
            builder = builder.auth(&auth);
        }
        
        let response = builder.execute().await?;

        let text = response.text().await?;
        
        #[derive(Deserialize)]
        struct IdResponse {
            id: String,
        }

        let data: Vec<IdResponse> = serde_json::from_str(&text)
            .map_err(|e| anyhow!("Failed to parse request response: {}. Response text: {}", e, text))?;
        data.first()
            .map(|r| r.id.clone())
            .ok_or_else(|| anyhow!("No ID returned"))
    }

    pub async fn update_request(&self, cloud_id: &str, request: &HttpRequest) -> Result<()> {
        let mut builder = self.postgrest
            .from("requests")
            .eq("id", cloud_id)
            .update(serde_json::to_string(request)?);
        
        if let Some(auth) = self.needs_auth_override() {
            builder = builder.auth(&auth);
        }
        
        builder.execute().await?;
        Ok(())
    }

    pub async fn delete_request(&self, cloud_id: &str) -> Result<()> {
        let mut builder = self.postgrest
            .from("requests")
            .eq("id", cloud_id)
            .delete();
        
        if let Some(auth) = self.needs_auth_override() {
            builder = builder.auth(&auth);
        }
        
        builder.execute().await?;
        Ok(())
    }

    pub async fn get_requests(&self) -> Result<Vec<HttpRequest>> {
        let mut builder = self.postgrest
            .from("requests")
            .select("*");
        
        if let Some(auth) = self.needs_auth_override() {
            builder = builder.auth(&auth);
        }
        
        let response = builder.execute().await?;

        let text = response.text().await?;
        let requests: Vec<HttpRequest> = serde_json::from_str(&text)?;
        Ok(requests)
    }

    // CRUD operations for environments
    pub async fn create_environment(&self, environment: &Environment) -> Result<String> {
        // PostgREST insert expects an array, not a single object
        let items = vec![environment];
        
        let mut builder = self.postgrest
            .from("environments")
            .insert(serde_json::to_string(&items)?);
        
        if let Some(auth) = self.needs_auth_override() {
            builder = builder.auth(&auth);
        }
        
        let response = builder.execute().await?;

        let text = response.text().await?;
        
        #[derive(Deserialize)]
        struct IdResponse {
            id: String,
        }

        let data: Vec<IdResponse> = serde_json::from_str(&text)
            .map_err(|e| anyhow!("Failed to parse environment response: {}. Response text: {}", e, text))?;
        data.first()
            .map(|r| r.id.clone())
            .ok_or_else(|| anyhow!("No ID returned"))
    }

    pub async fn update_environment(&self, cloud_id: &str, environment: &Environment) -> Result<()> {
        let mut builder = self.postgrest
            .from("environments")
            .eq("id", cloud_id)
            .update(serde_json::to_string(environment)?);
        
        if let Some(auth) = self.needs_auth_override() {
            builder = builder.auth(&auth);
        }
        
        builder.execute().await?;
        Ok(())
    }

    pub async fn delete_environment(&self, cloud_id: &str) -> Result<()> {
        let mut builder = self.postgrest
            .from("environments")
            .eq("id", cloud_id)
            .delete();
        
        if let Some(auth) = self.needs_auth_override() {
            builder = builder.auth(&auth);
        }
        
        builder.execute().await?;
        Ok(())
    }

    pub async fn get_environments(&self) -> Result<Vec<Environment>> {
        let mut builder = self.postgrest
            .from("environments")
            .select("*");
        
        if let Some(auth) = self.needs_auth_override() {
            builder = builder.auth(&auth);
        }
        
        let response = builder.execute().await?;

        let text = response.text().await?;
        let environments: Vec<Environment> = serde_json::from_str(&text)?;
        Ok(environments)
    }
}
