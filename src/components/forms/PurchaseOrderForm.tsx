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
  remarks: z.string().optional(),
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
  const [expandedGSTItems, setExpandedGSTItems] = useState<Set<number>>(new Set());

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
      form.setValue(`items.${index}.hsn_sac_code`, product.hsn_sac_code || '');
      form.setValue(`items.${index}.unit_of_measure`, product.unit_of_measure || 'PCS');
      form.setValue(`items.${index}.unit_price`, product.purchase_price || 0);
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
      remarks: '',
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
                              <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Supplier <span className="text-destructive">*</span>
                              </FormLabel>
                              <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                                <FormControl>
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Choose supplier" />
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

                        <div className="grid grid-cols-2 gap-3">
                          <FormField
                            control={form.control}
                            name="order_date"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                  Order Date <span className="text-destructive">*</span>
                                </FormLabel>
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
                              <FormItem>
                                <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Expected Date</FormLabel>
                                <FormControl>
                                  <Input type="date" {...field} disabled={readOnly} className="h-9" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Status <span className="text-destructive">*</span>
                              </FormLabel>
                              <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                                <FormControl>
                                  <SelectTrigger className="h-9">
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
                      </div>
                    </CardContent>
                  </Card>

                  {/* Business Details */}
                  <Card className="shadow-sm border-border/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Info className="h-4 w-4 text-primary" />
                        Business Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        <FormField
                          control={form.control}
                          name="currency"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Currency <span className="text-destructive">*</span>
                              </FormLabel>
                              <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                                <FormControl>
                                  <SelectTrigger className="h-9">
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
                              <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Payment Terms</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="e.g., Net 30 days, Advance payment" 
                                  {...field} 
                                  disabled={readOnly} 
                                  className="h-9" 
                                />
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
                                <Input 
                                  placeholder="e.g., Mumbai, Maharashtra" 
                                  {...field} 
                                  disabled={readOnly} 
                                  className="h-9" 
                                />
                              </FormControl>
                              <p className="text-xs text-muted-foreground">For GST calculation purposes</p>
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Delivery Address */}
                <Card className="shadow-sm border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <TableHead className="w-[250px] font-semibold">Product</TableHead>
                            <TableHead className="text-center font-semibold">Qty</TableHead>
                            <TableHead className="text-center font-semibold">Unit Price</TableHead>
                            <TableHead className="text-center font-semibold">Discount</TableHead>
                            <TableHead className="text-center font-semibold">GST Details</TableHead>
                            <TableHead className="text-right font-semibold">Line Total</TableHead>
                            {!readOnly && <TableHead className="w-[50px]"></TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {fields.map((field, index) => {
                            const isExpanded = expandedGSTItems.has(index);
                            const masterGST = form.watch(`items.${index}.master_gst_rate`) || 0;
                            const gstType = form.watch(`items.${index}.gst_type`) || 'intra';
                            const cgstRate = form.watch(`items.${index}.cgst_rate`) || 0;
                            const sgstRate = form.watch(`items.${index}.sgst_rate`) || 0;
                            const igstRate = form.watch(`items.${index}.igst_rate`) || 0;
                            const totalAppliedGST = gstType === 'intra' ? cgstRate + sgstRate : igstRate;
                            
                            return (
                              <>
                                <TableRow key={field.id} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                                  <TableCell className="p-3">
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
                                                      {product.sku} | ₹{product.purchase_price} | GST: {product.gst_percentage}%
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

                                  <TableCell className="p-3">
                                    <FormField
                                      control={form.control}
                                      name={`items.${index}.quantity`}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormControl>
                                            <Input 
                                              type="number" 
                                              min="1" 
                                              className="h-8 w-20 text-center text-sm" 
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

                                  <TableCell className="p-3">
                                    <FormField
                                      control={form.control}
                                      name={`items.${index}.unit_price`}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormControl>
                                            <Input 
                                              type="number" 
                                              step="0.01" 
                                              min="0" 
                                              className="h-8 w-24 text-center text-sm" 
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

                                  <TableCell className="p-3">
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
                                              className="h-8 w-20 text-center text-sm" 
                                              placeholder="0%"
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

                                  <TableCell className="p-3">
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs">
                                          Master: {masterGST}%
                                        </Badge>
                                        <Badge 
                                          variant={totalAppliedGST <= masterGST ? "secondary" : "destructive"} 
                                          className="text-xs"
                                        >
                                          Applied: {totalAppliedGST}%
                                        </Badge>
                                      </div>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 p-1 text-xs"
                                        onClick={() => {
                                          if (isExpanded) {
                                            setExpandedGSTItems(prev => {
                                              const newSet = new Set(prev);
                                              newSet.delete(index);
                                              return newSet;
                                            });
                                          } else {
                                            setExpandedGSTItems(prev => new Set(prev).add(index));
                                          }
                                        }}
                                      >
                                        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                        GST Details
                                      </Button>
                                    </div>
                                  </TableCell>

                                  <TableCell className="p-3 text-right">
                                    <div className="font-semibold text-sm">
                                      ₹{(form.watch(`items.${index}.line_total`) || 0).toFixed(2)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      Tax: ₹{((form.watch(`items.${index}.cgst_amount`) || 0) + 
                                                (form.watch(`items.${index}.sgst_amount`) || 0) + 
                                                (form.watch(`items.${index}.igst_amount`) || 0)).toFixed(2)}
                                    </div>
                                  </TableCell>

                                  {!readOnly && (
                                    <TableCell className="p-3">
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

                                {/* Expanded GST Details Row */}
                                {isExpanded && (
                                  <TableRow>
                                    <TableCell colSpan={readOnly ? 6 : 7} className="p-0">
                                      <div className="bg-muted/30 border-t p-4 space-y-4">
                                        {/* GST Type Toggle */}
                                        <div>
                                          <FormField
                                            control={form.control}
                                            name={`items.${index}.gst_type`}
                                            render={({ field }) => (
                                              <FormItem>
                                                <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">GST Type</FormLabel>
                                                <FormControl>
                                                  <RadioGroup
                                                    value={field.value}
                                                    onValueChange={(value: 'intra' | 'inter') => {
                                                      field.onChange(value);
                                                      handleGSTTypeChange(index, value);
                                                    }}
                                                    className="flex gap-6"
                                                    disabled={readOnly}
                                                  >
                                                    <div className="flex items-center space-x-2">
                                                      <RadioGroupItem value="intra" id={`intra-${index}`} />
                                                      <label htmlFor={`intra-${index}`} className="text-sm font-medium cursor-pointer">
                                                        Intra-State (CGST + SGST)
                                                      </label>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                      <RadioGroupItem value="inter" id={`inter-${index}`} />
                                                      <label htmlFor={`inter-${index}`} className="text-sm font-medium cursor-pointer">
                                                        Inter-State (IGST)
                                                      </label>
                                                    </div>
                                                  </RadioGroup>
                                                </FormControl>
                                              </FormItem>
                                            )}
                                          />
                                        </div>

                                        {/* GST Rate Inputs */}
                                        {gstType === 'intra' ? (
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormField
                                              control={form.control}
                                              name={`items.${index}.cgst_rate`}
                                              render={({ field }) => (
                                                <FormItem>
                                                  <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                                    CGST Rate (%)
                                                  </FormLabel>
                                                  <FormControl>
                                                    <Input 
                                                      type="number" 
                                                      step="0.01" 
                                                      min="0" 
                                                      max={masterGST}
                                                      className="h-8 text-sm" 
                                                      {...field}
                                                      onChange={(e) => {
                                                        const value = parseFloat(e.target.value) || 0;
                                                        if (validateGSTRate(index, 'cgst', value)) {
                                                          field.onChange(value);
                                                          calculateLineAmounts(index);
                                                        }
                                                      }}
                                                      disabled={readOnly}
                                                    />
                                                  </FormControl>
                                                  <div className="text-xs text-muted-foreground">
                                                    Amount: ₹{(form.watch(`items.${index}.cgst_amount`) || 0).toFixed(2)}
                                                  </div>
                                                  <FormMessage />
                                                </FormItem>
                                              )}
                                            />
                                            <FormField
                                              control={form.control}
                                              name={`items.${index}.sgst_rate`}
                                              render={({ field }) => (
                                                <FormItem>
                                                  <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                                    SGST Rate (%)
                                                  </FormLabel>
                                                  <FormControl>
                                                    <Input 
                                                      type="number" 
                                                      step="0.01" 
                                                      min="0" 
                                                      max={masterGST}
                                                      className="h-8 text-sm" 
                                                      {...field}
                                                      onChange={(e) => {
                                                        const value = parseFloat(e.target.value) || 0;
                                                        if (validateGSTRate(index, 'sgst', value)) {
                                                          field.onChange(value);
                                                          calculateLineAmounts(index);
                                                        }
                                                      }}
                                                      disabled={readOnly}
                                                    />
                                                  </FormControl>
                                                  <div className="text-xs text-muted-foreground">
                                                    Amount: ₹{(form.watch(`items.${index}.sgst_amount`) || 0).toFixed(2)}
                                                  </div>
                                                  <FormMessage />
                                                </FormItem>
                                              )}
                                            />
                                          </div>
                                        ) : (
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormField
                                              control={form.control}
                                              name={`items.${index}.igst_rate`}
                                              render={({ field }) => (
                                                <FormItem>
                                                  <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                                    IGST Rate (%)
                                                  </FormLabel>
                                                  <FormControl>
                                                    <Input 
                                                      type="number" 
                                                      step="0.01" 
                                                      min="0" 
                                                      max={masterGST}
                                                      className="h-8 text-sm" 
                                                      {...field}
                                                      onChange={(e) => {
                                                        const value = parseFloat(e.target.value) || 0;
                                                        if (validateGSTRate(index, 'igst', value)) {
                                                          field.onChange(value);
                                                          calculateLineAmounts(index);
                                                        }
                                                      }}
                                                      disabled={readOnly}
                                                    />
                                                  </FormControl>
                                                  <div className="text-xs text-muted-foreground">
                                                    Amount: ₹{(form.watch(`items.${index}.igst_amount`) || 0).toFixed(2)}
                                                  </div>
                                                  <FormMessage />
                                                </FormItem>
                                              )}
                                            />
                                          </div>
                                        )}

                                        {/* Additional Details */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <FormField
                                            control={form.control}
                                            name={`items.${index}.hsn_sac_code`}
                                            render={({ field }) => (
                                              <FormItem>
                                                <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">HSN/SAC Code</FormLabel>
                                                <FormControl>
                                                  <Input className="h-8 text-sm" {...field} disabled={readOnly} />
                                                </FormControl>
                                              </FormItem>
                                            )}
                                          />
                                          <FormField
                                            control={form.control}
                                            name={`items.${index}.remarks`}
                                            render={({ field }) => (
                                              <FormItem>
                                                <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Remarks</FormLabel>
                                                <FormControl>
                                                  <Input 
                                                    className="h-8 text-sm" 
                                                    placeholder="Additional notes for this item"
                                                    {...field} 
                                                    disabled={readOnly} 
                                                  />
                                                </FormControl>
                                              </FormItem>
                                            )}
                                          />
                                        </div>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Summary Tab */}
              <TabsContent value="summary" className="flex-1 overflow-auto m-0">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card className="shadow-sm border-border/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold">Notes & Instructions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Remarks / Notes</FormLabel>
                            <FormControl>
                              <Textarea 
                                {...field} 
                                placeholder="Add any special instructions, terms, or notes for the supplier..."
                                className="min-h-[200px] resize-none text-sm"
                                disabled={readOnly}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm border-border/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold">Order Summary</CardTitle>
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
                        <div className="flex justify-between items-center py-3 border-t-2 border-primary/20 bg-primary/5 px-3 rounded-lg">
                          <span className="font-semibold text-base">Total Amount:</span>
                          <span className="font-bold text-xl text-primary">₹{total.toFixed(2)}</span>
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
            <div className="flex justify-end space-x-3 p-4 border-t bg-background">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="min-w-[140px]">
                {loading ? 'Saving...' : (mode === 'edit' ? 'Update Order' : 'Create Order')}
              </Button>
            </div>
          )}
        </form>
      </Form>
    </div>
  );
}