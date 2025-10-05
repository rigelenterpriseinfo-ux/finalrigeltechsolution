import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ShipmentStatus {
  status: 'pending' | 'dispatched' | 'in_transit' | 'delivered';
  count: number;
  orders: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    value: number;
  }>;
}

export interface RecentActivity {
  id: string;
  type: 'po' | 'payment' | 'shipment' | 'invoice' | 'grn' | 'return';
  title: string;
  description: string;
  amount?: number;
  user: string;
  timestamp: string;
  relativeTime: string;
}

export const useOperationsData = (companyId: string | undefined) => {
  return useQuery({
    queryKey: ['dashboard-operations', companyId],
    queryFn: async () => {
      if (!companyId) throw new Error('No company ID');

      // Fetch shipment statuses from sales orders
      const { data: salesOrders } = await supabase
        .from('sales_orders')
        .select('id, order_number, customer_id, customers (name), total_amount, tracking_status')
        .eq('company_id', companyId)
        .in('status', ['confirmed', 'partially_fulfilled', 'fulfilled']);

      // Group by tracking status
      const statusMap = new Map<string, ShipmentStatus['orders']>();
      
      salesOrders?.forEach((order: any) => {
        const status = order.tracking_status || 'pending';
        const existing = statusMap.get(status) || [];
        existing.push({
          id: order.id,
          orderNumber: order.order_number,
          customerName: order.customers?.name || 'Unknown',
          value: order.total_amount || 0,
        });
        statusMap.set(status, existing);
      });

      const shipmentStatuses: ShipmentStatus[] = [
        {
          status: 'pending',
          count: (statusMap.get('pending') || []).length,
          orders: (statusMap.get('pending') || []).slice(0, 5),
        },
        {
          status: 'dispatched',
          count: (statusMap.get('dispatched') || []).length,
          orders: (statusMap.get('dispatched') || []).slice(0, 5),
        },
        {
          status: 'in_transit',
          count: (statusMap.get('in_transit') || []).length,
          orders: (statusMap.get('in_transit') || []).slice(0, 5),
        },
        {
          status: 'delivered',
          count: (statusMap.get('delivered') || []).length,
          orders: (statusMap.get('delivered') || []).slice(0, 5),
        },
      ];

      // Fetch recent activities
      const activities: RecentActivity[] = [];

      // Recent Purchase Orders
      const { data: recentPOs } = await supabase
        .from('purchase_orders')
        .select('id, po_number, total_amount, created_at, created_by, profiles (first_name, last_name)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(3);

      recentPOs?.forEach((po: any) => {
        const userName = po.profiles ? 
          `${po.profiles.first_name || ''} ${po.profiles.last_name || ''}`.trim() || 'Unknown' 
          : 'Unknown';
        
        activities.push({
          id: `po-${po.id}`,
          type: 'po',
          title: `Purchase Order Created`,
          description: `PO ${po.po_number}`,
          amount: po.total_amount,
          user: userName,
          timestamp: po.created_at,
          relativeTime: getRelativeTime(po.created_at),
        });
      });

      // Recent Payments
      const { data: recentPayments } = await supabase
        .from('payments')
        .select('id, amount, payment_date, created_by, payment_type, reference_number, profiles (first_name, last_name)')
        .eq('company_id', companyId)
        .order('payment_date', { ascending: false })
        .limit(3);

      recentPayments?.forEach((payment: any) => {
        const userName = payment.profiles ? 
          `${payment.profiles.first_name || ''} ${payment.profiles.last_name || ''}`.trim() || 'Unknown' 
          : 'Unknown';
        
        activities.push({
          id: `payment-${payment.id}`,
          type: 'payment',
          title: `Payment ${payment.payment_type === 'received' ? 'Received' : 'Recorded'}`,
          description: payment.reference_number || `Payment ${payment.id.substring(0, 8)}`,
          amount: payment.amount,
          user: userName,
          timestamp: payment.payment_date,
          relativeTime: getRelativeTime(payment.payment_date),
        });
      });

      // Recent GRNs
      const { data: recentGRNs } = await supabase
        .from('grn_header')
        .select('id, grn_number, total_accepted_quantity, created_at, created_by, profiles (first_name, last_name)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(2);

      recentGRNs?.forEach((grn: any) => {
        const userName = grn.profiles ? 
          `${grn.profiles.first_name || ''} ${grn.profiles.last_name || ''}`.trim() || 'Unknown' 
          : 'Unknown';
        
        activities.push({
          id: `grn-${grn.id}`,
          type: 'grn',
          title: `Stock Received`,
          description: `GRN ${grn.grn_number} - ${grn.total_accepted_quantity} units`,
          user: userName,
          timestamp: grn.created_at,
          relativeTime: getRelativeTime(grn.created_at),
        });
      });

      // Recent Sales Invoices
      const { data: recentInvoices } = await supabase
        .from('sales_invoices')
        .select('id, invoice_number, total_amount, created_at, created_by, profiles (first_name, last_name)')
        .eq('company_id', companyId)
        .eq('status', 'finalized')
        .order('created_at', { ascending: false })
        .limit(2);

      recentInvoices?.forEach((invoice: any) => {
        const userName = invoice.profiles ? 
          `${invoice.profiles.first_name || ''} ${invoice.profiles.last_name || ''}`.trim() || 'Unknown' 
          : 'Unknown';
        
        activities.push({
          id: `invoice-${invoice.id}`,
          type: 'invoice',
          title: `Invoice Finalized`,
          description: `Invoice ${invoice.invoice_number}`,
          amount: invoice.total_amount,
          user: userName,
          timestamp: invoice.created_at,
          relativeTime: getRelativeTime(invoice.created_at),
        });
      });

      // Sort by timestamp and take top 10
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return {
        shipmentStatuses,
        recentActivities: activities.slice(0, 10),
      };
    },
    enabled: !!companyId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

function getRelativeTime(timestamp: string): string {
  const now = Date.now();
  const past = new Date(timestamp).getTime();
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
