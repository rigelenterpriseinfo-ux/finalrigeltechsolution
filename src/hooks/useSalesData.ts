import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WeeklySales {
  week: string;
  revenue: number;
  quantity: number;
}

export interface TopRSOCustomer {
  customerId: string;
  customerName: string;
  returnValue: number;
  returnCount: number;
  reason: string;
}

export const useSalesData = (companyId: string | undefined) => {
  return useQuery({
    queryKey: ['dashboard-sales', companyId],
    queryFn: async () => {
      if (!companyId) throw new Error('No company ID');

      // Fetch last 4 weeks sales trend
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

      const { data: invoices } = await supabase
        .from('sales_invoices')
        .select('total_amount, invoice_date, sales_invoice_items (quantity_invoiced)')
        .eq('company_id', companyId)
        .eq('status', 'finalized')
        .gte('invoice_date', fourWeeksAgo.toISOString());

      // Group by week
      const weeklyData = new Map<string, { revenue: number; quantity: number }>();
      
      invoices?.forEach((inv: any) => {
        const date = new Date(inv.invoice_date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];

        const existing = weeklyData.get(weekKey) || { revenue: 0, quantity: 0 };
        const qty = inv.sales_invoice_items?.reduce((sum: number, item: any) => 
          sum + (item.quantity_invoiced || 0), 0
        ) || 0;

        weeklyData.set(weekKey, {
          revenue: existing.revenue + (inv.total_amount || 0),
          quantity: existing.quantity + qty,
        });
      });

      const salesTrend: WeeklySales[] = Array.from(weeklyData.entries())
        .map(([week, data]) => ({
          week: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          revenue: data.revenue,
          quantity: data.quantity,
        }))
        .sort((a, b) => new Date(a.week).getTime() - new Date(b.week).getTime())
        .slice(-4);

      // Fetch open sales orders
      const { data: openOrders, count: openOrderCount } = await supabase
        .from('sales_orders')
        .select('total_amount, customer_id, customers (name)', { count: 'exact' })
        .eq('company_id', companyId)
        .in('status', ['confirmed', 'partially_fulfilled']);

      const totalOpenOrderValue = openOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;

      // Top 3 customers by order value
      const customerMap = new Map<string, { name: string; value: number }>();
      openOrders?.forEach((order: any) => {
        const existing = customerMap.get(order.customer_id) || { 
          name: order.customers?.name || 'Unknown', 
          value: 0 
        };
        customerMap.set(order.customer_id, {
          name: existing.name,
          value: existing.value + (order.total_amount || 0),
        });
      });

      const topCustomers = Array.from(customerMap.entries())
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);

      // Fetch top 3 RSO customers
      const { data: returns } = await supabase
        .from('return_order_header')
        .select(`
          customer_id,
          customer_name,
          total_amount,
          reason_for_credit
        `)
        .eq('company_id', companyId)
        .order('total_amount', { ascending: false })
        .limit(10);

      const rsoMap = new Map<string, { name: string; value: number; count: number; reason: string }>();
      
      returns?.forEach((ret: any) => {
        const existing = rsoMap.get(ret.customer_id) || {
          name: ret.customer_name,
          value: 0,
          count: 0,
          reason: ret.reason_for_credit || 'Various',
        };
        rsoMap.set(ret.customer_id, {
          name: existing.name,
          value: existing.value + (ret.total_amount || 0),
          count: existing.count + 1,
          reason: existing.reason,
        });
      });

      const topRSOCustomers: TopRSOCustomer[] = Array.from(rsoMap.entries())
        .map(([id, data]) => ({
          customerId: id,
          customerName: data.name,
          returnValue: data.value,
          returnCount: data.count,
          reason: data.reason,
        }))
        .sort((a, b) => b.returnValue - a.returnValue)
        .slice(0, 3);

      return {
        salesTrend,
        openOrderCount: openOrderCount || 0,
        totalOpenOrderValue,
        topCustomers,
        topRSOCustomers,
      };
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });
};
