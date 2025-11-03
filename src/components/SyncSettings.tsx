import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Cloud,
  Database,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  X,
} from "lucide-react";
import { useToast } from "../contexts/ToastContext";

interface SyncProvider {
  id: string;
  name: string;
  icon: string;
  description: string;
}

interface SyncStatus {
  is_authenticated: boolean;
  unsynced_collections_count: number;
  unsynced_requests_count: number;
  unsynced_environments_count: number;
  last_sync: string | null;
}

interface User {
  id: string;
  email: string;
  name: string | null;
}

const SYNC_PROVIDERS: SyncProvider[] = [
  {
    id: "api_server",
    name: "API Server",
    icon: "🔗",
    description: "Connect to your own API backend",
  },
  {
    id: "supabase",
    name: "Supabase",
    icon: "🗄️",
    description: "Sync with Supabase Backend",
  },
  {
    id: "google-drive",
    name: "Google Drive",
    icon: "📁",
    description: "Sync with Google Drive",
  },
];

interface SyncSettingsProps {
  onClose: () => void;
}

export default function SyncSettings({ onClose }: SyncSettingsProps) {
  const [selectedProvider, setSelectedProvider] =
    useState<string>("api_server");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { success, error } = useToast();

  // Login form state (for API Server)
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegister, setIsRegister] = useState(false);

  // API Server configuration
  const [showApiServerConfig, setShowApiServerConfig] = useState(false);
  const [apiServerUrl, setApiServerUrl] = useState("");
  const [isApiServerConfigured, setIsApiServerConfigured] = useState(false);

  // Supabase configuration
  const [showSupabaseConfig, setShowSupabaseConfig] = useState(false);
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseApiKey, setSupabaseApiKey] = useState("");
  const [supabaseDbUri, setSupabaseDbUri] = useState(""); // Optional PostgreSQL URI
  const [showSchemaInstructions, setShowSchemaInstructions] = useState(false);
  const [schemaInstructions, setSchemaInstructions] = useState("");

  // Logout confirmation
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Google Drive configuration
  const [showGoogleDriveConfig, setShowGoogleDriveConfig] = useState(false);
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  const [googleRedirectUri, setGoogleRedirectUri] = useState("");

  useEffect(() => {
    loadSavedConfig();
    checkAuthStatus();
  }, []);

  const loadSavedConfig = async () => {
    try {
      const savedConfig = await invoke<string | null>("load_saved_sync_config");

      if (savedConfig) {
        const config = JSON.parse(savedConfig);

        // Set the provider
        if (config.provider === "api_server") {
          setSelectedProvider("api_server");
          if (config.api_server_url) {
            setApiServerUrl(config.api_server_url);
            setIsApiServerConfigured(true);
          }
        } else if (config.provider === "supabase") {
          setSelectedProvider("supabase");
          if (config.supabase_url && config.supabase_api_key) {
            setSupabaseUrl(config.supabase_url);
            setSupabaseApiKey(config.supabase_api_key);
            if (config.supabase_db_uri) {
              setSupabaseDbUri(config.supabase_db_uri);
            }
          }
        } else if (config.provider === "google_drive") {
          setSelectedProvider("google-drive");
          if (config.google_client_id) {
            setGoogleClientId(config.google_client_id);
            setGoogleClientSecret(config.google_client_secret || "");
            setGoogleRedirectUri(config.google_redirect_uri || "");
          }
        }
      }
    } catch (error) {
      console.error("Error loading saved config:", error);
    }
  };

  const checkAuthStatus = async () => {
    try {
      const authenticated = await invoke<boolean>("is_authenticated");
      setIsAuthenticated(authenticated);

      if (authenticated) {
        const currentUser = await invoke<User | null>("get_current_user");
        setUser(currentUser);
        await loadSyncStatus();
      }
    } catch (error) {
      console.error("Error checking auth status:", error);
    }
  };

  const loadSyncStatus = async () => {
    try {
      const status = await invoke<SyncStatus>("get_sync_status");
      setSyncStatus(status);
    } catch (error) {
      console.error("Error loading sync status:", error);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const commandPrefix =
        selectedProvider === "api_server" ? "api_server" : "supabase";

      if (isRegister) {
        await invoke(`${commandPrefix}_sign_up`, {
          email,
          password,
          name: name || null,
        });
        success("Account created successfully!");
      } else {
        await invoke(`${commandPrefix}_sign_in`, { email, password });
        success("Logged in successfully!");
      }

      setEmail("");
      setPassword("");
      setName("");
      setShowLoginForm(false);
      await checkAuthStatus();
    } catch (err) {
      error(`${isRegister ? "Registration" : "Login"} failed: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApiServerConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await invoke("initialize_sync", {
        provider: "api_server",
        apiServerUrl,
      });

      setIsApiServerConfigured(true);
      setShowApiServerConfig(false);
      success("API Server configured successfully!");
      setShowLoginForm(true);
    } catch (err) {
      error(`Configuration failed: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSupabaseConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await invoke("initialize_sync", {
        provider: "supabase",
        supabaseUrl,
        supabaseApiKey,
        supabaseDbUri: supabaseDbUri || null,
      });

      setShowSupabaseConfig(false);
      const message = supabaseDbUri
        ? "Supabase connected! Database schema auto-created."
        : "Supabase connected! Click 'Create/Verify Schema' to set up tables.";
      success(message);
      await checkAuthStatus(); // Supabase is connected immediately
    } catch (err) {
      const errorMsg = String(err);
      // If the error contains SQL instructions, show them in a modal
      if (
        errorMsg.includes("SQL to run:") ||
        errorMsg.includes("CREATE TABLE")
      ) {
        setShowSupabaseConfig(false);
        setSchemaInstructions(errorMsg);
        setShowSchemaInstructions(true);
      } else {
        error(`Configuration failed: ${err}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSchema = async () => {
    setLoading(true);
    try {
      const result = await invoke<string>("supabase_create_schema");
      success(result);
    } catch (err) {
      const errorMsg = String(err);
      // If the error contains SQL instructions, show them in a modal
      if (
        errorMsg.includes("SQL to run:") ||
        errorMsg.includes("CREATE TABLE")
      ) {
        setSchemaInstructions(errorMsg);
        setShowSchemaInstructions(true);
      } else {
        error(`Schema creation failed: ${err}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleDriveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await invoke("initialize_sync", {
        provider: "google_drive",
        googleClientId,
        googleClientSecret,
        googleRedirectUri,
      });

      setShowGoogleDriveConfig(false);
      success("Google Drive configured successfully!");

      // Get auth URL and open OAuth flow
      const [authUrl] = await invoke<[string, string]>(
        "google_drive_get_auth_url"
      );
      window.open(authUrl, "_blank");

      success("Please complete authentication in the opened window");
    } catch (err) {
      error(`Configuration failed: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    try {
      await invoke("logout");
      setIsAuthenticated(false);
      setUser(null);
      setSyncStatus(null);

      // Clear all config states
      setSupabaseUrl("");
      setSupabaseApiKey("");
      setSupabaseDbUri("");
      setApiServerUrl("");
      setGoogleClientId("");
      setGoogleClientSecret("");
      setGoogleRedirectUri("");
      setIsApiServerConfigured(false);

      success(
        "Logged out successfully. All sync configuration has been cleared."
      );
    } catch (err) {
      error(`Logout failed: ${err}`);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await invoke("sync_full");
      success("Sync completed successfully!");
      await loadSyncStatus();
    } catch (err) {
      error(`Sync failed: ${err}`);
    } finally {
      setSyncing(false);
    }
  };

  const handlePushOnly = async () => {
    setSyncing(true);
    try {
      await invoke("sync_push");
      success("Pushed local changes to cloud");
      await loadSyncStatus();
    } catch (err) {
      error(`Push failed: ${err}`);
    } finally {
      setSyncing(false);
    }
  };

  const handlePullOnly = async () => {
    setSyncing(true);
    try {
      await invoke("sync_pull");
      success("Pulled changes from cloud");
      await loadSyncStatus();
    } catch (err) {
      error(`Pull failed: ${err}`);
    } finally {
      setSyncing(false);
    }
  };

  const totalUnsynced = syncStatus
    ? syncStatus.unsynced_collections_count +
      syncStatus.unsynced_requests_count +
      syncStatus.unsynced_environments_count
    : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Cloud className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Cloud Sync Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Provider Selection */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Choose Sync Provider
            </h3>
            {(supabaseUrl || apiServerUrl || googleClientId) && (
              <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-700 dark:text-blue-300">
                ✓ Configuration loaded from previous session
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              {SYNC_PROVIDERS.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => setSelectedProvider(provider.id)}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    selectedProvider === provider.id
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-2xl">{provider.icon}</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {provider.name}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {provider.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Authentication Status */}
          {isAuthenticated && user ? (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span className="font-medium text-green-900 dark:text-green-100">
                    Connected to{" "}
                    {
                      SYNC_PROVIDERS.find((p) => p.id === selectedProvider)
                        ?.name
                    }
                  </span>
                </div>
                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center space-x-1"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300">
                <p>Logged in as: {user.email}</p>
                {user.name && <p>Name: {user.name}</p>}
              </div>
            </div>
          ) : (
            <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                <span className="font-medium text-yellow-900 dark:text-yellow-100">
                  Not Connected
                </span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                {selectedProvider === "supabase"
                  ? "Configure Supabase to start syncing"
                  : "Sign in to start syncing your data"}
              </p>
              <button
                onClick={() => {
                  if (
                    selectedProvider === "api_server" &&
                    !isApiServerConfigured
                  ) {
                    setShowApiServerConfig(true);
                  } else if (selectedProvider === "supabase") {
                    setShowSupabaseConfig(true);
                  } else if (selectedProvider === "google-drive") {
                    setShowGoogleDriveConfig(true);
                  } else {
                    setShowLoginForm(true);
                  }
                }}
                className="btn-primary text-sm"
              >
                {selectedProvider === "api_server" && !isApiServerConfigured
                  ? "Configure API Server"
                  : selectedProvider === "supabase"
                  ? "Connect Supabase"
                  : selectedProvider === "google-drive"
                  ? "Connect Google Drive"
                  : "Sign In"}
              </button>
            </div>
          )}

          {/* Sync Status */}
          {isAuthenticated && syncStatus && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Sync Status
              </h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {syncStatus.unsynced_collections_count}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Collections
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {syncStatus.unsynced_requests_count}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Requests
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {syncStatus.unsynced_environments_count}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Environments
                  </div>
                </div>
              </div>
              {totalUnsynced > 0 && (
                <div className="text-sm text-orange-600 dark:text-orange-400 flex items-center space-x-1">
                  <AlertCircle className="h-4 w-4" />
                  <span>{totalUnsynced} unsynced item(s)</span>
                </div>
              )}
              {syncStatus.last_sync && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Last synced: {new Date(syncStatus.last_sync).toLocaleString()}
                </div>
              )}
            </div>
          )}

          {/* Sync Actions */}
          {isAuthenticated && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Sync Actions
              </h3>

              {/* Supabase Schema Creation Button */}
              {selectedProvider === "supabase" && (
                <button
                  onClick={handleCreateSchema}
                  disabled={loading}
                  className="w-full btn-secondary flex items-center justify-center space-x-2 text-sm"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Database className="h-4 w-4" />
                  )}
                  <span>Create/Verify Database Schema</span>
                </button>
              )}

              <button
                onClick={handleSync}
                disabled={syncing}
                className="w-full btn-primary flex items-center justify-center space-x-2"
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span>Full Sync (Push & Pull)</span>
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handlePushOnly}
                  disabled={syncing}
                  className="btn-secondary flex items-center justify-center space-x-2"
                >
                  {syncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Cloud className="h-4 w-4" />
                  )}
                  <span>Push Only</span>
                </button>
                <button
                  onClick={handlePullOnly}
                  disabled={syncing}
                  className="btn-secondary flex items-center justify-center space-x-2"
                >
                  {syncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Database className="h-4 w-4" />
                  )}
                  <span>Pull Only</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Login Form Modal */}
        {showLoginForm && !isAuthenticated && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md m-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {isRegister ? "Create Account" : "Sign In"}
              </h3>
              <form onSubmit={handleLogin} className="space-y-4">
                {isRegister && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full form-input"
                      placeholder="Your name"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full form-input"
                    placeholder="your@email.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full form-input"
                    placeholder="••••••••"
                    required
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 btn-primary"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    ) : isRegister ? (
                      "Create Account"
                    ) : (
                      "Sign In"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLoginForm(false)}
                    className="flex-1 btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setIsRegister(!isRegister)}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {isRegister
                      ? "Already have an account? Sign in"
                      : "Don't have an account? Create one"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Supabase Configuration Modal */}
        {showSupabaseConfig && !isAuthenticated && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md m-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Connect Supabase
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Enter your Supabase project details. No additional login
                required.
              </p>
              <form onSubmit={handleSupabaseConfig} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Project URL
                  </label>
                  <input
                    type="url"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    className="w-full form-input"
                    placeholder="https://your-project.supabase.co"
                    required
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Find this in your Supabase project settings
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    API Key (anon/public)
                  </label>
                  <input
                    type="password"
                    value={supabaseApiKey}
                    onChange={(e) => setSupabaseApiKey(e.target.value)}
                    className="w-full form-input"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    required
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Use the anon (public) key from API settings
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Database URI (Optional - for auto schema creation)
                  </label>
                  <input
                    type="password"
                    value={supabaseDbUri}
                    onChange={(e) => setSupabaseDbUri(e.target.value)}
                    className="w-full form-input"
                    placeholder="postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    💡 Add this to automatically create database tables. Find in
                    Settings → Database → Connection String (URI). If not
                    provided, you'll need to run SQL manually.
                  </p>
                </div>
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 btn-primary"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    ) : (
                      "Connect"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSupabaseConfig(false)}
                    className="flex-1 btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* API Server Configuration Modal */}
        {showApiServerConfig && !isAuthenticated && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md m-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Configure API Server
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Enter your API server URL to enable sync
              </p>
              <form onSubmit={handleApiServerConfig} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Server URL
                  </label>
                  <input
                    type="url"
                    value={apiServerUrl}
                    onChange={(e) => setApiServerUrl(e.target.value)}
                    className="w-full form-input"
                    placeholder="http://localhost:3000"
                    required
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Your dedicated API server endpoint
                  </p>
                </div>
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 btn-primary"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    ) : (
                      "Save & Continue"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowApiServerConfig(false)}
                    className="flex-1 btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Google Drive Configuration Modal */}
        {showGoogleDriveConfig && !isAuthenticated && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md m-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Configure Google Drive
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Enter your Google OAuth credentials
              </p>
              <form onSubmit={handleGoogleDriveConfig} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Client ID
                  </label>
                  <input
                    type="text"
                    value={googleClientId}
                    onChange={(e) => setGoogleClientId(e.target.value)}
                    className="w-full form-input"
                    placeholder="your-client-id.apps.googleusercontent.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Client Secret
                  </label>
                  <input
                    type="password"
                    value={googleClientSecret}
                    onChange={(e) => setGoogleClientSecret(e.target.value)}
                    className="w-full form-input"
                    placeholder="GOCSPX-..."
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Redirect URI
                  </label>
                  <input
                    type="url"
                    value={googleRedirectUri}
                    onChange={(e) => setGoogleRedirectUri(e.target.value)}
                    className="w-full form-input"
                    placeholder="http://localhost:3000/auth/callback"
                    required
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Must match the authorized redirect URI in Google Console
                  </p>
                </div>
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 btn-primary"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    ) : (
                      "Connect"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGoogleDriveConfig(false)}
                    className="flex-1 btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Logout Confirmation Modal */}
        {showLogoutConfirm && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md m-4">
              <div className="flex items-start mb-4">
                <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Confirm Logout
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Are you sure you want to logout? This will:
                  </p>
                  <ul className="mt-2 text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1">
                    <li>Sign you out of the current sync provider</li>
                    <li>Delete all saved sync configuration</li>
                    <li>
                      Clear your connection settings (URLs, API keys, etc.)
                    </li>
                  </ul>
                  <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                    You will need to reconfigure your sync provider to connect
                    again.
                  </p>
                </div>
              </div>
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button onClick={handleLogout} className="flex-1 btn-danger">
                  Yes, Logout
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Schema Instructions Modal */}
        {showSchemaInstructions && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl m-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  📋 Database Setup Instructions
                </h3>
                <button
                  onClick={() => setShowSchemaInstructions(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="prose dark:prose-invert max-w-none">
                <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm whitespace-pre-wrap">
                  {schemaInstructions}
                </pre>
              </div>
              <div className="mt-6 flex justify-between items-center">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(schemaInstructions);
                    success("SQL copied to clipboard!");
                  }}
                  className="btn-secondary"
                >
                  📋 Copy SQL
                </button>
                <button
                  onClick={() => setShowSchemaInstructions(false)}
                  className="btn-primary"
                >
                  Got it!
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
