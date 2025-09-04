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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

function SearchableCombobox({
  value,
  onSelect,
  placeholder,
  searchPlaceholder,
  options,
  disabled = false,
  loading = false,
  emptyMessage = "No options available",
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

  // Determine display text and button state
  const getDisplayText = () => {
    if (selectedOption) return selectedOption.name;
    if (loading) return "Loading...";
    return placeholder;
  };

  const isButtonDisabled = disabled || loading;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`w-full justify-between ${className}`}
          disabled={isButtonDisabled}
        >
          {getDisplayText()}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="z-[9999] w-[var(--radix-popover-trigger-width)] min-w-[20rem] p-0 bg-white shadow-lg border rounded-md"
        align="start"
        sideOffset={4}
      >
        <Command className="bg-white">
          <CommandInput 
            placeholder={searchPlaceholder}
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Loading options...
              </div>
            ) : options.length === 0 ? (
              <CommandEmpty>{emptyMessage}</CommandEmpty>
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
  const { company } = useAuth();
  const [activeTab, setActiveTab] = useState('returns');
  const [isCreateReturnFormOpen, setIsCreateReturnFormOpen] = useState(false);
  
  // Form state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const [reasonForCredit, setReasonForCredit] = useState<string>('');
  const [status, setStatus] = useState<'Draft' | 'Confirmed'>('Draft');
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
  const [viewingReturnId, setViewingReturnId] = useState<string | null>(null);
  const [isViewMode, setIsViewMode] = useState(false);

  // Data states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [returnOrders, setReturnOrders] = useState<ReturnOrder[]>([]);
  const [returnStats, setReturnStats] = useState<ReturnStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
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
        .order('name');
      
      if (error) {
        console.error('Error loading customers:', error);
        toast({ title: "Error", description: "Failed to load customers", variant: "destructive" });
        return;
      }
      
      console.debug('Loaded customers:', data?.length || 0);
      setCustomers(data || []);
      
      // Show toast if no customers found to inform user
      if (!data || data.length === 0) {
        console.warn('No customers found for company:', company.id);
        toast({ 
          title: "No Customers", 
          description: "No active customers found. Please add customers in the Sales section first.", 
          variant: "default" 
        });
      }
    } catch (error) {
      console.error('Customer loading exception:', error);
      toast({ title: "Error", description: "Failed to load customers", variant: "destructive" });
    } finally {
      setCustomersLoading(false);
    }
  };

  const loadInvoicesForCustomer = async (customerId: string) => {
    if (!company?.id) return;
    
    console.debug('Loading invoices for customer:', customerId);
    setInvoicesLoading(true);
    
    try {
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
        console.error('Error loading invoices:', error);
        toast({ title: "Error", description: "Failed to load invoices", variant: "destructive" });
        return;
      }
      
      console.debug('Loaded invoices:', data?.length || 0);
      setInvoices(data || []);
      
      // Show toast if no invoices found
      if (!data || data.length === 0) {
        console.warn('No finalized invoices found for customer in last 365 days:', customerId);
        toast({ 
          title: "No Invoices", 
          description: "No finalized invoices found for this customer in the last 365 days.", 
          variant: "default" 
        });
      }
    } catch (error) {
      console.error('Invoice loading exception:', error);
      toast({ title: "Error", description: "Failed to load invoices", variant: "destructive" });
    } finally {
      setInvoicesLoading(false);
    }
  };

  const loadInvoiceLineItems = async (invoiceId: string, existingReturnId?: string) => {
    // Load invoice items
    const { data: invoiceData, error: invoiceError } = await supabase
      .from('sales_invoice_items')
      .select('*')
      .eq('sales_invoice_id', invoiceId);
    
    if (invoiceError) {
      toast({ title: "Error", description: "Failed to load invoice items", variant: "destructive" });
      return;
    }

    // If we're viewing an existing return order, load the return data
    if (existingReturnId && isViewMode) {
      const { data: returnData, error: returnError } = await supabase
        .from('return_order_lines')
        .select('*')
        .eq('return_order_id', existingReturnId);
      
      if (returnError) {
        console.error('Error loading return order lines:', returnError);
        toast({ title: "Error", description: "Failed to load return order data", variant: "destructive" });
        return;
      }

      // Map existing return order data to line items for viewing
      const lineItems: InvoiceLineItem[] = (returnData || []).map(returnItem => {
        const invoiceItem = invoiceData?.find(inv => inv.product_id === returnItem.product_id);
        
        return {
          id: returnItem.id,
          product_id: returnItem.product_id,
          product_name: returnItem.product_name,
          product_sku: returnItem.product_sku,
          hsn_sac_code: returnItem.hsn_sac_code,
          unit_of_measure: returnItem.unit_of_measure,
          quantity_invoiced: returnItem.invoice_qty,
          unit_price: returnItem.unit_price,
          discount_percentage: returnItem.discount_percentage || 0,
          discount_amount: returnItem.discount_amount,
          cgst_rate: returnItem.cgst_rate || 0,
          cgst_amount: returnItem.cgst_amount || 0,
          sgst_rate: returnItem.sgst_rate || 0,
          sgst_amount: returnItem.sgst_amount || 0,
          igst_rate: returnItem.igst_rate || 0,
          igst_amount: returnItem.igst_amount || 0,
          line_subtotal: returnItem.line_subtotal,
          tax_amount: returnItem.tax_amount,
          line_total: returnItem.line_total,
          return_qty: returnItem.return_qty,
          pending_return_qty: returnItem.pending_return_qty, // Use stored value from database
          already_returned: returnItem.invoice_qty - returnItem.return_qty - returnItem.pending_return_qty,
          available_to_return: returnItem.pending_return_qty + returnItem.return_qty
        };
      });
      
      setInvoiceLineItems(lineItems);
      return;
    }

    // Original logic for creating new RSOs
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
      // Clear previous invoices and line items
      setSelectedInvoice(null);
      setInvoices([]);
      setInvoiceLineItems([]);
      setCreatedRsoNumber(null);
      setValidationErrors({});
      // Load invoices for selected customer
      loadInvoicesForCustomer(customerId);
    }
  }, [customers, company?.id]);

  const handleInvoiceSelect = useCallback((invoiceId: string) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    if (invoice) {
      setSelectedInvoice(invoice);
      loadInvoiceLineItems(invoiceId, viewingReturnId || undefined);
      setValidationErrors({});
    }
  }, [invoices, viewingReturnId]);

  const viewReturnOrder = async (returnOrderId: string) => {
    try {
      setLoading(true);
      
      // Load return order header
      const { data: headerData, error: headerError } = await supabase
        .from('return_order_header')
        .select('*')
        .eq('id', returnOrderId)
        .single();
      
      if (headerError) {
        console.error('Error loading return order header:', headerError);
        toast({ title: "Error", description: "Failed to load return order", variant: "destructive" });
        return;
      }

      // Set viewing mode and states
      setIsViewMode(true);
      setViewingReturnId(returnOrderId);
      setIsCreateReturnFormOpen(true);
      
      // Find and set the customer
      const customer = customers.find(c => c.id === headerData.customer_id);
      if (customer) {
        setSelectedCustomer(customer);
        
        // Load invoices for the customer
        await loadInvoicesForCustomer(headerData.customer_id);
        
        // Find and set the invoice
        const invoice = {
          id: headerData.invoice_id,
          invoice_number: headerData.invoice_number,
          invoice_date: headerData.invoice_date,
          customer_name: headerData.customer_name,
          total_amount: 0 // We don't need this for viewing
        };
        setSelectedInvoice(invoice);
        
        // Load the line items with existing return data
        await loadInvoiceLineItems(headerData.invoice_id, returnOrderId);
      }
      
      // Set other form fields
      setReasonForCredit(headerData.reason_for_credit);
      setStatus(headerData.status as 'Draft' | 'Confirmed');
      setDeliverySameAsCompany(headerData.delivery_same_as_company);
      setReturnOrderDate(headerData.rso_date);
      setNotes(headerData.notes || '');
      
      if (!headerData.delivery_same_as_company) {
        setDeliveryAddress({
          address_line1: headerData.delivery_address_line1 || '',
          address_line2: headerData.delivery_address_line2 || '',
          city: headerData.delivery_city || '',
          country: headerData.delivery_country || '',
          pin_code: headerData.delivery_pin_code || ''
        });
      }
      
    } catch (error) {
      console.error('Error viewing return order:', error);
      toast({ title: "Error", description: "Failed to load return order", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const updateReturnQty = (lineItemId: string, returnQty: number) => {
    // In view mode, don't allow editing
    if (isViewMode) {
      return;
    }

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
        
        // Recalculate all amounts based on new quantity
        const baseAmount = item.unit_price * validReturnQty;
        const discountAmount = (baseAmount * item.discount_percentage) / 100;
        const lineSubtotal = baseAmount - discountAmount;
        
        // Calculate tax on net amount (after discount)
        const cgstAmount = (lineSubtotal * item.cgst_rate) / 100;
        const sgstAmount = (lineSubtotal * item.sgst_rate) / 100;
        const igstAmount = (lineSubtotal * item.igst_rate) / 100;
        const taxAmount = cgstAmount + sgstAmount + igstAmount;
        
        return {
          ...item,
          return_qty: validReturnQty,
          pending_return_qty: Math.max(0, maxAllowed - validReturnQty),
          discount_amount: discountAmount,
          line_subtotal: lineSubtotal,
          cgst_amount: cgstAmount,
          sgst_amount: sgstAmount,
          igst_amount: igstAmount,
          tax_amount: taxAmount,
          line_total: lineSubtotal + taxAmount
        };
      }
      return item;
    }));
  };

  const updateItemDiscount = (lineItemId: string, discountPercentage: number) => {
    // Clamp discount percentage between 0 and 100
    const clampedDiscount = Math.max(0, Math.min(100, discountPercentage));
    
    setInvoiceLineItems(prev => prev.map(item => {
      if (item.id === lineItemId) {
        const updatedItem = { ...item, discount_percentage: clampedDiscount };
        
        // Recalculate amounts based on return quantity
        const baseAmount = updatedItem.unit_price * updatedItem.return_qty;
        const discountAmount = (baseAmount * clampedDiscount) / 100;
        const lineSubtotal = baseAmount - discountAmount;
        
        // Calculate tax on net amount (after discount)
        const cgstAmount = (lineSubtotal * updatedItem.cgst_rate) / 100;
        const sgstAmount = (lineSubtotal * updatedItem.sgst_rate) / 100;
        const igstAmount = (lineSubtotal * updatedItem.igst_rate) / 100;
        const taxAmount = cgstAmount + sgstAmount + igstAmount;
        
        updatedItem.discount_amount = discountAmount;
        updatedItem.line_subtotal = lineSubtotal;
        updatedItem.cgst_amount = cgstAmount;
        updatedItem.sgst_amount = sgstAmount;
        updatedItem.igst_amount = igstAmount;
        updatedItem.tax_amount = taxAmount;
        updatedItem.line_total = lineSubtotal + taxAmount;
        
        return updatedItem;
      }
      return item;
    }));
  };

  const updateItemTaxRate = (lineItemId: string, field: 'cgst_rate' | 'sgst_rate' | 'igst_rate', value: number) => {
    setInvoiceLineItems(prev => prev.map(item => {
      if (item.id === lineItemId) {
        const updatedItem = { ...item, [field]: value };
        
        // Recalculate tax amounts based on line subtotal (after discount)
        const baseAmount = updatedItem.unit_price * updatedItem.return_qty;
        const discountAmount = (baseAmount * updatedItem.discount_percentage) / 100;
        const lineSubtotal = baseAmount - discountAmount;
        
        updatedItem.cgst_amount = (lineSubtotal * updatedItem.cgst_rate) / 100;
        updatedItem.sgst_amount = (lineSubtotal * updatedItem.sgst_rate) / 100;
        updatedItem.igst_amount = (lineSubtotal * updatedItem.igst_rate) / 100;
        updatedItem.tax_amount = updatedItem.cgst_amount + updatedItem.sgst_amount + updatedItem.igst_amount;
        updatedItem.line_total = lineSubtotal + updatedItem.tax_amount;
        
        return updatedItem;
      }
      return item;
    }));
  };

  const calculateTotals = () => {
    const returnItems = invoiceLineItems.filter(item => item.return_qty > 0);
    const subtotal = returnItems.reduce((sum, item) => {
      const baseAmount = item.unit_price * item.return_qty;
      return sum + baseAmount;
    }, 0);
    
    const discountAmount = returnItems.reduce((sum, item) => {
      const baseAmount = item.unit_price * item.return_qty;
      const discount = (baseAmount * item.discount_percentage) / 100;
      return sum + discount;
    }, 0);
    
    const taxAmount = returnItems.reduce((sum, item) => {
      return sum + item.tax_amount;
    }, 0);
    
    const total = subtotal - discountAmount + taxAmount;
    
    return { subtotal, discountAmount, taxAmount, total };
  };

  const resetForm = () => {
    setSelectedCustomer(null);
    setSelectedInvoice(null);
    setReasonForCredit('');
    setStatus('Draft');
    setDeliverySameAsCompany(true);
    setDeliveryAddress({ address_line1: '', address_line2: '', city: '', country: '', pin_code: '' });
    setNotes('');
    setInvoiceLineItems([]);
    setInvoices([]);
    setCreatedRsoNumber(null);
    setEditingReturnId(null);
    setValidationErrors({});
    setReturnOrderDate(new Date().toISOString().split('T')[0]);
    // Reset loading states (but don't clear customers list)
    setInvoicesLoading(false);
  };

  const handleSaveReturn = async () => {
    if (!selectedCustomer || !selectedInvoice || !reasonForCredit || !company?.id) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    // Map UI reason values to valid database constraints
    const mapReasonForCredit = (reason: string) => {
      const validReasons = ['Return', 'Price Correction', 'Discount', 'Others'];
      if (validReasons.includes(reason)) return reason;
      
      // Map deprecated reasons to 'Return'
      if (['Defective', 'Damaged'].includes(reason)) return 'Return';
      
      return 'Others'; // fallback
    };

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
      const safeNum = (n: any) => {
        const v = Number(n);
        return Number.isFinite(v) ? v : 0;
      };
      const proRate = (amount: any, item: InvoiceLineItem) => {
        const qty = safeNum(item.quantity_invoiced);
        const ret = safeNum(item.return_qty);
        if (qty <= 0 || ret <= 0) return 0;
        return safeNum(amount) * (ret / qty);
      };

      const returnLinesData = returnItems.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku,
        hsn_sac_code: item.hsn_sac_code,
        unit_of_measure: item.unit_of_measure,
        invoice_qty: safeNum(item.quantity_invoiced),
        return_qty: safeNum(item.return_qty),
        unit_price: safeNum(item.unit_price),
        discount_percentage: safeNum(item.discount_percentage),
        discount_amount: safeNum(item.discount_amount), // Use edited amount
        cgst_rate: safeNum(item.cgst_rate),
        cgst_amount: safeNum(item.cgst_amount), // Use recalculated amount
        sgst_rate: safeNum(item.sgst_rate),
        sgst_amount: safeNum(item.sgst_amount), // Use recalculated amount
        igst_rate: safeNum(item.igst_rate),
        igst_amount: safeNum(item.igst_amount), // Use recalculated amount
        line_subtotal: safeNum(item.line_subtotal), // Use recalculated subtotal
        tax_amount: safeNum(item.tax_amount), // Use recalculated tax
        line_total: safeNum(item.line_total) // Use recalculated total
      }));

      // Map UI reason values to valid database constraints
      const mapReasonForCredit = (reason: string) => {
        const validReasons = ['Return', 'Price Correction', 'Discount', 'Others'];
        if (validReasons.includes(reason)) return reason;
        
        // Map deprecated reasons to 'Return'
        if (['Defective', 'Damaged'].includes(reason)) return 'Return';
        
        return 'Others'; // fallback
      };

      // Map reason and append original to notes if needed
      const mappedReason = mapReasonForCredit(reasonForCredit);
      const enhancedNotes = mappedReason !== reasonForCredit 
        ? `${notes ? notes + '\n\n' : ''}Original reason: ${reasonForCredit}`.trim()
        : notes;

      console.debug('Reason mapping:', { original: reasonForCredit, mapped: mappedReason });

      const { data, error } = await supabase.rpc('create_return_order', {
        p_company_id: company.id,
        p_customer_id: selectedCustomer.id,
        p_invoice_id: selectedInvoice.id,
        p_reason_for_credit: mappedReason,
        p_return_lines: returnLinesData,
        p_delivery_same_as_company: deliverySameAsCompany,
        p_delivery_address_line1: deliverySameAsCompany ? null : deliveryAddress.address_line1,
        p_delivery_address_line2: deliverySameAsCompany ? null : deliveryAddress.address_line2,
        p_delivery_city: deliverySameAsCompany ? null : deliveryAddress.city,
        p_delivery_country: deliverySameAsCompany ? null : deliveryAddress.country,
        p_delivery_pin_code: deliverySameAsCompany ? null : deliveryAddress.pin_code,
        p_notes: enhancedNotes || null,
        p_status: status
      });

      if (error) throw error;

      const result = data as { success: boolean; rso_number?: string; return_order_id?: string; error?: string };

      console.debug('create_return_order result:', result);
      if (result && result.success) {
        toast({
          title: "Success",
          description: `Return order ${result.rso_number} created successfully`
        });
        setCreatedRsoNumber(result.rso_number || null);
        loadReturnOrders();
        loadReturnStats();
        setTimeout(() => {
          resetForm();
          setIsCreateReturnFormOpen(false);
        }, 1000);
      } else {
        const errorMsg = (result && (result.error || JSON.stringify(result))) || 'Failed to create return order';
        console.error('create_return_order returned failure:', result);
        toast({ title: 'Error', description: errorMsg, variant: 'destructive' });
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

  const handleDeleteConfirmedReturn = async (returnOrderId: string) => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase.rpc('delete_confirmed_return_order', {
        p_return_order_id: returnOrderId
      });

      if (error) throw error;

      // Type cast the response as it's returned as Json
      const result = data as { success: boolean; error?: string; rso_number?: string; message?: string };

      if (result.success) {
        toast({ 
          title: "Success", 
          description: `Return order ${result.rso_number || ''} deleted and inventory reversed successfully`
        });
        loadReturnOrders();
        loadReturnStats();
      } else {
        throw new Error(result.error || 'Failed to delete confirmed return order');
      }
    } catch (error: any) {
      console.error('Delete confirmed return error:', error);
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete confirmed return order",
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
      .maybeSingle();

    if (headerError) {
      toast({ title: "Error", description: "Failed to load return order", variant: "destructive" });
      return;
    }

    if (!headerData) {
      toast({ title: "Error", description: "Return order not found", variant: "destructive" });
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
          const savedPending = (savedLine as any).pending_return_qty ?? undefined;
          const savedReturn = (savedLine as any).return_qty ?? 0;
          const computedPending = (item.available_to_return || 0) - savedReturn;
          return {
            ...item,
            return_qty: savedReturn,
            pending_return_qty: Math.max(0, savedPending !== undefined ? savedPending : computedPending),
            available_to_return: (savedPending || 0) + savedReturn
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

  const { subtotal, discountAmount, taxAmount, total } = calculateTotals();

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
            <Card className="shadow-md border-l-4 border-l-yellow-500">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Draft Orders</p>
                    <p className="text-3xl font-bold text-yellow-600">{returnStats.draft_count}</p>
                  </div>
                  <Badge className="bg-yellow-500 text-white shadow-sm">Draft</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  ₹{returnStats.draft_amount.toFixed(2)}
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-md border-l-4 border-l-green-500">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Confirmed Orders</p>
                    <p className="text-3xl font-bold text-green-600">{returnStats.confirmed_count}</p>
                  </div>
                  <Badge className="bg-green-500 text-white shadow-sm">Confirmed</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  ₹{returnStats.confirmed_amount.toFixed(2)}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 rounded-lg">
            <TabsTrigger value="returns" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <RotateCcw className="h-4 w-4" />
              Return Sales Orders
            </TabsTrigger>
            <TabsTrigger value="credit-notes" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <FileText className="h-4 w-4" />
              Credit Notes
            </TabsTrigger>
          </TabsList>

          {/* Return Sales Orders Tab */}
          <TabsContent value="returns" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-bold flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <RotateCcw className="h-6 w-6 text-primary" />
                  </div>
                  Return Sales Orders
                </h2>
                <p className="text-muted-foreground mt-1">
                  Manage product returns from customers with enhanced tracking
                </p>
              </div>
              <PermissionButton 
                section="returns" 
                className="btn-gradient hover:scale-105 transition-all duration-200 shadow-lg"
                onClick={() => {
                  resetForm();
                  setIsCreateReturnFormOpen(true);
                  // Always reload customers when form opens to ensure fresh data
                  if (company?.id) {
                    console.debug('Create Return clicked - reloading customers');
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
              <Card className="shadow-lg border-0 bg-gradient-to-br from-background to-muted/20">
                <CardHeader className="bg-gradient-to-r from-primary/10 to-secondary/10 border-b border-primary/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-3 text-xl">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <RotateCcw className="h-5 w-5 text-primary" />
                        </div>
                        {editingReturnId ? 'Edit Return Order' : 'Create Return Order'}
                      </CardTitle>
                      {createdRsoNumber && (
                        <div className="mt-3 flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg border border-green-200 animate-fade-in">
                          <Check className="h-5 w-5" />
                          <span className="font-semibold">RSO #{createdRsoNumber} created successfully!</span>
                          <span className="text-sm text-green-600">Auto-closing in a moment...</span>
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
                      className="hover:bg-muted hover:scale-105 transition-all duration-200"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to List
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-8 p-8">
                  {/* Header Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-card border border-border/50 rounded-lg shadow-sm">
                    <div>
                      <Label htmlFor="rso-date" className="text-sm font-medium">Return Sales Order Date</Label>
                      <Input
                        id="rso-date"
                        type="date"
                        value={returnOrderDate}
                        onChange={(e) => setReturnOrderDate(e.target.value)}
                        className="mt-1 transition-all hover:border-primary/50 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <Label htmlFor="customer" className="text-sm font-medium">Customer Name *</Label>
                      <div className="mt-1">
                        <SearchableCombobox
                          value={selectedCustomer?.id}
                          onSelect={handleCustomerSelect}
                          placeholder="Search and select customer"
                          searchPlaceholder="Type to search customers..."
                          options={customerOptions}
                          disabled={editingReturnId !== null || isViewMode}
                          loading={customersLoading}
                          emptyMessage="No customers found. Please add customers in the Sales section first."
                          className="hover:border-primary/50"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Customer Registered Address */}
                  {selectedCustomer && (
                    <div className="p-6 bg-card border border-border/50 rounded-lg shadow-sm">
                      <Label className="flex items-center gap-2 text-sm font-medium mb-3">
                        <MapPin className="h-4 w-4 text-primary" />
                        Customer Registered Address
                      </Label>
                      <div className="p-4 bg-muted/30 border border-border rounded-md text-sm">
                        <p className="font-medium">{selectedCustomer.address_line1 || 'No address line 1'}</p>
                        {selectedCustomer.address_line2 && <p>{selectedCustomer.address_line2}</p>}
                        <p>{selectedCustomer.city || ''}, {selectedCustomer.state || ''} {selectedCustomer.pin_code || ''}</p>
                        <p>{selectedCustomer.country || ''}</p>
                      </div>
                    </div>
                  )}

                  {/* Invoice Selection */}
                  {selectedCustomer && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-card border border-border/50 rounded-lg shadow-sm">
                      <div>
                        <Label htmlFor="invoice" className="text-sm font-medium">Invoice No *</Label>
                        <div className="mt-1">
                          <SearchableCombobox
                            value={selectedInvoice?.id}
                            onSelect={handleInvoiceSelect}
                            placeholder="Search and select invoice"
                            searchPlaceholder="Type to search invoices..."
                            options={invoiceOptions}
                            disabled={editingReturnId !== null || isViewMode}
                            loading={invoicesLoading}
                            emptyMessage="No finalized invoices found for this customer in the last 365 days."
                            className="hover:border-primary/50"
                          />
                        </div>
                      </div>
                      {selectedInvoice && (
                        <div>
                          <Label className="text-sm font-medium flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-secondary" />
                            Invoice Details
                          </Label>
                          <div className="mt-1 p-4 bg-secondary/10 border border-secondary/20 rounded-md text-sm">
                            <p><span className="font-medium">Date:</span> {selectedInvoice.invoice_date}</p>
                            <p><span className="font-medium">Customer:</span> {selectedInvoice.customer_name}</p>
                            <p><span className="font-medium">Amount:</span> ₹{selectedInvoice.total_amount.toFixed(2)}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                   {/* Reason for Credit */}
                  <div className="p-6 bg-card border border-border/50 rounded-lg shadow-sm">
                    <Label className="text-sm font-medium">Reason for Credit *</Label>
                    <p className="text-xs text-muted-foreground mt-1">Select the primary reason for this return</p>
                    <RadioGroup 
                      value={reasonForCredit} 
                      onValueChange={setReasonForCredit}
                      className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Defective" id="defective" />
                        <Label htmlFor="defective" className="text-sm">Defective</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Damaged" id="damaged" />
                        <Label htmlFor="damaged" className="text-sm">Damaged</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Price Correction" id="price-correction" />
                        <Label htmlFor="price-correction" className="text-sm">Price Correction</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Discount" id="discount" />
                        <Label htmlFor="discount" className="text-sm">Discount</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Others" id="others" />
                        <Label htmlFor="others" className="text-sm">Others</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Status */}
                  <div className="p-6 bg-card border border-border/50 rounded-lg shadow-sm">
                    <Label className="text-sm font-medium">Status *</Label>
                    <Select value={status} onValueChange={(value) => setStatus(value as 'Draft' | 'Confirmed')}>
                      <SelectTrigger className="mt-2 hover:border-primary/50 focus:ring-primary">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Draft">Draft</SelectItem>
                        <SelectItem value="Confirmed">Confirmed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Delivery Address Section */}
                  <div className="space-y-4 p-6 bg-card border border-border/50 rounded-lg shadow-sm">
                    <Label className="text-sm font-medium">Return Delivery Address</Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="same-address"
                        checked={deliverySameAsCompany}
                        onCheckedChange={(checked) => setDeliverySameAsCompany(checked as boolean)}
                      />
                      <Label htmlFor="same-address" className="text-sm">Same as company registered address</Label>
                    </div>

                    {deliverySameAsCompany ? (
                      company && (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md text-sm">
                          <p className="font-medium text-blue-900">Company Address:</p>
                          <p className="text-blue-800">{(company as any).address_line1}</p>
                          {(company as any).address_line2 && <p className="text-blue-800">{(company as any).address_line2}</p>}
                          <p className="text-blue-800">{(company as any).city}, {(company as any).state} {(company as any).postal_code}</p>
                          <p className="text-blue-800">{(company as any).country}</p>
                        </div>
                      )
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="address1" className="text-sm font-medium">Address Line 1 *</Label>
                          <Input
                            id="address1"
                            value={deliveryAddress.address_line1}
                            onChange={(e) => setDeliveryAddress(prev => ({ ...prev, address_line1: e.target.value }))}
                            placeholder="Enter address line 1"
                            className="mt-1 hover:border-primary/50 focus:ring-primary"
                          />
                        </div>
                        <div>
                          <Label htmlFor="address2" className="text-sm font-medium">Address Line 2</Label>
                          <Input
                            id="address2"
                            value={deliveryAddress.address_line2}
                            onChange={(e) => setDeliveryAddress(prev => ({ ...prev, address_line2: e.target.value }))}
                            placeholder="Enter address line 2 (optional)"
                            className="mt-1 hover:border-primary/50 focus:ring-primary"
                          />
                        </div>
                        <div>
                          <Label htmlFor="city" className="text-sm font-medium">City *</Label>
                          <Input
                            id="city"
                            value={deliveryAddress.city}
                            onChange={(e) => setDeliveryAddress(prev => ({ ...prev, city: e.target.value }))}
                            placeholder="City"
                            className="mt-1 hover:border-primary/50 focus:ring-primary"
                          />
                        </div>
                        <div>
                          <Label htmlFor="country" className="text-sm font-medium">Country</Label>
                          <Input
                            id="country"
                            value={deliveryAddress.country}
                            onChange={(e) => setDeliveryAddress(prev => ({ ...prev, country: e.target.value }))}
                            placeholder="Country"
                            className="mt-1 hover:border-primary/50 focus:ring-primary"
                          />
                        </div>
                        <div>
                          <Label htmlFor="pincode" className="text-sm font-medium">Pin Code</Label>
                          <Input
                            id="pincode"
                            value={deliveryAddress.pin_code}
                            onChange={(e) => setDeliveryAddress(prev => ({ ...prev, pin_code: e.target.value }))}
                            placeholder="Pin Code"
                            className="mt-1 hover:border-primary/50 focus:ring-primary"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Line Items Section */}
                  {invoiceLineItems.length > 0 && (
                    <div className="space-y-6 p-6 bg-card border border-border/50 rounded-lg shadow-sm">
                      <div className="flex items-center gap-3 pb-4 border-b border-border/50">
                        <div className="p-2 bg-secondary/10 rounded-lg">
                          <FileText className="h-5 w-5 text-secondary" />
                        </div>
                        <h3 className="text-xl font-semibold">Invoice Line Items</h3>
                        <Badge variant="outline" className="ml-auto">
                          {invoiceLineItems.length} items
                        </Badge>
                      </div>
                      <div className="overflow-x-auto rounded-lg border border-border/50">
                        <Table className="border-separate border-spacing-0">
                          <TableHeader>
                            <TableRow className="bg-gradient-to-r from-primary/5 to-secondary/5">
                              <TableHead className="font-semibold text-foreground border-b-2 border-primary/20">Product</TableHead>
                              <TableHead className="font-semibold text-foreground border-b-2 border-primary/20">SKU</TableHead>
                              <TableHead className="font-semibold text-foreground border-b-2 border-primary/20">HSN/SAC</TableHead>
                              <TableHead className="font-semibold text-foreground border-b-2 border-primary/20">UOM</TableHead>
                              <TableHead className="font-semibold text-foreground border-b-2 border-primary/20">Invoice Qty</TableHead>
                              <TableHead className="font-semibold text-foreground border-b-2 border-primary/20">Already Returned</TableHead>
                              <TableHead className="font-semibold text-foreground border-b-2 border-primary/20">Available</TableHead>
                              <TableHead className="font-semibold text-foreground border-b-2 border-primary/20">Return Qty</TableHead>
                              <TableHead className="font-semibold text-foreground border-b-2 border-primary/20">Pending</TableHead>
                              <TableHead className="font-semibold text-foreground border-b-2 border-primary/20">Unit Price</TableHead>
                              <TableHead className="font-semibold text-foreground border-b-2 border-primary/20">Discount %</TableHead>
                              <TableHead className="font-semibold text-foreground border-b-2 border-primary/20">CGST %</TableHead>
                              <TableHead className="font-semibold text-foreground border-b-2 border-primary/20">SGST %</TableHead>
                              <TableHead className="font-semibold text-foreground border-b-2 border-primary/20">IGST %</TableHead>
                              <TableHead className="font-semibold text-foreground border-b-2 border-primary/20">Line Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {invoiceLineItems.map((item, index) => (
                              <TableRow key={item.id} className={`hover:bg-accent/50 transition-colors ${index % 2 === 0 ? 'bg-muted/20' : 'bg-background'}`}>
                                <TableCell className="font-medium py-4">{item.product_name}</TableCell>
                                <TableCell className="py-4">{item.product_sku}</TableCell>
                                <TableCell className="py-4">{item.hsn_sac_code || '-'}</TableCell>
                                <TableCell className="py-4">{item.unit_of_measure}</TableCell>
                                <TableCell className="py-4 text-center font-medium">{item.quantity_invoiced}</TableCell>
                                <TableCell className="py-4 text-center text-red-600 font-medium">{item.already_returned || 0}</TableCell>
                                <TableCell className="py-4 text-center text-green-600 font-medium">{item.available_to_return || 0}</TableCell>
                                <TableCell className="py-4">
                                  <div className="space-y-1">
                                     <Input
                                       type="number"
                                       min="0"
                                       max={item.available_to_return || 0}
                                       value={item.return_qty}
                                       onChange={(e) => updateReturnQty(item.id, parseInt(e.target.value) || 0)}
                                       onBlur={(e) => {
                                         const value = parseInt(e.target.value) || 0;
                                         updateReturnQty(item.id, value);
                                       }}
                                       disabled={isViewMode || (item.available_to_return || 0) <= 0}
                                       readOnly={isViewMode}
                                       className={`w-20 text-center font-medium transition-all ${
                                         isViewMode 
                                           ? 'bg-muted cursor-not-allowed' 
                                           : validationErrors[item.id] 
                                             ? 'border-destructive focus:ring-destructive' 
                                             : 'focus:ring-primary border-input hover:border-primary/50'
                                       }`}
                                     />
                                    {validationErrors[item.id] && (
                                      <div className="flex items-center gap-1 text-xs text-destructive animate-fade-in">
                                        <AlertCircle className="h-3 w-3" />
                                        <span>{validationErrors[item.id]}</span>
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="py-4 text-center text-blue-600 font-medium">{item.pending_return_qty}</TableCell>
                                <TableCell className="py-4 font-semibold">₹{item.unit_price.toFixed(2)}</TableCell>
                                <TableCell className="py-4">
                                  <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={item.discount_percentage}
                                    onChange={(e) => updateItemDiscount(item.id, parseFloat(e.target.value) || 0)}
                                    className="w-16 text-center text-sm border-muted hover:border-primary/50 focus:ring-primary"
                                  />
                                </TableCell>
                                <TableCell className="py-4">
                                  <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={item.cgst_rate}
                                    onChange={(e) => updateItemTaxRate(item.id, 'cgst_rate', parseFloat(e.target.value) || 0)}
                                    className="w-16 text-center text-sm border-muted hover:border-primary/50 focus:ring-primary"
                                  />
                                </TableCell>
                                <TableCell className="py-4">
                                  <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={item.sgst_rate}
                                    onChange={(e) => updateItemTaxRate(item.id, 'sgst_rate', parseFloat(e.target.value) || 0)}
                                    className="w-16 text-center text-sm border-muted hover:border-primary/50 focus:ring-primary"
                                  />
                                </TableCell>
                                <TableCell className="py-4">
                                  <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={item.igst_rate}
                                    onChange={(e) => updateItemTaxRate(item.id, 'igst_rate', parseFloat(e.target.value) || 0)}
                                    className="w-16 text-center text-sm border-muted hover:border-primary/50 focus:ring-primary"
                                  />
                                </TableCell>
                                <TableCell className="py-4 font-bold text-lg text-primary">₹{(item.line_total * item.return_qty / item.quantity_invoiced).toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                       {/* Totals */}
                       <div className="flex justify-end">
                         <div className="w-80 space-y-3 p-6 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-lg border border-primary/20 shadow-sm">
                           <div className="flex justify-between items-center text-sm">
                             <span className="text-muted-foreground">Subtotal:</span>
                             <span className="font-medium">₹{subtotal.toFixed(2)}</span>
                           </div>
                           <div className="flex justify-between items-center text-sm">
                             <span className="text-muted-foreground">Total Discount:</span>
                             <span className="font-medium text-amber-700">-₹{discountAmount.toFixed(2)}</span>
                           </div>
                           <div className="flex justify-between items-center text-sm">
                             <span className="text-muted-foreground">Tax Amount:</span>
                             <span className="font-medium">₹{taxAmount.toFixed(2)}</span>
                           </div>
                           <div className="border-t border-primary/20 pt-3">
                             <div className="flex justify-between items-center font-bold text-xl">
                               <span className="text-primary">Total:</span>
                               <span className="text-primary">₹{total.toFixed(2)}</span>
                             </div>
                           </div>
                         </div>
                       </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div className="p-6 bg-card border border-border/50 rounded-lg shadow-sm">
                    <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Enter any additional notes..."
                      rows={3}
                      className="mt-2 hover:border-primary/50 focus:ring-primary"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-between p-6 bg-muted/30 border border-border/50 rounded-lg">
                    <div>
                      {createdRsoNumber && (
                        <Button
                          onClick={() => handleConfirmReturn(editingReturnId || '')}
                          disabled={loading || !editingReturnId}
                          className="bg-green-600 hover:bg-green-700 text-white hover:scale-105 transition-all duration-200 shadow-lg"
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
                        className="hover:bg-muted hover:scale-105 transition-all duration-200"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSaveReturn}
                        disabled={loading || !!createdRsoNumber}
                        className="btn-gradient hover:scale-105 transition-all duration-200 shadow-lg"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {loading ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* Return Orders List */
              <Card className="shadow-lg">
                <CardHeader className="bg-gradient-to-r from-background to-muted/30 border-b">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-xl font-semibold">Return Orders</CardTitle>
                    <div className="flex gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <PermissionInput 
                          section="returns"
                          placeholder="Search returns..." 
                          className="pl-10 w-64 hover:border-primary/50 focus:ring-primary" 
                        />
                      </div>
                      <PermissionButton section="returns" variant="outline" size="sm" className="hover:bg-muted">
                        <Filter className="h-4 w-4 mr-2" />
                        Filter
                      </PermissionButton>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="font-semibold">RSO #</TableHead>
                          <TableHead className="font-semibold">Date</TableHead>
                          <TableHead className="font-semibold">Customer</TableHead>
                          <TableHead className="font-semibold">Invoice #</TableHead>
                          <TableHead className="font-semibold">Reason</TableHead>
                          <TableHead className="font-semibold">Status</TableHead>
                          <TableHead className="font-semibold">Amount</TableHead>
                          <TableHead className="font-semibold">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {returnOrders.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-12">
                              <div className="flex flex-col items-center gap-4">
                                <div className="p-4 bg-muted/50 rounded-full">
                                  <RotateCcw className="h-12 w-12 text-muted-foreground" />
                                </div>
                                <div>
                                  <p className="text-lg font-semibold">No return orders yet</p>
                                  <p className="text-muted-foreground">Return orders will appear here once created</p>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          returnOrders.map((returnOrder, index) => (
                            <TableRow key={returnOrder.id} className={`hover:bg-accent/50 transition-colors ${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}>
                              <TableCell className="font-medium">{returnOrder.rso_number}</TableCell>
                              <TableCell>{new Date(returnOrder.rso_date).toLocaleDateString()}</TableCell>
                              <TableCell>{returnOrder.customer_name}</TableCell>
                              <TableCell>{returnOrder.invoice_number}</TableCell>
                              <TableCell><span className="text-sm bg-muted px-2 py-1 rounded">{returnOrder.reason_for_credit}</span></TableCell>
                              <TableCell>
                                <Badge className={getStatusColor(returnOrder.status)}>
                                  {returnOrder.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-semibold">₹{returnOrder.total_amount.toFixed(2)}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    title="View" 
                                    onClick={() => viewReturnOrder(returnOrder.id)}
                                    className="hover:bg-accent"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                   {returnOrder.status === 'Draft' && (
                                     <>
                                       <Button 
                                         variant="outline" 
                                         size="sm" 
                                         title="Edit"
                                         onClick={() => handleEditReturn(returnOrder.id)}
                                         className="hover:bg-blue-50"
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
                                             className="hover:bg-red-50"
                                           >
                                             <Trash2 className="h-4 w-4" />
                                           </Button>
                                         </AlertDialogTrigger>
                                         <AlertDialogContent>
                                           <AlertDialogHeader>
                                             <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                             <AlertDialogDescription>
                                               This action cannot be undone. This will permanently delete the return order.
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
                                   {returnOrder.status === 'Confirmed' && (
                                     <>
                                       <Button 
                                         variant="outline" 
                                         size="sm" 
                                         title="Edit Confirmed Return"
                                         onClick={() => handleEditReturn(returnOrder.id)}
                                         className="hover:bg-blue-50"
                                       >
                                         <Edit className="h-4 w-4" />
                                       </Button>
                                       <AlertDialog>
                                         <AlertDialogTrigger asChild>
                                           <Button 
                                             variant="outline" 
                                             size="sm" 
                                             title="Delete Confirmed Return"
                                             className="hover:bg-red-50"
                                           >
                                             <Trash2 className="h-4 w-4" />
                                           </Button>
                                         </AlertDialogTrigger>
                                         <AlertDialogContent>
                                           <AlertDialogHeader>
                                             <AlertDialogTitle>Delete Confirmed Return?</AlertDialogTitle>
                                             <AlertDialogDescription>
                                               This will delete the confirmed return order and reverse any inventory changes. This action cannot be undone.
                                             </AlertDialogDescription>
                                           </AlertDialogHeader>
                                           <AlertDialogFooter>
                                             <AlertDialogCancel>Cancel</AlertDialogCancel>
                                             <AlertDialogAction 
                                               onClick={() => handleDeleteConfirmedReturn(returnOrder.id)}
                                               className="bg-red-600 hover:bg-red-700"
                                             >
                                               Delete & Reverse
                                             </AlertDialogAction>
                                           </AlertDialogFooter>
                                         </AlertDialogContent>
                                       </AlertDialog>
                                     </>
                                   )}
                                  <Button variant="outline" size="sm" title="Download" className="hover:bg-accent">
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Credit Notes Tab */}
          <TabsContent value="credit-notes">
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-r from-background to-muted/30 border-b">
                <CardTitle className="text-xl font-semibold flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Credit Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="text-center py-16">
                  <div className="p-4 bg-muted/50 rounded-full w-fit mx-auto mb-4">
                    <FileText className="h-12 w-12 text-muted-foreground" />
                  </div>
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