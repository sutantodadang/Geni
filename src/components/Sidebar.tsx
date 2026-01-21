import React, { useState } from "react";
import { useAppStore, type HttpRequest } from "../store";
import { DragStartEvent } from "@dnd-kit/core";
import {
  DragDropWrapper,
  SortableItem,
  SortableList,
  DroppableArea,
  createDragEndHandler,
  createDragData,
} from "./DragDropWrapper";
import { useToast } from "../contexts/ToastContext";
import EnvironmentManager from "./EnvironmentManager";
import CollectionAuthModal from "./CollectionAuthModal";
import HttpMethodBadge from "./HttpMethodBadge";
import EnvironmentSelector from "./EnvironmentSelector";
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
  Upload,
} from "lucide-react";

interface SidebarProps {}

const Sidebar: React.FC<SidebarProps> = () => {
  const {
    collections,
    environments,
    activeEnvironment,
    selectedCollectionId,
    sidebarCollapsed,
    setSidebarCollapsed,
    setSelectedCollection,
    setActiveTab,
    createCollection,
    deleteCollection,
    createEnvironment,
    setActiveEnvironment,
    addTab,
    loadCollectionRequests,
    getCollectionRequests,
    collectionRequestsLoading,
    deleteRequest,
    saveRequest,
    moveCollection,
    moveRequest,
    renameCollection,
    renameRequest,
    importPostmanCollection,
  } = useAppStore();

  const { success, error } = useToast();

  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(
    new Set()
  );
  const [showNewCollectionModal, setShowNewCollectionModal] = useState(false);
  const [showNewEnvironmentModal, setShowNewEnvironmentModal] = useState(false);
  const [showEnvironmentManager, setShowEnvironmentManager] = useState(false);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionDescription, setNewCollectionDescription] = useState("");
  const [newEnvironmentName, setNewEnvironmentName] = useState("");
  const [newEnvironmentVars, setNewEnvironmentVars] = useState<
    Array<{ key: string; value: string }>
  >([{ key: "", value: "" }]);
  const [showCollectionDropdown, setShowCollectionDropdown] = useState<
    string | null
  >(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedAuthCollection, setSelectedAuthCollection] = useState<
    string | null
  >(null);
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [newRequestName, setNewRequestName] = useState("");
  const [newRequestMethod, setNewRequestMethod] = useState("GET");
  const [newRequestUrl, setNewRequestUrl] = useState("https://");
  const [targetCollectionId, setTargetCollectionId] = useState<string>("");
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);
  const [renamingCollection, setRenamingCollection] = useState<string | null>(
    null
  );
  const [renamingRequest, setRenamingRequest] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const toggleCollection = (collectionId: string) => {
    const newExpanded = new Set(expandedCollections);
    if (newExpanded.has(collectionId)) {
      newExpanded.delete(collectionId);
    } else {
      newExpanded.add(collectionId);
      // Load requests when expanding a collection (only if not already loaded)
      const existingRequests = getCollectionRequests(collectionId);
      if (
        existingRequests.length === 0 &&
        !collectionRequestsLoading[collectionId]
      ) {
        loadCollectionRequests(collectionId);
      }
    }
    setExpandedCollections(newExpanded);
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;

    try {
      await createCollection(
        newCollectionName.trim(),
        newCollectionDescription.trim() || undefined,
        targetCollectionId || undefined
      );
      setNewCollectionName("");
      setNewCollectionDescription("");
      setTargetCollectionId("");
      setShowNewCollectionModal(false);
    } catch (error) {
      console.error("Failed to create collection:", error);
    }
  };

  const handleImportPostman = async () => {
    let jsonContent = importJson.trim();

    // If a file is selected, read its content
    if (importFile) {
      try {
        jsonContent = await importFile.text();
      } catch (err) {
        console.error("Failed to read file:", err);
        error("Failed to read the selected file.");
        return;
      }
    }

    if (!jsonContent) {
      error("Please paste JSON or select a file");
      return;
    }

    setIsImporting(true);
    try {
      const collection = await importPostmanCollection(jsonContent);
      success(`Collection "${collection.name}" imported successfully!`);
      setImportJson("");
      setImportFile(null);
      setShowImportModal(false);
    } catch (err) {
      console.error("Failed to import Postman collection:", err);
      error("Failed to import collection. Please check the JSON format.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.name.endsWith(".json")) {
        error("Please select a JSON file");
        return;
      }
      setImportFile(file);
      // Clear the textarea when a file is selected
      setImportJson("");
    }
  };

  const handleCreateEnvironment = async () => {
    if (!newEnvironmentName.trim()) return;

    const variables: Record<string, string> = {};
    newEnvironmentVars.forEach(({ key, value }) => {
      if (key.trim() && value.trim()) {
        variables[key.trim()] = value.trim();
      }
    });

    try {
      await createEnvironment(newEnvironmentName.trim(), variables);
      setNewEnvironmentName("");
      setNewEnvironmentVars([{ key: "", value: "" }]);
      setShowNewEnvironmentModal(false);
    } catch (error) {
      console.error("Failed to create environment:", error);
    }
  };

  const handleSelectCollection = async (collectionId: string) => {
    setSelectedCollection(collectionId);
    // Clear active tab to show collection info
    setActiveTab(null);
    // Load collection requests
    try {
      await loadCollectionRequests(collectionId);
    } catch (error) {
      console.error("Failed to load collection requests:", error);
    }
  };

  const handleCreateRequest = async () => {
    if (!newRequestName.trim()) return;

    try {
      // First save the request to get a proper ID
      const tempRequest = {
        name: newRequestName.trim(),
        method: newRequestMethod as any,
        url: newRequestUrl,
        headers: {},
        body: undefined,
        collection_id: targetCollectionId || undefined,
      };

      // Create the tab with the temp request
      addTab(tempRequest);

      // Get the newly created tab
      const state = useAppStore.getState();
      const newTab = state.tabs[state.tabs.length - 1];

      if (newTab && targetCollectionId) {
        console.log("🔄 Creating request in collection:", {
          tabId: newTab.id,
          requestName: newRequestName.trim(),
          collectionId: targetCollectionId,
          method: newRequestMethod,
        });

        // Save the request to the database and get the saved request with ID
        await saveRequest(newTab.id, newRequestName.trim(), targetCollectionId);

        console.log("✅ Request created successfully");

        // Reload the collection requests to show the new request
        await loadCollectionRequests(targetCollectionId);
      }

      setNewRequestName("");
      setNewRequestMethod("GET");
      setNewRequestUrl("https://");
      setTargetCollectionId("");
      setShowNewRequestModal(false);
      setShowCollectionDropdown(null);
    } catch (error) {
      console.error("❌ Failed to create request:", error);
      alert("Failed to create request. Please try again.");
    }
  };

  const handleShowNewRequest = (collectionId: string) => {
    setTargetCollectionId(collectionId);
    setNewRequestName("");
    setNewRequestMethod("GET");
    setNewRequestUrl("https://");
    setShowNewRequestModal(true);
    setShowCollectionDropdown(null);
  };

  const handleShowNewFolder = (parentCollectionId: string) => {
    // Create a new collection as a "folder" under the parent collection
    setTargetCollectionId(parentCollectionId);
    setShowNewCollectionModal(true);
    setShowCollectionDropdown(null);
  };

  const handleShowAuthConfig = (collectionId: string) => {
    setSelectedAuthCollection(collectionId);
    setShowAuthModal(true);
    setShowCollectionDropdown(null);
  };

  const handleLoadRequest = (request: HttpRequest) => {
    // Check if a tab with this request already exists
    const existingTab = useAppStore
      .getState()
      .tabs.find((tab) => tab.request.id === request.id);

    if (existingTab) {
      // Switch to existing tab
      useAppStore.getState().setActiveTab(existingTab.id);
    } else {
      // Create new tab with the request
      addTab(request);
    }
  };

  // Handle drag start for debugging
  const handleDragStart = (event: DragStartEvent) => {
    console.log("Drag started:", event);
    setActiveDragId(event.active.id as string);
  };

  // Handle drag over for visual feedback
  const handleDragOver = (event: any) => {
    if (event.over) {
      setDragOverTarget(event.over.id);
    } else {
      setDragOverTarget(null);
    }
  };

  // Create drag end handler using the utility function
  const handleDragEnd = createDragEndHandler(
    async (collectionId: string, newParentId: string | null) => {
      try {
        console.log("Moving collection:", collectionId, "to:", newParentId);
        await moveCollection(collectionId, newParentId || undefined);
        success("Collection moved successfully!");
      } catch (err) {
        console.error("Failed to move collection:", err);
        error("Failed to move collection. Please try again.");
      } finally {
        setDragOverTarget(null);
        setActiveDragId(null);
      }
    },
    async (requestId: string, newCollectionId: string) => {
      try {
        console.log(
          "Moving request:",
          requestId,
          "to collection:",
          newCollectionId,
          "Type:",
          typeof newCollectionId,
          "Length:",
          newCollectionId?.length
        );
        await moveRequest(requestId, newCollectionId);
        success("Request moved successfully!");
      } catch (err) {
        console.error("Failed to move request:", err);
        error("Failed to move request. Please try again.");
      } finally {
        setDragOverTarget(null);
        setActiveDragId(null);
      }
    }
  );

  // Handle delete with confirmation
  const handleDeleteCollection = async (
    collectionId: string,
    collectionName: string
  ) => {
    console.log("🗑️ handleDeleteCollection called", {
      collectionId,
      collectionName,
    });

    const performDeletion = async () => {
      try {
        console.log(
          "✅ User confirmed deletion, proceeding:",
          collectionId,
          collectionName
        );
        await deleteCollection(collectionId);
        console.log("✅ Collection deleted successfully:", collectionId);
        success(`"${collectionName}" deleted successfully!`);

        // Debug: Check if UI will update
        setTimeout(() => {
          const remainingCollections = collections.filter(
            (c) => c.id !== collectionId
          );
          console.log(
            `🔍 After deletion - ${remainingCollections.length} collections remaining`
          );
          const stillExists = collections.some((c) => c.id === collectionId);
          console.log(`🔍 Deleted collection still in store: ${stillExists}`);
        }, 100);

        // Clear selection if the deleted collection was selected
        if (selectedCollectionId === collectionId) {
          setSelectedCollection(null);
        }
      } catch (err) {
        console.error(
          "❌ Failed to delete collection:",
          err,
          "Collection ID:",
          collectionId
        );
        error(
          `Failed to delete collection "${collectionName}". Please try again.`
        );
      }
    };

    // Show custom confirmation dialog
    setConfirmDialog({
      show: true,
      title: "Delete Collection",
      message: `Delete "${collectionName}" and all its contents?\n\nThis will permanently delete:\n• The collection folder\n• All requests inside it\n• All subfolders and their contents\n\nThis action cannot be undone.`,
      onConfirm: () => {
        setConfirmDialog(null);
        performDeletion();
      },
      onCancel: () => {
        console.log("❌ User cancelled deletion");
        setConfirmDialog(null);
      },
    });
  };

  const handleDeleteRequest = async (
    requestId: string,
    collectionId: string,
    requestName: string
  ) => {
    console.log("🗑️ handleDeleteRequest called", {
      requestId,
      collectionId,
      requestName,
    });

    const performDeletion = async () => {
      try {
        console.log(
          "✅ User confirmed request deletion, proceeding:",
          requestId,
          requestName
        );
        await deleteRequest(requestId, collectionId);
        console.log("✅ Request deleted successfully:", requestId);
        success(`"${requestName}" deleted successfully!`);

        // Debug: Check if UI will update
        setTimeout(() => {
          const currentRequests = getCollectionRequests(collectionId);
          console.log(
            `🔍 After deletion - collection ${collectionId} now has ${currentRequests.length} requests`
          );
          const stillExists = currentRequests.some(
            (req) => req.id === requestId
          );
          console.log(`🔍 Deleted request still in store: ${stillExists}`);
        }, 100);
      } catch (err) {
        console.error("❌ Failed to delete request:", err);
        error("Failed to delete request. Please try again.");
      }
    };

    // Show custom confirmation dialog
    setConfirmDialog({
      show: true,
      title: "Delete Request",
      message: `Delete "${requestName}"?\n\nThis action cannot be undone.`,
      onConfirm: () => {
        setConfirmDialog(null);
        performDeletion();
      },
      onCancel: () => {
        console.log("❌ User cancelled request deletion");
        setConfirmDialog(null);
      },
    });
  };

  // Handle rename collection
  const handleRenameCollection = async (
    collectionId: string,
    newName: string
  ) => {
    try {
      await renameCollection(collectionId, newName);
      success("Collection renamed successfully");
    } catch (err) {
      console.error("Failed to rename collection:", err);
      error("Failed to rename collection");
    }
  };

  // Handle rename request
  const handleRenameRequest = async (requestId: string, newName: string) => {
    try {
      await renameRequest(requestId, newName);
      success("Request renamed successfully");
    } catch (err) {
      console.error("Failed to rename request:", err);
      error("Failed to rename request");
    }
  };

  // Start renaming collection
  const startRenamingCollection = (
    collectionId: string,
    currentName: string
  ) => {
    setRenamingCollection(collectionId);
    setRenameValue(currentName);
    setShowCollectionDropdown(null);
  };

  // Start renaming request
  const startRenamingRequest = (requestId: string, currentName: string) => {
    setRenamingRequest(requestId);
    setRenameValue(currentName);
  };

  // Handle rename submit
  const handleRenameSubmit = async () => {
    if (!renameValue.trim()) return;

    if (renamingCollection) {
      await handleRenameCollection(renamingCollection, renameValue.trim());
      setRenamingCollection(null);
    } else if (renamingRequest) {
      await handleRenameRequest(renamingRequest, renameValue.trim());
      setRenamingRequest(null);
    }
    setRenameValue("");
  };

  // Handle rename cancel
  const handleRenameCancel = () => {
    setRenamingCollection(null);
    setRenamingRequest(null);
    setRenameValue("");
  };

  // Get root collections (no parent)
  const getRootCollections = () => {
    return collections.filter((collection) => !collection.parent_id);
  };

  // Get child collections for a given parent
  const getChildCollections = (parentId: string) => {
    return collections.filter(
      (collection) => collection.parent_id === parentId
    );
  };

  // Render a single collection/folder item
  const renderCollectionItem = (
    collection: any,
    depth: number = 0,
    _index: number = 0
  ) => {
    // Skip rendering if collection doesn't have valid ID
    if (!collection.id) {
      console.warn("Skipping collection without ID:", collection);
      return null;
    }

    const isExpanded = expandedCollections.has(collection.id);
    const childCollections = getChildCollections(collection.id);
    const marginLeft = depth * 20; // 20px per level

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
              style={{
                marginLeft: `${marginLeft}px`,
              }}
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
              onClick={() => handleSelectCollection(collection.id)}
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
                  toggleCollection(collection.id);
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                }}
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
                  onBlur={handleRenameCancel}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleRenameSubmit();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      handleRenameCancel();
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 px-1 py-0.5 text-sm border border-blue-300 dark:border-blue-600 dark:bg-gray-700 dark:text-gray-100 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                  autoFocus
                />
              ) : (
                <span className="flex-1 truncate">{collection.name}</span>
              )}

              {/* Authentication indicator */}
              {collection.auth && collection.auth.type !== "none" && (
                <div title={`Authentication: ${collection.auth.type}`}>
                  <Shield className="h-3 w-3 ml-1 text-green-600" />
                </div>
              )}

              {/* Add button with dropdown */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCollectionDropdown(
                      showCollectionDropdown === collection.id
                        ? null
                        : collection.id
                    );
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                  }}
                  className="opacity-70 group-hover:opacity-100 p-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-all duration-200 mr-1"
                  title="Add to collection"
                >
                  <Plus className="h-3 w-3" />
                </button>

                {/* Dropdown menu */}
                {showCollectionDropdown === collection.id && (
                  <div className="absolute right-0 top-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50 min-w-[120px] animate-in fade-in-0 zoom-in-95 duration-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShowNewFolder(collection.id);
                        setShowCollectionDropdown(null);
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center"
                    >
                      <Folder className="h-3 w-3 mr-2" />
                      Add Folder
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShowNewRequest(collection.id);
                        setShowCollectionDropdown(null);
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center border-t border-gray-100 dark:border-gray-700"
                    >
                      <FileText className="h-3 w-3 mr-2" />
                      Add Request
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startRenamingCollection(collection.id, collection.name);
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center border-t border-gray-100 dark:border-gray-700"
                    >
                      <Edit className="h-3 w-3 mr-2" />
                      Rename
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShowAuthConfig(collection.id);
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
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
                  console.log("🖱️ Collection delete button clicked", {
                    collectionId: collection.id,
                    collectionName: collection.name,
                  });
                  e.stopPropagation();
                  e.preventDefault();
                  handleDeleteCollection(collection.id, collection.name);
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                }}
                className="opacity-70 group-hover:opacity-100 p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all duration-200"
                title="Delete collection"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </SortableItem>

        {/* Collection contents (requests and subfolders) - Outside of draggable */}
        {isExpanded && (
          <div className="mt-0.5">
            <div>
              {/* Child collections area */}
              <DroppableArea
                id={`${collection.id}-collections`}
                className={`min-h-[4px] transition-colors duration-200 ${
                  dragOverTarget === `${collection.id}-collections`
                    ? "bg-blue-50 dark:bg-blue-900/30 border-2 border-dashed border-blue-300 dark:border-blue-500 rounded-md"
                    : ""
                }`}
                data={{ type: "collection-area", collectionId: collection.id }}
              >
                <SortableList items={childCollections.map((c) => c.id)}>
                  {childCollections.map((child, childIndex) =>
                    renderCollectionItem(child, depth + 1, childIndex)
                  )}
                </SortableList>
              </DroppableArea>

              {/* Requests area */}
              <DroppableArea
                id={`${collection.id}-requests`}
                className={`min-h-[4px] transition-colors duration-200 ${
                  dragOverTarget === `${collection.id}-requests`
                    ? "bg-green-50 dark:bg-green-900/30 border-2 border-dashed border-green-300 dark:border-green-500 rounded-md"
                    : ""
                }`}
                data={{ type: "request-area", collectionId: collection.id }}
              >
                {collectionRequestsLoading[collection.id] ? (
                  <div
                    className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1"
                    style={{ marginLeft: `${marginLeft + 20}px` }}
                  >
                    Loading requests...
                  </div>
                ) : (
                  <>
                    <div>
                      <SortableList
                        items={getCollectionRequests(collection.id).map(
                          (r) => r.id!
                        )}
                      >
                        {getCollectionRequests(collection.id)
                          .filter((request) => request.id) // Only render requests with valid IDs
                          .map((request) => (
                            <SortableItem
                              id={request.id!}
                              key={request.id!}
                              data={createDragData("request", request.id!)}
                            >
                              {(dragHandleProps) => (
                                <div
                                  data-type="request"
                                  style={{ marginLeft: `${marginLeft + 20}px` }}
                                  className={`flex items-center px-2 py-1 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/70 rounded cursor-pointer group transition-all duration-200 ${
                                    dragOverTarget === request.id
                                      ? "bg-yellow-100 dark:bg-yellow-900/30 border-2 border-dashed border-yellow-400 dark:border-yellow-500 rounded-md"
                                      : ""
                                  } ${
                                    activeDragId === request.id
                                      ? "opacity-30 transform scale-95 shadow-md"
                                      : ""
                                  }`}
                                  onClick={() => handleLoadRequest(request)}
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
                                      onChange={(e) =>
                                        setRenameValue(e.target.value)
                                      }
                                      onBlur={handleRenameCancel}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          handleRenameSubmit();
                                        } else if (e.key === "Escape") {
                                          e.preventDefault();
                                          handleRenameCancel();
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
                                    onPointerDown={(e) => {
                                      e.stopPropagation();
                                    }}
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                    }}
                                    className="opacity-70 group-hover:opacity-100 p-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-all duration-200 mr-1"
                                    title="Rename request"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      startRenamingRequest(
                                        request.id!,
                                        request.name
                                      );
                                    }}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </button>
                                  <button
                                    onPointerDown={(e) => {
                                      e.stopPropagation();
                                    }}
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      handleDeleteRequest(
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
                    </div>
                    {getCollectionRequests(collection.id).length === 0 && (
                      <div
                        className="text-xs text-gray-400 dark:text-gray-500 px-2 py-1 italic"
                        style={{ marginLeft: `${marginLeft + 20}px` }}
                      >
                        No requests in this collection
                      </div>
                    )}
                  </>
                )}
              </DroppableArea>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render the entire collection tree
  const renderCollectionTree = () => {
    const rootCollections = getRootCollections();
    return (
      <DragDropWrapper
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
      >
        <DroppableArea
          id="root"
          className={`min-h-[32px] transition-colors duration-200 ${
            dragOverTarget === "root"
              ? "bg-blue-50 dark:bg-blue-900/30 border-2 border-dashed border-blue-300 dark:border-blue-500 rounded-md"
              : ""
          }`}
          data={{ type: "root-area", collectionId: "root" }}
        >
          <SortableList items={rootCollections.map((c) => c.id)}>
            {rootCollections.map((collection, index) =>
              renderCollectionItem(collection, 0, index)
            )}
          </SortableList>
        </DroppableArea>
      </DragDropWrapper>
    );
  };

  const addEnvironmentVar = () => {
    setNewEnvironmentVars([...newEnvironmentVars, { key: "", value: "" }]);
  };

  const updateEnvironmentVar = (
    index: number,
    field: "key" | "value",
    value: string
  ) => {
    const updated = [...newEnvironmentVars];
    updated[index][field] = value;
    setNewEnvironmentVars(updated);
  };

  const removeEnvironmentVar = (index: number) => {
    if (newEnvironmentVars.length > 1) {
      setNewEnvironmentVars(newEnvironmentVars.filter((_, i) => i !== index));
    }
  };

  if (sidebarCollapsed) {
    return (
      <div className="w-12 sidebar flex flex-col items-center py-4 space-y-4 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
          title="Expand sidebar"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <button
          onClick={() => addTab()}
          className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
          title="New request"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 sidebar flex flex-col bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <div className="h-4 w-4 flex items-center justify-center">
              <div className="h-2 w-2 bg-blue-500 dark:bg-blue-400 rounded-full"></div>
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Workspace
            </span>
          </div>
          <button
            onClick={() => setSidebarCollapsed(true)}
            className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Collapse sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <button
          onClick={() => addTab()}
          className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <Plus className="h-4 w-4" />
          <span>New Request</span>
        </button>
      </div>

      {/* Environment Selector */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <EnvironmentSelector
          activeEnvironment={activeEnvironment}
          environments={environments}
          onChange={(envId) => setActiveEnvironment(envId)}
          onManageEnvironments={() => setShowEnvironmentManager(true)}
          onNewEnvironment={() => setShowNewEnvironmentModal(true)}
        />
      </div>

      {/* Collections */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="px-3 py-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Folder className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Collections
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setShowImportModal(true)}
                className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                title="Import Postman collection"
              >
                <Upload className="h-3 w-3" />
              </button>
              <button
                onClick={() => setShowNewCollectionModal(true)}
                className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                title="New collection"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div>
            {renderCollectionTree()}

            {collections.length === 0 && (
              <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                No collections yet.
                <br />
                Create one to organize your requests.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Collection Modal */}
      {showNewCollectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-lg mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
              {targetCollectionId ? "New Folder" : "New Collection"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  className="w-full form-input"
                  placeholder="My API Collection"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newCollectionDescription}
                  onChange={(e) => setNewCollectionDescription(e.target.value)}
                  className="w-full form-input"
                  rows={3}
                  placeholder="Optional description..."
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowNewCollectionModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCollection}
                disabled={!newCollectionName.trim()}
                className="btn-primary"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Environment Modal */}
      {showNewEnvironmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
              New Environment
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={newEnvironmentName}
                  onChange={(e) => setNewEnvironmentName(e.target.value)}
                  className="w-full form-input"
                  placeholder="Development"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Variables
                </label>
                <div className="space-y-2">
                  {newEnvironmentVars.map((envVar, index) => (
                    <div key={index} className="flex space-x-2">
                      <input
                        type="text"
                        value={envVar.key}
                        onChange={(e) =>
                          updateEnvironmentVar(index, "key", e.target.value)
                        }
                        className="flex-1 form-input text-sm"
                        placeholder="base_url"
                      />
                      <input
                        type="text"
                        value={envVar.value}
                        onChange={(e) =>
                          updateEnvironmentVar(index, "value", e.target.value)
                        }
                        className="flex-1 form-input text-sm"
                        placeholder="https://api.example.com"
                      />
                      {newEnvironmentVars.length > 1 && (
                        <button
                          onClick={() => removeEnvironmentVar(index)}
                          className="text-red-600 hover:text-red-800 p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={addEnvironmentVar}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Variable
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowNewEnvironmentModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateEnvironment}
                disabled={!newEnvironmentName.trim()}
                className="btn-primary"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Request Modal */}
      {showNewRequestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-lg mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
              New Request
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Request Name *
                </label>
                <input
                  type="text"
                  value={newRequestName}
                  onChange={(e) => setNewRequestName(e.target.value)}
                  className="w-full form-input"
                  placeholder="My API Request"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Method
                </label>
                <select
                  value={newRequestMethod}
                  onChange={(e) => setNewRequestMethod(e.target.value)}
                  className="w-full form-input"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                  <option value="PATCH">PATCH</option>
                  <option value="HEAD">HEAD</option>
                  <option value="OPTIONS">OPTIONS</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL
                </label>
                <input
                  type="text"
                  value={newRequestUrl}
                  onChange={(e) => setNewRequestUrl(e.target.value)}
                  className="w-full form-input"
                  placeholder="https://api.example.com/endpoint"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowNewRequestModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRequest}
                disabled={!newRequestName.trim()}
                className="btn-primary"
              >
                Create Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside handler for dropdown */}
      {showCollectionDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowCollectionDropdown(null)}
        />
      )}

      {/* Custom Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-lg mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-red-600 dark:text-red-400">
              {confirmDialog.title}
            </h3>
            <div className="mb-6">
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
                {confirmDialog.message}
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={confirmDialog.onCancel}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded border"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Environment Manager Modal */}
      {showEnvironmentManager && (
        <EnvironmentManager onClose={() => setShowEnvironmentManager(false)} />
      )}

      {/* Collection Authentication Modal */}
      {showAuthModal && selectedAuthCollection && (
        <CollectionAuthModal
          collection={collections.find((c) => c.id === selectedAuthCollection)!}
          isOpen={showAuthModal}
          onClose={() => {
            setShowAuthModal(false);
            setSelectedAuthCollection(null);
          }}
        />
      )}

      {/* Import Postman Collection Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-[600px] max-w-[90vw] mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Import Postman Collection
            </h3>
            <div className="space-y-4">
              {/* File Upload Option */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select JSON File
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="postman-file-input"
                    disabled={isImporting}
                  />
                  <label
                    htmlFor="postman-file-input"
                    className="flex-1 cursor-pointer px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-400 dark:hover:border-blue-500 transition-colors text-center"
                  >
                    {importFile ? (
                      <div className="flex items-center justify-center space-x-2">
                        <FileText className="h-5 w-5 text-blue-500" />
                        <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                          {importFile.name}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center space-y-1">
                        <Upload className="h-6 w-6 text-gray-400" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Click to select a JSON file
                        </span>
                      </div>
                    )}
                  </label>
                  {importFile && (
                    <button
                      onClick={() => setImportFile(null)}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      title="Remove file"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                    OR
                  </span>
                </div>
              </div>

              {/* Paste JSON Option */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Paste Postman Collection JSON (v2.1 format)
                </label>
                <textarea
                  value={importJson}
                  onChange={(e) => {
                    setImportJson(e.target.value);
                    // Clear file selection when typing
                    if (e.target.value && importFile) {
                      setImportFile(null);
                    }
                  }}
                  className="w-full form-input font-mono text-sm"
                  rows={10}
                  placeholder='{"info": {"name": "My Collection"}, "item": [...]}'
                  disabled={isImporting || !!importFile}
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Export your collection from Postman as JSON (v2.1) and paste
                  it here, or select a JSON file above.
                </p>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportJson("");
                  setImportFile(null);
                }}
                className="btn-secondary"
                disabled={isImporting}
              >
                Cancel
              </button>
              <button
                onClick={handleImportPostman}
                disabled={(!importJson.trim() && !importFile) || isImporting}
                className="btn-primary flex items-center space-x-2"
              >
                {isImporting ? (
                  <>
                    <Upload className="h-4 w-4 animate-pulse" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    <span>Import</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
