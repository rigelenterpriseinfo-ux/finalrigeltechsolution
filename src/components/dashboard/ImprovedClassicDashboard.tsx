import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KPICard } from '@/components/ui/kpi-card';
import { Button } from '@/components/ui/button';
import { 
  Package, 
  ShoppingCart, 
  FileText, 
  TrendingUp, 
  DollarSign,
  AlertTriangle,
  Users,
  Warehouse,
  ArrowRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface ImprovedClassicDashboardProps {
  inventoryStats: {
    totalSKUs: number;
    totalUnits: number;
    totalCost: number;
  };
  companyId?: string;
  onNavigate: (module: string) => void;
}

export const ImprovedClassicDashboard: React.FC<ImprovedClassicDashboardProps> = ({ 
  inventoryStats,
  companyId,
  onNavigate 
}) => {
  const { kpiData, kpiLoading } = useDashboardData(companyId);

  // Fetch recent orders
  const { data: recentOrders } = useQuery({
    queryKey: ['recent-orders', companyId],
    queryFn: async () => {
      const { data: salesOrders } = await supabase
        .from('sales_orders')
        .select('id, order_number, created_at, total_amount, status')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false })
        .limit(5);

      const { data: purchaseOrders } = await supabase
        .from('purchase_orders')
        .select('id, po_number, created_at, total_amount, status')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false })
        .limit(5);

      return {
        sales: salesOrders || [],
        purchase: purchaseOrders || [],
      };
    },
    enabled: !!companyId,
    staleTime: 30000,
  });

  // Fetch counts
  const { data: counts } = useQuery({
    queryKey: ['dashboard-counts', companyId],
    queryFn: async () => {
      const [customers, suppliers] = await Promise.all([
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId!),
        supabase
          .from('suppliers')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId!)
      ]);

      return {
        customers: customers.count || 0,
        suppliers: suppliers.count || 0,
        warehouses: 1, // Simplified - single warehouse assumed
      };
    },
    enabled: !!companyId,
    staleTime: 60000,
  });

  return (
    <div className="space-y-6">
      {/* Enhanced KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Today's Revenue"
          value={kpiData?.totalRevenue || 0}
          prefix="₹"
          icon={DollarSign}
          variant="success"
          trend={{
            value: kpiData?.revenueChange || 0,
            isPositive: (kpiData?.revenueChange || 0) >= 0,
            label: 'vs yesterday',
          }}
          loading={kpiLoading}
        />

        <KPICard
          title="Pending Orders"
          value={kpiData?.activeOrders || 0}
          suffix=" orders"
          icon={ShoppingCart}
          variant="info"
          action={{
            label: 'View Orders',
            onClick: () => onNavigate('sales'),
          }}
          loading={kpiLoading}
        />

        <KPICard
          title="Low Stock Items"
          value={kpiData?.lowStockCount || 0}
          suffix=" items"
          icon={AlertTriangle}
          variant={(kpiData?.lowStockCount || 0) > 10 ? 'danger' : 'warning'}
          action={{
            label: 'Reorder',
            onClick: () => onNavigate('purchase'),
          }}
          loading={kpiLoading}
        />

        <KPICard
          title="Cash Balance"
          value={kpiData?.cashFlow || 0}
          prefix="₹"
          icon={TrendingUp}
          variant={(kpiData?.cashFlow || 0) > 0 ? 'success' : 'warning'}
          trend={{
            value: kpiData?.cashFlowChange || 0,
            isPositive: (kpiData?.cashFlowChange || 0) >= 0,
            label: 'vs last week',
          }}
          loading={kpiLoading}
        />
      </div>

      {/* Recent Orders and Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Orders</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('sales')}
              className="gap-2"
            >
              View All
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentOrders?.sales.slice(0, 5).map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => onNavigate('sales')}
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-sm">{order.order_number}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(order.created_at), 'MMM d, h:mm a')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">₹{order.total_amount.toLocaleString()}</span>
                    <Badge variant={order.status === 'confirmed' ? 'default' : 'secondary'}>
                      {order.status}
                    </Badge>
                  </div>
                </div>
              ))}
              {(!recentOrders?.sales || recentOrders.sales.length === 0) && (
                <p className="text-center text-muted-foreground py-8">No recent orders</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Alerts Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Alerts & Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {kpiData && kpiData.lowStockCount > 0 && (
                <div className="flex items-start gap-3 p-3 rounded-lg border border-orange-500/30 bg-orange-500/5">
                  <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Low Stock Alert</p>
                    <p className="text-xs text-muted-foreground">
                      {kpiData.lowStockCount} items need reordering
                    </p>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 mt-1"
                      onClick={() => onNavigate('inventory')}
                    >
                      View Items →
                    </Button>
                  </div>
                </div>
              )}

              {kpiData && kpiData.activeOrders > 10 && (
                <div className="flex items-start gap-3 p-3 rounded-lg border border-blue-500/30 bg-blue-500/5">
                  <ShoppingCart className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">High Order Volume</p>
                    <p className="text-xs text-muted-foreground">
                      {kpiData.activeOrders} orders pending fulfillment
                    </p>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 mt-1"
                      onClick={() => onNavigate('sales')}
                    >
                      Process Orders →
                    </Button>
                  </div>
                </div>
              )}

              {(!kpiData || (kpiData.lowStockCount === 0 && kpiData.activeOrders <= 10)) && (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <p className="text-sm">✓ No critical alerts at this time</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={() => onNavigate('inventory')}
              className="flex flex-col items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <Package className="h-8 w-8 text-primary" />
              <div className="text-center">
                <p className="text-2xl font-bold">{inventoryStats.totalSKUs}</p>
                <p className="text-xs text-muted-foreground">Active Products</p>
              </div>
            </button>

            <button
              onClick={() => onNavigate('sales')}
              className="flex flex-col items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <Users className="h-8 w-8 text-primary" />
              <div className="text-center">
                <p className="text-2xl font-bold">{counts?.customers || 0}</p>
                <p className="text-xs text-muted-foreground">Total Customers</p>
              </div>
            </button>

            <button
              onClick={() => onNavigate('purchase')}
              className="flex flex-col items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <ShoppingCart className="h-8 w-8 text-primary" />
              <div className="text-center">
                <p className="text-2xl font-bold">{counts?.suppliers || 0}</p>
                <p className="text-xs text-muted-foreground">Total Suppliers</p>
              </div>
            </button>

            <button
              onClick={() => onNavigate('inventory')}
              className="flex flex-col items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <Warehouse className="h-8 w-8 text-primary" />
              <div className="text-center">
                <p className="text-2xl font-bold">{counts?.warehouses || 0}</p>
                <p className="text-xs text-muted-foreground">Warehouses</p>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => onNavigate('inventory')} className="gap-2">
              <Package className="h-4 w-4" />
              Manage Inventory
            </Button>
            <Button onClick={() => onNavigate('purchase')} variant="outline" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Create PO
            </Button>
            <Button onClick={() => onNavigate('sales')} variant="outline" className="gap-2">
              <FileText className="h-4 w-4" />
              New Sales Order
            </Button>
            <Button onClick={() => onNavigate('reports')} variant="outline" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              View Reports
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
