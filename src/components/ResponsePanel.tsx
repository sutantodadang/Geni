import React, { useState, useEffect, useMemo } from "react";
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
  const [viewMode, setViewMode] = useState<"pretty" | "raw">("pretty");

  const response = tab.response;

  // Utility function to format JSON with proper line breaks
  const formatJsonForDisplay = (jsonString: string): string => {
    try {
      const trimmed = jsonString.trim();
      const parsed = JSON.parse(trimmed);
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      return jsonString;
    }
  };

  const prettyBody = useMemo(() => {
    if (!response?.body) {
      return "";
    }

    if (response.formatted_body && response.formatted_body.trim().length > 0) {
      return response.formatted_body;
    }

    return formatJsonForDisplay(response.body);
  }, [response?.body, response?.formatted_body]);

  useEffect(() => {
    let cancelled = false;

    const highlightResponse = async () => {
      if (!response?.body || !response.body.trim()) {
        setHighlightedBody("");
        setIsHighlighting(false);
        return;
      }

      setIsHighlighting(true);

      try {
        const contentType =
          response.content_type ||
          response.headers["content-type"] ||
          response.headers["Content-Type"] ||
          undefined;

        const contentToHighlight =
          prettyBody && prettyBody.trim().length > 0
            ? prettyBody
            : response.body;

        const highlighted = await invoke<string>("highlight_response", {
          content: contentToHighlight,
          content_type: contentType,
        });

        if (!cancelled) {
          setHighlightedBody(highlighted);
        }
      } catch (error) {
        if (!cancelled) {
          setHighlightedBody("");
        }
      } finally {
        if (!cancelled) {
          setIsHighlighting(false);
        }
      }
    };

    highlightResponse();

    return () => {
      cancelled = true;
    };
  }, [prettyBody, response?.body, response?.headers, response?.content_type]);

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
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 overflow-hidden">
      {/* Response Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
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
        <div className="flex items-center space-x-4 flex-wrap">
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
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
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
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar response-panel-content min-h-0">
          {activeTab === "body" && (
            <div className="p-4">
              {response.body ? (
                <div className="space-y-4">
                  {/* View Toggle */}
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mr-2">
                      View:
                    </div>
                    <button
                      onClick={() => setViewMode("pretty")}
                      className={`px-3 py-1 text-sm font-medium rounded border-2 ${
                        viewMode === "pretty"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-500"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border-transparent"
                      }`}
                    >
                      Pretty {viewMode === "pretty"}
                      {isHighlighting && (
                        <span className="ml-1 inline-block animate-spin">
                          ⟳
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => setViewMode("raw")}
                      className={`px-3 py-1 text-sm font-medium rounded border-2 ${
                        viewMode === "raw"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-500"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border-transparent"
                      }`}
                    >
                      Raw {viewMode === "raw"}
                    </button>
                  </div>

                  {/* Content Display */}
                  {viewMode === "pretty" && (
                    <div className="space-y-4">
                      {/* Always show formatted content, with syntax highlighting if available */}
                      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-4 overflow-auto">
                        {isHighlighting ? (
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-2"></div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Formatting response...
                            </p>
                          </div>
                        ) : highlightedBody ? (
                          <pre
                            className="highlighted-content json-response response-body text-sm"
                            style={{
                              fontFamily: "monospace",
                              overflowX: "auto",
                              margin: 0,
                              padding: 0,
                              background: "transparent",
                            }}
                            dangerouslySetInnerHTML={{
                              __html: highlightedBody,
                            }}
                          />
                        ) : (
                          <pre className="text-sm font-mono whitespace-pre-wrap dark:text-gray-100">
                            {prettyBody}
                          </pre>
                        )}
                      </div>
                    </div>
                  )}

                  {viewMode === "raw" && (
                    <pre className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-4 response-body text-sm font-mono whitespace-pre-wrap dark:text-gray-100 overflow-auto">
                      {response.body}
                    </pre>
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
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100 break-words">
                          {key}
                        </div>
                      </div>
                      <div className="flex-2 min-w-0">
                        <div className="font-mono text-sm text-gray-700 dark:text-gray-300 break-all">
                          {value}
                        </div>
                      </div>
                      <button
                        onClick={() => copyToClipboard(`${key}: ${value}`)}
                        className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded flex-shrink-0"
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
