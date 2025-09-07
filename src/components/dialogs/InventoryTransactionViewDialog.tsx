import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Package, ArrowRightLeft, MapPin, User, Calendar, FileText, Calculator, Receipt, TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';

interface InventoryTransaction {
  id: string;
  transaction_date: string;
  transaction_type: string;
  reference_number: string;
  product_name: string;
  product_sku: string;
  warehouse_name: string;
  bin_name: string;
  quantity_change: number;
  unit_cost: number;
  total_value: number;
  notes: string;
  created_by_name: string;
}

interface InventoryTransactionViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: InventoryTransaction | null;
}

export const InventoryTransactionViewDialog: React.FC<InventoryTransactionViewDialogProps> = ({
  open,
  onOpenChange,
  transaction,
}) => {
  if (!transaction) return null;

  const getTransactionTypeConfig = (type: string) => {
    const typeConfig = {
      'purchase_receipt': { 
        label: 'Purchase Receipt', 
        color: 'bg-green-100 text-green-800 border-green-200',
        icon: <TrendingUp className="h-3 w-3" />
      },
      'sales_issue': { 
        label: 'Sales Issue', 
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: <TrendingDown className="h-3 w-3" />
      },
      'sales_return': { 
        label: 'Sales Return', 
        color: 'bg-purple-100 text-purple-800 border-purple-200',
        icon: <TrendingUp className="h-3 w-3" />
      },
      'sales_invoice': { 
        label: 'Sales Invoice', 
        color: 'bg-orange-100 text-orange-800 border-orange-200',
        icon: <TrendingDown className="h-3 w-3" />
      },
      'adjustment_positive': { 
        label: 'Adjustment +', 
        color: 'bg-green-100 text-green-800 border-green-200',
        icon: <TrendingUp className="h-3 w-3" />
      },
      'adjustment_negative': { 
        label: 'Adjustment -', 
        color: 'bg-red-100 text-red-800 border-red-200',
        icon: <TrendingDown className="h-3 w-3" />
      },
      'transfer_out': { 
        label: 'Transfer Out', 
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        icon: <ArrowRightLeft className="h-3 w-3" />
      },
      'transfer_in': { 
        label: 'Transfer In', 
        color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        icon: <ArrowRightLeft className="h-3 w-3" />
      },
    };

    return typeConfig[type as keyof typeof typeConfig] || { 
      label: type, 
      color: 'bg-gray-100 text-gray-800 border-gray-200',
      icon: <ArrowRightLeft className="h-3 w-3" />
    };
  };

  const transactionConfig = getTransactionTypeConfig(transaction.transaction_type);
  const isPositiveTransaction = transaction.quantity_change > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Inventory Transaction Details
          </DialogTitle>
          <DialogDescription>
            Complete information about this inventory transaction
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-h-[calc(90vh-8rem)] overflow-y-auto">
          {/* Transaction Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-primary/20">
              <Receipt className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-primary">Transaction Information</h3>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Transaction Type</label>
                <div className="mt-1">
                  <Badge variant="outline" className={`${transactionConfig.color} border font-medium`}>
                    {transactionConfig.icon}
                    <span className="ml-1">{transactionConfig.label}</span>
                  </Badge>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Reference Number</label>
                <p className="text-sm font-mono bg-muted/50 px-2 py-1 rounded mt-1">
                  {transaction.reference_number}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Transaction Date</label>
                <p className="text-sm font-medium mt-1">
                  {format(new Date(transaction.transaction_date), 'PPP p')}
                </p>
              </div>
            </div>
          </div>

          {/* Product Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-green-500/20">
              <Package className="h-4 w-4 text-green-600" />
              <h3 className="font-semibold text-green-600">Product Information</h3>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Product Name</label>
                <p className="text-sm font-semibold mt-1">{transaction.product_name}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">SKU</label>
                <p className="text-sm font-mono bg-muted/50 px-2 py-1 rounded mt-1">
                  {transaction.product_sku}
                </p>
              </div>
            </div>
          </div>

          {/* Location Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-blue-500/20">
              <MapPin className="h-4 w-4 text-blue-600" />
              <h3 className="font-semibold text-blue-600">Location Information</h3>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Warehouse</label>
                <p className="text-sm font-semibold mt-1">{transaction.warehouse_name}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">BIN Location</label>
                <p className="text-sm font-semibold mt-1">{transaction.bin_name}</p>
              </div>
            </div>
          </div>

          {/* Financial Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-orange-500/20">
              <Calculator className="h-4 w-4 text-orange-600" />
              <h3 className="font-semibold text-orange-600">Financial Details</h3>
            </div>
            
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Quantity Change</label>
                  <p className={`text-lg font-bold mt-1 ${
                    isPositiveTransaction ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {isPositiveTransaction ? '+' : ''}{transaction.quantity_change} units
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Unit Cost</label>
                  <p className="text-lg font-bold mt-1">
                    ₹{transaction.unit_cost.toFixed(2)}
                  </p>
                </div>
              </div>
              
              <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                <label className="text-sm font-medium text-primary">Total Value</label>
                <p className={`text-xl font-bold mt-1 ${
                  transaction.total_value >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  ₹{Math.abs(transaction.total_value).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* User Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-purple-500/20">
              <User className="h-4 w-4 text-purple-600" />
              <h3 className="font-semibold text-purple-600">User Information</h3>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created By</label>
                  <p className="text-sm font-medium">{transaction.created_by_name}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {transaction.notes && (
            <div className="space-y-4 lg:col-span-2">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-500/20">
                <FileText className="h-4 w-4 text-slate-600" />
                <h3 className="font-semibold text-slate-600">Notes</h3>
              </div>
              
              <div className="p-3 bg-muted/50 rounded-lg border">
                <p className="text-sm leading-relaxed">{transaction.notes}</p>
              </div>
            </div>
          )}

          {/* Transaction Summary */}
          <div className="lg:col-span-2">
            <div className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-primary font-medium">Transaction Impact</p>
                  <p className="text-lg font-bold text-primary">
                    {isPositiveTransaction ? 'Stock Increased' : 'Stock Decreased'} by {Math.abs(transaction.quantity_change)} units
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Value Impact</p>
                  <p className={`text-lg font-bold ${
                    transaction.total_value >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {transaction.total_value >= 0 ? '+' : ''}₹{transaction.total_value.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};