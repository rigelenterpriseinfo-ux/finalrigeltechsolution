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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, Search, ChevronDown, ChevronRight, Building, MapPin, Info } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const purchaseOrderItemSchema = z.object({
  product_id: z.string().min(1, 'Product is required'),
  product_name: z.string().min(1, 'Product name is required'),
  item_code: z.string().optional(),
  hsn_sac_code: z.string().optional(),
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
  line_subtotal: z.number().min(0).optional(),
  line_total: z.number().min(0).optional(),
  remarks: z.string().optional(),
});

const purchaseOrderSchema = z.object({
  po_number: z.string().optional(),
  supplier_id: z.string().min(1, 'Supplier is required'),
  order_date: z.string().min(1, 'Order date is required'),
  currency: z.string().min(1, 'Currency is required'),
  payment_terms: z.string().optional(),
  expected_date: z.string().optional(),
  place_of_supply: z.string().optional(),
  same_as_registered_address: z.boolean().default(false),
  delivery_address_line1: z.string().optional(),
  delivery_address_line2: z.string().optional(),
  delivery_city: z.string().optional(),
  delivery_state: z.string().optional(),
  delivery_country: z.string().optional(),
  delivery_postal_code: z.string().optional(),
  status: z.string().min(1, 'Status is required'),
  notes: z.string().optional(),
  items: z.array(purchaseOrderItemSchema).min(1, 'At least one item is required'),
});

type PurchaseOrderFormData = z.infer<typeof purchaseOrderSchema>;

interface PurchaseOrderFormProps {
  purchaseOrder?: any;
  onSubmit: (data: any) => Promise<any>;
  onCancel: () => void;
  readOnly?: boolean;
  mode?: 'create' | 'edit' | 'view';
}

export function PurchaseOrderForm({ 
  purchaseOrder, 
  onSubmit, 
  onCancel, 
  readOnly = false,
  mode = 'create'
}: PurchaseOrderFormProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [companyData, setCompanyData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('header');
  const [expandedGSTItems, setExpandedGSTItems] = useState<Set<number>>(new Set());

  const form = useForm<PurchaseOrderFormData>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      po_number: purchaseOrder?.po_number || '',
      supplier_id: purchaseOrder?.supplier_id || '',
      order_date: purchaseOrder?.order_date || new Date().toISOString().split('T')[0],
      currency: purchaseOrder?.currency || 'INR',
      payment_terms: purchaseOrder?.payment_terms || '',
      expected_date: purchaseOrder?.expected_date || null,
      place_of_supply: purchaseOrder?.place_of_supply || '',
      same_as_registered_address: purchaseOrder?.same_as_registered_address || false,
      delivery_address_line1: purchaseOrder?.delivery_address_line1 || '',
      delivery_address_line2: purchaseOrder?.delivery_address_line2 || '',
      delivery_city: purchaseOrder?.delivery_city || '',
      delivery_state: purchaseOrder?.delivery_state || '',
      delivery_country: purchaseOrder?.delivery_country || '',
      delivery_postal_code: purchaseOrder?.delivery_postal_code || '',
      status: purchaseOrder?.status || 'draft',
      notes: purchaseOrder?.notes || '',
      items: purchaseOrder?.purchase_order_items || [{
        product_id: '',
        product_name: '',
        item_code: '',
        hsn_sac_code: '',
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
        line_subtotal: 0,
        line_total: 0,
        remarks: ''
      }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  });

  useEffect(() => {
    fetchSuppliers();
    fetchProducts();
    fetchCompanyData();
  }, []);

  const fetchCompanyData = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile?.company_id)
        .single();

      if (error) throw error;
      setCompanyData(data);
    } catch (error) {
      console.error('Error fetching company data:', error);
    }
  };

  // Reset form with existing PO values when editing
  useEffect(() => {
    if (mode !== 'edit' || !purchaseOrder) return;

    const mapped = {
      po_number: purchaseOrder.po_number || '',
      supplier_id: purchaseOrder.supplier_id || '',
      order_date: purchaseOrder.order_date || new Date().toISOString().split('T')[0],
      currency: purchaseOrder.currency || 'INR',
      payment_terms: purchaseOrder.payment_terms || '',
      expected_date: purchaseOrder.expected_date || null,
      place_of_supply: purchaseOrder.place_of_supply || '',
      same_as_registered_address: purchaseOrder.same_as_registered_address || false,
      delivery_address_line1: purchaseOrder.delivery_address_line1 || '',
      delivery_address_line2: purchaseOrder.delivery_address_line2 || '',
      delivery_city: purchaseOrder.delivery_city || '',
      delivery_state: purchaseOrder.delivery_state || '',
      delivery_country: purchaseOrder.delivery_country || '',
      delivery_postal_code: purchaseOrder.delivery_postal_code || '',
      status: purchaseOrder.status || 'draft',
      notes: purchaseOrder.notes || '',
      items: (purchaseOrder.purchase_order_items || []).map((it: any) => ({
        product_id: it.product_id || '',
        product_name: it.item_description || '',
        item_code: it.item_code || '',
        hsn_sac_code: it.hsn_sac_code || '',
        quantity: Number(it.quantity) || 1,
        unit_of_measure: it.unit_of_measure || 'pcs',
        unit_price: Number(it.unit_price) || 0,
        discount_percentage: Number(it.discount_percentage) || 0,
        discount_amount: Number(it.discount_amount) || 0,
        cgst_rate: Number(it.cgst_rate) || 0,
        sgst_rate: Number(it.sgst_rate) || 0,
        igst_rate: Number(it.igst_rate) || 0,
        cgst_amount: Number(it.cgst_amount) || 0,
        sgst_amount: Number(it.sgst_amount) || 0,
        igst_amount: Number(it.igst_amount) || 0,
        line_subtotal: Number(it.taxable_value ?? it.total_price ?? 0),
        line_total: Number(it.total_price) || 0,
        remarks: it.remarks || ''
      }))
    };

    form.reset(mapped as any);
  }, [mode, purchaseOrder]);

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('company_id', profile?.company_id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
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

  const handleProductSelect = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      form.setValue(`items.${index}.product_id`, productId);
      form.setValue(`items.${index}.product_name`, product.name);
      form.setValue(`items.${index}.item_code`, product.sku);
      form.setValue(`items.${index}.hsn_sac_code`, product.hsn_code || '');
      form.setValue(`items.${index}.unit_price`, product.unit_price || 0);
      form.setValue(`items.${index}.unit_of_measure`, product.unit || 'pcs');
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
    const discountAmount = (lineSubtotal * discountPercentage) / 100;
    const taxableAmount = lineSubtotal - discountAmount;
    
    const cgstAmount = (taxableAmount * (item.cgst_rate || 0)) / 100;
    const sgstAmount = (taxableAmount * (item.sgst_rate || 0)) / 100;
    const igstAmount = (taxableAmount * (item.igst_rate || 0)) / 100;
    
    const lineTotal = taxableAmount + cgstAmount + sgstAmount + igstAmount;
    
    form.setValue(`items.${index}.discount_amount`, discountAmount);
    form.setValue(`items.${index}.cgst_amount`, cgstAmount);
    form.setValue(`items.${index}.sgst_amount`, sgstAmount);
    form.setValue(`items.${index}.igst_amount`, igstAmount);
    form.setValue(`items.${index}.line_subtotal`, lineSubtotal);
    form.setValue(`items.${index}.line_total`, lineTotal);
  };

  const addItem = () => {
    append({
      product_id: '',
      product_name: '',
      item_code: '',
      hsn_sac_code: '',
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
      line_subtotal: 0,
      line_total: 0,
      remarks: ''
    });
  };

  // Helper function to sanitize date values
  const sanitizeDateValue = (dateValue: string | null | undefined): string | null => {
    if (!dateValue || dateValue === '') {
      return null;
    }
    return dateValue;
  };

  const handleSubmit = async (data: PurchaseOrderFormData) => {
    if (readOnly) return;
    
    setLoading(true);
    try {
      // Calculate totals
      const subtotalAmount = data.items.reduce((sum, item) => sum + (item.line_subtotal || 0), 0);
      const totalDiscountAmount = data.items.reduce((sum, item) => sum + (item.discount_amount || 0), 0);
      const totalTaxAmount = data.items.reduce((sum, item) => 
        sum + (item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0), 0);
      const totalAmount = data.items.reduce((sum, item) => sum + (item.line_total || 0), 0);

      const purchaseOrderData = {
        ...data,
        // Sanitize date fields to convert empty strings to null
        expected_date: sanitizeDateValue(data.expected_date),
        subtotal_amount: subtotalAmount,
        total_discount_amount: totalDiscountAmount,
        total_tax_amount: totalTaxAmount,
        total_amount: totalAmount,
        items: data.items.map(item => {
          // For edit mode, preserve existing received quantities
          const existingItem = mode === 'edit' && purchaseOrder?.purchase_order_items?.find(
            (poItem: any) => poItem.product_id === item.product_id
          );
          const receivedQuantity = existingItem?.received_quantity || 0;
          const pendingQuantity = Math.max(0, item.quantity - receivedQuantity);

          return {
            product_id: item.product_id,
            item_code: item.item_code,
            item_description: item.product_name,
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
            total_price: item.line_total || 0,
            received_quantity: receivedQuantity,
            pending_quantity: pendingQuantity,
            remarks: item.remarks || '',
            is_taxable: true,
            taxable_value: item.line_subtotal || 0,
            gst_rate: (item.cgst_rate || 0) + (item.sgst_rate || 0) + (item.igst_rate || 0)
          };
        })
      };

      const result = await onSubmit(purchaseOrderData);
      if (result?.po_number) {
        form.setValue('po_number', result.po_number);
      }
    } catch (error) {
      console.error('Error submitting purchase order:', error);
      toast({
        title: "Error",
        description: "Failed to save purchase order",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    const items = form.watch('items');
    const subtotal = items.reduce((sum, item) => sum + (item.line_subtotal || 0), 0);
    const totalDiscount = items.reduce((sum, item) => sum + (item.discount_amount || 0), 0);
    const totalTax = items.reduce((sum, item) => 
      sum + (item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0), 0);
    const total = items.reduce((sum, item) => sum + (item.line_total || 0), 0);
    
    return { subtotal, totalDiscount, totalTax, total };
  };

  const { subtotal, totalDiscount, totalTax, total } = calculateTotals();

  const toggleGSTExpansion = (index: number) => {
    const newSet = new Set(expandedGSTItems);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setExpandedGSTItems(newSet);
  };

  const handleSameAsRegisteredAddressChange = (checked: boolean) => {
    form.setValue('same_as_registered_address', checked);
    
    if (checked && companyData) {
      // Auto-populate delivery address with company address
      form.setValue('delivery_address_line1', companyData.address_line1 || companyData.address || '');
      form.setValue('delivery_address_line2', companyData.address_line2 || '');
      form.setValue('delivery_city', companyData.city || '');
      form.setValue('delivery_state', companyData.state || '');
      form.setValue('delivery_country', companyData.country || '');
      form.setValue('delivery_postal_code', companyData.postal_code || '');
    } else {
      // Clear delivery address fields
      form.setValue('delivery_address_line1', '');
      form.setValue('delivery_address_line2', '');
      form.setValue('delivery_city', '');
      form.setValue('delivery_state', '');
      form.setValue('delivery_country', '');
      form.setValue('delivery_postal_code', '');
    }
  };

  const sameAsRegisteredAddress = form.watch('same_as_registered_address');

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 px-1">
        <div>
          <h2 className="text-2xl font-bold">
            {mode === 'create' ? 'Create Purchase Order' : 
             mode === 'edit' ? 'Edit Purchase Order' : 'Purchase Order Details'}
          </h2>
          {purchaseOrder?.po_number && (
            <p className="text-muted-foreground">PO Number: {purchaseOrder.po_number}</p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <Badge variant={readOnly ? "secondary" : "default"}>
            {readOnly ? 'View Only' : (mode === 'edit' ? 'Edit Mode' : 'Create Mode')}
          </Badge>
          <div className="text-right text-sm">
            <div className="font-semibold">Total: ₹{total.toFixed(2)}</div>
            <div className="text-muted-foreground">{fields.length} items</div>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="flex-1 flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="header">Order Info</TabsTrigger>
              <TabsTrigger value="items">Items ({fields.length})</TabsTrigger>
              <TabsTrigger value="summary">Summary</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden">
              <TabsContent value="header" className="flex-1 overflow-auto space-y-6">
                {/* Basic Information Section */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Building className="h-5 w-5 text-primary" />
                      Basic Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="po_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">PO Number</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Will be generated on save" 
                              {...field} 
                              disabled 
                              readOnly 
                              className="bg-muted/50 text-muted-foreground" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="supplier_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">
                            Supplier <span className="text-destructive">*</span>
                          </FormLabel>
                          <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                            <FormControl>
                              <SelectTrigger className="h-11">
                                <SelectValue placeholder="Choose a supplier" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {suppliers.map((supplier) => (
                                <SelectItem key={supplier.id} value={supplier.id}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{supplier.name}</span>
                                    <span className="text-xs text-muted-foreground">{supplier.supplier_ref}</span>
                                  </div>
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
                      name="order_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">
                            PO Date <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input type="date" {...field} disabled={readOnly} className="h-11" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Business Details Section */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Info className="h-5 w-5 text-primary" />
                      Business Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">
                            Currency <span className="text-destructive">*</span>
                          </FormLabel>
                          <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                            <FormControl>
                              <SelectTrigger className="h-11">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                              <SelectItem value="USD">USD - US Dollar</SelectItem>
                              <SelectItem value="EUR">EUR - Euro</SelectItem>
                              <SelectItem value="GBP">GBP - British Pound</SelectItem>
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
                          <FormLabel className="text-sm font-medium">Payment Terms</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="e.g., Net 30 days, Advance payment" 
                              {...field} 
                              disabled={readOnly} 
                              className="h-11" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="expected_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Expected Delivery Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} disabled={readOnly} className="h-11" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="place_of_supply"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Place of Supply</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="e.g., Mumbai, Maharashtra" 
                              {...field} 
                              disabled={readOnly} 
                              className="h-11" 
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground mt-1">
                            Location for GST tax calculation purposes
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">
                            Status <span className="text-destructive">*</span>
                          </FormLabel>
                          <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                            <FormControl>
                              <SelectTrigger className="h-11">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                             <SelectContent>
                               <SelectItem value="draft">
                                 <div className="flex items-center gap-2">
                                   <div className="w-2 h-2 rounded-full bg-muted-foreground"></div>
                                   <span>Draft</span>
                                 </div>
                               </SelectItem>
                               <SelectItem value="open">
                                 <div className="flex items-center gap-2">
                                   <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                   <span>Open</span>
                                 </div>
                               </SelectItem>
                               <SelectItem value="cancelled">
                                 <div className="flex items-center gap-2">
                                   <div className="w-2 h-2 rounded-full bg-destructive"></div>
                                   <span>Cancelled</span>
                                 </div>
                               </SelectItem>
                             </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Delivery Address Section */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <MapPin className="h-5 w-5 text-primary" />
                      Delivery Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="same_as_registered_address"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={handleSameAsRegisteredAddressChange}
                              disabled={readOnly}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-sm font-medium cursor-pointer">
                              Same as registered address
                            </FormLabel>
                            <p className="text-xs text-muted-foreground">
                              Use company registered address for delivery
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />

                    {!sameAsRegisteredAddress && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <FormField
                          control={form.control}
                          name="delivery_address_line1"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">
                                Address Line 1 <span className="text-destructive">*</span>
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Street address, building name" 
                                  {...field} 
                                  disabled={readOnly} 
                                  className="h-11" 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="delivery_address_line2"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">Address Line 2</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Apartment, suite, floor (optional)" 
                                  {...field} 
                                  disabled={readOnly} 
                                  className="h-11" 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="delivery_city"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">
                                City <span className="text-destructive">*</span>
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Enter city" 
                                  {...field} 
                                  disabled={readOnly} 
                                  className="h-11" 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="delivery_state"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">
                                State <span className="text-destructive">*</span>
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Enter state/province" 
                                  {...field} 
                                  disabled={readOnly} 
                                  className="h-11" 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="delivery_country"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">
                                Country <span className="text-destructive">*</span>
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Enter country" 
                                  {...field} 
                                  disabled={readOnly} 
                                  className="h-11" 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="delivery_postal_code"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">
                                Pin Code <span className="text-destructive">*</span>
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Enter postal/zip code" 
                                  {...field} 
                                  disabled={readOnly} 
                                  className="h-11" 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    {sameAsRegisteredAddress && companyData && (
                      <div className="bg-muted/50 p-4 rounded-lg border">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Delivery Address:</p>
                        <div className="text-sm space-y-1">
                          <p>{companyData.address_line1 || companyData.address}</p>
                          {companyData.address_line2 && <p>{companyData.address_line2}</p>}
                          <p>{companyData.city}, {companyData.state} {companyData.postal_code}</p>
                          {companyData.country && <p>{companyData.country}</p>}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="items" className="flex-1 overflow-auto">
                <Card className="flex-1 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-background z-10 border-b">
                    <CardTitle className="text-lg">Purchase Order Items</CardTitle>
                    {!readOnly && (
                      <Button type="button" onClick={addItem} variant="outline" size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Item
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader className="sticky top-16 bg-background z-10">
                        <TableRow>
                          <TableHead className="w-[300px]">Product</TableHead>
                          <TableHead className="w-[80px]">Qty</TableHead>
                          <TableHead className="w-[80px]">UOM</TableHead>
                          <TableHead className="w-[100px]">Price</TableHead>
                          <TableHead className="w-[80px]">Disc%</TableHead>
                          <TableHead className="w-[80px]">GST%</TableHead>
                          <TableHead className="w-[120px]">Total</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                       </TableHeader>
                       <TableBody>
                         {fields.map((field, index) => (
                           <>
                             <TableRow key={field.id} className="border-b">
                               <TableCell className="p-2">
                                 <FormField
                                   control={form.control}
                                   name={`items.${index}.product_id`}
                                   render={({ field }) => (
                                     <FormItem>
                                       <Select 
                                         value={field.value} 
                                         onValueChange={(value) => handleProductSelect(index, value)}
                                         disabled={readOnly}
                                       >
                                         <FormControl>
                                           <SelectTrigger className="h-8 text-xs">
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
                               </TableCell>
                               <TableCell className="p-2">
                                 <FormField
                                   control={form.control}
                                   name={`items.${index}.quantity`}
                                   render={({ field }) => (
                                     <FormItem>
                                       <FormControl>
                                         <Input 
                                           type="number" 
                                           className="h-8 text-xs"
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
                               </TableCell>
                               <TableCell className="p-2">
                                 <FormField
                                   control={form.control}
                                   name={`items.${index}.unit_of_measure`}
                                   render={({ field }) => (
                                     <FormItem>
                                       <FormControl>
                                         <Input className="h-8 text-xs" {...field} disabled={readOnly} />
                                       </FormControl>
                                       <FormMessage />
                                     </FormItem>
                                   )}
                                 />
                               </TableCell>
                               <TableCell className="p-2">
                                 <FormField
                                   control={form.control}
                                   name={`items.${index}.unit_price`}
                                   render={({ field }) => (
                                     <FormItem>
                                       <FormControl>
                                         <Input 
                                           type="number" 
                                           step="0.01"
                                           className="h-8 text-xs"
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
                               </TableCell>
                               <TableCell className="p-2">
                                 <FormField
                                   control={form.control}
                                   name={`items.${index}.discount_percentage`}
                                   render={({ field }) => (
                                     <FormItem>
                                       <FormControl>
                                         <Input 
                                           type="number" 
                                           step="0.01"
                                           className="h-8 text-xs"
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
                               </TableCell>
                               <TableCell className="p-2">
                                 <div className="flex items-center gap-1">
                                   <div className="text-xs">
                                     {((form.watch(`items.${index}.cgst_rate`) || 0) + 
                                       (form.watch(`items.${index}.sgst_rate`) || 0) + 
                                       (form.watch(`items.${index}.igst_rate`) || 0)).toFixed(1)}%
                                   </div>
                                   <Button
                                     type="button"
                                     variant="ghost"
                                     size="sm"
                                     className="h-6 w-6 p-0"
                                     onClick={() => toggleGSTExpansion(index)}
                                   >
                                     {expandedGSTItems.has(index) ? 
                                       <ChevronDown className="h-3 w-3" /> : 
                                       <ChevronRight className="h-3 w-3" />
                                     }
                                   </Button>
                                 </div>
                               </TableCell>
                               <TableCell className="p-2">
                                 <div className="text-xs font-medium">
                                   ₹{(form.watch(`items.${index}.line_total`) || 0).toFixed(2)}
                                 </div>
                               </TableCell>
                               <TableCell className="p-2">
                                 <div className="flex items-center gap-1">
                                   <Button
                                     type="button"
                                     variant="ghost"
                                     size="sm"
                                     className="h-6 w-6 p-0"
                                     onClick={() => toggleGSTExpansion(index)}
                                   >
                                     <Search className="h-3 w-3" />
                                   </Button>
                                   {!readOnly && fields.length > 1 && (
                                     <Button
                                       type="button"
                                       variant="ghost"
                                       size="sm"
                                       className="h-6 w-6 p-0 text-destructive"
                                       onClick={() => remove(index)}
                                     >
                                       <Trash2 className="h-3 w-3" />
                                     </Button>
                                   )}
                                 </div>
                               </TableCell>
                             </TableRow>
                             {expandedGSTItems.has(index) && (
                               <TableRow key={`${field.id}-gst`} className="bg-muted/50">
                                 <TableCell colSpan={8} className="p-4">
                                   <div className="space-y-4">
                                     <div>
                                       <h5 className="font-medium mb-2 text-sm">GST Details</h5>
                                       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                         <FormField
                                           control={form.control}
                                           name={`items.${index}.cgst_rate`}
                                           render={({ field }) => (
                                             <FormItem>
                                               <FormLabel className="text-xs">CGST %</FormLabel>
                                               <FormControl>
                                                 <Input 
                                                   type="number" 
                                                   step="0.01"
                                                   className="h-8"
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
                                               <FormLabel className="text-xs">SGST %</FormLabel>
                                               <FormControl>
                                                 <Input 
                                                   type="number" 
                                                   step="0.01"
                                                   className="h-8"
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
                                               <FormLabel className="text-xs">IGST %</FormLabel>
                                               <FormControl>
                                                 <Input 
                                                   type="number" 
                                                   step="0.01"
                                                   className="h-8"
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
                                     </div>
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                       <div>
                                         <FormField
                                           control={form.control}
                                           name={`items.${index}.hsn_sac_code`}
                                           render={({ field }) => (
                                             <FormItem>
                                               <FormLabel className="text-xs">HSN/SAC Code</FormLabel>
                                               <FormControl>
                                                 <Input className="h-8" {...field} disabled={readOnly} />
                                               </FormControl>
                                               <FormMessage />
                                             </FormItem>
                                           )}
                                         />
                                       </div>
                                       <div>
                                         <FormField
                                           control={form.control}
                                           name={`items.${index}.remarks`}
                                           render={({ field }) => (
                                             <FormItem>
                                               <FormLabel className="text-xs">Remarks</FormLabel>
                                               <FormControl>
                                                 <Input className="h-8" {...field} disabled={readOnly} />
                                               </FormControl>
                                               <FormMessage />
                                             </FormItem>
                                           )}
                                         />
                                       </div>
                                     </div>
                                   </div>
                                 </TableCell>
                               </TableRow>
                             )}
                           </>
                         ))}
                       </TableBody>
                     </Table>
                   </CardContent>
                 </Card>
               </TabsContent>
                                  render={({ field }) => (
                                    <FormItem>
                                      <Select 
                                        value={field.value} 
                                        onValueChange={(value) => handleProductSelect(index, value)}
                                        disabled={readOnly}
                                      >
                                        <FormControl>
                                          <SelectTrigger className="h-8 text-xs">
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
                              </TableCell>
                              <TableCell className="p-2">
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.quantity`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input 
                                          type="number" 
                                          className="h-8 text-xs"
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
                              </TableCell>
                              <TableCell className="p-2">
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.unit_of_measure`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input className="h-8 text-xs" {...field} disabled={readOnly} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </TableCell>
                              <TableCell className="p-2">
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.unit_price`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input 
                                          type="number" 
                                          step="0.01"
                                          className="h-8 text-xs"
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
                              </TableCell>
                              <TableCell className="p-2">
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.discount_percentage`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input 
                                          type="number" 
                                          step="0.01"
                                          className="h-8 text-xs"
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
                              </TableCell>
                              <TableCell className="p-2">
                                <div className="flex items-center gap-1">
                                  <div className="text-xs">
                                    {((form.watch(`items.${index}.cgst_rate`) || 0) + 
                                      (form.watch(`items.${index}.sgst_rate`) || 0) + 
                                      (form.watch(`items.${index}.igst_rate`) || 0)).toFixed(1)}%
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => toggleGSTExpansion(index)}
                                  >
                                    {expandedGSTItems.has(index) ? 
                                      <ChevronDown className="h-3 w-3" /> : 
                                      <ChevronRight className="h-3 w-3" />
                                    }
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell className="p-2">
                                <div className="text-xs font-medium">
                                  ₹{(form.watch(`items.${index}.line_total`) || 0).toFixed(2)}
                                </div>
                              </TableCell>
                              <TableCell className="p-2">
                                <div className="flex items-center gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => toggleGSTExpansion(index)}
                                  >
                                    <Search className="h-3 w-3" />
                                  </Button>
                                  {!readOnly && fields.length > 1 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-destructive"
                                      onClick={() => remove(index)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                            {expandedGSTItems.has(index) && (
                              <TableRow key={`${field.id}-gst`} className="bg-muted/50">
                                <TableCell colSpan={8} className="p-4">
                                  <div className="space-y-4">
                                    <div>
                                      <h5 className="font-medium mb-2 text-sm">GST Details</h5>
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <FormField
                                          control={form.control}
                                          name={`items.${index}.cgst_rate`}
                                          render={({ field }) => (
                                            <FormItem>
                                              <FormLabel className="text-xs">CGST %</FormLabel>
                                              <FormControl>
                                                <Input 
                                                  type="number" 
                                                  step="0.01"
                                                  className="h-8"
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
                                              <FormLabel className="text-xs">SGST %</FormLabel>
                                              <FormControl>
                                                <Input 
                                                  type="number" 
                                                  step="0.01"
                                                  className="h-8"
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
                                              <FormLabel className="text-xs">IGST %</FormLabel>
                                              <FormControl>
                                                <Input 
                                                  type="number" 
                                                  step="0.01"
                                                  className="h-8"
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
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div>
                                        <FormField
                                          control={form.control}
                                          name={`items.${index}.hsn_sac_code`}
                                          render={({ field }) => (
                                            <FormItem>
                                              <FormLabel className="text-xs">HSN/SAC Code</FormLabel>
                                              <FormControl>
                                                <Input className="h-8" {...field} disabled={readOnly} />
                                              </FormControl>
                                              <FormMessage />
                                            </FormItem>
                                          )}
                                        />
                                      </div>
                                      <div>
                                        <FormField
                                          control={form.control}
                                          name={`items.${index}.remarks`}
                                          render={({ field }) => (
                                            <FormItem>
                                              <FormLabel className="text-xs">Remarks</FormLabel>
                                              <FormControl>
                                                <Input className="h-8" {...field} disabled={readOnly} />
                                              </FormControl>
                                              <FormMessage />
                                            </FormItem>
                                          )}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="summary" className="flex-1 overflow-auto space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                  <Card className="shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg">Notes & Instructions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">Remarks / Notes</FormLabel>
                            <FormControl>
                              <Textarea 
                                {...field} 
                                placeholder="Add any special instructions, terms, or notes for the supplier..."
                                className="min-h-[200px] resize-none"
                                disabled={readOnly}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg">Order Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b border-muted">
                          <span className="text-sm text-muted-foreground">Subtotal:</span>
                          <span className="font-mono text-sm">₹{subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-muted">
                          <span className="text-sm text-muted-foreground">Total Discount:</span>
                          <span className="font-mono text-sm text-green-600">-₹{totalDiscount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-muted">
                          <span className="text-sm text-muted-foreground">Total Tax:</span>
                          <span className="font-mono text-sm">₹{totalTax.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-t-2 border-primary/20">
                          <span className="font-semibold text-base">Total Amount:</span>
                          <span className="font-bold text-lg text-primary">₹{total.toFixed(2)}</span>
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div className="space-y-3 pt-2">
                        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Order Details</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-muted/50 p-3 rounded-lg">
                            <div className="text-xs text-muted-foreground uppercase tracking-wide">Items</div>
                            <div className="text-lg font-bold">{fields.length}</div>
                          </div>
                          <div className="bg-muted/50 p-3 rounded-lg">
                            <div className="text-xs text-muted-foreground uppercase tracking-wide">Currency</div>
                            <div className="text-lg font-bold">{form.watch('currency')}</div>
                          </div>
                          <div className="bg-muted/50 p-3 rounded-lg">
                            <div className="text-xs text-muted-foreground uppercase tracking-wide">Status</div>
                            <div className="text-lg font-bold capitalize">{form.watch('status')}</div>
                          </div>
                          <div className="bg-muted/50 p-3 rounded-lg">
                            <div className="text-xs text-muted-foreground uppercase tracking-wide">Expected</div>
                            <div className="text-sm font-medium">
                              {form.watch('expected_date') ? 
                                new Date(form.watch('expected_date')).toLocaleDateString() : 
                                'Not set'
                              }
                            </div>
                          </div>
                        </div>

                        {form.watch('place_of_supply') && (
                          <div className="bg-muted/50 p-3 rounded-lg">
                            <div className="text-xs text-muted-foreground uppercase tracking-wide">Place of Supply</div>
                            <div className="text-sm font-medium">{form.watch('place_of_supply')}</div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </div>
          </Tabs>

          {/* Form Actions - Sticky Footer */}
          {!readOnly && (
            <div className="flex justify-end space-x-4 p-4 border-t bg-background">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : (mode === 'edit' ? 'Update Purchase Order' : 'Create Purchase Order')}
              </Button>
            </div>
          )}
        </form>
      </Form>
    </div>
  );
}