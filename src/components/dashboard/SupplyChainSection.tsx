import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, TrendingUp, Clock, Warehouse, AlertTriangle, ShoppingCart } from 'lucide-react';
import { usePurchaseData } from '@/hooks/usePurchaseData';
import { useInventoryData } from '@/hooks/useInventoryData';
import { useNavigate } from 'react-router-dom';

interface SupplyChainSectionProps {
  companyId?: string;
}

export const SupplyChainSection: React.FC<SupplyChainSectionProps> = ({ companyId }) => {
  const { data: purchaseData } = usePurchaseData(companyId);
  const { data: inventoryData } = useInventoryData(companyId);
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Supply Chain Overview</h2>
          <p className="text-sm text-muted-foreground">Purchase & Inventory Management</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Purchase Orders Summary */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Purchase Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{purchaseData?.openPOCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              ₹{(purchaseData?.totalOpenPOValue || 0).toLocaleString()} total value
            </p>
            <Button
              variant="link"
              size="sm"
              className="mt-2 h-auto p-0"
              onClick={() => navigate('/dashboard?module=purchase')}
            >
              View Purchase Orders →
            </Button>
          </CardContent>
        </Card>

        {/* Pending Receipts */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Receipts</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{purchaseData?.pendingReceipts?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Items awaiting receipt
            </p>
            {purchaseData?.pendingReceipts && purchaseData.pendingReceipts.length > 0 && (
              <div className="mt-3 space-y-2">
                {purchaseData.pendingReceipts.slice(0, 2).map((item) => (
                  <div key={item.id} className="text-xs flex items-center justify-between">
                    <span className="truncate flex-1">{item.productName}</span>
                    <Badge variant="outline" className="ml-2">
                      {item.quantity - item.receivedQty} pending
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Vendors */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Vendors</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {purchaseData?.topVendors?.slice(0, 3).map((vendor, idx) => (
                <div key={vendor.supplierId} className="flex items-center justify-between text-sm">
                  <span className="truncate flex-1">{idx + 1}. {vendor.supplierName}</span>
                  <div className="text-right ml-2">
                    <div className="font-semibold">₹{vendor.totalValue.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">{vendor.openPOCount} POs</div>
                  </div>
                </div>
              ))}
              {(!purchaseData?.topVendors || purchaseData.topVendors.length === 0) && (
                <p className="text-sm text-muted-foreground">No vendor data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Warehouse Stock Levels */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warehouse Stock</CardTitle>
            <Warehouse className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {inventoryData?.warehouseStocks?.slice(0, 3).map((warehouse) => (
                <div key={warehouse.warehouseId} className="flex items-center justify-between text-sm">
                  <span className="truncate flex-1">{warehouse.warehouseName}</span>
                  <div className="text-right ml-2">
                    <div className="font-semibold">{warehouse.totalQty.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">
                      ₹{warehouse.totalValue.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
              {(!inventoryData?.warehouseStocks || inventoryData.warehouseStocks.length === 0) && (
                <p className="text-sm text-muted-foreground">No warehouse data</p>
              )}
            </div>
            <Button
              variant="link"
              size="sm"
              className="mt-2 h-auto p-0"
              onClick={() => navigate('/dashboard?module=inventory')}
            >
              View Inventory →
            </Button>
          </CardContent>
        </Card>

        {/* Top Value Items */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Value Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {inventoryData?.topValueItems?.slice(0, 3).map((item) => (
                <div key={item.productId} className="flex items-center justify-between text-sm">
                  <span className="truncate flex-1">{item.productName}</span>
                  <div className="text-right ml-2">
                    <div className="font-semibold">₹{item.totalValue.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">{item.quantity} units</div>
                  </div>
                </div>
              ))}
              {(!inventoryData?.topValueItems || inventoryData.topValueItems.length === 0) && (
                <p className="text-sm text-muted-foreground">No inventory data</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Damaged/Adjusted Stock */}
        <Card className="hover:shadow-lg transition-shadow border-orange-500/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Damaged Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              ₹{(inventoryData?.damagedValue || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {inventoryData?.damagedLocations || 0} locations affected
            </p>
            <Button
              variant="link"
              size="sm"
              className="mt-2 h-auto p-0 text-orange-600"
              onClick={() => navigate('/dashboard?module=inventory')}
            >
              Review Adjustments →
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
