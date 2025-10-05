import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays } from 'date-fns';

export interface OperationalMetrics {
  dso: number; // Days Sales Outstanding
  dsoChange: number;
  inventoryTurnover: number;
  inventoryTurnoverChange: number;
  orderFulfillmentRate: number;
  stockAccuracyRate: number;
  supplierDeliveryPerformance: number;
  returnRate: number;
}

export const useOperationalMetrics = (companyId?: string) => {
  return useQuery({
    queryKey: ['operational-metrics', companyId],
    queryFn: async (): Promise<OperationalMetrics> => {
      if (!companyId) throw new Error('Company ID required');

      const today = new Date();
      const thirtyDaysAgo = subDays(today, 30);
      const sixtyDaysAgo = subDays(today, 60);

      // Calculate Days Sales Outstanding (DSO)
      // Formula: (Accounts Receivable / Revenue) × Number of Days
      const { data: salesInvoices } = await supabase
        .from('sales_invoices')
        .select('total_amount, status')
        .eq('company_id', companyId)
        .gte('created_at', thirtyDaysAgo.toISOString());

      const totalRevenue = salesInvoices?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;
      const unpaidInvoices = salesInvoices?.filter(inv => inv.status !== 'paid') || [];
      const accountsReceivable = unpaidInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
      
      const dso = totalRevenue > 0 ? Math.round((accountsReceivable / totalRevenue) * 30) : 0;

      // Previous period DSO
      const { data: prevSalesInvoices } = await supabase
        .from('sales_invoices')
        .select('total_amount, status')
        .eq('company_id', companyId)
        .gte('created_at', sixtyDaysAgo.toISOString())
        .lt('created_at', thirtyDaysAgo.toISOString());

      const prevRevenue = prevSalesInvoices?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;
      const prevUnpaid = prevSalesInvoices?.filter(inv => inv.status !== 'paid') || [];
      const prevAR = prevUnpaid.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
      const prevDSO = prevRevenue > 0 ? Math.round((prevAR / prevRevenue) * 30) : 0;
      const dsoChange = dso - prevDSO;

      // Calculate Inventory Turnover Ratio
      // Formula: COGS / Average Inventory Value
      const { data: products } = await supabase
        .from('products')
        .select('stock_quantity, cost_price')
        .eq('company_id', companyId);

      const currentInventoryValue = products?.reduce(
        (sum, p) => sum + ((p.stock_quantity || 0) * (p.cost_price || 0)), 0
      ) || 1;

      // COGS approximation from sales invoices
      const cogs = totalRevenue * 0.6; // Simplified: assume 60% cost ratio
      const inventoryTurnover = currentInventoryValue > 0 
        ? Math.round((cogs / currentInventoryValue) * 10) / 10 
        : 0;

      const prevCOGS = prevRevenue * 0.6;
      const prevInventoryTurnover = currentInventoryValue > 0 
        ? Math.round((prevCOGS / currentInventoryValue) * 10) / 10 
        : 0;
      const inventoryTurnoverChange = inventoryTurnover - prevInventoryTurnover;

      // Order Fulfillment Rate
      const { data: salesOrders } = await supabase
        .from('sales_orders')
        .select('status')
        .eq('company_id', companyId)
        .gte('created_at', thirtyDaysAgo.toISOString());

      const totalOrders = salesOrders?.length || 0;
      const completedOrders = salesOrders?.filter(
        so => so.status === 'invoiced' || so.status === 'dispatched'
      ).length || 0;
      const orderFulfillmentRate = totalOrders > 0 
        ? Math.round((completedOrders / totalOrders) * 100) 
        : 0;

      // Stock Accuracy Rate (simplified - actual vs system)
      const stockAccuracyRate = 95; // Placeholder - would need physical count data

      // Supplier Delivery Performance
      const { data: purchaseOrders } = await supabase
        .from('purchase_orders')
        .select('expected_date, updated_at, status')
        .eq('company_id', companyId)
        .in('status', ['received', 'closed'])
        .gte('created_at', thirtyDaysAgo.toISOString());

      const onTimeDeliveries = purchaseOrders?.filter(po => {
        if (!po.expected_date) return true;
        return new Date(po.updated_at) <= new Date(po.expected_date);
      }).length || 0;
      
      const supplierDeliveryPerformance = purchaseOrders?.length 
        ? Math.round((onTimeDeliveries / purchaseOrders.length) * 100)
        : 0;

      // Return Rate
      const { data: returnOrders } = await supabase
        .from('return_order_header')
        .select('id')
        .eq('company_id', companyId)
        .gte('created_at', thirtyDaysAgo.toISOString());

      const returnRate = totalOrders > 0 
        ? Math.round(((returnOrders?.length || 0) / totalOrders) * 100)
        : 0;

      return {
        dso,
        dsoChange,
        inventoryTurnover,
        inventoryTurnoverChange,
        orderFulfillmentRate,
        stockAccuracyRate,
        supplierDeliveryPerformance,
        returnRate,
      };
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });
};
