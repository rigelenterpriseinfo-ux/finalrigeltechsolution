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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, Search, ChevronDown, ChevronRight, Building, MapPin, Info, AlertTriangle, CheckCircle2, RadioIcon, ShoppingCart, FileText, Warehouse, Package } from 'lucide-react';
import { OrderLineItemsTable } from '@/components/ui/order-line-items-table';
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
  payment_terms: z.string().min(1, 'Payment terms are required'),
  expected_date: z.string().min(1, 'Expected date is required'),
  place_of_supply: z.string().optional(),
  warehouse_id: z.string().min(1, 'Warehouse is required'),
  bin_id: z.string().min(1, 'Bin is required'),
  same_as_registered_address: z.boolean().default(false),
  delivery_address_line1: z.string().min(1, 'Address line 1 is required'),
  delivery_address_line2: z.string().optional(),
  delivery_city: z.string().min(1, 'City is required'),
  delivery_state: z.string().min(1, 'State is required'),
  delivery_country: z.string().min(1, 'Country is required'),
  delivery_postal_code: z.string().min(1, 'Postal code is required'),
  delivery_place_of_supply: z.string().min(1, 'Place of supply is required'),
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
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [bins, setBins] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('order-info');
  const [globalGstType, setGlobalGstType] = useState<'intra' | 'inter'>('intra');

  // Transform purchase_order_items to the expected form structure
  const transformPurchaseOrderItems = (purchaseOrderItems: any[] = []) => {
    if (!Array.isArray(purchaseOrderItems)) {
      return [];
    }
    
    return purchaseOrderItems.map(item => ({
      product_id: item.product_id || '',
      product_name: item.product_name || '',
      item_code: item.item_code || '',
      hsn_sac_code: item.hsn_sac_code || '',
      quantity: item.quantity || 1,
      unit_of_measure: item.unit_of_measure || 'pcs',
      unit_price: item.unit_price || 0,
      discount_percentage: item.discount_percentage || 0,
      discount_amount: item.discount_amount || 0,
      cgst_rate: item.cgst_rate || 0,
      sgst_rate: item.sgst_rate || 0,
      igst_rate: item.igst_rate || 0,
      cgst_amount: item.cgst_amount || 0,
      sgst_amount: item.sgst_amount || 0,
      igst_amount: item.igst_amount || 0,
      line_subtotal: item.line_subtotal || 0,
      line_total: item.line_total || 0,
      gst_type: item.gst_type || 'intra',
      master_gst_rate: item.master_gst_rate || 0
    }));
  };

  const form = useForm<PurchaseOrderFormData>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      po_number: purchaseOrder?.po_number || '',
      supplier_id: purchaseOrder?.supplier_id || '',
      order_date: purchaseOrder?.order_date || new Date().toISOString().split('T')[0],
      currency: purchaseOrder?.currency || 'INR',
      payment_terms: purchaseOrder?.payment_terms || '',
      place_of_supply: purchaseOrder?.company_place_of_supply || '',
      warehouse_id: purchaseOrder?.warehouse_id || '',
      bin_id: purchaseOrder?.bin_id || '',
      same_as_registered_address: purchaseOrder?.same_as_registered_address || false,
      delivery_address_line1: purchaseOrder?.delivery_address_line1 || '',
      delivery_address_line2: purchaseOrder?.delivery_address_line2 || '',
      delivery_city: purchaseOrder?.delivery_city || '',
      delivery_state: purchaseOrder?.delivery_state || '',
      delivery_country: purchaseOrder?.delivery_country || '',
      delivery_postal_code: purchaseOrder?.delivery_postal_code || '',
      expected_date: purchaseOrder?.expected_date || '',
      status: purchaseOrder?.status || 'Draft',
      notes: purchaseOrder?.notes || '',
      items: transformPurchaseOrderItems(purchaseOrder?.purchase_order_items),
    },
  });

  const fieldsArray = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const { fields, append, remove } = fieldsArray;

  useEffect(() => {
    const fetchData = async () => {
      if (!profile?.company_id) return;

      setLoading(true);
      try {
        const [suppliersRes, productsRes, companyRes, warehousesRes] = await Promise.all([
          supabase
            .from('suppliers')
            .select('*')
            .eq('company_id', profile.company_id)
            .eq('is_active', true),
          supabase
            .from('products')
            .select('*')
            .eq('company_id', profile.company_id)
            .eq('is_active', true),
          supabase
            .from('companies')
            .select('*')
            .eq('id', profile.company_id)
            .single(),
          supabase
            .from('warehouse_bins')
            .select('*')
            .eq('company_id', profile.company_id)
            .eq('is_active', true)
            .order('warehouse_name', { ascending: true })
        ]);

        if (suppliersRes.data) setSuppliers(suppliersRes.data);
        if (productsRes.data) setProducts(productsRes.data);
        if (companyRes.data) setCompanyData(companyRes.data);
        if (warehousesRes.data) {
          setWarehouses(warehousesRes.data);
          // Extract unique bins for the bin dropdown
          setBins(warehousesRes.data);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch data',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile?.company_id, toast]);

  const handleProductSelect = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      form.setValue(`items.${index}.product_id`, productId);
      form.setValue(`items.${index}.product_name`, product.name);
      form.setValue(`items.${index}.item_code`, product.sku || '');
      form.setValue(`items.${index}.hsn_sac_code`, product.hsn_sac_code || '');
      form.setValue(`items.${index}.unit_price`, product.unit_price || 0);
      form.setValue(`items.${index}.unit_of_measure`, product.unit_of_measure || 'pcs');
      form.setValue(`items.${index}.master_gst_rate`, product.gst_percentage || 0);
      form.setValue(`items.${index}.gst_type`, globalGstType);

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

      calculateLineAmounts(index);
    }
  };

  const calculateLineAmounts = (index: number) => {
    const quantity = form.getValues(`items.${index}.quantity`) || 0;
    const unitPrice = form.getValues(`items.${index}.unit_price`) || 0;
    const discountPercentage = form.getValues(`items.${index}.discount_percentage`) || 0;
    const discountAmount = form.getValues(`items.${index}.discount_amount`) || 0;
    const cgstRate = form.getValues(`items.${index}.cgst_rate`) || 0;
    const sgstRate = form.getValues(`items.${index}.sgst_rate`) || 0;
    const igstRate = form.getValues(`items.${index}.igst_rate`) || 0;

    const lineAmount = quantity * unitPrice;
    
    // Calculate discount
    let totalDiscount = 0;
    if (discountPercentage > 0) {
      totalDiscount = (lineAmount * discountPercentage) / 100;
      form.setValue(`items.${index}.discount_amount`, totalDiscount);
    } else if (discountAmount > 0) {
      totalDiscount = discountAmount;
    }

    const lineSubtotal = lineAmount - totalDiscount;

    // Calculate tax amounts
    const cgstAmount = (lineSubtotal * cgstRate) / 100;
    const sgstAmount = (lineSubtotal * sgstRate) / 100;
    const igstAmount = (lineSubtotal * igstRate) / 100;

    const lineTotal = lineSubtotal + cgstAmount + sgstAmount + igstAmount;

    // Update form values
    form.setValue(`items.${index}.line_subtotal`, lineSubtotal);
    form.setValue(`items.${index}.cgst_amount`, cgstAmount);
    form.setValue(`items.${index}.sgst_amount`, sgstAmount);
    form.setValue(`items.${index}.igst_amount`, igstAmount);
    form.setValue(`items.${index}.line_total`, lineTotal);
  };

  const validateGSTRate = (index: number, type: string, rate: number): boolean => {
    const masterGST = form.getValues(`items.${index}.master_gst_rate`) || 0;
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

  const addItem = () => {
    append({
      product_id: '',
      product_name: '',
      item_code: '',
      hsn_sac_code: '',
      quantity: 0,
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
      gst_type: globalGstType,
      master_gst_rate: 0,
    });
  };

  const handleGlobalGstTypeChange = (newGstType: 'intra' | 'inter') => {
    setGlobalGstType(newGstType);
    
    // Update all existing items to the new GST type
    fields.forEach((_, index) => {
      const masterGST = form.getValues(`items.${index}.master_gst_rate`) || 0;
      form.setValue(`items.${index}.gst_type`, newGstType);
      
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

  const handleSubmit = async (data: PurchaseOrderFormData) => {
    setLoading(true);
    try {
      console.log('Form submission started with data:', data);
      
      // Calculate totals from form data
      const items = data.items || [];
      console.log('Items from form:', items);
      
      const calculatedSubtotal = items.reduce((sum, item) => sum + (item.line_subtotal || 0), 0);
      const calculatedTotalDiscount = items.reduce((sum, item) => sum + (item.discount_amount || 0), 0);
      const calculatedTotalTax = items.reduce((sum, item) => sum + (item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0), 0);
      const calculatedTotal = items.reduce((sum, item) => sum + (item.line_total || 0), 0);

      console.log('Calculated totals:', {
        subtotal: calculatedSubtotal,
        discount: calculatedTotalDiscount,
        tax: calculatedTotalTax,
        total: calculatedTotal
      });

      // Map place_of_supply to company_place_of_supply for database and include calculated totals
      const mappedData = {
        ...data,
        company_place_of_supply: data.place_of_supply,
        subtotal_amount: calculatedSubtotal,
        total_discount_amount: calculatedTotalDiscount,
        total_tax_amount: calculatedTotalTax,
        total_amount: calculatedTotal,
      };
      delete mappedData.place_of_supply;
      
      console.log('Mapped data before submission:', mappedData);
      
      await onSubmit(mappedData);
      
      toast({
        title: 'Success',
        description: `Purchase Order ${mode === 'edit' ? 'updated' : 'created'} successfully`,
      });
      
      onCancel();
    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        title: 'Error',
        description: `Failed to ${mode === 'edit' ? 'update' : 'create'} Purchase Order. ${error instanceof Error ? error.message : ''}`,
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
            <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted/30 h-12">
              <TabsTrigger value="order-info" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2">
                <Building className="h-4 w-4" />
                {(() => {
                  const selectedSupplierId = form.watch('supplier_id');
                  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);
                  return selectedSupplier ? `Order Info (${selectedSupplier.name})` : 'Order Info';
                })()}
              </TabsTrigger>
              <TabsTrigger value="items" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Items & Summary ({fields.length})
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
                                Supplier <span className="text-red-500">*</span>
                              </FormLabel>
                              <FormControl>
                                <SearchableCombobox
                                  value={field.value}
                                  onSelect={field.onChange}
                                  placeholder="Select supplier"
                                  searchPlaceholder="Search suppliers..."
                                   options={suppliers.map(supplier => ({
                                     id: supplier.id,
                                     name: supplier.name,
                                     subtitle: supplier.supplier_ref ? `Ref: ${supplier.supplier_ref}` : undefined
                                   }))}
                                  disabled={readOnly}
                                  loading={loading}
                                />
                              </FormControl>
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
                                  Order Date <span className="text-red-500">*</span>
                                </FormLabel>
                                <FormControl>
                                  <Input 
                                    type="date" 
                                    {...field} 
                                    disabled={readOnly} 
                                    className="h-9" 
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
                                <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                  Expected Date <span className="text-red-500">*</span>
                                </FormLabel>
                                <FormControl>
                                  <Input 
                                    type="date" 
                                    {...field} 
                                    disabled={readOnly} 
                                    className="h-9" 
                                  />
                                </FormControl>
                                <FormMessage />
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
                                <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                  Currency <span className="text-red-500">*</span>
                                </FormLabel>
                                <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                                  <FormControl>
                                    <SelectTrigger className="h-9">
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
                            name="status"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                  Status <span className="text-red-500">*</span>
                                </FormLabel>
                                <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                                  <FormControl>
                                    <SelectTrigger className="h-9">
                                      <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="Draft">Draft</SelectItem>
                                    <SelectItem value="Pending">Pending</SelectItem>
                                    <SelectItem value="Approved">Approved</SelectItem>
                                    <SelectItem value="Cancelled">Cancelled</SelectItem>
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
                              <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Payment Terms <span className="text-red-500">*</span>
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="e.g., Net 30 days" 
                                  {...field} 
                                  disabled={readOnly} 
                                  className="h-9" 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-3">
                          <FormField
                            control={form.control}
                            name="warehouse_id"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                  Default Warehouse <span className="text-red-500">*</span>
                                </FormLabel>
                                <FormControl>
                                  <SearchableCombobox
                                    value={field.value}
                                    onSelect={field.onChange}
                                    placeholder="Select warehouse"
                                    searchPlaceholder="Search warehouses..."
                                    options={warehouses.map(warehouse => ({
                                      id: warehouse.id,
                                      name: warehouse.warehouse_name || warehouse.wh_bin_code,
                                      subtitle: warehouse.warehouse_code ? `Code: ${warehouse.warehouse_code}` : undefined
                                    }))}
                                    disabled={readOnly}
                                    loading={loading}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="bin_id"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                  Default Bin <span className="text-red-500">*</span>
                                </FormLabel>
                                <FormControl>
                                  <SearchableCombobox
                                    value={field.value}
                                    onSelect={field.onChange}
                                    placeholder="Select bin"
                                    searchPlaceholder="Search bins..."
                                    options={bins.map(bin => ({
                                      id: bin.id,
                                      name: bin.bin_name,
                                      subtitle: bin.wh_bin_code ? `Code: ${bin.wh_bin_code}` : undefined
                                    }))}
                                    disabled={readOnly}
                                    loading={loading}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Additional notes..." 
                                  className="resize-none" 
                                  rows={3}
                                  {...field} 
                                  disabled={readOnly}
                                />
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
                          id="same_as_registered_address"
                          checked={sameAsRegisteredAddress}
                          onCheckedChange={handleSameAsRegisteredAddressChange}
                          disabled={readOnly}
                        />
                        <FormLabel 
                          htmlFor="same_as_registered_address" 
                          className="text-sm font-normal cursor-pointer"
                        >
                          Same as registered address
                        </FormLabel>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        <FormField
                          control={form.control}
                          name="delivery_address_line1"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Address Line 1 <span className="text-red-500">*</span>
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Street address" 
                                  {...field} 
                                  disabled={readOnly || sameAsRegisteredAddress} 
                                  className="h-9" 
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

                        <div className="grid grid-cols-2 gap-3">
                          <FormField
                            control={form.control}
                            name="delivery_city"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                  City <span className="text-red-500">*</span>
                                </FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="City" 
                                    {...field} 
                                    disabled={readOnly || sameAsRegisteredAddress} 
                                    className="h-9" 
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
                                <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                  State <span className="text-red-500">*</span>
                                </FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="State" 
                                    {...field} 
                                    disabled={readOnly || sameAsRegisteredAddress} 
                                    className="h-9" 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="delivery_country"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Country <span className="text-red-500">*</span>
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Country" 
                                  {...field} 
                                  disabled={readOnly || sameAsRegisteredAddress} 
                                  className="h-9" 
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
                              <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Postal Code <span className="text-red-500">*</span>
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="PIN Code" 
                                  {...field} 
                                  disabled={readOnly || sameAsRegisteredAddress} 
                                  className="h-9" 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="delivery_place_of_supply"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Place of Supply <span className="text-red-500">*</span>
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Place of Supply" 
                                  {...field} 
                                  disabled={readOnly} 
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
                </div>

              </TabsContent>

              {/* Items Tab */}
              <TabsContent value="items" className="flex-1 overflow-auto m-0">
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

                {/* Order Summary */}
                <Card className="mt-4 shadow-sm border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      Order Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-muted/20 rounded-lg">
                        <div className="text-2xl font-bold text-primary">₹{subtotal.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">Subtotal</div>
                      </div>
                      <div className="text-center p-3 bg-muted/20 rounded-lg">
                        <div className="text-2xl font-bold text-orange-600">₹{totalDiscount.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">Total Discount</div>
                      </div>
                      <div className="text-center p-3 bg-muted/20 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">₹{totalTax.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">Total Tax</div>
                      </div>
                      <div className="text-center p-3 bg-primary text-primary-foreground rounded-lg">
                        <div className="text-2xl font-bold">₹{total.toFixed(2)}</div>
                        <div className="text-xs opacity-90">Grand Total</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 px-4 py-3 border-t bg-card/50 backdrop-blur-sm">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            {!readOnly && (
              <Button type="submit" disabled={loading} className="min-w-[120px]">
                {loading ? 'Saving...' : mode === 'edit' ? 'Next' : 'Create Order'}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
