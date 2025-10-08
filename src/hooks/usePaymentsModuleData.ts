import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const usePaymentsModuleData = (companyId: string | undefined) => {
  // Account Payable Query
  const accountPayableQuery = useQuery({
    queryKey: ['account-payable', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      // Parallel fetch GRN data, PO data, and payments
      const { data: grnData, error: grnError } = await supabase
        .from('grn_header')
        .select(`
          id,
          grn_number,
          grn_date,
          total_amount,
          supplier_name,
          supplier_id,
          status,
          purchase_order_id,
          supplier:supplier_id(payment_terms)
        `)
        .eq('company_id', companyId)
        .in('status', ['received', 'partially_received'])
        .order('grn_date', { ascending: false });

      if (grnError) throw grnError;

      const purchaseOrderIds = grnData?.map(grn => grn.purchase_order_id).filter(Boolean) || [];
      const grnIds = grnData?.map(grn => grn.id) || [];

      // Parallel fetch PO payment terms and payments
      const [poDataResult, paymentsResult] = await Promise.all([
        purchaseOrderIds.length > 0
          ? supabase.from('purchase_orders').select('id, payment_terms').in('id', purchaseOrderIds)
          : Promise.resolve({ data: [], error: null }),
        (purchaseOrderIds.length > 0 || grnIds.length > 0)
          ? supabase
              .from('payments')
              .select('*')
              .eq('company_id', companyId)
              .or(`purchase_order_id.in.(${purchaseOrderIds.join(',')}),grn_id.in.(${grnIds.join(',')})`)
          : Promise.resolve({ data: [], error: null })
      ]);

      const purchaseOrderData = poDataResult.data || [];
      const paymentsData = paymentsResult.data || [];

      // Transform data
      return (grnData || []).map(grn => {
        const relatedPayments = paymentsData.filter(payment => 
          payment.purchase_order_id === grn.purchase_order_id || payment.grn_id === grn.id
        );
        const advancePayments = relatedPayments.filter(p => p.payment_type === 'advance');
        const regularPayments = relatedPayments.filter(p => p.payment_type !== 'advance');
        
        const totalAdvancePayment = advancePayments.reduce((sum, payment) => sum + payment.amount, 0);
        const totalAmountReceived = regularPayments.reduce((sum, payment) => sum + payment.amount, 0);
        const pendingPayment = grn.total_amount - totalAdvancePayment - totalAmountReceived;
        const latestPayment = relatedPayments.sort((a, b) => 
          new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
        )[0];

        let invoiceStatus = 'Outstanding';
        if (pendingPayment <= 0) {
          invoiceStatus = 'Fully Paid';
        } else if (totalAmountReceived > 0 || totalAdvancePayment > 0) {
          invoiceStatus = 'Partially Paid';
        }

        const poPaymentTerms = purchaseOrderData.find(po => po.id === grn.purchase_order_id)?.payment_terms;
        const paymentTerms = poPaymentTerms || grn.supplier?.payment_terms || 'Net 30';

        return {
          id: grn.id,
          grn_number: grn.grn_number,
          grn_date: grn.grn_date,
          total_amount: grn.total_amount,
          supplier_name: grn.supplier_name,
          supplier_id: grn.supplier_id,
          status: grn.status,
          advance_payment: totalAdvancePayment,
          amount_received: totalAmountReceived,
          payment_date: latestPayment?.payment_date || null,
          payment_method: latestPayment?.payment_method || null,
          payment_reference_no: latestPayment?.reference_number || null,
          pending_payment: Math.max(0, pendingPayment),
          invoice_status: invoiceStatus,
          payment_terms: paymentTerms
        };
      });
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Account Receivable Query
  const accountReceivableQuery = useQuery({
    queryKey: ['account-receivable', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data: invoiceData, error: invoiceError } = await supabase
        .from('sales_invoices')
        .select(`
          id,
          invoice_number,
          invoice_date,
          total_amount,
          payment_terms,
          customer_id,
          customer_name,
          sales_order_id,
          customer:customer_id(id, name)
        `)
        .eq('company_id', companyId)
        .eq('status', 'finalized')
        .order('invoice_date', { ascending: false });

      if (invoiceError) throw invoiceError;

      const salesOrderIds = invoiceData?.map(invoice => invoice.sales_order_id).filter(Boolean) || [];
      const invoiceIds = invoiceData?.map(invoice => invoice.id) || [];

      // Fetch payments
      let paymentsData: any[] = [];
      if (salesOrderIds.length > 0 || invoiceIds.length > 0) {
        const { data: payments } = await supabase
          .from('payments')
          .select('*')
          .eq('company_id', companyId)
          .or(`sales_order_id.in.(${salesOrderIds.join(',')}),sales_invoice_id.in.(${invoiceIds.join(',')})`);
        
        paymentsData = payments || [];
      }

      return (invoiceData || []).map(invoice => {
        const relatedPayments = paymentsData.filter(payment => 
          payment.sales_order_id === invoice.sales_order_id || payment.sales_invoice_id === invoice.id
        );
        const advancePayments = relatedPayments.filter(p => p.payment_type === 'advance');
        const regularPayments = relatedPayments.filter(p => p.payment_type !== 'advance');
        
        const totalAdvancePayment = advancePayments.reduce((sum, payment) => sum + payment.amount, 0);
        const totalAmountReceived = regularPayments.reduce((sum, payment) => sum + payment.amount, 0);
        const pendingPayment = invoice.total_amount - totalAdvancePayment - totalAmountReceived;
        const latestPayment = relatedPayments.sort((a, b) => 
          new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
        )[0];

        let invoiceStatus = 'Outstanding';
        if (pendingPayment <= 0) {
          invoiceStatus = 'Fully Paid';
        } else if (totalAmountReceived > 0 || totalAdvancePayment > 0) {
          invoiceStatus = 'Partially Paid';
        }

        // Check overdue
        if (pendingPayment > 0) {
          const invoiceDate = new Date(invoice.invoice_date);
          const paymentTermDays = parseInt(invoice.payment_terms?.replace(/\D/g, '') || '30');
          const dueDate = new Date(invoiceDate.getTime() + (paymentTermDays * 24 * 60 * 60 * 1000));
          const currentDate = new Date();
          
          if (currentDate > dueDate) {
            invoiceStatus = 'Overdue';
          }
        }

        return {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          invoice_date: invoice.invoice_date,
          total_amount: invoice.total_amount,
          payment_terms: invoice.payment_terms,
          customer: { 
            id: invoice.customer_id,
            name: invoice.customer?.name || invoice.customer_name 
          },
          advance_payment: totalAdvancePayment,
          amount_received: totalAmountReceived,
          payment_date: latestPayment?.payment_date || null,
          payment_method: latestPayment?.payment_method || null,
          payment_reference_no: latestPayment?.reference_number || null,
          pending_payment: Math.max(0, pendingPayment),
          invoice_status: invoiceStatus
        };
      });
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    accountPayable: accountPayableQuery.data || [],
    accountReceivable: accountReceivableQuery.data || [],
    isLoading: accountPayableQuery.isLoading || accountReceivableQuery.isLoading,
    isError: accountPayableQuery.isError || accountReceivableQuery.isError,
    refetchAll: () => {
      accountPayableQuery.refetch();
      accountReceivableQuery.refetch();
    }
  };
};
