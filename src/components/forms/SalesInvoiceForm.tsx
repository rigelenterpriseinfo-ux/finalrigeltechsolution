import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Plus, Trash2, FileText, User, MapPin, Package, Settings, Info, Building, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

const salesInvoiceSchema = z.object({
  invoice_number: z.string().optional(),
  invoice_date: z.date(),
  sales_order_id: z.string().min(1, 'Sales order is required'),
  delivery_note_number: z.string().optional(),
  customer_id: z.string().min(1, 'Customer is required'),
  customer_name: z.string().min(1, 'Customer name is required'),
  billing_address_line1: z.string().min(1, 'Billing address line 1 is required'),
  billing_address_line2: z.string().optional(),
  billing_city: z.string().min(1, 'Billing city is required'),
  billing_state: z.string().min(1, 'Billing state is required'),
  billing_pin_code: z.string().min(1, 'Billing pin code is required'),
  billing_country: z.string().min(1, 'Billing country is required'),
  shipping_address_line1: z.string().min(1, 'Shipping address line 1 is required'),
  shipping_address_line2: z.string().optional(),
  shipping_city: z.string().min(1, 'Shipping city is required'),
  shipping_state: z.string().min(1, 'Shipping state is required'),
  shipping_pin_code: z.string().min(1, 'Shipping pin code is required'),
  shipping_country: z.string().min(1, 'Shipping country is required'),
  same_as_billing_address: z.boolean().default(false),
  customer_po_reference: z.string().min(1, 'Customer PO reference is required'),
  currency: z.string().min(1, 'Currency is required').default('INR'),
  payment_terms: z.string().min(1, 'Payment terms is required'),
  due_date: z.date().optional(),
  salesperson_id: z.string().optional(),
  account_manager: z.string().optional(),
  mode_of_delivery: z.string().min(1, 'Mode of delivery is required'),
  transporter: z.string().optional(),
  freight_charges: z.number().default(0),
  packing_charges: z.number().default(0),
  round_off: z.number().default(0),
  notes: z.string().optional(),
  status: z.enum(['draft', 'finalized']).default('draft'),
  default_warehouse_id: z.string().min(1, 'Default warehouse is required'),
  default_bin_id: z.string().min(1, 'Default bin is required'),
  items: z.array(z.object({
    product_id: z.string().min(1, 'Product is required'),
    item_code: z.string().min(1, 'Item code is required'),
    item_description: z.string().min(1, 'Description is required'),
    hsn_sac_code: z.string().optional(),
    quantity_ordered: z.number().min(0),
    quantity_invoiced: z.number().min(0, 'Quantity must be at least 0'),
    unit_of_measure: z.string().default('pcs'),
    unit_price: z.number().min(0, 'Unit price must be at least 0'),
    discount_percentage: z.number().min(0).max(100).default(0),
    cgst_rate: z.number().min(0).max(100).default(0),
    sgst_rate: z.number().min(0).max(100).default(0),
    igst_rate: z.number().min(0).max(100).default(0),
    warehouse_id: z.string().optional(),
    bin_id: z.string().optional(),
  })).min(1, 'At least one item is required'),
});

type SalesInvoiceFormData = z.infer<typeof salesInvoiceSchema>;

interface SalesInvoiceFormProps {
  editingInvoice?: any;
  onSubmit: (data: SalesInvoiceFormData) => Promise<void>;
  onCancel: () => void;
}

export const SalesInvoiceForm: React.FC<SalesInvoiceFormProps> = ({
  editingInvoice,
  onSubmit,
  onCancel,
}) => {
  const { company } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [salesOrders, setSalesOrders] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [bins, setBins] = useState<any[]>([]);
  const [selectedSalesOrder, setSelectedSalesOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [warehouseName, setWarehouseName] = useState('');
  const [binName, setBinName] = useState('');
  const [stockLevels, setStockLevels] = useState<Record<string, number>>({});
  const [quantityErrors, setQuantityErrors] = useState<Record<number, string>>({});
  const [remainingQuantities, setRemainingQuantities] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState('invoice-info');

  const form = useForm<SalesInvoiceFormData>({
    resolver: zodResolver(salesInvoiceSchema),
    defaultValues: {
      invoice_date: new Date(),
      currency: 'INR',
      same_as_billing_address: false,
      freight_charges: 0,
      packing_charges: 0,
      round_off: 0,
      status: 'draft',
      default_warehouse_id: '',
      default_bin_id: '',
      items: [],
    },
  });

  const watchedSameAsBilling = form.watch('same_as_billing_address');
  const watchedItems = form.watch('items');
  const watchedStatus = form.watch('status');

  useEffect(() => {
    if (company?.id) {
      fetchCustomers();
      fetchSalesOrders();
      fetchWarehouses();
    }
  }, [company?.id]);

  useEffect(() => {
    if (editingInvoice) {
      form.reset({
        ...editingInvoice,
        invoice_date: new Date(editingInvoice.invoice_date),
        due_date: editingInvoice.due_date ? new Date(editingInvoice.due_date) : undefined,
        items: editingInvoice.sales_invoice_items || [],
      });
      
      // Auto-populate sales order details when editing
      if (editingInvoice.sales_order_id) {
        fetchSalesOrderDetails(editingInvoice.sales_order_id);
      }
    }
  }, [editingInvoice]);

  useEffect(() => {
    if (watchedSameAsBilling) {
      const billingAddress = form.getValues();
      form.setValue('shipping_address_line1', billingAddress.billing_address_line1 || '');
      form.setValue('shipping_address_line2', billingAddress.billing_address_line2 || '');
      form.setValue('shipping_city', billingAddress.billing_city || '');
      form.setValue('shipping_state', billingAddress.billing_state || '');
      form.setValue('shipping_pin_code', billingAddress.billing_pin_code || '');
      form.setValue('shipping_country', billingAddress.billing_country || '');
    }
  }, [watchedSameAsBilling]);

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', company.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchSalesOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_orders')
        .select('*, customers!inner(name)')
        .eq('company_id', company.id)
        .in('status', ['confirmed', 'partially_delivered'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSalesOrders(data || []);
    } catch (error) {
      console.error('Error fetching sales orders:', error);
    }
  };


  const fetchWarehouses = async () => {
    try {
      const { data, error } = await supabase
        .from('warehouse_bins')
        .select('*')
        .eq('company_id', company.id)
        .eq('is_active', true)
        .order('warehouse_name, bin_name');

      if (error) throw error;
      setWarehouses(data || []);
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    }
  };

  const handleWarehouseChange = (warehouseId: string) => {
    form.setValue('default_warehouse_id', warehouseId);
    const filteredBins = warehouses.filter(w => w.id === warehouseId);
    setBins(filteredBins);
    form.setValue('default_bin_id', '');
  };

  const fetchStockLevels = async (productIds: string[], warehouseId?: string, binId?: string) => {
    if (!company?.id || productIds.length === 0) return {};
    
    console.log('📦 Fetching stock levels:', { 
      productIds, 
      warehouseId, 
      binId,
      warehouseName: warehouseName || 'Not selected',
      binName: binName || 'Not selected'
    });
    
    try {
      // Query inventory_transactions directly to calculate stock levels
      let query = supabase
        .from('inventory_transactions')
        .select('product_id, quantity_change')
        .eq('company_id', company.id)
        .in('product_id', productIds);
      
      if (warehouseId) query = query.eq('warehouse_id', warehouseId);
      if (binId) query = query.eq('bin_id', binId);
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      console.log('📊 Inventory transactions fetched:', data?.length || 0, 'records');
      
      // Aggregate stock by product
      const stockMap: Record<string, number> = {};
      data?.forEach(item => {
        const currentStock = stockMap[item.product_id] || 0;
        stockMap[item.product_id] = currentStock + (item.quantity_change || 0);
      });
      
      // Ensure non-negative values
      Object.keys(stockMap).forEach(key => {
        stockMap[key] = Math.max(0, stockMap[key]);
      });
      
      console.log('✅ Stock levels calculated:', stockMap);
      
      return stockMap;
    } catch (error) {
      console.error('❌ Error fetching stock levels:', error);
      toast({
        title: "Warning",
        description: "Could not fetch current stock levels. Please verify stock availability manually.",
        variant: "destructive",
      });
      return {};
    }
  };

  const validateQuantity = (itemIndex: number, invoicedQty: number, orderedQty: number, productId: string): string | null => {
    const stockOnHand = stockLevels[productId] || 0;
    const remainingData = remainingQuantities[productId];
    
    if (!remainingData) {
      return `Product data not loaded`;
    }
    
    const remainingQty = remainingData.quantity_remaining || 0;
    const currentBackorderQty = remainingData.current_backorder_qty || 0;
    
    if (invoicedQty > remainingQty) {
      return `Cannot exceed remaining quantity (${remainingQty} available)`;
    }
    
    if (invoicedQty > currentBackorderQty && currentBackorderQty > 0) {
      return `Cannot exceed current backorder (${currentBackorderQty})`;
    }
    
    if (invoicedQty > stockOnHand) {
      return `Insufficient stock (${stockOnHand} available)`;
    }
    
    return null;
  };

  const handleQuantityChange = (itemIndex: number, value: number) => {
    const items = form.getValues('items');
    const item = items[itemIndex];
    
    if (item) {
      const error = validateQuantity(itemIndex, value, item.quantity_ordered, item.product_id);
      
      setQuantityErrors(prev => ({
        ...prev,
        [itemIndex]: error || ''
      }));
      
      form.setValue(`items.${itemIndex}.quantity_invoiced`, value);
    }
  };

  const fetchSalesOrderDetails = async (salesOrderId: string) => {
    try {
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          *,
          customers!inner(*),
          sales_order_items(
            *,
            products!inner(name, sku, stock_quantity)
          )
        `)
        .eq('id', salesOrderId)
        .single();

      if (error) throw error;
      setSelectedSalesOrder(data);
      
      const { data: remainingData, error: remainingError } = await supabase
        .rpc('get_sales_order_item_remaining_quantities', {
          p_sales_order_id: salesOrderId
        });

      if (remainingError) {
        console.error('Error fetching remaining quantities:', remainingError);
        throw remainingError;
      }

      const remainingMap: Record<string, any> = {};
      remainingData?.forEach((item: any) => {
        remainingMap[item.product_id] = item;
      });
      setRemainingQuantities(remainingMap);
      
      const customer = data.customers;
      form.setValue('customer_id', customer.id);
      form.setValue('customer_name', customer.name);
      form.setValue('billing_address_line1', customer.address_line1 || '');
      form.setValue('billing_address_line2', customer.address_line2 || '');
      form.setValue('billing_city', customer.city || '');
      form.setValue('billing_state', customer.state || '');
      form.setValue('billing_pin_code', customer.pin_code || '');
      form.setValue('billing_country', customer.country || '');
      
      // Auto-populate additional fields from Sales Order
      form.setValue('customer_po_reference', data.customer_po_number || '');
      form.setValue('payment_terms', data.payment_terms || '');
      form.setValue('currency', data.currency || 'INR');
      form.setValue('account_manager', data.account_manager || '');
      form.setValue('mode_of_delivery', data.mode_of_transport || '');
      form.setValue('transporter', data.carrier_transporter || '');
      
      // Auto-populate shipping addresses from delivery addresses
      form.setValue('shipping_address_line1', data.delivery_address_line1 || customer.address_line1 || '');
      form.setValue('shipping_address_line2', data.delivery_address_line2 || customer.address_line2 || '');
      form.setValue('shipping_city', data.delivery_city || customer.city || '');
      form.setValue('shipping_state', data.delivery_state || customer.state || '');
      form.setValue('shipping_pin_code', data.delivery_pin_code || customer.pin_code || '');
      form.setValue('shipping_country', data.delivery_country || customer.country || '');
      
      if (data.sales_order_items && data.sales_order_items.length > 0) {
        const firstItem = data.sales_order_items[0];
        if (firstItem.warehouse_id && firstItem.bin_id) {
          const { data: warehouseData } = await supabase
            .from('warehouse_bins')
            .select('warehouse_name, bin_name')
            .eq('id', firstItem.warehouse_id)
            .single();
            
          if (warehouseData) {
            form.setValue('default_warehouse_id', firstItem.warehouse_id);
            form.setValue('default_bin_id', firstItem.bin_id);
            setWarehouseName(warehouseData.warehouse_name);
            setBinName(warehouseData.bin_name);
          }
        }
      }
      
      // Create lookup map for sales order items with discount and GST details
      const salesOrderItemsMap: Record<string, any> = {};
      data.sales_order_items?.forEach((item: any) => {
        salesOrderItemsMap[item.product_id] = item;
      });
      
      const items = remainingData?.map((item: any) => {
        const originalItem = salesOrderItemsMap[item.product_id];
        
        return {
          product_id: item.product_id,
          item_code: item.product_sku,
          item_description: item.product_name,
          hsn_sac_code: item.hsn_sac_code || '',
          quantity_ordered: item.quantity_ordered,
          quantity_invoiced: 0,
          unit_of_measure: item.unit_of_measure,
          unit_price: parseFloat(item.unit_price.toString()),
          discount_percentage: originalItem?.discount_percentage || 0,
          cgst_rate: originalItem?.cgst_rate || 0,
          sgst_rate: originalItem?.sgst_rate || 0,
          igst_rate: originalItem?.igst_rate || 0,
        };
      }) || [];
      
      const productIds = items.map((item: any) => item.product_id);
      const defaultWarehouseId = data.default_warehouse_id;
      const defaultBinId = data.default_bin_id;
      
      const stockData = await fetchStockLevels(productIds, defaultWarehouseId, defaultBinId);
      setStockLevels(stockData);
      
      form.setValue('items', items);
    } catch (error) {
      console.error('Error fetching sales order details:', error);
      toast({
        title: "Error",
        description: "Failed to load sales order details",
        variant: "destructive",
      });
    }
  };

  const onSalesOrderChange = (salesOrderId: string) => {
    form.setValue('sales_order_id', salesOrderId);
    if (salesOrderId) {
      fetchSalesOrderDetails(salesOrderId);
    }
  };

  const calculateItemTotals = (index: number) => {
    const items = form.getValues('items');
    const item = items[index];
    
    if (!item) return;
    
    const subtotal = item.quantity_invoiced * item.unit_price;
    const discountAmount = (subtotal * item.discount_percentage) / 100;
    const taxableAmount = subtotal - discountAmount;
    
    const cgstAmount = (taxableAmount * item.cgst_rate) / 100;
    const sgstAmount = (taxableAmount * item.sgst_rate) / 100;
    const igstAmount = (taxableAmount * item.igst_rate) / 100;
    
    const totalTax = cgstAmount + sgstAmount + igstAmount;
    const lineTotal = taxableAmount + totalTax;
    
    return {
      subtotal,
      discountAmount,
      taxableAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalTax,
      lineTotal,
      backorderQuantity: remainingQuantities[item.product_id]?.current_backorder_qty || (item.quantity_ordered - item.quantity_invoiced),
    };
  };

  const calculateGrandTotals = () => {
    const items = form.getValues('items');
    const freightCharges = form.getValues('freight_charges') || 0;
    const packingCharges = form.getValues('packing_charges') || 0;
    const roundOff = form.getValues('round_off') || 0;
    
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let totalOrderedQty = 0;
    let totalInvoicedQty = 0;
    let totalBackorderQty = 0;
    
    items.forEach((_, index) => {
      const itemTotals = calculateItemTotals(index);
      if (itemTotals) {
        subtotal += itemTotals.subtotal;
        totalDiscount += itemTotals.discountAmount;
        totalTax += itemTotals.totalTax;
        totalOrderedQty += items[index].quantity_ordered;
        totalInvoicedQty += items[index].quantity_invoiced;
        totalBackorderQty += itemTotals.backorderQuantity;
      }
    });
    
    const grandTotal = subtotal - totalDiscount + totalTax + freightCharges + packingCharges + roundOff;
    
    return {
      subtotal,
      totalDiscount,
      totalTax,
      grandTotal,
      totalOrderedQty,
      totalInvoicedQty,
      totalBackorderQty,
    };
  };

  const numberToWords = (num: number): string => {
    if (num === 0) return 'Zero';
    return `Rupees ${num.toFixed(2)} only`;
  };

  const handleSubmit = async (data: SalesInvoiceFormData) => {
    setLoading(true);
    try {
      const totals = calculateGrandTotals();
      
      const invoiceData = {
        ...data,
        subtotal_amount: totals.subtotal,
        discount_amount: totals.totalDiscount,
        tax_amount: totals.totalTax,
        total_amount: totals.grandTotal,
        amount_in_words: numberToWords(totals.grandTotal),
        items: data.items.map(item => ({
          ...item,
          warehouse_id: data.default_warehouse_id,
          bin_id: data.default_bin_id
        }))
      };
      
      await onSubmit(invoiceData);
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateGrandTotals();

  return (
    <div className="flex flex-col h-full max-w-7xl mx-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-background">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-xl font-semibold">
                  {editingInvoice ? 'Edit Sales Invoice' : 'Create Sales Invoice'}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {editingInvoice ? 'Update invoice details' : 'Generate invoice from sales order'}
                </p>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1">
            <TabsList className="grid w-full grid-cols-2 bg-muted/50 rounded-none border-b h-auto p-0">
              <TabsTrigger 
                value="invoice-info" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-background h-12"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Invoice Info
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="items" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-background h-12"
              >
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Line Items & Review
                </div>
              </TabsTrigger>
            </TabsList>

            {/* Invoice Info Tab */}
            <TabsContent value="invoice-info" className="flex-1 overflow-auto m-0 p-4">
              <div className="space-y-4">
                {/* Header Information */}
                <Card className="shadow-sm border-border/50">
                  <CardHeader className="pb-2 pt-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      Header Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="invoice_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">Invoice Number</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder={
                                  watchedStatus === 'draft' 
                                    ? "Will be generated when finalized" 
                                    : "Auto-generated if empty"
                                } 
                                {...field} 
                                disabled={!!editingInvoice || watchedStatus === 'draft'}
                                className="h-9"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="invoice_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">Invoice Date</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "h-9 pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value ? (
                                      format(field.value, "PPP")
                                    ) : (
                                      <span>Pick a date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  initialFocus
                                  className="p-3 pointer-events-auto"
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="sales_order_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              Sales Order Number <span className="text-red-500">*</span>
                            </FormLabel>
                            <Select onValueChange={onSalesOrderChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Select sales order" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {salesOrders.map((order) => (
                                  <SelectItem key={order.id} value={order.id}>
                                    {order.order_number} - {order.customers.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    {/* Selected Order Details Display */}
                    {selectedSalesOrder && (
                      <div className="mt-4 p-3 bg-muted/30 rounded-md border border-border/50">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Selected Order Details</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Sales Order:</span>
                            <span className="ml-2 font-medium">{selectedSalesOrder.order_number}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Customer:</span>
                            <span className="ml-2 font-medium">{form.watch('customer_name') || selectedSalesOrder.customers?.name}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>


                {/* Additional References */}
                <Card className="shadow-sm border-border/50">
                  <CardHeader className="pb-2 pt-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      Additional References
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="delivery_note_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">Delivery Note Number</FormLabel>
                            <FormControl>
                              <Input placeholder="Optional" {...field} className="h-9" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="customer_po_reference"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              Customer PO Reference <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="Customer PO reference" {...field} className="h-9" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Warehouse and Bin Section */}
                <Card className="shadow-sm border-border/50">
                  <CardHeader className="pb-2 pt-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      Warehouse & Bin Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="default_warehouse_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              Default Warehouse <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input 
                                value={warehouseName || 'Not selected'}
                                disabled
                                className="h-9 bg-muted/30"
                              />
                            </FormControl>
                            <FormMessage />
                            {!field.value && (
                              <p className="text-xs text-muted-foreground">
                                Will be auto-filled from selected Sales Order
                              </p>
                            )}
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="default_bin_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              Default Bin <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input 
                                value={binName || 'Not selected'}
                                disabled
                                className="h-9 bg-muted/30"
                              />
                            </FormControl>
                            <FormMessage />
                            {!field.value && (
                              <p className="text-xs text-muted-foreground">
                                Will be auto-filled from selected Sales Order
                              </p>
                            )}
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Customer and Address Section */}
                <Card className="shadow-sm border-border/50">
                  <CardHeader className="pb-2 pt-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      Customer & Address Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Customer Name */}
                    <div className="mb-4">
                        <FormField
                          control={form.control}
                          name="customer_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">
                                Customer Name <span className="text-red-500">*</span>
                              </FormLabel>
                              <FormControl>
                                <Input {...field} disabled className="h-9 bg-muted/30" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                    </div>

                    {/* Address Section */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {/* Billing Address */}
                      <div className="space-y-3 p-3 bg-green-50/50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-green-600" />
                          <h4 className="text-sm font-semibold text-green-800">Billing Address</h4>
                        </div>
                        
                        <FormField
                          control={form.control}
                          name="billing_address_line1"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium">
                                Address Line 1 <span className="text-red-500">*</span>
                              </FormLabel>
                              <FormControl>
                                <Input {...field} className="h-8 text-sm" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="billing_address_line2"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium">Address Line 2</FormLabel>
                              <FormControl>
                                <Input {...field} className="h-8 text-sm" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <div className="grid grid-cols-2 gap-2">
                          <FormField
                            control={form.control}
                            name="billing_city"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium">
                                  City <span className="text-red-500">*</span>
                                </FormLabel>
                                <FormControl>
                                  <Input {...field} className="h-8 text-sm" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="billing_state"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium">
                                  State <span className="text-red-500">*</span>
                                </FormLabel>
                                <FormControl>
                                  <Input {...field} className="h-8 text-sm" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <FormField
                            control={form.control}
                            name="billing_pin_code"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium">
                                  Pin Code <span className="text-red-500">*</span>
                                </FormLabel>
                                <FormControl>
                                  <Input {...field} className="h-8 text-sm" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="billing_country"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium">
                                  Country <span className="text-red-500">*</span>
                                </FormLabel>
                                <FormControl>
                                  <Input {...field} className="h-8 text-sm" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* Shipping Address */}
                      <div className="space-y-3 p-3 bg-purple-50/50 border border-purple-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-purple-600" />
                            <h4 className="text-sm font-semibold text-purple-800">Shipping Address</h4>
                          </div>
                          <FormField
                            control={form.control}
                            name="same_as_billing_address"
                            render={({ field }) => (
                              <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    className="border"
                                  />
                                </FormControl>
                                <FormLabel className="text-xs font-medium cursor-pointer">Same as Billing</FormLabel>
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <FormField
                          control={form.control}
                          name="shipping_address_line1"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium">
                                Address Line 1 <span className="text-red-500">*</span>
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  disabled={watchedSameAsBilling} 
                                  className={cn("h-8 text-sm", watchedSameAsBilling && "bg-purple-100 text-purple-600")}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="shipping_address_line2"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium">Address Line 2</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  disabled={watchedSameAsBilling} 
                                  className={cn("h-8 text-sm", watchedSameAsBilling && "bg-purple-100 text-purple-600")}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <div className="grid grid-cols-2 gap-2">
                          <FormField
                            control={form.control}
                            name="shipping_city"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium">
                                  City <span className="text-red-500">*</span>
                                </FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    disabled={watchedSameAsBilling} 
                                    className={cn("h-8 text-sm", watchedSameAsBilling && "bg-purple-100 text-purple-600")}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="shipping_state"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium">
                                  State <span className="text-red-500">*</span>
                                </FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    disabled={watchedSameAsBilling} 
                                    className={cn("h-8 text-sm", watchedSameAsBilling && "bg-purple-100 text-purple-600")}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <FormField
                            control={form.control}
                            name="shipping_pin_code"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium">
                                  Pin Code <span className="text-red-500">*</span>
                                </FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    disabled={watchedSameAsBilling} 
                                    className={cn("h-8 text-sm", watchedSameAsBilling && "bg-purple-100 text-purple-600")}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="shipping_country"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium">
                                  Country <span className="text-red-500">*</span>
                                </FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    disabled={watchedSameAsBilling} 
                                    className={cn("h-8 text-sm", watchedSameAsBilling && "bg-purple-100 text-purple-600")}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Payment & Terms */}
                <Card className="shadow-sm border-border/50">
                  <CardHeader className="pb-2 pt-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Settings className="h-4 w-4 text-primary" />
                      Payment & Terms
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="due_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              Due Date
                            </FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "h-9 pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value ? (
                                      format(field.value, "PPP")
                                    ) : (
                                      <span>Pick a date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  initialFocus
                                  className="p-3 pointer-events-auto"
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="payment_terms"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              Payment Terms <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Net 30" {...field} className="h-9" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="currency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              Currency <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input {...field} disabled className="h-9 bg-muted/30" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Logistics & Delivery */}
                <Card className="shadow-sm border-border/50">
                  <CardHeader className="pb-2 pt-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      Logistics & Delivery
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="account_manager"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              Account Manager
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="Enter account manager" {...field} className="h-9" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="mode_of_delivery"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              Mode of Delivery <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Courier, Road" {...field} className="h-9" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="transporter"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              Transporter
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="Enter transporter name" {...field} className="h-9" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Items Tab (including Review & Submit) */}
            <TabsContent value="items" className="flex-1 overflow-auto m-0 p-4">
              <div className="space-y-4">
                {/* Line Items Section */}
                <Card className="shadow-sm border-border/50">
                  <CardHeader className="pb-2 pt-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      Line Items
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                  {watchedItems.length > 0 ? (
                    <div className="space-y-4">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Code</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">HSN</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ordered</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Already Invoiced</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remaining</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice Qty</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SO Backorder</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">UOM</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Discount %</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CGST %</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SGST %</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IGST %</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Line Total</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {watchedItems.map((item, index) => {
                              const itemTotals = calculateItemTotals(index);
                              const remainingData = remainingQuantities[item.product_id];
                              return (
                                <tr key={index}>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.item_code}</td>
                                  <td className="px-4 py-4 text-sm text-gray-900 max-w-xs truncate">{item.item_description}</td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.hsn_sac_code}</td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.quantity_ordered}</td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {remainingData?.quantity_already_invoiced || 0}
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {remainingData?.quantity_remaining || 0}
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm">
                                    <div className="flex items-center gap-2">
                                      <span className={cn(
                                        "font-medium",
                                        (stockLevels[item.product_id] || 0) === 0 ? "text-red-600" : "text-gray-900"
                                      )}>
                                        {stockLevels[item.product_id] !== undefined ? stockLevels[item.product_id] : '—'}
                                      </span>
                                      {(stockLevels[item.product_id] || 0) === 0 && (
                                        <Badge variant="destructive" className="text-xs">
                                          Out of Stock
                                        </Badge>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap">
                                    <FormField
                                      control={form.control}
                                      name={`items.${index}.quantity_invoiced`}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormControl>
                                            <Input
                                              type="number"
                                              min="0"
                                              {...field}
                                              onChange={(e) => {
                                                const value = parseFloat(e.target.value) || 0;
                                                handleQuantityChange(index, value);
                                              }}
                                              className={cn(
                                                "w-20",
                                                quantityErrors[index] && "border-red-500"
                                              )}
                                            />
                                          </FormControl>
                                          {quantityErrors[index] && (
                                            <div className="text-xs text-red-500 mt-1">
                                              {quantityErrors[index]}
                                            </div>
                                          )}
                                        </FormItem>
                                      )}
                                    />
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {remainingData?.current_backorder_qty || 0}
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.unit_of_measure}</td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">₹{item.unit_price.toFixed(2)}</td>
                                  <td className="px-4 py-4 whitespace-nowrap">
                                    <FormField
                                      control={form.control}
                                      name={`items.${index}.discount_percentage`}
                                      render={({ field }) => (
                                        <FormControl>
                                          <Input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            {...field}
                                            disabled
                                            className="w-16 bg-muted/30"
                                          />
                                        </FormControl>
                                      )}
                                    />
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap">
                                    <FormField
                                      control={form.control}
                                      name={`items.${index}.cgst_rate`}
                                      render={({ field }) => (
                                        <FormControl>
                                          <Input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            {...field}
                                            disabled
                                            className="w-16 bg-muted/30"
                                          />
                                        </FormControl>
                                      )}
                                    />
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap">
                                    <FormField
                                      control={form.control}
                                      name={`items.${index}.sgst_rate`}
                                      render={({ field }) => (
                                        <FormControl>
                                          <Input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            {...field}
                                            disabled
                                            className="w-16 bg-muted/30"
                                          />
                                        </FormControl>
                                      )}
                                    />
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap">
                                    <FormField
                                      control={form.control}
                                      name={`items.${index}.igst_rate`}
                                      render={({ field }) => (
                                        <FormControl>
                                          <Input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            {...field}
                                            disabled
                                            className="w-16 bg-muted/30"
                                          />
                                        </FormControl>
                                      )}
                                    />
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    ₹{itemTotals?.lineTotal.toFixed(2) || '0.00'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      
                      {/* Invoice Summary */}
                      <div className="mt-8 border-t pt-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div className="bg-blue-50 p-3 rounded">
                            <div className="font-medium text-blue-800">Total Ordered</div>
                            <div className="text-lg font-bold text-blue-600">{totals.totalOrderedQty}</div>
                          </div>
                          <div className="bg-green-50 p-3 rounded">
                            <div className="font-medium text-green-800">Total Invoiced</div>
                            <div className="text-lg font-bold text-green-600">{totals.totalInvoicedQty}</div>
                          </div>
                          <div className="bg-orange-50 p-3 rounded">
                            <div className="font-medium text-orange-800">Total Backorder</div>
                            <div className="text-lg font-bold text-orange-600">{totals.totalBackorderQty}</div>
                          </div>
                          <div className="bg-purple-50 p-3 rounded">
                            <div className="font-medium text-purple-800">Grand Total</div>
                            <div className="text-lg font-bold text-purple-600">₹{totals.grandTotal.toFixed(2)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                      <p>No line items available. Please select a sales order first.</p>
                    </div>
                  )}
                  </CardContent>
                </Card>

                {/* Additional Charges */}
                <Card className="shadow-sm border-border/50">
                  <CardHeader className="pb-2 pt-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Settings className="h-4 w-4 text-primary" />
                      Additional Charges
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="freight_charges"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">Freight Charges</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                className="h-9"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="packing_charges"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">Packing Charges</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                className="h-9"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="round_off"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">Round Off</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                className="h-9"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Invoice Settings */}
                <Card className="shadow-sm border-border/50">
                  <CardHeader className="pb-2 pt-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Settings className="h-4 w-4 text-primary" />
                      Invoice Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">Invoice Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Select invoice status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-background border shadow-md z-50">
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="finalized">Finalize & Generate Invoice Number</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="flex items-center">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 w-full">
                          <div className="flex items-center gap-2">
                            <Info className="h-4 w-4 text-blue-600" />
                            <span className="text-xs font-medium text-blue-700">Status Guide</span>
                          </div>
                          <p className="text-xs text-blue-600 mt-1">
                            Draft: Editable, no invoice number generated<br/>
                            Finalized: Locked, official invoice number assigned
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">Notes</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Any additional notes for this invoice..."
                                {...field}
                                className="min-h-[80px] resize-none"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Final Totals Summary */}
                <Card className="shadow-sm border-border/50">
                  <CardHeader className="pb-2 pt-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4 text-primary" />
                      Invoice Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="bg-blue-50 p-3 rounded">
                        <div className="font-medium text-blue-800">Subtotal</div>
                        <div className="text-lg font-bold text-blue-600">₹{totals.subtotal.toFixed(2)}</div>
                      </div>
                      <div className="bg-green-50 p-3 rounded">
                        <div className="font-medium text-green-800">Tax Amount</div>
                        <div className="text-lg font-bold text-green-600">₹{totals.totalTax.toFixed(2)}</div>
                      </div>
                      <div className="bg-orange-50 p-3 rounded">
                        <div className="font-medium text-orange-800">Discount</div>
                        <div className="text-lg font-bold text-orange-600">₹{totals.totalDiscount.toFixed(2)}</div>
                      </div>
                      <div className="bg-purple-50 p-3 rounded">
                        <div className="font-medium text-purple-800">Grand Total</div>
                        <div className="text-lg font-bold text-purple-600">₹{totals.grandTotal.toFixed(2)}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4 p-4 border-t bg-background">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
              className="h-10 px-6"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || watchedItems.length === 0}
              className="h-10 px-6 bg-primary hover:bg-primary/90"
            >
              {loading ? 'Saving...' : editingInvoice ? 'Update Invoice' : 'Create Invoice'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};
