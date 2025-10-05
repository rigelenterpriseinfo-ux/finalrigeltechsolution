import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AgingBucket {
  label: string;
  amount: number;
  count: number;
}

export interface TopARCustomer {
  customerId: string;
  customerName: string;
  outstandingAmount: number;
  daysOverdue: number;
}

export interface TopAPVendor {
  vendorId: string;
  vendorName: string;
  outstandingAmount: number;
  daysOverdue: number;
}

export const useFinanceData = (companyId: string | undefined) => {
  return useQuery({
    queryKey: ['dashboard-finance', companyId],
    queryFn: async () => {
      if (!companyId) throw new Error('No company ID');

      const today = new Date();

      // Fetch AP data (Accounts Payable - what we owe)
      const { data: purchaseOrders } = await supabase
        .from('purchase_orders')
        .select('id, supplier_id, total_amount, order_date, suppliers (name)')
        .eq('company_id', companyId)
        .eq('status', 'open');

      const { data: apPayments } = await supabase
        .from('payments')
        .select('purchase_order_id, amount')
        .eq('company_id', companyId)
        .eq('payment_type', 'paid');

      // Calculate AP outstanding
      const apMap = new Map<string, number>();
      purchaseOrders?.forEach((po: any) => {
        const paid = apPayments
          ?.filter(p => p.purchase_order_id === po.id)
          .reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
        const outstanding = (po.total_amount || 0) - paid;
        if (outstanding > 0) {
          apMap.set(po.id, outstanding);
        }
      });

      const totalAPOutstanding = Array.from(apMap.values()).reduce((sum, val) => sum + val, 0);
      const apSettlementRate = purchaseOrders?.length 
        ? ((purchaseOrders.length - apMap.size) / purchaseOrders.length) * 100
        : 0;

      // Fetch AR data (Accounts Receivable - what customers owe us)
      const { data: salesInvoices } = await supabase
        .from('sales_invoices')
        .select('id, customer_id, customer_name, total_amount, due_date')
        .eq('company_id', companyId)
        .eq('status', 'finalized');

      const { data: arPayments } = await supabase
        .from('payments')
        .select('sales_invoice_id, amount')
        .eq('company_id', companyId)
        .eq('payment_type', 'received');

      // Calculate AR outstanding
      const arMap = new Map<string, { amount: number; dueDate: Date; customerId: string; customerName: string }>();
      salesInvoices?.forEach((inv: any) => {
        const received = arPayments
          ?.filter(p => p.sales_invoice_id === inv.id)
          .reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
        const outstanding = (inv.total_amount || 0) - received;
        if (outstanding > 0) {
          arMap.set(inv.id, {
            amount: outstanding,
            dueDate: new Date(inv.due_date),
            customerId: inv.customer_id,
            customerName: inv.customer_name,
          });
        }
      });

      const totalAROutstanding = Array.from(arMap.values()).reduce((sum, val) => sum + val.amount, 0);
      const arProcessingRate = salesInvoices?.length
        ? ((salesInvoices.length - arMap.size) / salesInvoices.length) * 100
        : 0;

      // Calculate aging buckets
      const apAging: AgingBucket[] = [
        { label: '0-30 days', amount: 0, count: 0 },
        { label: '31-60 days', amount: 0, count: 0 },
        { label: '61-90 days', amount: 0, count: 0 },
        { label: '90+ days', amount: 0, count: 0 },
      ];

      const arAging: AgingBucket[] = [
        { label: '0-30 days', amount: 0, count: 0 },
        { label: '31-60 days', amount: 0, count: 0 },
        { label: '61-90 days', amount: 0, count: 0 },
        { label: '90+ days', amount: 0, count: 0 },
      ];

      // Age AP
      purchaseOrders?.forEach((po: any) => {
        const outstanding = apMap.get(po.id);
        if (!outstanding) return;

        const orderDate = new Date(po.order_date);
        const daysOld = Math.floor((today.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysOld <= 30) {
          apAging[0].amount += outstanding;
          apAging[0].count++;
        } else if (daysOld <= 60) {
          apAging[1].amount += outstanding;
          apAging[1].count++;
        } else if (daysOld <= 90) {
          apAging[2].amount += outstanding;
          apAging[2].count++;
        } else {
          apAging[3].amount += outstanding;
          apAging[3].count++;
        }
      });

      // Age AR
      arMap.forEach((data) => {
        const daysOverdue = Math.floor((today.getTime() - data.dueDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysOverdue <= 30) {
          arAging[0].amount += data.amount;
          arAging[0].count++;
        } else if (daysOverdue <= 60) {
          arAging[1].amount += data.amount;
          arAging[1].count++;
        } else if (daysOverdue <= 90) {
          arAging[2].amount += data.amount;
          arAging[2].count++;
        } else {
          arAging[3].amount += data.amount;
          arAging[3].count++;
        }
      });

      // Top AR customers
      const arCustomerMap = new Map<string, { name: string; amount: number; daysOverdue: number }>();
      arMap.forEach((data) => {
        const existing = arCustomerMap.get(data.customerId) || {
          name: data.customerName,
          amount: 0,
          daysOverdue: 0,
        };
        const daysOverdue = Math.floor((today.getTime() - data.dueDate.getTime()) / (1000 * 60 * 60 * 24));
        arCustomerMap.set(data.customerId, {
          name: existing.name,
          amount: existing.amount + data.amount,
          daysOverdue: Math.max(existing.daysOverdue, daysOverdue),
        });
      });

      const topARCustomers: TopARCustomer[] = Array.from(arCustomerMap.entries())
        .map(([id, data]) => ({
          customerId: id,
          customerName: data.name,
          outstandingAmount: data.amount,
          daysOverdue: data.daysOverdue,
        }))
        .sort((a, b) => b.outstandingAmount - a.outstandingAmount)
        .slice(0, 5);

      // Top AP vendors
      const apVendorMap = new Map<string, { name: string; amount: number; daysOverdue: number }>();
      purchaseOrders?.forEach((po: any) => {
        const outstanding = apMap.get(po.id);
        if (!outstanding) return;

        const existing = apVendorMap.get(po.supplier_id) || {
          name: po.suppliers?.name || 'Unknown',
          amount: 0,
          daysOverdue: 0,
        };
        const orderDate = new Date(po.order_date);
        const daysOld = Math.floor((today.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));

        apVendorMap.set(po.supplier_id, {
          name: existing.name,
          amount: existing.amount + outstanding,
          daysOverdue: Math.max(existing.daysOverdue, daysOld),
        });
      });

      const topAPVendors: TopAPVendor[] = Array.from(apVendorMap.entries())
        .map(([id, data]) => ({
          vendorId: id,
          vendorName: data.name,
          outstandingAmount: data.amount,
          daysOverdue: data.daysOverdue,
        }))
        .sort((a, b) => b.outstandingAmount - a.outstandingAmount)
        .slice(0, 5);

      return {
        totalAPOutstanding,
        apSettlementRate: Math.round(apSettlementRate),
        totalAROutstanding,
        arProcessingRate: Math.round(arProcessingRate),
        apAging,
        arAging,
        topARCustomers,
        topAPVendors,
      };
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });
};
