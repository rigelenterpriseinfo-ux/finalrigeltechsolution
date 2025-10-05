import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PendingReceiptItem {
  id: string;
  productName: string;
  quantity: number;
  receivedQty: number;
  supplierName: string;
  daysPending: number;
  expectedDays: number;
  poId: string;
}

export interface VendorPO {
  supplierId: string;
  supplierName: string;
  openPOCount: number;
  totalValue: number;
}

export const usePurchaseData = (companyId: string | undefined) => {
  return useQuery({
    queryKey: ['dashboard-purchase', companyId],
    queryFn: async () => {
      if (!companyId) throw new Error('No company ID');

      // Fetch pending receipts (top 3 items)
      const { data: poItems } = await supabase
        .from('purchase_order_items')
        .select(`
          id,
          product_id,
          quantity,
          received_quantity,
          purchase_order:purchase_orders (
            id,
            po_number,
            supplier_id,
            order_date,
            expected_date,
            suppliers (name)
          ),
          products (name)
        `)
        .order('id', { ascending: false })
        .limit(10);

      // Filter items where received < quantity
      const pendingItems = (poItems || []).filter((item: any) => 
        (item.received_quantity || 0) < (item.quantity || 0)
      ).slice(0, 3);

      const pendingReceipts: PendingReceiptItem[] = pendingItems.map((item: any) => {
        const orderDate = new Date(item.purchase_order?.order_date || Date.now());
        const daysPending = Math.floor((Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
        const expectedDate = item.purchase_order?.expected_date 
          ? new Date(item.purchase_order.expected_date)
          : new Date();
        const expectedDays = Math.floor((expectedDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

        return {
          id: item.id,
          productName: item.products?.name || 'Unknown',
          quantity: item.quantity || 0,
          receivedQty: item.received_quantity || 0,
          supplierName: item.purchase_order?.suppliers?.name || 'Unknown',
          daysPending,
          expectedDays: Math.max(0, expectedDays),
          poId: item.purchase_order?.id || '',
        };
      });

      // Fetch total open POs
      const { data: openPOs, count: openPOCount } = await supabase
        .from('purchase_orders')
        .select('total_amount', { count: 'exact' })
        .eq('company_id', companyId)
        .eq('status', 'open');

      const totalOpenPOValue = openPOs?.reduce((sum, po) => sum + (po.total_amount || 0), 0) || 0;

      // Fetch top 3 vendors with pending POs
      const { data: vendorPOs } = await supabase
        .from('purchase_orders')
        .select(`
          supplier_id,
          total_amount,
          suppliers (name)
        `)
        .eq('company_id', companyId)
        .eq('status', 'open');

      const vendorMap = new Map<string, { name: string; count: number; value: number }>();
      
      vendorPOs?.forEach((po: any) => {
        const supplierId = po.supplier_id;
        const existing = vendorMap.get(supplierId) || { 
          name: po.suppliers?.name || 'Unknown', 
          count: 0, 
          value: 0 
        };
        vendorMap.set(supplierId, {
          name: existing.name,
          count: existing.count + 1,
          value: existing.value + (po.total_amount || 0),
        });
      });

      const topVendors: VendorPO[] = Array.from(vendorMap.entries())
        .map(([id, data]) => ({
          supplierId: id,
          supplierName: data.name,
          openPOCount: data.count,
          totalValue: data.value,
        }))
        .sort((a, b) => b.totalValue - a.totalValue)
        .slice(0, 3);

      return {
        pendingReceipts,
        openPOCount: openPOCount || 0,
        totalOpenPOValue,
        topVendors,
      };
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });
};
