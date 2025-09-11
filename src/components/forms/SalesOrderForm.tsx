import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2 } from 'lucide-react';
import { OrderLineItemsTable } from '@/components/ui/order-line-items-table';
import { useAuth } from '@/hooks/useAuth';

const salesOrderItemSchema = z.object({
  line_no: z.number().min(1).optional(),
  product_id: z.string().min(1, 'Product is required'),
  item_description: z.string().min(1, 'Item description is required'),
  stock_on_hand: z.number().min(0).optional(),
  ordered_quantity: z.number().min(1, 'Ordered quantity must be at least 1'),
  back_order_quantity: z.number().min(0).optional(),
  quantity: z.number().min(1, 'Quantity must be at least 1'), // Keep for backward compatibility
  unit_of_measure: z.string().min(1, 'Unit of measure is required'),
  unit_price: z.number().min(0, 'Unit price must be non-negative'),
  discount_percentage: z.number().min(0).max(100).optional(),
  discount_amount: z.number().min(0).optional(),
  cgst_rate: z.number().min(0).max(100).optional(),
  sgst_rate: z.number().min(0).max(100).optional(),
  igst_rate: z.number().min(0).max(100).optional(),
  cgst_amount: z.number().min(0).optional(),
  sgst_amount: z.number().min(0).optional(),
  igst_amount: z.number().min(0).optional(),
  net_amount: z.number().min(0).optional(),
  tax_amount: z.number().min(0).optional(),
  total_price: z.number().min(0).optional(),
  hsn_sac_code: z.string().optional(),
});

const salesOrderSchema = z.object({
  order_number: z.string().optional(),
  order_date: z.string().min(1, 'Order date is required'),
  customer_id: z.string().min(1, 'Customer is required'),
  customer_po_number: z.string().optional(),
  status: z.string().min(1, 'Status is required'),
  account_manager: z.string().optional(),
  order_type: z.string().min(1, 'Order type is required'),
  currency: z.string().min(1, 'Currency is required'),
  payment_terms: z.string().optional(),
  expected_delivery_date: z.string().optional(),
  mode_of_transport: z.string().optional(),
  notes: z.string().optional(),
  same_as_registered_address: z.boolean().default(false),
  default_warehouse_id: z.string().optional(),
  default_bin_id: z.string().optional(),
  items: z.array(salesOrderItemSchema).min(1, 'At least one item is required'),
});

type SalesOrderFormData = z.infer<typeof salesOrderSchema>;

interface SalesOrderFormProps {
  salesOrder?: any;
  onSubmit: (data: any) => Promise<any>;
  onCancel: () => void;
  readOnly?: boolean;
  mode?: 'create' | 'edit' | 'view';
}

export function SalesOrderForm({ 
  salesOrder, 
  onSubmit, 
  onCancel, 
  readOnly = false,
  mode = 'create'
}: SalesOrderFormProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [bins, setBins] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [stockLevels, setStockLevels] = useState<Record<string, number>>({});
  const [globalGstType, setGlobalGstType] = useState<'intra' | 'inter'>('intra');

  const form = useForm<SalesOrderFormData>({
    resolver: zodResolver(salesOrderSchema),
    defaultValues: {
      order_number: salesOrder?.order_number || '',
      order_date: salesOrder?.order_date || new Date().toISOString().split('T')[0],
      customer_id: salesOrder?.customer_id || '',
      customer_po_number: salesOrder?.customer_po_number || '',
      status: salesOrder?.status || 'draft',
      account_manager: salesOrder?.account_manager || '',
      order_type: salesOrder?.order_type || 'standard',
      currency: salesOrder?.currency || 'INR',
      payment_terms: salesOrder?.payment_terms || '',
      expected_delivery_date: salesOrder?.expected_delivery_date || '',
      mode_of_transport: salesOrder?.mode_of_transport || 'courier',
      notes: salesOrder?.notes || '',
      same_as_registered_address: salesOrder?.same_as_registered_address || false,
      default_warehouse_id: salesOrder?.default_warehouse_id || '',
      default_bin_id: salesOrder?.default_bin_id || '',
      items: salesOrder?.sales_order_items || [{
        line_no: 1,
        product_id: '',
        item_description: '',
        stock_on_hand: 0,
        ordered_quantity: 1,
        back_order_quantity: 0,
        quantity: 1,
        unit_of_measure: 'pcs',
        unit_price: 0,
        discount_percentage: 0,
        discount_amount: 0,
        cgst_rate: 0,
        sgst_rate: 0,
        igst_rate: 0,
        cgst_amount: 0,
        sgst_amount: 0,
        igst_amount: 0,
        net_amount: 0,
        tax_amount: 0,
        total_price: 0,
        hsn_sac_code: ''
      }]
    }
  });

  const fieldsArray = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const { fields, append, remove } = fieldsArray;

  useEffect(() => {
    fetchCustomers();
    fetchProducts();
    fetchWarehouses();
  }, []);

  // Effect to fetch bins when salesOrder changes (edit mode) or warehouse is initially set
  useEffect(() => {
    const currentWarehouseId = form.watch('default_warehouse_id');
    if (currentWarehouseId && salesOrder) {
      // Fetch bins for the current warehouse when editing
      fetchBins(currentWarehouseId);
    }
  }, [salesOrder, warehouses]); // Run when salesOrder changes or warehouses are loaded

  const fetchStockLevels = async (warehouseId?: string, binId?: string) => {
    if (!profile?.company_id || !warehouseId || !binId) {
      setStockLevels({});
      return;
    }

    try {
      // Simplified stock fetching - use products table directly
      const { data, error } = await supabase
        .from('products')
        .select('id, stock_quantity')
        .eq('company_id', profile.company_id);

      if (error) throw error;

      const stockMap = data.reduce((acc, item) => {
        acc[item.id] = item.stock_quantity || 0;
        return acc;
      }, {} as Record<string, number>);

      setStockLevels(stockMap);

      // Update stock on hand for all items
      fields.forEach((_, index) => {
        const productId = form.getValues(`items.${index}.product_id`);
        if (productId && stockMap[productId] !== undefined) {
          form.setValue(`items.${index}.stock_on_hand`, stockMap[productId]);
        }
      });
    } catch (error) {
      console.error('Error fetching stock levels:', error);
    }
  };

  const fetchCustomers = async () => {
    if (!profile?.company_id) return;
    
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', profile.company_id);

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchProducts = async () => {
    if (!profile?.company_id) return;
    
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true);

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchWarehouses = async () => {
    if (!profile?.company_id) return;
    
    try {
      const { data, error } = await supabase
        .from('warehouse_bins')
        .select('id, warehouse_name, warehouse_code')
        .eq('company_id', profile.company_id)
        .order('warehouse_name');

      if (error) throw error;

      // Group by warehouse_name to avoid duplicates
      const uniqueWarehouses = (data || []).reduce((acc: any[], curr: any) => {
        const exists = acc.find((w) => w.name === curr.warehouse_name);
        if (!exists) {
          acc.push({ id: curr.id, name: curr.warehouse_name, warehouse_code: curr.warehouse_code });
        }
        return acc;
      }, [] as any[]);

      setWarehouses(uniqueWarehouses);
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    }
  };

  const fetchBins = async (warehouseId: string) => {
    if (!profile?.company_id || !warehouseId) return;
    
    try {
      const selectedWarehouse = warehouses.find((w: any) => w.id === warehouseId);
      const warehouseName = selectedWarehouse?.name;
      if (!warehouseName) {
        setBins([]);
        return;
      }

      const { data, error } = await supabase
        .from('warehouse_bins')
        .select('id, bin_name, wh_bin_code, warehouse_name')
        .eq('company_id', profile.company_id)
        .eq('warehouse_name', warehouseName)
        .order('wh_bin_code');

      if (error) throw error;
      setBins(data || []);
    } catch (error) {
      console.error('Error fetching bins:', error);
    }
  };

  const handleGlobalGstTypeChange = (newGstType: 'intra' | 'inter') => {
    setGlobalGstType(newGstType);
    
    // Update all existing items to the new GST type
    fields.forEach((_, index) => {
      const product = products.find(p => p.id === form.getValues(`items.${index}.product_id`));
      const masterGST = product?.gst_percentage || 0;
      
      if (newGstType === 'intra') {
        form.setValue(`items.${index}.igst_rate`, 0);
        form.setValue(`items.${index}.cgst_rate`, masterGST / 2);
        form.setValue(`items.${index}.sgst_rate`, masterGST / 2);
      } else {
        form.setValue(`items.${index}.cgst_rate`, 0);
        form.setValue(`items.${index}.sgst_rate`, 0);
        form.setValue(`items.${index}.igst_rate`, masterGST);
      }
      
      calculateLineAmounts(index);
    });
  };

  const validateGSTRate = (index: number, type: string, rate: number): boolean => {
    const product = products.find(p => p.id === form.getValues(`items.${index}.product_id`));
    const masterGST = product?.gst_percentage || 0;
    const currentCGST = form.getValues(`items.${index}.cgst_rate`) || 0;
    const currentSGST = form.getValues(`items.${index}.sgst_rate`) || 0;
    const currentIGST = form.getValues(`items.${index}.igst_rate`) || 0;

    let newCGST = currentCGST;
    let newSGST = currentSGST;
    let newIGST = currentIGST;

    if (type === 'cgst') newCGST = rate;
    if (type === 'sgst') newSGST = rate;
    if (type === 'igst') newIGST = rate;

    const totalAppliedGST = globalGstType === 'intra' ? newCGST + newSGST : newIGST;

    if (masterGST > 0 && totalAppliedGST !== masterGST) {
      toast({
        title: 'GST Rate Mismatch',
        description: `Total GST rate (${totalAppliedGST}%) doesn't match product's master GST rate (${masterGST}%)`,
        variant: 'destructive',
      });
      return false;
    }

    return true;
  };

  const handleProductSelect = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      form.setValue(`items.${index}.product_id`, productId);
      form.setValue(`items.${index}.item_description`, product.name);
      form.setValue(`items.${index}.hsn_sac_code`, product.hsn_sac_code || '');
      form.setValue(`items.${index}.unit_price`, product.unit_price || 0);
      form.setValue(`items.${index}.unit_of_measure`, product.unit_of_measure || 'pcs');

      // Set GST rates based on global GST type
      const masterGST = product.gst_percentage || 0;
      if (globalGstType === 'intra') {
        form.setValue(`items.${index}.cgst_rate`, masterGST / 2);
        form.setValue(`items.${index}.sgst_rate`, masterGST / 2);
        form.setValue(`items.${index}.igst_rate`, 0);
      } else {
        form.setValue(`items.${index}.cgst_rate`, 0);
        form.setValue(`items.${index}.sgst_rate`, 0);
        form.setValue(`items.${index}.igst_rate`, masterGST);
      }

      // Set stock on hand if available
      const warehouseId = form.getValues('default_warehouse_id');
      const binId = form.getValues('default_bin_id');
      if (warehouseId && binId && stockLevels[productId] !== undefined) {
        form.setValue(`items.${index}.stock_on_hand`, stockLevels[productId]);
      }

      calculateLineAmounts(index);
    }
  };

  const calculateLineAmounts = (index: number) => {
    const orderedQuantity = form.getValues(`items.${index}.ordered_quantity`) || 0;
    const quantity = form.getValues(`items.${index}.quantity`) || 0; // Fallback for compatibility
    const finalQuantity = orderedQuantity || quantity; // Use ordered_quantity first, then quantity
    const unitPrice = form.getValues(`items.${index}.unit_price`) || 0;
    const discountPercentage = form.getValues(`items.${index}.discount_percentage`) || 0;

    // Calculate base amount
    const baseAmount = finalQuantity * unitPrice;
    
    // Calculate discount
    const discountAmount = (baseAmount * discountPercentage) / 100;
    const netAmount = baseAmount - discountAmount;

    // Update discount amount
    form.setValue(`items.${index}.discount_amount`, discountAmount);
    form.setValue(`items.${index}.net_amount`, netAmount);

    // Calculate taxes
    const cgstRate = form.getValues(`items.${index}.cgst_rate`) || 0;
    const sgstRate = form.getValues(`items.${index}.sgst_rate`) || 0;
    const igstRate = form.getValues(`items.${index}.igst_rate`) || 0;

    const cgstAmount = (netAmount * cgstRate) / 100;
    const sgstAmount = (netAmount * sgstRate) / 100;
    const igstAmount = (netAmount * igstRate) / 100;
    const totalTaxAmount = cgstAmount + sgstAmount + igstAmount;

    // Update tax amounts
    form.setValue(`items.${index}.cgst_amount`, cgstAmount);
    form.setValue(`items.${index}.sgst_amount`, sgstAmount);
    form.setValue(`items.${index}.igst_amount`, igstAmount);
    form.setValue(`items.${index}.tax_amount`, totalTaxAmount);

    // Calculate total price
    const totalPrice = netAmount + totalTaxAmount;
    form.setValue(`items.${index}.total_price`, totalPrice);

    // Sync quantity fields for compatibility
    if (orderedQuantity > 0) {
      form.setValue(`items.${index}.quantity`, orderedQuantity);
    }

    // Calculate back order quantity (Ordered Qty - Ready to Deliver Qty)
    const stockOnHand = form.getValues(`items.${index}.stock_on_hand`) || 0;
    const readyToDeliverQuantity = Math.min(finalQuantity, stockOnHand);
    const backOrderQuantity = Math.max(0, finalQuantity - readyToDeliverQuantity);
    form.setValue(`items.${index}.back_order_quantity`, backOrderQuantity);
  };

  const addItem = () => {
    append({
      line_no: fields.length + 1,
      product_id: '',
      item_description: '',
      stock_on_hand: 0,
      ordered_quantity: 1,
      back_order_quantity: 0,
      quantity: 1,
      unit_of_measure: 'pcs',
      unit_price: 0,
      discount_percentage: 0,
      discount_amount: 0,
      cgst_rate: 0,
      sgst_rate: 0,
      igst_rate: 0,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      net_amount: 0,
      tax_amount: 0,
      total_price: 0,
      hsn_sac_code: ''
    });
  };

  const handleSubmit = async (data: SalesOrderFormData) => {
    if (readOnly) return;
    
    setLoading(true);
    try {
      // Calculate totals
      const subtotalAmount = data.items.reduce((sum, item) => sum + (item.net_amount || 0), 0);
      const totalDiscountAmount = data.items.reduce((sum, item) => sum + (item.discount_amount || 0), 0);
      const totalTaxAmount = data.items.reduce((sum, item) => sum + (item.tax_amount || 0), 0);
      const totalAmount = data.items.reduce((sum, item) => sum + (item.total_price || 0), 0);

      // Prepare order data (header)
      const orderData = {
        order_number: data.order_number,
        order_date: data.order_date,
        customer_id: data.customer_id,
        customer_po_number: data.customer_po_number,
        status: data.status,
        account_manager: data.account_manager,
        order_type: data.order_type || 'standard', // Ensure order_type has default value
        currency: data.currency,
        payment_terms: data.payment_terms,
        expected_delivery_date: data.expected_delivery_date,
        mode_of_transport: data.mode_of_transport,
        notes: data.notes,
        same_as_registered_address: data.same_as_registered_address,
        default_warehouse_id: data.default_warehouse_id,
        default_bin_id: data.default_bin_id,
        subtotal_amount: subtotalAmount,
        discount_amount: totalDiscountAmount,
        tax_amount: totalTaxAmount,
        total_amount: totalAmount
      };

      console.log('📋 Form data being submitted:', {
        orderData,
        lineItemsCount: data.items.length,
        requiredFields: {
          customer_id: data.customer_id,
          order_date: data.order_date,
          order_type: data.order_type || 'sales',
          default_warehouse_id: data.default_warehouse_id,
          default_bin_id: data.default_bin_id
        }
      });

      // Prepare line items
      const lineItems = data.items.map((item, index) => {
        const orderedQty = item.ordered_quantity || item.quantity;
        const stockOnHand = item.stock_on_hand || 0;
        const readyToDeliverQty = Math.min(orderedQty, stockOnHand);
        
        return {
          line_no: index + 1,
          product_id: item.product_id,
          item_description: item.item_description,
          hsn_sac_code: item.hsn_sac_code,
          stock_on_hand: stockOnHand,
          ordered_quantity: orderedQty,
          ready_to_deliver_quantity: readyToDeliverQty,
          back_order_quantity: Math.max(0, orderedQty - readyToDeliverQty),
          quantity: orderedQty, // For backward compatibility
          unit_of_measure: item.unit_of_measure,
          unit_price: item.unit_price,
          discount_percentage: item.discount_percentage || 0,
          discount_amount: item.discount_amount || 0,
          cgst_rate: item.cgst_rate || 0,
          sgst_rate: item.sgst_rate || 0,
          igst_rate: item.igst_rate || 0,
          cgst_amount: item.cgst_amount || 0,
          sgst_amount: item.sgst_amount || 0,
          igst_amount: item.igst_amount || 0,
          net_amount: item.net_amount || 0,
          tax_percentage: (item.cgst_rate || 0) + (item.sgst_rate || 0) + (item.igst_rate || 0),
          total_price: item.total_price || 0,
          warehouse_id: data.default_warehouse_id,
          bin_id: data.default_bin_id
        };
      });

      const result = await onSubmit({ orderData, lineItems });
      if (result?.order_number) {
        form.setValue('order_number', result.order_number);
      }
    } catch (error: any) {
      console.error('❌ Error submitting sales order from form:', error);
      
      // More specific error handling
      let errorMessage = "Failed to save sales order";
      if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    const items = form.watch('items');
    const subtotal = items.reduce((sum, item) => sum + (item.net_amount || 0), 0);
    const totalDiscount = items.reduce((sum, item) => sum + (item.discount_amount || 0), 0);
    const totalTax = items.reduce((sum, item) => sum + (item.tax_amount || 0), 0);
    const total = items.reduce((sum, item) => sum + (item.total_price || 0), 0);

    // Calculate enhanced totals
    const totalOrderQty = items.reduce((sum, item) => sum + (item.ordered_quantity || 0), 0);
    const totalOrderValue = total;
    
    const readyToDeliverQty = items.reduce((sum, item) => {
      const orderedQty = item.ordered_quantity || 0;
      const stockOnHand = item.stock_on_hand || 0;
      return sum + Math.min(orderedQty, stockOnHand);
    }, 0);
    
    const readyToDeliverValue = items.reduce((sum, item) => {
      const orderedQty = item.ordered_quantity || 0;
      const stockOnHand = item.stock_on_hand || 0;
      const deliverableQty = Math.min(orderedQty, stockOnHand);
      const unitPrice = item.unit_price || 0;
      const lineValue = deliverableQty * unitPrice;
      const discountPercentage = item.discount_percentage || 0;
      const discountAmount = discountPercentage > 0 ? (lineValue * discountPercentage) / 100 : 0;
      const netAmount = lineValue - discountAmount;
      const taxRate = (item.cgst_rate || 0) + (item.sgst_rate || 0) + (item.igst_rate || 0);
      const taxAmount = (netAmount * taxRate) / 100;
      return sum + netAmount + taxAmount;
    }, 0);
    
    const backOrderQty = items.reduce((sum, item) => sum + (item.back_order_quantity || 0), 0);
    const backOrderValue = totalOrderValue - readyToDeliverValue;
    
    return { 
      subtotal, totalDiscount, totalTax, total,
      totalOrderQty, totalOrderValue,
      readyToDeliverQty, readyToDeliverValue,
      backOrderQty, backOrderValue: Math.max(0, backOrderValue)
    };
  };

  const { 
    subtotal, totalDiscount, totalTax, total,
    totalOrderQty, totalOrderValue,
    readyToDeliverQty, readyToDeliverValue,
    backOrderQty, backOrderValue
  } = calculateTotals();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">
            {mode === 'create' ? 'Create Sales Order' : 
             mode === 'edit' ? 'Edit Sales Order' : 'Sales Order Details'}
          </h2>
          {salesOrder?.order_number && (
            <p className="text-muted-foreground">SO Number: {salesOrder.order_number}</p>
          )}
        </div>
        <Badge variant={readOnly ? "secondary" : "default"}>
          {readOnly ? 'View Only' : (mode === 'edit' ? 'Edit Mode' : 'Create Mode')}
        </Badge>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Header Information */}
          <Card>
            <CardHeader>
              <CardTitle>Sales Order Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="order_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sales Order No.</FormLabel>
                    <FormControl>
                      <Input placeholder="Will be auto-generated" {...field} disabled readOnly />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="order_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} disabled={readOnly} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customer_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer *</FormLabel>
                    <FormControl>
                      <SearchableCombobox
                        value={field.value}
                        onSelect={field.onChange}
                        placeholder="Select customer"
                        searchPlaceholder="Search customers..."
                        options={customers.map(customer => ({
                          id: customer.id,
                          name: customer.name,
                          subtitle: customer.email || customer.phone
                        }))}
                        disabled={readOnly}
                        emptyMessage="No customers found"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customer_po_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer PO Number</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={readOnly} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="order_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order Type *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="return">Return</SelectItem>
                        <SelectItem value="export">Export</SelectItem>
                        <SelectItem value="sample">Sample</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="payment_terms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Terms</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Net 30 days" {...field} disabled={readOnly} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expected_delivery_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Delivery Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} disabled={readOnly} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="default_warehouse_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Warehouse *</FormLabel>
                    <Select 
                      value={field.value} 
                      onValueChange={(value) => {
                        const previousValue = field.value;
                        field.onChange(value);
                        fetchBins(value);
                        // Only clear bin_id if warehouse actually changed (not initial load)
                        if (previousValue && previousValue !== value) {
                          form.setValue('default_bin_id', '');
                        }
                      }} 
                      disabled={readOnly}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select warehouse" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {warehouses.map((warehouse) => (
                          <SelectItem key={warehouse.id} value={warehouse.id}>
                            {warehouse.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="default_bin_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Bin *</FormLabel>
                    <Select 
                      value={field.value} 
                      onValueChange={(value) => {
                        field.onChange(value);
                        // Trigger stock levels fetch when bin is selected
                        const warehouseId = form.watch('default_warehouse_id');
                        if (warehouseId && value) {
                          fetchStockLevels(warehouseId, value);
                        }
                      }} 
                      disabled={readOnly || !form.watch('default_warehouse_id')}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select bin" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {bins.map((bin) => (
                          <SelectItem key={bin.id} value={bin.id}>
                            {bin.bin_name} ({bin.wh_bin_code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="col-span-full">
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Remarks / Special Instructions</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enter any special instructions or remarks" 
                          {...field} 
                          disabled={readOnly} 
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <OrderLineItemsTable
            control={form.control}
            fieldsArray={fieldsArray}
            products={products}
            globalGstType={globalGstType}
            onGstTypeChange={handleGlobalGstTypeChange}
            onAddItem={addItem}
            onProductSelect={handleProductSelect}
            onCalculateLineAmounts={calculateLineAmounts}
            onValidateGSTRate={validateGSTRate}
            readOnly={readOnly}
            currency="₹"
          />

          {/* Enhanced Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Traditional Totals */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center">
                  <Label className="text-sm text-muted-foreground">Subtotal</Label>
                  <p className="text-lg font-semibold">₹{subtotal.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <Label className="text-sm text-muted-foreground">Discount</Label>
                  <p className="text-lg font-semibold">₹{totalDiscount.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <Label className="text-sm text-muted-foreground">Tax</Label>
                  <p className="text-lg font-semibold">₹{totalTax.toFixed(2)}</p>
                </div>
                <div className="text-center bg-primary/10 p-3 rounded">
                  <Label className="text-sm text-muted-foreground">Grand Total</Label>
                  <p className="text-xl font-bold">₹{total.toFixed(2)}</p>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Enhanced Summary */}
              <div className="space-y-4">
                <h4 className="text-md font-semibold">Delivery Summary</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Total Order */}
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="text-center">
                      <Label className="text-sm font-medium text-blue-700 dark:text-blue-300">Total Order</Label>
                      <div className="mt-2">
                        <p className="text-lg font-bold text-blue-800 dark:text-blue-200">{totalOrderQty} units</p>
                        <p className="text-md text-blue-600 dark:text-blue-400">₹{totalOrderValue.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Ready to Deliver */}
                  <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="text-center">
                      <Label className="text-sm font-medium text-green-700 dark:text-green-300">Ready to Deliver</Label>
                      <div className="mt-2">
                        <p className="text-lg font-bold text-green-800 dark:text-green-200">{readyToDeliverQty} units</p>
                        <p className="text-md text-green-600 dark:text-green-400">₹{readyToDeliverValue.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Back Order */}
                  <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="text-center">
                      <Label className="text-sm font-medium text-orange-700 dark:text-orange-300">Back Order</Label>
                      <div className="mt-2">
                        <p className="text-lg font-bold text-orange-800 dark:text-orange-200">{backOrderQty} units</p>
                        <p className="text-md text-orange-600 dark:text-orange-400">₹{backOrderValue.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            {!readOnly && (
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : (mode === 'edit' ? 'Update Sales Order' : 'Create Sales Order')}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}