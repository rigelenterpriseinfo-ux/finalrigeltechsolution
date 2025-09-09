import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { 
  CalendarIcon, 
  Plus, 
  Trash2, 
  FileText, 
  Package, 
  Warehouse, 
  Calculator, 
  ClipboardCheck, 
  Building, 
  CheckCircle2, 
  AlertTriangle,
  Info,
  MapPin,
  ShoppingCart
} from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const grnFormSchema = z.object({
  purchase_order_id: z.string().min(1, 'Please select a purchase order'),
  supplier_id: z.string().min(1, 'Supplier is required'),
  supplier_name: z.string().min(1, 'Supplier name is required'),
  grn_reference_no: z.string().optional(),
  grn_date: z.string().min(1, 'GRN date is required'),
  supplier_invoice_number: z.string().optional(),
  supplier_invoice_date: z.string().optional(),
  remarks: z.string().optional(),
  status: z.enum(['draft', 'received', 'accepted']),
  // Consolidated warehouse & bin at form level
  default_warehouse_id: z.string().min(1, 'Default warehouse is required'),
  default_bin_id: z.string().min(1, 'Default bin is required'),
  items: z.array(z.object({
    product_id: z.string().min(1, 'Product is required'),
    product_name: z.string(),
    product_sku: z.string().optional(),
    unit_of_measure: z.string().optional(),
    ordered_quantity: z.number().min(0),
    received_quantity: z.number().min(0, 'Received quantity is required'),
    accepted_quantity: z.number().min(0, 'Accepted quantity is required'),
    rejected_quantity: z.number().min(0, 'Rejected quantity is required'),
    unit_price: z.number().min(0.01, 'Unit price must be greater than 0'),
    discount_percentage: z.number().min(0).max(100).optional(),
    discount_amount: z.number().min(0).optional(),
    warehouse_id: z.string().optional(),
    bin_id: z.string().optional(),
    hsn_sac_code: z.string().optional(),
    cgst_rate: z.number().min(0).optional(),
    cgst_amount: z.number().min(0).optional(),
    sgst_rate: z.number().min(0).optional(),
    sgst_amount: z.number().min(0).optional(),
    igst_rate: z.number().min(0).optional(),
    igst_amount: z.number().min(0).optional(),
    total_tax_amount: z.number().min(0).optional(),
    line_total: z.number().min(0).optional(),
  })).min(1, 'At least one item is required'),
});

interface GRNFormProps {
  grn?: any;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  readOnly?: boolean;
  mode: 'create' | 'edit' | 'view';
}

export function GRNForm({ grn, onSubmit, onCancel, readOnly = false, mode }: GRNFormProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [bins, setBins] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('grn-info');

  const form = useForm<z.infer<typeof grnFormSchema>>({
    resolver: zodResolver(grnFormSchema),
    defaultValues: {
      purchase_order_id: grn?.purchase_order_id || '',
      supplier_id: grn?.supplier_id || '',
      supplier_name: grn?.supplier_name || '',
      grn_reference_no: grn?.grn_reference_no || '',
      grn_date: grn?.grn_date ? new Date(grn.grn_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      supplier_invoice_number: grn?.supplier_invoice_number || '',
      supplier_invoice_date: grn?.supplier_invoice_date ? new Date(grn.supplier_invoice_date).toISOString().split('T')[0] : null,
      remarks: grn?.remarks || '',
      status: grn?.status || 'accepted',
      default_warehouse_id: '',
      default_bin_id: '',
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
        hsn_sac_code: item.hsn_sac_code,
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

  useEffect(() => {
    if (profile?.company_id) {
      fetchPurchaseOrders();
      fetchSuppliers();
      fetchProducts();
      fetchWarehouses();
      fetchBins();
    }
  }, [profile?.company_id]);

  const fetchPurchaseOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          supplier:suppliers(name),
          purchase_order_items(
            *,
            product:products(name, sku)
          )
        `)
        .eq('company_id', profile?.company_id)
        .in('status', ['open', 'partially_received'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPurchaseOrders(data || []);
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
    }
  };

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
        .select('id, warehouse_name, warehouse_code')
        .eq('company_id', profile?.company_id)
        .order('warehouse_name');

      if (error) throw error;
      // Group by warehouse_name to avoid duplicates
      const uniqueWarehouses = data?.reduce((acc: any[], curr) => {
        const existing = acc.find(w => w.warehouse_name === curr.warehouse_name);
        if (!existing) {
          acc.push({
            id: curr.id,
            name: curr.warehouse_name,
            warehouse_code: curr.warehouse_code
          });
        }
        return acc;
      }, []) || [];
      setWarehouses(uniqueWarehouses);
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    }
  };

  const fetchBins = async () => {
    try {
      const { data, error } = await supabase
        .from('warehouse_bins')
        .select('*')
        .eq('company_id', profile?.company_id)
        .order('wh_bin_code');

      if (error) throw error;
      setBins(data || []);
    } catch (error) {
      console.error('Error fetching bins:', error);
    }
  };

  const handlePOSelection = (poId: string) => {
    const po = purchaseOrders.find(p => p.id === poId);
    if (!po) return;

    setSelectedPO(po);
    
    // Auto-fill supplier details
    form.setValue('supplier_id', po.supplier_id);
    form.setValue('supplier_name', po.supplier?.name || '');
    
    // Auto-fill items from PO with pending quantities
    const items = po.purchase_order_items?.map((item: any) => ({
      product_id: item.product_id,
      product_name: item.product?.name || item.item_description || 'Unknown Product',
      product_sku: item.product?.sku || item.item_code || '',
      unit_of_measure: item.unit_of_measure || '',
      ordered_quantity: item.quantity,
      received_quantity: item.pending_quantity, // Set to pending quantity initially
      accepted_quantity: 0, // Will be set based on status
      rejected_quantity: 0,
      unit_price: item.unit_price,
      discount_percentage: item.discount_percentage || 0,
      discount_amount: item.discount_amount || 0,
      warehouse_id: form.getValues('default_warehouse_id') || '',
      bin_id: form.getValues('default_bin_id') || '',
      hsn_sac_code: item.hsn_sac_code || '',
      cgst_rate: item.cgst_rate || 0,
      cgst_amount: 0,
      sgst_rate: item.sgst_rate || 0,
      sgst_amount: 0,
      igst_rate: item.igst_rate || 0,
      igst_amount: 0,
      total_tax_amount: 0,
      line_total: 0,
    })) || [];
    
    form.setValue('items', items);
    
    // Normalize tax rates and calculate totals for each item
    items.forEach((item, index) => {
      // Clear CGST/SGST if IGST > 0, or clear IGST if CGST/SGST > 0
      if (item.igst_rate && item.igst_rate > 0) {
        form.setValue(`items.${index}.cgst_rate`, 0);
        form.setValue(`items.${index}.sgst_rate`, 0);
      } else if ((item.cgst_rate && item.cgst_rate > 0) || (item.sgst_rate && item.sgst_rate > 0)) {
        form.setValue(`items.${index}.igst_rate`, 0);
      }
    });
    
    // Apply status-based logic to accepted quantities
    const currentStatus = form.getValues('status');
    handleStatusChange(currentStatus);
    
    // Calculate totals for all items after setting them
    items.forEach((_, index) => {
      calculateItemTotals(index);
    });
  };

  const handleStatusChange = (status: string) => {
    const currentItems = form.getValues('items');
    
    const updatedItems = currentItems.map((item, index) => {
      if (status === 'accepted' || status === 'received') {
        // For "Accepted/Received" status, set accepted_quantity = received_quantity (full receipt)
        const updated = {
          ...item,
          accepted_quantity: item.received_quantity,
          rejected_quantity: 0,
        };
        
        // Normalize tax rates for this item
        if (updated.igst_rate && updated.igst_rate > 0) {
          updated.cgst_rate = 0;
          updated.sgst_rate = 0;
        } else if ((updated.cgst_rate && updated.cgst_rate > 0) || (updated.sgst_rate && updated.sgst_rate > 0)) {
          updated.igst_rate = 0;
        }
        
        return updated;
      }
      return item;
    });
    
    form.setValue('items', updatedItems);
    form.setValue('status', (status === 'received' ? 'accepted' : status) as any);
    
    // Calculate totals for all items after status change
    updatedItems.forEach((_, index) => {
      calculateItemTotals(index);
    });
  };

  const calculateItemTotals = (index: number) => {
    const items = form.getValues('items');
    const item = items[index];
    
    if (!item) return;

    const subtotal = (item.accepted_quantity || 0) * (item.unit_price || 0);
    const discountAmount = item.discount_amount ?? ((item.discount_percentage || 0) * subtotal / 100);
    const afterDiscount = subtotal - discountAmount;
    
    // GST Logic: Either CGST+SGST OR IGST, but not both
    let cgstAmount = 0;
    let sgstAmount = 0; 
    let igstAmount = 0;
    
    if (item.igst_rate && item.igst_rate > 0) {
      // If IGST is provided, use only IGST
      igstAmount = (item.igst_rate || 0) * afterDiscount / 100;
      // Clear CGST/SGST rates if IGST is used
      form.setValue(`items.${index}.cgst_rate`, 0);
      form.setValue(`items.${index}.sgst_rate`, 0);
    } else if ((item.cgst_rate && item.cgst_rate > 0) || (item.sgst_rate && item.sgst_rate > 0)) {
      // If CGST or SGST is provided, use CGST+SGST
      cgstAmount = (item.cgst_rate || 0) * afterDiscount / 100;
      sgstAmount = (item.sgst_rate || 0) * afterDiscount / 100;
      // Clear IGST rate if CGST/SGST is used
      form.setValue(`items.${index}.igst_rate`, 0);
    }
    
    const totalTaxAmount = cgstAmount + sgstAmount + igstAmount;
    const lineTotal = afterDiscount + totalTaxAmount;

    // Update the form values, coerce NaN to 0
    form.setValue(`items.${index}.discount_amount`, isNaN(discountAmount) ? 0 : discountAmount);
    form.setValue(`items.${index}.cgst_amount`, isNaN(cgstAmount) ? 0 : cgstAmount);
    form.setValue(`items.${index}.sgst_amount`, isNaN(sgstAmount) ? 0 : sgstAmount);
    form.setValue(`items.${index}.igst_amount`, isNaN(igstAmount) ? 0 : igstAmount);
    form.setValue(`items.${index}.total_tax_amount`, isNaN(totalTaxAmount) ? 0 : totalTaxAmount);
    form.setValue(`items.${index}.line_total`, isNaN(lineTotal) ? 0 : lineTotal);
  };

  // Apply default warehouse/bin to all items
  const applyDefaultWarehouseBin = () => {
    const defaultWarehouseId = form.getValues('default_warehouse_id');
    const defaultBinId = form.getValues('default_bin_id');
    const items = form.getValues('items');
    
    console.log('Applying default warehouse/bin:', { defaultWarehouseId, defaultBinId, itemsCount: items?.length });
    
    if (defaultWarehouseId && defaultBinId) {
      const updatedItems = items.map(item => ({
        ...item,
        warehouse_id: defaultWarehouseId,
        bin_id: defaultBinId
      }));
      form.setValue('items', updatedItems);
      console.log('Updated items with warehouse/bin:', updatedItems.map(i => ({ 
        name: i.product_name, 
        warehouse_id: i.warehouse_id, 
        bin_id: i.bin_id 
      })));
    }
  };

  // Validation function for all mandatory fields
  const validateAllFields = () => {
    const items = form.getValues('items');
    const defaultWarehouse = form.getValues('default_warehouse_id');
    const defaultBin = form.getValues('default_bin_id');
    let hasErrors = false;

    // Check default warehouse and bin
    if (!defaultWarehouse) {
      form.setError('default_warehouse_id', {
        type: 'manual',
        message: 'Default warehouse is required'
      });
      hasErrors = true;
    }

    if (!defaultBin) {
      form.setError('default_bin_id', {
        type: 'manual',
        message: 'Default bin is required'
      });
      hasErrors = true;
    }

    items.forEach((item, index) => {
      // Check unit price
      if (!item.unit_price || item.unit_price <= 0) {
        form.setError(`items.${index}.unit_price`, {
          type: 'manual',
          message: 'Valid unit price is required'
        });
        hasErrors = true;
      }

      // Validate quantities
      if (!validateQuantities(index)) {
        hasErrors = true;
      }
    });

    return !hasErrors;
  };

  // Helper function to sanitize date values
  const sanitizeDateValue = (dateValue: string | null | undefined): string | null => {
    if (!dateValue || dateValue === '') {
      return null;
    }
    return dateValue;
  };

  const handleSubmit = async (data: z.infer<typeof grnFormSchema>) => {
    if (readOnly) return;
    
    // Validate all mandatory fields
    if (!validateAllFields()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all mandatory fields and fix any errors before submitting.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setLoading(true);
      // Sanitize date fields before submitting
      const sanitizedData = {
        ...data,
        supplier_invoice_date: sanitizeDateValue(data.supplier_invoice_date),
      };
      await onSubmit(sanitizedData);
    } catch (error) {
      console.error('Error submitting GRN:', error);
      toast({
        title: "Error",
        description: "Failed to save GRN",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Validation function for quantities
  // Calculate pending quantity for an item
  const calculatePendingQty = (orderedQty: number, receivedQty: number) => {
    return Math.max(0, orderedQty - receivedQty);
  };

  // Determine GST type based on Purchase Order items
  const determineGstType = () => {
    if (!selectedPO?.purchase_order_items) return 'intra';
    const hasIGST = selectedPO.purchase_order_items.some((item: any) => (item.igst_rate || 0) > 0);
    return hasIGST ? 'inter' : 'intra';
  };

  const gstType = determineGstType();
  const shouldShowCGSTSGST = gstType === 'intra';
  const shouldShowIGST = gstType === 'inter';

  // Enhanced validation for received quantity
  const validateReceivedQuantity = (index: number, newValue: number) => {
    const items = form.getValues('items');
    const item = items[index];
    const pendingQty = calculatePendingQty(item.ordered_quantity, 0);
    
    // Validation rules
    if (newValue < 0) return 0;
    if (newValue > pendingQty) return pendingQty;
    
    return newValue;
  };

  const validateQuantities = (index: number) => {
    const items = form.getValues('items');
    const item = items[index];
    
    const pendingQty = calculatePendingQty(item.ordered_quantity, 0);
    
    // Received quantity cannot exceed pending quantity or be negative
    if (item.received_quantity < 0) {
      form.setError(`items.${index}.received_quantity`, {
        type: 'manual',
        message: 'Received quantity cannot be negative'
      });
      return false;
    }
    
    if (item.received_quantity > pendingQty) {
      form.setError(`items.${index}.received_quantity`, {
        type: 'manual',
        message: 'Received quantity cannot exceed pending quantity'
      });
      return false;
    }
    
    // Accepted + Rejected cannot exceed received quantity
    const totalProcessed = item.accepted_quantity + item.rejected_quantity;
    if (totalProcessed > item.received_quantity) {
      form.setError(`items.${index}.accepted_quantity`, {
        type: 'manual',
        message: 'Accepted + Rejected quantity cannot exceed received quantity'
      });
      return false;
    }
    
    return true;
  };

  // Calculate summary totals
  const calculateSummary = () => {
    const items = form.getValues('items') || [];
    return items.reduce((acc, item) => {
      return {
        totalOrdered: acc.totalOrdered + (item.ordered_quantity || 0),
        totalReceived: acc.totalReceived + (item.received_quantity || 0),
        totalAccepted: acc.totalAccepted + (item.accepted_quantity || 0),
        totalRejected: acc.totalRejected + (item.rejected_quantity || 0),
        totalPending: acc.totalPending + ((item.ordered_quantity || 0) - (item.received_quantity || 0)),
        totalAmount: acc.totalAmount + (item.line_total || 0),
      };
    }, {
      totalOrdered: 0,
      totalReceived: 0,
      totalAccepted: 0,
      totalRejected: 0,
      totalPending: 0,
      totalAmount: 0,
    });
  };

  const summary = calculateSummary();
  
  // Calculate totals for display
  const items = form.watch('items') || [];
  const total = items.reduce((sum, item) => sum + (item.line_total || 0), 0);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-background">
      {/* Compact Header */}
      <div className="flex justify-between items-center mb-3 px-4 py-3 border-b bg-card/50 backdrop-blur-sm">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {mode === 'create' ? 'New GRN' : 
             mode === 'edit' ? 'Edit GRN' : 'GRN Details'}
          </h1>
          {grn?.grn_reference_no && (
            <p className="text-sm text-muted-foreground">GRN: {grn.grn_reference_no}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={readOnly ? "secondary" : "default"} className="text-xs px-2">
            {readOnly ? 'View Only' : (mode === 'edit' ? 'Edit' : 'Create')}
          </Badge>
          {items.length > 0 && (
            <div className="text-right text-sm bg-primary/10 px-3 py-2 rounded-lg border">
              <div className="font-bold text-primary text-lg">₹{total.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">{items.length} items</div>
            </div>
          )}
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="flex-1 flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col px-2">
            <TabsList className="grid w-full grid-cols-2 mb-2 bg-muted/30 h-10">
              <TabsTrigger value="grn-info" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4" />
                <span className="truncate">
                  GRN Info
                  {form.watch('supplier_name') && ` (${form.watch('supplier_name')})`}
                  {selectedPO?.po_number && ` (${selectedPO.po_number})`}
                </span>
              </TabsTrigger>
              <TabsTrigger value="items" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2 text-sm">
                <Package className="h-4 w-4" />
                Items ({items.length})
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden">
              {/* GRN Info Tab */}
              <TabsContent value="grn-info" className="flex-1 overflow-auto space-y-3 m-0">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  {/* GRN Reference Card */}
                  <Card className="shadow-sm border-border/50 lg:col-span-3">
                    <CardContent className="pt-3 pb-3">
                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 border border-purple-200 rounded-lg p-3">
                        <FormField
                          control={form.control}
                          name="grn_reference_no"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-purple-700 dark:text-purple-300 font-semibold flex items-center gap-2 text-sm">
                                <FileText className="h-4 w-4" />
                                GRN Reference Number
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  disabled 
                                  placeholder="Auto-generated on save"
                                  className="bg-purple-100/50 dark:bg-purple-900/30 border-purple-200 text-purple-800 dark:text-purple-200 font-medium text-center h-8"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Purchase Order Details */}
                  <Card className="shadow-sm border-border/50">
                    <CardHeader className="pb-2 pt-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4 text-primary" />
                        Purchase Order Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      <FormField
                        control={form.control}
                        name="purchase_order_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Purchase Order</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={(value) => {
                                field.onChange(value);
                                handlePOSelection(value);
                              }}
                              disabled={readOnly || mode === 'edit'}
                            >
                              <FormControl>
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Select purchase order" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {purchaseOrders.filter(po => po.id && po.id.trim() !== '').map((po) => (
                                  <SelectItem key={po.id} value={po.id}>
                                    <div className="flex flex-col">
                                      <span className="font-medium text-sm">{po.po_number || 'N/A'}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {po.supplier?.name || 'Unknown Supplier'} | ₹{po.total_amount?.toLocaleString() || '0'}
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

                      <FormField
                        control={form.control}
                        name="supplier_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Supplier Name</FormLabel>
                            <FormControl>
                              <Input {...field} disabled className="h-8 bg-muted/30" />
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
                            <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={(value) => {
                                field.onChange(value);
                                handleStatusChange(value);
                              }}
                              disabled={readOnly}
                            >
                              <FormControl>
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="accepted">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    Accepted
                                  </div>
                                </SelectItem>
                                <SelectItem value="received">
                                  <div className="flex items-center gap-2">
                                    <Package className="h-4 w-4 text-blue-500" />
                                    Received
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

                  {/* Dates & Invoice Details */}
                  <Card className="shadow-sm border-border/50">
                    <CardHeader className="pb-2 pt-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 text-primary" />
                        Dates & Invoice Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      <FormField
                        control={form.control}
                        name="grn_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">GRN Date</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                disabled={readOnly}
                                className="h-8"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="supplier_invoice_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Supplier Invoice Number</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={readOnly} className="h-8" />
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
                            <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Supplier Invoice Date</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                disabled={readOnly}
                                className="h-8"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  {/* Remarks */}
                  <Card className="shadow-sm border-border/50">
                    <CardHeader className="pb-2 pt-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Info className="h-4 w-4 text-primary" />
                        Additional Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <FormField
                        control={form.control}
                        name="remarks"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Remarks</FormLabel>
                            <FormControl>
                              <Textarea {...field} disabled={readOnly} className="min-h-[60px]" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                     </CardContent>
                   </Card>
                 </div>
               </TabsContent>

              {/* Items Tab */}
              <TabsContent value="items" className="flex-1 overflow-auto m-0">
                <Card className="shadow-sm border-border/50">
                  <CardHeader className="pb-2 pt-3">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Package className="h-4 w-4 text-primary" />
                        GRN Items
                      </CardTitle>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="text-xs">
                          {items.length} Items
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {items.length > 0 ? (
                      <div className="space-y-4">
                        {/* Default Warehouse & Bin Selection */}
                        <div className="bg-green-100 dark:bg-green-900/20 p-3 border-b">
                          <div className="grid grid-cols-2 gap-3">
                            {/* Default Warehouse */}
                            <div className="space-y-1">
                              <FormField
                                control={form.control}
                                name="default_warehouse_id"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs font-medium text-green-800 dark:text-green-200">
                                      DEFAULT WAREHOUSE
                                    </FormLabel>
                                    <Select
                                      onValueChange={(value) => {
                                        field.onChange(value);
                                        applyDefaultWarehouseBin();
                                      }}
                                      value={field.value}
                                      disabled={readOnly}
                                    >
                                      <FormControl>
                                        <SelectTrigger className="bg-white dark:bg-gray-800 border-green-300 focus:border-green-500 z-50 h-8">
                                          <SelectValue placeholder="Select warehouse" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent className="bg-white dark:bg-gray-800 border border-green-300 shadow-lg z-50">
                                        {warehouses.map((warehouse) => (
                                          <SelectItem key={warehouse.id} value={warehouse.id}>
                                            {warehouse.name} ({warehouse.warehouse_code || 'N/A'})
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            {/* Default Bin */}
                            <div className="space-y-1">
                              <FormField
                                control={form.control}
                                name="default_bin_id"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs font-medium text-green-800 dark:text-green-200">
                                      DEFAULT BIN
                                    </FormLabel>
                                    <Select
                                      onValueChange={(value) => {
                                        field.onChange(value);
                                        applyDefaultWarehouseBin();
                                      }}
                                      value={field.value}
                                      disabled={readOnly}
                                    >
                                      <FormControl>
                                        <SelectTrigger className="bg-white dark:bg-gray-800 border-green-300 focus:border-green-500 z-50 h-8">
                                          <SelectValue placeholder="Select bin" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent className="bg-white dark:bg-gray-800 border border-green-300 shadow-lg z-50">
                                        {bins
                                          .filter(bin => !form.getValues('default_warehouse_id') || bin.warehouse_name === warehouses.find(w => w.id === form.getValues('default_warehouse_id'))?.name)
                                          .map((bin) => (
                                            <SelectItem key={bin.id} value={bin.id}>
                                              {bin.wh_bin_code} - {bin.warehouse_name}
                                            </SelectItem>
                                          ))}
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Items Table */}
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50 border-b">
                                <TableHead className="text-left font-semibold text-foreground border-r">Product</TableHead>
                                <TableHead className="text-center font-semibold text-foreground border-r w-24">Ord Qty</TableHead>
                                <TableHead className="text-center font-semibold text-foreground border-r w-20">Pending Qty</TableHead>
                                <TableHead className="text-center font-semibold text-foreground border-r w-20">Rec Qty</TableHead>
                                <TableHead className="text-center font-semibold text-foreground border-r w-20">Acc Qty</TableHead>
                                <TableHead className="text-center font-semibold text-foreground border-r w-20">Rej Qty</TableHead>
                                <TableHead className="text-center font-semibold text-foreground border-r w-24">Unit Price</TableHead>
                                <TableHead className="text-center font-semibold text-foreground border-r w-20">Disc%</TableHead>
                                <TableHead className="text-center font-semibold text-foreground border-r w-24">Disc Value</TableHead>
                                {shouldShowCGSTSGST && (
                                  <>
                                    <TableHead className="text-center font-semibold text-foreground border-r w-20">CGST%</TableHead>
                                    <TableHead className="text-center font-semibold text-foreground border-r w-20">SGST%</TableHead>
                                  </>
                                )}
                                {shouldShowIGST && (
                                  <TableHead className="text-center font-semibold text-foreground border-r w-20">IGST%</TableHead>
                                )}
                                <TableHead className="text-center font-semibold text-foreground border-r w-24">GST Value</TableHead>
                                <TableHead className="text-right font-semibold text-foreground w-28">Line Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {items.map((item: any, index: number) => (
                                <TableRow key={index} className="hover:bg-muted/30 transition-colors border-b">
                                  {/* Product */}
                                  <TableCell className="border-r p-3">
                                    <div className="space-y-1">
                                      <div className="font-medium text-sm">{item.product_name || 'Unknown Product'}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {item.product_sku || 'N/A'} | {item.unit_of_measure || 'PCS'}
                                      </div>
                                    </div>
                                  </TableCell>
                                  
                                  {/* Ordered Qty */}
                                  <TableCell className="border-r p-3 text-center">
                                    <Input
                                      type="number"
                                      value={item.ordered_quantity || 0}
                                      disabled
                                      className="bg-muted/30 text-xs text-center h-8 w-20 border-0"
                                    />
                                  </TableCell>

                                  {/* Pending Qty */}
                                  <TableCell className="border-r p-3 text-center">
                                    <div className="text-xs text-center h-8 w-16 bg-orange-50 border border-orange-200 rounded px-2 py-1 font-medium text-orange-700 flex items-center justify-center">
                                      {calculatePendingQty(item.ordered_quantity || 0, item.received_quantity || 0)}
                                    </div>
                                  </TableCell>

                                  {/* Received Qty */}
                                  <TableCell className="border-r p-3 text-center">
                                    <Input
                                      type="number"
                                      min="0"
                                      max={calculatePendingQty(item.ordered_quantity || 0, 0)}
                                      value={item.received_quantity || 0}
                                      onChange={(e) => {
                                        const inputValue = parseFloat(e.target.value) || 0;
                                        const pendingQty = calculatePendingQty(item.ordered_quantity || 0, 0);
                                        const newValue = validateReceivedQuantity(index, inputValue);
                                        
                                        form.setValue(`items.${index}.received_quantity`, newValue);
                                        if (form.getValues('status') === 'accepted') {
                                          form.setValue(`items.${index}.accepted_quantity`, newValue);
                                          form.setValue(`items.${index}.rejected_quantity`, 0);
                                        }
                                        validateQuantities(index);
                                        calculateItemTotals(index);
                                      }}
                                      disabled={readOnly}
                                      className={cn(
                                        "text-xs text-center h-8 w-16",
                                        (item.received_quantity || 0) > calculatePendingQty(item.ordered_quantity || 0, 0) 
                                          ? "border-red-300 bg-red-50" 
                                          : "border-blue-200 focus:border-blue-400"
                                      )}
                                    />
                                  </TableCell>

                                  {/* Accepted Qty */}
                                  <TableCell className="border-r p-3 text-center">
                                    <Input
                                      type="number"
                                      min="0"
                                      value={item.accepted_quantity || 0}
                                      onChange={(e) => {
                                        const newValue = parseFloat(e.target.value) || 0;
                                        const maxAccepted = (item.received_quantity || 0) - (item.rejected_quantity || 0);
                                        const finalValue = Math.min(newValue, maxAccepted);
                                        form.setValue(`items.${index}.accepted_quantity`, finalValue);
                                        validateQuantities(index);
                                        calculateItemTotals(index);
                                      }}
                                      disabled={readOnly}
                                      className="text-xs text-center h-8 w-16 border-green-200 focus:border-green-400 bg-green-50"
                                    />
                                  </TableCell>

                                  {/* Rejected Qty */}
                                  <TableCell className="border-r p-3 text-center">
                                    <Input
                                      type="number"
                                      min="0"
                                      value={item.rejected_quantity || 0}
                                      onChange={(e) => {
                                        const newValue = parseFloat(e.target.value) || 0;
                                        const maxRejected = (item.received_quantity || 0) - (item.accepted_quantity || 0);
                                        const finalValue = Math.min(newValue, maxRejected);
                                        form.setValue(`items.${index}.rejected_quantity`, finalValue);
                                        validateQuantities(index);
                                      }}
                                      disabled={readOnly}
                                      className="text-xs text-center h-8 w-16 border-red-200 focus:border-red-400 bg-red-50"
                                    />
                                  </TableCell>

                                  {/* Unit Price */}
                                  <TableCell className="border-r p-3 text-center">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0.01"
                                      value={item.unit_price || 0}
                                      onChange={(e) => {
                                        const newPrice = parseFloat(e.target.value) || 0;
                                        form.setValue(`items.${index}.unit_price`, newPrice);
                                        calculateItemTotals(index);
                                      }}
                                      disabled={readOnly}
                                      className="text-xs text-center h-8 w-20 font-medium"
                                    />
                                  </TableCell>

                                  {/* Disc% */}
                                  <TableCell className="border-r p-3 text-center">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      max="100"
                                      value={item.discount_percentage || 0}
                                      onChange={(e) => {
                                        const percentage = parseFloat(e.target.value) || 0;
                                        form.setValue(`items.${index}.discount_percentage`, percentage);
                                        // Clear discount_amount when percentage is set
                                        form.setValue(`items.${index}.discount_amount`, 0);
                                        calculateItemTotals(index);
                                      }}
                                      disabled={readOnly}
                                      className="text-xs text-center h-8 w-16"
                                    />
                                  </TableCell>

                                  {/* Disc Value */}
                                  <TableCell className="border-r p-3 text-center">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={item.discount_amount || 0}
                                      onChange={(e) => {
                                        const amount = parseFloat(e.target.value) || 0;
                                        form.setValue(`items.${index}.discount_amount`, amount);
                                        // Clear discount_percentage when amount is set
                                        form.setValue(`items.${index}.discount_percentage`, 0);
                                        calculateItemTotals(index);
                                      }}
                                      disabled={readOnly}
                                      className="text-xs text-center h-8 w-20"
                                    />
                                  </TableCell>

                                  {/* Conditional GST Fields */}
                                  {shouldShowCGSTSGST && (
                                    <>
                                      {/* CGST% */}
                                      <TableCell className="border-r p-3 text-center">
                                        <Input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          max="100"
                                          value={item.cgst_rate || 0}
                                          onChange={(e) => {
                                            const rate = parseFloat(e.target.value) || 0;
                                            form.setValue(`items.${index}.cgst_rate`, rate);
                                            calculateItemTotals(index);
                                          }}
                                          disabled={readOnly}
                                          className="text-xs text-center h-8 w-16"
                                        />
                                      </TableCell>

                                      {/* SGST% */}
                                      <TableCell className="border-r p-3 text-center">
                                        <Input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          max="100"
                                          value={item.sgst_rate || 0}
                                          onChange={(e) => {
                                            const rate = parseFloat(e.target.value) || 0;
                                            form.setValue(`items.${index}.sgst_rate`, rate);
                                            calculateItemTotals(index);
                                          }}
                                          disabled={readOnly}
                                          className="text-xs text-center h-8 w-16"
                                        />
                                      </TableCell>
                                    </>
                                  )}

                                  {shouldShowIGST && (
                                    <>
                                      {/* IGST% */}
                                      <TableCell className="border-r p-3 text-center">
                                        <Input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          max="100"
                                          value={item.igst_rate || 0}
                                          onChange={(e) => {
                                            const rate = parseFloat(e.target.value) || 0;
                                            form.setValue(`items.${index}.igst_rate`, rate);
                                            calculateItemTotals(index);
                                          }}
                                          disabled={readOnly}
                                          className="text-xs text-center h-8 w-16"
                                        />
                                      </TableCell>
                                    </>
                                  )}

                                  {/* GST Value */}
                                  <TableCell className="border-r p-3 text-center">
                                    <div className="text-xs font-medium">
                                      ₹{((item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0)).toFixed(2)}
                                    </div>
                                  </TableCell>
                                  
                                  {/* Line Total */}
                                  <TableCell className="p-3 text-right">
                                    <div className="text-sm font-bold text-primary">
                                      ₹{(item.line_total || 0).toFixed(2)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      Tax: ₹{((item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0)).toFixed(2)}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        {/* Summary Cards */}
                        <div className="px-6 pb-6">
                          <div className="grid grid-cols-2 gap-6">
                            {/* Item Summary */}
                            <Card className="border-dashed border-2 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                                  <Package className="h-4 w-4" />
                                  Item Summary
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                <div className="flex justify-between text-sm">
                                  <span>Items Count:</span>
                                  <span className="font-medium">{items.length}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span>Total Ordered:</span>
                                  <span className="font-medium">{summary.totalOrdered.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span>Total Received:</span>
                                  <span className="font-medium text-blue-600">{summary.totalReceived.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span>Total Accepted:</span>
                                  <span className="font-medium text-green-600">{summary.totalAccepted.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span>Total Rejected:</span>
                                  <span className="font-medium text-red-600">{summary.totalRejected.toLocaleString()}</span>
                                </div>
                              </CardContent>
                            </Card>

                            {/* Order Details */}
                            <Card className="border-dashed border-2 border-green-200 bg-green-50/50 dark:bg-green-950/20">
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-semibold text-green-700 dark:text-green-400 flex items-center gap-2">
                                  <Calculator className="h-4 w-4" />
                                  Order Details
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                <div className="flex justify-between text-sm">
                                  <span>Currency:</span>
                                  <span className="font-medium">INR</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span>Status:</span>
                                  <Badge variant={form.watch('status') === 'accepted' ? 'default' : 'secondary'} className="h-5">
                                    {form.watch('status') === 'accepted' ? 'Accepted' : 'Received'}
                                  </Badge>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span>GRN Date:</span>
                                  <span className="font-medium">{form.watch('grn_date') || 'Not set'}</span>
                                </div>
                                <div className="flex justify-between text-sm border-t pt-2">
                                  <span className="font-semibold">Total Amount:</span>
                                  <span className="font-bold text-lg text-primary">₹{summary.totalAmount.toLocaleString()}</span>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-16 text-muted-foreground">
                        <div className="text-6xl mb-4">📦</div>
                        <p className="text-xl font-medium mb-2">No Purchase Order Selected</p>
                        <p className="text-sm">Please select a Purchase Order in the GRN Info tab to load items for processing</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

            </div>
          </Tabs>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4 px-4 pb-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
            >
              {readOnly ? 'Close' : 'Cancel'}
            </Button>
            {!readOnly && (
              <Button
                type="submit"
                disabled={loading}
              >
                {loading ? 'Saving...' : mode === 'create' ? 'Create GRN' : 'Update GRN'}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
