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
import { Plus, Trash2, Search, ChevronDown, ChevronRight, Building, MapPin, Info, AlertTriangle, CheckCircle2, RadioIcon, ShoppingCart, FileText } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
  gst_type: z.enum(['intra', 'inter']).default('intra'),
  master_gst_rate: z.number().optional(),
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
  const [activeTab, setActiveTab] = useState('order-info');

  const form = useForm<PurchaseOrderFormData>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      po_number: purchaseOrder?.po_number || '',
      supplier_id: purchaseOrder?.supplier_id || '',
      order_date: purchaseOrder?.order_date || new Date().toISOString().split('T')[0],
      currency: purchaseOrder?.currency || 'INR',
      payment_terms: purchaseOrder?.payment_terms || '',
      expected_date: purchaseOrder?.expected_date || '',
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
      items: purchaseOrder?.items || [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  useEffect(() => {
    fetchSuppliers();
    fetchProducts();
    fetchCompanyData();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*');
      
      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch suppliers',
        variant: 'destructive',
      });
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*');
      
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch products',
        variant: 'destructive',
      });
    }
  };

  const fetchCompanyData = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .limit(1)
        .single();
      
      if (error) throw error;
      setCompanyData(data);
    } catch (error) {
      console.error('Error fetching company data:', error);
    }
  };

  const handleProductSelect = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      form.setValue(`items.${index}.product_id`, product.id);
      form.setValue(`items.${index}.product_name`, product.name);
      form.setValue(`items.${index}.item_code`, product.sku || '');
      // Auto-populate HSN/SAC code from product master
      form.setValue(`items.${index}.hsn_sac_code`, product.hsn_code || '');
      form.setValue(`items.${index}.unit_of_measure`, product.unit || 'PCS');
      // Auto-populate unit price from product master (use unit_price or cost_price)
      form.setValue(`items.${index}.unit_price`, product.unit_price || product.cost_price || 0);
      form.setValue(`items.${index}.master_gst_rate`, product.gst_percentage || 0);
      
      // Auto-populate GST rates from master
      const masterGST = product.gst_percentage || 0;
      if (masterGST > 0) {
        const gstType = form.getValues(`items.${index}.gst_type`) || 'intra';
        if (gstType === 'intra') {
          // Split equally between CGST and SGST
          form.setValue(`items.${index}.cgst_rate`, masterGST / 2);
          form.setValue(`items.${index}.sgst_rate`, masterGST / 2);
          form.setValue(`items.${index}.igst_rate`, 0);
        } else {
          // Inter-state: use IGST
          form.setValue(`items.${index}.cgst_rate`, 0);
          form.setValue(`items.${index}.sgst_rate`, 0);
          form.setValue(`items.${index}.igst_rate`, masterGST);
        }
      }
      
      calculateLineAmounts(index);
    }
  };

  const handleGSTTypeChange = (index: number, gstType: 'intra' | 'inter') => {
    form.setValue(`items.${index}.gst_type`, gstType);
    const masterGST = form.getValues(`items.${index}.master_gst_rate`) || 0;
    
    if (gstType === 'intra') {
      // Intra-state: Clear IGST, set CGST+SGST
      form.setValue(`items.${index}.igst_rate`, 0);
      form.setValue(`items.${index}.cgst_rate`, masterGST / 2);
      form.setValue(`items.${index}.sgst_rate`, masterGST / 2);
    } else {
      // Inter-state: Clear CGST+SGST, set IGST
      form.setValue(`items.${index}.cgst_rate`, 0);
      form.setValue(`items.${index}.sgst_rate`, 0);
      form.setValue(`items.${index}.igst_rate`, masterGST);
    }
    
    calculateLineAmounts(index);
  };

  const validateGSTRate = (index: number, gstType: 'cgst' | 'sgst' | 'igst', value: number) => {
    const masterGST = form.getValues(`items.${index}.master_gst_rate`) || 0;
    const currentGSTType = form.getValues(`items.${index}.gst_type`);
    
    if (currentGSTType === 'intra') {
      const cgst = gstType === 'cgst' ? value : (form.getValues(`items.${index}.cgst_rate`) || 0);
      const sgst = gstType === 'sgst' ? value : (form.getValues(`items.${index}.sgst_rate`) || 0);
      const totalGST = cgst + sgst;
      
      if (totalGST > masterGST) {
        toast({
          title: 'GST Validation Error',
          description: `Total GST (${totalGST}%) cannot exceed master rate (${masterGST}%)`,
          variant: 'destructive',
        });
        return false;
      }
    } else {
      if (value > masterGST) {
        toast({
          title: 'GST Validation Error',
          description: `IGST (${value}%) cannot exceed master rate (${masterGST}%)`,
          variant: 'destructive',
        });
        return false;
      }
    }
    
    return true;
  };

  const calculateLineAmounts = (index: number) => {
    const quantity = form.getValues(`items.${index}.quantity`) || 0;
    const unitPrice = form.getValues(`items.${index}.unit_price`) || 0;
    const discountPercentage = form.getValues(`items.${index}.discount_percentage`) || 0;
    const cgstRate = form.getValues(`items.${index}.cgst_rate`) || 0;
    const sgstRate = form.getValues(`items.${index}.sgst_rate`) || 0;
    const igstRate = form.getValues(`items.${index}.igst_rate`) || 0;

    const subtotal = quantity * unitPrice;
    const discountAmount = (subtotal * discountPercentage) / 100;
    const lineSubtotal = subtotal - discountAmount;

    const cgstAmount = (lineSubtotal * cgstRate) / 100;
    const sgstAmount = (lineSubtotal * sgstRate) / 100;
    const igstAmount = (lineSubtotal * igstRate) / 100;

    const lineTotal = lineSubtotal + cgstAmount + sgstAmount + igstAmount;

    form.setValue(`items.${index}.discount_amount`, discountAmount);
    form.setValue(`items.${index}.line_subtotal`, lineSubtotal);
    form.setValue(`items.${index}.cgst_amount`, cgstAmount);
    form.setValue(`items.${index}.sgst_amount`, sgstAmount);
    form.setValue(`items.${index}.igst_amount`, igstAmount);
    form.setValue(`items.${index}.line_total`, lineTotal);
  };

  const addItem = () => {
    append({
      product_id: '',
      product_name: '',
      item_code: '',
      hsn_sac_code: '',
      quantity: 1,
      unit_of_measure: 'PCS',
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
      gst_type: 'intra',
      master_gst_rate: 0,
    });
  };

  const handleSubmit = async (data: PurchaseOrderFormData) => {
    setLoading(true);
    try {
      await onSubmit(data);
      toast({
        title: 'Success',
        description: `Purchase Order ${mode === 'edit' ? 'updated' : 'created'} successfully`,
      });
    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        title: 'Error',
        description: `Failed to ${mode === 'edit' ? 'update' : 'create'} Purchase Order`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSameAsRegisteredAddressChange = (checked: boolean) => {
    form.setValue('same_as_registered_address', checked);
    
    if (checked && companyData) {
      form.setValue('delivery_address_line1', companyData.address_line1 || companyData.address || '');
      form.setValue('delivery_address_line2', companyData.address_line2 || '');
      form.setValue('delivery_city', companyData.city || '');
      form.setValue('delivery_state', companyData.state || '');
      form.setValue('delivery_country', companyData.country || '');
      form.setValue('delivery_postal_code', companyData.postal_code || '');
    } else {
      form.setValue('delivery_address_line1', '');
      form.setValue('delivery_address_line2', '');
      form.setValue('delivery_city', '');
      form.setValue('delivery_state', '');
      form.setValue('delivery_country', '');
      form.setValue('delivery_postal_code', '');
    }
  };

  const sameAsRegisteredAddress = form.watch('same_as_registered_address');

  // Calculate totals
  const items = form.watch('items') || [];
  const subtotal = items.reduce((sum, item) => sum + (item.line_subtotal || 0), 0);
  const totalDiscount = items.reduce((sum, item) => sum + (item.discount_amount || 0), 0);
  const totalTax = items.reduce((sum, item) => sum + (item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0), 0);
  const total = items.reduce((sum, item) => sum + (item.line_total || 0), 0);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-background">
      {/* Compact Header */}
      <div className="flex justify-between items-center mb-3 px-4 py-3 border-b bg-card/50 backdrop-blur-sm">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {mode === 'create' ? 'New Purchase Order' : 
             mode === 'edit' ? 'Edit Purchase Order' : 'Purchase Order Details'}
          </h1>
          {purchaseOrder?.po_number && (
            <p className="text-sm text-muted-foreground">PO: {purchaseOrder.po_number}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={readOnly ? "secondary" : "default"} className="text-xs px-2">
            {readOnly ? 'View Only' : (mode === 'edit' ? 'Edit' : 'Create')}
          </Badge>
          <div className="text-right text-sm bg-primary/10 px-3 py-2 rounded-lg border">
            <div className="font-bold text-primary text-lg">₹{total.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">{fields.length} items</div>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="flex-1 flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col px-4">
            <TabsList className="grid w-full grid-cols-3 mb-4 bg-muted/30 h-12">
              <TabsTrigger value="order-info" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2">
                <Building className="h-4 w-4" />
                Order Info
              </TabsTrigger>
              <TabsTrigger value="items" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Items ({fields.length})
              </TabsTrigger>
              <TabsTrigger value="summary" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Summary
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden">
              {/* Order Info Tab */}
              <TabsContent value="order-info" className="flex-1 overflow-auto space-y-4 m-0">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Basic Information */}
                  <Card className="shadow-sm border-border/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Building className="h-4 w-4 text-primary" />
                        Basic Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        <FormField
                          control={form.control}
                          name="po_number"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">PO Number</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Auto-generated on save" 
                                  {...field} 
                                  disabled 
                                  className="h-9 bg-muted/30 text-muted-foreground" 
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="supplier_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Supplier</FormLabel>
                              <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                                <FormControl>
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Select supplier" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {suppliers.map((supplier) => (
                                    <SelectItem key={supplier.id} value={supplier.id}>
                                      {supplier.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-3">
                          <FormField
                            control={form.control}
                            name="order_date"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Order Date</FormLabel>
                                <FormControl>
                                  <Input type="date" {...field} disabled={readOnly} className="h-9" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="expected_date"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Expected Date</FormLabel>
                                <FormControl>
                                  <Input type="date" {...field} disabled={readOnly} className="h-9" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <FormField
                            control={form.control}
                            name="currency"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Currency</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                                  <FormControl>
                                    <SelectTrigger className="h-9">
                                      <SelectValue placeholder="Select currency" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="INR">INR</SelectItem>
                                    <SelectItem value="USD">USD</SelectItem>
                                    <SelectItem value="EUR">EUR</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                                  <FormControl>
                                    <SelectTrigger className="h-9">
                                      <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="draft">Draft</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="approved">Approved</SelectItem>
                                    <SelectItem value="sent">Sent</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="payment_terms"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Payment Terms</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., Net 30 days" {...field} disabled={readOnly} className="h-9" />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="place_of_supply"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Place of Supply</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., Karnataka" {...field} disabled={readOnly} className="h-9" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Delivery Address */}
                  <Card className="shadow-sm border-border/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        Delivery Address
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="same-as-registered"
                          checked={sameAsRegisteredAddress}
                          onCheckedChange={handleSameAsRegisteredAddressChange}
                          disabled={readOnly}
                        />
                        <label htmlFor="same-as-registered" className="text-sm font-medium cursor-pointer">
                          Same as registered address
                        </label>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        <FormField
                          control={form.control}
                          name="delivery_address_line1"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Address Line 1</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Street address" 
                                  {...field} 
                                  disabled={readOnly || sameAsRegisteredAddress} 
                                  className="h-9" 
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="delivery_address_line2"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Address Line 2</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Apartment, suite, etc." 
                                  {...field} 
                                  disabled={readOnly || sameAsRegisteredAddress} 
                                  className="h-9" 
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="delivery_city"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">City</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="City" 
                                  {...field} 
                                  disabled={readOnly || sameAsRegisteredAddress} 
                                  className="h-9" 
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="delivery_state"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">State</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="State" 
                                  {...field} 
                                  disabled={readOnly || sameAsRegisteredAddress} 
                                  className="h-9" 
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="delivery_country"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Country</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Country" 
                                  {...field} 
                                  disabled={readOnly || sameAsRegisteredAddress} 
                                  className="h-9" 
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="delivery_postal_code"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Postal Code</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="PIN Code" 
                                  {...field} 
                                  disabled={readOnly || sameAsRegisteredAddress} 
                                  className="h-9" 
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="shadow-sm border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Info className="h-4 w-4 text-primary" />
                      Additional Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Additional notes or special instructions..." 
                              {...field} 
                              disabled={readOnly} 
                              className="min-h-[80px]" 
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Items Tab */}
              <TabsContent value="items" className="flex-1 overflow-auto m-0">
                <Card className="shadow-sm border-border/50">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4 text-primary" />
                        Purchase Order Items
                      </CardTitle>
                      {!readOnly && (
                        <Button type="button" onClick={addItem} size="sm" className="h-8 gap-2">
                          <Plus className="h-4 w-4" />
                          Add Item
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead className="w-[200px] font-semibold">Product</TableHead>
                            <TableHead className="w-[60px] text-center font-semibold">Qty</TableHead>
                            <TableHead className="w-[100px] text-center font-semibold">Unit Price</TableHead>
                            <TableHead className="w-[80px] text-center font-semibold">HSN/SAC</TableHead>
                            <TableHead className="w-[60px] text-center font-semibold">CGST%</TableHead>
                            <TableHead className="w-[60px] text-center font-semibold">SGST%</TableHead>
                            <TableHead className="w-[60px] text-center font-semibold">IGST%</TableHead>
                            <TableHead className="w-[70px] text-center font-semibold">Disc%</TableHead>
                            <TableHead className="text-right font-semibold">Line Total</TableHead>
                            {!readOnly && <TableHead className="w-[50px]"></TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {fields.map((field, index) => {
                            const masterGST = form.watch(`items.${index}.master_gst_rate`) || 0;
                            const gstType = form.watch(`items.${index}.gst_type`) || 'intra';
                            const cgstRate = form.watch(`items.${index}.cgst_rate`) || 0;
                            const sgstRate = form.watch(`items.${index}.sgst_rate`) || 0;
                            const igstRate = form.watch(`items.${index}.igst_rate`) || 0;
                            const totalAppliedGST = gstType === 'intra' ? cgstRate + sgstRate : igstRate;
                            
                            return (
                              <TableRow key={field.id} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
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
                                            <SelectTrigger className="h-8 text-sm">
                                              <SelectValue placeholder="Select product" />
                                            </SelectTrigger>
                                          </FormControl>
                                          <SelectContent>
                                            {products.map((product) => (
                                              <SelectItem key={product.id} value={product.id}>
                                                <div className="flex flex-col">
                                                  <span className="font-medium text-sm">{product.name}</span>
                                                  <span className="text-xs text-muted-foreground">
                                                    {product.sku} | ₹{product.unit_price} | GST: {product.gst_percentage}%
                                                  </span>
                                                </div>
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
                                            min="1" 
                                            className="h-8 w-full text-center text-sm" 
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
                                    name={`items.${index}.unit_price`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <div className="relative">
                                            <Input 
                                              type="number" 
                                              step="0.01" 
                                              min="0" 
                                              className="h-8 w-full text-center text-sm pr-6" 
                                              {...field}
                                              onChange={(e) => {
                                                field.onChange(parseFloat(e.target.value) || 0);
                                                calculateLineAmounts(index);
                                              }}
                                              disabled={readOnly}
                                            />
                                            {form.watch(`items.${index}.unit_price`) === products.find(p => p.id === form.watch(`items.${index}.product_id`))?.unit_price && (
                                              <CheckCircle2 className="h-3 w-3 text-green-500 absolute right-1 top-2.5" />
                                            )}
                                          </div>
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </TableCell>

                                <TableCell className="p-2">
                                  <FormField
                                    control={form.control}
                                    name={`items.${index}.hsn_sac_code`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <div className="relative">
                                            <Input 
                                              className="h-8 w-full text-center text-sm pr-6" 
                                              placeholder="HSN"
                                              {...field} 
                                              disabled={readOnly}
                                            />
                                            {form.watch(`items.${index}.hsn_sac_code`) === products.find(p => p.id === form.watch(`items.${index}.product_id`))?.hsn_code && (
                                              <CheckCircle2 className="h-3 w-3 text-green-500 absolute right-1 top-2.5" />
                                            )}
                                          </div>
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </TableCell>

                                <TableCell className="p-2">
                                  <FormField
                                    control={form.control}
                                    name={`items.${index}.cgst_rate`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Input 
                                            type="number" 
                                            step="0.01" 
                                            min="0" 
                                            max={masterGST}
                                            className={`h-8 w-full text-center text-sm ${gstType === 'inter' ? 'bg-muted/50' : ''} ${totalAppliedGST > masterGST ? 'border-destructive' : ''}`}
                                            placeholder="0"
                                            {...field}
                                            onChange={(e) => {
                                              const value = parseFloat(e.target.value) || 0;
                                              if (validateGSTRate(index, 'cgst', value)) {
                                                field.onChange(value);
                                                calculateLineAmounts(index);
                                              }
                                            }}
                                            disabled={readOnly || gstType === 'inter'}
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
                                    name={`items.${index}.sgst_rate`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Input 
                                            type="number" 
                                            step="0.01" 
                                            min="0" 
                                            max={masterGST}
                                            className={`h-8 w-full text-center text-sm ${gstType === 'inter' ? 'bg-muted/50' : ''} ${totalAppliedGST > masterGST ? 'border-destructive' : ''}`}
                                            placeholder="0"
                                            {...field}
                                            onChange={(e) => {
                                              const value = parseFloat(e.target.value) || 0;
                                              if (validateGSTRate(index, 'sgst', value)) {
                                                field.onChange(value);
                                                calculateLineAmounts(index);
                                              }
                                            }}
                                            disabled={readOnly || gstType === 'inter'}
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
                                    name={`items.${index}.igst_rate`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Input 
                                            type="number" 
                                            step="0.01" 
                                            min="0" 
                                            max={masterGST}
                                            className={`h-8 w-full text-center text-sm ${gstType === 'intra' ? 'bg-muted/50' : ''} ${totalAppliedGST > masterGST ? 'border-destructive' : ''}`}
                                            placeholder="0"
                                            {...field}
                                            onChange={(e) => {
                                              const value = parseFloat(e.target.value) || 0;
                                              if (validateGSTRate(index, 'igst', value)) {
                                                field.onChange(value);
                                                calculateLineAmounts(index);
                                              }
                                            }}
                                            disabled={readOnly || gstType === 'intra'}
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
                                            min="0" 
                                            max="100"
                                            className="h-8 w-full text-center text-sm" 
                                            placeholder="0"
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

                                <TableCell className="p-2 text-right">
                                  <div className="space-y-1">
                                    <div className="font-semibold text-sm">
                                      ₹{(form.watch(`items.${index}.line_total`) || 0).toFixed(2)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      Tax: ₹{((form.watch(`items.${index}.cgst_amount`) || 0) + 
                                                (form.watch(`items.${index}.sgst_amount`) || 0) + 
                                                (form.watch(`items.${index}.igst_amount`) || 0)).toFixed(2)}
                                    </div>
                                    {masterGST > 0 && (
                                      <div className="text-xs">
                                        <Badge variant={totalAppliedGST <= masterGST ? "secondary" : "destructive"} className="text-xs px-1">
                                          {totalAppliedGST}%/{masterGST}%
                                        </Badge>
                                      </div>
                                    )}
                                  </div>
                                </TableCell>

                                {!readOnly && (
                                  <TableCell className="p-2">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                      onClick={() => remove(index)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                )}
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Summary Tab */}
              <TabsContent value="summary" className="flex-1 overflow-auto space-y-4 m-0">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Order Summary */}
                  <Card className="shadow-sm border-border/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        Order Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b border-border/50">
                          <span className="text-sm text-muted-foreground">Subtotal:</span>
                          <span className="font-medium">₹{subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-border/50">
                          <span className="text-sm text-muted-foreground">Total Discount:</span>
                          <span className="font-medium text-green-600">-₹{totalDiscount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-border/50">
                          <span className="text-sm text-muted-foreground">Total Tax:</span>
                          <span className="font-medium">₹{totalTax.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-t-2 border-primary/20">
                          <span className="text-lg font-semibold">Total Amount:</span>
                          <span className="text-xl font-bold text-primary">₹{total.toFixed(2)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Order Details */}
                  <Card className="shadow-sm border-border/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Info className="h-4 w-4 text-primary" />
                        Order Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Items Count:</span>
                          <div className="font-medium">{fields.length}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Currency:</span>
                          <div className="font-medium">{form.watch('currency')}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Status:</span>
                          <div className="font-medium capitalize">{form.watch('status')}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Order Date:</span>
                          <div className="font-medium">{form.watch('order_date')}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </div>
          </Tabs>

          {/* Sticky Footer */}
          <div className="sticky bottom-0 bg-background border-t border-border/50 px-4 py-3 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                {fields.length} items • ₹{total.toFixed(2)}
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              {!readOnly && (
                <Button type="submit" disabled={loading} className="min-w-[120px]">
                  {loading ? 'Saving...' : (mode === 'edit' ? 'Update Order' : 'Create Order')}
                </Button>
              )}
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}