import React from "react";
import { useAppStore, type Collection, type HttpRequest } from "../store";
import {
  SortableItem,
  SortableList,
  DroppableArea,
  createDragData,
} from "./DragDropWrapper";
import HttpMethodBadge from "./HttpMethodBadge";
import {
  Folder,
  FolderOpen,
  Plus,
  ChevronRight,
  ChevronDown,
  Trash2,
  FileText,
  GripVertical,
  Shield,
  Edit,
} from "lucide-react";

interface CollectionItemProps {
  collection: Collection;
  depth: number;
  isExpanded: boolean;
  childCollections: Collection[];
  expandedCollections: Set<string>;
  dragOverTarget: string | null;
  activeDragId: string | null;
  showCollectionDropdown: string | null;
  renamingCollection: string | null;
  renamingRequest: string | null;
  renameValue: string;
  onToggle: (collectionId: string) => void;
  onSelect: (collectionId: string) => void;
  onShowDropdown: (collectionId: string | null) => void;
  onShowNewFolder: (collectionId: string) => void;
  onShowNewRequest: (collectionId: string) => void;
  onShowAuthConfig: (collectionId: string) => void;
  onStartRenaming: (collectionId: string, name: string) => void;
  onDelete: (collectionId: string, name: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  setRenameValue: (value: string) => void;
  onLoadRequest: (request: HttpRequest) => void;
  onDeleteRequest: (
    requestId: string,
    collectionId: string,
    name: string
  ) => void;
  onStartRenamingRequest: (requestId: string, name: string) => void;
  selectedCollectionId: string | null;
  allCollections: Collection[];
}

const CollectionItem: React.FC<CollectionItemProps> = ({
  collection,
  depth,
  isExpanded,
  childCollections,
  expandedCollections,
  dragOverTarget,
  activeDragId,
  showCollectionDropdown,
  renamingCollection,
  renamingRequest,
  renameValue,
  onToggle,
  onSelect,
  onShowDropdown,
  onShowNewFolder,
  onShowNewRequest,
  onShowAuthConfig,
  onStartRenaming,
  onDelete,
  onRenameSubmit,
  onRenameCancel,
  setRenameValue,
  onLoadRequest,
  onDeleteRequest,
  onStartRenamingRequest,
  selectedCollectionId,
  allCollections,
}) => {
  const { collectionRequestsLoading, getCollectionRequests } = useAppStore();
  const marginLeft = depth * 16;

  if (!collection.id) {
    console.warn("Skipping collection without ID:", collection);
    return null;
  }

  return (
    <div>
      <SortableItem
        id={collection.id}
        key={collection.id}
        data={createDragData("collection", collection.id)}
      >
        {(dragHandleProps) => (
          <div
            data-type="collection"
            style={{ marginLeft: `${marginLeft}px` }}
            className={`collection-item group cursor-pointer transition-all duration-200 ${
              selectedCollectionId === collection.id ? "active" : ""
            } ${
              dragOverTarget === collection.id
                ? "bg-blue-100 dark:bg-blue-900/30 border-2 border-dashed border-blue-400 dark:border-blue-500 rounded-md"
                : ""
            } ${
              activeDragId === collection.id
                ? "opacity-50 transform scale-95 shadow-lg"
                : ""
            }`}
            onClick={() => onSelect(collection.id)}
          >
            <div
              className="flex items-center mr-2 cursor-grab"
              data-drag-handle="true"
              {...dragHandleProps}
            >
              <GripVertical className="h-3 w-3 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100" />
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle(collection.id);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="mr-1.5 flex-shrink-0"
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
              )}
            </button>
            {isExpanded ? (
              <FolderOpen className="h-4 w-4 mr-2 text-blue-500 dark:text-blue-400 flex-shrink-0" />
            ) : (
              <Folder className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400 flex-shrink-0" />
            )}
            {renamingCollection === collection.id ? (
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={onRenameCancel}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onRenameSubmit();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    onRenameCancel();
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 px-1 py-0.5 text-sm border border-blue-300 dark:border-blue-600 dark:bg-gray-700 dark:text-gray-100 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                autoFocus
              />
            ) : (
              <span className="flex-1 truncate">{collection.name}</span>
            )}

            {collection.auth && collection.auth.type !== "none" && (
              <div title={`Authentication: ${collection.auth.type}`}>
                <Shield className="h-3 w-3 ml-1 text-green-600" />
              </div>
            )}

            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onShowDropdown(
                    showCollectionDropdown === collection.id
                      ? null
                      : collection.id
                  );
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="opacity-70 group-hover:opacity-100 p-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-all duration-200 mr-1"
                title="Add to collection"
              >
                <Plus className="h-3 w-3" />
              </button>

              {showCollectionDropdown === collection.id && (
                <div className="absolute right-0 top-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50 min-w-[120px] animate-in fade-in-0 zoom-in-95 duration-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onShowNewFolder(collection.id);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center"
                  >
                    <Folder className="h-3 w-3 mr-2" />
                    Add Folder
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onShowNewRequest(collection.id);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center border-t border-gray-100 dark:border-gray-700"
                  >
                    <FileText className="h-3 w-3 mr-2" />
                    Add Request
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartRenaming(collection.id, collection.name);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center border-t border-gray-100 dark:border-gray-700"
                  >
                    <Edit className="h-3 w-3 mr-2" />
                    Rename
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onShowAuthConfig(collection.id);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center border-t border-gray-100 dark:border-gray-700"
                  >
                    <Shield className="h-3 w-3 mr-2" />
                    Authentication
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onDelete(collection.id, collection.name);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="opacity-70 group-hover:opacity-100 p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all duration-200"
              title="Delete collection"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </SortableItem>

      {isExpanded && (
        <div className="mt-0.5">
          <DroppableArea
            id={`${collection.id}-collections`}
            className={`min-h-[20px] transition-colors duration-200 ${
              dragOverTarget === `${collection.id}-collections`
                ? "bg-blue-50 dark:bg-blue-900/30 border-2 border-dashed border-blue-300 dark:border-blue-500 rounded-md"
                : ""
            }`}
            data={{ type: "collection-area", collectionId: collection.id }}
          >
            <SortableList items={childCollections.map((c) => c.id)}>
              {childCollections.map((child) => (
                <CollectionItem
                  key={child.id}
                  collection={child}
                  depth={depth + 1}
                  isExpanded={expandedCollections.has(child.id)}
                  childCollections={allCollections.filter(
                    (c) => c.parent_id === child.id
                  )}
                  expandedCollections={expandedCollections}
                  dragOverTarget={dragOverTarget}
                  activeDragId={activeDragId}
                  showCollectionDropdown={showCollectionDropdown}
                  renamingCollection={renamingCollection}
                  renamingRequest={renamingRequest}
                  renameValue={renameValue}
                  onToggle={onToggle}
                  onSelect={onSelect}
                  onShowDropdown={onShowDropdown}
                  onShowNewFolder={onShowNewFolder}
                  onShowNewRequest={onShowNewRequest}
                  onShowAuthConfig={onShowAuthConfig}
                  onStartRenaming={onStartRenaming}
                  onDelete={onDelete}
                  onRenameSubmit={onRenameSubmit}
                  onRenameCancel={onRenameCancel}
                  setRenameValue={setRenameValue}
                  onLoadRequest={onLoadRequest}
                  onDeleteRequest={onDeleteRequest}
                  onStartRenamingRequest={onStartRenamingRequest}
                  selectedCollectionId={selectedCollectionId}
                  allCollections={allCollections}
                />
              ))}
            </SortableList>
          </DroppableArea>

          <DroppableArea
            id={`${collection.id}-requests`}
            className={`min-h-[8px] transition-colors duration-200 ${
              dragOverTarget === `${collection.id}-requests`
                ? "bg-green-50 dark:bg-green-900/30 border-2 border-dashed border-green-300 dark:border-green-500 rounded-md"
                : ""
            }`}
            data={{ type: "request-area", collectionId: collection.id }}
          >
            {collectionRequestsLoading[collection.id] ? (
              <div
                className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1"
                style={{ marginLeft: `${marginLeft + 8}px` }}
              >
                Loading requests...
              </div>
            ) : (
              <>
                <SortableList
                  items={getCollectionRequests(collection.id).map((r) => r.id!)}
                >
                  {getCollectionRequests(collection.id)
                    .filter((request) => request.id)
                    .map((request) => (
                      <SortableItem
                        id={request.id!}
                        key={request.id!}
                        data={createDragData("request", request.id!)}
                      >
                        {(dragHandleProps) => (
                          <div
                            data-type="request"
                            style={{ marginLeft: `${marginLeft + 8}px` }}
                            className={`flex items-center px-2 py-1 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/70 rounded cursor-pointer group transition-all duration-200 ${
                              dragOverTarget === request.id
                                ? "bg-yellow-100 dark:bg-yellow-900/30 border-2 border-dashed border-yellow-400 dark:border-yellow-500 rounded-md"
                                : ""
                            } ${
                              activeDragId === request.id
                                ? "opacity-30 transform scale-95 shadow-md"
                                : ""
                            }`}
                            onClick={() => onLoadRequest(request)}
                          >
                            <div
                              className="flex items-center mr-1.5 cursor-grab"
                              data-drag-handle="true"
                              {...dragHandleProps}
                            >
                              <GripVertical className="h-3 w-3 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100" />
                            </div>
                            <FileText className="h-3.5 w-3.5 mr-2 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                            {renamingRequest === request.id ? (
                              <input
                                type="text"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onBlur={onRenameCancel}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    onRenameSubmit();
                                  } else if (e.key === "Escape") {
                                    e.preventDefault();
                                    onRenameCancel();
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="flex-1 px-1 py-0.5 text-sm border border-blue-300 dark:border-blue-600 dark:bg-gray-700 dark:text-gray-100 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                                autoFocus
                              />
                            ) : (
                              <span className="flex-1 truncate">
                                {request.name}
                              </span>
                            )}
                            <HttpMethodBadge
                              method={request.method}
                              size="sm"
                              variant="minimal"
                              className="ml-2"
                            />
                            <button
                              onPointerDown={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="opacity-70 group-hover:opacity-100 p-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-all duration-200 mr-1"
                              title="Rename request"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                onStartRenamingRequest(
                                  request.id!,
                                  request.name
                                );
                              }}
                            >
                              <Edit className="h-3 w-3" />
                            </button>
                            <button
                              onPointerDown={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                onDeleteRequest(
                                  request.id!,
                                  collection.id,
                                  request.name
                                );
                              }}
                              className="opacity-70 group-hover:opacity-100 p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all duration-200"
                              title="Delete request"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </SortableItem>
                    ))}
                </SortableList>
                {getCollectionRequests(collection.id).length === 0 && (
                  <div
                    className="text-xs text-gray-400 dark:text-gray-500 px-2 py-1 italic"
                    style={{ marginLeft: `${marginLeft + 8}px` }}
                  >
                    No requests in this collection
                  </div>
                )}
              </>
            )}
          </DroppableArea>
        </div>
      )}
    </div>
  );
};

export default CollectionItem;
