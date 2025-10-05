import React from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardWidgetConfig } from '@/hooks/useDashboardCustomization';

interface DraggableWidgetsProps {
  widgets: Record<string, DashboardWidgetConfig>;
  onReorder: (widgets: Record<string, DashboardWidgetConfig>) => void;
  children: React.ReactNode[];
  enabled?: boolean;
}

/**
 * DraggableWidgets Component
 * 
 * Enables drag-and-drop reordering of dashboard widgets.
 * Uses react-beautiful-dnd for smooth drag interactions.
 * 
 * @param widgets - Current widget configuration
 * @param onReorder - Callback when widgets are reordered
 * @param children - Widget components to render
 * @param enabled - Whether drag-and-drop is enabled
 */
export const DraggableWidgets: React.FC<DraggableWidgetsProps> = ({
  widgets,
  onReorder,
  children,
  enabled = true,
}) => {
  const visibleWidgets = Object.values(widgets)
    .filter((w) => w.visible)
    .sort((a, b) => a.order - b.order);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || !enabled) return;

    const { source, destination } = result;
    if (source.index === destination.index) return;

    // Reorder visible widgets
    const reorderedWidgets = Array.from(visibleWidgets);
    const [removed] = reorderedWidgets.splice(source.index, 1);
    reorderedWidgets.splice(destination.index, 0, removed);

    // Update order property for all widgets
    const updatedWidgets = { ...widgets };
    reorderedWidgets.forEach((widget, index) => {
      updatedWidgets[widget.id] = {
        ...updatedWidgets[widget.id],
        order: index,
      };
    });

    onReorder(updatedWidgets);
  };

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="dashboard-widgets">
        {(provided, snapshot) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className={cn(
              'space-y-6',
              snapshot.isDraggingOver && 'bg-muted/20 rounded-lg'
            )}
          >
            {visibleWidgets.map((widget, index) => (
              <Draggable
                key={widget.id}
                draggableId={widget.id}
                index={index}
              >
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={cn(
                      'relative group',
                      snapshot.isDragging && 'opacity-50 shadow-2xl'
                    )}
                  >
                    {/* Drag Handle */}
                    <div
                      {...provided.dragHandleProps}
                      className={cn(
                        'absolute -left-8 top-4 opacity-0 group-hover:opacity-100 transition-opacity',
                        'cursor-grab active:cursor-grabbing',
                        'p-2 rounded-md hover:bg-muted'
                      )}
                      aria-label={`Drag to reorder ${widget.id}`}
                    >
                      <GripVertical className="h-5 w-5 text-muted-foreground" />
                    </div>

                    {/* Widget Content */}
                    {children[index]}
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};
