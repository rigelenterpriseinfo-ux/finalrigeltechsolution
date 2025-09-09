import React, { useState } from 'react';
import { CheckCircle2, Package, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface BackorderSummary {
  customer_id: string;
  customer_name: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  total_backordered: number;
  current_stock: number;
  ready_to_deliver: number;
  available_to_process: number;
  avg_unit_price: number;
  oldest_backorder_date: string;
}

interface ProcessBackorderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  backorders: BackorderSummary[];
  onProcess: (backorderIds: string[]) => void;
}

export default function ProcessBackorderDialog({
  open,
  onOpenChange,
  backorders,
  onProcess
}: ProcessBackorderDialogProps) {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);

  const processableBackorders = backorders.filter(b => b.available_to_process > 0);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = processableBackorders.map(b => `${b.customer_id}-${b.product_id}`);
      setSelectedItems(allIds);
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (backorder: BackorderSummary, checked: boolean) => {
    const id = `${backorder.customer_id}-${backorder.product_id}`;
    if (checked) {
      setSelectedItems([...selectedItems, id]);
    } else {
      setSelectedItems(selectedItems.filter(selectedId => selectedId !== id));
    }
  };

  const handleProcess = async () => {
    setProcessing(true);
    try {
      await onProcess(selectedItems);
      setSelectedItems([]);
    } finally {
      setProcessing(false);
    }
  };

  const selectedBackorders = processableBackorders.filter(b => 
    selectedItems.includes(`${b.customer_id}-${b.product_id}`)
  );

  const totalSelectedQuantity = selectedBackorders.reduce((sum, b) => 
    sum + Math.min(b.total_backordered, b.available_to_process), 0
  );

  const totalSelectedValue = selectedBackorders.reduce((sum, b) => 
    sum + (Math.min(b.total_backordered, b.available_to_process) * b.avg_unit_price), 0
  );

  const customerGroups = selectedBackorders.reduce((groups, backorder) => {
    if (!groups[backorder.customer_name]) {
      groups[backorder.customer_name] = [];
    }
    groups[backorder.customer_name].push(backorder);
    return groups;
  }, {} as Record<string, BackorderSummary[]>);

  const ordersToCreate = Object.keys(customerGroups).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Process Available Backorders
          </DialogTitle>
          <DialogDescription>
            Select backorder items to process. New sales orders will be created automatically for available stock.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <div className="text-sm font-medium text-blue-800">Items Available</div>
              <div className="text-lg font-bold text-blue-900">{processableBackorders.length}</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
              <div className="text-sm font-medium text-green-800">Selected Quantity</div>
              <div className="text-lg font-bold text-green-900">{totalSelectedQuantity}</div>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
              <div className="text-sm font-medium text-purple-800">Orders to Create</div>
              <div className="text-lg font-bold text-purple-900">{ordersToCreate}</div>
            </div>
          </div>

          {/* Selection Table */}
          {processableBackorders.length > 0 ? (
            <div className="border rounded-lg">
              <div className="p-3 border-b bg-gray-50 flex items-center gap-2">
                <Checkbox
                  checked={selectedItems.length === processableBackorders.length}
                  onCheckedChange={handleSelectAll}
                />
                <span className="font-medium">Select All Available Items</span>
              </div>
              
              <div className="max-h-60 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Select</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Backordered</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead className="text-right">To Process</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processableBackorders.map((backorder) => {
                      const id = `${backorder.customer_id}-${backorder.product_id}`;
                      const isSelected = selectedItems.includes(id);
                      const toProcess = Math.min(backorder.total_backordered, backorder.available_to_process);
                      const lineValue = toProcess * backorder.avg_unit_price;

                      return (
                        <TableRow key={id}>
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => handleSelectItem(backorder, checked as boolean)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{backorder.customer_name}</TableCell>
                          <TableCell>{backorder.product_name}</TableCell>
                          <TableCell className="font-mono text-sm">{backorder.product_sku}</TableCell>
                          <TableCell className="text-right">{backorder.total_backordered}</TableCell>
                          <TableCell className="text-right text-green-600 font-medium">
                            {backorder.available_to_process}
                          </TableCell>
                          <TableCell className="text-right font-medium text-blue-600">
                            {toProcess}
                          </TableCell>
                          <TableCell className="text-right">₹{backorder.avg_unit_price.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium">₹{lineValue.toFixed(2)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No backorders available to process at this time.</p>
            </div>
          )}

          {/* Processing Summary */}
          {selectedItems.length > 0 && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2">Processing Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-blue-700">Items to process:</span>
                  <span className="font-medium ml-2">{totalSelectedQuantity}</span>
                </div>
                <div>
                  <span className="text-blue-700">Total value:</span>
                  <span className="font-medium ml-2">₹{totalSelectedValue.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-blue-700">Sales orders to create:</span>
                  <span className="font-medium ml-2">{ordersToCreate}</span>
                </div>
                <div>
                  <span className="text-blue-700">Customers affected:</span>
                  <span className="font-medium ml-2">{Object.keys(customerGroups).length}</span>
                </div>
              </div>
            </div>
          )}

          {selectedItems.length > 0 && (
            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <strong>Important:</strong> This action will create new sales orders and mark selected backorder items as fulfilled. This cannot be undone.
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
            Cancel
          </Button>
          <Button 
            onClick={handleProcess}
            disabled={selectedItems.length === 0 || processing}
          >
            {processing ? 'Processing...' : `Process Selected (${selectedItems.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}