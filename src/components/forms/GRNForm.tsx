import { useState, useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Plus, Package } from 'lucide-react';
import { format } from 'date-fns';

const grnLineItemSchema = z.object({
  product_id: z.string().min(1, 'Product is required'),
  product_name: z.string().min(1, 'Product name is required'),
  product_sku: z.string().min(1, 'SKU is required'),
  unit_of_measure: z.string().default('pcs'),
  ordered_quantity: z.number().min(0, 'Ordered quantity cannot be negative'),
  received_quantity: z.number().min(0, 'Received quantity cannot be negative'),
  accepted_quantity: z.number().min(0, 'Accepted quantity cannot be negative'),
  rejected_quantity: z.number().min(0, 'Rejected quantity cannot be negative'),
  unit_price: z.number().min(0, 'Unit price cannot be negative'),
  discount_percentage: z.number().min(0).max(100).default(0),
  discount_amount: z.number().min(0).default(0),
  warehouse_id: z.string().min(1, 'Warehouse is required'),
  bin_id: z.string().optional(),
  warehouse_code: z.string().optional(),
  warehouse_name: z.string().optional(),
  bin_code: z.string().optional(),
  bin_name: z.string().optional(),
  hsn_sac_code: z.string().optional(),
  cgst_rate: z.number().min(0).max(100).default(0),
  cgst_amount: z.number().min(0).default(0),
  sgst_rate: z.number().min(0).max(100).default(0),
  sgst_amount: z.number().min(0).default(0),
  igst_rate: z.number().min(0).max(100).default(0),
  igst_amount: z.number().min(0).default(0),
  total_tax_amount: z.number().min(0).default(0),
  line_total: z.number().min(0).default(0),
}).refine((data) => {
  // Received quantity should not exceed ordered quantity
  if (data.received_quantity > data.ordered_quantity) {
    return false;
  }
  // Sum of accepted and rejected quantities should not exceed received quantity
  if ((data.accepted_quantity + data.rejected_quantity) > data.received_quantity) {
    return false;
  }
  return true;
}, {
  message: "Invalid quantities: Check received, accepted, and rejected quantities",
});

const grnSchema = z.object({
  purchase_order_id: z.string().min(1, 'Purchase Order is required'),
  supplier_id: z.string().min(1, 'Supplier is required'),
  supplier_name: z.string().min(1, 'Supplier name is required'),
  grn_date: z.string().min(1, 'GRN date is required'),
  supplier_invoice_number: z.string().optional(),
  supplier_invoice_date: z.string().optional(),
  remarks: z.string().optional(),
  status: z.enum(['draft', 'received', 'accepted', 'rejected']).default('draft'),
  items: z.array(grnLineItemSchema).min(1, 'At least one item is required'),
});

type GRNFormData = z.infer<typeof grnSchema>;

interface GRNFormProps {
  grn?: any;
  onSubmit: (data: GRNFormData) => Promise<void>;
  onCancel: () => void;
  readOnly?: boolean;
  mode: 'create' | 'edit' | 'view';
}

export function GRNForm({ grn, onSubmit, onCancel, readOnly = false, mode }: GRNFormProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedPO, setSelectedPO] = useState<any>(null);

  const form = useForm<GRNFormData>({
    resolver: zodResolver(grnSchema),
    defaultValues: {
      purchase_order_id: grn?.purchase_order_id || '',
      supplier_id: grn?.supplier_id || '',
      supplier_name: grn?.supplier_name || '',
      grn_date: grn?.grn_date || format(new Date(), 'yyyy-MM-dd'),
      supplier_invoice_number: grn?.supplier_invoice_number || '',
      supplier_invoice_date: grn?.supplier_invoice_date || '',
      remarks: grn?.remarks || '',
      status: grn?.status || 'draft',
      items: grn?.grn_line_items?.map((item: any) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku,
        unit_of_measure: item.unit_of_measure,
        ordered_quantity: item.ordered_quantity,
        received_quantity: item.received_quantity,
        accepted_quantity: item.accepted_quantity,
        rejected_quantity: item.rejected_quantity,
        unit_price: item.unit_price,
        discount_percentage: item.discount_percentage || 0,
        discount_amount: item.discount_amount || 0,
        warehouse_id: item.warehouse_id || '',
        bin_id: item.bin_id || '',
        warehouse_code: item.warehouse_code || '',
        warehouse_name: item.warehouse_name || '',
        bin_code: item.bin_code || '',
        bin_name: item.bin_name || '',
        hsn_sac_code: item.hsn_sac_code || '',
        cgst_rate: item.cgst_rate || 0,
        cgst_amount: item.cgst_amount || 0,
        sgst_rate: item.sgst_rate || 0,
        sgst_amount: item.sgst_amount || 0,
        igst_rate: item.igst_rate || 0,
        igst_amount: item.igst_amount || 0,
        total_tax_amount: item.total_tax_amount || 0,
        line_total: item.line_total || 0,
      })) || [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  useEffect(() => {
    if (profile?.company_id) {
      fetchPurchaseOrders();
      fetchProducts();
      fetchWarehouses();
    }
  }, [profile?.company_id]);

  const fetchPurchaseOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          supplier:suppliers(id, name),
          purchase_order_items(*)
        `)
        .eq('company_id', profile?.company_id)
        .in('status', ['approved', 'open', 'confirmed', 'partially_received'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPurchaseOrders(data || []);
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
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

  const fetchWarehouses = async () => {
    try {
      const { data, error } = await supabase
        .from('warehouse_bins')
        .select('*')
        .eq('company_id', profile?.company_id)
        .eq('is_active', true)
        .order('warehouse_name');

      if (error) throw error;
      setWarehouses(data || []);
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    }
  };

  const handlePOSelect = (poId: string) => {
    const po = purchaseOrders.find(p => p.id === poId);
    if (po) {
      setSelectedPO(po);
      form.setValue('supplier_id', po.supplier.id);
      form.setValue('supplier_name', po.supplier.name);
      
      // Populate items from PO
      const poItems = po.purchase_order_items.map((item: any) => ({
        product_id: item.product_id || '',
        product_name: item.item_description,
        product_sku: item.item_code || '',
        unit_of_measure: item.unit_of_measure,
        ordered_quantity: item.quantity,
        received_quantity: 0,
        accepted_quantity: 0,
        rejected_quantity: 0,
        unit_price: item.unit_price,
        discount_percentage: item.discount_percentage || 0,
        discount_amount: item.discount_amount || 0,
        warehouse_id: '',
        bin_id: '',
        warehouse_code: '',
        warehouse_name: '',
        bin_code: '',
        bin_name: '',
        hsn_sac_code: item.hsn_sac_code || '',
        cgst_rate: item.cgst_rate || 0,
        cgst_amount: 0,
        sgst_rate: item.sgst_rate || 0,
        sgst_amount: 0,
        igst_rate: item.igst_rate || 0,
        igst_amount: 0,
        total_tax_amount: 0,
        line_total: 0,
      }));
      
      form.setValue('items', poItems);
    }
  };

  const calculateLineAmounts = (index: number) => {
    const items = form.getValues('items');
    const item = items[index];
    
    if (!item) return;

    const subtotal = item.accepted_quantity * item.unit_price;
    const discountAmount = item.discount_percentage > 0 
      ? (subtotal * item.discount_percentage) / 100 
      : item.discount_amount || 0;
    
    const taxableAmount = subtotal - discountAmount;
    
    const cgstAmount = (taxableAmount * item.cgst_rate) / 100;
    const sgstAmount = (taxableAmount * item.sgst_rate) / 100;
    const igstAmount = (taxableAmount * item.igst_rate) / 100;
    const totalTaxAmount = cgstAmount + sgstAmount + igstAmount;
    
    const lineTotal = taxableAmount + totalTaxAmount;

    form.setValue(`items.${index}.discount_amount`, discountAmount);
    form.setValue(`items.${index}.cgst_amount`, cgstAmount);
    form.setValue(`items.${index}.sgst_amount`, sgstAmount);
    form.setValue(`items.${index}.igst_amount`, igstAmount);
    form.setValue(`items.${index}.total_tax_amount`, totalTaxAmount);
    form.setValue(`items.${index}.line_total`, lineTotal);
  };

  const addItem = () => {
    append({
      product_id: '',
      product_name: '',
      product_sku: '',
      unit_of_measure: 'pcs',
      ordered_quantity: 0,
      received_quantity: 0,
      accepted_quantity: 0,
      rejected_quantity: 0,
      unit_price: 0,
      discount_percentage: 0,
      discount_amount: 0,
      warehouse_id: '',
      bin_id: '',
      warehouse_code: '',
      warehouse_name: '',
      bin_code: '',
      bin_name: '',
      hsn_sac_code: '',
      cgst_rate: 0,
      cgst_amount: 0,
      sgst_rate: 0,
      sgst_amount: 0,
      igst_rate: 0,
      igst_amount: 0,
      total_tax_amount: 0,
      line_total: 0,
    });
  };

  const handleSubmit = async (data: GRNFormData) => {
    try {
      setLoading(true);
      await onSubmit(data);
    } catch (error) {
      console.error('Error submitting GRN:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    const items = form.watch('items');
    const totals = items.reduce(
      (acc, item) => ({
        totalOrderedQty: acc.totalOrderedQty + (item.ordered_quantity || 0),
        totalReceivedQty: acc.totalReceivedQty + (item.received_quantity || 0),
        totalAcceptedQty: acc.totalAcceptedQty + (item.accepted_quantity || 0),
        totalRejectedQty: acc.totalRejectedQty + (item.rejected_quantity || 0),
        subtotalAmount: acc.subtotalAmount + ((item.accepted_quantity || 0) * (item.unit_price || 0)),
        totalDiscountAmount: acc.totalDiscountAmount + (item.discount_amount || 0),
        totalTaxAmount: acc.totalTaxAmount + (item.total_tax_amount || 0),
        totalAmount: acc.totalAmount + (item.line_total || 0),
      }),
      {
        totalOrderedQty: 0,
        totalReceivedQty: 0,
        totalAcceptedQty: 0,
        totalRejectedQty: 0,
        subtotalAmount: 0,
        totalDiscountAmount: 0,
        totalTaxAmount: 0,
        totalAmount: 0,
      }
    );
    return totals;
  };

  const totals = calculateTotals();

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* GRN Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              GRN Header Information
            </CardTitle>
            <CardDescription>
              {mode === 'create' ? 'Create a new Goods Receipt Note' : 
               mode === 'edit' ? 'Edit GRN details' : 'View GRN details'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="purchase_order_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Order *</FormLabel>
                    <FormControl>
                      <Select 
                        value={field.value} 
                        onValueChange={(value) => {
                          field.onChange(value);
                          handlePOSelect(value);
                        }}
                        disabled={readOnly || mode === 'edit'}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select PO" />
                        </SelectTrigger>
                        <SelectContent>
                          {purchaseOrders.map((po) => (
                            <SelectItem key={po.id} value={po.id}>
                              {po.po_number} - {po.supplier?.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="grn_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GRN Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} disabled={readOnly} />
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
                    <FormLabel>Status</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="received">Received</SelectItem>
                          <SelectItem value="accepted">Accepted</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="supplier_invoice_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier Invoice Number</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={readOnly} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="supplier_invoice_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier Invoice Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} disabled={readOnly} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remarks / Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} disabled={readOnly} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedPO && (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Selected PO Details:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span>PO Number: <Badge variant="outline">{selectedPO.po_number}</Badge></span>
                  <span>Supplier: <Badge variant="outline">{selectedPO.supplier?.name}</Badge></span>
                  <span>PO Date: {format(new Date(selectedPO.order_date), 'dd/MM/yyyy')}</span>
                  <span>Total Amount: ₹{selectedPO.total_amount?.toFixed(2)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* GRN Line Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>GRN Line Items</CardTitle>
              <CardDescription>Manage received products and quantities</CardDescription>
            </div>
            {!readOnly && (
              <Button type="button" onClick={addItem} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="p-4 border rounded-lg space-y-4">
                  <div className="flex justify-between items-start">
                    <h4 className="font-medium">Item #{index + 1}</h4>
                    {!readOnly && fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name={`items.${index}.product_name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Product Name *</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={readOnly} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.product_sku`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SKU *</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={readOnly} />
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
                          <FormLabel>Unit Price</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              {...field}
                              onChange={(e) => {
                                field.onChange(parseFloat(e.target.value) || 0);
                                calculateLineAmounts(index);
                              }}
                              disabled={readOnly}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name={`items.${index}.ordered_quantity`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ordered Qty</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              disabled={true}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.received_quantity`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Received Qty</FormLabel>
                          <FormControl>
                             <Input 
                               type="number" 
                               {...field}
                               onChange={(e) => {
                                 const value = parseInt(e.target.value) || 0;
                                 const orderedQty = form.getValues(`items.${index}.ordered_quantity`);
                                 if (value <= orderedQty && value >= 0) {
                                   field.onChange(value);
                                   calculateLineAmounts(index);
                                 } else {
                                   toast({
                                     title: "Invalid Quantity",
                                     description: "Received quantity cannot exceed ordered quantity or be negative",
                                     variant: "destructive",
                                   });
                                 }
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
                      name={`items.${index}.accepted_quantity`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Accepted Qty</FormLabel>
                          <FormControl>
                             <Input 
                               type="number" 
                               {...field}
                               onChange={(e) => {
                                 const value = parseInt(e.target.value) || 0;
                                 const receivedQty = form.getValues(`items.${index}.received_quantity`);
                                 const rejectedQty = form.getValues(`items.${index}.rejected_quantity`);
                                 if ((value + rejectedQty) <= receivedQty && value >= 0) {
                                   field.onChange(value);
                                   calculateLineAmounts(index);
                                 } else {
                                   toast({
                                     title: "Invalid Quantity",
                                     description: "Accepted + Rejected quantity cannot exceed received quantity",
                                     variant: "destructive",
                                   });
                                 }
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
                      name={`items.${index}.rejected_quantity`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rejected Qty</FormLabel>
                          <FormControl>
                             <Input 
                               type="number" 
                               {...field}
                               onChange={(e) => {
                                 const value = parseInt(e.target.value) || 0;
                                 const receivedQty = form.getValues(`items.${index}.received_quantity`);
                                 const acceptedQty = form.getValues(`items.${index}.accepted_quantity`);
                                 if ((value + acceptedQty) <= receivedQty && value >= 0) {
                                   field.onChange(value);
                                   calculateLineAmounts(index);
                                 } else {
                                   toast({
                                     title: "Invalid Quantity",
                                     description: "Accepted + Rejected quantity cannot exceed received quantity",
                                     variant: "destructive",
                                   });
                                 }
                               }}
                               disabled={readOnly}
                             />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* GST Section */}
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
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
                                field.onChange(parseFloat(e.target.value) || 0);
                                calculateLineAmounts(index);
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
                                field.onChange(parseFloat(e.target.value) || 0);
                                calculateLineAmounts(index);
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
                                field.onChange(parseFloat(e.target.value) || 0);
                                calculateLineAmounts(index);
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
                                field.onChange(parseFloat(e.target.value) || 0);
                                calculateLineAmounts(index);
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
                      name={`items.${index}.total_tax_amount`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Total Tax</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              {...field}
                              disabled={true}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.line_total`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Line Total</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              {...field}
                              disabled={true}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <FormField
                       control={form.control}
                       name={`items.${index}.warehouse_id`}
                       render={({ field }) => (
                         <FormItem>
                           <FormLabel>Warehouse *</FormLabel>
                           <FormControl>
                             <Select 
                               value={field.value} 
                               onValueChange={(value) => {
                                 const selectedWarehouse = warehouses.find(w => w.id === value);
                                 field.onChange(value);
                                 if (selectedWarehouse) {
                                   form.setValue(`items.${index}.warehouse_code`, selectedWarehouse.warehouse_code || '');
                                   form.setValue(`items.${index}.warehouse_name`, selectedWarehouse.warehouse_name || '');
                                   form.setValue(`items.${index}.bin_code`, selectedWarehouse.wh_bin_code || '');
                                   form.setValue(`items.${index}.bin_name`, selectedWarehouse.bin_name || '');
                                   form.setValue(`items.${index}.bin_id`, selectedWarehouse.id);
                                 }
                               }} 
                               disabled={readOnly}
                             >
                               <SelectTrigger>
                                 <SelectValue placeholder="Select warehouse" />
                               </SelectTrigger>
                               <SelectContent>
                                 {warehouses.map((warehouse) => (
                                   <SelectItem key={warehouse.id} value={warehouse.id}>
                                     {warehouse.warehouse_code} - {warehouse.warehouse_name} / {warehouse.bin_name}
                                   </SelectItem>
                                 ))}
                               </SelectContent>
                             </Select>
                           </FormControl>
                           <FormMessage />
                         </FormItem>
                       )}
                     />

                     <FormField
                       control={form.control}
                       name={`items.${index}.hsn_sac_code`}
                       render={({ field }) => (
                         <FormItem>
                           <FormLabel>HSN/SAC Code</FormLabel>
                           <FormControl>
                             <Input {...field} disabled={readOnly} />
                           </FormControl>
                           <FormMessage />
                         </FormItem>
                       )}
                     />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Totals Summary */}
        <Card>
          <CardHeader>
            <CardTitle>GRN Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{totals.totalOrderedQty}</div>
                <div className="text-sm text-muted-foreground">Total Ordered</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{totals.totalReceivedQty}</div>
                <div className="text-sm text-muted-foreground">Total Received</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{totals.totalAcceptedQty}</div>
                <div className="text-sm text-muted-foreground">Total Accepted</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{totals.totalRejectedQty}</div>
                <div className="text-sm text-muted-foreground">Total Rejected</div>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-lg font-semibold">₹{totals.subtotalAmount.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">Subtotal</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">₹{totals.totalDiscountAmount.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">Total Discount</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">₹{totals.totalTaxAmount.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">Total Tax</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-primary">₹{totals.totalAmount.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">Grand Total</div>
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
              {loading ? 'Saving...' : mode === 'create' ? 'Create GRN' : 'Update GRN'}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}