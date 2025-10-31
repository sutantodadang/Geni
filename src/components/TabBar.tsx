import React from "react";
import { useAppStore } from "../store";
import { useToast } from "../contexts/ToastContext";
import { X, Plus, Trash2 } from "lucide-react";
import HttpMethodBadge from "./HttpMethodBadge";

interface TabBarProps {}

const TabBar: React.FC<TabBarProps> = () => {
  const { tabs, activeTabId, setActiveTab, closeTab, addTab, deleteRequest } =
    useAppStore();
  const { success, error } = useToast();

  const handleDeleteRequest = async (tab: any) => {
    if (!tab.request.id || !tab.request.collection_id) {
      error("Cannot delete unsaved request");
      return;
    }

    if (confirm(`Delete request "${tab.request.name}"?`)) {
      try {
        await deleteRequest(tab.request.id, tab.request.collection_id);
        success(`Request "${tab.request.name}" deleted successfully!`);
      } catch (err) {
        console.error("Failed to delete request:", err);
        error("Failed to delete request. Please try again.");
      }
    }
  };

  if (tabs.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
        <button
          onClick={() => addTab()}
          className="flex items-center space-x-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <Plus className="h-4 w-4" />
          <span>New Tab</span>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center">
      {/* Tabs */}
      <div className="flex-1 flex overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`flex items-center min-w-0 max-w-xs border-r border-gray-200 dark:border-gray-700 ${
              activeTabId === tab.id
                ? "bg-white dark:bg-gray-800"
                : "bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600"
            }`}
          >
            <button
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex items-center space-x-2 px-4 py-3 min-w-0 text-left"
            >
              {/* Method Badge */}
              <HttpMethodBadge method={tab.request.method} variant="minimal" />

              {/* Tab Name */}
              <span className="flex-1 truncate text-sm text-gray-900 dark:text-gray-100">
                {tab.name}
              </span>

              {/* Loading Indicator */}
              {tab.loading && (
                <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
              )}

              {/* Unsaved Indicator */}
              {!tab.saved && !tab.loading && (
                <div className="h-2 w-2 bg-orange-400 rounded-full" />
              )}
            </button>

            {/* Action Buttons */}
            <div className="flex items-center">
              {/* Delete Button (only for saved requests) */}
              {tab.saved && tab.request.id && tab.request.collection_id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteRequest(tab);
                  }}
                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:text-gray-500 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded mr-1"
                  title="Delete request"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}

              {/* Close Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-600 rounded-r"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* New Tab Button */}
      <button
        onClick={() => addTab()}
        className="p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 border-l border-gray-200 dark:border-gray-700"
        title="New tab"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
};

export default TabBar;
