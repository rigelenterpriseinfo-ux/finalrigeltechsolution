import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Search, Package, AlertTriangle, ChevronDown, ChevronUp, Eye, Filter } from 'lucide-react';
import { CurrentStockViewDialog } from '@/components/dialogs/CurrentStockViewDialog';

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
  unit_price: number;
  cost_price: number;
  total_value: number;
  weighted_avg_age_days?: number;
  aging_status?: 'Fresh' | 'Good' | 'Aging' | 'Slow' | 'Dead';
  aging_0_30_qty?: number;
  aging_0_30_value?: number;
  aging_31_90_qty?: number;
  aging_31_90_value?: number;
  aging_91_180_qty?: number;
  aging_91_180_value?: number;
  aging_181_365_qty?: number;
  aging_181_365_value?: number;
  aging_365_plus_qty?: number;
  aging_365_plus_value?: number;
}

interface CurrentStockTableMobileProps {
  refreshTrigger?: number;
}

export const CurrentStockTableMobile = ({ refreshTrigger }: CurrentStockTableMobileProps) => {
  const { company } = useAuth();
  const { toast } = useToast();
  const [stockLevels, setStockLevels] = useState<CurrentStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [agingFilter, setAgingFilter] = useState<string>('all');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [viewingStock, setViewingStock] = useState<CurrentStock | null>(null);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchCurrentStock();
  }, [company?.id, refreshTrigger]);

  const fetchCurrentStock = async () => {
    if (!company?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('current_stock_with_aging')
        .select(`
          *,
          products!inner(name, sku, min_stock_level, unit_price, cost_price),
          warehouse_bins!fk_inventory_transactions_warehouse_id(warehouse_name, bin_name)
        `)
        .eq('company_id', company.id)
        .order('current_stock', { ascending: true });

      if (error) throw error;

      const formattedStock: CurrentStock[] = data?.map((stock: any) => {
        const unitPrice = stock.products.unit_price || stock.products.cost_price || 0;
        const totalValue = (stock.current_stock || 0) * unitPrice;
        
        return {
          company_id: stock.company_id,
          product_id: stock.product_id,
          warehouse_id: stock.warehouse_id,
          bin_id: stock.bin_id,
          current_stock: stock.current_stock,
          last_transaction_date: stock.last_transaction_date,
          transaction_count: stock.transaction_count,
          product_name: stock.products.name,
          product_sku: stock.products.sku,
          min_stock_level: stock.products.min_stock_level || 0,
          warehouse_name: stock.warehouse_bins?.warehouse_name || 'N/A',
          bin_name: stock.warehouse_bins?.bin_name || 'N/A',
          unit_price: unitPrice,
          cost_price: stock.products.cost_price || 0,
          total_value: totalValue,
          weighted_avg_age_days: stock.weighted_avg_age_days,
          aging_status: stock.aging_status,
          aging_0_30_qty: stock.aging_0_30_qty,
          aging_0_30_value: stock.aging_0_30_value,
          aging_31_90_qty: stock.aging_31_90_qty,
          aging_31_90_value: stock.aging_31_90_value,
          aging_91_180_qty: stock.aging_91_180_qty,
          aging_91_180_value: stock.aging_91_180_value,
          aging_181_365_qty: stock.aging_181_365_qty,
          aging_181_365_value: stock.aging_181_365_value,
          aging_365_plus_qty: stock.aging_365_plus_qty,
          aging_365_plus_value: stock.aging_365_plus_value
        };
      }) || [];

      setStockLevels(formattedStock);
    } catch (error) {
      console.error('Error fetching current stock:', error);
      toast({
        title: "Error",
        description: "Failed to fetch current stock levels",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStockLevelBadge = (currentStock: number, minStock: number) => {
    if (currentStock <= 0) {
      return <Badge variant="destructive" className="text-xs">Out of Stock</Badge>;
    } else if (currentStock <= minStock) {
      return <Badge variant="outline" className="border-orange-500 text-orange-600 text-xs">Low Stock</Badge>;
    } else {
      return <Badge variant="default" className="text-xs">In Stock</Badge>;
    }
  };

  const getAgingBadge = (agingStatus: string, avgAge: number) => {
    switch (agingStatus) {
      case 'Fresh':
        return <Badge variant="default" className="bg-green-500 text-white text-xs">Fresh ({avgAge}d)</Badge>;
      case 'Good':
        return <Badge variant="secondary" className="text-xs">Good ({avgAge}d)</Badge>;
      case 'Aging':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600 text-xs">Aging ({avgAge}d)</Badge>;
      case 'Slow':
        return <Badge variant="outline" className="border-orange-500 text-orange-600 text-xs">Slow ({avgAge}d)</Badge>;
      case 'Dead':
        return <Badge variant="destructive" className="text-xs">Dead ({avgAge}d)</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">N/A</Badge>;
    }
  };

  const formatCurrency = (value: number) => {
    if (value === 0) return '₹0';
    if (value >= 10000000) {
      return `₹${(value / 10000000).toFixed(1)}Cr`;
    } else if (value >= 100000) {
      return `₹${(value / 100000).toFixed(1)}L`;
    } else if (value >= 1000) {
      return `₹${(value / 1000).toFixed(1)}K`;
    }
    return `₹${value.toFixed(0)}`;
  };

  const toggleExpanded = (stockKey: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(stockKey)) {
      newExpanded.delete(stockKey);
    } else {
      newExpanded.add(stockKey);
    }
    setExpandedCards(newExpanded);
  };

  const filteredStock = useMemo(() => {
    return stockLevels.filter((stock) => {
      const matchesSearch = 
        stock.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stock.product_sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stock.warehouse_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stock.bin_name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesLowStock = !showLowStockOnly || stock.current_stock <= stock.min_stock_level;
      
      const matchesAging = agingFilter === 'all' || 
        (agingFilter === 'fresh' && stock.aging_status === 'Fresh') ||
        (agingFilter === 'good' && stock.aging_status === 'Good') ||
        (agingFilter === 'aging' && stock.aging_status === 'Aging') ||
        (agingFilter === 'slow' && stock.aging_status === 'Slow') ||
        (agingFilter === 'dead' && stock.aging_status === 'Dead');
      
      return matchesSearch && matchesLowStock && matchesAging;
    });
  }, [stockLevels, searchTerm, showLowStockOnly, agingFilter]);

  const totalPages = Math.ceil(filteredStock.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedStock = filteredStock.slice(startIndex, startIndex + itemsPerPage);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-muted-foreground">Loading stock levels...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search products, SKU, warehouse..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            <Select value={agingFilter} onValueChange={setAgingFilter}>
              <SelectTrigger className="flex-1">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Aging" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Aging</SelectItem>
                <SelectItem value="fresh">Fresh</SelectItem>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="aging">Aging</SelectItem>
                <SelectItem value="slow">Slow</SelectItem>
                <SelectItem value="dead">Dead</SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              variant={showLowStockOnly ? "default" : "outline"}
              onClick={() => setShowLowStockOnly(!showLowStockOnly)}
              className="whitespace-nowrap"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Low Stock
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stock Items */}
      {paginatedStock.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No stock items found</p>
          </CardContent>
        </Card>
      ) : (
        paginatedStock.map((stock) => {
          const stockKey = `${stock.product_id}-${stock.warehouse_id}-${stock.bin_id}`;
          const isExpanded = expandedCards.has(stockKey);
          
          return (
            <Card key={stockKey} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base font-medium truncate">
                      {stock.product_name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      SKU: {stock.product_sku}
                    </p>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2 ml-4">
                    {getStockLevelBadge(stock.current_stock, stock.min_stock_level)}
                    {stock.aging_status && stock.weighted_avg_age_days && 
                      getAgingBadge(stock.aging_status, Math.round(stock.weighted_avg_age_days))
                    }
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Current Stock</p>
                    <p className="text-lg font-semibold">{stock.current_stock}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Value</p>
                    <p className="text-lg font-semibold">{formatCurrency(stock.total_value)}</p>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location:</span>
                    <span className="font-medium">{stock.warehouse_name} - {stock.bin_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Min Stock:</span>
                    <span>{stock.min_stock_level}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unit Price:</span>
                    <span>₹{stock.unit_price.toFixed(2)}</span>
                  </div>
                </div>
                
                {stock.aging_status && (
                  <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(stockKey)}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full mt-3 p-2 h-auto">
                        <div className="flex items-center justify-between w-full">
                          <span className="text-sm font-medium">Aging Breakdown</span>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3 mt-3 pt-3 border-t">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="text-center p-2 bg-green-50 rounded">
                          <div className="font-medium text-green-700">0-30 Days</div>
                          <div>Qty: {stock.aging_0_30_qty || 0}</div>
                          <div>Val: {formatCurrency(stock.aging_0_30_value || 0)}</div>
                        </div>
                        <div className="text-center p-2 bg-blue-50 rounded">
                          <div className="font-medium text-blue-700">31-90 Days</div>
                          <div>Qty: {stock.aging_31_90_qty || 0}</div>
                          <div>Val: {formatCurrency(stock.aging_31_90_value || 0)}</div>
                        </div>
                        <div className="text-center p-2 bg-yellow-50 rounded">
                          <div className="font-medium text-yellow-700">91-180 Days</div>
                          <div>Qty: {stock.aging_91_180_qty || 0}</div>
                          <div>Val: {formatCurrency(stock.aging_91_180_value || 0)}</div>
                        </div>
                        <div className="text-center p-2 bg-orange-50 rounded">
                          <div className="font-medium text-orange-700">181-365 Days</div>
                          <div>Qty: {stock.aging_181_365_qty || 0}</div>
                          <div>Val: {formatCurrency(stock.aging_181_365_value || 0)}</div>
                        </div>
                        <div className="text-center p-2 bg-red-50 rounded col-span-2">
                          <div className="font-medium text-red-700">365+ Days (Dead)</div>
                          <div>Qty: {stock.aging_365_plus_qty || 0} | Val: {formatCurrency(stock.aging_365_plus_value || 0)}</div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
                
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setViewingStock(stock);
                      setShowViewDialog(true);
                    }}
                    className="flex-1"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-3 text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {/* View Dialog */}
      <CurrentStockViewDialog 
        stock={viewingStock}
        open={showViewDialog}
        onOpenChange={setShowViewDialog}
      />
    </div>
  );
};