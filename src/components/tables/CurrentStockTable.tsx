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
import { useIsMobile } from '@/hooks/use-mobile';
import { CurrentStockTableMobile } from './CurrentStockTableMobile';

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
  const isMobile = useIsMobile();
  const { company } = useAuth();
  const { toast } = useToast();

  // Helper function to calculate aging status from aging buckets
  const calculateAgingStatus = (stock: CurrentStock): string => {
    if (!stock.current_stock || stock.current_stock === 0) return 'N/A';
    
    if ((stock.aging_365_plus_qty || 0) > 0) return 'Dead';
    if ((stock.aging_181_365_qty || 0) > 0) return 'Slow';
    if ((stock.aging_91_180_qty || 0) > 0) return 'Aging';
    if ((stock.aging_31_90_qty || 0) > 0) return 'Good';
    if ((stock.aging_0_30_qty || 0) > 0) return 'Fresh';
    
    return 'N/A';
  };

  // Use mobile version if on mobile device
  if (isMobile) {
    return <CurrentStockTableMobile refreshTrigger={refreshTrigger} />;
  }
  const [stockLevels, setStockLevels] = useState<CurrentStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [agingFilter, setAgingFilter] = useState<string>('all');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [sortConfig, setSortConfig] = useState<{key: string; direction: 'asc' | 'desc'} | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [viewingStock, setViewingStock] = useState<CurrentStock | null>(null);

  // Summary states
  const [inventoryStats, setInventoryStats] = useState<any>({});
  const [agingSummary, setAgingSummary] = useState<AgingSummary | null>(null);
  const [warehouseBinAging, setWarehouseBinAging] = useState<WarehouseBinAging[]>([]);
  const [lowStockItems, setLowStockItems] = useState(0);
  const [topLowStockItems, setTopLowStockItems] = useState<Array<{name: string; qty: number}>>([]);

  useEffect(() => {
    if (company?.id) {
      fetchCurrentStock();
      fetchInventoryStats();
      fetchAgingSummary();
      fetchWarehouseBinAging();
    }
  }, [company?.id, refreshTrigger]);

  const fetchCurrentStock = async () => {
    try {
      setLoading(true);
      console.log('Fetching current stock levels...');
      
      // First get the current stock data
      const { data: stockData, error } = await supabase
        .from('current_stock_with_aging')
        .select('*')
        .eq('company_id', company?.id)
        .order('current_stock', { ascending: false });

      if (error) throw error;

      // Then get related data separately
      const productIds = [...new Set(stockData?.map(s => s.product_id))];

      const [productsData] = await Promise.all([
        supabase.from('products').select('id, name, sku, min_stock_level, unit_price, cost_price').in('id', productIds)
      ]);

      // Create lookup maps
      const productsMap = new Map(productsData.data?.map(p => [p.id, p]) || []);

      if (error) {
        console.error('Error fetching current stock:', error);
        throw error;
      }

      console.log('Stock data retrieved:', stockData?.length || 0, 'records');

      // Process and format the data with aging information
      const formattedStock: CurrentStock[] = (stockData || []).map(stock => {
        const product = productsMap.get(stock.product_id);
        const totalValue = stock.current_stock * (product?.unit_price || 0);
        
        return {
          company_id: stock.company_id,
          product_id: stock.product_id,
          warehouse_id: stock.warehouse_id,
          bin_id: stock.bin_id,
          current_stock: stock.current_stock || 0,
          last_transaction_date: stock.last_transaction_date,
          transaction_count: stock.transaction_count || 0,
          product_name: product?.name || 'Unknown Product',
          product_sku: product?.sku || 'N/A',
          min_stock_level: product?.min_stock_level || 0,
          warehouse_name: `Warehouse-${stock.warehouse_id?.toString().slice(-4) || 'Unknown'}`,
          bin_name: `Bin-${stock.bin_id?.toString().slice(-4) || 'Unknown'}`,
          unit_price: product?.unit_price || 0,
          cost_price: product?.cost_price || 0,
          total_value: totalValue,
          // Aging fields
          weighted_avg_age_days: stock.weighted_avg_age_days,
          aging_0_30_qty: stock.aging_0_30_qty,
          aging_0_30_value: stock.aging_0_30_value,
          aging_31_90_qty: stock.aging_31_90_qty,
          aging_31_90_value: stock.aging_31_90_value,
          aging_91_180_qty: stock.aging_91_180_qty,
          aging_91_180_value: stock.aging_91_180_value,
          aging_181_365_qty: stock.aging_181_365_qty,
          aging_181_365_value: stock.aging_181_365_value,
          aging_365_plus_qty: stock.aging_365_plus_qty,
          aging_365_plus_value: stock.aging_365_plus_value,
        };
      });

      setStockLevels(formattedStock);
      
      // Get top 5 low stock items
      const lowStockItems = formattedStock
        .filter(stock => stock.current_stock > 0 && stock.current_stock <= stock.min_stock_level)
        .sort((a, b) => (a.current_stock / Math.max(a.min_stock_level, 1)) - (b.current_stock / Math.max(b.min_stock_level, 1)))
        .slice(0, 5)
        .map(stock => ({
          name: stock.product_name,
          qty: stock.current_stock
        }));
      
      setTopLowStockItems(lowStockItems);
      setLowStockItems(lowStockItems.length);
      
      console.log('Current stock processed successfully');
    } catch (error) {
      console.error('Error in fetchCurrentStock:', error);
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
    try {
      const { data, error } = await supabase
        .from('current_stock_levels')
        .select('current_stock, transaction_count')
        .eq('company_id', company?.id);

      if (error) throw error;

      const stats = data?.reduce((acc: any, item) => {
        acc.totalItems = (acc.totalItems || 0) + 1;
        acc.totalStock = (acc.totalStock || 0) + item.current_stock;
        acc.totalTransactions = (acc.totalTransactions || 0) + item.transaction_count;
        return acc;
      }, {});

      setInventoryStats(stats || {});
    } catch (error) {
      console.error('Error fetching inventory stats:', error);
    }
  };

  const fetchAgingSummary = async () => {
    try {
      const { data, error } = await supabase
        .from('current_stock_with_aging')
        .select(`
          current_stock,
          aging_0_30_qty, aging_0_30_value,
          aging_31_90_qty, aging_31_90_value,
          aging_91_180_qty, aging_91_180_value,
          aging_181_365_qty, aging_181_365_value,
          aging_365_plus_qty, aging_365_plus_value,
          product_id
        `)
        .eq('company_id', company?.id);

      if (error) throw error;

      if (data && data.length > 0) {
        // Get products data separately
        const productIds = [...new Set(data.map(item => item.product_id))];
        const { data: productsData } = await supabase
          .from('products')
          .select('id, unit_price')
          .in('id', productIds);
        
        const productsMap = new Map(productsData?.map(p => [p.id, p]) || []);

        const summary = data.reduce((acc, item) => {
          const product = productsMap.get(item.product_id);
          const totalValue = item.current_stock * (product?.unit_price || 0);
          const isDeadStock = (item.aging_365_plus_qty || 0) > 0;
          
          return {
            total_skus: acc.total_skus + 1,
            total_qty: acc.total_qty + item.current_stock,
            total_value: acc.total_value + totalValue,
            aging_0_30_qty: acc.aging_0_30_qty + (item.aging_0_30_qty || 0),
            aging_0_30_value: acc.aging_0_30_value + (item.aging_0_30_value || 0),
            aging_31_90_qty: acc.aging_31_90_qty + (item.aging_31_90_qty || 0),
            aging_31_90_value: acc.aging_31_90_value + (item.aging_31_90_value || 0),
            aging_91_180_qty: acc.aging_91_180_qty + (item.aging_91_180_qty || 0),
            aging_91_180_value: acc.aging_91_180_value + (item.aging_91_180_value || 0),
            aging_181_365_qty: acc.aging_181_365_qty + (item.aging_181_365_qty || 0),
            aging_181_365_value: acc.aging_181_365_value + (item.aging_181_365_value || 0),
            aging_365_plus_qty: acc.aging_365_plus_qty + (item.aging_365_plus_qty || 0),
            aging_365_plus_value: acc.aging_365_plus_value + (item.aging_365_plus_value || 0),
            dead_stock_skus: isDeadStock ? acc.dead_stock_skus + 1 : acc.dead_stock_skus,
            dead_stock_value: isDeadStock ? acc.dead_stock_value + totalValue : acc.dead_stock_value,
          };
        }, {
          total_skus: 0,
          total_qty: 0,
          total_value: 0,
          aging_0_30_qty: 0,
          aging_0_30_value: 0,
          aging_31_90_qty: 0,
          aging_31_90_value: 0,
          aging_91_180_qty: 0,
          aging_91_180_value: 0,
          aging_181_365_qty: 0,
          aging_181_365_value: 0,
          aging_365_plus_qty: 0,
          aging_365_plus_value: 0,
          dead_stock_skus: 0,
          dead_stock_value: 0,
        });

        setAgingSummary(summary);
      }
    } catch (error) {
      console.error('Error fetching aging summary:', error);
    }
  };

  const fetchWarehouseBinAging = async () => {
    try {
      // Get stock with aging data
      const { data: stockData, error: stockError } = await supabase
        .from('current_stock_with_aging')
        .select(`
          warehouse_id, bin_id,
          aging_0_30_value, aging_31_90_value, aging_91_180_value,
          aging_181_365_value, aging_365_plus_value,
          current_stock, product_id
        `)
        .eq('company_id', company?.id);

      if (stockError) throw stockError;

      // Get product data
      const productIds = [...new Set(stockData?.map(s => s.product_id))];
      const [productsData] = await Promise.all([
        supabase.from('products').select('id, unit_price').in('id', productIds)
      ]);

      const productsMap = new Map(productsData.data?.map(p => [p.id, p]) || []);
      const warehouseBinMap = new Map();
      
      stockData?.forEach(item => {
        const key = `${item.warehouse_id}-${item.bin_id}`;
        const product = productsMap.get(item.product_id);
        const totalValue = item.current_stock * (product?.unit_price || 0);
        const warehouseName = `Warehouse-${item.warehouse_id?.toString().slice(-4) || 'Unknown'}`;
        const binName = `Bin-${item.bin_id?.toString().slice(-4) || 'Unknown'}`;
        
        if (!warehouseBinMap.has(key)) {
          warehouseBinMap.set(key, {
            warehouse_name: warehouseName,
            bin_name: binName,
            location_display: `${warehouseName} - ${binName}`,
            aging_0_30_value: 0,
            aging_31_90_value: 0,
            aging_91_180_value: 0,
            aging_181_365_value: 0,
            aging_365_plus_value: 0,
            total_value: 0,
            total_qty: 0,
          });
        }

        const existing = warehouseBinMap.get(key);
        warehouseBinMap.set(key, {
          ...existing,
          aging_0_30_value: existing.aging_0_30_value + (item.aging_0_30_value || 0),
          aging_31_90_value: existing.aging_31_90_value + (item.aging_31_90_value || 0),
          aging_91_180_value: existing.aging_91_180_value + (item.aging_91_180_value || 0),
          aging_181_365_value: existing.aging_181_365_value + (item.aging_181_365_value || 0),
          aging_365_plus_value: existing.aging_365_plus_value + (item.aging_365_plus_value || 0),
          total_value: existing.total_value + totalValue,
          total_qty: existing.total_qty + item.current_stock,
        });
      });

      setWarehouseBinAging(Array.from(warehouseBinMap.values()));
    } catch (error) {
      console.error('Error fetching warehouse bin aging:', error);
    }
  };

  const formatCompactCurrency = (value: number) => {
    if (value === 0) return '₹0';
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
    return `₹${value.toFixed(0)}`;
  };

  const getAgingBadge = (status: string, avgDays: number) => {
    const variants = {
      'Fresh': { variant: 'default' as const, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
      'Good': { variant: 'secondary' as const, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
      'Aging': { variant: 'outline' as const, color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' },
      'Slow': { variant: 'outline' as const, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
      'Dead': { variant: 'destructive' as const, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
    };

    const config = variants[status as keyof typeof variants] || variants['Good'];
    
    return (
      <div className={`text-xs px-2 py-1 rounded-md border ${config.bg} ${config.color} font-medium`}>
        {status} ({avgDays}d)
      </div>
    );
  };

  const getStockLevelBadge = (currentStock: number, minStock: number) => {
    if (currentStock === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    } else if (currentStock <= minStock) {
      return <Badge variant="outline" className="border-orange-500 text-orange-600">Low Stock</Badge>;
    } else {
      return <Badge variant="default">In Stock</Badge>;
    }
  };

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
    const agingStatus = calculateAgingStatus(stock);
    if (!agingStatus || agingStatus === 'N/A') return null;
    
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
      const agingStatus = calculateAgingStatus(stock);
      const matchesAging = agingFilter === 'all' || 
        (agingFilter === 'fresh' && agingStatus === 'Fresh') ||
        (agingFilter === 'good' && agingStatus === 'Good') ||
        (agingFilter === 'aging' && agingStatus === 'Aging') ||
        (agingFilter === 'slow' && agingStatus === 'Slow') ||
        (agingFilter === 'dead' && agingStatus === 'Dead');
      
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
  }, [stockLevels, searchTerm, showLowStockOnly, agingFilter, sortConfig]);

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
      warehouse.totalSKUs += 1;
      warehouse.totalQty += stock.current_stock;
      warehouse.totalValue += stock.total_value;
      
      if (!warehouse.bins.has(binName)) {
        warehouse.bins.set(binName, { skus: 0, qty: 0, value: 0 });
      }
      
      const bin = warehouse.bins.get(binName)!;
      bin.skus += 1;
      bin.qty += stock.current_stock;
      bin.value += stock.total_value;
    });

    return Array.from(warehouseMap.entries()).map(([name, data]) => ({
      name,
      ...data,
      bins: Array.from(data.bins.entries()).map(([binName, binData]) => ({
        name: binName,
        ...binData
      }))
    }));
  }, [stockLevels]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 border rounded-lg">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total SKUs</p>
              <p className="text-2xl font-bold text-blue-600">{inventoryStats.totalItems || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="p-4 border rounded-lg">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Stock Quantity</p>
              <p className="text-2xl font-bold text-green-600">{inventoryStats.totalStock?.toLocaleString() || 0}</p>
            </div>
          </div>
        </div>

        <div className="p-4 border rounded-lg">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-purple-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-2xl font-bold text-purple-600">
                {agingSummary ? formatCompactCurrency(agingSummary.total_value) : '₹0'}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 border rounded-lg">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-gray-500" />
            <div>
              <p className="text-sm text-muted-foreground">Warehouse-Bin Locations</p>
              <p className="text-2xl font-bold text-gray-600">
                {warehouseBinData.reduce((total, wh) => total + wh.bins.length, 0)}
              </p>
              <div className="text-xs text-muted-foreground mt-1">
                {warehouseBinData.map((wh, idx) => (
                  <div key={wh.name} className="truncate">
                    {wh.name}: {wh.bins.map(b => b.name).join(', ')}
                  </div>
                )).flat()}
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-4 border rounded-lg bg-gradient-to-br from-amber-50 to-orange-50">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Stock Analysis - {searchTerm ? 'Filtered Results' : 'All Items'}</p>
              <p className="text-lg font-bold text-amber-700">
                {filteredAndSortedStock.filter(s => s.current_stock > 0 && s.current_stock <= s.min_stock_level).length} Low Stock • 
                {filteredAndSortedStock.filter(s => calculateAgingStatus(s) === 'Dead').length} Dead Stock
              </p>
            </div>
          </div>
          
          {/* Real-time Stock Details for Filtered Items */}
          {filteredAndSortedStock.length > 0 && (
            <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
              <p className="text-sm font-medium text-amber-700 border-b pb-1">
                Showing {filteredAndSortedStock.length} item{filteredAndSortedStock.length !== 1 ? 's' : ''}
                {searchTerm && ` matching "${searchTerm}"`}
              </p>
              {filteredAndSortedStock.slice(0, 10).map((stock, index) => (
                <div key={`${stock.product_id}-${stock.warehouse_id}-${stock.bin_id}`} 
                     className="flex justify-between items-start p-2 bg-white/70 rounded border border-amber-200">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 text-sm truncate">
                      {stock.product_name}
                    </div>
                    <div className="text-xs text-gray-600 flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      {stock.warehouse_name} - {stock.bin_name}
                    </div>
                  </div>
                  <div className="text-right text-xs space-y-1 min-w-[120px]">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Current:</span>
                      <span className="font-mono font-medium">{stock.current_stock}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Available:</span>
                      <span className="font-mono font-medium text-green-700">
                        {Math.max(0, stock.current_stock)} {/* Available to bill = current stock for now */}
                      </span>
                    </div>
                    {stock.current_stock <= stock.min_stock_level && stock.current_stock > 0 && (
                      <div className="text-xs text-orange-600 font-medium">⚠ Low Stock</div>
                    )}
                  </div>
                </div>
              ))}
              {filteredAndSortedStock.length > 10 && (
                <div className="text-xs text-center text-muted-foreground py-1 border-t">
                  ... and {filteredAndSortedStock.length - 10} more items
                </div>
              )}
            </div>
          )}
          
          {/* Aging Analysis by Category */}
          {agingSummary && (
            <div className="space-y-3 mt-4">
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
            className="pl-10"
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Select value={agingFilter} onValueChange={setAgingFilter}>
            <SelectTrigger className="w-[140px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Aging Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ages</SelectItem>
              <SelectItem value="fresh">Fresh (0-30d)</SelectItem>
              <SelectItem value="good">Good (31-90d)</SelectItem>
              <SelectItem value="aging">Aging (91-180d)</SelectItem>
              <SelectItem value="slow">Slow (181-365d)</SelectItem>
              <SelectItem value="dead">Dead (365d+)</SelectItem>
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
            className="flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export to Excel
          </Button>
        </div>
      </div>

      {/* Stock Table */}
      {filteredAndSortedStock.length === 0 ? (
        <div className="text-center py-8">
          <Package className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-sm font-semibold text-muted-foreground">No stock found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {searchTerm ? 'No stock matches your search criteria.' : 'No stock levels available.'}
          </p>
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('product_name')}
                >
                  <div className="flex items-center gap-2">
                    Product Name
                    {getSortIcon('product_name')}
                  </div>
                </TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Location</TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('current_stock')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Current Stock
                    {getSortIcon('current_stock')}
                  </div>
                </TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('unit_price')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Unit Price
                    {getSortIcon('unit_price')}
                  </div>
                </TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('total_value')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Total Value
                    {getSortIcon('total_value')}
                  </div>
                </TableHead>
                <TableHead className="text-right">Min Stock</TableHead>
                <TableHead>Stock Level</TableHead>
                <TableHead>Aging Status</TableHead>
                <TableHead>Last Transaction</TableHead>
                <TableHead className="text-center">Transactions</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentStock.map((stock) => {
                const stockKey = `${stock.product_id}-${stock.warehouse_id}-${stock.bin_id}`;
                const isExpanded = expandedRows.has(stockKey);
                
                return (
                  <>
                    <TableRow key={stockKey} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <div className="max-w-xs">
                          <div className="truncate">{stock.product_name}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">
                          {stock.product_sku}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{stock.warehouse_name}</div>
                          <div className="text-muted-foreground text-xs">{stock.bin_name}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-sm">
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
                        {stock.weighted_avg_age_days !== undefined
                          ? getAgingBadge(calculateAgingStatus(stock), stock.weighted_avg_age_days)
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
                            disabled={calculateAgingStatus(stock) === 'N/A'}
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