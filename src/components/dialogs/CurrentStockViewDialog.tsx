import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Package, MapPin, TrendingUp, AlertTriangle, Calendar, BarChart3, Activity } from 'lucide-react';
import { format } from 'date-fns';

interface CurrentStock {
  company_id: string;
  product_id: string;
  warehouse_id: string;
  bin_id: string;
  current_stock: number;
  last_transaction_date: string;
  transaction_count: number;
  product_name: string;
  product_sku: string;
  min_stock_level: number;
  warehouse_name: string;
  bin_name: string;
}

interface CurrentStockViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stock: CurrentStock | null;
}

export const CurrentStockViewDialog: React.FC<CurrentStockViewDialogProps> = ({
  open,
  onOpenChange,
  stock,
}) => {
  if (!stock) return null;

  const getStockStatus = (): {
    status: string;
    color: 'default' | 'secondary' | 'destructive' | 'outline';
    icon: React.ReactNode;
    bgColor: string;
    textColor: string;
  } => {
    if (stock.current_stock <= 0) {
      return {
        status: 'Out of Stock',
        color: 'destructive',
        icon: <AlertTriangle className="h-4 w-4" />,
        bgColor: 'bg-red-50 border-red-200',
        textColor: 'text-red-700'
      };
    } else if (stock.current_stock <= stock.min_stock_level) {
      return {
        status: 'Low Stock',
        color: 'outline' as const,
        icon: <AlertTriangle className="h-4 w-4" />,
        bgColor: 'bg-orange-50 border-orange-200',
        textColor: 'text-orange-700'
      };
    } else {
      return {
        status: 'In Stock',
        color: 'default' as const,
        icon: <Package className="h-4 w-4" />,
        bgColor: 'bg-green-50 border-green-200',
        textColor: 'text-green-700'
      };
    }
  };

  const stockStatus = getStockStatus();
  const stockHealthPercentage = stock.min_stock_level > 0 
    ? Math.min((stock.current_stock / stock.min_stock_level) * 100, 100)
    : 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <Package className="h-5 w-5 text-primary" />
            Current Stock Details
          </DialogTitle>
          <DialogDescription>
            Complete stock information for this product at the specified location
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-h-[calc(90vh-8rem)] overflow-y-auto">
          {/* Product Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-primary/20">
              <Package className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-primary">Product Information</h3>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Product Name</label>
                <p className="text-sm font-semibold mt-1">{stock.product_name}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">SKU</label>
                <p className="text-sm font-mono bg-muted/50 px-2 py-1 rounded mt-1">
                  {stock.product_sku}
                </p>
              </div>
            </div>
          </div>

          {/* Location Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-green-500/20">
              <MapPin className="h-4 w-4 text-green-600" />
              <h3 className="font-semibold text-green-600">Location Information</h3>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Warehouse</label>
                <p className="text-sm font-semibold mt-1">{stock.warehouse_name}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">BIN Location</label>
                <p className="text-sm font-semibold mt-1">{stock.bin_name}</p>
              </div>
            </div>
          </div>

          {/* Stock Status */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-blue-500/20">
              <BarChart3 className="h-4 w-4 text-blue-600" />
              <h3 className="font-semibold text-blue-600">Stock Status</h3>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Current Status</label>
                <div className="mt-1">
                  <Badge variant={stockStatus.color} className="border">
                    {stockStatus.icon}
                    <span className="ml-1">{stockStatus.status}</span>
                  </Badge>
                </div>
              </div>
              
              <div className={`p-4 rounded-lg border ${stockStatus.bgColor}`}>
                <div className="text-center">
                  <label className={`text-sm font-medium ${stockStatus.textColor}`}>Current Stock</label>
                  <p className={`text-3xl font-bold mt-1 ${stockStatus.textColor}`}>
                    {stock.current_stock}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">units</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stock Levels */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-orange-500/20">
              <TrendingUp className="h-4 w-4 text-orange-600" />
              <h3 className="font-semibold text-orange-600">Stock Levels</h3>
            </div>
            
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <label className="text-sm font-medium text-muted-foreground">Min Stock Level</label>
                  <p className="text-xl font-bold text-orange-600 mt-1">
                    {stock.min_stock_level}
                  </p>
                </div>
                
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <label className="text-sm font-medium text-muted-foreground">Available</label>
                  <p className="text-xl font-bold text-green-600 mt-1">
                    {Math.max(0, stock.current_stock - stock.min_stock_level)}
                  </p>
                </div>
              </div>
              
              {/* Stock Health Bar */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-muted-foreground">Stock Health</label>
                  <span className="text-sm font-semibold">{stockHealthPercentage.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      stockHealthPercentage >= 100 ? 'bg-green-500' :
                      stockHealthPercentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(stockHealthPercentage, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Transaction History */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-purple-500/20">
              <Activity className="h-4 w-4 text-purple-600" />
              <h3 className="font-semibold text-purple-600">Transaction History</h3>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Last Transaction</label>
                  <p className="text-sm">
                    {format(new Date(stock.last_transaction_date), 'PPP p')}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Total Transactions</label>
                  <p className="text-sm font-semibold">{stock.transaction_count} transactions</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stock Alerts */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-red-500/20">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <h3 className="font-semibold text-red-600">Stock Alerts</h3>
            </div>
            
            <div className="space-y-2">
              {stock.current_stock <= 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <p className="text-sm font-medium text-red-700">Critical: Out of Stock</p>
                  </div>
                  <p className="text-xs text-red-600 mt-1">
                    Immediate restock required to avoid stockouts
                  </p>
                </div>
              )}
              
              {stock.current_stock > 0 && stock.current_stock <= stock.min_stock_level && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <p className="text-sm font-medium text-orange-700">Warning: Low Stock</p>
                  </div>
                  <p className="text-xs text-orange-600 mt-1">
                    Stock is below minimum level. Consider reordering soon.
                  </p>
                </div>
              )}
              
              {stock.current_stock > stock.min_stock_level && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-green-600" />
                    <p className="text-sm font-medium text-green-700">Healthy Stock Level</p>
                  </div>
                  <p className="text-xs text-green-600 mt-1">
                    Stock levels are adequate for normal operations
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};