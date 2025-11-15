import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

// Types
export interface HttpMethod {
  GET: "GET";
  POST: "POST";
  PUT: "PUT";
  DELETE: "DELETE";
  PATCH: "PATCH";
  HEAD: "HEAD";
  OPTIONS: "OPTIONS";
}

// Authentication Types
export type AuthType = "none" | "basic" | "bearer";

export interface BasicAuth {
  username: string;
  password: string;
}

export interface BearerAuth {
  token: string;
}

export interface AuthConfig {
  type: AuthType;
  basic?: BasicAuth;
  bearer?: BearerAuth;
}

export type FormDataField =
  | { Text: { value: string } }
  | { File: { path: string } };

export interface RequestBody {
  Raw?: { content: string; content_type: string };
  Json?: any;
  FormData?: Record<string, FormDataField>;
  UrlEncoded?: Record<string, string>;
}

export interface HttpRequest {
  id?: string;
  name: string;
  method: keyof HttpMethod;
  url: string;
  headers: Record<string, string>;
  body?: RequestBody;
  path_params?: Record<string, string>;
  collection_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface HttpResponse {
  status: number;
  status_text: string;
  headers: Record<string, string>;
  body: string;
  formatted_body?: string;
  highlighted_body?: string;
  response_time: number;
  size: number;
  content_type?: string;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  auth?: AuthConfig;
  created_at: string;
  updated_at: string;
}

export interface Environment {
  id: string;
  name: string;
  variables: Record<string, string>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RequestHistory {
  id: string;
  request: HttpRequest;
  response?: HttpResponse;
  timestamp: string;
}

export interface Tab {
  id: string;
  name: string;
  request: HttpRequest;
  response?: HttpResponse;
  loading: boolean;
  saved: boolean;
}

interface AppState {
  // UI State
  activeTabId: string | null;
  tabs: Tab[];
  sidebarCollapsed: boolean;
  selectedCollectionId: string | null;

  // Data State
  collections: Collection[];
  environments: Environment[];
  activeEnvironment: Environment | null;
  history: RequestHistory[];
  collectionRequests: Record<string, HttpRequest[]>;

  // Loading States
  collectionsLoading: boolean;
  environmentsLoading: boolean;
  historyLoading: boolean;
  collectionRequestsLoading: Record<string, boolean>;

  // Actions
  addTab: (request?: Partial<HttpRequest>, collectionId?: string) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string | null) => void;
  updateTab: (tabId: string, updates: Partial<Tab>) => void;
  updateTabRequest: (tabId: string, updates: Partial<HttpRequest>) => void;

  // Collection Actions
  loadCollections: () => Promise<void>;
  createCollection: (
    name: string,
    description?: string,
    parentId?: string,
  ) => Promise<Collection>;
  deleteCollection: (id: string) => Promise<void>;
  moveCollection: (collectionId: string, newParentId?: string) => Promise<void>;
  setSelectedCollection: (id: string | null) => void;
  updateCollectionAuth: (
    collectionId: string,
    auth?: AuthConfig,
  ) => Promise<void>;
  renameCollection: (collectionId: string, name: string) => Promise<void>;
  importPostmanCollection: (jsonData: string) => Promise<Collection>;

  // Environment Actions
  loadEnvironments: () => Promise<void>;
  createEnvironment: (
    name: string,
    variables: Record<string, string>,
  ) => Promise<Environment>;
  updateEnvironment: (
    id: string,
    name: string,
    variables: Record<string, string>,
  ) => Promise<Environment>;
  deleteEnvironment: (id: string) => Promise<void>;
  setActiveEnvironment: (id: string | null) => Promise<void>;

  // Request Actions
  sendRequest: (tabId: string) => Promise<void>;
  saveRequest: (
    tabId: string,
    name: string,
    collectionId?: string,
  ) => Promise<HttpRequest | undefined>;
  loadRequestsFromCollection: (collectionId: string) => Promise<HttpRequest[]>;
  loadCollectionRequests: (collectionId: string) => Promise<void>;
  getCollectionRequests: (collectionId: string) => HttpRequest[];
  deleteRequest: (requestId: string, collectionId?: string) => Promise<void>;
  moveRequest: (requestId: string, newCollectionId: string) => Promise<void>;
  renameRequest: (requestId: string, name: string) => Promise<void>;

  // History Actions
  loadHistory: (limit?: number) => Promise<void>;
  clearHistory: () => Promise<void>;

  // Utility Actions
  setSidebarCollapsed: (collapsed: boolean) => void;
  formatJson: (content: string) => Promise<string>;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const createNewRequest = (): HttpRequest => ({
  name: "New Request",
  method: "GET",
  url: "https://",
  headers: {},
  body: undefined,
});

// Authentication utility functions
const generateAuthHeaders = (auth?: AuthConfig): Record<string, string> => {
  if (!auth || auth.type === "none") {
    return {};
  }

  switch (auth.type) {
    case "basic":
      if (auth.basic?.username && auth.basic?.password) {
        const credentials = btoa(
          `${auth.basic.username}:${auth.basic.password}`,
        );
        return { Authorization: `Basic ${credentials}` };
      }
      break;
    case "bearer":
      if (auth.bearer?.token) {
        return { Authorization: `Bearer ${auth.bearer.token}` };
      }
      break;
  }

  return {};
};

const getCollectionAuthHeaders = (
  collectionId: string | undefined,
  collections: Collection[],
): Record<string, string> => {
  if (!collectionId) return {};

  const collection = collections.find((c) => c.id === collectionId);
  if (!collection) return {};

  // Get auth headers from current collection
  const currentAuthHeaders = generateAuthHeaders(collection.auth);

  // If current collection has auth, use it
  if (Object.keys(currentAuthHeaders).length > 0) {
    return currentAuthHeaders;
  }

  // Otherwise, check parent collection recursively
  if (collection.parent_id) {
    return getCollectionAuthHeaders(collection.parent_id, collections);
  }

  return {};
};

const mergeHeaders = (
  requestHeaders: Record<string, string>,
  authHeaders: Record<string, string>,
): Record<string, string> => {
  // Request headers take precedence over auth headers
  return { ...authHeaders, ...requestHeaders };
};

export const useAppStore = create<AppState>((set, get) => ({
  // Initial UI State
  activeTabId: null,
  tabs: [],
  sidebarCollapsed: false,
  selectedCollectionId: null,

  // Initial Data State
  collections: [],
  environments: [],
  activeEnvironment: null,
  history: [],
  collectionRequests: {},

  // Initial Loading States
  collectionsLoading: false,
  environmentsLoading: false,
  historyLoading: false,
  collectionRequestsLoading: {},

  // Tab Actions
  addTab: (request, collectionId) => {
    const id = generateId();
    const newRequest = {
      ...createNewRequest(),
      ...request,
      collection_id: collectionId || request?.collection_id,
    };
    const newTab: Tab = {
      id,
      name: newRequest.name,
      request: newRequest,
      response: undefined,
      loading: false,
      saved: Boolean(newRequest.id), // Mark as saved if request has an ID
    };

    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: id,
    }));
  },

  closeTab: (tabId) => {
    set((state) => {
      const newTabs = state.tabs.filter((tab) => tab.id !== tabId);
      let newActiveTabId = state.activeTabId;

      if (state.activeTabId === tabId) {
        if (newTabs.length > 0) {
          const currentIndex = state.tabs.findIndex((tab) => tab.id === tabId);
          const nextIndex = Math.min(currentIndex, newTabs.length - 1);
          newActiveTabId = newTabs[nextIndex]?.id || null;
        } else {
          newActiveTabId = null;
        }
      }

      return {
        tabs: newTabs,
        activeTabId: newActiveTabId,
      };
    });
  },

  setActiveTab: (tabId) => {
    set({ activeTabId: tabId });
  },

  updateTab: (tabId, updates) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, ...updates } : tab,
      ),
    }));
  },

  updateTabRequest: (tabId, updates) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId
          ? {
            ...tab,
            request: { ...tab.request, ...updates },
            name: updates.name || tab.request.name,
            saved: false,
          }
          : tab,
      ),
    }));
  },

  // Collection Actions
  loadCollections: async () => {
    set({ collectionsLoading: true });
    try {
      const collections = await invoke<Collection[]>("get_collections");
      set({ collections, collectionsLoading: false });
    } catch (error) {
      console.error("Failed to load collections:", error);
      set({ collectionsLoading: false });
    }
  },

  createCollection: async (name, description, parentId) => {
    try {
      const collection = await invoke<Collection>("create_collection", {
        payload: { name, description, parent_id: parentId },
      });
      set((state) => ({
        collections: [collection, ...state.collections],
      }));
      return collection;
    } catch (error) {
      console.error("Failed to create collection:", error);
      throw error;
    }
  },

  moveCollection: async (collectionId, newParentId) => {
    try {
      await invoke("move_collection", {
        collectionId,
        newParentId: newParentId || null,
      });

      // Reload collections to reflect the move
      await get().loadCollections();
    } catch (error) {
      console.error("Failed to move collection:", error);
      throw error;
    }
  },

  deleteCollection: async (id) => {
    try {
      await invoke("delete_collection", { id });

      set((state) => {
        // Get all collections that will be deleted (the target collection and all its descendants)
        const getDescendantIds = (parentId: string): string[] => {
          const children = state.collections.filter(
            (c) => c.parent_id === parentId,
          );
          let allIds = [parentId];
          for (const child of children) {
            allIds = allIds.concat(getDescendantIds(child.id));
          }
          return allIds;
        };

        const deletedCollectionIds = getDescendantIds(id);

        // Remove deleted collections
        const remainingCollections = state.collections.filter(
          (c) => !deletedCollectionIds.includes(c.id),
        );

        // Clean up collection requests for deleted collections
        const newCollectionRequests = { ...state.collectionRequests };
        deletedCollectionIds.forEach((collectionId) => {
          delete newCollectionRequests[collectionId];
        });

        // Close tabs for requests that belonged to deleted collections
        const newTabs = state.tabs.filter((tab) => {
          return (
            !tab.request.collection_id ||
            !deletedCollectionIds.includes(tab.request.collection_id)
          );
        });

        // Update active tab if needed
        let newActiveTabId = state.activeTabId;
        if (
          state.activeTabId &&
          !newTabs.find((tab) => tab.id === state.activeTabId)
        ) {
          newActiveTabId = newTabs.length > 0 ? newTabs[0].id : null;
        }

        return {
          collections: remainingCollections,
          collectionRequests: newCollectionRequests,
          tabs: newTabs,
          activeTabId: newActiveTabId,
          selectedCollectionId: deletedCollectionIds.includes(
            state.selectedCollectionId || "",
          )
            ? null
            : state.selectedCollectionId,
        };
      });
    } catch (error) {
      console.error("Failed to delete collection:", error);
      throw error;
    }
  },

  setSelectedCollection: (id) => {
    set({ selectedCollectionId: id });
  },

  updateCollectionAuth: async (collectionId, auth) => {
    try {
      await invoke("update_collection_auth", {
        collectionId,
        auth: auth || null,
      });

      // Update the collection in state
      set((state) => ({
        collections: state.collections.map((collection) =>
          collection.id === collectionId ? { ...collection, auth } : collection,
        ),
      }));
    } catch (error) {
      console.error("Failed to update collection auth:", error);
      throw error;
    }
  },

  renameCollection: async (collectionId, name) => {
    try {
      await invoke("update_collection_name", {
        payload: {
          collection_id: collectionId,
          name,
        },
      });

      // Update the collection in state
      set((state) => ({
        collections: state.collections.map((collection) =>
          collection.id === collectionId ? { ...collection, name } : collection,
        ),
      }));
    } catch (error) {
      console.error("Failed to rename collection:", error);
      throw error;
    }
  },

  importPostmanCollection: async (jsonData) => {
    try {
      // Send the JSON string directly to Rust for parsing
      const collection = await invoke<Collection>("import_postman_collection", {
        jsonData: jsonData,
      });

      // Reload all collections to include sub-collections (folders)
      await get().loadCollections();

      // Load requests for the imported collection and its sub-collections
      const allCollections = get().collections;
      for (const col of allCollections) {
        if (col.id === collection.id || col.parent_id === collection.id) {
          await get().loadCollectionRequests(col.id);
        }
      }

      return collection;
    } catch (error) {
      console.error("Failed to import Postman collection:", error);
      throw error;
    }
  },

  // Environment Actions
  loadEnvironments: async () => {
    set({ environmentsLoading: true });
    try {
      const environments = await invoke<Environment[]>("get_environments");
      const activeEnvironment = await invoke<Environment | null>(
        "get_active_environment",
      );
      set({
        environments,
        activeEnvironment,
        environmentsLoading: false,
      });
    } catch (error) {
      console.error("Failed to load environments:", error);
      set({ environmentsLoading: false });
    }
  },

  createEnvironment: async (name, variables) => {
    try {
      const environment = await invoke<Environment>("create_environment", {
        payload: { name, variables },
      });
      set((state) => ({
        environments: [environment, ...state.environments],
      }));
      return environment;
    } catch (error) {
      console.error("Failed to create environment:", error);
      throw error;
    }
  },

  updateEnvironment: async (id, name, variables) => {
    try {
      const environment = await invoke<Environment>("update_environment", {
        id,
        name,
        variables,
      });
      set((state) => ({
        environments: state.environments.map((env) =>
          env.id === id ? environment : env,
        ),
        activeEnvironment:
          state.activeEnvironment?.id === id
            ? environment
            : state.activeEnvironment,
      }));
      return environment;
    } catch (error) {
      console.error("Failed to update environment:", error);
      throw error;
    }
  },

  deleteEnvironment: async (id) => {
    try {
      await invoke("delete_environment", { id });
      set((state) => ({
        environments: state.environments.filter((env) => env.id !== id),
        activeEnvironment:
          state.activeEnvironment?.id === id ? null : state.activeEnvironment,
      }));
    } catch (error) {
      console.error("Failed to delete environment:", error);
      throw error;
    }
  },

  setActiveEnvironment: async (id) => {
    try {
      await invoke("set_active_environment", { id });
      const activeEnvironment = id
        ? get().environments.find((env) => env.id === id) || null
        : null;
      set({ activeEnvironment });
    } catch (error) {
      console.error("Failed to set active environment:", error);
      throw error;
    }
  },

  // Request Actions
  sendRequest: async (tabId) => {
    const state = get();
    const tab = state.tabs.find((t) => t.id === tabId);
    if (!tab) return;

    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, loading: true } : t,
      ),
    }));

    try {
      // Get authentication headers from collection
      const authHeaders = getCollectionAuthHeaders(
        tab.request.collection_id,
        state.collections,
      );

      // Merge request headers with auth headers (request headers take precedence)
      const finalHeaders = mergeHeaders(tab.request.headers, authHeaders);

      const response = await invoke<HttpResponse>("send_request", {
        payload: {
          method: tab.request.method,
          url: tab.request.url,
          headers: finalHeaders,
          body: tab.request.body,
          path_params: tab.request.path_params || {},
          timeout: 30,
        },
      });

      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === tabId ? { ...t, response, loading: false } : t,
        ),
      }));
    } catch (error) {
      console.error("Failed to send request:", error);
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === tabId ? { ...t, loading: false } : t,
        ),
      }));
      throw error;
    }
  },

  saveRequest: async (tabId, name, collectionId) => {
    const state = get();
    const tab = state.tabs.find((t) => t.id === tabId);
    if (!tab) {
      console.error("❌ Tab not found for ID:", tabId);
      return;
    }

    console.log("🔍 Saving request:", {
      tabId,
      name,
      originalMethod: tab.request.method,
      originalName: tab.request.name,
      collectionId,
      requestId: tab.request.id,
      hasExistingId: Boolean(tab.request.id),
    });

    try {
      const savedRequest = await invoke<HttpRequest>("save_request", {
        payload: {
          id: tab.request.id || undefined,
          name,
          method: tab.request.method,
          url: tab.request.url,
          headers: tab.request.headers,
          body: tab.request.body,
          path_params: tab.request.path_params || {},
          collection_id: collectionId,
        },
      });

      console.log("✅ Request saved, backend returned:", {
        id: savedRequest.id,
        name: savedRequest.name,
        method: savedRequest.method,
        url: savedRequest.url,
        collection_id: savedRequest.collection_id,
      });

      // Update the tab with the complete saved request data
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === tabId
            ? {
              ...t,
              name,
              saved: true,
              request: {
                ...savedRequest,
                collection_id: collectionId, // Ensure collection_id is set
              },
            }
            : t,
        ),
      }));

      // Log the updated tab state
      const updatedState = get();
      const updatedTab = updatedState.tabs.find((t) => t.id === tabId);
      console.log("🔄 Tab updated:", {
        tabId,
        tabName: updatedTab?.name,
        requestMethod: updatedTab?.request.method,
        requestName: updatedTab?.request.name,
        requestId: updatedTab?.request.id,
        saved: updatedTab?.saved,
      });

      // Force reload collection requests to ensure UI consistency
      if (collectionId) {
        console.log("🔄 Reloading collection requests for:", collectionId);
        await get().loadCollectionRequests(collectionId);

        // Verify the request appears in collection
        const collectionRequests = get().getCollectionRequests(collectionId);
        console.log(
          "📋 Collection now has requests:",
          collectionRequests.length,
        );
      }

      return savedRequest;
    } catch (error) {
      console.error("❌ Failed to save request:", error);
      throw error;
    }
  },

  loadRequestsFromCollection: async (collectionId) => {
    try {
      return await invoke<HttpRequest[]>("get_requests", {
        collectionId,
      });
    } catch (error) {
      console.error("Failed to load requests from collection:", error);
      return [];
    }
  },

  loadCollectionRequests: async (collectionId) => {
    console.log("🔄 Loading collection requests for:", collectionId);

    set((state) => ({
      collectionRequestsLoading: {
        ...state.collectionRequestsLoading,
        [collectionId]: true,
      },
    }));

    try {
      const requests = await invoke<HttpRequest[]>("get_requests", {
        collectionId,
      });

      console.log("✅ Loaded requests from backend:", {
        collectionId,
        requestCount: requests.length,
        requestNames: requests.map((r) => r.name),
      });

      set((state) => ({
        collectionRequests: {
          ...state.collectionRequests,
          [collectionId]: requests,
        },
        collectionRequestsLoading: {
          ...state.collectionRequestsLoading,
          [collectionId]: false,
        },
      }));

      console.log("🔄 Collection requests state updated");
    } catch (error) {
      console.error("❌ Failed to load collection requests:", error);
      set((state) => ({
        collectionRequestsLoading: {
          ...state.collectionRequestsLoading,
          [collectionId]: false,
        },
      }));
    }
  },

  getCollectionRequests: (collectionId) => {
    return get().collectionRequests[collectionId] || [];
  },

  deleteRequest: async (requestId, collectionId) => {
    try {
      await invoke("delete_request", { id: requestId });

      // Remove from collection requests if collectionId provided
      if (collectionId) {
        set((state) => ({
          collectionRequests: {
            ...state.collectionRequests,
            [collectionId]: (
              state.collectionRequests[collectionId] || []
            ).filter((request) => request.id !== requestId),
          },
        }));
      }

      // Close any tabs with this request
      set((state) => {
        const newTabs = state.tabs.filter(
          (tab) => tab.request.id !== requestId,
        );
        let newActiveTabId = state.activeTabId;

        if (
          state.tabs.some(
            (tab) =>
              tab.request.id === requestId && tab.id === state.activeTabId,
          )
        ) {
          if (newTabs.length > 0) {
            const currentIndex = state.tabs.findIndex(
              (tab) => tab.id === state.activeTabId,
            );
            const nextIndex = Math.min(currentIndex, newTabs.length - 1);
            newActiveTabId = newTabs[nextIndex]?.id || null;
          } else {
            newActiveTabId = null;
          }
        }

        return {
          tabs: newTabs,
          activeTabId: newActiveTabId,
        };
      });
    } catch (error) {
      console.error("Failed to delete request:", error);
      throw error;
    }
  },

  moveRequest: async (requestId, newCollectionId) => {
    try {
      await invoke("move_request", {
        requestId,
        newCollectionId,
      });

      // Update the request in all collections
      const state = get();
      const updatedCollectionRequests = { ...state.collectionRequests };

      // Find and remove the request from its current collection
      let movedRequest: HttpRequest | null = null;
      for (const [collectionId, requests] of Object.entries(
        updatedCollectionRequests,
      )) {
        const requestIndex = requests.findIndex((r) => r.id === requestId);
        if (requestIndex !== -1) {
          movedRequest = requests[requestIndex];
          updatedCollectionRequests[collectionId] = requests.filter(
            (r) => r.id !== requestId,
          );
          break;
        }
      }

      // Add the request to the new collection if found
      if (movedRequest) {
        movedRequest.collection_id = newCollectionId;
        if (!updatedCollectionRequests[newCollectionId]) {
          updatedCollectionRequests[newCollectionId] = [];
        }
        updatedCollectionRequests[newCollectionId].push(movedRequest);

        // Update any open tabs with this request
        set((state) => ({
          collectionRequests: updatedCollectionRequests,
          tabs: state.tabs.map((tab) =>
            tab.request.id === requestId
              ? {
                ...tab,
                request: { ...tab.request, collection_id: newCollectionId },
              }
              : tab,
          ),
        }));
      }
    } catch (error) {
      console.error("Failed to move request:", error);
      throw error;
    }
  },

  renameRequest: async (requestId, name) => {
    try {
      await invoke("update_request_name", {
        payload: {
          request_id: requestId,
          name,
        },
      });

      // Update the request in all collections
      const state = get();
      const updatedCollectionRequests = { ...state.collectionRequests };

      // Find and update the request in collections
      for (const [collectionId, requests] of Object.entries(
        updatedCollectionRequests,
      )) {
        const requestIndex = requests.findIndex((r) => r.id === requestId);
        if (requestIndex !== -1) {
          updatedCollectionRequests[collectionId] = requests.map((request) =>
            request.id === requestId ? { ...request, name } : request,
          );
          break;
        }
      }

      // Update any open tabs with this request
      set((state) => ({
        collectionRequests: updatedCollectionRequests,
        tabs: state.tabs.map((tab) =>
          tab.request.id === requestId
            ? {
              ...tab,
              name,
              request: { ...tab.request, name },
            }
            : tab,
        ),
      }));
    } catch (error) {
      console.error("Failed to rename request:", error);
      throw error;
    }
  },

  // History Actions
  loadHistory: async (limit) => {
    set({ historyLoading: true });
    try {
      const history = await invoke<RequestHistory[]>("get_request_history", {
        limit,
      });
      set({ history, historyLoading: false });
    } catch (error) {
      console.error("Failed to load history:", error);
      set({ historyLoading: false });
    }
  },

  clearHistory: async () => {
    try {
      await invoke("clear_request_history");
      set({ history: [] });
    } catch (error) {
      console.error("Failed to clear history:", error);
      throw error;
    }
  },

  // Utility Actions
  setSidebarCollapsed: (collapsed) => {
    set({ sidebarCollapsed: collapsed });
  },

  formatJson: async (content) => {
    try {
      return await invoke<string>("format_json", { content });
    } catch (error) {
      console.error("Failed to format JSON:", error);
      throw error;
    }
  },
}));

// Initialize store on app load
export const initializeStore = async () => {
  const store = useAppStore.getState();

  try {
    await Promise.all([
      store.loadCollections(),
      store.loadEnvironments(),
      store.loadHistory(50),
    ]);
  } catch (error) {
    console.error("Failed to load initial data:", error);
    // Continue anyway
  }

  // Add initial tab if no tabs exist
  if (store.tabs.length === 0) {
    store.addTab();
  }

  // Load saved sync configuration
  try {
    await invoke("load_saved_sync_config");
  } catch (error) {
    console.log("No saved sync config found or failed to load:", error);
    // Continue anyway - this is not critical
  }
};
