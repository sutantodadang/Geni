import React from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface DragDropContextProps {
  children: React.ReactNode;
  onDragStart?: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragOver?: (event: DragOverEvent) => void;
}

export const DragDropWrapper: React.FC<DragDropContextProps> = ({
  children,
  onDragStart,
  onDragEnd,
  onDragOver,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 12,
        delay: 150,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
    >
      {children}
      <DragOverlay />
    </DndContext>
  );
};

interface SortableItemProps {
  id: string;
  children: (dragHandleProps: any) => React.ReactNode;
  disabled?: boolean;
  data?: any;
}

export const SortableItem: React.FC<SortableItemProps> = ({
  id,
  children,
  disabled = false,
  data,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled,
    data,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Provide drag handle props to children
  const dragHandleProps = {
    ...attributes,
    ...listeners,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children(dragHandleProps)}
    </div>
  );
};

interface SortableListProps {
  items: string[];
  children: React.ReactNode;
  strategy?: any;
}

export const SortableList: React.FC<SortableListProps> = ({
  items,
  children,
  strategy = verticalListSortingStrategy,
}) => {
  return (
    <SortableContext items={items} strategy={strategy}>
      {children}
    </SortableContext>
  );
};

interface DroppableProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  data?: any;
}

export const DroppableArea: React.FC<DroppableProps> = ({
  id,
  children,
  className = "",
  data,
}) => {
  const { setNodeRef } = useDroppable({
    id,
    data,
  });

  return (
    <div ref={setNodeRef} data-droppable-id={id} className={className}>
      {children}
    </div>
  );
};

// Utility functions to help with migration from react-beautiful-dnd
export const createDragEndHandler = (
  onCollectionMove?: (id: string, newParentId: string | null) => Promise<void>,
  onRequestMove?: (id: string, newCollectionId: string) => Promise<void>,
) => {
  return async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;
    const activeType = active.data.current?.type as string;
    const overType = over.data.current?.type as string;

    console.log("Drag event:", { activeId, overId, activeType, overType });

    // Validate UUIDs
    const isValidUUID = (str: string) => {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str) || str === "root";
    };

    if (!isValidUUID(activeId)) {
      console.error("Invalid active ID (not a UUID):", activeId);
      return;
    }

    try {
      if (activeType === "collection" && onCollectionMove) {
        // Moving collection to another collection or root
        let newParentId = null;

        if (overType === "collection" && isValidUUID(overId)) {
          newParentId = overId;
        } else if (
          over.data.current?.collectionId &&
          isValidUUID(over.data.current.collectionId)
        ) {
          newParentId = over.data.current.collectionId;
        }

        console.log("Moving collection:", {
          activeId,
          newParentId,
          overId,
        });

        await onCollectionMove(activeId, newParentId);
      } else if (activeType === "request" && onRequestMove) {
        // Moving request to a collection
        let targetCollectionId = "root"; // Default to root

        // Check if we have collection data in the over element
        if (over.data.current?.collectionId) {
          const collId = over.data.current.collectionId;
          if (isValidUUID(collId)) {
            targetCollectionId = collId;
          }
        } else if (overType === "collection" && isValidUUID(overId)) {
          targetCollectionId = overId;
        } else if (overId === "root") {
          targetCollectionId = "root";
        }

        console.log("Moving request to collection:", {
          activeId,
          overId,
          targetCollectionId,
          overData: over.data.current,
        });

        if (!isValidUUID(targetCollectionId)) {
          console.error("Invalid target collection ID:", targetCollectionId);
          return;
        }

        await onRequestMove(activeId, targetCollectionId);
      }
    } catch (error) {
      console.error("Error in drag operation:", error);
      throw error; // Re-throw so the calling component can handle it
    }
  };
};

// Helper to create drag data
export const createDragData = (type: "collection" | "request", id: string) => ({
  type,
  id,
});

export default DragDropWrapper;
