import React, { useState, useEffect } from "react";
import { Tab } from "../store";
import { invoke } from "@tauri-apps/api/core";
import {
  Clock,
  FileText,
  Download,
  Copy,
  Check,
  AlertCircle,
  Info,
} from "lucide-react";

interface ResponsePanelProps {
  tab: Tab;
}

const ResponsePanel: React.FC<ResponsePanelProps> = ({ tab }) => {
  const [activeTab, setActiveTab] = useState<string>("body");
  const [copied, setCopied] = useState(false);
  const [highlightedBody, setHighlightedBody] = useState<string>("");
  const [isHighlighting, setIsHighlighting] = useState(false);
  const [viewMode, setViewMode] = useState<"pretty" | "raw" | "highlighted">(
    "pretty",
  );

  const response = tab.response;

  // Utility function to format JSON with proper line breaks
  const formatJsonForDisplay = (jsonString: string): string => {
    try {
      const parsed = JSON.parse(jsonString);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return jsonString;
    }
  };

  // Check if content is JSON
  const isJsonContent = (content: string, contentType?: string): boolean => {
    if (contentType?.includes("application/json")) return true;
    if (contentType?.includes("application/vnd.api+json")) return true;

    try {
      JSON.parse(content.trim());
      return true;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    const highlightResponse = async () => {
      if (response?.body && response.body.trim()) {
        setIsHighlighting(true);
        try {
          // Check if response already has highlighted body
          if (response.highlighted_body) {
            setHighlightedBody(response.highlighted_body);
          } else {
            // Get content type from headers
            const contentType =
              response.headers["content-type"] ||
              response.headers["Content-Type"] ||
              undefined;

            const highlighted = await invoke<string>("highlight_response", {
              content: response.body,
              contentType,
            });
            setHighlightedBody(highlighted);
          }
        } catch (error) {
          console.error("Failed to highlight response:", error);
          setHighlightedBody("");
        } finally {
          setIsHighlighting(false);
        }
      } else {
        setHighlightedBody("");
      }
    };

    highlightResponse();
  }, [response?.body, response?.headers]);

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "text-green-600 bg-green-50";
    if (status >= 300 && status < 400) return "text-blue-600 bg-blue-50";
    if (status >= 400 && status < 500) return "text-yellow-600 bg-yellow-50";
    if (status >= 500) return "text-red-600 bg-red-50";
    return "text-gray-600 bg-gray-50";
  };

  const getStatusIcon = (status: number) => {
    if (status >= 200 && status < 300) return <Check className="h-4 w-4" />;
    if (status >= 400 && status < 500)
      return <AlertCircle className="h-4 w-4" />;
    if (status >= 500) return <AlertCircle className="h-4 w-4" />;
    return <Info className="h-4 w-4" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const downloadResponse = () => {
    if (!response) return;

    const blob = new Blob([response.body], {
      type: response.content_type || "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `response_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (tab.loading) {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-gray-800">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Response
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">
              Sending request...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-gray-800">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Response
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FileText className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No response yet</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              Send a request to see the response here
            </p>
          </div>
        </div>
      </div>
    );
  }

  const headerEntries = Object.entries(response.headers);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800">
      {/* Response Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Response
          </h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => copyToClipboard(response.body)}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              title="Copy response"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={downloadResponse}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              title="Download response"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Status and Metrics */}
        <div className="flex items-center space-x-4">
          <div
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
              response.status,
            )}`}
          >
            {getStatusIcon(response.status)}
            <span className="ml-1">
              {response.status} {response.status_text}
            </span>
          </div>

          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <Clock className="h-4 w-4 mr-1" />
            <span>{formatTime(response.response_time)}</span>
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400">
            {formatSize(response.size)}
          </div>

          {response.content_type && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {response.content_type.split(";")[0]}
            </div>
          )}
        </div>
      </div>

      {/* Response Tabs */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-4">
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
              onClick={() => setActiveTab("headers")}
              className={`py-3 px-1 border-b-2 text-sm font-medium ${
                activeTab === "headers"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              Headers ({headerEntries.length})
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar response-panel-content">
          {activeTab === "body" && (
            <div className="p-4">
              {response.body ? (
                <div className="space-y-4">
                  {/* View Toggle */}
                  <div className="flex items-center space-x-4 mb-4">
                    <button
                      onClick={() => setViewMode("pretty")}
                      className={`px-3 py-1 text-sm font-medium rounded ${
                        viewMode === "pretty"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                      }`}
                    >
                      Pretty
                    </button>
                    <button
                      onClick={() => setViewMode("highlighted")}
                      className={`px-3 py-1 text-sm font-medium rounded ${
                        viewMode === "highlighted"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                      }`}
                      disabled={isHighlighting || !highlightedBody}
                    >
                      Highlighted
                      {isHighlighting && (
                        <span className="ml-1 inline-block animate-spin">
                          ⟳
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => setViewMode("raw")}
                      className={`px-3 py-1 text-sm font-medium rounded ${
                        viewMode === "raw"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                      }`}
                    >
                      Raw
                    </button>
                  </div>

                  {/* Content Display */}
                  {viewMode === "pretty" && (
                    <div className="space-y-4">
                      {/* Formatted Body */}
                      {response.formatted_body && (
                        <div>
                          <pre className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-4 response-body json-response dark:text-gray-100">
                            {isJsonContent(
                              response.formatted_body,
                              response.content_type,
                            )
                              ? formatJsonForDisplay(response.formatted_body)
                              : response.formatted_body}
                          </pre>
                        </div>
                      )}

                      {/* Pretty Body (fallback if no formatted body) */}
                      {!response.formatted_body && (
                        <div>
                          <pre className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-4 response-body json-response dark:text-gray-100">
                            {isJsonContent(response.body, response.content_type)
                              ? formatJsonForDisplay(response.body)
                              : response.body}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  {viewMode === "raw" && (
                    <div>
                      <pre className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-4 response-body text-sm font-mono whitespace-pre-wrap dark:text-gray-100">
                        {response.body}
                      </pre>
                    </div>
                  )}

                  {viewMode === "highlighted" && (
                    <div>
                      {/* Syntax Highlighted Body */}
                      {isHighlighting ? (
                        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-4 text-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-2"></div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Highlighting syntax...
                          </p>
                        </div>
                      ) : highlightedBody ? (
                        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-4">
                          <div
                            className="highlighted-content json-response response-body text-sm"
                            dangerouslySetInnerHTML={{
                              __html: highlightedBody,
                            }}
                          />
                        </div>
                      ) : (
                        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-4 text-center">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Syntax highlighting not available
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400">
                    Empty response body
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "headers" && (
            <div className="p-4">
              {headerEntries.length > 0 ? (
                <div className="space-y-3">
                  {headerEntries.map(([key, value], index) => (
                    <div
                      key={index}
                      className="flex items-start space-x-4 py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                    >
                      <div className="flex-1">
                        <div className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
                          {key}
                        </div>
                      </div>
                      <div className="flex-2">
                        <div className="font-mono text-sm text-gray-700 dark:text-gray-300 break-all">
                          {value}
                        </div>
                      </div>
                      <button
                        onClick={() => copyToClipboard(`${key}: ${value}`)}
                        className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                        title="Copy header"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400">No headers</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResponsePanel;
