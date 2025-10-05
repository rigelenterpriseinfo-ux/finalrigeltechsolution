import React, { useState, useEffect } from 'react';
import { Package, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import BackorderTable from '@/components/tables/BackorderTable';

// Item-wise backorder interface (one row per sales order line item)
export interface BackorderLineItem {
  id: string; // sales_order_item id
  so_number: string;
  order_date: string;
  customer_id: string;
  customer_name: string;
  po_number: string | null;
  product_id: string;
  product_name: string;
  product_sku: string;
  ordered_qty: number;
  invoiced_qty: number;
  ready_to_deliver_qty: number;
  backorder_qty: number;
  available_stock: number;
  unit_price: number;
  line_total: number;
  so_status: string;
  warehouse_id: string | null;
  bin_id: string | null;
}

interface BackorderStats {
  total_lines: number;
  total_backorder_qty: number;
  total_backorder_value: number;
  lines_with_stock: number;
}

export default function BackorderModule() {
  const [backorders, setBackorders] = useState<BackorderLineItem[]>([]);
  const [stats, setStats] = useState<BackorderStats>({
    total_lines: 0,
    total_backorder_qty: 0,
    total_backorder_value: 0,
    lines_with_stock: 0
  });
  const [loading, setLoading] = useState(true);

  const { businessUser, hasAccess, hasEditAccess } = useBusinessAuth();
  const { toast } = useToast();

  const canEdit = hasEditAccess('sales');

  useEffect(() => {
    if (businessUser?.company_id) {
      fetchBackorders();
    }
  }, [businessUser?.company_id]);

  const fetchBackorders = async () => {
    try {
      setLoading(true);
      
      // Fetch item-wise backorder data from sales_order_items
      const { data, error } = await supabase
        .from('sales_order_items')
        .select(`
          id,
          sales_order_id,
          product_id,
          ordered_quantity,
          quantity,
          back_order_quantity,
          unit_price,
          warehouse_id,
          bin_id,
          sales_orders!inner (
            order_number,
            order_date,
            customer_id,
            customer_po_number,
            status,
            company_id
          )
        `)
        .eq('sales_orders.company_id', businessUser?.company_id)
        .gt('back_order_quantity', 0);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Raw backorder data:', data);

      // Get unique customer IDs and product IDs
      const customerIds = [...new Set((data || []).map((item: any) => item.sales_orders.customer_id))];
      const productIds = [...new Set((data || []).map((item: any) => item.product_id))];

      // Fetch customers
      const { data: customersData } = await supabase
        .from('customers')
        .select('id, name')
        .in('id', customerIds);

      // Fetch products
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name, sku, stock_quantity')
        .in('id', productIds);

      // Create lookup maps
      const customersMap = new Map((customersData || []).map(c => [c.id, c]));
      const productsMap = new Map((productsData || []).map(p => [p.id, p]));

      // Transform data
      const enrichedData: BackorderLineItem[] = (data || []).map((item: any) => {
        const customer = customersMap.get(item.sales_orders.customer_id);
        const product = productsMap.get(item.product_id);

        return {
          id: item.id,
          so_number: item.sales_orders.order_number,
          order_date: item.sales_orders.order_date,
          customer_id: item.sales_orders.customer_id,
          customer_name: customer?.name || 'Unknown',
          po_number: item.sales_orders.customer_po_number,
          product_id: item.product_id,
          product_name: product?.name || 'Unknown',
          product_sku: product?.sku || 'N/A',
          ordered_qty: item.ordered_quantity,
          invoiced_qty: item.quantity,
          ready_to_deliver_qty: item.ordered_quantity - item.quantity - item.back_order_quantity,
          backorder_qty: item.back_order_quantity,
          available_stock: product?.stock_quantity || 0,
          unit_price: item.unit_price,
          line_total: item.back_order_quantity * item.unit_price,
          so_status: item.sales_orders.status,
          warehouse_id: item.warehouse_id,
          bin_id: item.bin_id
        };
      });

      console.log('Enriched backorder data:', enrichedData);

      setBackorders(enrichedData);

      // Calculate stats
      const totalLines = enrichedData.length;
      const totalBackorderQty = enrichedData.reduce((sum, item) => sum + item.backorder_qty, 0);
      const totalBackorderValue = enrichedData.reduce((sum, item) => sum + item.line_total, 0);
      const linesWithStock = enrichedData.filter(item => item.available_stock > 0).length;

      setStats({
        total_lines: totalLines,
        total_backorder_qty: totalBackorderQty,
        total_backorder_value: totalBackorderValue,
        lines_with_stock: linesWithStock
      });

    } catch (error) {
      console.error('Error fetching backorders:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch backorders. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReleaseBackorder = async (itemId: string, releaseQty: number) => {
    try {
      const item = backorders.find(b => b.id === itemId);
      if (!item) return;

      // Validate release quantity
      if (releaseQty <= 0 || releaseQty > item.backorder_qty) {
        toast({
          title: 'Invalid Quantity',
          description: `Release quantity must be between 1 and ${item.backorder_qty}`,
          variant: 'destructive',
        });
        return;
      }

      if (releaseQty > item.available_stock) {
        toast({
          title: 'Insufficient Stock',
          description: `Only ${item.available_stock} units available in stock`,
          variant: 'destructive',
        });
        return;
      }

      // Update sales_order_item: reduce backorder_qty
      const newBackorderQty = item.backorder_qty - releaseQty;

      const { error } = await supabase
        .from('sales_order_items')
        .update({
          back_order_quantity: newBackorderQty,
          updated_at: new Date().toISOString()
        })
        .eq('id', itemId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Released ${releaseQty} units from backorder`,
      });

      fetchBackorders();
    } catch (error) {
      console.error('Error releasing backorder:', error);
      toast({
        title: 'Error',
        description: 'Failed to release backorder. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (!hasAccess('sales')) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">You don't have access to view backorders.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Backorder Lines</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_lines}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total_backorder_qty} total units
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Backorder Value</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats.total_backorder_value.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Combined value
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lines with Stock</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.lines_with_stock}
            </div>
            <p className="text-xs text-muted-foreground">
              Can be released
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats.total_lines - stats.lines_with_stock}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting stock
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Backorders Table */}
      <BackorderTable
        backorders={backorders}
        loading={loading}
        canEdit={canEdit}
        onRelease={handleReleaseBackorder}
        onRefresh={fetchBackorders}
      />
    </div>
  );
}
