import React, { useState, useEffect } from 'react';
import { Package, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import BackorderTable from '@/components/tables/BackorderTable';
import { SalesInvoiceForm } from '@/components/forms/SalesInvoiceForm';

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
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [prefilledInvoiceData, setPrefilledInvoiceData] = useState<any>(null);
  const [releaseQuantity, setReleaseQuantity] = useState(0);

  const { company } = useAuth();
  const { businessUser, hasAccess, hasEditAccess } = useBusinessAuth();
  const { toast } = useToast();

  const canEdit = hasEditAccess('sales');

  useEffect(() => {
    if (company?.id) {
      fetchBackorders();
    }
  }, [company?.id]);

  const fetchBackorders = async () => {
    if (!company?.id) {
      console.log('No company_id found');
      return;
    }

    try {
      setLoading(true);
      console.log('Fetching backorders for company:', company.id);

      // Step 1: Get all sales orders for this company
      const { data: ordersData, error: ordersError } = await supabase
        .from('sales_orders')
        .select('id, order_number, order_date, customer_id, customer_po_number, status')
        .eq('company_id', company.id);

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

      // Store release quantity for later use
      setReleaseQuantity(releaseQty);

      // Fetch complete sales order item details
      const { data: soItemData, error: soItemError } = await supabase
        .from('sales_order_items')
        .select('*')
        .eq('id', itemId)
        .single();

      if (soItemError) throw soItemError;

      // Fetch sales order header with all details
      const { data: soData, error: soError } = await supabase
        .from('sales_orders')
        .select('*')
        .eq('id', soItemData.sales_order_id)
        .single();

      if (soError) throw soError;

      // Fetch customer details
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', item.customer_id)
        .single();

      if (customerError) throw customerError;

      // Fetch product details
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', item.product_id)
        .single();

      if (productError) throw productError;

      // Prepare invoice data with all required fields pre-filled
      const invoiceData = {
        invoice_date: new Date(),
        sales_order_id: soData.id,
        customer_id: customerData.id,
        customer_name: customerData.name,
        billing_address_line1: customerData.address_line1 || '',
        billing_address_line2: customerData.address_line2 || '',
        billing_city: customerData.city || '',
        billing_state: customerData.state || '',
        billing_pin_code: customerData.pin_code || '',
        billing_country: customerData.country || 'India',
        shipping_address_line1: soData.delivery_address_line1 || customerData.address_line1 || '',
        shipping_address_line2: soData.delivery_address_line2 || customerData.address_line2 || '',
        shipping_city: soData.delivery_city || customerData.city || '',
        shipping_state: soData.delivery_state || customerData.state || '',
        shipping_pin_code: soData.delivery_pin_code || customerData.pin_code || '',
        shipping_country: soData.delivery_country || customerData.country || 'India',
        same_as_billing_address: false,
        customer_po_reference: soData.customer_po_number || '',
        currency: soData.currency || 'INR',
        payment_terms: soData.payment_terms || '',
        account_manager: soData.account_manager || '',
        mode_of_delivery: soData.mode_of_transport || '',
        transporter: '',
        freight_charges: 0,
        packing_charges: 0,
        round_off: 0,
        notes: `Released from backorder - SO ${item.so_number}`,
        status: 'finalized' as const,
        default_warehouse_id: item.warehouse_id || soData.default_warehouse_id || '',
        default_bin_id: item.bin_id || soData.default_bin_id || '',
        items: [{
          product_id: productData.id,
          item_code: productData.sku,
          item_description: productData.name,
          hsn_sac_code: soItemData.hsn_sac_code || '',
          quantity_ordered: item.backorder_qty,
          quantity_invoiced: releaseQty,
          backorder_quantity: item.backorder_qty - releaseQty, // Remaining backorder after release
          unit_of_measure: soItemData.unit_of_measure || 'pcs',
          unit_price: soItemData.unit_price,
          discount_percentage: soItemData.discount_percentage || 0,
          cgst_rate: soItemData.cgst_rate || 0,
          sgst_rate: soItemData.sgst_rate || 0,
          igst_rate: soItemData.igst_rate || 0,
          warehouse_id: item.warehouse_id || soData.default_warehouse_id || '',
          bin_id: item.bin_id || soData.default_bin_id || '',
        }]
      };

      setPrefilledInvoiceData(invoiceData);
      setShowInvoiceDialog(true);

    } catch (error) {
      console.error('Error preparing invoice:', error);
      toast({
        title: 'Error',
        description: 'Failed to prepare invoice form. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleInvoiceSubmit = async (data: any) => {
    try {
      // Create invoice in database
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('sales_invoices')
        .insert({
          company_id: company?.id,
          invoice_date: data.invoice_date,
          sales_order_id: data.sales_order_id,
          customer_id: data.customer_id,
          customer_name: data.customer_name,
          billing_address_line1: data.billing_address_line1,
          billing_address_line2: data.billing_address_line2,
          billing_city: data.billing_city,
          billing_state: data.billing_state,
          billing_pin_code: data.billing_pin_code,
          billing_country: data.billing_country,
          shipping_address_line1: data.shipping_address_line1,
          shipping_address_line2: data.shipping_address_line2,
          shipping_city: data.shipping_city,
          shipping_state: data.shipping_state,
          shipping_pin_code: data.shipping_pin_code,
          shipping_country: data.shipping_country,
          same_as_billing_address: data.same_as_billing_address,
          customer_po_reference: data.customer_po_reference,
          currency: data.currency,
          payment_terms: data.payment_terms,
          account_manager: data.account_manager,
          mode_of_delivery: data.mode_of_delivery,
          transporter: data.transporter,
          freight_charges: data.freight_charges,
          packing_charges: data.packing_charges,
          round_off: data.round_off,
          notes: data.notes,
          status: 'finalized',
          default_warehouse_id: data.default_warehouse_id,
          default_bin_id: data.default_bin_id,
          subtotal_amount: 0,
          discount_amount: 0,
          tax_amount: 0,
          total_amount: 0,
          created_by: businessUser?.id
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Insert invoice items
      const invoiceItems = data.items.map((item: any) => {
        const unitPrice = item.unit_price;
        const quantity = item.quantity_invoiced;
        const discountPercentage = item.discount_percentage || 0;
        const discountAmount = (unitPrice * quantity * discountPercentage) / 100;
        const subtotal = (unitPrice * quantity) - discountAmount;
        
        const cgstAmount = (subtotal * (item.cgst_rate || 0)) / 100;
        const sgstAmount = (subtotal * (item.sgst_rate || 0)) / 100;
        const igstAmount = (subtotal * (item.igst_rate || 0)) / 100;
        const taxAmount = cgstAmount + sgstAmount + igstAmount;
        const lineTotal = subtotal + taxAmount;

        return {
          sales_invoice_id: invoiceData.id,
          product_id: item.product_id,
          item_code: item.item_code,
          item_description: item.item_description,
          hsn_sac_code: item.hsn_sac_code,
          quantity_ordered: item.quantity_ordered,
          quantity_invoiced: item.quantity_invoiced,
          backorder_quantity: item.quantity_ordered - item.quantity_invoiced,
          unit_of_measure: item.unit_of_measure,
          unit_price: unitPrice,
          discount_percentage: discountPercentage,
          discount_amount: discountAmount,
          cgst_rate: item.cgst_rate || 0,
          cgst_amount: cgstAmount,
          sgst_rate: item.sgst_rate || 0,
          sgst_amount: sgstAmount,
          igst_rate: item.igst_rate || 0,
          igst_amount: igstAmount,
          line_subtotal: subtotal,
          tax_amount: taxAmount,
          line_total: lineTotal,
          warehouse_id: item.warehouse_id,
          bin_id: item.bin_id
        };
      });

      const { error: itemsError } = await supabase
        .from('sales_invoice_items')
        .insert(invoiceItems);

      if (itemsError) throw itemsError;

      // Update backorder quantity in sales_order_items
      const backorderItem = backorders.find(b => b.product_id === data.items[0].product_id);
      if (backorderItem) {
        const newBackorderQty = backorderItem.backorder_qty - releaseQuantity;
        
        const { error: updateError } = await supabase
          .from('sales_order_items')
          .update({
            back_order_quantity: Math.max(0, newBackorderQty),
            updated_at: new Date().toISOString()
          })
          .eq('id', backorderItem.id);

        if (updateError) throw updateError;
      }

      // Create inventory transactions and update stock
      for (const item of invoiceItems) {
        await supabase.from('inventory_transactions').insert({
          company_id: company?.id,
          product_id: item.product_id,
          transaction_type: 'sales_invoice',
          quantity_change: -item.quantity_invoiced,
          unit_cost: item.unit_price,
          reference_id: invoiceData.id,
          transaction_date: data.invoice_date,
          warehouse_id: item.warehouse_id,
          bin_id: item.bin_id,
          created_by: businessUser?.id
        });

        // Update product stock quantity
        const { data: currentProduct } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', item.product_id)
          .single();

        if (currentProduct) {
          await supabase
            .from('products')
            .update({
              stock_quantity: (currentProduct.stock_quantity || 0) - item.quantity_invoiced,
              updated_at: new Date().toISOString()
            })
            .eq('id', item.product_id);
        }
      }

      toast({
        title: 'Success',
        description: `Invoice created successfully for ${releaseQuantity} units`,
      });

      setShowInvoiceDialog(false);
      setPrefilledInvoiceData(null);
      fetchBackorders();

    } catch (error) {
      console.error('Error creating invoice:', error);
      toast({
        title: 'Error',
        description: 'Failed to create invoice. Please try again.',
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

      {/* Invoice Dialog */}
      <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Sales Invoice from Backorder Release</DialogTitle>
          </DialogHeader>
          {prefilledInvoiceData && (
            <SalesInvoiceForm
              editingInvoice={prefilledInvoiceData}
              onSubmit={handleInvoiceSubmit}
              onCancel={() => {
                setShowInvoiceDialog(false);
                setPrefilledInvoiceData(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
