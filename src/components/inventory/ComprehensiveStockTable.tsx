import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ChevronDown, 
  ChevronUp, 
  Package, 
  MapPin, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  ExternalLink
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface StockData {
  product_id: string;
  product_name: string;
  product_sku: string;
  warehouse_id: string;
  warehouse_name: string;
  bin_id: string;
  bin_name: string;
  current_stock: number;
  allocated_stock: number;
  available_to_pick: number;
  pending_po_qty: number;
  pending_rso_qty: number;
  aging_status: string;
  weighted_avg_age_days: number;
  unit_price: number;
  total_value: number;
  sales_orders?: Array<{
    order_number: string;
    allocated_qty: number;
    customer_name: string;
  }>;
  purchase_orders?: Array<{
    po_number: string;
    pending_qty: number;
    supplier_name: string;
    expected_date: string;
  }>;
  return_orders?: Array<{
    rso_number: string;
    pending_qty: number;
    customer_name: string;
  }>;
}

interface ComprehensiveStockTableProps {
  stockData: StockData[];
  loading: boolean;
  onRefresh: () => void;
  selectedItem?: string;
  selectedLocation?: {warehouse: string, bin: string};
  processedStockData: StockData[];
}

export const ComprehensiveStockTable = ({
  stockData,
  loading,
  onRefresh,
  selectedItem,
  selectedLocation,
  processedStockData
}: ComprehensiveStockTableProps) => {
  const { company } = useAuth();
  const { toast } = useToast();
  
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{key: string; direction: 'asc' | 'desc'} | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Sorting logic
  const sortedData = useMemo(() => {
    if (!sortConfig) return processedStockData;

    return [...processedStockData].sort((a, b) => {
      const aValue = a[sortConfig.key as keyof StockData];
      const bValue = b[sortConfig.key as keyof StockData];

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      const aStr = String(aValue || '').toLowerCase();
      const bStr = String(bValue || '').toLowerCase();
      
      if (sortConfig.direction === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });
  }, [processedStockData, sortConfig]);

  // Pagination
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);

  // Handle sorting
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Get sort icon
  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="w-4 h-4" />;
    }
    return sortConfig.direction === 'asc' ? 
      <ArrowUp className="w-4 h-4" /> : 
      <ArrowDown className="w-4 h-4" />;
  };

  // Toggle row expansion
  const toggleRowExpansion = (stockKey: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(stockKey)) {
      newExpanded.delete(stockKey);
    } else {
      newExpanded.add(stockKey);
    }
    setExpandedRows(newExpanded);
  };

  // Get aging badge
  const getAgingBadge = (status: string, avgDays: number) => {
    const variants = {
      'Fresh': { variant: 'default' as const, className: 'bg-success/10 text-success' },
      'Good': { variant: 'secondary' as const, className: 'bg-primary/10 text-primary' },
      'Aging': { variant: 'outline' as const, className: 'bg-warning/10 text-warning' },
      'Slow': { variant: 'outline' as const, className: 'bg-orange-100 text-orange-600' },
      'Dead': { variant: 'destructive' as const, className: 'bg-destructive/10 text-destructive' },
    };

    const config = variants[status as keyof typeof variants] || variants['Good'];
    
    return (
      <Badge variant={config.variant} className={config.className}>
        {status} ({avgDays}d)
      </Badge>
    );
  };

  // Get stock level badge
  const getStockLevelBadge = (availableToPick: number, totalStock: number) => {
    if (availableToPick === 0) {
      return <Badge variant="destructive">Fully Allocated</Badge>;
    } else if (availableToPick <= 10) {
      return <Badge variant="outline" className="border-warning text-warning">Low Available</Badge>;
    } else {
      return <Badge variant="default" className="bg-success/10 text-success">Available</Badge>;
    }
  };

  // Format currency
  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
    return `₹${value.toFixed(0)}`;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (processedStockData.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground mb-2">No Stock Data Found</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {selectedItem || selectedLocation?.warehouse 
            ? 'No stock found matching your search criteria'
            : 'No current stock available in any location'
          }
        </p>
        <Button onClick={onRefresh} variant="outline">
          Refresh Data
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12"></TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => handleSort('product_name')}
              >
                <div className="flex items-center gap-2">
                  Product Details
                  {getSortIcon('product_name')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => handleSort('warehouse_name')}
              >
                <div className="flex items-center gap-2">
                  Location
                  {getSortIcon('warehouse_name')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/30 transition-colors text-center"
                onClick={() => handleSort('current_stock')}
              >
                <div className="flex items-center gap-2 justify-center">
                  Current Stock
                  {getSortIcon('current_stock')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/30 transition-colors text-center"
                onClick={() => handleSort('allocated_stock')}
              >
                <div className="flex items-center gap-2 justify-center">
                  Allocated
                  {getSortIcon('allocated_stock')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/30 transition-colors text-center"
                onClick={() => handleSort('available_to_pick')}
              >
                <div className="flex items-center gap-2 justify-center">
                  Available to Pick
                  {getSortIcon('available_to_pick')}
                </div>
              </TableHead>
              <TableHead className="text-center">PO/RSO</TableHead>
              <TableHead className="text-center">Aging</TableHead>
              <TableHead className="text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((stock) => {
              const stockKey = `${stock.product_id}-${stock.warehouse_id}-${stock.bin_id}`;
              const isExpanded = expandedRows.has(stockKey);
              
              return (
                <Collapsible key={stockKey} open={isExpanded} onOpenChange={() => toggleRowExpansion(stockKey)}>
                  <CollapsibleTrigger asChild>
                    <TableRow className="cursor-pointer hover:bg-muted/30 transition-colors">
                      <TableCell>
                        {isExpanded ? 
                          <ChevronUp className="h-4 w-4" /> : 
                          <ChevronDown className="h-4 w-4" />
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-md">
                            <Package className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{stock.product_name}</div>
                            <div className="text-sm text-muted-foreground">SKU: {stock.product_sku}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-secondary" />
                          <div className="text-sm">
                            <div className="font-medium">{stock.warehouse_name}</div>
                            <div className="text-muted-foreground">{stock.bin_name}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-lg font-semibold">{stock.current_stock}</span>
                          <span className="text-xs text-muted-foreground">units</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-lg font-semibold text-warning">{stock.allocated_stock}</span>
                          <span className="text-xs text-muted-foreground">allocated</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-lg font-semibold text-success">{stock.available_to_pick}</span>
                          {getStockLevelBadge(stock.available_to_pick, stock.current_stock)}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col gap-1">
                          {stock.pending_po_qty > 0 && (
                            <Badge variant="outline" className="text-xs">
                              PO: {stock.pending_po_qty}
                            </Badge>
                          )}
                          {stock.pending_rso_qty > 0 && (
                            <Badge variant="outline" className="text-xs">
                              RSO: {stock.pending_rso_qty}
                            </Badge>
                          )}
                          {stock.pending_po_qty === 0 && stock.pending_rso_qty === 0 && (
                            <span className="text-xs text-muted-foreground">None</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {getAgingBadge(stock.aging_status, stock.weighted_avg_age_days)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-semibold">
                          {formatCurrency(stock.total_value)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          @₹{stock.unit_price}/unit
                        </div>
                      </TableCell>
                    </TableRow>
                  </CollapsibleTrigger>
                  <CollapsibleContent asChild>
                    <TableRow>
                      <TableCell colSpan={9} className="bg-muted/20 p-0">
                        <div className="p-6 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Sales Orders */}
                            {stock.sales_orders && stock.sales_orders.length > 0 && (
                              <Card className="border-warning/20">
                                <CardHeader className="pb-3">
                                  <CardTitle className="text-sm flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-warning" />
                                    Allocated to Sales Orders
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                  {stock.sales_orders.map((so, index) => (
                                    <div key={index} className="flex items-center justify-between p-2 bg-warning/5 rounded">
                                      <div>
                                        <div className="font-medium text-sm">{so.order_number}</div>
                                        <div className="text-xs text-muted-foreground">{so.customer_name}</div>
                                      </div>
                                      <Badge variant="outline" className="text-xs">
                                        {so.allocated_qty} units
                                      </Badge>
                                    </div>
                                  ))}
                                </CardContent>
                              </Card>
                            )}

                            {/* Purchase Orders */}
                            {stock.purchase_orders && stock.purchase_orders.length > 0 && (
                              <Card className="border-accent/20">
                                <CardHeader className="pb-3">
                                  <CardTitle className="text-sm flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-accent" />
                                    Incoming Purchase Orders
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                  {stock.purchase_orders.map((po, index) => (
                                    <div key={index} className="flex items-center justify-between p-2 bg-accent/5 rounded">
                                      <div>
                                        <div className="font-medium text-sm">{po.po_number}</div>
                                        <div className="text-xs text-muted-foreground">
                                          {po.supplier_name} | {po.expected_date}
                                        </div>
                                      </div>
                                      <Badge variant="outline" className="text-xs">
                                        {po.pending_qty} units
                                      </Badge>
                                    </div>
                                  ))}
                                </CardContent>
                              </Card>
                            )}

                            {/* Return Orders */}
                            {stock.return_orders && stock.return_orders.length > 0 && (
                              <Card className="border-destructive/20">
                                <CardHeader className="pb-3">
                                  <CardTitle className="text-sm flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-destructive" />
                                    Pending Returns
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                  {stock.return_orders.map((rso, index) => (
                                    <div key={index} className="flex items-center justify-between p-2 bg-destructive/5 rounded">
                                      <div>
                                        <div className="font-medium text-sm">{rso.rso_number}</div>
                                        <div className="text-xs text-muted-foreground">{rso.customer_name}</div>
                                      </div>
                                      <Badge variant="outline" className="text-xs">
                                        {rso.pending_qty} units
                                      </Badge>
                                    </div>
                                  ))}
                                </CardContent>
                              </Card>
                            )}
                          </div>

                          {/* Stock Transfer Suggestions */}
                          {stock.available_to_pick <= 10 && stock.available_to_pick > 0 && (
                            <div className="p-4 bg-warning/5 border border-warning/20 rounded-lg">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="h-4 w-4 text-warning" />
                                <span className="font-medium text-sm">Stock Transfer Recommendation</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Low available stock detected. Consider transferring from other locations or expediting purchase orders.
                              </p>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sortedData.length)} of {sortedData.length} entries
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};