import React, { memo, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Package, TrendingUp, Users } from 'lucide-react';
import { usePurchaseData } from '@/hooks/usePurchaseData';
import { useNavigate } from 'react-router-dom';

interface PurchaseSectionProps {
  companyId?: string;
}

const PurchaseSectionComponent: React.FC<PurchaseSectionProps> = ({ companyId }) => {
  const { data, isLoading } = usePurchaseData(companyId);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Purchase & Procurement</h3>
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
      <h3 className="text-xl font-semibold">Purchase & Procurement</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Pending Receipts */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Awaiting Receipt
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.pendingReceipts && data.pendingReceipts.length > 0 ? (
              data.pendingReceipts.map((item) => {
                const progress = (item.receivedQty / item.quantity) * 100;
                return (
                  <div key={item.id} className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-semibold">{item.productName}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity} units • {item.supplierName}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {item.daysPending}d ago
                      </span>
                    </div>
                    <Progress value={progress} className="h-2 mb-2" />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {item.receivedQty}/{item.quantity} received ({Math.round(progress)}%)
                      </span>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => navigate('/dashboard?module=purchase')}
                      >
                        Receive
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                All items have been received
              </p>
            )}
          </CardContent>
        </Card>

        {/* Open POs & Top Vendors */}
        <div className="space-y-4">
          {/* Total Open POs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4" />
                Open Purchase Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{data?.openPOCount || 0}</span>
                  <span className="text-sm text-muted-foreground">POs</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Value: ₹{(data?.totalOpenPOValue || 0).toLocaleString('en-IN')}
                </p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full mt-2"
                  onClick={() => navigate('/dashboard?module=purchase')}
                >
                  View All
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Top Vendors */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" />
                Top Vendors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data?.topVendors && data.topVendors.length > 0 ? (
                  data.topVendors.map((vendor) => (
                    <div key={vendor.supplierId} className="flex items-center justify-between p-2 border rounded hover:bg-muted/50">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{vendor.supplierName}</p>
                        <p className="text-xs text-muted-foreground">
                          {vendor.openPOCount} POs
                        </p>
                      </div>
                      <span className="text-sm font-semibold">
                        ₹{vendor.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No pending vendors
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

// Memoize to prevent unnecessary re-renders
export const PurchaseSection = memo(PurchaseSectionComponent);
