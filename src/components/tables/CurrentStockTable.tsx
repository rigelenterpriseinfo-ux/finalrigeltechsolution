import { useState, useEffect, useMemo } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, AlertTriangle, Package, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, FileSpreadsheet, Filter, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { exportToExcel, formatCurrency, formatDate, ExportColumn } from '@/utils/excelExport';
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
  // Aging fields
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

interface AgingSummary {
  total_skus: number;
  total_qty: number;
  total_value: number;
  aging_0_30_qty: number;
  aging_0_30_value: number;
  aging_31_90_qty: number;
  aging_31_90_value: number;
  aging_91_180_qty: number;
  aging_91_180_value: number;
  aging_181_365_qty: number;
  aging_181_365_value: number;
  aging_365_plus_qty: number;
  aging_365_plus_value: number;
  dead_stock_skus: number;
  dead_stock_value: number;
}

interface WarehouseBinAging {
  warehouse_name: string;
  bin_name: string;
  location_display: string;
  aging_0_30_value: number;
  aging_31_90_value: number;
  aging_91_180_value: number;
  aging_181_365_value: number;
  aging_365_plus_value: number;
  total_value: number;
  total_qty: number;
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
  const [agingFilter, setAgingFilter] = useState<string>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [inventoryStats, setInventoryStats] = useState({
    totalSKUs: 0,
    totalQuantity: 0,
    totalValue: 0
  });
  const [agingSummary, setAgingSummary] = useState<AgingSummary | null>(null);
  const [warehouseBinAging, setWarehouseBinAging] = useState<WarehouseBinAging[]>([]);
  const [topLowStockItems, setTopLowStockItems] = useState<{name: string, qty: number}[]>([]);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [viewingStock, setViewingStock] = useState<CurrentStock | null>(null);
  const itemsPerPage = 5;

  useEffect(() => {
    fetchCurrentStock();
    fetchInventoryStats();
    fetchAgingSummary();
    fetchWarehouseBinAging();
  }, [company?.id, refreshTrigger]);

  const fetchCurrentStock = async () => {
    if (!company?.id) return;
    
    setLoading(true);
    try {
      // First try the current_stock_with_aging view
      const { data, error } = await supabase
        .from('current_stock_with_aging')
        .select(`
          *,
          products!inner(name, sku, min_stock_level, unit_price, cost_price),
          warehouse_bins!fk_inventory_transactions_warehouse_id(warehouse_name, bin_name)
        `)
        .eq('company_id', company.id)
        .order('current_stock', { ascending: true });

      if (error) {
        console.warn('Current stock levels view failed, falling back to inventory transactions:', error);
        // Fallback: Calculate stock levels from inventory_transactions
        await fetchStockFromTransactions();
        return;
      }

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
          // Map aging fields
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
      
      // Get top 5 low stock items
      const lowStockItems = formattedStock
        .filter(stock => stock.current_stock > 0 && stock.current_stock <= stock.min_stock_level)
        .sort((a, b) => a.current_stock - b.current_stock)
        .slice(0, 5)
        .map(stock => ({
          name: stock.product_name,
          qty: stock.current_stock
        }));
      
      setTopLowStockItems(lowStockItems);
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

  const fetchStockFromTransactions = async () => {
    try {
      // Get all inventory transactions and calculate current stock
      const { data: transactions, error: transError } = await supabase
        .from('inventory_transactions')
        .select(`
          product_id,
          warehouse_id,
          bin_id,
          quantity_change,
          transaction_date,
          products!inner(name, sku, min_stock_level, unit_price, cost_price),
          warehouse_bins!inner(warehouse_name, bin_name)
        `)
        .eq('company_id', company.id)
        .order('transaction_date', { ascending: false });

      if (transError) throw transError;

      // Calculate current stock by product, warehouse, and bin
      const stockMap = new Map<string, any>();
      
      transactions?.forEach((trans: any) => {
        const key = `${trans.product_id}-${trans.warehouse_id}-${trans.bin_id}`;
        
        if (!stockMap.has(key)) {
          const unitPrice = trans.products.unit_price || trans.products.cost_price || 0;
          stockMap.set(key, {
            company_id: company.id,
            product_id: trans.product_id,
            warehouse_id: trans.warehouse_id,
            bin_id: trans.bin_id,
            current_stock: 0,
            last_transaction_date: trans.transaction_date,
            transaction_count: 0,
            product_name: trans.products.name,
            product_sku: trans.products.sku,
            min_stock_level: trans.products.min_stock_level || 0,
            warehouse_name: trans.warehouse_bins.warehouse_name || 'N/A',
            bin_name: trans.warehouse_bins.bin_name || 'N/A',
            unit_price: unitPrice,
            cost_price: trans.products.cost_price || 0,
            total_value: 0
          });
        }
        
        const stock = stockMap.get(key);
        stock.current_stock += trans.quantity_change || 0;
        stock.transaction_count += 1;
        stock.total_value = stock.current_stock * stock.unit_price;
        
        // Update last transaction date if this is more recent
        if (new Date(trans.transaction_date) > new Date(stock.last_transaction_date)) {
          stock.last_transaction_date = trans.transaction_date;
        }
      });

      const formattedStock = Array.from(stockMap.values())
        .sort((a, b) => a.current_stock - b.current_stock);

      setStockLevels(formattedStock);
      
      // Get top 5 low stock items
      const lowStockItems = formattedStock
        .filter(stock => stock.current_stock > 0 && stock.current_stock <= stock.min_stock_level)
        .sort((a, b) => a.current_stock - b.current_stock)
        .slice(0, 5)
        .map(stock => ({
          name: stock.product_name,
          qty: stock.current_stock
        }));
      
      setTopLowStockItems(lowStockItems);
      
    } catch (error) {
      console.error('Fallback stock calculation failed:', error);
      toast({
        title: "Error",
        description: "Failed to calculate stock levels from transactions",
        variant: "destructive",
      });
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

  const fetchAgingSummary = async () => {
    if (!company?.id) return;
    
    try {
      const { data, error } = await supabase.rpc('get_company_aging_summary', {
        p_company_id: company.id
      });

      if (error) throw error;

      if (data && data.length > 0) {
        setAgingSummary(data[0]);
      }
    } catch (error) {
      console.error('Error fetching aging summary:', error);
    }
  };

  const fetchWarehouseBinAging = async () => {
    if (!company?.id) return;
    
    try {
      const { data, error } = await supabase.rpc('get_warehouse_bin_aging_summary', {
        p_company_id: company.id
      });

      if (error) throw error;

      setWarehouseBinAging(data || []);
    } catch (error) {
      console.error('Error fetching warehouse bin aging:', error);
    }
  };

  const getAgingBadge = (agingStatus: string, avgAge: number) => {
    switch (agingStatus) {
      case 'Fresh':
        return <Badge variant="default" className="bg-green-500 text-white">Fresh ({avgAge}d)</Badge>;
      case 'Good':
        return <Badge variant="secondary">Good ({avgAge}d)</Badge>;
      case 'Aging':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Aging ({avgAge}d)</Badge>;
      case 'Slow':
        return <Badge variant="outline" className="border-orange-500 text-orange-600">Slow ({avgAge}d)</Badge>;
      case 'Dead':
        return <Badge variant="destructive">Dead ({avgAge}d)</Badge>;
      default:
        return <Badge variant="secondary">N/A</Badge>;
    }
  };

  // Format compact currency values
  const formatCompactCurrency = (value: number) => {
    if (value === 0) return '₹0';
    if (value >= 10000000) { // 1 crore
      return `₹${(value / 10000000).toFixed(1)}Cr`;
    } else if (value >= 100000) { // 1 lakh
      return `₹${(value / 100000).toFixed(1)}L`;
    } else if (value >= 1000) { // 1 thousand
      return `₹${(value / 1000).toFixed(1)}K`;
    }
    return `₹${value.toFixed(0)}`;
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

  // Render aging breakdown row
  const renderAgingBreakdown = (stock: CurrentStock) => {
    if (!stock.aging_status) return null;
    
    return (
      <div className="p-4 bg-muted/20 border-t">
        <h4 className="text-sm font-medium mb-3">Aging Breakdown</h4>
        <div className="grid grid-cols-5 gap-4 text-xs">
          <div className="text-center">
            <div className="font-medium text-green-600">Fresh (0-30)</div>
            <div className="text-muted-foreground">Qty: {stock.aging_0_30_qty || 0}</div>
            <div className="text-muted-foreground">Val: {formatCompactCurrency(stock.aging_0_30_value || 0)}</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-blue-600">Good (31-90)</div>
            <div className="text-muted-foreground">Qty: {stock.aging_31_90_qty || 0}</div>
            <div className="text-muted-foreground">Val: {formatCompactCurrency(stock.aging_31_90_value || 0)}</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-yellow-600">Aging (91-180)</div>
            <div className="text-muted-foreground">Qty: {stock.aging_91_180_qty || 0}</div>
            <div className="text-muted-foreground">Val: {formatCompactCurrency(stock.aging_91_180_value || 0)}</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-orange-600">Slow (181-365)</div>
            <div className="text-muted-foreground">Qty: {stock.aging_181_365_qty || 0}</div>
            <div className="text-muted-foreground">Val: {formatCompactCurrency(stock.aging_181_365_value || 0)}</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-red-600">Dead (365+)</div>
            <div className="text-muted-foreground">Qty: {stock.aging_365_plus_qty || 0}</div>
            <div className="text-muted-foreground">Val: {formatCompactCurrency(stock.aging_365_plus_value || 0)}</div>
          </div>
        </div>
      </div>
    );
  };

  const filteredAndSortedStock = useMemo(() => {
    let filtered = stockLevels.filter((stock) => {
      const matchesSearch = 
        stock.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stock.product_sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stock.warehouse_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stock.bin_name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesLowStock = !showLowStockOnly || stock.current_stock <= stock.min_stock_level;
      
      // Aging filtering
      const matchesAging = agingFilter === 'all' || 
        (agingFilter === 'fresh' && stock.aging_status === 'Fresh') ||
        (agingFilter === 'good' && stock.aging_status === 'Good') ||
        (agingFilter === 'aging' && stock.aging_status === 'Aging') ||
        (agingFilter === 'slow' && stock.aging_status === 'Slow') ||
        (agingFilter === 'dead' && stock.aging_status === 'Dead');
      
      return matchesSearch && matchesLowStock && matchesAging;
    });

    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortConfig.key) {
          case 'product_name':
            aValue = a.product_name;
            bValue = b.product_name;
            break;
          case 'current_stock':
            aValue = a.current_stock;
            bValue = b.current_stock;
            break;
          case 'unit_price':
            aValue = a.unit_price;
            bValue = b.unit_price;
            break;
          case 'total_value':
            aValue = a.total_value;
            bValue = b.total_value;
            break;
          case 'min_stock_level':
            aValue = a.min_stock_level;
            bValue = b.min_stock_level;
            break;
          case 'last_transaction_date':
            aValue = new Date(a.last_transaction_date);
            bValue = new Date(b.last_transaction_date);
            break;
          default:
            aValue = a[sortConfig.key as keyof CurrentStock];
            bValue = b[sortConfig.key as keyof CurrentStock];
        }
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [stockLevels, searchTerm, showLowStockOnly, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedStock.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentStock = filteredAndSortedStock.slice(startIndex, endIndex);

  // Enhanced export functionality
  const handleExportToExcel = () => {
    const columns: ExportColumn[] = [
      { key: 'product_name', label: 'Product Name' },
      { key: 'product_sku', label: 'SKU' },
      { key: 'warehouse_name', label: 'Warehouse' },
      { key: 'bin_name', label: 'Bin Location' },
      { key: 'current_stock', label: 'Current Stock' },
      { key: 'unit_price', label: 'Unit Price', format: formatCurrency },
      { key: 'total_value', label: 'Total Value', format: formatCurrency },
      { key: 'min_stock_level', label: 'Min Stock Level' },
      { key: 'aging_status', label: 'Aging Status' },
      { key: 'weighted_avg_age_days', label: 'Avg Age (Days)' },
      { key: 'last_transaction_date', label: 'Last Transaction', format: formatDate },
      { key: 'transaction_count', label: 'Total Transactions' },
    ];

    const success = exportToExcel({
      filename: 'current_stock_levels',
      sheetName: 'Current Stock',
      columns,
      data: filteredAndSortedStock,
      companyName: company?.name || 'Company',
    });

    if (success) {
      toast({
        title: "Export Successful",
        description: "Current stock data exported to Excel",
      });
    } else {
      toast({
        title: "Export Failed",
        description: "Failed to export data to Excel",
        variant: "destructive",
      });
    }
  };

  // Process warehouse-bin breakdown data
  const warehouseBinData = useMemo(() => {
    const warehouseMap = new Map<string, {
      totalSKUs: number;
      totalQty: number;
      totalValue: number;
      bins: Map<string, { skus: number; qty: number; value: number }>;
    }>();

    stockLevels.forEach(stock => {
      const warehouseName = stock.warehouse_name || 'Unknown';
      const binName = stock.bin_name || 'Unknown';
      
      if (!warehouseMap.has(warehouseName)) {
        warehouseMap.set(warehouseName, {
          totalSKUs: 0,
          totalQty: 0,
          totalValue: 0,
          bins: new Map()
        });
      }
      
      const warehouse = warehouseMap.get(warehouseName)!;
      
      // Update warehouse totals
      warehouse.totalSKUs += 1;
      warehouse.totalQty += stock.current_stock || 0;
      warehouse.totalValue += (stock.current_stock || 0) * 10; // Assuming avg cost of 10 per unit
      
      // Update bin data
      if (!warehouse.bins.has(binName)) {
        warehouse.bins.set(binName, { skus: 0, qty: 0, value: 0 });
      }
      
      const bin = warehouse.bins.get(binName)!;
      bin.skus += 1;
      bin.qty += stock.current_stock || 0;
      bin.value += (stock.current_stock || 0) * 10;
    });

    return warehouseMap;
  }, [stockLevels]);

  const totalProducts = stockLevels.length;
  const totalQuantity = stockLevels.reduce((sum, stock) => sum + (stock.current_stock || 0), 0);
  const totalValue = stockLevels.reduce((sum, stock) => sum + ((stock.current_stock || 0) * 10), 0);
  const lowStockItems = stockLevels.filter(stock => stock.current_stock <= stock.min_stock_level && stock.current_stock > 0).length;
  const outOfStockItems = stockLevels.filter(stock => stock.current_stock <= 0).length;

  if (loading) {
    return <div className="flex justify-center items-center p-8">Loading current stock levels...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 border rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Total Inventory</span>
            </div>
          </div>
          
          {/* Overall Totals */}
          <div className="mb-4 p-3 bg-background/50 rounded-lg">
            <div className="flex justify-between items-center text-sm">
              <span className="font-semibold">SKUs: {totalProducts}</span>
              <span className="font-semibold">Qty: {totalQuantity.toLocaleString()}</span>
              <span className="font-semibold">Value: ₹{totalValue.toLocaleString()}</span>
            </div>
          </div>

          {/* Location Breakdown - Flattened View */}
          <div className="space-y-1">
            {Array.from(warehouseBinData.entries()).map(([warehouseName, warehouse]) => 
              Array.from(warehouse.bins.entries()).map(([binName, bin]) => (
                <div key={`${warehouseName}-${binName}`} className="flex items-center justify-between py-1 px-2 hover:bg-secondary/20 rounded text-xs">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-muted-foreground">🏢</span>
                    <span className="font-medium truncate">{warehouseName} - {binName}</span>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <span className="w-8">{bin.skus}</span>
                    <span className="w-12">{bin.qty}</span>
                    <span className="w-16">₹{bin.value.toLocaleString()}</span>
                  </div>
                </div>
              ))
            ).flat()}
          </div>
        </div>
        <div className="p-4 border rounded-lg bg-gradient-to-br from-amber-50 to-orange-50">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div>
              <p className="text-sm text-muted-foreground">Stock Analysis</p>
              <p className="text-lg font-bold text-amber-700">{lowStockItems} Low Stock • {agingSummary?.dead_stock_skus || 0} Dead Stock</p>
            </div>
          </div>
          
          {/* Aging Analysis by Category */}
          {agingSummary && (
            <div className="space-y-3">
              <div className="grid grid-cols-5 gap-2 text-xs">
                <div className="text-center p-2 bg-green-100 rounded-lg border border-green-200">
                  <div className="font-semibold text-green-700">Fresh</div>
                  <div className="text-green-600 font-mono">0-30 days</div>
                  <div className="mt-1">
                    <div className="font-bold text-green-800">{formatCompactCurrency(agingSummary.aging_0_30_value)}</div>
                    <div className="text-green-600">
                      {agingSummary.total_value > 0 ? 
                        Math.round((agingSummary.aging_0_30_value / agingSummary.total_value) * 100) : 0}%
                    </div>
                  </div>
                </div>
                
                <div className="text-center p-2 bg-blue-100 rounded-lg border border-blue-200">
                  <div className="font-semibold text-blue-700">Good</div>
                  <div className="text-blue-600 font-mono">31-90 days</div>
                  <div className="mt-1">
                    <div className="font-bold text-blue-800">{formatCompactCurrency(agingSummary.aging_31_90_value)}</div>
                    <div className="text-blue-600">
                      {agingSummary.total_value > 0 ? 
                        Math.round((agingSummary.aging_31_90_value / agingSummary.total_value) * 100) : 0}%
                    </div>
                  </div>
                </div>
                
                <div className="text-center p-2 bg-yellow-100 rounded-lg border border-yellow-200">
                  <div className="font-semibold text-yellow-700">Aging</div>
                  <div className="text-yellow-600 font-mono">91-180 days</div>
                  <div className="mt-1">
                    <div className="font-bold text-yellow-800">{formatCompactCurrency(agingSummary.aging_91_180_value)}</div>
                    <div className="text-yellow-600">
                      {agingSummary.total_value > 0 ? 
                        Math.round((agingSummary.aging_91_180_value / agingSummary.total_value) * 100) : 0}%
                    </div>
                  </div>
                </div>
                
                <div className="text-center p-2 bg-orange-100 rounded-lg border border-orange-200">
                  <div className="font-semibold text-orange-700">Slow</div>
                  <div className="text-orange-600 font-mono">181-365 days</div>
                  <div className="mt-1">
                    <div className="font-bold text-orange-800">{formatCompactCurrency(agingSummary.aging_181_365_value)}</div>
                    <div className="text-orange-600">
                      {agingSummary.total_value > 0 ? 
                        Math.round((agingSummary.aging_181_365_value / agingSummary.total_value) * 100) : 0}%
                    </div>
                  </div>
                </div>
                
                <div className="text-center p-2 bg-red-100 rounded-lg border border-red-200">
                  <div className="font-semibold text-red-700">Dead</div>
                  <div className="text-red-600 font-mono">365+ days</div>
                  <div className="mt-1">
                    <div className="font-bold text-red-800">{formatCompactCurrency(agingSummary.aging_365_plus_value)}</div>
                    <div className="text-red-600">
                      {agingSummary.total_value > 0 ? 
                        Math.round((agingSummary.aging_365_plus_value / agingSummary.total_value) * 100) : 0}%
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Total Summary */}
              <div className="p-2 bg-gray-100 rounded-lg border text-center">
                <div className="font-semibold text-gray-700">Total Inventory Value</div>
                <div className="text-lg font-bold text-gray-800">{formatCompactCurrency(agingSummary.total_value)}</div>
                <div className="text-sm text-gray-600">{agingSummary.total_skus} SKUs • {agingSummary.total_qty} Units</div>
              </div>
            </div>
          )}
        </div>
        <div className="p-4 border rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <div className="w-full">
              <p className="text-sm text-muted-foreground">Top 5 Low Stock Items</p>
              {topLowStockItems.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {topLowStockItems.map((item, index) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <span className="font-medium truncate">{item.name}</span>
                      <span className="text-orange-600 font-bold">{item.qty}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-2">No low stock items</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Filters and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by product name, SKU, warehouse, bin location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-background/50 border-border/50 focus:bg-background"
          />
        </div>
        
        <div className="flex gap-2 items-center">
          <Select value={agingFilter} onValueChange={setAgingFilter}>
            <SelectTrigger className="w-48 bg-background/50 border-border/50">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by aging" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Aging</SelectItem>
              <SelectItem value="fresh">Fresh (0-30 days)</SelectItem>
              <SelectItem value="good">Good (31-90 days)</SelectItem>
              <SelectItem value="aging">Aging (91-180 days)</SelectItem>
              <SelectItem value="slow">Slow (181-365 days)</SelectItem>
              <SelectItem value="dead">Dead (365+ days)</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant={showLowStockOnly ? "default" : "outline"}
            onClick={() => setShowLowStockOnly(!showLowStockOnly)}
            className="flex items-center gap-2"
          >
            <AlertTriangle className="h-4 w-4" />
            {showLowStockOnly ? 'Show All' : 'Low Stock Only'}
          </Button>
          
          <Button
            onClick={handleExportToExcel}
            variant="outline"
            className="flex items-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Stock Table */}
      {filteredAndSortedStock.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchTerm || showLowStockOnly ? 'No stock levels match your filters.' : 'No stock data found.'}
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => handleSort('product_name')}>
                  <div className="flex items-center space-x-2">
                    <span>Product</span>
                    {getSortIcon('product_name')}
                  </div>
                </TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => handleSort('current_stock')}>
                  <div className="flex items-center justify-end space-x-2">
                    <span>Current Stock</span>
                    {getSortIcon('current_stock')}
                  </div>
                </TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => handleSort('unit_price')}>
                  <div className="flex items-center justify-end space-x-2">
                    <span>Unit Price</span>
                    {getSortIcon('unit_price')}
                  </div>
                </TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => handleSort('total_value')}>
                  <div className="flex items-center justify-end space-x-2">
                    <span>Total Value</span>
                    {getSortIcon('total_value')}
                  </div>
                </TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => handleSort('min_stock_level')}>
                  <div className="flex items-center justify-end space-x-2">
                    <span>Min Stock</span>
                    {getSortIcon('min_stock_level')}
                  </div>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aging</TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('last_transaction_date')}>
                  <div className="flex items-center space-x-2">
                    <span>Last Transaction</span>
                    {getSortIcon('last_transaction_date')}
                  </div>
                </TableHead>
                <TableHead className="text-center">Txns</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentStock.map((stock) => {
                const stockKey = `${stock.product_id}-${stock.warehouse_id}-${stock.bin_id}`;
                const isExpanded = expandedRows.has(stockKey);
                
                return (
                  <>
                    <TableRow key={stockKey} className="hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <div>
                          <div className="font-medium text-foreground">{stock.product_name}</div>
                          <div className="text-sm text-muted-foreground">{stock.product_sku}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{stock.warehouse_name}</div>
                          <div className="text-sm text-muted-foreground">{stock.bin_name}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-lg font-semibold text-foreground">
                        {stock.current_stock}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        ₹{stock.unit_price.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-sm">
                        {formatCompactCurrency(stock.total_value)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-muted-foreground">
                        {stock.min_stock_level}
                      </TableCell>
                      <TableCell>
                        {getStockLevelBadge(stock.current_stock, stock.min_stock_level)}
                      </TableCell>
                      <TableCell>
                        {stock.aging_status && stock.weighted_avg_age_days !== undefined
                          ? getAgingBadge(stock.aging_status, stock.weighted_avg_age_days)
                          : <Badge variant="secondary">N/A</Badge>
                        }
                      </TableCell>
                      <TableCell>
                        {stock.last_transaction_date 
                          ? format(new Date(stock.last_transaction_date), 'MMM dd, yyyy')
                          : 'No transactions'
                        }
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-yellow-50 border-yellow-200 text-yellow-700">
                          {stock.transaction_count}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleRowExpansion(stockKey)}
                            title={isExpanded ? "Collapse aging details" : "Expand aging details"}
                            className="hover:bg-blue-50 hover:text-blue-600"
                            disabled={!stock.aging_status}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setViewingStock(stock);
                              setShowViewDialog(true);
                            }}
                            title="View Details"
                            className="hover:bg-green-50 hover:text-green-600"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={11} className="p-0">
                          {renderAgingBreakdown(stock)}
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredAndSortedStock.length)} of {filteredAndSortedStock.length} stock items
              </p>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* View Dialog */}
      <CurrentStockViewDialog
        open={showViewDialog}
        onOpenChange={setShowViewDialog}
        stock={viewingStock}
      />
    </div>
  );
};