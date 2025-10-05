import React, { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Warehouse, TrendingUp, AlertTriangle } from 'lucide-react';
import { useInventoryData } from '@/hooks/useInventoryData';
import { useNavigate } from 'react-router-dom';

interface InventorySectionProps {
  companyId?: string;
}

const InventorySectionComponent: React.FC<InventorySectionProps> = ({ companyId }) => {
  const { data, isLoading } = useInventoryData(companyId);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Inventory & Warehouse</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Inventory & Warehouse</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Warehouse Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Warehouse className="h-5 w-5" />
              Warehouse Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data?.warehouseStocks && data.warehouseStocks.length > 0 ? (
                data.warehouseStocks.map((wh) => (
                  <div key={wh.warehouseId} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold text-sm">{wh.warehouseName}</p>
                      <span className="text-xs text-muted-foreground">
                        {wh.totalQty} units
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Value: ₹{wh.totalValue.toLocaleString('en-IN')}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No warehouses configured
                </p>
              )}
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full"
                onClick={() => navigate('/dashboard?module=inventory')}
              >
                View Details
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Top Value Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Top Value Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data?.topValueItems && data.topValueItems.length > 0 ? (
                data.topValueItems.map((item) => (
                  <div key={item.productId} className="flex items-center justify-between p-2 border rounded hover:bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity} units • {item.sku}
                      </p>
                      {/* Mini sparkline */}
                      <div className="h-6 flex items-end gap-0.5 mt-1">
                        {item.movement.map((val, idx) => {
                          const maxVal = Math.max(...item.movement);
                          const height = maxVal > 0 ? (Math.abs(val) / maxVal) * 100 : 0;
                          return (
                            <div
                              key={idx}
                              className="flex-1 bg-primary/30 rounded-sm"
                              style={{ height: `${Math.max(height, 5)}%` }}
                            />
                          );
                        })}
                      </div>
                    </div>
                    <span className="text-sm font-semibold ml-2">
                      ₹{item.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No inventory data
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Damage Stock Alert */}
        <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-amber-500/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Damaged Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Damaged Value (90d)</p>
                <p className="text-2xl font-bold text-amber-600">
                  ₹{(data?.damagedValue || 0).toLocaleString('en-IN')}
                </p>
              </div>
              {data?.damagedLocations && data.damagedLocations.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Affected Locations:</p>
                  <div className="space-y-1">
                    {data.damagedLocations.map((loc, idx) => (
                      <div key={idx} className="text-xs px-2 py-1 bg-amber-500/10 rounded">
                        {loc}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full"
                onClick={() => navigate('/dashboard?module=inventory')}
              >
                View Details
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Memoize to prevent unnecessary re-renders
export const InventorySection = memo(InventorySectionComponent);
