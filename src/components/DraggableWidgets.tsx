import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Package, 
  ShoppingCart, 
  FileText, 
  RotateCcw, 
  CreditCard, 
  TrendingUp, 
  MapPin, 
  Bot, 
  Users, 
  Building2, 
  Settings,
  BarChart3,
  Calendar,
  Mail,
  Database,
  Truck,
  Calculator,
  Archive,
  Bell,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Widget {
  id: string;
  title: string;
  icon: React.ElementType;
  color: string;
  onClick: () => void;
}

interface DraggableWidgetsProps {
  onNavigate: (view: string) => void;
}

export const DraggableWidgets: React.FC<DraggableWidgetsProps> = ({ onNavigate }) => {
  const createWidgets = (): Widget[] => [
    { id: 'dashboard', title: 'Dashboard', icon: BarChart3, color: 'bg-blue-500/10 text-blue-600', onClick: () => onNavigate('dashboard') },
    { id: 'inventory', title: 'Inventory', icon: Package, color: 'bg-green-500/10 text-green-600', onClick: () => onNavigate('inventory') },
    { id: 'purchase', title: 'Purchase', icon: ShoppingCart, color: 'bg-purple-500/10 text-purple-600', onClick: () => onNavigate('purchase') },
    { id: 'sales', title: 'Sales', icon: FileText, color: 'bg-orange-500/10 text-orange-600', onClick: () => onNavigate('sales') },
    { id: 'returns', title: 'Returns', icon: RotateCcw, color: 'bg-red-500/10 text-red-600', onClick: () => onNavigate('returns') },
    { id: 'payments', title: 'Payments', icon: CreditCard, color: 'bg-emerald-500/10 text-emerald-600', onClick: () => onNavigate('payments') },
    { id: 'reports', title: 'Reports', icon: TrendingUp, color: 'bg-indigo-500/10 text-indigo-600', onClick: () => onNavigate('reports') },
    { id: 'tracking', title: 'Track & Trace', icon: MapPin, color: 'bg-cyan-500/10 text-cyan-600', onClick: () => onNavigate('tracking') },
    { id: 'ai', title: 'AI Assistant', icon: Bot, color: 'bg-pink-500/10 text-pink-600', onClick: () => onNavigate('ai') },
    { id: 'users', title: 'Team Management', icon: Users, color: 'bg-amber-500/10 text-amber-600', onClick: () => onNavigate('users') },
    { id: 'profile', title: 'Company Profile', icon: Building2, color: 'bg-slate-500/10 text-slate-600', onClick: () => onNavigate('profile') },
    { id: 'settings', title: 'Settings', icon: Settings, color: 'bg-gray-500/10 text-gray-600', onClick: () => onNavigate('settings') },
    { id: 'calendar', title: 'Calendar', icon: Calendar, color: 'bg-violet-500/10 text-violet-600', onClick: () => console.log('Calendar clicked') },
    { id: 'mail', title: 'Mail', icon: Mail, color: 'bg-rose-500/10 text-rose-600', onClick: () => console.log('Mail clicked') },
    { id: 'database', title: 'Database', icon: Database, color: 'bg-teal-500/10 text-teal-600', onClick: () => console.log('Database clicked') },
    { id: 'logistics', title: 'Logistics', icon: Truck, color: 'bg-lime-500/10 text-lime-600', onClick: () => console.log('Logistics clicked') },
    { id: 'calculator', title: 'Calculator', icon: Calculator, color: 'bg-sky-500/10 text-sky-600', onClick: () => console.log('Calculator clicked') },
    { id: 'archive', title: 'Archive', icon: Archive, color: 'bg-stone-500/10 text-stone-600', onClick: () => console.log('Archive clicked') },
    { id: 'notifications', title: 'Notifications', icon: Bell, color: 'bg-yellow-500/10 text-yellow-600', onClick: () => console.log('Notifications clicked') },
    { id: 'timesheet', title: 'Timesheet', icon: Clock, color: 'bg-fuchsia-500/10 text-fuchsia-600', onClick: () => console.log('Timesheet clicked') },
  ];

  const [widgets, setWidgets] = useState<Widget[]>(createWidgets());
  const [isDragDisabled, setIsDragDisabled] = useState(false);

  // Load saved order from localStorage on mount
  useEffect(() => {
    const savedOrder = localStorage.getItem('dashboard-widget-order');
    if (savedOrder) {
      try {
        const orderIds = JSON.parse(savedOrder);
        const allWidgets = createWidgets();
        const reorderedWidgets = orderIds.map((id: string) => 
          allWidgets.find(widget => widget.id === id)
        ).filter(Boolean);
        
        // Add any new widgets that weren't in the saved order
        const existingIds = new Set(orderIds);
        const newWidgets = allWidgets.filter(widget => !existingIds.has(widget.id));
        
        setWidgets([...reorderedWidgets, ...newWidgets]);
      } catch (error) {
        console.error('Error loading widget order:', error);
      }
    }
  }, []);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(widgets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setWidgets(items);
    
    // Save order to localStorage
    const widgetIds = items.map(widget => widget.id);
    localStorage.setItem('dashboard-widget-order', JSON.stringify(widgetIds));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Quick Access</h2>
        <p className="text-sm text-muted-foreground">Drag to rearrange widgets</p>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="widgets">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="grid grid-cols-5 gap-4"
            >
              {widgets.map((widget, index) => {
                const Icon = widget.icon;
                return (
                  <Draggable key={widget.id} draggableId={widget.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={cn(
                          "transform transition-all duration-200",
                          snapshot.isDragging && "rotate-2 scale-105"
                        )}
                      >
                        <Card 
                          className={cn(
                            "h-24 cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-md",
                            "border-2 border-border/50 hover:border-primary/20",
                            snapshot.isDragging && "shadow-lg border-primary/40 z-50"
                          )}
                          onClick={(e) => {
                            e.preventDefault();
                            if (!snapshot.isDragging) {
                              widget.onClick();
                            }
                          }}
                        >
                          <CardContent className="flex flex-col items-center justify-center h-full p-2">
                            <div 
                              className={cn(
                                "p-2 rounded-lg mb-1 transition-colors",
                                widget.color
                              )}
                            >
                              <Icon className="h-5 w-5" />
                            </div>
                            <span className="text-xs font-medium text-center leading-tight">
                              {widget.title}
                            </span>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
};