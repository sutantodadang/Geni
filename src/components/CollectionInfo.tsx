import React, { useState, useEffect } from "react";
import { useAppStore, type Collection } from "../store";
import { useToast } from "../contexts/ToastContext";
import HttpMethodBadge from "./HttpMethodBadge";
import {
  Folder,
  FolderOpen,
  Plus,
  FileText,
  Shield,
  Calendar,
  Hash,
  Trash2,
} from "lucide-react";

interface CollectionInfoProps {
  collection: Collection;
}

const CollectionInfo: React.FC<CollectionInfoProps> = ({ collection }) => {
  const {
    collectionRequests,
    addTab,
    deleteCollection,
    collections,
    collectionRequestsLoading,
    loadCollectionRequests,
    renameCollection,
  } = useAppStore();
  const { success, error } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(collection.name);

  // Get requests for this collection
  const requests = collectionRequests[collection.id] || [];
  const isLoadingRequests = collectionRequestsLoading[collection.id] || false;

  // Get child collections
  const childCollections = collections.filter(
    (col) => col.parent_id === collection.id
  );

  // Get collection statistics
  const stats = {
    requests: requests.length,
    collections: childCollections.length,
    methods: [...new Set(requests.map((req) => req.method))],
  };

  // Load collection requests when component mounts or collection changes
  useEffect(() => {
    const loadData = async () => {
      try {
        await loadCollectionRequests(collection.id);
      } catch (error) {
        console.error("Failed to load collection requests:", error);
      }
    };

    loadData();
  }, [collection.id, loadCollectionRequests]);

  const handleCreateRequest = () => {
    addTab(undefined, collection.id);
  };

  const handleDeleteCollection = async () => {
    try {
      await deleteCollection(collection.id);
      success(`Collection "${collection.name}" deleted successfully!`);
    } catch (err) {
      console.error("Failed to delete collection:", err);
      error("Failed to delete collection. Please try again.");
    }
  };

  const handleRename = async () => {
    if (!editedName.trim() || editedName === collection.name) {
      setIsEditingName(false);
      setEditedName(collection.name);
      return;
    }

    try {
      await renameCollection(collection.id, editedName.trim());
      success("Collection renamed successfully!");
      setIsEditingName(false);
    } catch (err) {
      console.error("Failed to rename collection:", err);
      error("Failed to rename collection. Please try again.");
      setEditedName(collection.name);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRename();
    } else if (e.key === "Escape") {
      setIsEditingName(false);
      setEditedName(collection.name);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Unknown";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Folder className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                {isEditingName ? (
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onBlur={handleRename}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    className="text-xl font-semibold text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 border border-blue-500 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <h1
                    className="text-xl font-semibold text-gray-900 dark:text-gray-100 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    onClick={() => setIsEditingName(true)}
                    title="Click to rename"
                  >
                    {collection.name}
                  </h1>
                )}
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Collection Overview
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleCreateRequest}
                className="btn-primary flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>New Request</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoadingRequests ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
              <span className="text-gray-600 dark:text-gray-400">
                Loading collection data...
              </span>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <FileText className="h-8 w-8 text-green-500 dark:text-green-400" />
                  <div>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                      {stats.requests}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Requests
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <FolderOpen className="h-8 w-8 text-blue-500 dark:text-blue-400" />
                  <div>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                      {stats.collections}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Sub-collections
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <Hash className="h-8 w-8 text-purple-500 dark:text-purple-400" />
                  <div>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                      {stats.methods.length}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      HTTP Methods
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Collection Details */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Details
                </h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Created
                    </label>
                    <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(collection.created_at)}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Last Modified
                    </label>
                    <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(collection.updated_at)}</span>
                    </div>
                  </div>
                </div>

                {collection.auth && collection.auth.type !== "none" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Authentication
                    </label>
                    <div className="flex items-center space-x-2">
                      <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                        {collection.auth?.type}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* HTTP Methods Used */}
            {stats.methods.length > 0 && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    HTTP Methods Used
                  </h2>
                </div>
                <div className="p-6">
                  <div className="flex flex-wrap gap-2">
                    {stats.methods.map((method) => (
                      <HttpMethodBadge
                        key={method}
                        method={method}
                        size="md"
                        variant="default"
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Recent Requests */}
            {requests.length > 0 && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Requests
                  </h2>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {requests.slice(0, 10).map((request) => (
                    <div
                      key={request.id}
                      className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                      onClick={() => addTab(request)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <HttpMethodBadge
                            method={request.method}
                            size="sm"
                            variant="minimal"
                          />
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {request.name}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-md">
                              {request.url}
                            </p>
                          </div>
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          {formatDate(request.updated_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Child Collections */}
            {childCollections.length > 0 && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Sub-collections
                  </h2>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {childCollections.map((childCollection) => {
                    const childRequests =
                      collectionRequests[childCollection.id] || [];
                    return (
                      <div
                        key={childCollection.id}
                        className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <Folder className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {childCollection.name}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {childRequests.length} request(s)
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty State */}
            {requests.length === 0 && childCollections.length === 0 && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="px-6 py-12 text-center">
                  <Folder className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Empty Collection
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">
                    This collection doesn't have any requests or sub-collections
                    yet.
                  </p>
                  <button onClick={handleCreateRequest} className="btn-primary">
                    Create First Request
                  </button>
                </div>
              </div>
            )}

            {/* Danger Zone */}
            <div className="bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="px-6 py-4 border-b border-red-200 dark:border-red-800">
                <h2 className="text-lg font-semibold text-red-900 dark:text-red-400">
                  Danger Zone
                </h2>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Delete Collection
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Permanently delete this collection and all its requests.
                      This action cannot be undone.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="btn-danger flex items-center space-x-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 sm:mx-0 sm:h-10 sm:w-10">
                  <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">
                    Delete Collection
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Are you sure you want to delete "{collection.name}"? This
                      will permanently delete the collection and all its
                      requests. This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleDeleteCollection}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollectionInfo;
