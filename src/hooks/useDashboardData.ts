import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DashboardKPIs {
  totalRevenue: number;
  revenueChange: number;
  activeOrders: number;
  ordersChange: number;
  lowStockCount: number;
  lowStockValue: number;
  cashFlow: number;
  cashFlowChange: number;
}

export interface UrgentAction {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'info';
  title: string;
  description: string;
  count: number;
  value?: string;
  type: 'low_stock' | 'overdue_po' | 'unpaid_invoice' | 'backorder';
  timestamp: string;
}

export const useDashboardData = (companyId: string | undefined) => {
  // Hero KPIs Query
  const { data: kpiData, isLoading: kpiLoading } = useQuery({
    queryKey: ['dashboard-kpis', companyId],
    queryFn: async () => {
      if (!companyId) throw new Error('No company ID');

      // Get today's date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get week date range
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      // Fetch sales invoices for revenue
      const { data: invoices } = await supabase
        .from('sales_invoices')
        .select('total_amount, created_at')
        .eq('company_id', companyId)
        .eq('status', 'finalized')
        .gte('created_at', weekAgo.toISOString());

      // Fetch active orders (pending/confirmed sales orders)
      const { data: salesOrders } = await supabase
        .from('sales_orders')
        .select('id, status')
        .eq('company_id', companyId)
        .in('status', ['confirmed', 'partially_fulfilled']);

      // Fetch low stock items
      const { data: lowStockItems } = await supabase
        .from('products')
        .select('id, name, stock_quantity, unit_price')
        .eq('company_id', companyId)
        .lt('stock_quantity', 25);

      // Calculate metrics
      const thisWeekRevenue = invoices?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;
      const lastWeekRevenue = invoices
        ?.filter(inv => new Date(inv.created_at) < today)
        .reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;
      
      const revenueChange = lastWeekRevenue > 0 
        ? ((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100 
        : 0;

      const lowStockValue = lowStockItems?.reduce((sum, item) => 
        sum + (item.stock_quantity * item.unit_price), 0
      ) || 0;

      // Fetch AP/AR for cash flow
      const { data: payments } = await supabase
        .from('payments')
        .select('amount, payment_type')
        .eq('company_id', companyId)
        .gte('created_at', weekAgo.toISOString());

      const cashFlow = payments?.reduce((sum, p) => {
        return sum + (p.payment_type === 'received' ? p.amount : -p.amount);
      }, 0) || 0;

      const kpis: DashboardKPIs = {
        totalRevenue: thisWeekRevenue,
        revenueChange: Math.round(revenueChange),
        activeOrders: salesOrders?.length || 0,
        ordersChange: 5, // TODO: Calculate from historical data
        lowStockCount: lowStockItems?.length || 0,
        lowStockValue: lowStockValue,
        cashFlow: cashFlow,
        cashFlowChange: 3, // TODO: Calculate from historical data
      };

      return kpis;
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Urgent Actions Query
  const { data: urgentActions, isLoading: actionsLoading } = useQuery({
    queryKey: ['dashboard-urgent-actions', companyId],
    queryFn: async () => {
      if (!companyId) throw new Error('No company ID');

      const actions: UrgentAction[] = [];

      // Critical: Low stock items
      const { data: criticalStock } = await supabase
        .from('products')
        .select('id, name, stock_quantity, unit_price')
        .eq('company_id', companyId)
        .lt('stock_quantity', 10);

      if (criticalStock && criticalStock.length > 0) {
        const totalValue = criticalStock.reduce((sum, p) => sum + (p.stock_quantity * p.unit_price), 0);
        actions.push({
          id: 'critical-stock',
          priority: 'critical',
          title: 'Critical Low Stock Alert',
          description: `${criticalStock.length} items are critically low (< 10 units)`,
          count: criticalStock.length,
          value: `Value at Risk: ₹${totalValue.toLocaleString('en-IN')}`,
          type: 'low_stock',
          timestamp: 'Now',
        });
      }

      // High: Overdue POs
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: overduePOs } = await supabase
        .from('purchase_orders')
        .select('id, po_number, total_amount')
        .eq('company_id', companyId)
        .eq('status', 'open')
        .lt('expected_date', sevenDaysAgo.toISOString());

      if (overduePOs && overduePOs.length > 0) {
        actions.push({
          id: 'overdue-pos',
          priority: 'high',
          title: 'Overdue Purchase Orders',
          description: `${overduePOs.length} POs are overdue by more than 7 days`,
          count: overduePOs.length,
          type: 'overdue_po',
          timestamp: '7+ days',
        });
      }

      // Medium: Unpaid invoices
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: unpaidInvoices } = await supabase
        .from('sales_invoices')
        .select('id, invoice_number, total_amount')
        .eq('company_id', companyId)
        .eq('status', 'finalized')
        .lt('due_date', thirtyDaysAgo.toISOString());

      if (unpaidInvoices && unpaidInvoices.length > 0) {
        const totalAmount = unpaidInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
        actions.push({
          id: 'unpaid-invoices',
          priority: 'medium',
          title: 'Overdue Invoices',
          description: `${unpaidInvoices.length} invoices are overdue by more than 30 days`,
          count: unpaidInvoices.length,
          value: `Amount: ₹${totalAmount.toLocaleString('en-IN')}`,
          type: 'unpaid_invoice',
          timestamp: '30+ days',
        });
      }

      // Info: Pending backorders
      const { data: backorders } = await supabase
        .from('sales_order_items')
        .select('id, back_order_quantity')
        .gt('back_order_quantity', 0);

      if (backorders && backorders.length > 0) {
        const totalBackorder = backorders.reduce((sum, b) => sum + b.back_order_quantity, 0);
        actions.push({
          id: 'backorders',
          priority: 'info',
          title: 'Pending Backorders',
          description: `${backorders.length} orders have items on backorder`,
          count: backorders.length,
          value: `Total Units: ${totalBackorder}`,
          type: 'backorder',
          timestamp: 'Pending',
        });
      }

      return actions;
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  return {
    kpiData,
    kpiLoading,
    urgentActions: urgentActions || [],
    actionsLoading,
  };
};
