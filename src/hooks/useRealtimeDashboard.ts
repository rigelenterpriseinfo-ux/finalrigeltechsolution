import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const useRealtimeDashboard = (companyId: string | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!companyId) return;

    // Subscribe to sales_invoices changes
    const salesInvoicesChannel = supabase
      .channel('dashboard-sales-invoices')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sales_invoices',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          console.log('Sales invoice change detected:', payload);
          
          // Invalidate relevant queries
          queryClient.invalidateQueries({ queryKey: ['dashboard-kpis', companyId] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-sales', companyId] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-finance', companyId] });
          
          if (payload.eventType === 'INSERT') {
            toast({
              title: 'New Invoice Created',
              description: `Invoice has been finalized`,
            });
          }
        }
      )
      .subscribe();

    // Subscribe to purchase_orders changes
    const purchaseOrdersChannel = supabase
      .channel('dashboard-purchase-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'purchase_orders',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          console.log('Purchase order change detected:', payload);
          
          queryClient.invalidateQueries({ queryKey: ['dashboard-purchase', companyId] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-kpis', companyId] });
        }
      )
      .subscribe();

    // Subscribe to payments changes
    const paymentsChannel = supabase
      .channel('dashboard-payments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          console.log('Payment change detected:', payload);
          
          queryClient.invalidateQueries({ queryKey: ['dashboard-kpis', companyId] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-finance', companyId] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-operations', companyId] });
          
          if (payload.eventType === 'INSERT') {
            toast({
              title: 'Payment Recorded',
              description: 'A new payment has been recorded',
            });
          }
        }
      )
      .subscribe();

    // Subscribe to products changes (for low stock alerts)
    const productsChannel = supabase
      .channel('dashboard-products')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          console.log('Product change detected:', payload);
          
          queryClient.invalidateQueries({ queryKey: ['dashboard-kpis', companyId] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-urgent-actions', companyId] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-inventory', companyId] });
        }
      )
      .subscribe();

    // Subscribe to sales_orders changes (for shipment status)
    const salesOrdersChannel = supabase
      .channel('dashboard-sales-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sales_orders',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          console.log('Sales order change detected:', payload);
          
          queryClient.invalidateQueries({ queryKey: ['dashboard-sales', companyId] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-operations', companyId] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-kpis', companyId] });
        }
      )
      .subscribe();

    // Subscribe to grn_header changes
    const grnChannel = supabase
      .channel('dashboard-grn')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'grn_header',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          console.log('GRN change detected:', payload);
          
          queryClient.invalidateQueries({ queryKey: ['dashboard-purchase', companyId] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-inventory', companyId] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-operations', companyId] });
        }
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      salesInvoicesChannel.unsubscribe();
      purchaseOrdersChannel.unsubscribe();
      paymentsChannel.unsubscribe();
      productsChannel.unsubscribe();
      salesOrdersChannel.unsubscribe();
      grnChannel.unsubscribe();
    };
  }, [companyId, queryClient]);
};
