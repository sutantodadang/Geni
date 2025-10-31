import React, { useState, useEffect } from "react";
import { X, Shield, AlertTriangle } from "lucide-react";
import { Collection, AuthConfig, useAppStore } from "../store";
import AuthConfigComponent from "./AuthConfig";
import { useToast } from "../contexts/ToastContext";

interface CollectionAuthModalProps {
  collection: Collection;
  isOpen: boolean;
  onClose: () => void;
}

const CollectionAuthModal: React.FC<CollectionAuthModalProps> = ({
  collection,
  isOpen,
  onClose,
}) => {
  const { updateCollectionAuth, collections } = useAppStore();
  const { success, error } = useToast();

  const [authConfig, setAuthConfig] = useState<AuthConfig | undefined>(
    collection.auth
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setAuthConfig(collection.auth);
  }, [collection.auth]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await updateCollectionAuth(collection.id, authConfig);
      success("Authentication configuration updated successfully");
      onClose();
    } catch (err) {
      error("Failed to update authentication configuration");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setAuthConfig(collection.auth);
    onClose();
  };

  // Check if this collection has child collections
  const hasChildCollections = collections.some(c => c.parent_id === collection.id);

  // Check if parent collection has auth configured
  const parentCollection = collection.parent_id
    ? collections.find(c => c.id === collection.parent_id)
    : null;
  const parentHasAuth = parentCollection?.auth && parentCollection.auth.type !== "none";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Authentication Settings
            </h2>
          </div>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-1">
              Collection: {collection.name}
            </h3>
            <p className="text-sm text-gray-500">
              Configure authentication for this collection and its requests.
            </p>
          </div>

          {/* Parent auth inheritance info */}
          {parentHasAuth && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="text-blue-800 font-medium">Parent Authentication</p>
                  <p className="text-blue-700">
                    This collection will inherit authentication from "{parentCollection?.name}"
                    if no authentication is configured here.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Child collections info */}
          {hasChildCollections && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="text-amber-800 font-medium">Child Collections</p>
                  <p className="text-amber-700">
                    This authentication will be inherited by child collections that don't have their own authentication configured.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Auth Configuration */}
          <AuthConfigComponent
            auth={authConfig}
            onAuthChange={setAuthConfig}
            disabled={isLoading}
          />

          {/* How it works */}
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
            <h4 className="text-sm font-medium text-gray-800 mb-2">How it works:</h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• Authentication headers are automatically added to all requests in this collection</li>
              <li>• Child collections inherit authentication unless they have their own configuration</li>
              <li>• Request-specific headers will override collection authentication headers</li>
              <li>• Changes apply immediately to all requests in this collection</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={handleCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CollectionAuthModal;
