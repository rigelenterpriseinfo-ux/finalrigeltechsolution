import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface StockData {
  warehouse_name?: string;
  bin_name?: string;
  total_qty: number;
  total_value: number;
}

interface LowStockItem {
  name: string;
  stock_quantity: number;
}

interface TopValueItem {
  name: string;
  value: number;
}

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
  const { user, profile } = useAuth();
  const [goodStockData, setGoodStockData] = useState<StockData[]>([]);
  const [damageStockData, setDamageStockData] = useState<StockData[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [topValueItems, setTopValueItems] = useState<TopValueItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch warehouse and bin wise good stock data
  const fetchGoodStockData = async () => {
    if (!profile?.company_id) return;
    
    try {
      const { data } = await supabase
        .from('current_stock_levels')
        .select(`
          current_stock,
          product_id,
          warehouse_id,
          bin_id,
          products!inner(name, cost_price, company_id)
        `)
        .eq('products.company_id', profile.company_id)
        .gt('current_stock', 0);

      if (data) {
        const aggregatedData: { [key: string]: StockData } = {};
        
        data.forEach((item: any) => {
          const key = `${item.warehouse_id || 'unknown'}-${item.bin_id || 'unknown'}`;
          if (!aggregatedData[key]) {
            aggregatedData[key] = {
              warehouse_name: 'Warehouse',
              bin_name: 'Bin',
              total_qty: 0,
              total_value: 0
            };
          }
          
          aggregatedData[key].total_qty += item.current_stock || 0;
          aggregatedData[key].total_value += (item.current_stock || 0) * (item.products?.cost_price || 0);
        });
        
        setGoodStockData(Object.values(aggregatedData).slice(0, 3));
      }
    } catch (error) {
      console.error('Error fetching good stock data:', error);
    }
  };

  // Fetch damage stock data (assuming we have a way to identify damaged stock)
  const fetchDamageStockData = async () => {
    if (!profile?.company_id) return;
    
    try {
      // For now, we'll simulate damage stock data as this requires specific business logic
      setDamageStockData([
        { warehouse_name: 'WH-A', bin_name: 'DMG-01', total_qty: 25, total_value: 12500 },
        { warehouse_name: 'WH-B', bin_name: 'DMG-02', total_qty: 18, total_value: 8900 }
      ]);
    } catch (error) {
      console.error('Error fetching damage stock data:', error);
    }
  };

  // Fetch top 5 low stock items
  const fetchLowStockItems = async () => {
    if (!profile?.company_id) return;
    
    try {
      const { data } = await supabase
        .from('products')
        .select('name, stock_quantity')
        .eq('company_id', profile.company_id)
        .gt('stock_quantity', 0)
        .lte('stock_quantity', 50)
        .order('stock_quantity', { ascending: true })
        .limit(5);

      if (data) {
        setLowStockItems(data);
      }
    } catch (error) {
      console.error('Error fetching low stock items:', error);
    }
  };

  // Fetch top 5 items by value
  const fetchTopValueItems = async () => {
    if (!profile?.company_id) return;
    
    try {
      const { data } = await supabase
        .from('products')
        .select('name, stock_quantity, cost_price')
        .eq('company_id', profile.company_id)
        .gt('stock_quantity', 0)
        .order('cost_price', { ascending: false })
        .limit(5);

      if (data) {
        const topItems = data.map(item => ({
          name: item.name,
          value: item.stock_quantity * item.cost_price
        }));
        setTopValueItems(topItems);
      }
    } catch (error) {
      console.error('Error fetching top value items:', error);
    }
  };

  // Fetch all data on component mount
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      await Promise.all([
        fetchGoodStockData(),
        fetchDamageStockData(),
        fetchLowStockItems(),
        fetchTopValueItems()
      ]);
      setLoading(false);
    };

    if (profile?.company_id) {
      fetchAllData();
    }
  }, [profile]);

  // Render widget content based on widget ID
  const renderWidgetContent = (widget: Widget) => {
    const Icon = widget.icon;
    
    // For data widgets, show content instead of just icons
    switch (widget.id) {
      case 'database':
        return (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("p-1 rounded", widget.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium">{widget.title}</span>
            </div>
            {loading ? (
              <div className="text-xs text-muted-foreground">Loading...</div>
            ) : (
              <div className="space-y-1 text-xs">
                {goodStockData.slice(0, 2).map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="truncate">Good Stock</span>
                    <span>{item.total_qty} • ₹{item.total_value.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'logistics':
        return (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("p-1 rounded", widget.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium">{widget.title}</span>
            </div>
            {loading ? (
              <div className="text-xs text-muted-foreground">Loading...</div>
            ) : (
              <div className="space-y-1 text-xs">
                {damageStockData.slice(0, 2).map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="truncate">Damage</span>
                    <span>{item.total_qty} • ₹{item.total_value.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'archive':
        return (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("p-1 rounded", widget.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium">{widget.title}</span>
            </div>
            {loading ? (
              <div className="text-xs text-muted-foreground">Loading...</div>
            ) : (
              <div className="space-y-1 text-xs">
                {lowStockItems.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="truncate">{item.name}</span>
                    <span>{item.stock_quantity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'calculator':
        return (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("p-1 rounded", widget.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium">{widget.title}</span>
            </div>
            {loading ? (
              <div className="text-xs text-muted-foreground">Loading...</div>
            ) : (
              <div className="space-y-1 text-xs">
                {topValueItems.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="truncate">{item.name}</span>
                    <span>₹{item.value.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return (
          <CardContent className="flex flex-col items-center justify-center h-full p-2">
            <div className={cn("p-2 rounded-lg mb-1 transition-colors", widget.color)}>
              <Icon className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium text-center leading-tight">
              {widget.title}
            </span>
          </CardContent>
        );
    }
  };
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
                            "h-32 cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-md",
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
                          <CardContent className="p-2 h-full">
                            {renderWidgetContent(widget)}
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