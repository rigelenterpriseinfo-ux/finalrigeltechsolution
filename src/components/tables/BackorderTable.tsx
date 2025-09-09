import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Edit, Trash2, Package, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

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

interface BackorderTableProps {
  backorders: BackorderSummary[];
  loading: boolean;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onEdit?: (backorder: BackorderSummary) => void;
  onDelete?: (backorderId: string) => void;
  onRefresh: () => void;
}

export default function BackorderTable({
  backorders,
  loading,
  selectedIds,
  onSelectionChange,
  onEdit,
  onDelete,
  onRefresh
}: BackorderTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof BackorderSummary>('oldest_backorder_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const filteredBackorders = backorders.filter((backorder) =>
    backorder.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    backorder.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    backorder.product_sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const handleSort = (field: keyof BackorderSummary) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const processableIds = sortedBackorders
        .filter(b => b.available_to_process > 0)
        .map(b => `${b.customer_id}-${b.product_id}`);
      onSelectionChange(processableIds);
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectItem = (backorder: BackorderSummary, checked: boolean) => {
    const id = `${backorder.customer_id}-${backorder.product_id}`;
    if (checked) {
      onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter(selectedId => selectedId !== id));
    }
  };

  const getStatusBadge = (backorder: BackorderSummary) => {
    if (backorder.available_to_process >= backorder.total_backordered) {
      return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />Ready</Badge>;
    } else if (backorder.available_to_process > 0) {
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200"><AlertCircle className="h-3 w-3 mr-1" />Partial</Badge>;
    } else {
      return <Badge className="bg-red-100 text-red-800 border-red-200"><Package className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  const SortButton = ({ field, children }: { field: keyof BackorderSummary; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      onClick={() => handleSort(field)}
      className="h-auto p-0 font-medium justify-start"
    >
      {children}
      {sortField === field && (
        sortDirection === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
      )}
    </Button>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const processableCount = sortedBackorders.filter(b => b.available_to_process > 0).length;

  return (
    <div className="space-y-4">
      {/* Search and Summary */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <Input
          placeholder="Search by customer, product, or SKU..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <div className="text-sm text-muted-foreground">
          Showing {sortedBackorders.length} backorder{sortedBackorders.length !== 1 ? 's' : ''} 
          {processableCount > 0 && (
            <span className="text-green-600 font-medium"> • {processableCount} ready to process</span>
          )}
        </div>
      </div>

      {sortedBackorders.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {searchTerm ? 'No backorders found matching your search.' : 'No backorders found.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Backorder Items</CardTitle>
              {processableCount > 0 && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedIds.length === processableCount}
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-sm text-muted-foreground">Select All Ready</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Select</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead><SortButton field="customer_name">Customer</SortButton></TableHead>
                    <TableHead><SortButton field="product_name">Product</SortButton></TableHead>
                    <TableHead><SortButton field="product_sku">SKU</SortButton></TableHead>
                    <TableHead className="text-right"><SortButton field="total_backordered">Backordered</SortButton></TableHead>
                    <TableHead className="text-right"><SortButton field="current_stock">Stock</SortButton></TableHead>
                    <TableHead className="text-right"><SortButton field="ready_to_deliver">Ready to Deliver</SortButton></TableHead>
                    <TableHead className="text-right"><SortButton field="available_to_process">Available</SortButton></TableHead>
                    <TableHead className="text-right"><SortButton field="avg_unit_price">Unit Price</SortButton></TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                    <TableHead><SortButton field="oldest_backorder_date">Age</SortButton></TableHead>
                    {(onEdit || onDelete) && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedBackorders.map((backorder) => {
                    const id = `${backorder.customer_id}-${backorder.product_id}`;
                    const isSelected = selectedIds.includes(id);
                    const canProcess = backorder.available_to_process > 0;
                    const totalValue = backorder.total_backordered * backorder.avg_unit_price;
                    const ageDays = Math.floor((new Date().getTime() - new Date(backorder.oldest_backorder_date).getTime()) / (1000 * 60 * 60 * 24));

                    return (
                      <TableRow 
                        key={id}
                        className={`${canProcess ? 'bg-green-50/50' : ''} hover:bg-muted/50`}
                      >
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleSelectItem(backorder, checked as boolean)}
                            disabled={!canProcess}
                          />
                        </TableCell>
                        <TableCell>{getStatusBadge(backorder)}</TableCell>
                        <TableCell className="font-medium">{backorder.customer_name}</TableCell>
                        <TableCell>{backorder.product_name}</TableCell>
                        <TableCell className="font-mono text-sm">{backorder.product_sku}</TableCell>
                        <TableCell className="text-right font-medium">{backorder.total_backordered}</TableCell>
                        <TableCell className="text-right">{backorder.current_stock}</TableCell>
                        <TableCell className="text-right">{backorder.ready_to_deliver}</TableCell>
                        <TableCell className="text-right">
                          <span className={canProcess ? 'text-green-600 font-medium' : ''}>
                            {backorder.available_to_process}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">₹{backorder.avg_unit_price.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-medium">₹{totalValue.toFixed(2)}</TableCell>
                        <TableCell>
                          <span className={ageDays > 30 ? 'text-red-600' : ageDays > 7 ? 'text-yellow-600' : ''}>
                            {ageDays} days
                          </span>
                        </TableCell>
                        {(onEdit || onDelete) && (
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {onEdit && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onEdit(backorder)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              {onDelete && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onDelete(id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
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