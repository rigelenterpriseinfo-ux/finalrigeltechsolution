import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ItemSearchBox } from './ItemSearchBox';
import { LocationSearchBox } from './LocationSearchBox';
import { StockAnalysisPanel } from './StockAnalysisPanel';
import { ComprehensiveStockTable } from './ComprehensiveStockTable';
import { OpenTransactionsTable } from './OpenTransactionsTable';
import { Package, MapPin, TrendingUp, AlertTriangle } from 'lucide-react';

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

export const EnhancedCurrentStockSystem = () => {
  const { company } = useAuth();
  const { toast } = useToast();
  
  const [stockData, setStockData] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<{warehouse: string, bin: string}>({warehouse: '', bin: ''});
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch comprehensive stock data
  const fetchComprehensiveStockData = useCallback(async () => {
    if (!company?.id) return;

    try {
      setLoading(true);
      
      // Get current stock levels from inventory transactions
      const { data: stockData, error: stockError } = await supabase
        .from('inventory_transactions')
        .select(`
          product_id, warehouse_id, bin_id, quantity_change,
          transaction_date, unit_cost,
          products!inner(name, sku, unit_price, company_id)
        `)
        .eq('products.company_id', company.id)
        .order('transaction_date', { ascending: false });

      if (stockError) throw stockError;

      // Get warehouse bin details
      const { data: binData, error: binError } = await supabase
        .from('warehouse_bins')
        .select('id, warehouse_name, bin_name, wh_bin_code')
        .eq('company_id', company.id)
        .eq('is_active', true);

      if (binError) throw binError;

      // Create a map of bin details
      const binMap = new Map<string, any>(binData?.map(bin => [bin.id, bin]) || []);

      // Get allocated stock from sales orders
      const { data: allocatedData, error: allocatedError } = await supabase
        .from('sales_order_items')
        .select(`
          product_id, quantity,
          sales_orders!inner(
            id, order_number, status
          )
        `)
        .eq('sales_orders.company_id', company.id)
        .in('sales_orders.status', ['confirmed', 'partially_delivered']);

      if (allocatedError) throw allocatedError;

      // Get pending purchase orders
      const { data: poData, error: poError } = await supabase
        .from('purchase_order_items')
        .select(`
          product_id, pending_quantity,
          purchase_orders!inner(
            po_number, expected_date,
            suppliers!inner(name)
          )
        `)
        .eq('purchase_orders.company_id', company.id)
        .eq('purchase_orders.status', 'open')
        .gt('pending_quantity', 0);

      if (poError) throw poError;

      // Get pending returns
      const { data: rsoData, error: rsoError } = await supabase
        .from('credit_note_items')
        .select(`
          product_id, pending_return_qty,
          credit_notes!inner(
            cn_number, customer_name
          )
        `)
        .eq('credit_notes.company_id', company.id)
        .eq('credit_notes.status', 'confirmed')
        .gt('pending_return_qty', 0);

      if (rsoError) throw rsoError;

      // Calculate current stock levels by product/warehouse/bin
      const stockMap = new Map<string, {
        product_id: string;
        warehouse_id: string;
        bin_id: string;
        current_stock: number;
        product_details: any;
        oldest_transaction_date: Date;
      }>();

      // Process inventory transactions to calculate current stock
      (stockData || []).forEach(transaction => {
        const key = `${transaction.product_id}-${transaction.warehouse_id || 'default'}-${transaction.bin_id || 'default'}`;
        const existing = stockMap.get(key);
        
        if (existing) {
          existing.current_stock += transaction.quantity_change || 0;
          // Track oldest transaction for aging
          const transactionDate = new Date(transaction.transaction_date);
          if (transactionDate < existing.oldest_transaction_date) {
            existing.oldest_transaction_date = transactionDate;
          }
        } else {
          stockMap.set(key, {
            product_id: transaction.product_id,
            warehouse_id: transaction.warehouse_id || 'default',
            bin_id: transaction.bin_id || 'default',
            current_stock: transaction.quantity_change || 0,
            product_details: transaction.products,
            oldest_transaction_date: new Date(transaction.transaction_date)
          });
        }
      });

      // Filter out zero/negative stock and convert to array
      const currentStock = Array.from(stockMap.values())
        .filter(stock => stock.current_stock > 0);

      // Process and combine the data
      const processedData: StockData[] = currentStock.map(stock => {
        const binDetails = binMap.get(stock.bin_id);
        const warehouseName = binDetails?.warehouse_name || 'Unknown Warehouse';
        const binName = binDetails?.bin_name || 'Unknown Bin';

        // Calculate aging
        const daysDiff = Math.floor((Date.now() - stock.oldest_transaction_date.getTime()) / (1000 * 60 * 60 * 24));
        let agingStatus = 'Good';
        if (daysDiff > 365) agingStatus = 'Dead';
        else if (daysDiff > 180) agingStatus = 'Slow';
        else if (daysDiff > 90) agingStatus = 'Aging';
        else if (daysDiff < 30) agingStatus = 'Fresh';

        // Calculate allocated stock for this product (simplified - no location-specific allocation)
        const locationAllocated = (allocatedData || [])
          .filter(alloc => alloc.product_id === stock.product_id)
          .reduce((sum, alloc) => sum + (alloc.quantity || 0), 0);

        // Get sales orders affecting this stock
        const salesOrders = (allocatedData || [])
          .filter(alloc => alloc.product_id === stock.product_id)
          .map(alloc => ({
            order_number: alloc.sales_orders?.order_number || '',
            allocated_qty: alloc.quantity || 0,
            customer_name: 'Customer', // Simplified since customer_name not available
          }));

        // Get purchase orders for this product
        const purchaseOrders = (poData || [])
          .filter(po => po.product_id === stock.product_id)
          .map(po => ({
            po_number: po.purchase_orders?.po_number || '',
            pending_qty: po.pending_quantity || 0,
            supplier_name: po.purchase_orders?.suppliers?.name || '',
            expected_date: po.purchase_orders?.expected_date || '',
          }));

        // Get return orders for this product
        const returnOrders = (rsoData || [])
          .filter(rso => rso.product_id === stock.product_id)
          .map(rso => ({
            rso_number: rso.credit_notes?.cn_number || '',
            pending_qty: rso.pending_return_qty || 0,
            customer_name: rso.credit_notes?.customer_name || '',
          }));

        const totalPendingPO = purchaseOrders.reduce((sum, po) => sum + po.pending_qty, 0);
        const totalPendingRSO = returnOrders.reduce((sum, rso) => sum + rso.pending_qty, 0);
        const availableToPick = Math.max(0, stock.current_stock - locationAllocated);

        return {
          product_id: stock.product_id,
          product_name: stock.product_details?.name || 'Unknown Product',
          product_sku: stock.product_details?.sku || 'N/A',
          warehouse_id: stock.warehouse_id,
          warehouse_name: warehouseName,
          bin_id: stock.bin_id,
          bin_name: binName,
          current_stock: stock.current_stock,
          allocated_stock: locationAllocated,
          available_to_pick: availableToPick,
          pending_po_qty: totalPendingPO,
          pending_rso_qty: totalPendingRSO,
          aging_status: agingStatus,
          weighted_avg_age_days: daysDiff,
          unit_price: stock.product_details?.unit_price || 0,
          total_value: stock.current_stock * (stock.product_details?.unit_price || 0),
          sales_orders: salesOrders,
          purchase_orders: purchaseOrders,
          return_orders: returnOrders,
        };
      });

      setStockData(processedData); // Update stockData for summary calculations
      setStockData(processedData); // Update stockData for summary calculations
    } catch (error) {
      console.error('Error fetching comprehensive stock data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch stock data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [company?.id, toast]);

  useEffect(() => {
    fetchComprehensiveStockData();
  }, [fetchComprehensiveStockData, refreshTrigger]);

  // Refresh function
  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Filtered stock data based on search criteria
  const filteredStockData = useMemo(() => {
    let filtered = stockData;

    if (selectedItem) {
      filtered = filtered.filter(stock => 
        stock.product_id === selectedItem ||
        stock.product_name.toLowerCase().includes(selectedItem.toLowerCase()) ||
        stock.product_sku.toLowerCase().includes(selectedItem.toLowerCase())
      );
    }

    if (selectedLocation.warehouse || selectedLocation.bin) {
      filtered = filtered.filter(stock => {
        const warehouseMatch = !selectedLocation.warehouse || stock.warehouse_id === selectedLocation.warehouse;
        const binMatch = !selectedLocation.bin || stock.bin_id === selectedLocation.bin;
        return warehouseMatch && binMatch;
      });
    }

    return filtered;
  }, [stockData, selectedItem, selectedLocation]);

  // Check if we have specific item + warehouse + bin selected for detailed view
  const hasSpecificSelection = selectedItem && selectedLocation.warehouse && selectedLocation.bin;

  // Summary calculations
  const summaryData = useMemo(() => {
    const data = filteredStockData;
    return {
      totalLocations: new Set(data.map(s => `${s.warehouse_id}-${s.bin_id}`)).size,
      totalProducts: new Set(data.map(s => s.product_id)).size,
      totalStock: data.reduce((sum, s) => sum + s.current_stock, 0),
      totalValue: data.reduce((sum, s) => sum + s.total_value, 0),
      availableToPick: data.reduce((sum, s) => sum + s.available_to_pick, 0),
      allocatedStock: data.reduce((sum, s) => sum + s.allocated_stock, 0),
      inTransitQty: data.reduce((sum, s) => sum + s.pending_po_qty, 0),
      returnPendingQty: data.reduce((sum, s) => sum + s.pending_rso_qty, 0),
      lowStockItems: data.filter(s => s.current_stock > 0 && s.available_to_pick <= 10).length,
      deadStockItems: data.filter(s => s.aging_status === 'Dead').length,
    };
  }, [filteredStockData]);

  return (
    <div className="space-y-8 p-6">
      {/* Enhanced Summary Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold text-primary">{summaryData.totalProducts}</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-full">
                <Package className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-secondary/5 to-secondary/10 border-secondary/20 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Locations</p>
                <p className="text-2xl font-bold text-secondary">{summaryData.totalLocations}</p>
              </div>
              <div className="p-3 bg-secondary/10 rounded-full">
                <MapPin className="h-6 w-6 text-secondary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/20 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Stock</p>
                <p className="text-2xl font-bold text-green-600">{summaryData.totalStock.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">units</p>
              </div>
              <div className="p-3 bg-green-500/10 rounded-full">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-accent/5 to-accent/10 border-accent/20 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold text-accent">₹{(summaryData.totalValue / 100000).toFixed(1)}L</p>
                <p className="text-xs text-muted-foreground">inventory value</p>
              </div>
              <div className="p-3 bg-accent/10 rounded-full">
                <Package className="h-6 w-6 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Search Interface */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Item Search Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Item Search</h2>
              <p className="text-sm text-muted-foreground">Find products by name, SKU, or barcode</p>
            </div>
          </div>
          <Card className="border-l-4 border-l-primary bg-gradient-to-r from-primary/5 to-transparent hover:shadow-md transition-all duration-300">
            <CardContent className="p-6">
              <ItemSearchBox
                value={selectedItem}
                onChange={setSelectedItem}
                onRefresh={handleRefresh}
              />
            </CardContent>
          </Card>
        </div>

        {/* Location Search Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-secondary/10 rounded-lg">
              <MapPin className="h-6 w-6 text-secondary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Location Search</h2>
              <p className="text-sm text-muted-foreground">Select warehouse and bin locations</p>
            </div>
          </div>
          <Card className="border-l-4 border-l-secondary bg-gradient-to-r from-secondary/5 to-transparent hover:shadow-md transition-all duration-300">
            <CardContent className="p-6">
              <LocationSearchBox
                value={selectedLocation}
                onChange={setSelectedLocation}
                onRefresh={handleRefresh}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Stock Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        <Card className="bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/20">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{summaryData.availableToPick.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Available to Pick</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/5 to-orange-500/10 border-orange-500/20">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">{summaryData.allocatedStock.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Allocated Stock</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/5 to-purple-500/10 border-purple-500/20">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">{summaryData.inTransitQty.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">In Transit</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/5 to-red-500/10 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div className="text-center">
                <p className="text-xl font-bold text-red-600">{summaryData.lowStockItems}</p>
                <p className="text-sm text-muted-foreground">Low Stock Items</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Open Transactions Table - Show when specific item + warehouse + bin are selected */}
      {hasSpecificSelection && (
        <div className="mt-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-accent/10 rounded-lg">
              <Package className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Transaction Details</h2>
              <p className="text-sm text-muted-foreground">Open transactions for selected item and location</p>
            </div>
          </div>
          <OpenTransactionsTable
            selectedProductId={selectedItem}
            selectedWarehouseId={selectedLocation.warehouse}
            selectedBinId={selectedLocation.bin}
            loading={loading}
          />
        </div>
      )}
    </div>
  );
};