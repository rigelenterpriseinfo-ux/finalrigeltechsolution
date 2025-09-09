import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { MapPin, Building, Package, X, RefreshCw } from 'lucide-react';

interface WarehouseBin {
  warehouse_id: string;
  warehouse_name: string;
  bin_id: string;
  bin_name: string;
  bin_code: string;
  stock_count: number;
  total_value: number;
}

interface LocationSearchBoxProps {
  value: {warehouse: string, bin: string};
  onChange: (value: {warehouse: string, bin: string}) => void;
  onRefresh: () => void;
}

export const LocationSearchBox = ({ value, onChange, onRefresh }: LocationSearchBoxProps) => {
  const { company } = useAuth();
  const [locations, setLocations] = useState<WarehouseBin[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch locations with stock data
  useEffect(() => {
    if (company?.id) {
      fetchLocations();
    }
  }, [company?.id]);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      
      // Get current stock data
      const { data: stockData, error: stockError } = await supabase
        .from('current_stock_levels')
        .select(`
          warehouse_id,
          bin_id,
          current_stock,
          products!inner(unit_price)
        `)
        .eq('company_id', company?.id)
        .gt('current_stock', 0);

      if (stockError) throw stockError;

      // Get warehouse bin details
      const { data: binData, error: binError } = await supabase
        .from('warehouse_bins')
        .select('id, warehouse_name, bin_name, wh_bin_code')
        .eq('company_id', company?.id)
        .eq('is_active', true);

      if (binError) throw binError;

      // Create a map of bin details
      const binMap = new Map(binData?.map(bin => [bin.id, bin]) || []);

      // Group by warehouse and bin
      const locationMap = new Map<string, WarehouseBin>();

      stockData?.forEach(stock => {
        const key = `${stock.warehouse_id}-${stock.bin_id}`;
        const binDetails = binMap.get(stock.bin_id);
        const warehouseName = binDetails?.warehouse_name || 'Unknown Warehouse';
        const binName = binDetails?.bin_name || 'Unknown Bin';
        const binCode = binDetails?.wh_bin_code || `${warehouseName}-${binName}`;
        const stockValue = stock.current_stock * (stock.products?.unit_price || 0);

        if (!locationMap.has(key)) {
          locationMap.set(key, {
            warehouse_id: stock.warehouse_id,
            warehouse_name: warehouseName,
            bin_id: stock.bin_id,
            bin_name: binName,
            bin_code: binCode,
            stock_count: 0,
            total_value: 0,
          });
        }

        const existing = locationMap.get(key)!;
        existing.stock_count += stock.current_stock;
        existing.total_value += stockValue;
      });

      setLocations(Array.from(locationMap.values()).sort((a, b) => 
        a.warehouse_name.localeCompare(b.warehouse_name) || a.bin_name.localeCompare(b.bin_name)
      ));
    } catch (error) {
      console.error('Error fetching locations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Group locations by warehouse
  const warehouseGroups = useMemo(() => {
    const groups = new Map<string, WarehouseBin[]>();
    
    locations.forEach(location => {
      if (!groups.has(location.warehouse_id)) {
        groups.set(location.warehouse_id, []);
      }
      groups.get(location.warehouse_id)!.push(location);
    });

    return Array.from(groups.entries()).map(([warehouseId, bins]) => ({
      warehouse_id: warehouseId,
      warehouse_name: bins[0].warehouse_name,
      bins: bins.sort((a, b) => a.bin_name.localeCompare(b.bin_name)),
      total_stock: bins.reduce((sum, bin) => sum + bin.stock_count, 0),
      total_value: bins.reduce((sum, bin) => sum + bin.total_value, 0),
    }));
  }, [locations]);

  // Get available bins for selected warehouse
  const availableBins = useMemo(() => {
    if (!value.warehouse) return [];
    return locations.filter(loc => loc.warehouse_id === value.warehouse);
  }, [locations, value.warehouse]);

  // Get selected location details
  const selectedLocation = locations.find(loc => 
    loc.warehouse_id === value.warehouse && loc.bin_id === value.bin
  );

  const handleWarehouseChange = (warehouseId: string) => {
    onChange({ warehouse: warehouseId, bin: '' });
  };

  const handleBinChange = (binId: string) => {
    // Handle "all-bins" selection as empty string internally
    const actualBinId = binId === 'all-bins' ? '' : binId;
    onChange({ warehouse: value.warehouse, bin: actualBinId });
  };

  const handleClear = () => {
    onChange({ warehouse: '', bin: '' });
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
    return `₹${amount.toFixed(0)}`;
  };

  return (
    <div className="space-y-4">
      {/* Warehouse Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2">
          <Building className="h-4 w-4 text-secondary" />
          Warehouse
        </label>
        <div className="flex gap-2">
          <Select value={value.warehouse} onValueChange={handleWarehouseChange}>
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Select warehouse..." />
            </SelectTrigger>
            <SelectContent>
              {warehouseGroups.map((group) => (
                <SelectItem key={group.warehouse_id} value={group.warehouse_id}>
                  <div className="flex items-center justify-between w-full">
                    <span>{group.warehouse_name}</span>
                    <div className="flex items-center gap-2 ml-4">
                      <Badge variant="outline" className="text-xs">
                        {group.bins.length} bins
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {group.total_stock} units
                      </Badge>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="h-12 px-3"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Bin Selection */}
      {value.warehouse && (
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Package className="h-4 w-4 text-accent" />
            Bin Location
          </label>
          <Select value={value.bin || 'all-bins'} onValueChange={handleBinChange}>
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Select bin location..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-bins">All Bins in Warehouse</SelectItem>
              {availableBins.map((bin) => (
                <SelectItem key={bin.bin_id} value={bin.bin_id}>
                  <div className="flex items-center justify-between w-full">
                    <span>{bin.bin_name} ({bin.bin_code})</span>
                    <div className="flex items-center gap-2 ml-4">
                      <Badge variant="outline" className="text-xs">
                        {bin.stock_count} units
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {formatCurrency(bin.total_value)}
                      </Badge>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Selected Location Display */}
      {(value.warehouse || value.bin) && (
        <Card className="p-3 bg-secondary/5 border-secondary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="p-2 bg-secondary/10 rounded-md">
                <MapPin className="h-4 w-4 text-secondary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">
                  {selectedLocation ? `${selectedLocation.warehouse_name} - ${selectedLocation.bin_name}` : `All locations in ${warehouseGroups.find(g => g.warehouse_id === value.warehouse)?.warehouse_name}`}
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedLocation ? (
                    <>Stock: {selectedLocation.stock_count} units | Value: {formatCurrency(selectedLocation.total_value)}</>
                  ) : (
                    <>
                      {availableBins.length} bin locations | 
                      {availableBins.reduce((sum, bin) => sum + bin.stock_count, 0)} total units
                    </>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{warehouseGroups.length} warehouses | {locations.length} bin locations</span>
        <span>Total stock: {locations.reduce((sum, loc) => sum + loc.stock_count, 0)} units</span>
      </div>
    </div>
  );
};