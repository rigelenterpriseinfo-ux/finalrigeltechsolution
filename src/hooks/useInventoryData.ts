import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WarehouseStock {
  warehouseId: string;
  warehouseName: string;
  totalQty: number;
  totalValue: number;
}

export interface TopValueItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  movement: number[];
}

export const useInventoryData = (companyId: string | undefined) => {
  return useQuery({
    queryKey: ['dashboard-inventory', companyId],
    queryFn: async () => {
      if (!companyId) throw new Error('No company ID');

      // Fetch warehouse-wise stock
      const { data: transactions } = await supabase
        .from('inventory_transactions')
        .select('warehouse_id, quantity_change, unit_cost')
        .eq('company_id', companyId);

      const warehouseMap = new Map<string, { qty: number; value: number }>();
      
      transactions?.forEach((t: any) => {
        if (!t.warehouse_id) return;
        const existing = warehouseMap.get(t.warehouse_id) || { qty: 0, value: 0 };
        warehouseMap.set(t.warehouse_id, {
          qty: existing.qty + (t.quantity_change || 0),
          value: existing.value + ((t.quantity_change || 0) * (t.unit_cost || 0)),
        });
      });

      const warehouseStocks: WarehouseStock[] = Array.from(warehouseMap.entries()).map(([id, data]) => ({
        warehouseId: id,
        warehouseName: `Warehouse ${id.substring(0, 8)}`,
        totalQty: data.qty,
        totalValue: data.value,
      }));

      // Fetch top 5 value items
      const { data: products } = await supabase
        .from('products')
        .select('id, name, sku, stock_quantity, unit_price')
        .eq('company_id', companyId)
        .gt('stock_quantity', 0)
        .order('stock_quantity', { ascending: false })
        .limit(5);

      const topValueItems: TopValueItem[] = await Promise.all(
        (products || []).map(async (p) => {
          // Get movement data for last 30 days
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          const { data: movements } = await supabase
            .from('inventory_transactions')
            .select('quantity_change, transaction_date')
            .eq('product_id', p.id)
            .gte('transaction_date', thirtyDaysAgo.toISOString())
            .order('transaction_date', { ascending: true });

          // Create sparkline data (7 data points)
          const movement = movements
            ?.reduce((acc: number[], m) => {
              const lastVal = acc[acc.length - 1] || 0;
              acc.push(lastVal + (m.quantity_change || 0));
              return acc;
            }, [])
            .slice(-7) || [0, 0, 0, 0, 0, 0, 0];

          return {
            productId: p.id,
            productName: p.name,
            sku: p.sku || '',
            quantity: p.stock_quantity || 0,
            unitPrice: p.unit_price || 0,
            totalValue: (p.stock_quantity || 0) * (p.unit_price || 0),
            movement,
          };
        })
      );

      // Sort by total value
      topValueItems.sort((a, b) => b.totalValue - a.totalValue);

      // Fetch damaged stock (using inventory adjustments)
      const { data: damages } = await supabase
        .from('inventory_adjustments')
        .select('adjustment_quantity, products (unit_price)')
        .eq('company_id', companyId)
        .eq('adjustment_type', 'damage')
        .gte('adjustment_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

      const damagedValue = damages?.reduce((sum: number, d: any) => 
        sum + Math.abs(d.adjustment_quantity || 0) * (d.products?.unit_price || 0), 0
      ) || 0;

      const damagedLocations = ['Main Warehouse', 'Secondary Location'].slice(0, 2);

      return {
        warehouseStocks,
        topValueItems: topValueItems.slice(0, 5),
        damagedValue,
        damagedLocations: damagedLocations.slice(0, 3),
      };
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });
};
