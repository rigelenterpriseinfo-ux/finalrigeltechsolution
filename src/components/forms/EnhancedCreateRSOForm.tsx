import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, X, FileText, Package } from 'lucide-react';
import { Label } from '@/components/ui/label';

// Form validation schema
const rsoHeaderSchema = z.object({
  customer_id: z.string().min(1, 'Customer is required'),
  invoice_ids: z.array(z.string()).min(1, 'At least one invoice is required'),
  rso_date: z.string().min(1, 'RSO date is required'),
  reason_for_credit: z.enum(['Return', 'Price Correction', 'Discount', 'Others'], {
    required_error: 'Reason for credit is required',
  }),
  status: z.enum(['Draft', 'Confirmed']),
  place_of_supply: z.string().optional(),
  delivery_same_as_company: z.boolean(),
  delivery_address_line1: z.string().optional(),
  delivery_address_line2: z.string().optional(),
  delivery_city: z.string().optional(),
  delivery_country: z.string().optional(),
  delivery_pin_code: z.string().optional(),
  notes: z.string().optional(),
});

type RSOHeaderData = z.infer<typeof rsoHeaderSchema>;

interface Customer {
  id: string;
  name: string;
  customer_ref: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  country?: string;
  pin_code?: string;
}

interface SalesInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_id: string;
  total_amount: number;
}

interface ReturnLineItem {
  product_id: string;
  product_name: string;
  product_sku: string;
  hsn_sac_code: string | null;
  unit_of_measure: string;
  invoice_qty: number;
  return_qty: number;
  pending_return_qty: number;
  unit_price: number;
  discount_percentage: number;
  discount_amount: number;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  igst_rate: number;
  igst_amount: number;
  line_subtotal: number;
  tax_amount: number;
  line_total: number;
  available_qty: number;
  original_discount_percentage: number;
  original_discount_amount: number;
  source_invoice_id: string;
  source_invoice_number: string;
}

interface EnhancedCreateRSOFormProps {
  rsoId?: string;
  onClose: () => void;
  onSave: () => void;
}

export function EnhancedCreateRSOForm({ rsoId, onClose, onSave }: EnhancedCreateRSOFormProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const companyId = profile?.company_id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedInvoices, setSelectedInvoices] = useState<SalesInvoice[]>([]);
  const [returnLineItems, setReturnLineItems] = useState<ReturnLineItem[]>([]);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [generatedRSONumber, setGeneratedRSONumber] = useState<string>('');

  const form = useForm<RSOHeaderData>({
    resolver: zodResolver(rsoHeaderSchema),
    defaultValues: {
      customer_id: '',
      invoice_ids: [],
      rso_date: new Date().toISOString().split('T')[0],
      reason_for_credit: 'Return',
      status: 'Draft',
      place_of_supply: '',
      delivery_same_as_company: true,
      delivery_address_line1: '',
      delivery_address_line2: '',
      delivery_city: '',
      delivery_country: '',
      delivery_pin_code: '',
      notes: '',
    },
  });

  const watchDeliverySameAsCompany = form.watch('delivery_same_as_company');

  useEffect(() => {
    if (companyId) {
      loadCustomers();
    }
  }, [companyId]);

  useEffect(() => {
    if (rsoId && customers.length > 0) {
      loadExistingRSO();
    }
  }, [rsoId, customers.length]);

  useEffect(() => {
    if (selectedCustomer && !isLoadingExisting) {
      loadCustomerInvoices(selectedCustomer.id);
    } else if (!selectedCustomer && !isLoadingExisting) {
      setInvoices([]);
      setSelectedInvoices([]);
      setReturnLineItems([]);
    }
  }, [selectedCustomer, isLoadingExisting]);

  useEffect(() => {
    if (selectedInvoices.length > 0 && !isLoadingExisting) {
      loadMultipleInvoiceItems(selectedInvoices.map(inv => inv.id));
    } else if (selectedInvoices.length === 0 && !isLoadingExisting) {
      setReturnLineItems([]);
    }
  }, [selectedInvoices, isLoadingExisting]);

  const loadCustomers = async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, customer_ref, address_line1, address_line2, city, state, country, pin_code')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
      toast({ title: 'Error', description: 'Failed to load customers', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerInvoices = async (customerId: string) => {
    if (!companyId) return;
    try {
      const oneYearAgo = new Date();
      oneYearAgo.setDate(oneYearAgo.getDate() - 365);
      const { data, error } = await supabase
        .from('sales_invoices')
        .select('id, invoice_number, invoice_date, customer_id, total_amount')
        .eq('company_id', companyId)
        .eq('customer_id', customerId)
        .eq('status', 'finalized')
        .gte('invoice_date', oneYearAgo.toISOString().split('T')[0])
        .order('invoice_date', { ascending: false });
      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error loading invoices:', error);
      toast({ title: 'Error', description: 'Failed to load customer invoices', variant: 'destructive' });
    }
  };

  const loadMultipleInvoiceItems = async (invoiceIds: string[]) => {
    try {
      const allLineItems: ReturnLineItem[] = [];
      
      for (const invoiceId of invoiceIds) {
        const { data: items, error } = await supabase
          .from('sales_invoice_items')
          .select('*')
          .eq('sales_invoice_id', invoiceId);
        
        if (error) throw error;

        const invoice = invoices.find(inv => inv.id === invoiceId);
        
        // Get previously returned quantities
        const { data: existingReturns } = await supabase
          .from('return_order_lines')
          .select('product_id, return_qty, source_invoice_id')
          .eq('source_invoice_id', invoiceId);

        const returnedQtyMap = new Map();
        existingReturns?.forEach(item => {
          const current = returnedQtyMap.get(item.product_id) || 0;
          returnedQtyMap.set(item.product_id, current + item.return_qty);
        });

        items?.forEach(item => {
          const availableQty = item.quantity_invoiced - (returnedQtyMap.get(item.product_id) || 0);
          
          allLineItems.push({
            product_id: item.product_id,
            product_name: item.item_description,
            product_sku: item.item_code,
            hsn_sac_code: item.hsn_sac_code,
            unit_of_measure: item.unit_of_measure,
            invoice_qty: item.quantity_invoiced,
            return_qty: 0,
            pending_return_qty: 0,
            unit_price: item.unit_price,
            discount_percentage: item.discount_percentage || 0,
            discount_amount: 0,
            cgst_rate: item.cgst_rate || 0,
            cgst_amount: 0,
            sgst_rate: item.sgst_rate || 0,
            sgst_amount: 0,
            igst_rate: item.igst_rate || 0,
            igst_amount: 0,
            line_subtotal: 0,
            tax_amount: 0,
            line_total: 0,
            available_qty: Math.max(0, availableQty),
            original_discount_percentage: item.discount_percentage || 0,
            original_discount_amount: item.discount_amount || 0,
            source_invoice_id: invoiceId,
            source_invoice_number: invoice?.invoice_number || '',
          });
        });
      }
      
      setReturnLineItems(allLineItems);
    } catch (error) {
      console.error('Error loading invoice items:', error);
      toast({ title: 'Error', description: 'Failed to load invoice items', variant: 'destructive' });
    }
  };

  const loadExistingRSO = async () => {
    if (!rsoId || !companyId) return;
    try {
      setIsLoadingExisting(true);
      
      const { data: rsoData, error: rsoError } = await supabase
        .from('return_order_header')
        .select('*')
        .eq('id', rsoId)
        .eq('company_id', companyId)
        .single();

      if (rsoError) throw rsoError;
      if (rsoData.rso_number) setGeneratedRSONumber(rsoData.rso_number);

      // Handle both old (invoice_id) and new (invoice_ids) formats
      const invoiceIds = rsoData.invoice_ids || (rsoData.invoice_id ? [rsoData.invoice_id] : []);
      
      form.reset({
        customer_id: rsoData.customer_id,
        invoice_ids: invoiceIds,
        rso_date: rsoData.rso_date,
        reason_for_credit: rsoData.reason_for_credit as 'Return' | 'Price Correction' | 'Discount' | 'Others',
        status: rsoData.status as 'Draft' | 'Confirmed',
        place_of_supply: rsoData.place_of_supply || '',
        delivery_same_as_company: rsoData.delivery_same_as_company,
        delivery_address_line1: rsoData.delivery_address_line1 || '',
        delivery_address_line2: rsoData.delivery_address_line2 || '',
        delivery_city: rsoData.delivery_city || '',
        delivery_country: rsoData.delivery_country || '',
        delivery_pin_code: rsoData.delivery_pin_code || '',
        notes: rsoData.notes || '',
      });

      const customer = customers.find(c => c.id === rsoData.customer_id);
      if (customer) setSelectedCustomer(customer);

      // Load invoices
      if (invoiceIds.length > 0) {
        const { data: invoicesData } = await supabase
          .from('sales_invoices')
          .select('id, invoice_number, invoice_date, customer_id, total_amount')
          .in('id', invoiceIds);
        
        if (invoicesData) {
          setInvoices(invoicesData);
          setSelectedInvoices(invoicesData);
        }
      }

      if (customer) await loadCustomerInvoices(customer.id);

      // Load line items
      const { data: linesData } = await supabase
        .from('return_order_lines')
        .select('*')
        .eq('return_order_id', rsoId);

      if (linesData) {
        const prefillMap = new Map();
        linesData.forEach(l => {
          const key = `${l.product_id}_${l.source_invoice_id || ''}`;
          prefillMap.set(key, {
            return_qty: l.return_qty,
            discount_percentage: l.discount_percentage || 0
          });
        });

        // Load all invoice items and apply prefilled values
        await loadMultipleInvoiceItems(invoiceIds);
        
        // Apply prefilled quantities after items are loaded
        setTimeout(() => {
          setReturnLineItems(prev => prev.map(item => {
            const key = `${item.product_id}_${item.source_invoice_id}`;
            const prefillData = prefillMap.get(key);
            if (prefillData) {
              item.return_qty = prefillData.return_qty;
              item.discount_percentage = prefillData.discount_percentage;
              calculateLineAmounts(item);
            }
            return item;
          }));
        }, 100);
      }
    } catch (error) {
      console.error('Error loading existing RSO:', error);
      toast({ title: 'Error', description: 'Failed to load RSO data', variant: 'destructive' });
    } finally {
      setIsLoadingExisting(false);
    }
  };

  const handleCustomerChange = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    setSelectedCustomer(customer || null);
    form.setValue('customer_id', customerId);
    form.setValue('invoice_ids', []);
    setSelectedInvoices([]);
    setReturnLineItems([]);
  };

  const handleInvoiceToggle = (invoiceId: string) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    if (!invoice) return;

    const isSelected = selectedInvoices.some(inv => inv.id === invoiceId);
    let newSelectedInvoices: SalesInvoice[];
    
    if (isSelected) {
      newSelectedInvoices = selectedInvoices.filter(inv => inv.id !== invoiceId);
    } else {
      newSelectedInvoices = [...selectedInvoices, invoice];
    }
    
    setSelectedInvoices(newSelectedInvoices);
    form.setValue('invoice_ids', newSelectedInvoices.map(inv => inv.id));
  };

  const handleReturnQtyChange = useCallback((index: number, returnQty: number) => {
    const updatedItems = [...returnLineItems];
    const item = updatedItems[index];
    
    if (returnQty > item.available_qty) {
      toast({
        title: 'Error',
        description: `Return quantity cannot exceed available quantity (${item.available_qty})`,
        variant: 'destructive',
      });
      return;
    }

    item.return_qty = returnQty;
    item.pending_return_qty = returnQty;
    calculateLineAmounts(item);
    setReturnLineItems(updatedItems);
  }, [returnLineItems, toast]);

  const handleDiscountPercentageChange = useCallback((index: number, discountPercentage: number) => {
    const updatedItems = [...returnLineItems];
    const item = updatedItems[index];
    
    if (discountPercentage < 0 || discountPercentage > 100) {
      toast({
        title: 'Error',
        description: 'Discount percentage must be between 0 and 100',
        variant: 'destructive',
      });
      return;
    }

    item.discount_percentage = discountPercentage;
    calculateLineAmounts(item);
    setReturnLineItems(updatedItems);
  }, [returnLineItems, toast]);

  const calculateLineAmounts = (item: ReturnLineItem) => {
    item.discount_amount = (item.return_qty * item.unit_price * item.discount_percentage) / 100;
    item.line_subtotal = (item.return_qty * item.unit_price) - item.discount_amount;
    item.cgst_amount = (item.cgst_rate / 100) * item.line_subtotal;
    item.sgst_amount = (item.sgst_rate / 100) * item.line_subtotal;
    item.igst_amount = (item.igst_rate / 100) * item.line_subtotal;
    item.tax_amount = item.cgst_amount + item.sgst_amount + item.igst_amount;
    item.line_total = item.line_subtotal + item.tax_amount;
  };

  const calculateTotals = useCallback(() => {
    const subtotal = returnLineItems.reduce((sum, item) => sum + item.line_subtotal, 0);
    const discountAmount = returnLineItems.reduce((sum, item) => sum + item.discount_amount, 0);
    const taxAmount = returnLineItems.reduce((sum, item) => sum + item.tax_amount, 0);
    const total = subtotal + taxAmount;
    return { subtotal, discountAmount, taxAmount, total };
  }, [returnLineItems]);

  const onSubmit = async (data: RSOHeaderData) => {
    if (!user || !companyId) return;

    const hasReturnItems = returnLineItems.some(item => item.return_qty > 0);
    if (!hasReturnItems) {
      toast({ title: 'Error', description: 'Please specify return quantities for at least one item', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      const totals = calculateTotals();
      
      const headerData = {
        company_id: companyId,
        rso_date: data.rso_date,
        customer_id: data.customer_id,
        customer_name: selectedCustomer?.name || '',
        invoice_ids: data.invoice_ids,
        invoice_numbers: selectedInvoices.map(inv => inv.invoice_number),
        // Keep legacy fields for backward compatibility
        invoice_id: data.invoice_ids[0] || null,
        invoice_number: selectedInvoices[0]?.invoice_number || '',
        invoice_date: selectedInvoices[0]?.invoice_date || '',
        reason_for_credit: data.reason_for_credit,
        place_of_supply: data.place_of_supply || null,
        delivery_same_as_company: data.delivery_same_as_company,
        delivery_address_line1: data.delivery_same_as_company ? null : data.delivery_address_line1,
        delivery_address_line2: data.delivery_same_as_company ? null : data.delivery_address_line2,
        delivery_city: data.delivery_same_as_company ? null : data.delivery_city,
        delivery_country: data.delivery_same_as_company ? null : data.delivery_country,
        delivery_pin_code: data.delivery_same_as_company ? null : data.delivery_pin_code,
        status: data.status,
        subtotal_amount: totals.subtotal,
        tax_amount: totals.taxAmount,
        total_amount: totals.total,
        notes: data.notes,
        created_by: user.id,
      };

      let rsoHeaderId: string;
      let responseData: any;

      if (rsoId) {
        const { data: updateData, error: updateError } = await supabase
          .from('return_order_header')
          .update(headerData)
          .eq('id', rsoId)
          .select('rso_number')
          .single();
        if (updateError) throw updateError;
        
        await supabase.from('return_order_lines').delete().eq('return_order_id', rsoId);
        rsoHeaderId = rsoId;
        responseData = updateData;
      } else {
        const { data: insertedHeader, error: insertError } = await supabase
          .from('return_order_header')
          .insert(headerData)
          .select('id, rso_number')
          .single();
        if (insertError) throw insertError;
        rsoHeaderId = insertedHeader.id;
        responseData = insertedHeader;
      }

      if (responseData?.rso_number) setGeneratedRSONumber(responseData.rso_number);

      const returnLines = returnLineItems
        .filter(item => item.return_qty > 0)
        .map(item => ({
          return_order_id: rsoHeaderId,
          product_id: item.product_id,
          product_name: item.product_name,
          product_sku: item.product_sku,
          hsn_sac_code: item.hsn_sac_code,
          unit_of_measure: item.unit_of_measure,
          invoice_qty: item.invoice_qty,
          return_qty: item.return_qty,
          pending_return_qty: item.pending_return_qty,
          unit_price: item.unit_price,
          discount_percentage: item.discount_percentage,
          discount_amount: item.discount_amount,
          cgst_rate: item.cgst_rate,
          cgst_amount: item.cgst_amount,
          sgst_rate: item.sgst_rate,
          sgst_amount: item.sgst_amount,
          igst_rate: item.igst_rate,
          igst_amount: item.igst_amount,
          line_subtotal: item.line_subtotal,
          tax_amount: item.tax_amount,
          line_total: item.line_total,
          source_invoice_id: item.source_invoice_id,
        }));

      const { error: linesError } = await supabase
        .from('return_order_lines')
        .insert(returnLines);
      if (linesError) throw linesError;

      toast({
        title: 'Success',
        description: `RSO ${rsoId ? 'updated' : 'created'} successfully${responseData?.rso_number ? ` - ${responseData.rso_number}` : ''}`,
      });

      onSave();
      if (!rsoId) onClose();
    } catch (error) {
      console.error('Error saving RSO:', error);
      toast({ title: 'Error', description: 'Failed to save RSO', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const totals = calculateTotals();

  if (loading && !customers.length) {
    return (
      <Card className="w-full max-w-7xl mx-auto">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-7xl mx-auto shadow-lg">
      <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-primary/10">
        <CardTitle className="flex items-center justify-between text-2xl">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" />
            <span className="font-bold">{rsoId ? 'Edit' : 'Create'} RSO</span>
          </div>
          {generatedRSONumber && (
            <Badge variant="outline" className="text-lg px-4 py-2 bg-background border-primary">
              {generatedRSONumber}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            
            {/* Customer and Invoice Selection */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="customer_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-semibold">Customer *</FormLabel>
                    <FormControl>
                      <Select onValueChange={handleCustomerChange} value={field.value}>
                        <SelectTrigger className="h-11 bg-background border-2 hover:border-primary transition-colors">
                          <SelectValue placeholder="Select a customer" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border z-50 max-h-80">
                          {customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id} className="py-3">
                              <div className="flex flex-col">
                                <span className="font-medium">{customer.name}</span>
                                <span className="text-sm text-muted-foreground">{customer.customer_ref}</span>
                              </div>
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
                name="invoice_ids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Sales Invoices * (Last 365 days)
                    </FormLabel>
                    <div className="border-2 rounded-lg p-4 bg-muted/30 max-h-48 overflow-y-auto">
                      {!selectedCustomer ? (
                        <p className="text-sm text-muted-foreground">Select a customer first</p>
                      ) : invoices.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No finalized invoices found</p>
                      ) : (
                        <div className="space-y-2">
                          {invoices.map((invoice) => (
                            <div 
                              key={invoice.id} 
                              className={`flex items-center space-x-3 p-3 rounded-md cursor-pointer transition-all hover:bg-background ${
                                selectedInvoices.some(inv => inv.id === invoice.id) 
                                  ? 'bg-primary/10 border-2 border-primary' 
                                  : 'bg-background border-2 border-transparent'
                              }`}
                              onClick={() => handleInvoiceToggle(invoice.id)}
                            >
                              <Checkbox
                                checked={selectedInvoices.some(inv => inv.id === invoice.id)}
                                onCheckedChange={() => handleInvoiceToggle(invoice.id)}
                              />
                              <div className="flex-1">
                                <div className="font-medium">{invoice.invoice_number}</div>
                                <div className="text-sm text-muted-foreground">
                                  {new Date(invoice.invoice_date).toLocaleDateString()} - ₹{invoice.total_amount.toLocaleString()}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Customer Address Display */}
            {selectedCustomer && (
              <div className="space-y-6">
                <Card className="border-2 bg-gradient-to-br from-muted/50 to-muted/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Customer Registered Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <Label className="text-xs text-muted-foreground">Address Line 1</Label>
                        <p className="font-medium">{selectedCustomer.address_line1 || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Address Line 2</Label>
                        <p className="font-medium">{selectedCustomer.address_line2 || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">City</Label>
                        <p className="font-medium">{selectedCustomer.city || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">State</Label>
                        <p className="font-medium">{selectedCustomer.state || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Country</Label>
                        <p className="font-medium">{selectedCustomer.country || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Pin Code</Label>
                        <p className="font-medium">{selectedCustomer.pin_code || 'N/A'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Delivery Address Option */}
                <FormField
                  control={form.control}
                  name="delivery_same_as_company"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border-2 p-4 bg-muted/30">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="font-medium">Delivery same as company address</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />

                {!watchDeliverySameAsCompany && (
                  <Card className="border-2 bg-gradient-to-br from-muted/50 to-muted/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold">Delivery Address</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="delivery_address_line1"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Address Line 1</FormLabel>
                              <FormControl>
                                <Input {...field} className="h-11" />
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
                              <FormLabel>Address Line 2</FormLabel>
                              <FormControl>
                                <Input {...field} className="h-11" />
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
                              <FormLabel>City</FormLabel>
                              <FormControl>
                                <Input {...field} className="h-11" />
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
                              <FormLabel>Country</FormLabel>
                              <FormControl>
                                <Input {...field} className="h-11" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="delivery_pin_code"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Pin Code</FormLabel>
                              <FormControl>
                                <Input {...field} className="h-11" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Selected Invoices Display */}
            {selectedInvoices.length > 0 && (
              <Card className="border-2 bg-gradient-to-r from-primary/5 to-primary/10">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Selected Invoices ({selectedInvoices.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-2">
                    {selectedInvoices.map((invoice) => (
                      <Badge key={invoice.id} variant="secondary" className="px-3 py-1.5 text-sm">
                        {invoice.invoice_number} - ₹{invoice.total_amount.toLocaleString()}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* RSO Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="rso_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">RSO Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} className="h-11" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reason_for_credit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Reason for Credit *</FormLabel>
                    <FormControl>
                      <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col space-y-2">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Return" id="return" />
                          <Label htmlFor="return" className="cursor-pointer">Return</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Price Correction" id="price-correction" />
                          <Label htmlFor="price-correction" className="cursor-pointer">Price Correction</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Discount" id="discount" />
                          <Label htmlFor="discount" className="cursor-pointer">Discount</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Others" id="others" />
                          <Label htmlFor="others" className="cursor-pointer">Others</Label>
                        </div>
                      </RadioGroup>
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
                    <FormLabel className="font-semibold">Place of Supply</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Delhi, Mumbai" {...field} className="h-11" />
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
                    <FormLabel className="font-semibold">Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11 bg-background">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-background border z-50">
                        <SelectItem value="Draft">Draft</SelectItem>
                        <SelectItem value="Confirmed">Confirmed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Return Line Items */}
            {returnLineItems.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Return Line Items
                </h3>
                <div className="overflow-x-auto border-2 rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-bold">Product Name</TableHead>
                        <TableHead className="font-bold">SKU</TableHead>
                        <TableHead className="font-bold">Invoice #</TableHead>
                        <TableHead className="font-bold">HSN/SAC</TableHead>
                        <TableHead className="font-bold">UOM</TableHead>
                        <TableHead className="font-bold text-right">Invoice Qty</TableHead>
                        <TableHead className="font-bold text-right">Available Qty</TableHead>
                        <TableHead className="font-bold text-right">Return Qty</TableHead>
                        <TableHead className="font-bold text-right">Pending Qty</TableHead>
                        <TableHead className="font-bold text-right">Unit Price</TableHead>
                        <TableHead className="font-bold text-right">Discount %</TableHead>
                        <TableHead className="font-bold text-right">Discount Amt</TableHead>
                        <TableHead className="font-bold text-right">CGST %</TableHead>
                        <TableHead className="font-bold text-right">CGST Amt</TableHead>
                        <TableHead className="font-bold text-right">SGST %</TableHead>
                        <TableHead className="font-bold text-right">SGST Amt</TableHead>
                        <TableHead className="font-bold text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {returnLineItems.map((item, index) => (
                        <TableRow key={`${item.product_id}-${item.source_invoice_id}`} className="hover:bg-muted/30">
                          <TableCell className="font-medium">{item.product_name}</TableCell>
                          <TableCell>{item.product_sku}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{item.source_invoice_number}</Badge>
                          </TableCell>
                          <TableCell>{item.hsn_sac_code || 'N/A'}</TableCell>
                          <TableCell>{item.unit_of_measure}</TableCell>
                          <TableCell className="text-right">{item.invoice_qty}</TableCell>
                          <TableCell className="text-right font-semibold text-green-600">{item.available_qty}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              max={item.available_qty}
                              value={item.return_qty}
                              onChange={(e) => handleReturnQtyChange(index, parseInt(e.target.value) || 0)}
                              className="w-20 h-9 text-right"
                            />
                          </TableCell>
                          <TableCell className="text-right">{item.pending_return_qty}</TableCell>
                          <TableCell className="text-right">₹{item.unit_price.toLocaleString()}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={item.discount_percentage}
                              onChange={(e) => handleDiscountPercentageChange(index, parseFloat(e.target.value) || 0)}
                              className="w-20 h-9 text-right"
                            />
                          </TableCell>
                          <TableCell className="text-right">₹{item.discount_amount.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{item.cgst_rate}%</TableCell>
                          <TableCell className="text-right">₹{item.cgst_amount.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{item.sgst_rate}%</TableCell>
                          <TableCell className="text-right">₹{item.sgst_amount.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-bold">₹{item.line_total.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Totals */}
                <Card className="border-2 bg-gradient-to-r from-primary/5 to-primary/10">
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Subtotal</Label>
                        <p className="text-lg font-bold">₹{totals.subtotal.toFixed(2)}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Total Discount</Label>
                        <p className="text-lg font-bold text-orange-600">-₹{totals.discountAmount.toFixed(2)}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Total Tax</Label>
                        <p className="text-lg font-bold">₹{totals.taxAmount.toFixed(2)}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Total Amount</Label>
                        <p className="text-2xl font-bold text-primary">₹{totals.total.toFixed(2)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              selectedInvoices.length > 0 && (
                <Card className="border-2 border-dashed">
                  <CardContent className="flex items-center justify-center py-12">
                    <p className="text-muted-foreground">No items available for return</p>
                  </CardContent>
                </Card>
              )
            )}

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-semibold">Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} className="resize-none" placeholder="Add any additional notes..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose} className="h-11 px-6">
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="h-11 px-6 bg-primary hover:bg-primary/90">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {rsoId ? 'Update' : 'Save'} RSO
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
