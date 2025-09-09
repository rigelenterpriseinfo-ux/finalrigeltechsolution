import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  ArrowDownUp 
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface StockAnalysisPanelProps {
  stockData: StockData[];
  loading?: boolean;
  selectedItem?: string;
  selectedLocation?: {warehouse: string, bin: string};
}

export const StockAnalysisPanel = ({ 
  stockData, 
  loading, 
  selectedItem, 
  selectedLocation 
}: StockAnalysisPanelProps) => {
  
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-muted rounded mb-2"></div>
              <div className="h-8 bg-muted rounded mb-2"></div>
              <div className="h-3 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Aggregate data for the analysis
  const analysis = React.useMemo(() => {
    const totalCurrentStock = stockData.reduce((sum, item) => sum + item.current_stock, 0);
    const totalAllocated = stockData.reduce((sum, item) => sum + item.allocated_stock, 0);
    const totalAvailableToPick = stockData.reduce((sum, item) => sum + item.available_to_pick, 0);
    const totalInTransit = stockData.reduce((sum, item) => sum + item.pending_po_qty, 0);
    const totalReturnPending = stockData.reduce((sum, item) => sum + item.pending_rso_qty, 0);

    // Get all sales orders
    const allSalesOrders = stockData.flatMap(item => item.sales_orders || []);
    
    // Get all purchase orders  
    const allPurchaseOrders = stockData.flatMap(item => item.purchase_orders || []);
    
    // Get all return orders
    const allReturnOrders = stockData.flatMap(item => item.return_orders || []);

    return {
      totalCurrentStock,
      totalAllocated,
      totalAvailableToPick,
      totalInTransit,
      totalReturnPending,
      allSalesOrders,
      allPurchaseOrders,
      allReturnOrders
    };
  }, [stockData]);

  if (stockData.length === 0) {
    return (
      <Card className="col-span-full">
        <CardContent className="p-8 text-center">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {selectedItem || selectedLocation?.warehouse 
              ? 'No stock found for selected criteria' 
              : 'Select an item or location to view detailed stock analysis'
            }
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Available Stock */}
        <Card className="border-success/20 bg-success/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" />
              Available Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-success">
                {analysis.totalCurrentStock}
              </div>
              <p className="text-xs text-muted-foreground">
                Current physical stock minus allocated quantities
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Allocated Stock */}
        <Card className="border-warning/20 bg-warning/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              Allocated Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-warning">
                {analysis.totalAllocated}
              </div>
              <p className="text-xs text-muted-foreground">
                Stock reserved for confirmed sales orders
              </p>
              {analysis.allSalesOrders.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-medium mb-1">By Order Number:</p>
                  <div className="space-y-1 max-h-20 overflow-y-auto">
                    {analysis.allSalesOrders.slice(0, 3).map((order, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {order.order_number}: {order.allocated_qty}
                      </Badge>
                    ))}
                    {analysis.allSalesOrders.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{analysis.allSalesOrders.length - 3} more orders
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* In-Transit Stock */}
        <Card className="border-accent/20 bg-accent/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-accent" />
              In-Transit Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-accent">
                {analysis.totalInTransit}
              </div>
              <p className="text-xs text-muted-foreground">
                Purchase order quantities not yet received
              </p>
              {analysis.allPurchaseOrders.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-medium mb-1">By PO Number:</p>
                  <div className="space-y-1 max-h-20 overflow-y-auto">
                    {analysis.allPurchaseOrders.slice(0, 3).map((po, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {po.po_number}: {po.pending_qty}
                      </Badge>
                    ))}
                    {analysis.allPurchaseOrders.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{analysis.allPurchaseOrders.length - 3} more POs
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Return Pending */}
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Return Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-destructive">
                {analysis.totalReturnPending}
              </div>
              <p className="text-xs text-muted-foreground">
                RSO quantities awaiting return
              </p>
              {analysis.allReturnOrders.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-medium mb-1">By RSO Number:</p>
                  <div className="space-y-1 max-h-20 overflow-y-auto">
                    {analysis.allReturnOrders.slice(0, 3).map((rso, idx) => (
                      <div key={idx} className="text-xs">
                        <Badge variant="outline" className="text-xs">
                          {rso.rso_number}: {rso.pending_qty}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          Customer: {rso.customer_name}
                        </p>
                      </div>
                    ))}
                    {analysis.allReturnOrders.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{analysis.allReturnOrders.length - 3} more returns
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Available to Pick */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ArrowDownUp className="h-4 w-4 text-primary" />
              Available to Pick
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className={cn(
                "text-2xl font-bold",
                analysis.totalAvailableToPick > 0 ? "text-primary" : "text-destructive"
              )}>
                {analysis.totalAvailableToPick}
              </div>
              <p className="text-xs text-muted-foreground">
                True available stock (Current - Allocated)
              </p>
              <div className="pt-1">
                <Badge 
                  variant={analysis.totalAvailableToPick > 0 ? "default" : "destructive"}
                  className="text-xs"
                >
                  {analysis.totalAvailableToPick > 0 ? "Stock Available" : "Fully Allocated"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Decision Helper */}
      {stockData.length > 0 && (
        <Card className="border-info/20 bg-info/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-info" />
              Decision Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="font-medium mb-2">Fulfillment Status:</p>
                {analysis.totalAvailableToPick > 0 ? (
                  <Badge className="bg-success/10 text-success">
                    Can fulfill {analysis.totalAvailableToPick} units immediately
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    All stock allocated - check in-transit
                  </Badge>
                )}
              </div>
              
              <div>
                <p className="font-medium mb-2">Upcoming Stock:</p>
                {analysis.totalInTransit > 0 ? (
                  <Badge className="bg-accent/10 text-accent">
                    {analysis.totalInTransit} units incoming via PO
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    No purchase orders pending
                  </Badge>
                )}
              </div>
              
              <div>
                <p className="font-medium mb-2">Return Impact:</p>
                {analysis.totalReturnPending > 0 ? (
                  <Badge className="bg-warning/10 text-warning">
                    {analysis.totalReturnPending} units expected back
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    No returns pending
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};