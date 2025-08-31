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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, Plus, Trash2 } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const grnFormSchema = z.object({
  purchase_order_id: z.string().min(1, 'Please select a purchase order'),
  supplier_id: z.string().min(1, 'Supplier is required'),
  supplier_name: z.string().min(1, 'Supplier name is required'),
  grn_date: z.string().min(1, 'GRN date is required'),
  supplier_invoice_number: z.string().optional(),
  supplier_invoice_date: z.string().optional(),
  remarks: z.string().optional(),
  status: z.enum(['received', 'partially_received']),
  items: z.array(z.object({
    product_id: z.string().min(1, 'Product is required'),
    product_name: z.string(),
    product_sku: z.string().optional(),
    unit_of_measure: z.string().optional(),
    ordered_quantity: z.number().min(0),
    received_quantity: z.number().min(0),
    accepted_quantity: z.number().min(0),
    rejected_quantity: z.number().min(0),
    unit_price: z.number().min(0),
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

  const form = useForm<z.infer<typeof grnFormSchema>>({
    resolver: zodResolver(grnFormSchema),
    defaultValues: {
      purchase_order_id: grn?.purchase_order_id || '',
      supplier_id: grn?.supplier_id || '',
      supplier_name: grn?.supplier_name || '',
      grn_date: grn?.grn_date ? new Date(grn.grn_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      supplier_invoice_number: grn?.supplier_invoice_number || '',
      supplier_invoice_date: grn?.supplier_invoice_date ? new Date(grn.supplier_invoice_date).toISOString().split('T')[0] : '',
      remarks: grn?.remarks || '',
      status: grn?.status || 'received',
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
        warehouse_id: item.warehouse_id,
        bin_id: item.bin_id,
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
          purchase_order_items(*)
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
        .order('bin_code');

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
      product_name: item.product_name,
      product_sku: item.product_sku || '',
      unit_of_measure: item.unit_of_measure || '',
      ordered_quantity: item.quantity,
      received_quantity: item.pending_quantity, // Set to pending quantity initially
      accepted_quantity: 0, // Will be set based on status
      rejected_quantity: 0,
      unit_price: item.unit_price,
      discount_percentage: item.discount_percentage || 0,
      discount_amount: item.discount_amount || 0,
      warehouse_id: '',
      bin_id: '',
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
    
    // Apply status-based logic to accepted quantities
    const currentStatus = form.getValues('status');
    handleStatusChange(currentStatus);
  };

  const handleStatusChange = (status: string) => {
    const currentItems = form.getValues('items');
    
    const updatedItems = currentItems.map(item => {
      if (status === 'received') {
        // For "Received" status, set accepted_quantity = received_quantity (full receipt)
        return {
          ...item,
          accepted_quantity: item.received_quantity,
          rejected_quantity: 0,
        };
      } else if (status === 'partially_received') {
        // For "Partially received" status, keep current accepted quantities
        // User can manually adjust these
        return item;
      }
      return item;
    });
    
    form.setValue('items', updatedItems);
    form.setValue('status', status as 'received' | 'partially_received');
  };

  const calculateItemTotals = (index: number) => {
    const items = form.getValues('items');
    const item = items[index];
    
    if (!item) return;

    const subtotal = (item.accepted_quantity || 0) * (item.unit_price || 0);
    const discountAmount = item.discount_amount || ((item.discount_percentage || 0) * subtotal / 100);
    const afterDiscount = subtotal - discountAmount;
    
    const cgstAmount = (item.cgst_rate || 0) * afterDiscount / 100;
    const sgstAmount = (item.sgst_rate || 0) * afterDiscount / 100;
    const igstAmount = (item.igst_rate || 0) * afterDiscount / 100;
    const totalTaxAmount = cgstAmount + sgstAmount + igstAmount;
    const lineTotal = afterDiscount + totalTaxAmount;

    // Update the form values
    form.setValue(`items.${index}.discount_amount`, discountAmount);
    form.setValue(`items.${index}.cgst_amount`, cgstAmount);
    form.setValue(`items.${index}.sgst_amount`, sgstAmount);
    form.setValue(`items.${index}.igst_amount`, igstAmount);
    form.setValue(`items.${index}.total_tax_amount`, totalTaxAmount);
    form.setValue(`items.${index}.line_total`, lineTotal);
  };

  const handleSubmit = async (data: z.infer<typeof grnFormSchema>) => {
    if (readOnly) return;
    
    try {
      setLoading(true);
      await onSubmit(data);
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
  const validateQuantities = (index: number) => {
    const items = form.getValues('items');
    const item = items[index];
    
    // Received quantity cannot exceed ordered quantity
    if (item.received_quantity > item.ordered_quantity) {
      form.setError(`items.${index}.received_quantity`, {
        type: 'manual',
        message: 'Received quantity cannot exceed ordered quantity'
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Purchase Order Selection */}
          <FormField
            control={form.control}
            name="purchase_order_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Purchase Order *</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    handlePOSelection(value);
                  }}
                  disabled={readOnly || mode === 'edit'}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select purchase order" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {purchaseOrders.map((po) => (
                      <SelectItem key={po.id} value={po.id}>
                        {po.po_number} - {po.supplier?.name} (₹{po.total_amount?.toLocaleString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Status Selection - Only "Received" and "Partially received" */}
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status *</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    handleStatusChange(value);
                  }}
                  disabled={readOnly}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="received">Received</SelectItem>
                    <SelectItem value="partially_received">Partially Received</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Supplier Name (Auto-filled, read-only) */}
          <FormField
            control={form.control}
            name="supplier_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Supplier Name</FormLabel>
                <FormControl>
                  <Input {...field} disabled />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* GRN Date */}
          <FormField
            control={form.control}
            name="grn_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>GRN Date *</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    {...field}
                    disabled={readOnly}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Supplier Invoice Number */}
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

          {/* Supplier Invoice Date */}
          <FormField
            control={form.control}
            name="supplier_invoice_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Supplier Invoice Date</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    {...field}
                    disabled={readOnly}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Remarks */}
        <FormField
          control={form.control}
          name="remarks"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Remarks</FormLabel>
              <FormControl>
                <Textarea {...field} disabled={readOnly} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Items Section */}
        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent>
            {form.watch('items')?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-border">
                  <thead>
                    <tr className="bg-muted">
                      <th className="border border-border p-3 text-left text-sm font-medium">Product Name</th>
                      <th className="border border-border p-3 text-left text-sm font-medium">SKU</th>
                      <th className="border border-border p-3 text-left text-sm font-medium">Ordered Qty</th>
                      <th className="border border-border p-3 text-left text-sm font-medium">Received Qty</th>
                      <th className="border border-border p-3 text-left text-sm font-medium">Accepted Qty</th>
                      <th className="border border-border p-3 text-left text-sm font-medium">Rejected Qty</th>
                      <th className="border border-border p-3 text-left text-sm font-medium">Unit Price</th>
                      <th className="border border-border p-3 text-left text-sm font-medium">Warehouse ID</th>
                      <th className="border border-border p-3 text-left text-sm font-medium">Warehouse Name</th>
                      <th className="border border-border p-3 text-left text-sm font-medium">Bin Code</th>
                      <th className="border border-border p-3 text-left text-sm font-medium">Bin Name</th>
                      <th className="border border-border p-3 text-left text-sm font-medium">CGST %</th>
                      <th className="border border-border p-3 text-left text-sm font-medium">CGST Amt</th>
                      <th className="border border-border p-3 text-left text-sm font-medium">SGST %</th>
                      <th className="border border-border p-3 text-left text-sm font-medium">SGST Amt</th>
                      <th className="border border-border p-3 text-left text-sm font-medium">IGST %</th>
                      <th className="border border-border p-3 text-left text-sm font-medium">IGST Amt</th>
                      <th className="border border-border p-3 text-left text-sm font-medium">Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.watch('items').map((item: any, index: number) => {
                      const selectedBin = bins.find(b => b.id === item.bin_id);
                      const selectedWarehouse = warehouses.find(w => w.name === selectedBin?.warehouse_name);
                      
                      return (
                        <tr key={index} className="hover:bg-muted/50">
                          {/* Product Name - Read Only */}
                          <td className="border border-border p-2">
                            <Input
                              value={item.product_name || ''}
                              disabled
                              className="min-w-[150px] text-sm"
                            />
                          </td>
                          
                          {/* SKU - Read Only */}
                          <td className="border border-border p-2">
                            <Input
                              value={item.product_sku || ''}
                              disabled
                              className="min-w-[100px] text-sm"
                            />
                          </td>
                          
                          {/* Ordered Quantity - Read Only */}
                          <td className="border border-border p-2">
                            <Input
                              type="number"
                              value={item.ordered_quantity || 0}
                              disabled
                              className="min-w-[80px] text-sm"
                            />
                          </td>
                          
                          {/* Received Quantity */}
                          <td className="border border-border p-2">
                            <Input
                              type="number"
                              min="0"
                              max={item.ordered_quantity}
                              value={item.received_quantity || 0}
                              onChange={(e) => {
                                const newValue = Math.min(
                                  parseFloat(e.target.value) || 0, 
                                  item.ordered_quantity
                                );
                                form.setValue(`items.${index}.received_quantity`, newValue);
                                
                                // Auto-update accepted quantity if status is "received"
                                if (form.getValues('status') === 'received') {
                                  form.setValue(`items.${index}.accepted_quantity`, newValue);
                                  form.setValue(`items.${index}.rejected_quantity`, 0);
                                }
                                
                                validateQuantities(index);
                                calculateItemTotals(index);
                              }}
                              disabled={readOnly}
                              className="min-w-[80px] text-sm"
                            />
                          </td>
                          
                          {/* Accepted Quantity */}
                          <td className="border border-border p-2">
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
                              disabled={readOnly || form.getValues('status') === 'received'}
                              className="min-w-[80px] text-sm"
                            />
                          </td>
                          
                          {/* Rejected Quantity */}
                          <td className="border border-border p-2">
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
                              disabled={readOnly || form.getValues('status') === 'received'}
                              className="min-w-[80px] text-sm"
                            />
                          </td>
                          
                          {/* Unit Price - Read Only */}
                          <td className="border border-border p-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={item.unit_price || 0}
                              disabled
                              className="min-w-[100px] text-sm"
                            />
                          </td>
                          
                          {/* Warehouse ID */}
                          <td className="border border-border p-2">
                            <Input
                              value={selectedWarehouse?.warehouse_code || ''}
                              disabled
                              className="min-w-[100px] text-sm"
                            />
                          </td>
                          
                          {/* Warehouse Name */}
                          <td className="border border-border p-2">
                            <Select
                              value={item.warehouse_id || ''}
                              onValueChange={(value) => {
                                form.setValue(`items.${index}.warehouse_id`, value);
                                // Clear bin selection when warehouse changes
                                form.setValue(`items.${index}.bin_id`, '');
                              }}
                              disabled={readOnly}
                            >
                              <SelectTrigger className="min-w-[150px] text-sm">
                                <SelectValue placeholder="Select warehouse" />
                              </SelectTrigger>
                              <SelectContent>
                                {warehouses.map((warehouse) => (
                                  <SelectItem key={warehouse.id} value={warehouse.id}>
                                    {warehouse.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          
                          {/* Bin Code */}
                          <td className="border border-border p-2">
                            <Input
                              value={selectedBin?.wh_bin_code || ''}
                              disabled
                              className="min-w-[100px] text-sm"
                            />
                          </td>
                          
                          {/* Bin Name */}
                          <td className="border border-border p-2">
                            <Select
                              value={item.bin_id || ''}
                              onValueChange={(value) => form.setValue(`items.${index}.bin_id`, value)}
                              disabled={readOnly || !item.warehouse_id}
                            >
                              <SelectTrigger className="min-w-[150px] text-sm">
                                <SelectValue placeholder="Select bin" />
                              </SelectTrigger>
                              <SelectContent>
                                {bins
                                  .filter(bin => bin.warehouse_name === selectedWarehouse?.name)
                                  .map((bin) => (
                                    <SelectItem key={bin.id} value={bin.id}>
                                      {bin.bin_name}
                                    </SelectItem>
                                  ))
                                }
                              </SelectContent>
                            </Select>
                          </td>
                          
                          {/* CGST % */}
                          <td className="border border-border p-2">
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
                              className="min-w-[80px] text-sm"
                            />
                          </td>
                          
                          {/* CGST Amount */}
                          <td className="border border-border p-2">
                            <Input
                              type="number"
                              value={item.cgst_amount?.toFixed(2) || '0.00'}
                              disabled
                              className="min-w-[100px] text-sm"
                            />
                          </td>
                          
                          {/* SGST % */}
                          <td className="border border-border p-2">
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
                              className="min-w-[80px] text-sm"
                            />
                          </td>
                          
                          {/* SGST Amount */}
                          <td className="border border-border p-2">
                            <Input
                              type="number"
                              value={item.sgst_amount?.toFixed(2) || '0.00'}
                              disabled
                              className="min-w-[100px] text-sm"
                            />
                          </td>
                          
                          {/* IGST % */}
                          <td className="border border-border p-2">
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
                              className="min-w-[80px] text-sm"
                            />
                          </td>
                          
                          {/* IGST Amount */}
                          <td className="border border-border p-2">
                            <Input
                              type="number"
                              value={item.igst_amount?.toFixed(2) || '0.00'}
                              disabled
                              className="min-w-[100px] text-sm"
                            />
                          </td>
                          
                          {/* Line Total */}
                          <td className="border border-border p-2">
                            <Input
                              type="number"
                              value={item.line_total?.toFixed(2) || '0.00'}
                              disabled
                              className="min-w-[120px] text-sm font-medium"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Please select a Purchase Order to load items
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Section */}
        {form.watch('items')?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>GRN Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground">Total Ordered</div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {summary.totalOrdered.toLocaleString()}
                  </div>
                </div>
                <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground">Total Received</div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {summary.totalReceived.toLocaleString()}
                  </div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950 p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground">Total Accepted</div>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {summary.totalAccepted.toLocaleString()}
                  </div>
                </div>
                <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground">Total Rejected</div>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {summary.totalRejected.toLocaleString()}
                  </div>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground">Total Pending</div>
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {summary.totalPending.toLocaleString()}
                  </div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground">GRN Amount</div>
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    ₹{summary.totalAmount.toLocaleString()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4">
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
  );
}
