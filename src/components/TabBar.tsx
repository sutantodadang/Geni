import React from "react";
import { useAppStore } from "../store";
import { useToast } from "../contexts/ToastContext";
import { X, Plus, Trash2 } from "lucide-react";
import HttpMethodBadge from "./HttpMethodBadge";

interface TabBarProps {}

const TabBar: React.FC<TabBarProps> = () => {
  const {
    tabs,
    activeTabId,
    setActiveTab,
    closeTab,
    addTab,
    deleteRequest,
    renameRequest,
    updateTabRequest,
  } = useAppStore();
  const { success, error } = useToast();
  const [editingTabId, setEditingTabId] = React.useState<string | null>(null);
  const [editedName, setEditedName] = React.useState("");

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

  const handleRenameRequest = async (tab: any) => {
    if (
      !tab.request.id ||
      !editedName.trim() ||
      editedName === tab.request.name
    ) {
      setEditingTabId(null);
      return;
    }

    try {
      await renameRequest(tab.request.id, editedName.trim());
      updateTabRequest(tab.id, { name: editedName.trim() });
      success("Request renamed successfully!");
      setEditingTabId(null);
    } catch (err) {
      console.error("Failed to rename request:", err);
      error("Failed to rename request. Please try again.");
      setEditingTabId(null);
    }
  };

  const handleTabDoubleClick = (tab: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tab.request.id) {
      setEditingTabId(tab.id);
      setEditedName(tab.request.name);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, tab: any) => {
    if (e.key === "Enter") {
      handleRenameRequest(tab);
    } else if (e.key === "Escape") {
      setEditingTabId(null);
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
    <div className="bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center">
      {/* Tabs */}
      <div className="flex-1 flex overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`flex items-center min-w-0 max-w-xs border-r border-gray-200 dark:border-gray-700 transition-colors ${
              activeTabId === tab.id
                ? "bg-white dark:bg-gray-800 border-t-2 border-t-blue-500"
                : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-900 dark:hover:bg-gray-800 border-t-2 border-t-transparent"
            }`}
          >
            <button
              onClick={() => setActiveTab(tab.id)}
              onDoubleClick={(e) => handleTabDoubleClick(tab, e)}
              className="flex-1 flex items-center space-x-2 px-4 py-3 min-w-0 text-left"
            >
              {/* Method Badge */}
              <HttpMethodBadge method={tab.request.method} variant="minimal" />

              {/* Tab Name */}
              {editingTabId === tab.id ? (
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onBlur={() => handleRenameRequest(tab)}
                  onKeyDown={(e) => handleKeyDown(e, tab)}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                  className="flex-1 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 border border-blue-500 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-0"
                />
              ) : (
                <span
                  className="flex-1 truncate text-sm text-gray-900 dark:text-gray-100"
                  title={tab.request.id ? "Double-click to rename" : tab.name}
                >
                  {tab.name}
                </span>
              )}

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
