import React from "react";
import { useAppStore, type Collection } from "../store";
import { ChevronRight, Home, Folder } from "lucide-react";
import HttpMethodBadge from "./HttpMethodBadge";

interface BreadcrumbProps {
  currentCollection?: string | null;
  requestName?: string;
  requestMethod?: string;
  className?: string;
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({
  currentCollection,
  requestName,
  requestMethod,
  className = "",
}) => {
  const { collections, setSelectedCollection } = useAppStore();

  // Function to get collection by ID
  const getCollection = (id: string): Collection | undefined => {
    return collections.find((col) => col.id === id);
  };

  // Function to build the collection path from root to current
  const buildCollectionPath = (collectionId: string): Collection[] => {
    const path: Collection[] = [];
    let current = getCollection(collectionId);

    while (current) {
      path.unshift(current);
      if (current.parent_id) {
        current = getCollection(current.parent_id);
      } else {
        break;
      }
    }

    return path;
  };

  // Build the breadcrumb items
  const breadcrumbItems: Array<{
    id: string;
    name: string;
    type: "root" | "collection" | "request";
    clickable: boolean;
  }> = [];

  // Always start with root
  breadcrumbItems.push({
    id: "root",
    name: "Collections",
    type: "root",
    clickable: true,
  });

  // Add collection path if we have a current collection
  if (currentCollection) {
    const collectionPath = buildCollectionPath(currentCollection);
    collectionPath.forEach((collection) => {
      breadcrumbItems.push({
        id: collection.id,
        name: collection.name,
        type: "collection",
        clickable: true,
      });
    });
  }

  // Add request name if provided (even if no collection)
  if (requestName) {
    const requestDisplayName = requestMethod
      ? `${requestMethod} ${requestName}`
      : requestName;

    breadcrumbItems.push({
      id: "current-request",
      name: requestDisplayName,
      type: "request",
      clickable: false,
    });
  }

  const handleBreadcrumbClick = (item: (typeof breadcrumbItems)[0]) => {
    if (!item.clickable) return;

    if (item.type === "root") {
      setSelectedCollection(null);
    } else if (item.type === "collection") {
      setSelectedCollection(item.id);
    }
  };

  // Don't render if there are no meaningful items
  if (breadcrumbItems.length <= 1 && !requestName) {
    return null;
  }

  return (
    <nav
      className={`flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400 overflow-hidden ${className}`}
      aria-label="Breadcrumb"
    >
      {breadcrumbItems.map((item, index) => (
        <React.Fragment key={item.id}>
          {index > 0 && (
            <ChevronRight className="h-3 w-3 text-gray-400 dark:text-gray-500 mx-1 flex-shrink-0" />
          )}

          <div className="flex items-center min-w-0">
            {/* Icon */}
            {item.type === "root" && (
              <Home className="h-3 w-3 mr-1 flex-shrink-0 text-gray-500 dark:text-gray-400" />
            )}
            {item.type === "collection" && (
              <Folder className="h-3 w-3 mr-1 flex-shrink-0 text-blue-500 dark:text-blue-400" />
            )}

            {/* Text */}
            {item.clickable ? (
              <button
                onClick={() => handleBreadcrumbClick(item)}
                className={`hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-150 truncate text-left ${
                  index === breadcrumbItems.length - 1 &&
                  item.type !== "request"
                    ? "font-medium text-gray-900 dark:text-gray-100 max-w-[200px]"
                    : "text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 max-w-[120px]"
                }`}
                title={`Navigate to ${item.name}`}
              >
                {item.name}
              </button>
            ) : (
              <span
                className={`truncate ${
                  item.type === "request"
                    ? "font-semibold text-blue-900 dark:text-blue-100 max-w-[250px]"
                    : "text-gray-600 dark:text-gray-400 max-w-[150px]"
                }`}
                title={item.name}
              >
                {item.type === "request" && requestMethod ? (
                  <>
                    <HttpMethodBadge
                      method={requestMethod}
                      size="sm"
                      variant="minimal"
                      className="mr-2"
                    />
                    {requestName}
                  </>
                ) : (
                  item.name
                )}
              </span>
            )}
          </div>
        </React.Fragment>
      ))}
    </nav>
  );
};

export default Breadcrumb;
