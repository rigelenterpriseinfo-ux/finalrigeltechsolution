import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, AlertTriangle, Package } from 'lucide-react';
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

interface CurrentStockTableProps {
  refreshTrigger?: number;
}

export const CurrentStockTable = ({ refreshTrigger }: CurrentStockTableProps) => {
  const { company } = useAuth();
  const { toast } = useToast();
  const [stockLevels, setStockLevels] = useState<CurrentStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [inventoryStats, setInventoryStats] = useState({
    totalSKUs: 0,
    totalQuantity: 0,
    totalValue: 0
  });

  useEffect(() => {
    fetchCurrentStock();
    fetchInventoryStats();
  }, [company?.id, refreshTrigger]);

  const fetchCurrentStock = async () => {
    if (!company?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('current_stock_levels')
        .select(`
          *,
          products!inner(name, sku, min_stock_level),
          warehouse_bins!inner(warehouse_name, bin_name)
        `)
        .eq('company_id', company.id)
        .order('current_stock', { ascending: true });

      if (error) throw error;

      const formattedStock: CurrentStock[] = data?.map((stock: any) => ({
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
        warehouse_name: stock.warehouse_bins.warehouse_name || 'N/A',
        bin_name: stock.warehouse_bins.bin_name
      })) || [];

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

  const fetchInventoryStats = async () => {
    if (!company?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('inventory_transactions')
        .select('product_id, quantity_change, total_value')
        .eq('company_id', company.id);

      if (error) throw error;

      const uniqueProducts = new Set(data?.map(t => t.product_id) || []);
      const totalQuantity = data?.reduce((sum, t) => sum + Math.abs(t.quantity_change || 0), 0) || 0;
      const totalValue = data?.reduce((sum, t) => sum + Math.abs(t.total_value || 0), 0) || 0;

      setInventoryStats({
        totalSKUs: uniqueProducts.size,
        totalQuantity,
        totalValue
      });
    } catch (error) {
      console.error('Error fetching inventory stats:', error);
    }
  };

  const getStockLevelBadge = (currentStock: number, minStock: number) => {
    if (currentStock <= 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    } else if (currentStock <= minStock) {
      return <Badge variant="outline" className="border-orange-500 text-orange-600">Low Stock</Badge>;
    } else {
      return <Badge variant="default">In Stock</Badge>;
    }
  };

  const filteredStock = stockLevels.filter((stock) => {
    const matchesSearch = 
      stock.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      stock.product_sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      stock.warehouse_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      stock.bin_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesLowStock = !showLowStockOnly || stock.current_stock <= stock.min_stock_level;
    
    return matchesSearch && matchesLowStock;
  });

  const totalProducts = stockLevels.length;
  const lowStockItems = stockLevels.filter(stock => stock.current_stock <= stock.min_stock_level && stock.current_stock > 0).length;
  const outOfStockItems = stockLevels.filter(stock => stock.current_stock <= 0).length;

  if (loading) {
    return <div className="flex justify-center items-center p-8">Loading current stock levels...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 border rounded-lg">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Total SKUs</p>
              <p className="text-2xl font-bold">{totalProducts}</p>
            </div>
          </div>
        </div>
        <div className="p-4 border rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <div>
              <p className="text-sm text-muted-foreground">Low Stock</p>
              <p className="text-2xl font-bold text-orange-600">{lowStockItems}</p>
            </div>
          </div>
        </div>
        <div className="p-4 border rounded-lg">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Inventory Overview</p>
              <div className="flex gap-4 mt-2">
                <div>
                  <p className="text-xs text-muted-foreground">SKU Count</p>
                  <p className="text-lg font-bold">{inventoryStats.totalSKUs}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Qty</p>
                  <p className="text-lg font-bold">{inventoryStats.totalQuantity.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Value</p>
                  <p className="text-lg font-bold">₹{inventoryStats.totalValue.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by product, SKU, warehouse..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant={showLowStockOnly ? "default" : "outline"}
          onClick={() => setShowLowStockOnly(!showLowStockOnly)}
          className="flex items-center gap-2"
        >
          <AlertTriangle className="h-4 w-4" />
          {showLowStockOnly ? 'Show All' : 'Low Stock Only'}
        </Button>
      </div>

      {/* Stock Table */}
      {filteredStock.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchTerm || showLowStockOnly ? 'No stock levels match your filters.' : 'No stock data found.'}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Current Stock</TableHead>
              <TableHead className="text-right">Min Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Transaction</TableHead>
              <TableHead className="text-right">Transactions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStock.map((stock) => (
              <TableRow key={`${stock.product_id}-${stock.warehouse_id}-${stock.bin_id}`}>
                <TableCell>
                  <div>
                    <div className="font-medium">{stock.product_name}</div>
                    <div className="text-sm text-muted-foreground">{stock.product_sku}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{stock.warehouse_name}</div>
                    <div className="text-sm text-muted-foreground">{stock.bin_name}</div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-lg font-semibold">
                  {stock.current_stock}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {stock.min_stock_level}
                </TableCell>
                <TableCell>
                  {getStockLevelBadge(stock.current_stock, stock.min_stock_level)}
                </TableCell>
                <TableCell>
                  {stock.last_transaction_date 
                    ? format(new Date(stock.last_transaction_date), 'MMM dd, yyyy')
                    : 'No transactions'
                  }
                </TableCell>
                <TableCell className="text-right">
                  {stock.transaction_count}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};