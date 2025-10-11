import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { 
  ShoppingCart, 
  Package, 
  DollarSign, 
  RotateCcw,
  TrendingUp,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface Activity {
  id: string;
  type: 'sale' | 'purchase' | 'payment' | 'return' | 'inventory';
  title: string;
  amount?: number;
  timestamp: Date;
  reference?: string;
}

interface RecentActivitiesWidgetProps {
  companyId?: string;
}

export const RecentActivitiesWidget = ({ companyId }: RecentActivitiesWidgetProps) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = async () => {
    if (!companyId) return;
    
    try {
      setLoading(true);
      
      // Fetch recent sales orders
      const { data: salesOrders } = await supabase
        .from('sales_orders')
        .select('id, order_number, total_amount, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(4);

      // Fetch recent purchase orders
      const { data: purchaseOrders } = await supabase
        .from('purchase_orders')
        .select('id, po_number, total_amount, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(4);

      // Fetch recent GRNs
      const { data: grns } = await supabase
        .from('grn_header')
        .select('id, grn_number, total_amount, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(3);

      const recentActivities: Activity[] = [];

      salesOrders?.forEach(order => {
        recentActivities.push({
          id: order.id,
          type: 'sale',
          title: `Sales Order ${order.order_number}`,
          amount: order.total_amount,
          timestamp: new Date(order.created_at),
          reference: order.order_number,
        });
      });

      purchaseOrders?.forEach(order => {
        recentActivities.push({
          id: order.id,
          type: 'purchase',
          title: `Purchase Order ${order.po_number}`,
          amount: order.total_amount,
          timestamp: new Date(order.created_at),
          reference: order.po_number,
        });
      });

      grns?.forEach(grn => {
        recentActivities.push({
          id: grn.id,
          type: 'inventory',
          title: `GRN ${grn.grn_number}`,
          amount: grn.total_amount,
          timestamp: new Date(grn.created_at),
          reference: grn.grn_number,
        });
      });

      // Sort by timestamp and take top 8
      recentActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setActivities(recentActivities.slice(0, 8));
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();

    // Set up real-time subscription
    if (!companyId) return;

    const channel = supabase
      .channel('activities-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sales_orders',
          filter: `company_id=eq.${companyId}`,
        },
        () => fetchActivities()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'purchase_orders',
          filter: `company_id=eq.${companyId}`,
        },
        () => fetchActivities()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'sale': return ShoppingCart;
      case 'purchase': return Package;
      case 'payment': return DollarSign;
      case 'return': return RotateCcw;
      case 'inventory': return TrendingUp;
      default: return AlertCircle;
    }
  };

  const getActivityColor = (type: Activity['type']) => {
    switch (type) {
      case 'sale': return 'text-green-600 bg-green-50 dark:bg-green-950/30';
      case 'purchase': return 'text-blue-600 bg-blue-50 dark:bg-blue-950/30';
      case 'payment': return 'text-purple-600 bg-purple-50 dark:bg-purple-950/30';
      case 'return': return 'text-orange-600 bg-orange-50 dark:bg-orange-950/30';
      case 'inventory': return 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/30';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="pb-3 space-y-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Recent Activities</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={fetchActivities}
            disabled={loading}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-muted rounded w-3/4" />
                  <div className="h-2 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No recent activities
          </div>
        ) : (
          activities.map((activity) => {
            const Icon = getActivityIcon(activity.type);
            const colorClass = getActivityColor(activity.type);

            return (
              <div key={activity.id} className="flex items-start gap-3 group">
                <div className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0',
                  colorClass
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-foreground truncate">
                      {activity.title}
                    </p>
                    {activity.amount && (
                      <span className="text-xs font-semibold text-foreground whitespace-nowrap">
                        ₹{activity.amount.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};
