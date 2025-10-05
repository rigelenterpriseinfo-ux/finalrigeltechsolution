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
    if (!businessUser?.company_id) {
      console.log('No company_id found');
      return;
    }

    try {
      setLoading(true);
      console.log('Fetching backorders for company:', businessUser.company_id);

      // Step 1: Get all sales orders for this company
      const { data: ordersData, error: ordersError } = await supabase
        .from('sales_orders')
        .select('id, order_number, order_date, customer_id, customer_po_number, status')
        .eq('company_id', businessUser?.company_id);

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
        throw ordersError;
      }

      console.log('Orders fetched:', ordersData?.length || 0);

      if (!ordersData || ordersData.length === 0) {
        console.log('No orders found');
        setBackorders([]);
        setStats({ total_lines: 0, total_backorder_qty: 0, total_backorder_value: 0, lines_with_stock: 0 });
        setLoading(false);
        return;
      }

      const orderIds = ordersData.map(o => o.id);
      console.log('Order IDs:', orderIds);

      // Step 2: Get backorder items for these orders
      const { data: itemsData, error: itemsError } = await supabase
        .from('sales_order_items')
        .select('*')
        .in('sales_order_id', orderIds)
        .gt('back_order_quantity', 0);

      if (itemsError) {
        console.error('Error fetching items:', itemsError);
        throw itemsError;
      }

      console.log('Backorder items fetched:', itemsData?.length || 0, itemsData);

      if (!itemsData || itemsData.length === 0) {
        console.log('No backorder items found');
        setBackorders([]);
        setStats({ total_lines: 0, total_backorder_qty: 0, total_backorder_value: 0, lines_with_stock: 0 });
        setLoading(false);
        return;
      }

      // Create order lookup map
      const ordersMap = new Map(ordersData.map(o => [o.id, o]));

      // Get unique customer IDs and product IDs
      const customerIds = [...new Set(ordersData.map(o => o.customer_id))];
      const productIds = [...new Set(itemsData.map(item => item.product_id))];

      console.log('Fetching customers and products...');

      // Fetch customers and products
      const { data: customersData } = await supabase
        .from('customers')
        .select('id, name')
        .in('id', customerIds);

      const { data: productsData } = await supabase
        .from('products')
        .select('id, name, sku, stock_quantity')
        .in('id', productIds);

      console.log('Customers:', customersData?.length || 0, 'Products:', productsData?.length || 0);

      // Create lookup maps
      const customersMap = new Map((customersData || []).map(c => [c.id, c]));
      const productsMap = new Map((productsData || []).map(p => [p.id, p]));

      // Transform data
      const enrichedData: BackorderLineItem[] = itemsData.map((item: any) => {
        const order = ordersMap.get(item.sales_order_id);
        const customer = customersMap.get(order?.customer_id);
        const product = productsMap.get(item.product_id);

        // Fix calculation: prevent negative values
        const readyToDeliver = Math.max(0, (item.ordered_quantity || 0) - (item.quantity || 0) - (item.back_order_quantity || 0));

        return {
          id: item.id,
          so_number: order?.order_number || 'N/A',
          order_date: order?.order_date || '',
          customer_id: order?.customer_id || '',
          customer_name: customer?.name || 'Unknown',
          po_number: order?.customer_po_number || '',
          product_id: item.product_id,
          product_name: product?.name || 'Unknown',
          product_sku: product?.sku || 'N/A',
          ordered_qty: item.ordered_quantity || 0,
          invoiced_qty: item.quantity || 0,
          ready_to_deliver_qty: readyToDeliver,
          backorder_qty: item.back_order_quantity || 0,
          available_stock: product?.stock_quantity || 0,
          unit_price: item.unit_price || 0,
          line_total: (item.back_order_quantity || 0) * (item.unit_price || 0),
          so_status: order?.status || 'unknown',
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
