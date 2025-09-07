import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Package, TrendingUp, TrendingDown, MapPin, User, Calendar, FileText, Calculator, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface InventoryAdjustment {
  id: string;
  adjustment_type: 'positive' | 'negative';
  reason: string;
  adjustment_quantity: number;
  adjustment_amount: number;
  remarks: string | null;
  current_stock_before: number;
  current_stock_after: number;
  created_at: string;
  products: {
    name: string;
    sku: string;
  };
  warehouse_bins: {
    warehouse_name: string;
    warehouse_code: string;
    bin_name: string;
    wh_bin_code: string;
  };
  created_by: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

interface InventoryAdjustmentViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adjustment: InventoryAdjustment | null;
}

export const InventoryAdjustmentViewDialog: React.FC<InventoryAdjustmentViewDialogProps> = ({
  open,
  onOpenChange,
  adjustment,
}) => {
  if (!adjustment) return null;

  const getReasonLabel = (reason: string) => {
    const reasonMap: Record<string, string> = {
      opening_balance: 'Opening Balance',
      damage: 'Damage',
      audit: 'Audit',
      scrap: 'Scrap',
      transfer: 'Transfer',
      other: 'Other',
    };
    return reasonMap[reason] || reason;
  };

  const getUserName = (profile: { first_name: string | null; last_name: string | null } | null) => {
    if (!profile) return 'System User';
    return `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown User';
  };

  const isPositiveAdjustment = adjustment.adjustment_type === 'positive';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            {isPositiveAdjustment ? (
              <TrendingUp className="h-5 w-5 text-green-600" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-600" />
            )}
            Inventory Adjustment Details
          </DialogTitle>
          <DialogDescription>
            Complete information about this inventory adjustment transaction
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
                <p className="text-sm font-semibold mt-1">{adjustment.products.name}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">SKU</label>
                <p className="text-sm font-mono bg-muted/50 px-2 py-1 rounded mt-1">
                  {adjustment.products.sku}
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
                <p className="text-sm font-semibold mt-1">{adjustment.warehouse_bins.warehouse_name}</p>
                <p className="text-xs text-muted-foreground">Code: {adjustment.warehouse_bins.warehouse_code}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">BIN Location</label>
                <p className="text-sm font-semibold mt-1">{adjustment.warehouse_bins.bin_name}</p>
                <p className="text-xs font-mono text-muted-foreground">({adjustment.warehouse_bins.wh_bin_code})</p>
              </div>
            </div>
          </div>

          {/* Adjustment Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-blue-500/20">
              <Calculator className="h-4 w-4 text-blue-600" />
              <h3 className="font-semibold text-blue-600">Adjustment Details</h3>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Adjustment Type</label>
                <div className="mt-1">
                  <Badge variant={isPositiveAdjustment ? "default" : "destructive"}>
                    {isPositiveAdjustment ? (
                      <>
                        <TrendingUp className="h-3 w-3 mr-1" />
                        Add Stock
                      </>
                    ) : (
                      <>
                        <TrendingDown className="h-3 w-3 mr-1" />
                        Reduce Stock
                      </>
                    )}
                  </Badge>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Reason</label>
                <div className="mt-1">
                  <Badge variant="outline">
                    {getReasonLabel(adjustment.reason)}
                  </Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Quantity Adjusted</label>
                  <p className={`text-lg font-bold mt-1 ${
                    isPositiveAdjustment ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {isPositiveAdjustment ? '+' : '-'}{adjustment.adjustment_quantity} units
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Amount</label>
                  <p className="text-lg font-bold mt-1">
                    {adjustment.adjustment_amount > 0 ? `₹${adjustment.adjustment_amount.toFixed(2)}` : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Stock Impact */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-orange-500/20">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <h3 className="font-semibold text-orange-600">Stock Impact</h3>
            </div>
            
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
                  <label className="text-sm font-medium text-red-600">Stock Before</label>
                  <p className="text-2xl font-bold text-red-700 mt-1">
                    {adjustment.current_stock_before}
                  </p>
                </div>
                
                <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                  <label className="text-sm font-medium text-green-600">Stock After</label>
                  <p className="text-2xl font-bold text-green-700 mt-1">
                    {adjustment.current_stock_after}
                  </p>
                </div>
              </div>
              
              <div className="text-center p-2 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Net Change: 
                  <span className={`font-semibold ml-1 ${
                    isPositiveAdjustment ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {isPositiveAdjustment ? '+' : ''}{adjustment.current_stock_after - adjustment.current_stock_before} units
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Transaction Metadata */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-purple-500/20">
              <Calendar className="h-4 w-4 text-purple-600" />
              <h3 className="font-semibold text-purple-600">Transaction Details</h3>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created Date</label>
                  <p className="text-sm">
                    {format(new Date(adjustment.created_at), 'PPP p')}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created By</label>
                  <p className="text-sm font-medium">{getUserName(adjustment.created_by)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Remarks */}
          {adjustment.remarks && (
            <div className="space-y-4 lg:col-span-2">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-500/20">
                <FileText className="h-4 w-4 text-slate-600" />
                <h3 className="font-semibold text-slate-600">Remarks</h3>
              </div>
              
              <div className="p-3 bg-muted/50 rounded-lg border">
                <p className="text-sm leading-relaxed">{adjustment.remarks}</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};