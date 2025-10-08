import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useSalesModuleData = (companyId: string | undefined) => {
  // Parallel fetch all sales data
  const customersQuery = useQuery({
    queryKey: ['customers', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const salesOrdersQuery = useQuery({
    queryKey: ['sales-orders', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase.rpc(
        'get_sales_orders_with_delivery_summary',
        { p_company_id: companyId }
      );

      if (error) throw error;

      const orders = data || [];
      const orderIds = orders.map((o: any) => o.id);
      
      if (orderIds.length === 0) return orders;

      // Parallel fetch items and invoice items
      const [itemsResult, invoiceItemsResult] = await Promise.all([
        supabase
          .from('sales_order_items')
          .select('sales_order_id, product_id, ordered_quantity, quantity, back_order_quantity')
          .in('sales_order_id', orderIds),
        supabase
          .from('sales_invoice_items')
          .select('sales_invoice_id, product_id, quantity_invoiced, sales_invoices!inner(sales_order_id, status)')
          .in('sales_invoices.sales_order_id', orderIds)
          .eq('sales_invoices.status', 'finalized')
      ]);

      if (itemsResult.error) throw itemsResult.error;
      if (invoiceItemsResult.error) throw invoiceItemsResult.error;

      // Build invoice map
      const invoicedMap = new Map<string, number>();
      for (const invItem of invoiceItemsResult.data || []) {
        const soId = invItem.sales_invoices?.sales_order_id;
        if (!soId) continue;
        const key = `${soId}_${invItem.product_id}`;
        const prev = invoicedMap.get(key) || 0;
        invoicedMap.set(key, prev + (invItem.quantity_invoiced || 0));
      }

      // Calculate aggregates
      const aggregates = new Map<string, { ordered: number; invoiced: number; backorder: number }>();
      for (const it of itemsResult.data || []) {
        const ordered = (it.ordered_quantity ?? it.quantity ?? 0) as number;
        const key = `${it.sales_order_id}_${it.product_id}`;
        const invoiced = invoicedMap.get(key) || 0;
        const backorder = it.back_order_quantity || 0;
        
        const prev = aggregates.get(it.sales_order_id) || { ordered: 0, invoiced: 0, backorder: 0 };
        aggregates.set(it.sales_order_id, {
          ordered: prev.ordered + ordered,
          invoiced: prev.invoiced + invoiced,
          backorder: prev.backorder + backorder,
        });
      }

      return orders.map((o: any) => {
        const agg = aggregates.get(o.id);
        if (!agg) return o;
        return {
          ...o,
          total_ordered_qty: agg.ordered,
          total_invoiced_qty: agg.invoiced,
          total_backorder_qty: agg.backorder,
          total_ready_to_deliver_qty: Math.max(0, agg.ordered - agg.invoiced - agg.backorder),
        };
      });
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const salesMetricsQuery = useQuery({
    queryKey: ['sales-metrics', companyId],
    queryFn: async () => {
      if (!companyId) return null;

      // Parallel fetch all metrics
      const [metricsResult, itemsResult, customersResult] = await Promise.all([
        supabase.rpc('get_sales_metrics', { p_company_id: companyId }),
        supabase.rpc('get_top_backorder_items', { p_company_id: companyId, p_limit: 5 }),
        supabase.rpc('get_top_backorder_customers', { p_company_id: companyId, p_limit: 5 })
      ]);

      if (metricsResult.error) throw metricsResult.error;
      if (itemsResult.error) throw itemsResult.error;
      if (customersResult.error) throw customersResult.error;

      return {
        metrics: metricsResult.data?.[0] || {
          pending_orders_count: 0,
          pending_orders_value: 0,
          total_backorder_units: 0,
          total_backorder_value: 0
        },
        topBackorderItems: itemsResult.data || [],
        topBackorderCustomers: customersResult.data || []
      };
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    customers: customersQuery.data || [],
    salesOrders: salesOrdersQuery.data || [],
    salesMetrics: salesMetricsQuery.data,
    isLoading: customersQuery.isLoading || salesOrdersQuery.isLoading || salesMetricsQuery.isLoading,
    isError: customersQuery.isError || salesOrdersQuery.isError || salesMetricsQuery.isError,
    refetchAll: () => {
      customersQuery.refetch();
      salesOrdersQuery.refetch();
      salesMetricsQuery.refetch();
    }
  };
};
