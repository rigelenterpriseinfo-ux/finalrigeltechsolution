import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const salesOrderItemSchema = z.object({
  line_no: z.number().min(1).optional(),
  product_id: z.string().min(1, 'Product is required'),
  item_description: z.string().min(1, 'Item description is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
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
  same_as_registered_address: z.boolean().optional(),
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
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(false);

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
      items: salesOrder?.sales_order_items || [{
        line_no: 1,
        product_id: '',
        item_description: '',
        quantity: 1,
        unit_of_measure: 'pcs',
        unit_price: 0,
        discount_percentage: 0,
        discount_amount: 0,
        cgst_rate: 9,
        sgst_rate: 9,
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

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  });

  useEffect(() => {
    fetchCustomers();
    fetchProducts();
  }, []);

  // Reset form with existing sales order values when editing
  useEffect(() => {
    if (mode !== 'edit' || !salesOrder) return;

    const mapped = {
      order_number: salesOrder.order_number || '',
      order_date: salesOrder.order_date || new Date().toISOString().split('T')[0],
      customer_id: salesOrder.customer_id || '',
      customer_po_number: salesOrder.customer_po_number || '',
      status: salesOrder.status || 'draft',
      account_manager: salesOrder.account_manager || '',
      order_type: salesOrder.order_type || 'standard',
      currency: salesOrder.currency || 'INR',
      payment_terms: salesOrder.payment_terms || '',
      expected_delivery_date: salesOrder.expected_delivery_date || '',
      mode_of_transport: salesOrder.mode_of_transport || 'courier',
      notes: salesOrder.notes || '',
      same_as_registered_address: salesOrder.same_as_registered_address || false,
      items: (salesOrder.sales_order_items || []).map((item: any, index: number) => ({
        line_no: index + 1,
        product_id: item.product_id || '',
        item_description: item.item_description || '',
        quantity: Number(item.quantity) || 1,
        unit_of_measure: item.unit_of_measure || 'pcs',
        unit_price: Number(item.unit_price) || 0,
        discount_percentage: Number(item.discount_percentage) || 0,
        discount_amount: Number(item.discount_amount) || 0,
        cgst_rate: Number(item.cgst_rate) || 0,
        sgst_rate: Number(item.sgst_rate) || 0,
        igst_rate: Number(item.igst_rate) || 0,
        cgst_amount: Number(item.cgst_amount) || 0,
        sgst_amount: Number(item.sgst_amount) || 0,
        igst_amount: Number(item.igst_amount) || 0,
        net_amount: Number(item.net_amount) || 0,
        tax_amount: Number(item.tax_amount) || 0,
        total_price: Number(item.total_price) || 0,
        hsn_sac_code: item.hsn_sac_code || ''
      }))
    };

    form.reset(mapped as any);
  }, [mode, salesOrder]);

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', profile?.company_id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', profile?.company_id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleCustomerSelect = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    setSelectedCustomer(customer || null);
    
    if (customer) {
      form.setValue('payment_terms', customer.payment_terms || '');
      
      // If same as registered address is checked, populate billing/shipping addresses
      if (form.getValues('same_as_registered_address')) {
        // Auto-populate addresses from customer data
        // This would require additional fields in the form for billing/shipping addresses
      }
    }
  };

  const handleProductSelect = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      form.setValue(`items.${index}.product_id`, productId);
      form.setValue(`items.${index}.item_description`, product.name);
      form.setValue(`items.${index}.unit_price`, product.unit_price || 0);
      form.setValue(`items.${index}.unit_of_measure`, product.unit || 'pcs');
      form.setValue(`items.${index}.hsn_sac_code`, product.hsn_code || '');
      calculateLineAmounts(index);
    }
  };

  const calculateLineAmounts = (index: number) => {
    const values = form.getValues();
    const item = values.items[index];
    
    const quantity = item.quantity || 0;
    const unitPrice = item.unit_price || 0;
    const discountPercentage = item.discount_percentage || 0;
    
    const lineSubtotal = quantity * unitPrice;
    const discountAmount = discountPercentage > 0 
      ? (lineSubtotal * discountPercentage) / 100 
      : (item.discount_amount || 0);
    
    const netAmount = lineSubtotal - discountAmount;
    
    const cgstAmount = (netAmount * (item.cgst_rate || 0)) / 100;
    const sgstAmount = (netAmount * (item.sgst_rate || 0)) / 100;
    const igstAmount = (netAmount * (item.igst_rate || 0)) / 100;
    
    const taxAmount = cgstAmount + sgstAmount + igstAmount;
    const lineTotal = netAmount + taxAmount;
    
    form.setValue(`items.${index}.discount_amount`, discountAmount);
    form.setValue(`items.${index}.net_amount`, netAmount);
    form.setValue(`items.${index}.cgst_amount`, cgstAmount);
    form.setValue(`items.${index}.sgst_amount`, sgstAmount);
    form.setValue(`items.${index}.igst_amount`, igstAmount);
    form.setValue(`items.${index}.tax_amount`, taxAmount);
    form.setValue(`items.${index}.total_price`, lineTotal);
  };

  const addItem = () => {
    const newLineNo = fields.length + 1;
    append({
      line_no: newLineNo,
      product_id: '',
      item_description: '',
      quantity: 1,
      unit_of_measure: 'pcs',
      unit_price: 0,
      discount_percentage: 0,
      discount_amount: 0,
      cgst_rate: 9,
      sgst_rate: 9,
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

      const salesOrderData = {
        ...data,
        subtotal_amount: subtotalAmount,
        discount_amount: totalDiscountAmount,
        tax_amount: totalTaxAmount,
        total_amount: totalAmount,
        items: data.items.map((item, index) => ({
          line_no: index + 1,
          product_id: item.product_id,
          item_description: item.item_description,
          hsn_sac_code: item.hsn_sac_code,
          quantity: item.quantity,
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
          total_price: item.total_price || 0
        }))
      };

      const result = await onSubmit(salesOrderData);
      if (result?.order_number) {
        form.setValue('order_number', result.order_number);
      }
    } catch (error) {
      console.error('Error submitting sales order:', error);
      toast({
        title: "Error",
        description: "Failed to save sales order",
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
    
    return { subtotal, totalDiscount, totalTax, total };
  };

  const { subtotal, totalDiscount, totalTax, total } = calculateTotals();

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
                    <Select 
                      value={field.value} 
                      onValueChange={(value) => {
                        field.onChange(value);
                        handleCustomerSelect(value);
                      }} 
                      disabled={readOnly}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name} ({customer.customer_ref})
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
                name="customer_po_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer PO No.</FormLabel>
                    <FormControl>
                      <Input placeholder="Customer PO reference" {...field} disabled={readOnly} />
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
                    <FormLabel>Order Status *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="account_manager"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salesperson / Account Manager</FormLabel>
                    <FormControl>
                      <Input placeholder="Account manager name" {...field} disabled={readOnly} />
                    </FormControl>
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
                          <SelectValue />
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
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="INR">INR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
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
                name="mode_of_transport"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transport Mode</FormLabel>
                    <Select value={field.value || ''} onValueChange={field.onChange} disabled={readOnly}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select transport mode" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="courier">Courier</SelectItem>
                        <SelectItem value="truck">Truck</SelectItem>
                        <SelectItem value="sea">Sea</SelectItem>
                        <SelectItem value="air">Air</SelectItem>
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
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Order Line Items</CardTitle>
                {!readOnly && (
                  <Button type="button" onClick={addItem} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="border rounded-lg p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <Badge variant="outline">Line {index + 1}</Badge>
                    {!readOnly && fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name={`items.${index}.product_id`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Product *</FormLabel>
                          <Select 
                            value={field.value} 
                            onValueChange={(value) => {
                              field.onChange(value);
                              handleProductSelect(index, value);
                            }}
                            disabled={readOnly}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select product" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {products.map((product) => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.name} ({product.sku})
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
                      name={`items.${index}.item_description`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description *</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={readOnly} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantity *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              onChange={(e) => {
                                field.onChange(Number(e.target.value));
                                setTimeout(() => calculateLineAmounts(index), 0);
                              }}
                              disabled={readOnly} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.unit_of_measure`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>UOM</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={readOnly} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.unit_price`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unit Price *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              {...field} 
                              onChange={(e) => {
                                field.onChange(Number(e.target.value));
                                setTimeout(() => calculateLineAmounts(index), 0);
                              }}
                              disabled={readOnly} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.discount_percentage`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Discount %</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              {...field} 
                              onChange={(e) => {
                                field.onChange(Number(e.target.value));
                                setTimeout(() => calculateLineAmounts(index), 0);
                              }}
                              disabled={readOnly} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.cgst_rate`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CGST %</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              {...field} 
                              onChange={(e) => {
                                field.onChange(Number(e.target.value));
                                setTimeout(() => calculateLineAmounts(index), 0);
                              }}
                              disabled={readOnly} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.sgst_rate`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SGST %</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              {...field} 
                              onChange={(e) => {
                                field.onChange(Number(e.target.value));
                                setTimeout(() => calculateLineAmounts(index), 0);
                              }}
                              disabled={readOnly} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.igst_rate`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>IGST %</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              {...field} 
                              onChange={(e) => {
                                field.onChange(Number(e.target.value));
                                setTimeout(() => calculateLineAmounts(index), 0);
                              }}
                              disabled={readOnly} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="bg-muted p-3 rounded">
                      <Label className="text-sm font-medium">Net Amount</Label>
                      <p className="text-sm">₹{form.watch(`items.${index}.net_amount`)?.toFixed(2) || '0.00'}</p>
                    </div>

                    <div className="bg-muted p-3 rounded">
                      <Label className="text-sm font-medium">Tax Amount</Label>
                      <p className="text-sm">₹{form.watch(`items.${index}.tax_amount`)?.toFixed(2) || '0.00'}</p>
                    </div>

                    <div className="bg-primary/10 p-3 rounded">
                      <Label className="text-sm font-medium">Total Value</Label>
                      <p className="text-sm font-bold">₹{form.watch(`items.${index}.total_price`)?.toFixed(2) || '0.00'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Totals */}
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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