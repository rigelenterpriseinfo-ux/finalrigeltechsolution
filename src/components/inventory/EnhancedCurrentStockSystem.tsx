import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ItemSearchBox } from './ItemSearchBox';
import { LocationSearchBox } from './LocationSearchBox';
import { StockAnalysisPanel } from './StockAnalysisPanel';
import { ComprehensiveStockTable } from './ComprehensiveStockTable';
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
      
      // Get current stock with aging
      const { data: stockData, error: stockError } = await supabase
        .from('current_stock_with_aging')
        .select(`
          product_id, warehouse_id, bin_id, current_stock,
          aging_status, weighted_avg_age_days,
          products!inner(name, sku, unit_price)
        `)
        .eq('company_id', company.id)
        .gt('current_stock', 0);

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

      // Process and combine the data
      const processedData: StockData[] = (stockData || []).map(stock => {
        const binDetails = binMap.get(stock.bin_id);
        const warehouseName = binDetails?.warehouse_name || 'Unknown Warehouse';
        const binName = binDetails?.bin_name || 'Unknown Bin';

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
          product_name: stock.products?.name || 'Unknown Product',
          product_sku: stock.products?.sku || 'N/A',
          warehouse_id: stock.warehouse_id,
          warehouse_name: warehouseName,
          bin_id: stock.bin_id,
          bin_name: binName,
          current_stock: stock.current_stock,
          allocated_stock: locationAllocated,
          available_to_pick: availableToPick,
          pending_po_qty: totalPendingPO,
          pending_rso_qty: totalPendingRSO,
          aging_status: stock.aging_status || 'Good',
          weighted_avg_age_days: stock.weighted_avg_age_days || 0,
          unit_price: stock.products?.unit_price || 0,
          total_value: stock.current_stock * (stock.products?.unit_price || 0),
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
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Package className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Current Stock Management</h1>
            <p className="text-muted-foreground">Advanced inventory tracking and allocation management</p>
          </div>
        </div>
      </div>

      {/* Search Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="card-elevated">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Item Search
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ItemSearchBox
              value={selectedItem}
              onChange={setSelectedItem}
              onRefresh={handleRefresh}
            />
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-secondary" />
              Location Search
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LocationSearchBox
              value={selectedLocation}
              onChange={setSelectedLocation}
              onRefresh={handleRefresh}
            />
          </CardContent>
        </Card>
      </div>

      {/* Stock Analysis Panel */}
      <StockAnalysisPanel 
        stockData={filteredStockData}
        loading={loading}
        selectedItem={selectedItem}
        selectedLocation={selectedLocation}
      />

      {/* Main Stock Table */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-accent" />
            Stock Analysis & Allocation Tracking
          </CardTitle>
          {(selectedItem || selectedLocation.warehouse || selectedLocation.bin) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              Filtered results - showing {filteredStockData.length} of {stockData.length} stock entries
            </div>
          )}
        </CardHeader>
        <CardContent>
          <ComprehensiveStockTable
            stockData={filteredStockData}
            loading={loading}
            onRefresh={handleRefresh}
            selectedItem={selectedItem}
            selectedLocation={selectedLocation}
            processedStockData={stockData}
          />
        </CardContent>
      </Card>
    </div>
  );
};