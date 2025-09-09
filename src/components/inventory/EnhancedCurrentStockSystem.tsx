import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ItemSearchBox } from './ItemSearchBox';
import { LocationSearchBox } from './LocationSearchBox';
import { StockSummaryCards } from './StockSummaryCards';
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

      {/* Summary Cards */}
      <StockSummaryCards 
        data={summaryData}
        loading={loading}
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
          />
        </CardContent>
      </Card>
    </div>
  );
};