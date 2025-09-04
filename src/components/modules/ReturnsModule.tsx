import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PermissionWrapper, PermissionButton, PermissionInput } from '@/components/ui/permission-wrapper';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { 
  RotateCcw, 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Eye, 
  Download,
  ArrowLeft,
  Save,
  Check,
  Trash2,
  ChevronsUpDown,
  X,
  AlertCircle,
  MapPin,
  Calendar
} from 'lucide-react';

interface ReturnOrder {
  id: string;
  rso_number: string;
  rso_date: string;
  customer_name: string;
  invoice_number: string;
  status: 'Draft' | 'Confirmed';
  reason_for_credit: string;
  total_amount: number;
}

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
  customer_name: string;
  total_amount: number;
}

interface InvoiceLineItem {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  hsn_sac_code?: string;
  unit_of_measure: string;
  quantity_invoiced: number;
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
  return_qty: number;
  pending_return_qty: number;
  already_returned?: number;
  available_to_return?: number;
}

interface ReturnStats {
  draft_count: number;
  draft_amount: number;
  confirmed_count: number;
  confirmed_amount: number;
}

interface SearchableComboboxProps {
  value?: string;
  onSelect: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  options: { id: string; name: string; subtitle?: string }[];
  disabled?: boolean;
  className?: string;
}

function SearchableCombobox({
  value,
  onSelect,
  placeholder,
  searchPlaceholder,
  options,
  disabled = false,
  className = ""
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const filteredOptions = useMemo(() => {
    if (!searchValue) return options;
    return options.filter(option =>
      option.name.toLowerCase().includes(searchValue.toLowerCase()) ||
      option.subtitle?.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [options, searchValue]);

  const selectedOption = options.find(option => option.id === value);

  // Show loading state if no options and not disabled
  const showLoading = options.length === 0 && !disabled;
  const effectivePlaceholder = showLoading ? "Loading..." : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`w-full justify-between ${className}`}
          disabled={disabled || showLoading}
        >
          {selectedOption ? selectedOption.name : effectivePlaceholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="z-[9999] w-[var(--radix-popover-trigger-width)] min-w-[20rem] p-0 bg-white shadow-lg border rounded-md"
        align="start"
        sideOffset={4}
      >
        <Command>
          <CommandInput 
            placeholder={searchPlaceholder}
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            {options.length === 0 ? (
              <CommandEmpty>No options available.</CommandEmpty>
            ) : filteredOptions.length === 0 ? (
              <CommandEmpty>No results found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={option.id}
                    onSelect={() => {
                      console.debug('Selected option:', option);
                      onSelect(option.id);
                      setOpen(false);
                      setSearchValue("");
                    }}
                    className="cursor-pointer hover:bg-accent hover:text-accent-foreground"
                  >
                    <div className="flex flex-col">
                      <span>{option.name}</span>
                      {option.subtitle && (
                        <span className="text-sm text-muted-foreground">{option.subtitle}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function ReturnsModule() {
  const { toast } = useToast();
  const { company } = useCompany();
  const [activeTab, setActiveTab] = useState('returns');
  const [isCreateReturnFormOpen, setIsCreateReturnFormOpen] = useState(false);
  
  // Form state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const [reasonForCredit, setReasonForCredit] = useState<string>('');
  const [deliverySameAsCompany, setDeliverySameAsCompany] = useState(true);
  const [deliveryAddress, setDeliveryAddress] = useState({
    address_line1: '',
    address_line2: '',
    city: '',
    country: '',
    pin_code: ''
  });
  const [notes, setNotes] = useState('');
  const [invoiceLineItems, setInvoiceLineItems] = useState<InvoiceLineItem[]>([]);
  const [returnOrderDate, setReturnOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [createdRsoNumber, setCreatedRsoNumber] = useState<string | null>(null);
  const [editingReturnId, setEditingReturnId] = useState<string | null>(null);

  // Data states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [returnOrders, setReturnOrders] = useState<ReturnOrder[]>([]);
  const [returnStats, setReturnStats] = useState<ReturnStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

  // Load initial data
  useEffect(() => {
    if (company?.id) {
      loadCustomers();
      loadReturnOrders();
      loadReturnStats();
    }
  }, [company?.id]);

  // Auto-fill company delivery address when checkbox is checked
  useEffect(() => {
    if (deliverySameAsCompany && company) {
      setDeliveryAddress({
        address_line1: (company as any).address_line1 || '',
        address_line2: (company as any).address_line2 || '',
        city: (company as any).city || '',
        country: (company as any).country || '',
        pin_code: (company as any).postal_code || ''
      });
    } else if (!deliverySameAsCompany) {
      setDeliveryAddress({
        address_line1: '',
        address_line2: '',
        city: '',
        country: '',
        pin_code: ''
      });
    }
  }, [deliverySameAsCompany, company]);

  const loadCustomers = async () => {
    if (!company?.id) return;
    
    console.debug('Loading customers for company:', company.id);
    setCustomersLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, customer_ref, address_line1, address_line2, city, state, country, pin_code')
        .eq('company_id', company.id)
        .eq('is_active', true)
        .order('name');
      
      if (error) {
        console.error('Error loading customers:', error);
        toast({ title: "Error", description: "Failed to load customers", variant: "destructive" });
        return;
      }
      
      console.debug('Loaded customers:', data?.length || 0);
      setCustomers(data || []);
    } catch (error) {
      console.error('Customer loading exception:', error);
      toast({ title: "Error", description: "Failed to load customers", variant: "destructive" });
    } finally {
      setCustomersLoading(false);
    }
  };

  const loadInvoicesForCustomer = async (customerId: string) => {
    if (!company?.id) return;
    
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const { data, error } = await supabase
      .from('sales_invoices')
      .select('id, invoice_number, invoice_date, customer_name, total_amount')
      .eq('company_id', company.id)
      .eq('customer_id', customerId)
      .eq('status', 'finalized')
      .gte('invoice_date', oneYearAgo.toISOString().split('T')[0])
      .order('invoice_date', { ascending: false });
    
    if (error) {
      toast({ title: "Error", description: "Failed to load invoices", variant: "destructive" });
      return;
    }
    
    setInvoices(data || []);
  };

  const loadInvoiceLineItems = async (invoiceId: string) => {
    // Load invoice items
    const { data: invoiceData, error: invoiceError } = await supabase
      .from('sales_invoice_items')
      .select('*')
      .eq('sales_invoice_id', invoiceId);
    
    if (invoiceError) {
      toast({ title: "Error", description: "Failed to load invoice items", variant: "destructive" });
      return;
    }

    // Load previously returned quantities
    const { data: returnedData, error: returnedError } = await supabase
      .rpc('get_invoice_returned_quantities', { p_invoice_id: invoiceId });

    if (returnedError) {
      console.error('Error fetching returned quantities:', returnedError);
    }

    const returnedMap = new Map<string, number>();
    (returnedData || []).forEach((item: any) => {
      returnedMap.set(item.product_id, item.returned_qty);
    });
    
    const lineItems: InvoiceLineItem[] = (invoiceData || []).map(item => {
      const alreadyReturned = returnedMap.get(item.product_id) || 0;
      const availableToReturn = Math.max(0, item.quantity_invoiced - alreadyReturned);
      
      return {
        id: item.id,
        product_id: item.product_id,
        product_name: item.item_description,
        product_sku: item.item_code,
        hsn_sac_code: item.hsn_sac_code,
        unit_of_measure: item.unit_of_measure,
        quantity_invoiced: item.quantity_invoiced,
        unit_price: item.unit_price,
        discount_percentage: item.discount_percentage || 0,
        discount_amount: item.discount_amount,
        cgst_rate: item.cgst_rate || 0,
        cgst_amount: item.cgst_amount || 0,
        sgst_rate: item.sgst_rate || 0,
        sgst_amount: item.sgst_amount || 0,
        igst_rate: item.igst_rate || 0,
        igst_amount: item.igst_amount || 0,
        line_subtotal: item.line_subtotal,
        tax_amount: item.tax_amount,
        line_total: item.line_total,
        return_qty: 0,
        pending_return_qty: availableToReturn,
        already_returned: alreadyReturned,
        available_to_return: availableToReturn
      };
    });
    
    setInvoiceLineItems(lineItems);
  };

  const loadReturnOrders = async () => {
    if (!company?.id) return;
    
    const { data, error } = await supabase
      .from('return_order_header')
      .select('*')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      toast({ title: "Error", description: "Failed to load return orders", variant: "destructive" });
      return;
    }
    
    const returnOrdersData: ReturnOrder[] = (data || []).map(order => ({
      id: order.id,
      rso_number: order.rso_number || 'Pending',
      rso_date: order.rso_date,
      customer_name: order.customer_name,
      invoice_number: order.invoice_number,
      status: order.status as 'Draft' | 'Confirmed',
      reason_for_credit: order.reason_for_credit,
      total_amount: order.total_amount
    }));
    
    setReturnOrders(returnOrdersData);
  };

  const loadReturnStats = async () => {
    if (!company?.id) return;
    
    const { data, error } = await supabase.rpc('get_return_order_stats', {
      p_company_id: company.id
    });
    
    if (error) {
      console.error('Error loading return stats:', error);
      return;
    }
    
    setReturnStats(data as any);
  };

  const handleCustomerSelect = useCallback((customerId: string) => {
    console.debug('handleCustomerSelect called with:', customerId);
    const customer = customers.find(c => c.id === customerId);
    console.debug('Found customer:', customer);
    if (customer) {
      setSelectedCustomer(customer);
      loadInvoicesForCustomer(customerId);
      setSelectedInvoice(null);
      setInvoiceLineItems([]);
      setCreatedRsoNumber(null);
      setValidationErrors({});
    }
  }, [customers, company?.id]);

  const handleInvoiceSelect = useCallback((invoiceId: string) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    if (invoice) {
      setSelectedInvoice(invoice);
      loadInvoiceLineItems(invoiceId);
      setValidationErrors({});
    }
  }, [invoices]);

  const updateReturnQty = (lineItemId: string, returnQty: number) => {
    setInvoiceLineItems(prev => prev.map(item => {
      if (item.id === lineItemId) {
        const maxAllowed = item.available_to_return || 0;
        const validReturnQty = Math.max(0, Math.min(returnQty, maxAllowed));
        
        // Set validation error if exceeded
        if (returnQty > maxAllowed) {
          setValidationErrors(prev => ({
            ...prev,
            [lineItemId]: `Maximum ${maxAllowed} units available for return`
          }));
        } else {
          setValidationErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[lineItemId];
            return newErrors;
          });
        }
        
        return {
          ...item,
          return_qty: validReturnQty,
          pending_return_qty: maxAllowed - validReturnQty
        };
      }
      return item;
    }));
  };

  const calculateTotals = () => {
    const returnItems = invoiceLineItems.filter(item => item.return_qty > 0);
    const subtotal = returnItems.reduce((sum, item) => sum + (item.line_subtotal * item.return_qty / item.quantity_invoiced), 0);
    const taxAmount = returnItems.reduce((sum, item) => sum + (item.tax_amount * item.return_qty / item.quantity_invoiced), 0);
    const total = returnItems.reduce((sum, item) => sum + (item.line_total * item.return_qty / item.quantity_invoiced), 0);
    
    return { subtotal, taxAmount, total };
  };

  const resetForm = () => {
    setSelectedCustomer(null);
    setSelectedInvoice(null);
    setReasonForCredit('');
    setDeliverySameAsCompany(true);
    setDeliveryAddress({ address_line1: '', address_line2: '', city: '', country: '', pin_code: '' });
    setNotes('');
    setInvoiceLineItems([]);
    setInvoices([]);
    setCreatedRsoNumber(null);
    setEditingReturnId(null);
    setValidationErrors({});
    setReturnOrderDate(new Date().toISOString().split('T')[0]);
  };

  const handleSaveReturn = async () => {
    if (!selectedCustomer || !selectedInvoice || !reasonForCredit || !company?.id) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    const returnItems = invoiceLineItems.filter(item => item.return_qty > 0);
    if (returnItems.length === 0) {
      toast({ title: "Error", description: "Please select at least one item to return", variant: "destructive" });
      return;
    }

    // Check for validation errors
    if (Object.keys(validationErrors).length > 0) {
      toast({ title: "Error", description: "Please fix validation errors before saving", variant: "destructive" });
      return;
    }

    if (!deliverySameAsCompany && (!deliveryAddress.address_line1 || !deliveryAddress.city)) {
      toast({ title: "Error", description: "Please provide complete delivery address", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      const returnLinesData = returnItems.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku,
        hsn_sac_code: item.hsn_sac_code,
        unit_of_measure: item.unit_of_measure,
        invoice_qty: item.quantity_invoiced,
        return_qty: item.return_qty,
        unit_price: item.unit_price,
        discount_percentage: item.discount_percentage,
        discount_amount: item.discount_amount * item.return_qty / item.quantity_invoiced,
        cgst_rate: item.cgst_rate,
        cgst_amount: item.cgst_amount * item.return_qty / item.quantity_invoiced,
        sgst_rate: item.sgst_rate,
        sgst_amount: item.sgst_amount * item.return_qty / item.quantity_invoiced,
        igst_rate: item.igst_rate,
        igst_amount: item.igst_amount * item.return_qty / item.quantity_invoiced,
        line_subtotal: item.line_subtotal * item.return_qty / item.quantity_invoiced,
        tax_amount: item.tax_amount * item.return_qty / item.quantity_invoiced,
        line_total: item.line_total * item.return_qty / item.quantity_invoiced
      }));

      const { data, error } = await supabase.rpc('create_return_order', {
        p_company_id: company.id,
        p_customer_id: selectedCustomer.id,
        p_invoice_id: selectedInvoice.id,
        p_reason_for_credit: reasonForCredit,
        p_return_lines: returnLinesData,
        p_delivery_same_as_company: deliverySameAsCompany,
        p_delivery_address_line1: deliverySameAsCompany ? null : deliveryAddress.address_line1,
        p_delivery_address_line2: deliverySameAsCompany ? null : deliveryAddress.address_line2,
        p_delivery_city: deliverySameAsCompany ? null : deliveryAddress.city,
        p_delivery_country: deliverySameAsCompany ? null : deliveryAddress.country,
        p_delivery_pin_code: deliverySameAsCompany ? null : deliveryAddress.pin_code,
        p_notes: notes || null
      });

      if (error) throw error;

      const result = data as { success: boolean; rso_number: string; return_order_id: string };
      
      if (result.success) {
        toast({
          title: "Success",
          description: `Return order ${result.rso_number} created successfully`
        });
        
        setCreatedRsoNumber(result.rso_number);
        loadReturnOrders();
        loadReturnStats();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create return order",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReturn = async (returnOrderId: string) => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase.rpc('confirm_return_order', {
        p_return_order_id: returnOrderId
      });

      if (error) throw error;

      const result = data as { success: boolean; rso_number: string; items_processed: number };
      
      if (result.success) {
        toast({
          title: "Success",
          description: `Return order ${result.rso_number} confirmed successfully. ${result.items_processed} items processed.`
        });
        
        loadReturnOrders();
        loadReturnStats();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to confirm return order",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReturn = async (returnOrderId: string) => {
    setLoading(true);
    
    try {
      // Delete return order lines first
      const { error: linesError } = await supabase
        .from('return_order_lines')
        .delete()
        .eq('return_order_id', returnOrderId);

      if (linesError) throw linesError;

      // Delete return order header
      const { error: headerError } = await supabase
        .from('return_order_header')
        .delete()
        .eq('id', returnOrderId);

      if (headerError) throw headerError;

      toast({
        title: "Success",
        description: "Return order deleted successfully"
      });
      
      loadReturnOrders();
      loadReturnStats();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete return order",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditReturn = async (returnOrderId: string) => {
    // Load return order data and populate form
    const { data: headerData, error: headerError } = await supabase
      .from('return_order_header')
      .select('*')
      .eq('id', returnOrderId)
      .single();

    if (headerError) {
      toast({ title: "Error", description: "Failed to load return order", variant: "destructive" });
      return;
    }

    const { data: linesData, error: linesError } = await supabase
      .from('return_order_lines')
      .select('*')
      .eq('return_order_id', returnOrderId);

    if (linesError) {
      toast({ title: "Error", description: "Failed to load return order lines", variant: "destructive" });
      return;
    }

    // Find and set customer
    const customer = customers.find(c => c.id === headerData.customer_id);
    if (customer) {
      setSelectedCustomer(customer);
      await loadInvoicesForCustomer(customer.id);
      
      // Set invoice
      const invoice = {
        id: headerData.invoice_id,
        invoice_number: headerData.invoice_number,
        invoice_date: headerData.invoice_date,
        customer_name: headerData.customer_name,
        total_amount: 0 // Will be updated when invoices load
      };
      setSelectedInvoice(invoice);
      
      // Load and populate line items
      await loadInvoiceLineItems(headerData.invoice_id);
      
      // Update return quantities from saved data
      setInvoiceLineItems(prev => prev.map(item => {
        const savedLine = linesData.find(line => line.product_id === item.product_id);
        if (savedLine) {
          return {
            ...item,
            return_qty: savedLine.return_qty,
            pending_return_qty: item.available_to_return! - savedLine.return_qty
          };
        }
        return item;
      }));
    }

    // Set other form fields
    setReturnOrderDate(headerData.rso_date);
    setReasonForCredit(headerData.reason_for_credit);
    setDeliverySameAsCompany(headerData.delivery_same_as_company);
    if (!headerData.delivery_same_as_company) {
      setDeliveryAddress({
        address_line1: headerData.delivery_address_line1 || '',
        address_line2: headerData.delivery_address_line2 || '',
        city: headerData.delivery_city || '',
        country: headerData.delivery_country || '',
        pin_code: headerData.delivery_pin_code || ''
      });
    }
    setNotes(headerData.notes || '');
    setEditingReturnId(returnOrderId);
    setCreatedRsoNumber(headerData.rso_number);
    setIsCreateReturnFormOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft': return 'bg-yellow-500 hover:bg-yellow-600 text-white';
      case 'Confirmed': return 'bg-green-500 hover:bg-green-600 text-white';
      default: return 'bg-gray-500 hover:bg-gray-600 text-white';
    }
  };

  const { subtotal, taxAmount, total } = calculateTotals();

  const customerOptions = customers.map(customer => ({
    id: customer.id,
    name: customer.name,
    subtitle: customer.customer_ref
  }));

  const invoiceOptions = invoices.map(invoice => ({
    id: invoice.id,
    name: invoice.invoice_number,
    subtitle: `${invoice.invoice_date} - ₹${invoice.total_amount.toFixed(2)}`
  }));

  return (
    <PermissionWrapper section="returns">
      <div className="space-y-6">
        {/* Statistics Cards */}
        {returnStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Draft Orders</p>
                    <p className="text-2xl font-bold">{returnStats.draft_count}</p>
                  </div>
                  <Badge className="bg-yellow-500 text-white">Draft</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  ₹{returnStats.draft_amount.toFixed(2)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Confirmed Orders</p>
                    <p className="text-2xl font-bold">{returnStats.confirmed_count}</p>
                  </div>
                  <Badge className="bg-green-500 text-white">Confirmed</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  ₹{returnStats.confirmed_amount.toFixed(2)}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="returns" className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              Return Sales Orders
            </TabsTrigger>
            <TabsTrigger value="credit-notes" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Credit Notes
            </TabsTrigger>
          </TabsList>

          {/* Return Sales Orders Tab */}
          <TabsContent value="returns" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <RotateCcw className="h-6 w-6" />
                  Return Sales Orders
                </h2>
                <p className="text-muted-foreground">
                  Manage product returns from customers
                </p>
              </div>
              <PermissionButton 
                section="returns" 
                className="btn-gradient"
                onClick={() => {
                  resetForm();
                  setIsCreateReturnFormOpen(true);
                  // Ensure customers are loaded when form opens
                  if (customers.length === 0 && company?.id) {
                    loadCustomers();
                  }
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Return
              </PermissionButton>
            </div>

            {isCreateReturnFormOpen ? (
              /* Create/Edit Return Form */
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <RotateCcw className="h-5 w-5" />
                        {editingReturnId ? 'Edit Return Order' : 'Create Return Order'}
                      </CardTitle>
                      {createdRsoNumber && (
                        <div className="mt-2 flex items-center gap-2 text-green-600">
                          <Check className="h-4 w-4" />
                          <span className="font-medium">RSO #{createdRsoNumber} - Status: Draft</span>
                        </div>
                      )}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        resetForm();
                        setIsCreateReturnFormOpen(false);
                      }}
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to List
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Header Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="rso-date">Return Sales Order Date</Label>
                      <Input
                        id="rso-date"
                        type="date"
                        value={returnOrderDate}
                        onChange={(e) => setReturnOrderDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="customer">Customer Name *</Label>
                      <SearchableCombobox
                        value={selectedCustomer?.id}
                        onSelect={handleCustomerSelect}
                        placeholder="Search and select customer"
                        searchPlaceholder="Type to search customers..."
                        options={customerOptions}
                        disabled={editingReturnId !== null}
                      />
                    </div>
                  </div>

                  {/* Customer Registered Address */}
                  {selectedCustomer && (
                    <div>
                      <Label className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Customer Registered Address
                      </Label>
                      <div className="mt-2 p-3 bg-gray-50 border rounded-md text-sm">
                        <p>{selectedCustomer.address_line1 || 'No address line 1'}</p>
                        {selectedCustomer.address_line2 && <p>{selectedCustomer.address_line2}</p>}
                        <p>{selectedCustomer.city || ''}, {selectedCustomer.state || ''} {selectedCustomer.pin_code || ''}</p>
                        <p>{selectedCustomer.country || ''}</p>
                      </div>
                    </div>
                  )}

                  {/* Invoice Selection */}
                  {selectedCustomer && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="invoice">Invoice No *</Label>
                        <SearchableCombobox
                          value={selectedInvoice?.id}
                          onSelect={handleInvoiceSelect}
                          placeholder="Select invoice (last 365 days)"
                          searchPlaceholder="Type to search invoices..."
                          options={invoiceOptions}
                          disabled={editingReturnId !== null}
                        />
                      </div>
                      {selectedInvoice && (
                        <div>
                          <Label className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Invoice Date
                          </Label>
                          <Input
                            value={selectedInvoice.invoice_date}
                            disabled
                            className="bg-gray-50"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reason for Credit */}
                  <div>
                    <Label>Reason for Credit *</Label>
                    <RadioGroup value={reasonForCredit} onValueChange={setReasonForCredit} className="mt-2">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Return" id="return" />
                        <Label htmlFor="return">Return</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Price Correction" id="price-correction" />
                        <Label htmlFor="price-correction">Price Correction</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Discount" id="discount" />
                        <Label htmlFor="discount">Discount</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Others" id="others" />
                        <Label htmlFor="others">Others</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Delivery Address Section */}
                  <div className="space-y-4">
                    <Label>Return Delivery Address</Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="same-address"
                        checked={deliverySameAsCompany}
                        onCheckedChange={(checked) => setDeliverySameAsCompany(checked as boolean)}
                      />
                      <Label htmlFor="same-address">Same as company registered address</Label>
                    </div>

                    {deliverySameAsCompany ? (
                      company && (
                        <div className="p-3 bg-blue-50 border rounded-md text-sm">
                          <p className="font-medium">Company Address:</p>
                          <p>{(company as any).address_line1}</p>
                          {(company as any).address_line2 && <p>{(company as any).address_line2}</p>}
                          <p>{(company as any).city}, {(company as any).state} {(company as any).postal_code}</p>
                          <p>{(company as any).country}</p>
                        </div>
                      )
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="address1">Address Line 1 *</Label>
                          <Input
                            id="address1"
                            value={deliveryAddress.address_line1}
                            onChange={(e) => setDeliveryAddress(prev => ({ ...prev, address_line1: e.target.value }))}
                            placeholder="Enter address line 1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="address2">Address Line 2</Label>
                          <Input
                            id="address2"
                            value={deliveryAddress.address_line2}
                            onChange={(e) => setDeliveryAddress(prev => ({ ...prev, address_line2: e.target.value }))}
                            placeholder="Enter address line 2 (optional)"
                          />
                        </div>
                        <div>
                          <Label htmlFor="city">City *</Label>
                          <Input
                            id="city"
                            value={deliveryAddress.city}
                            onChange={(e) => setDeliveryAddress(prev => ({ ...prev, city: e.target.value }))}
                            placeholder="City"
                          />
                        </div>
                        <div>
                          <Label htmlFor="country">Country</Label>
                          <Input
                            id="country"
                            value={deliveryAddress.country}
                            onChange={(e) => setDeliveryAddress(prev => ({ ...prev, country: e.target.value }))}
                            placeholder="Country"
                          />
                        </div>
                        <div>
                          <Label htmlFor="pincode">Pin Code</Label>
                          <Input
                            id="pincode"
                            value={deliveryAddress.pin_code}
                            onChange={(e) => setDeliveryAddress(prev => ({ ...prev, pin_code: e.target.value }))}
                            placeholder="Pin Code"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Line Items Section */}
                  {invoiceLineItems.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Invoice Line Items</h3>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Product</TableHead>
                              <TableHead>SKU</TableHead>
                              <TableHead>HSN/SAC</TableHead>
                              <TableHead>UOM</TableHead>
                              <TableHead>Invoice Qty</TableHead>
                              <TableHead>Already Returned</TableHead>
                              <TableHead>Available</TableHead>
                              <TableHead>Return Qty</TableHead>
                              <TableHead>Pending</TableHead>
                              <TableHead>Unit Price</TableHead>
                              <TableHead>CGST %</TableHead>
                              <TableHead>SGST %</TableHead>
                              <TableHead>IGST %</TableHead>
                              <TableHead>Line Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {invoiceLineItems.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.product_name}</TableCell>
                                <TableCell>{item.product_sku}</TableCell>
                                <TableCell>{item.hsn_sac_code || '-'}</TableCell>
                                <TableCell>{item.unit_of_measure}</TableCell>
                                <TableCell>{item.quantity_invoiced}</TableCell>
                                <TableCell>{item.already_returned || 0}</TableCell>
                                <TableCell>{item.available_to_return || 0}</TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    <Input
                                      type="number"
                                      min="0"
                                      max={item.available_to_return || 0}
                                      value={item.return_qty}
                                      onChange={(e) => updateReturnQty(item.id, parseInt(e.target.value) || 0)}
                                      onBlur={(e) => {
                                        const value = parseInt(e.target.value) || 0;
                                        const max = item.available_to_return || 0;
                                        if (value > max) {
                                          setValidationErrors(prev => ({
                                            ...prev,
                                            [item.id]: `Maximum ${max} units available`
                                          }));
                                        }
                                      }}
                                      className={`w-20 ${validationErrors[item.id] ? 'border-red-500' : ''}`}
                                    />
                                    {validationErrors[item.id] && (
                                      <div className="flex items-center gap-1 text-xs text-red-500">
                                        <AlertCircle className="h-3 w-3" />
                                        <span>{validationErrors[item.id]}</span>
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>{item.pending_return_qty}</TableCell>
                                <TableCell>₹{item.unit_price.toFixed(2)}</TableCell>
                                <TableCell>{item.cgst_rate}%</TableCell>
                                <TableCell>{item.sgst_rate}%</TableCell>
                                <TableCell>{item.igst_rate}%</TableCell>
                                <TableCell>₹{(item.line_total * item.return_qty / item.quantity_invoiced).toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Totals */}
                      <div className="flex justify-end">
                        <div className="w-64 space-y-2 p-4 bg-gray-50 rounded-md">
                          <div className="flex justify-between">
                            <span>Subtotal:</span>
                            <span>₹{subtotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Tax Amount:</span>
                            <span>₹{taxAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between font-bold text-lg">
                            <span>Total:</span>
                            <span>₹{total.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Enter any additional notes..."
                      rows={3}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-between">
                    <div>
                      {createdRsoNumber && (
                        <Button
                          onClick={() => handleConfirmReturn(editingReturnId || '')}
                          disabled={loading || !editingReturnId}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <Check className="h-4 w-4 mr-2" />
                          {loading ? 'Confirming...' : 'Confirm Return'}
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-4">
                      <Button
                        variant="outline"
                        onClick={() => {
                          resetForm();
                          setIsCreateReturnFormOpen(false);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSaveReturn}
                        disabled={loading || !!createdRsoNumber}
                        className="btn-gradient"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {loading ? 'Saving...' : editingReturnId ? 'Update (Draft)' : 'Save (Draft)'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* Return Orders List */
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Return Orders</CardTitle>
                    <div className="flex gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <PermissionInput 
                          section="returns"
                          placeholder="Search returns..." 
                          className="pl-10 w-64" 
                        />
                      </div>
                      <PermissionButton section="returns" variant="outline" size="sm">
                        <Filter className="h-4 w-4 mr-2" />
                        Filter
                      </PermissionButton>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>RSO #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {returnOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8">
                            <div className="flex flex-col items-center gap-4">
                              <RotateCcw className="h-12 w-12 text-muted-foreground" />
                              <div>
                                <p className="text-lg font-semibold">No return orders yet</p>
                                <p className="text-muted-foreground">Return orders will appear here</p>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        returnOrders.map((returnOrder) => (
                          <TableRow key={returnOrder.id}>
                            <TableCell className="font-medium">{returnOrder.rso_number}</TableCell>
                            <TableCell>{new Date(returnOrder.rso_date).toLocaleDateString()}</TableCell>
                            <TableCell>{returnOrder.customer_name}</TableCell>
                            <TableCell>{returnOrder.invoice_number}</TableCell>
                            <TableCell>{returnOrder.reason_for_credit}</TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(returnOrder.status)}>
                                {returnOrder.status}
                              </Badge>
                            </TableCell>
                            <TableCell>₹{returnOrder.total_amount.toFixed(2)}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="outline" size="sm" title="View">
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {returnOrder.status === 'Draft' && (
                                  <>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      title="Edit"
                                      onClick={() => handleEditReturn(returnOrder.id)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      title="Confirm"
                                      onClick={() => handleConfirmReturn(returnOrder.id)}
                                      disabled={loading}
                                      className="bg-green-50 hover:bg-green-100"
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button 
                                          variant="outline" 
                                          size="sm" 
                                          title="Delete"
                                          className="text-red-600 hover:text-red-700"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Delete Return Order</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Are you sure you want to delete return order {returnOrder.rso_number}? This action cannot be undone.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction 
                                            onClick={() => handleDeleteReturn(returnOrder.id)}
                                            className="bg-red-600 hover:bg-red-700"
                                          >
                                            Delete
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Credit Notes Tab */}
          <TabsContent value="credit-notes" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <FileText className="h-6 w-6" />
                  Credit Notes
                </h2>
                <p className="text-muted-foreground">
                  Create and manage credit notes for customers
                </p>
              </div>
              <PermissionButton section="returns" className="btn-gradient">
                <Plus className="mr-2 h-4 w-4" />
                Create Credit Note
              </PermissionButton>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Credit Notes</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-semibold">Credit Notes Coming Soon</p>
                  <p className="text-muted-foreground">Credit note functionality will be available soon</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PermissionWrapper>
  );
}