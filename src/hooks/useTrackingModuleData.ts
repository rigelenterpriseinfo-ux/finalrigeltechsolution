import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export const useTrackingModuleData = (companyId: string | undefined) => {
  const queryClient = useQueryClient();

  // Parallel fetch all tracking data
  const trackingQuery = useQuery({
    queryKey: ['tracking-orders', companyId],
    queryFn: async () => {
      if (!companyId) return { salesInvoices: [], debitNotes: [] };

      // Parallel fetch sales invoices and debit notes
      const [salesInvoicesResult, debitNotesResult] = await Promise.all([
        supabase
          .from('sales_invoices')
          .select(`
            id,
            invoice_number,
            status,
            invoice_date,
            total_amount,
            subtotal_amount,
            tax_amount,
            discount_amount,
            customer_name,
            customer_id,
            sales_order_id,
            notes,
            sales_orders(
              id,
              destination,
              item_count,
              eway_bill_no,
              eway_bill_date,
              carrier_transporter,
              awb_no,
              eta,
              pod_document_url,
              tracking_status,
              dispatch_date,
              delivery_date,
              delivery_city,
              customers(name)
            )
          `),
        supabase
          .from('debit_notes')
          .select(`
            id,
            debit_note_number,
            status,
            debit_note_date,
            supplier_name,
            total_amount,
            subtotal_amount,
            tax_amount,
            discount_amount,
            destination,
            item_count,
            eway_bill_no,
            eway_bill_date,
            carrier_transporter,
            awb_no,
            eta,
            pod_document_url,
            tracking_status,
            dispatch_date,
            delivery_date,
            notes,
            supplier_id
          `)
      ]);

      if (salesInvoicesResult.error) throw salesInvoicesResult.error;
      if (debitNotesResult.error) throw debitNotesResult.error;

      // Format sales invoices
      const trackableSalesInvoices = (salesInvoicesResult.data || []).map(invoice => {
        const salesOrder = invoice.sales_orders;
        let autoDestination = salesOrder?.destination;
        if (!autoDestination && salesOrder?.delivery_city) {
          autoDestination = salesOrder.delivery_city;
        }

        return {
          id: invoice.id,
          sales_order_id: invoice.sales_order_id, // Include the actual sales_order_id
          order_number: invoice.invoice_number,
          type: 'sales_invoice' as const,
          status: invoice.status,
          order_date: invoice.invoice_date,
          customer_name: salesOrder?.customers?.name || invoice.customer_name,
          customer_id: invoice.customer_id,
          total_amount: invoice.total_amount,
          subtotal_amount: invoice.subtotal_amount,
          tax_amount: invoice.tax_amount,
          discount_amount: invoice.discount_amount,
          destination: autoDestination,
          delivery_city: salesOrder?.delivery_city,
          item_count: salesOrder?.item_count,
          eway_bill_no: salesOrder?.eway_bill_no,
          eway_bill_date: salesOrder?.eway_bill_date,
          carrier_transporter: salesOrder?.carrier_transporter,
          awb_no: salesOrder?.awb_no,
          eta: salesOrder?.eta,
          pod_document_url: salesOrder?.pod_document_url,
          tracking_status: salesOrder?.tracking_status || 'pending',
          dispatch_date: salesOrder?.dispatch_date,
          delivery_date: salesOrder?.delivery_date,
          notes: invoice.notes
        };
      });

      // Format debit notes
      const trackableDebitNotes = (debitNotesResult.data || []).map(note => ({
        id: note.id,
        order_number: note.debit_note_number,
        type: 'debit_note' as const,
        status: note.status,
        order_date: note.debit_note_date,
        supplier_name: note.supplier_name,
        supplier_id: note.supplier_id,
        total_amount: note.total_amount,
        subtotal_amount: note.subtotal_amount,
        tax_amount: note.tax_amount,
        discount_amount: note.discount_amount,
        destination: note.destination,
        item_count: note.item_count,
        eway_bill_no: note.eway_bill_no,
        eway_bill_date: note.eway_bill_date,
        carrier_transporter: note.carrier_transporter,
        awb_no: note.awb_no,
        eta: note.eta,
        pod_document_url: note.pod_document_url,
        tracking_status: note.tracking_status || 'pending',
        dispatch_date: note.dispatch_date,
        delivery_date: note.delivery_date,
        notes: note.notes
      }));

      return {
        salesInvoices: trackableSalesInvoices,
        debitNotes: trackableDebitNotes
      };
    },
    enabled: !!companyId,
    staleTime: 2 * 60 * 1000, // 2 minutes for tracking (more real-time)
    refetchOnWindowFocus: false,
  });

  // Real-time subscription for sales_orders and debit_notes updates
  useEffect(() => {
    if (!companyId) return;

    console.log('[useTrackingModuleData] Setting up real-time subscriptions for company:', companyId);

    // Create unique channel names per company to avoid conflicts
    const salesOrdersChannel = supabase
      .channel(`tracking-sales-orders-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sales_orders',
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          console.log('[useTrackingModuleData] Sales order updated:', payload);
          // Invalidate cache when sales_orders are updated
          queryClient.invalidateQueries({ queryKey: ['tracking-orders', companyId] });
        }
      )
      .subscribe((status) => {
        console.log('[useTrackingModuleData] Sales orders subscription status:', status);
      });

    const debitNotesChannel = supabase
      .channel(`tracking-debit-notes-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'debit_notes',
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          console.log('[useTrackingModuleData] Debit note updated:', payload);
          // Invalidate cache when debit_notes are updated
          queryClient.invalidateQueries({ queryKey: ['tracking-orders', companyId] });
        }
      )
      .subscribe((status) => {
        console.log('[useTrackingModuleData] Debit notes subscription status:', status);
      });

    return () => {
      console.log('[useTrackingModuleData] Cleaning up subscriptions');
      supabase.removeChannel(salesOrdersChannel);
      supabase.removeChannel(debitNotesChannel);
    };
  }, [companyId, queryClient]);

  return {
    orders: trackingQuery.data?.salesInvoices || [],
    debitNotes: trackingQuery.data?.debitNotes || [],
    isLoading: trackingQuery.isLoading,
    isError: trackingQuery.isError,
    refetch: trackingQuery.refetch
  };
};
