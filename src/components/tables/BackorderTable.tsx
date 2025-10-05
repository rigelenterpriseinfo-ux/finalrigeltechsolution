import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Package, Download } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { exportToExcel, formatCurrency, formatDate } from '@/utils/excelExport';
import type { BackorderLineItem } from '@/components/modules/BackorderModule';

interface BackorderTableProps {
  backorders: BackorderLineItem[];
  loading: boolean;
  canEdit: boolean;
  onRelease: (itemId: string, releaseQty: number) => void;
  onRefresh: () => void;
}

export default function BackorderTable({
  backorders,
  loading,
  canEdit,
  onRelease,
  onRefresh
}: BackorderTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof BackorderLineItem>('order_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [releaseQuantities, setReleaseQuantities] = useState<Record<string, number>>({});
  const { toast } = useToast();

  // Multi-field search: Product Name/SKU, Customer Name, SO Number, PO Number
  const filteredBackorders = backorders.filter((backorder) => {
    const search = searchTerm.toLowerCase();
    return (
      backorder.product_name.toLowerCase().includes(search) ||
      backorder.product_sku.toLowerCase().includes(search) ||
      backorder.customer_name.toLowerCase().includes(search) ||
      backorder.so_number.toLowerCase().includes(search) ||
      (backorder.po_number && backorder.po_number.toLowerCase().includes(search))
    );
  });

  const sortedBackorders = filteredBackorders.sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    return 0;
  });

  const handleSort = (field: keyof BackorderLineItem) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleReleaseQtyChange = (itemId: string, value: string) => {
    const qty = parseInt(value) || 0;
    setReleaseQuantities(prev => ({ ...prev, [itemId]: qty }));
  };

  const handleRelease = (item: BackorderLineItem) => {
    const releaseQty = releaseQuantities[item.id] || 0;
    
    if (releaseQty <= 0) {
      toast({
        title: 'Invalid Quantity',
        description: 'Please enter a valid release quantity',
        variant: 'destructive',
      });
      return;
    }

    onRelease(item.id, releaseQty);
    setReleaseQuantities(prev => ({ ...prev, [item.id]: 0 }));
  };

  const handleExportToExcel = () => {
    const success = exportToExcel({
      filename: 'Backorders_ItemWise',
      sheetName: 'Backorder Items',
      columns: [
        { key: 'so_number', label: 'Order No.' },
        { key: 'order_date', label: 'Order Date', format: formatDate },
        { key: 'customer_name', label: 'Customer' },
        { key: 'po_number', label: 'PO Number' },
        { key: 'product_name', label: 'Product Name' },
        { key: 'product_sku', label: 'Product SKU' },
        { key: 'ordered_qty', label: 'Ordered Qty' },
        { key: 'invoiced_qty', label: 'Invoiced Qty' },
        { key: 'ready_to_deliver_qty', label: 'Ready to Deliver' },
        { key: 'backorder_qty', label: 'Backorder Qty' },
        { key: 'available_stock', label: 'Available Stock' },
        { key: 'unit_price', label: 'Unit Price', format: (v) => formatCurrency(v) },
        { key: 'line_total', label: 'Line Total', format: (v) => formatCurrency(v) },
        { key: 'so_status', label: 'SO Status' },
      ],
      data: sortedBackorders,
      includeMetadata: true,
      additionalMetadata: [`Total Lines: ${sortedBackorders.length}`]
    });

    if (success) {
      toast({
        title: 'Export Successful',
        description: 'Backorder data exported to Excel',
      });
    } else {
      toast({
        title: 'Export Failed',
        description: 'Failed to export data. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const SortButton = ({ field, children }: { field: keyof BackorderLineItem; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      onClick={() => handleSort(field)}
      className="h-auto p-0 font-medium justify-start hover:bg-transparent"
    >
      {children}
      {sortField === field && (
        sortDirection === 'asc' ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />
      )}
    </Button>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Export */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <Input
          placeholder="Search by Product, Customer, SO#, or PO#..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {sortedBackorders.length} line{sortedBackorders.length !== 1 ? 's' : ''}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportToExcel}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </Button>
        </div>
      </div>

      {sortedBackorders.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {searchTerm ? 'No backorder items found matching your search.' : 'No backorder items found.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="text-lg">Backorder Line Items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]"><SortButton field="so_number">Order No.</SortButton></TableHead>
                    <TableHead className="w-[100px]"><SortButton field="order_date">Order Date</SortButton></TableHead>
                    <TableHead><SortButton field="customer_name">Customer</SortButton></TableHead>
                    <TableHead className="w-[100px]">PO Number</TableHead>
                    <TableHead><SortButton field="product_name">Product Name</SortButton></TableHead>
                    <TableHead className="w-[100px]"><SortButton field="product_sku">SKU</SortButton></TableHead>
                    <TableHead className="text-right w-[80px]"><SortButton field="ordered_qty">Ordered</SortButton></TableHead>
                    <TableHead className="text-right w-[80px]"><SortButton field="invoiced_qty">Invoiced</SortButton></TableHead>
                    <TableHead className="text-right w-[100px]"><SortButton field="ready_to_deliver_qty">Ready</SortButton></TableHead>
                    <TableHead className="text-right w-[100px]"><SortButton field="backorder_qty">Backorder</SortButton></TableHead>
                    <TableHead className="text-right w-[100px]"><SortButton field="available_stock">Avail. Stock</SortButton></TableHead>
                    <TableHead className="text-right w-[100px]"><SortButton field="unit_price">Unit Price</SortButton></TableHead>
                    <TableHead className="text-right w-[100px]"><SortButton field="line_total">Line Total</SortButton></TableHead>
                    <TableHead className="w-[100px]"><SortButton field="so_status">SO Status</SortButton></TableHead>
                    {canEdit && (
                      <>
                        <TableHead className="w-[100px]">Release Qty</TableHead>
                        <TableHead className="w-[100px]">Action</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedBackorders.map((item) => {
                    const canRelease = item.available_stock > 0;
                    const releaseQty = releaseQuantities[item.id] || 0;

                    return (
                      <TableRow 
                        key={item.id}
                        className={canRelease ? 'bg-green-50/30' : ''}
                      >
                        <TableCell className="font-medium">{item.so_number}</TableCell>
                        <TableCell>{new Date(item.order_date).toLocaleDateString()}</TableCell>
                        <TableCell>{item.customer_name}</TableCell>
                        <TableCell>{item.po_number || '-'}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={item.product_name}>
                          {item.product_name}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{item.product_sku}</TableCell>
                        <TableCell className="text-right">{item.ordered_qty}</TableCell>
                        <TableCell className="text-right">{item.invoiced_qty}</TableCell>
                        <TableCell className="text-right">{item.ready_to_deliver_qty}</TableCell>
                        <TableCell className="text-right font-medium text-orange-600">
                          {item.backorder_qty}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={canRelease ? 'text-green-600 font-medium' : 'text-red-600'}>
                            {item.available_stock}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">₹{item.unit_price.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-medium">₹{item.line_total.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={item.so_status === 'open' ? 'default' : 'secondary'}>
                            {item.so_status}
                          </Badge>
                        </TableCell>
                        {canEdit && (
                          <>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                max={Math.min(item.backorder_qty, item.available_stock)}
                                value={releaseQty || ''}
                                onChange={(e) => handleReleaseQtyChange(item.id, e.target.value)}
                                className="w-20 h-8"
                                disabled={!canRelease}
                                placeholder="0"
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                onClick={() => handleRelease(item)}
                                disabled={!canRelease || releaseQty <= 0}
                                className="h-8"
                              >
                                Release
                              </Button>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
