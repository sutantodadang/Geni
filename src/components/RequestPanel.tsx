import React, { useState, useEffect, useRef } from "react";
import { useAppStore, Tab, RequestBody } from "../store";
import { useToast } from "../contexts/ToastContext";
import Breadcrumb from "./Breadcrumb";
import HttpMethodSelector from "./HttpMethodSelector";
import UrlInput from "./UrlInput";
import {
  Send,
  Save,
  Plus,
  Trash2,
  Code,
  FileText,
  Database,
} from "lucide-react";

interface RequestPanelProps {
  tab: Tab;
}

const RequestPanel: React.FC<RequestPanelProps> = ({ tab }) => {
  const {
    updateTabRequest,
    sendRequest,
    saveRequest,
    collections,
    formatJson,
  } = useAppStore();

  const { success, error } = useToast();

  const [activeTab, setActiveTab] = useState<string>("headers");
  const [activeBodyTab, setActiveBodyTab] = useState<string>("json");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState(tab.request.name);
  const [saveCollectionId, setSaveCollectionId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [showShortcutHint, setShowShortcutHint] = useState(false);

  // Local state for JSON input to prevent re-render interference
  const [localJsonContent, setLocalJsonContent] = useState<string>("");
  const [isJsonFocused, setIsJsonFocused] = useState(false);
  const debounceTimeoutRef = useRef<number | null>(null);

  // Handle Ctrl+S keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        setShowShortcutHint(true);
        setTimeout(() => setShowShortcutHint(false), 1000);
        handleQuickSave();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [tab.id, tab.request]);

  // Initialize local JSON content when tab changes or when not focused
  useEffect(() => {
    if (!isJsonFocused && activeBodyTab === "json") {
      const content = getBodyContentFromTab();
      setLocalJsonContent(content);
    }
  }, [tab.request.body, activeBodyTab, isJsonFocused]);

  // Debounced update to avoid frequent re-renders
  useEffect(() => {
    if (isJsonFocused && activeBodyTab === "json") {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      debounceTimeoutRef.current = setTimeout(() => {
        updateTabBodyFromJson(localJsonContent);
      }, 300);
    }
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [localJsonContent, isJsonFocused, activeBodyTab]);

  // Header management
  const addHeader = () => {
    const newHeaders = { ...tab.request.headers, "": "" };
    updateTabRequest(tab.id, { headers: newHeaders });
  };

  const updateHeader = (oldKey: string, newKey: string, value: string) => {
    const newHeaders = { ...tab.request.headers };
    if (oldKey !== newKey) {
      delete newHeaders[oldKey];
    }
    if (newKey.trim()) {
      newHeaders[newKey] = value;
    }
    updateTabRequest(tab.id, { headers: newHeaders });
  };

  const removeHeader = (key: string) => {
    const newHeaders = { ...tab.request.headers };
    delete newHeaders[key];
    updateTabRequest(tab.id, { headers: newHeaders });
  };

  // URL parameter management
  const parseUrlParams = (url: string): Record<string, string> => {
    const params: Record<string, string> = {};
    try {
      const urlObj = new URL(url);
      urlObj.searchParams.forEach((value, key) => {
        params[key] = value;
      });
    } catch {
      // Invalid URL, return empty params
    }
    return params;
  };

  const updateUrlParams = (params: Record<string, string>) => {
    try {
      const urlObj = new URL(tab.request.url);
      // Clear existing params
      urlObj.search = "";
      // Add new params
      Object.entries(params).forEach(([key, value]) => {
        if (key.trim() && value.trim()) {
          urlObj.searchParams.set(key, value);
        }
      });
      updateTabRequest(tab.id, { url: urlObj.toString() });
    } catch {
      // Invalid URL, don't update
    }
  };

  const addUrlParam = () => {
    const currentParams = parseUrlParams(tab.request.url);
    const newParams = { ...currentParams, "": "" };
    updateUrlParams(newParams);
  };

  const updateUrlParam = (oldKey: string, newKey: string, value: string) => {
    const currentParams = parseUrlParams(tab.request.url);
    const newParams = { ...currentParams };

    if (oldKey !== newKey) {
      delete newParams[oldKey];
    }
    if (newKey.trim()) {
      newParams[newKey] = value;
    } else {
      delete newParams[newKey];
    }

    updateUrlParams(newParams);
  };

  const removeUrlParam = (key: string) => {
    const currentParams = parseUrlParams(tab.request.url);
    const newParams = { ...currentParams };
    delete newParams[key];
    updateUrlParams(newParams);
  };

  // Body management
  const updateBody = (body: RequestBody | undefined) => {
    updateTabRequest(tab.id, { body });
  };

  // Get body content from tab (for display when not actively editing)
  const getBodyContentFromTab = (): string => {
    if (!tab.request.body) return "";

    if (tab.request.body.Json) {
      return JSON.stringify(tab.request.body.Json, null, 2);
    }
    // Handle case where invalid JSON is stored as raw content
    if (
      tab.request.body.Raw &&
      tab.request.body.Raw.content_type === "application/json"
    ) {
      return tab.request.body.Raw.content;
    }
    return "";
  };

  const getBodyContent = (): string => {
    if (!tab.request.body) return "";

    switch (activeBodyTab) {
      case "json":
        // Return local content when actively editing, otherwise get from tab
        return isJsonFocused ? localJsonContent : getBodyContentFromTab();
      case "raw":
        if (tab.request.body.Raw) {
          return tab.request.body.Raw.content;
        }
        return "";
      case "form":
        if (tab.request.body.FormData) {
          return Object.entries(tab.request.body.FormData)
            .map(([key, value]) => `${key}=${value}`)
            .join("\n");
        }
        return "";
      case "urlencoded":
        if (tab.request.body.UrlEncoded) {
          return Object.entries(tab.request.body.UrlEncoded)
            .map(([key, value]) => `${key}=${value}`)
            .join("\n");
        }
        return "";
      default:
        return "";
    }
  };

  // Update tab body from JSON content
  const updateTabBodyFromJson = (content: string) => {
    let newBody: RequestBody | undefined;

    if (content.trim() === "") {
      newBody = undefined;
    } else {
      try {
        const parsed = JSON.parse(content);
        newBody = { Json: parsed };
      } catch {
        // For invalid JSON, store as raw content temporarily
        newBody = { Raw: { content, content_type: "application/json" } };
      }
    }

    updateTabRequest(tab.id, { body: newBody });
  };

  const setBodyContent = (content: string) => {
    let newBody: RequestBody | undefined;

    switch (activeBodyTab) {
      case "json":
        // Update local state immediately for smooth typing
        setLocalJsonContent(content);
        return;
      case "raw":
        newBody = {
          Raw: {
            content,
            content_type: "text/plain",
          },
        };
        break;
      case "form":
        const formData: Record<string, string> = {};
        content.split("\n").forEach((line) => {
          const [key, ...valueParts] = line.split("=");
          if (key?.trim()) {
            formData[key.trim()] = valueParts.join("=") || "";
          }
        });
        newBody = { FormData: formData };
        break;
      case "urlencoded":
        const urlEncodedData: Record<string, string> = {};
        content.split("\n").forEach((line) => {
          const [key, ...valueParts] = line.split("=");
          if (key?.trim()) {
            urlEncodedData[key.trim()] = valueParts.join("=") || "";
          }
        });
        newBody = { UrlEncoded: urlEncodedData };
        break;
    }

    updateBody(content.trim() ? newBody : undefined);
  };

  const handleSend = async () => {
    try {
      await sendRequest(tab.id);
    } catch (error) {
      console.error("Failed to send request:", error);
    }
  };

  const handleSave = async () => {
    if (!saveName.trim()) return;

    try {
      await saveRequest(tab.id, saveName, saveCollectionId || undefined);
      setShowSaveModal(false);
      success(`Request "${saveName}" saved successfully!`);
    } catch (err) {
      console.error("Failed to save request:", err);
      error("Failed to save request. Please try again.");
    }
  };

  const handleQuickSave = async () => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      // If request already has an ID and collection, save directly
      if (tab.request.id && tab.request.collection_id) {
        await saveRequest(tab.id, tab.request.name, tab.request.collection_id);
        success("Request saved successfully!");
      } else {
        // Otherwise show modal for first save
        setIsSaving(false);
        setShowSaveModal(true);
        return;
      }
    } catch (err) {
      console.error("Failed to save request:", err);
      error("Failed to save request. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFormatJson = async () => {
    const content = isJsonFocused ? localJsonContent : getBodyContentFromTab();
    try {
      const formatted = await formatJson(content);
      if (isJsonFocused) {
        setLocalJsonContent(formatted);
      } else {
        updateTabBodyFromJson(formatted);
      }
    } catch (error) {
      console.error("Failed to format JSON:", error);
    }
  };

  const headerEntries = Object.entries(tab.request.headers);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800">
      {/* Breadcrumb Navigation */}
      <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/50">
        <Breadcrumb
          currentCollection={tab.request.collection_id}
          requestName={tab.request.name}
          requestMethod={tab.request.method}
          className="text-xs"
        />
      </div>

      {/* Request Line */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        {/* First Row: Method, URL, Send */}
        <div className="flex space-x-2 mb-2">
          {/* Method Selector */}
          <HttpMethodSelector
            value={tab.request.method}
            onChange={(method) =>
              updateTabRequest(tab.id, { method: method as any })
            }
          />

          {/* URL Input - Now takes more width */}
          <UrlInput
            value={tab.request.url}
            onChange={(url) => updateTabRequest(tab.id, { url })}
            className="flex-1"
            placeholder="https://api.example.com/endpoint"
          />

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={tab.loading || !tab.request.url.trim()}
            className="btn-primary flex items-center space-x-2 whitespace-nowrap"
          >
            <Send className="h-4 w-4" />
            <span>{tab.loading ? "Sending..." : "Send"}</span>
          </button>
        </div>

        {/* Second Row: Save Actions - More compact */}
        <div className="flex justify-end space-x-1">
          {/* Save Button */}
          <div className="relative">
            <button
              onClick={handleQuickSave}
              disabled={isSaving}
              className={`btn-secondary flex items-center space-x-1 px-3 py-1.5 text-sm transition-all duration-200 ${
                showShortcutHint ? "ring-2 ring-blue-500 ring-offset-2" : ""
              }`}
              title="Save (Ctrl+S)"
            >
              <Save className="h-3 w-3" />
              <span className="hidden sm:inline">
                {isSaving ? "Saving..." : "Save"}
              </span>
            </button>
            {showShortcutHint && (
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                Ctrl+S pressed
              </div>
            )}
          </div>

          {/* Save As Button */}
          <button
            onClick={() => {
              setSaveName(tab.request.name);
              setSaveCollectionId(tab.request.collection_id || "");
              setShowSaveModal(true);
            }}
            disabled={isSaving}
            className="btn-secondary flex items-center space-x-1 px-3 py-1.5 text-sm"
            title="Save As..."
          >
            <Save className="h-3 w-3" />
            <span className="hidden sm:inline">Save As</span>
          </button>
        </div>
      </div>

      {/* Request Configuration Tabs */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-4">
            <button
              onClick={() => setActiveTab("headers")}
              className={`py-3 px-1 border-b-2 text-sm font-medium ${
                activeTab === "headers"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              Headers
            </button>
            <button
              onClick={() => setActiveTab("body")}
              className={`py-3 px-1 border-b-2 text-sm font-medium ${
                activeTab === "body"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              Body
            </button>
            <button
              onClick={() => setActiveTab("params")}
              className={`py-3 px-1 border-b-2 text-sm font-medium ${
                activeTab === "params"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              Params
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {activeTab === "headers" && (
            <div className="p-4">
              <div className="space-y-2">
                {headerEntries.map(([key, value], index) => (
                  <div key={index} className="flex space-x-2">
                    <input
                      type="text"
                      value={key}
                      onChange={(e) => updateHeader(key, e.target.value, value)}
                      className="flex-1 form-input text-sm"
                      placeholder="Header name"
                    />
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => updateHeader(key, key, e.target.value)}
                      className="flex-1 form-input text-sm"
                      placeholder="Header value"
                    />
                    <button
                      onClick={() => removeHeader(key)}
                      className="text-red-600 hover:text-red-800 p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addHeader}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Header
                </button>

                {headerEntries.length === 0 && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md">
                    <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                      No headers added yet. Click "Add Header" to include custom
                      headers in your request.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "body" && (
            <div className="p-4">
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                  Request Body
                </h3>
                <div className="flex space-x-4">
                  <button
                    onClick={() => setActiveBodyTab("json")}
                    className={`flex items-center space-x-2 px-3 py-2 text-sm rounded-md ${
                      activeBodyTab === "json"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                    }`}
                  >
                    <Code className="h-4 w-4" />
                    <span>JSON</span>
                  </button>
                  <button
                    onClick={() => setActiveBodyTab("raw")}
                    className={`flex items-center space-x-2 px-3 py-2 text-sm rounded-md ${
                      activeBodyTab === "raw"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                    }`}
                  >
                    <FileText className="h-4 w-4" />
                    <span>Raw</span>
                  </button>
                  <button
                    onClick={() => setActiveBodyTab("form")}
                    className={`flex items-center space-x-2 px-3 py-2 text-sm rounded-md ${
                      activeBodyTab === "form"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                    }`}
                  >
                    <Database className="h-4 w-4" />
                    <span>Form Data</span>
                  </button>
                  <button
                    onClick={() => setActiveBodyTab("urlencoded")}
                    className={`flex items-center space-x-2 px-3 py-2 text-sm rounded-md ${
                      activeBodyTab === "urlencoded"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                    }`}
                  >
                    <Database className="h-4 w-4" />
                    <span>URL Encoded</span>
                  </button>
                </div>
              </div>

              <div className="relative">
                {activeBodyTab === "json" && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          JSON
                        </span>
                        {(() => {
                          const content = isJsonFocused
                            ? localJsonContent
                            : getBodyContentFromTab();
                          if (content.trim() === "") return null;
                          try {
                            JSON.parse(content);
                            return (
                              <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded">
                                Valid
                              </span>
                            );
                          } catch {
                            return (
                              <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded">
                                Invalid JSON (typing...)
                              </span>
                            );
                          }
                        })()}
                      </div>
                      <button
                        onClick={handleFormatJson}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                      >
                        Format
                      </button>
                    </div>
                    <textarea
                      value={
                        isJsonFocused
                          ? localJsonContent
                          : getBodyContentFromTab()
                      }
                      onChange={(e) => {
                        setLocalJsonContent(e.target.value);
                      }}
                      onFocus={() => {
                        setIsJsonFocused(true);
                        setLocalJsonContent(getBodyContentFromTab());
                      }}
                      onBlur={() => {
                        setIsJsonFocused(false);
                        updateTabBodyFromJson(localJsonContent);
                      }}
                      className="w-full h-40 form-input font-mono text-sm resize-none"
                      placeholder='{"key": "value"}'
                      spellCheck={false}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                    />
                  </div>
                )}

                {activeBodyTab === "raw" && (
                  <div className="space-y-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Raw Text
                    </span>
                    <textarea
                      value={getBodyContent()}
                      onChange={(e) => setBodyContent(e.target.value)}
                      className="w-full h-40 form-input font-mono text-sm resize-none"
                      placeholder="Raw text content..."
                      spellCheck={false}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                    />
                  </div>
                )}

                {(activeBodyTab === "form" ||
                  activeBodyTab === "urlencoded") && (
                  <div className="space-y-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {activeBodyTab === "form" ? "Form Data" : "URL Encoded"}
                    </span>
                    <textarea
                      value={getBodyContent()}
                      onChange={(e) => setBodyContent(e.target.value)}
                      className="w-full h-40 form-input font-mono text-sm resize-none"
                      placeholder="key1=value1&#10;key2=value2"
                      spellCheck={false}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                    />
                    <p className="text-xs text-gray-500">
                      Enter one key=value pair per line
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "params" && (
            <div className="p-4">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                  Query Parameters
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Query parameters are parsed from the URL automatically.
                  Changes here will update the URL.
                </p>

                {Object.entries(parseUrlParams(tab.request.url)).map(
                  ([key, value], index) => (
                    <div key={index} className="flex space-x-2">
                      <input
                        type="text"
                        value={key}
                        onChange={(e) =>
                          updateUrlParam(key, e.target.value, value)
                        }
                        className="flex-1 form-input text-sm"
                        placeholder="Parameter name"
                      />
                      <input
                        type="text"
                        value={value}
                        onChange={(e) =>
                          updateUrlParam(key, key, e.target.value)
                        }
                        className="flex-1 form-input text-sm"
                        placeholder="Parameter value"
                      />
                      <button
                        onClick={() => removeUrlParam(key)}
                        className="text-red-600 hover:text-red-800 p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )
                )}

                <button
                  onClick={addUrlParam}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Parameter
                </button>

                {Object.keys(parseUrlParams(tab.request.url)).length === 0 && (
                  <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      No query parameters found. Add some above or include them
                      in the URL.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-lg mx-4">
            <h3 className="text-lg font-semibold mb-4">
              {tab.request.id ? "Save Request As" : "Save Request"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Request Name *
                </label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  className="w-full form-input"
                  placeholder="My API Request"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Collection
                </label>
                <select
                  value={saveCollectionId}
                  onChange={(e) => setSaveCollectionId(e.target.value)}
                  className="w-full form-input"
                >
                  <option value="">No Collection</option>
                  {collections.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowSaveModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!saveName.trim()}
                className="btn-primary"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestPanel;
