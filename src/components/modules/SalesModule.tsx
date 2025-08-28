import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, FileText, Users, Edit, Trash2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Download, Check, ChevronsUpDown, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';

interface SalesOrderItem {
  id?: string;
  product_id: string | null;
  item_description: string;
  hsn_sac_code: string;
  quantity: number;
  unit_of_measure: string;
  unit_price: number;
  discount_percentage: number;
  discount_amount: number;
  tax_percentage: number;
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  line_total: number;
}

interface SalesOrder {
  id: string;
  order_number: string;
  status: string;
  order_date: string;
  delivery_date: string | null;
  customer_po_number: string | null;
  customer_reference_no: string | null;
  total_amount: number;
  discount_amount: number;
  tax_amount: number;
  subtotal_amount: number;
  notes: string | null;
  delivery_address_line1: string | null;
  delivery_address_line2: string | null;
  delivery_city: string | null;
  delivery_state: string | null;
  delivery_pin_code: string | null;
  delivery_country: string | null;
  same_as_registered_address: boolean;
  expected_delivery_date: string | null;
  mode_of_transport: string | null;
  shipping_instructions: string | null;
  currency: string;
  payment_terms: string | null;
  customer: {
    id: string;
    name: string;
    email: string | null;
    customer_ref: string | null;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    state: string | null;
    pin_code: string | null;
    country: string | null;
    gstin: string | null;
    payment_terms: string | null;
  };
  items?: SalesOrderItem[];
}

interface Product {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  unit_price: number;
  hsn_code: string | null;
  unit: string | null;
  gst_percentage: number;
}

interface Customer {
  id: string;
  customer_ref?: string;
  name: string;
  customer_type?: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  credit_limit: number;
  is_active: boolean;
  gstin?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pin_code?: string | null;
  website?: string | null;
  payment_terms?: string | null;
  preferred_currency?: string;
  same_as_registered_address?: boolean;
  alternate_email?: string | null;
  landline_number?: string | null;
  pan_number?: string | null;
  msme_registration_no?: string | null;
  business_registration_no?: string | null;
  shipping_address_line1?: string | null;
  shipping_address_line2?: string | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
  shipping_pin_code?: string | null;
  shipping_country?: string | null;
  billing_cycle?: string | null;
  bank_name?: string | null;
  branch_name?: string | null;
  account_number?: string | null;
  account_type?: string | null;
  ifsc_code?: string | null;
  swift_code?: string | null;
  upi_id?: string | null;
}

interface PerformaInvoiceItem {
  id?: string;
  product_id: string;
  item_description: string;
  hsn_sac_code: string;
  unit_of_measure: string;
  quantity: number;
  unit_price: number;
  discount_percentage: number;
  discount_amount: number;
  tax_percentage: number;
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_price: number;
}

interface PerformaInvoiceForm {
  performa_invoice_date: string;
  performa_invoice_number: string;
  sales_order_id: string;
  customer_id: string;
  customer_name: string;
  order_date?: string;
  order_number?: string;
  customer_po_number?: string;
  customer_reference_no?: string;
  delivery_date?: string;
  expected_delivery_date?: string;
  payment_terms?: string;
  currency?: string;
  mode_of_transport?: string;
  shipping_instructions?: string;
  delivery_address_line1?: string;
  delivery_address_line2?: string;
  delivery_city?: string;
  delivery_state?: string;
  delivery_pin_code?: string;
  delivery_country?: string;
  same_as_registered_address?: boolean;
  subtotal_amount: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  notes: string;
  status: string;
  items: PerformaInvoiceItem[];
}

export function SalesModule() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [showAddSODialog, setShowAddSODialog] = useState(false);
  const [showAddCustomerDialog, setShowAddCustomerDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editingSalesOrder, setEditingSalesOrder] = useState<SalesOrder | null>(null);
  const [sameAsRegistered, setSameAsRegistered] = useState(false);
  const [deliverySameAsRegistered, setDeliverySameAsRegistered] = useState(false);
  const [sortField, setSortField] = useState<'name' | 'customer_ref' | 'gstin'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [soSortField, setSoSortField] = useState<'order_number' | 'customer_po_number' | 'customer_name' | 'order_date'>('order_date');
  const [soSortDirection, setSoSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [soCurrentPage, setSOCurrentPage] = useState(1);
  const [orderItems, setOrderItems] = useState<SalesOrderItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [productSearchTerms, setProductSearchTerms] = useState<{[key: number]: string}>({});
  const [openSkuIndex, setOpenSkuIndex] = useState<number | null>(null);
  const itemsPerPage = 5;

  // Performa Invoice State
  const [performaInvoices, setPerformaInvoices] = useState<any[]>([]);
  const [showPerformaInvoiceForm, setShowPerformaInvoiceForm] = useState(false);
  const [editingPerformaInvoice, setEditingPerformaInvoice] = useState<any>(null);
  const [performaInvoiceSearchTerm, setPerformaInvoiceSearchTerm] = useState('');
  const [performaCurrentPage, setPerformaCurrentPage] = useState(1);
  const [salesOrderSelectOpen, setSalesOrderSelectOpen] = useState(false);
  const [performaSortConfig, setPerformaSortConfig] = useState<{
    key: string,
    direction: 'asc' | 'desc'
  }>({
    key: 'performa_invoice_date',
    direction: 'desc'
  });

  const [performaInvoiceForm, setPerformaInvoiceForm] = useState<PerformaInvoiceForm>({
    performa_invoice_date: new Date().toISOString().split('T')[0],
    performa_invoice_number: '',
    sales_order_id: '',
    customer_id: '',
    customer_name: '',
    order_date: '',
    order_number: '',
    customer_po_number: '',
    customer_reference_no: '',
    delivery_date: '',
    expected_delivery_date: '',
    payment_terms: '',
    currency: 'INR',
    mode_of_transport: '',
    shipping_instructions: '',
    delivery_address_line1: '',
    delivery_address_line2: '',
    delivery_city: '',
    delivery_state: '',
    delivery_pin_code: '',
    delivery_country: '',
    same_as_registered_address: false,
    subtotal_amount: 0,
    tax_amount: 0,
    discount_amount: 0,
    total_amount: 0,
    notes: '',
    status: 'draft',
    items: []
  });

  useEffect(() => {
    fetchSalesOrders();
    fetchCustomers();
    fetchProducts();
    fetchPerformaInvoices();
  }, []);

  const fetchPerformaInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('performa_invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching performa invoices:', error);
        return;
      }

      // Fetch sales order details separately if needed
      const enrichedData = await Promise.all((data || []).map(async (invoice) => {
        if (invoice.sales_order_id) {
          const { data: salesOrder } = await supabase
            .from('sales_orders')
            .select('order_number')
            .eq('id', invoice.sales_order_id)
            .single();
          
          return {
            ...invoice,
            sales_order: salesOrder
          };
        }
        return invoice;
      }));

      setPerformaInvoices(enrichedData);
    } catch (error) {
      console.error('Error fetching performa invoices:', error);
    }
  };

  const fetchSalesOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          *,
          customer:customers(
            id,
            name, 
            email,
            customer_ref,
            address_line1,
            address_line2,
            city,
            state,
            pin_code,
            country,
            gstin,
            payment_terms
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching sales orders:', error);
        return;
      }

      setSalesOrders(data || []);
    } catch (error) {
      console.error('Error fetching sales orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching customers:', error);
        return;
      }

      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching products:', error);
        return;
      }

      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  // Performa Invoice Functions
  const handleSalesOrderSelection = (salesOrderId: string) => {
    const salesOrder = salesOrders.find(so => so.id === salesOrderId);
    if (!salesOrder) return;

    setPerformaInvoiceForm({
      ...performaInvoiceForm,
      sales_order_id: salesOrderId,
      customer_id: salesOrder.customer.id,
      customer_name: salesOrder.customer.name,
      order_date: salesOrder.order_date,
      order_number: salesOrder.order_number,
      customer_po_number: salesOrder.customer_po_number || '',
      customer_reference_no: salesOrder.customer_reference_no || '',
      delivery_date: salesOrder.delivery_date || '',
      expected_delivery_date: salesOrder.expected_delivery_date || '',
      payment_terms: salesOrder.payment_terms || '',
      currency: salesOrder.currency,
      mode_of_transport: salesOrder.mode_of_transport || '',
      shipping_instructions: salesOrder.shipping_instructions || '',
      delivery_address_line1: salesOrder.delivery_address_line1 || '',
      delivery_address_line2: salesOrder.delivery_address_line2 || '',
      delivery_city: salesOrder.delivery_city || '',
      delivery_state: salesOrder.delivery_state || '',
      delivery_pin_code: salesOrder.delivery_pin_code || '',
      delivery_country: salesOrder.delivery_country || '',
      same_as_registered_address: salesOrder.same_as_registered_address,
      subtotal_amount: salesOrder.subtotal_amount || 0,
      tax_amount: salesOrder.tax_amount,
      discount_amount: salesOrder.discount_amount,
      total_amount: salesOrder.total_amount,
      notes: salesOrder.notes || '',
      items: []
    });

    fetchSalesOrderItems(salesOrderId);
  };

  const fetchSalesOrderItems = async (salesOrderId: string) => {
    try {
      const { data, error } = await supabase
        .from('sales_order_items')
        .select('*')
        .eq('sales_order_id', salesOrderId);

      if (error) {
        console.error('Error fetching sales order items:', error);
        return;
      }

      const performaItems: PerformaInvoiceItem[] = (data || []).map(item => ({
        product_id: item.product_id,
        item_description: item.item_description,
        hsn_sac_code: item.hsn_sac_code || '',
        unit_of_measure: item.unit_of_measure,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percentage: item.discount_percentage || 0,
        discount_amount: item.discount_amount,
        tax_percentage: item.tax_percentage || 0,
        cgst_rate: item.cgst_rate || 0,
        sgst_rate: item.sgst_rate || 0,
        igst_rate: item.igst_rate || 0,
        cgst_amount: item.cgst_amount || 0,
        sgst_amount: item.sgst_amount || 0,
        igst_amount: item.igst_amount || 0,
        total_price: item.total_price
      }));

      setPerformaInvoiceForm(prev => ({
        ...prev,
        items: performaItems
      }));
    } catch (error) {
      console.error('Error fetching sales order items:', error);
    }
  };

  const updatePerformaInvoiceItem = (index: number, field: keyof PerformaInvoiceItem, value: any) => {
    const updatedItems = [...performaInvoiceForm.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };

    if (['quantity', 'unit_price', 'discount_percentage', 'cgst_rate', 'sgst_rate', 'igst_rate'].includes(field)) {
      const item = updatedItems[index];
      const subtotal = item.quantity * item.unit_price;
      
      item.discount_amount = (subtotal * item.discount_percentage) / 100;
      
      const taxableAmount = subtotal - item.discount_amount;
      item.cgst_amount = (taxableAmount * item.cgst_rate) / 100;
      item.sgst_amount = (taxableAmount * item.sgst_rate) / 100;
      item.igst_amount = (taxableAmount * item.igst_rate) / 100;
      
      item.tax_percentage = item.cgst_rate + item.sgst_rate + item.igst_rate;
      item.total_price = taxableAmount + item.cgst_amount + item.sgst_amount + item.igst_amount;
    }

    setPerformaInvoiceForm(prev => ({
      ...prev,
      items: updatedItems
    }));

    calculatePerformaInvoiceTotals(updatedItems);
  };

  const addPerformaInvoiceItem = () => {
    const newItem: PerformaInvoiceItem = {
      product_id: '',
      item_description: '',
      hsn_sac_code: '',
      unit_of_measure: 'pcs',
      quantity: 1,
      unit_price: 0,
      discount_percentage: 0,
      discount_amount: 0,
      tax_percentage: 0,
      cgst_rate: 0,
      sgst_rate: 0,
      igst_rate: 0,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      total_price: 0
    };

    setPerformaInvoiceForm(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  const removePerformaInvoiceItem = (index: number) => {
    const updatedItems = performaInvoiceForm.items.filter((_, i) => i !== index);
    setPerformaInvoiceForm(prev => ({
      ...prev,
      items: updatedItems
    }));
    calculatePerformaInvoiceTotals(updatedItems);
  };

  const calculatePerformaInvoiceTotals = (items: PerformaInvoiceItem[]) => {
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const totalDiscount = items.reduce((sum, item) => sum + item.discount_amount, 0);
    const totalTax = items.reduce((sum, item) => sum + item.cgst_amount + item.sgst_amount + item.igst_amount, 0);
    const total = subtotal - totalDiscount + totalTax;

    setPerformaInvoiceForm(prev => ({
      ...prev,
      subtotal_amount: subtotal,
      discount_amount: totalDiscount,
      tax_amount: totalTax,
      total_amount: total
    }));
  };

  const handleSubmitPerformaInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingPerformaInvoice) {
        const { error: invoiceError } = await supabase
          .from('performa_invoices')
          .update({
            performa_invoice_date: performaInvoiceForm.performa_invoice_date,
            customer_name: performaInvoiceForm.customer_name,
            subtotal_amount: performaInvoiceForm.subtotal_amount,
            tax_amount: performaInvoiceForm.tax_amount,
            discount_amount: performaInvoiceForm.discount_amount,
            total_amount: performaInvoiceForm.total_amount,
            notes: performaInvoiceForm.notes,
            status: performaInvoiceForm.status
          })
          .eq('id', editingPerformaInvoice.id);

        if (invoiceError) throw invoiceError;

        if (performaInvoiceForm.items.length > 0) {
          await supabase
            .from('performa_invoice_items')
            .delete()
            .eq('performa_invoice_id', editingPerformaInvoice.id);

          const { error: itemsError } = await supabase
            .from('performa_invoice_items')
            .insert(performaInvoiceForm.items.map(item => ({
              performa_invoice_id: editingPerformaInvoice.id,
              ...item
            })));

          if (itemsError) throw itemsError;
        }

        toast({
          title: "Success",
          description: "Performa invoice updated successfully",
        });
      } else {
        const { data: invoiceData, error: invoiceError } = await supabase
          .from('performa_invoices')
          .insert({
            performa_invoice_date: performaInvoiceForm.performa_invoice_date,
            performa_invoice_number: '', // Will be auto-generated by trigger
            sales_order_id: performaInvoiceForm.sales_order_id,
            customer_id: performaInvoiceForm.customer_id,
            customer_name: performaInvoiceForm.customer_name,
            subtotal_amount: performaInvoiceForm.subtotal_amount,
            tax_amount: performaInvoiceForm.tax_amount,
            discount_amount: performaInvoiceForm.discount_amount,
            total_amount: performaInvoiceForm.total_amount,
            notes: performaInvoiceForm.notes,
            status: performaInvoiceForm.status,
            created_by: profile?.user_id,
            company_id: profile?.company_id
          })
          .select()
          .single();

        if (invoiceError) throw invoiceError;

        if (performaInvoiceForm.items.length > 0) {
          const { error: itemsError } = await supabase
            .from('performa_invoice_items')
            .insert(performaInvoiceForm.items.map(item => ({
              performa_invoice_id: invoiceData.id,
              ...item
            })));

          if (itemsError) throw itemsError;
        }

        toast({
          title: "Success",
          description: "Performa invoice created successfully",
        });
      }

      setShowPerformaInvoiceForm(false);
      setEditingPerformaInvoice(null);
      fetchPerformaInvoices();
      resetPerformaInvoiceForm();
    } catch (error) {
      console.error('Error submitting performa invoice:', error);
      toast({
        title: "Error",
        description: "Failed to save performa invoice",
        variant: "destructive",
      });
    }
  };

  const handleEditPerformaInvoice = async (invoice: any) => {
    setEditingPerformaInvoice(invoice);
    
    const { data: items, error } = await supabase
      .from('performa_invoice_items')
      .select('*')
      .eq('performa_invoice_id', invoice.id);

    if (!error && items) {
      setPerformaInvoiceForm({
        ...invoice,
        items: items.map(item => ({
          id: item.id,
          product_id: item.product_id,
          item_description: item.item_description,
          hsn_sac_code: item.hsn_sac_code || '',
          unit_of_measure: item.unit_of_measure,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percentage: item.discount_percentage || 0,
          discount_amount: item.discount_amount,
          tax_percentage: item.tax_percentage || 0,
          cgst_rate: item.cgst_rate || 0,
          sgst_rate: item.sgst_rate || 0,
          igst_rate: item.igst_rate || 0,
          cgst_amount: item.cgst_amount || 0,
          sgst_amount: item.sgst_amount || 0,
          igst_amount: item.igst_amount || 0,
          total_price: item.total_price
        }))
      });
    }
    
    setShowPerformaInvoiceForm(true);
  };

  const handleDeletePerformaInvoice = async (id: string) => {
    if (!confirm('Are you sure you want to delete this performa invoice?')) return;

    try {
      await supabase
        .from('performa_invoice_items')
        .delete()
        .eq('performa_invoice_id', id);

      const { error } = await supabase
        .from('performa_invoices')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Performa invoice deleted successfully",
      });

      fetchPerformaInvoices();
    } catch (error) {
      console.error('Error deleting performa invoice:', error);
      toast({
        title: "Error",
        description: "Failed to delete performa invoice",
        variant: "destructive",
      });
    }
  };

  const resetPerformaInvoiceForm = () => {
    setPerformaInvoiceForm({
      performa_invoice_date: new Date().toISOString().split('T')[0],
      performa_invoice_number: '',
      sales_order_id: '',
      customer_id: '',
      customer_name: '',
      order_date: '',
      order_number: '',
      customer_po_number: '',
      customer_reference_no: '',
      delivery_date: '',
      expected_delivery_date: '',
      payment_terms: '',
      currency: 'INR',
      mode_of_transport: '',
      shipping_instructions: '',
      delivery_address_line1: '',
      delivery_address_line2: '',
      delivery_city: '',
      delivery_state: '',
      delivery_pin_code: '',
      delivery_country: '',
      same_as_registered_address: false,
      subtotal_amount: 0,
      tax_amount: 0,
      discount_amount: 0,
      total_amount: 0,
      notes: '',
      status: 'draft',
      items: []
    });
  };

  // Filter and sort data
  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    (customer.customer_ref && customer.customer_ref.toLowerCase().includes(customerSearchTerm.toLowerCase())) ||
    (customer.gstin && customer.gstin.toLowerCase().includes(customerSearchTerm.toLowerCase()))
  );

  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    const aValue = a[sortField] || '';
    const bValue = b[sortField] || '';
    
    if (sortDirection === 'asc') {
      return aValue.toString().localeCompare(bValue.toString());
    } else {
      return bValue.toString().localeCompare(aValue.toString());
    }
  });

  const handleSort = (field: 'name' | 'customer_ref' | 'gstin') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const paginatedCustomers = sortedCustomers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalCustomerPages = Math.ceil(sortedCustomers.length / itemsPerPage);

  // Performa Invoice filtering and sorting
  const filteredPerformaInvoices = performaInvoices.filter(invoice => {
    const searchLower = performaInvoiceSearchTerm.toLowerCase();
    return (
      invoice.performa_invoice_number?.toLowerCase().includes(searchLower) ||
      invoice.customer_name?.toLowerCase().includes(searchLower) ||
      invoice.sales_order?.order_number?.toLowerCase().includes(searchLower) ||
      invoice.notes?.toLowerCase().includes(searchLower)
    );
  });

  const sortedPerformaInvoices = [...filteredPerformaInvoices].sort((a, b) => {
    const aValue = a[performaSortConfig.key] || '';
    const bValue = b[performaSortConfig.key] || '';
    
    if (performaSortConfig.direction === 'asc') {
      return aValue.toString().localeCompare(bValue.toString());
    } else {
      return bValue.toString().localeCompare(aValue.toString());
    }
  });

  const paginatedPerformaInvoices = sortedPerformaInvoices.slice(
    (performaCurrentPage - 1) * 5,
    performaCurrentPage * 5
  );

  const totalPerformaPages = Math.ceil(sortedPerformaInvoices.length / 5);

  const handlePerformaSort = (key: string) => {
    setPerformaSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Additional functions for customer and sales order management can be added here as needed

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading sales data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales Management</h1>
          <p className="text-muted-foreground">Manage customers, sales orders, and performa invoices</p>
        </div>
      </div>

      <Tabs defaultValue="performa-invoices" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="performa-invoices" className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span>Performa Invoices</span>
          </TabsTrigger>
          <TabsTrigger value="sales-orders" className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span>Sales Orders</span>
          </TabsTrigger>
          <TabsTrigger value="customers" className="flex items-center space-x-2">
            <Users className="h-4 w-4" />
            <span>Customers</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="performa-invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Performa Invoices</CardTitle>
                  <CardDescription>Manage performa invoices for sales orders</CardDescription>
                </div>
                <Button onClick={() => {
                  resetPerformaInvoiceForm();
                  setEditingPerformaInvoice(null);
                  setShowPerformaInvoiceForm(true);
                }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Performa Invoice
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by invoice no, customer, sales order, SKU, or item name..."
                      value={performaInvoiceSearchTerm}
                      onChange={(e) => setPerformaInvoiceSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-border/40 shadow-sm overflow-hidden">
                  <Table>
                    <TableHeader className="bg-gradient-to-r from-muted/50 to-muted/30">
                      <TableRow className="border-border/50 hover:bg-transparent">
                        <TableHead className="font-semibold text-foreground">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handlePerformaSort('performa_invoice_number')}
                            className="h-auto p-0 font-semibold hover:bg-transparent"
                          >
                            Invoice No.
                            {performaSortConfig.key === 'performa_invoice_number' && (
                              performaSortConfig.direction === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead className="font-semibold text-foreground">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handlePerformaSort('customer_name')}
                            className="h-auto p-0 font-semibold hover:bg-transparent"
                          >
                            Customer
                            {performaSortConfig.key === 'customer_name' && (
                              performaSortConfig.direction === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead className="font-semibold text-foreground">Sales Order</TableHead>
                        <TableHead className="font-semibold text-foreground">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handlePerformaSort('performa_invoice_date')}
                            className="h-auto p-0 font-semibold hover:bg-transparent"
                          >
                            Date
                            {performaSortConfig.key === 'performa_invoice_date' && (
                              performaSortConfig.direction === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead className="font-semibold text-foreground">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handlePerformaSort('total_amount')}
                            className="h-auto p-0 font-semibold hover:bg-transparent"
                          >
                            Amount
                            {performaSortConfig.key === 'total_amount' && (
                              performaSortConfig.direction === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead className="font-semibold text-foreground">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handlePerformaSort('status')}
                            className="h-auto p-0 font-semibold hover:bg-transparent"
                          >
                            Status
                            {performaSortConfig.key === 'status' && (
                              performaSortConfig.direction === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead className="font-semibold text-foreground">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedPerformaInvoices.length > 0 ? (
                        paginatedPerformaInvoices.map((invoice) => (
                          <TableRow key={invoice.id} className="hover:bg-muted/30 transition-colors border-border/30">
                            <TableCell className="font-medium text-primary">{invoice.performa_invoice_number}</TableCell>
                            <TableCell className="font-medium">{invoice.customer_name}</TableCell>
                            <TableCell className="text-muted-foreground">{invoice.sales_order?.order_number || 'N/A'}</TableCell>
                            <TableCell>{format(new Date(invoice.performa_invoice_date), 'dd/MM/yyyy')}</TableCell>
                            <TableCell className="font-semibold">₹{invoice.total_amount.toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge 
                                variant={
                                  invoice.status === 'approved' ? 'default' : 
                                  invoice.status === 'draft' ? 'secondary' : 
                                  invoice.status === 'sent' ? 'outline' : 'destructive'
                                }
                                className="capitalize"
                              >
                                {invoice.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleEditPerformaInvoice(invoice)}
                                  className="h-8 w-8 p-0 hover:bg-primary/10"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleDeletePerformaInvoice(invoice.id)}
                                  className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-12">
                            <div className="flex flex-col items-center space-y-2">
                              <FileText className="h-8 w-8 text-muted-foreground" />
                              <p className="text-muted-foreground">No performa invoices found</p>
                              <p className="text-sm text-muted-foreground">Create your first performa invoice to get started</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {totalPerformaPages > 1 && (
                  <div className="flex items-center justify-between px-2">
                    <p className="text-sm text-muted-foreground">
                      Showing {((performaCurrentPage - 1) * 5) + 1} to {Math.min(performaCurrentPage * 5, sortedPerformaInvoices.length)} of {sortedPerformaInvoices.length} invoices
                    </p>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPerformaCurrentPage(performaCurrentPage - 1)}
                        disabled={performaCurrentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm font-medium">
                        Page {performaCurrentPage} of {totalPerformaPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPerformaCurrentPage(performaCurrentPage + 1)}
                        disabled={performaCurrentPage === totalPerformaPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales-orders" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Sales Orders</CardTitle>
                  <CardDescription>View and manage sales orders</CardDescription>
                </div>
                <Button onClick={() => setShowAddSODialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Sales Order
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by order number, customer, or PO number..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-border/40 shadow-sm overflow-hidden">
                  <Table>
                    <TableHeader className="bg-gradient-to-r from-muted/50 to-muted/30">
                      <TableRow className="border-border/50 hover:bg-transparent">
                        <TableHead className="font-semibold text-foreground">Order Number</TableHead>
                        <TableHead className="font-semibold text-foreground">Customer</TableHead>
                        <TableHead className="font-semibold text-foreground">Order Date</TableHead>
                        <TableHead className="font-semibold text-foreground">Amount</TableHead>
                        <TableHead className="font-semibold text-foreground">Status</TableHead>
                        <TableHead className="font-semibold text-foreground">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesOrders.length > 0 ? (
                        salesOrders.slice(0, 5).map((order) => (
                          <TableRow key={order.id} className="hover:bg-muted/30 transition-colors border-border/30">
                            <TableCell className="font-medium text-primary">{order.order_number}</TableCell>
                            <TableCell className="font-medium">{order.customer.name}</TableCell>
                            <TableCell>{format(new Date(order.order_date), 'dd/MM/yyyy')}</TableCell>
                            <TableCell className="font-semibold">₹{order.total_amount.toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge 
                                variant={order.status === 'approved' ? 'default' : order.status === 'draft' ? 'secondary' : 'outline'}
                                className="capitalize"
                              >
                                {order.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:bg-primary/10"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-12">
                            <div className="flex flex-col items-center space-y-2">
                              <FileText className="h-8 w-8 text-muted-foreground" />
                              <p className="text-muted-foreground">No sales orders found</p>
                              <p className="text-sm text-muted-foreground">Create your first sales order to get started</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Customers</CardTitle>
                  <CardDescription>Manage customer information</CardDescription>
                </div>
                <Button onClick={() => {
                  setEditingCustomer(null);
                  setShowAddCustomerDialog(true);
                }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Customer
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, reference number, or GSTIN..."
                      value={customerSearchTerm}
                      onChange={(e) => setCustomerSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-border/40 shadow-sm overflow-hidden">
                  <Table>
                    <TableHeader className="bg-gradient-to-r from-muted/50 to-muted/30">
                      <TableRow className="border-border/50 hover:bg-transparent">
                        <TableHead className="font-semibold text-foreground">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleSort('name')}
                            className="h-auto p-0 font-semibold hover:bg-transparent"
                          >
                            Name
                            {sortField === 'name' && (
                              sortDirection === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead className="font-semibold text-foreground">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleSort('customer_ref')}
                            className="h-auto p-0 font-semibold hover:bg-transparent"
                          >
                            Reference No.
                            {sortField === 'customer_ref' && (
                              sortDirection === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead className="font-semibold text-foreground">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleSort('gstin')}
                            className="h-auto p-0 font-semibold hover:bg-transparent"
                          >
                            GSTIN
                            {sortField === 'gstin' && (
                              sortDirection === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead className="font-semibold text-foreground">Contact</TableHead>
                        <TableHead className="font-semibold text-foreground">Credit Limit</TableHead>
                        <TableHead className="font-semibold text-foreground">Status</TableHead>
                        <TableHead className="font-semibold text-foreground">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedCustomers.length > 0 ? (
                        paginatedCustomers.map((customer) => (
                          <TableRow key={customer.id} className="hover:bg-muted/30 transition-colors border-border/30">
                            <TableCell className="font-medium">{customer.name}</TableCell>
                            <TableCell>{customer.customer_ref || 'N/A'}</TableCell>
                            <TableCell>{customer.gstin || 'N/A'}</TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm">{customer.email || 'No email'}</p>
                                <p className="text-xs text-muted-foreground">{customer.phone || 'No phone'}</p>
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold">₹{customer.credit_limit.toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge variant={customer.is_active ? 'default' : 'secondary'}>
                                {customer.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => {
                                    setEditingCustomer(customer);
                                    setShowAddCustomerDialog(true);
                                  }}
                                  className="h-8 w-8 p-0 hover:bg-primary/10"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-12">
                            <div className="flex flex-col items-center space-y-2">
                              <Users className="h-8 w-8 text-muted-foreground" />
                              <p className="text-muted-foreground">No customers found</p>
                              <p className="text-sm text-muted-foreground">Add your first customer to get started</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  {totalCustomerPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border/40 bg-muted/20">
                      <p className="text-sm text-muted-foreground">
                        Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sortedCustomers.length)} of {sortedCustomers.length} customers
                      </p>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="h-8 border-border/60"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-medium px-2">
                          Page {currentPage} of {totalCustomerPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(currentPage + 1)}
                          disabled={currentPage === totalCustomerPages}
                          className="h-8 border-border/60"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Performa Invoice Dialog */}
      <Dialog open={showPerformaInvoiceForm} onOpenChange={(open) => {
        setShowPerformaInvoiceForm(open);
        if (!open) {
          setEditingPerformaInvoice(null);
          resetPerformaInvoiceForm();
        }
      }}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {editingPerformaInvoice ? 'Edit Performa Invoice' : 'Create Performa Invoice'}
            </DialogTitle>
            <DialogDescription>
              {editingPerformaInvoice ? 'Update performa invoice details and items' : 'Generate a performa invoice from a sales order with editable items'}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[80vh] pr-4">
            <form onSubmit={handleSubmitPerformaInvoice} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2 border-b pb-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Basic Information</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="performa_invoice_date">Invoice Date</Label>
                    <Input
                      id="performa_invoice_date"
                      type="date"
                      value={performaInvoiceForm.performa_invoice_date}
                      onChange={(e) => setPerformaInvoiceForm({
                        ...performaInvoiceForm,
                        performa_invoice_date: e.target.value
                      })}
                      required
                      className="border-border/60"
                    />
                  </div>
                  
                  {!editingPerformaInvoice && (
                    <div>
                      <Label htmlFor="sales_order">Sales Order</Label>
                      <Popover open={salesOrderSelectOpen} onOpenChange={setSalesOrderSelectOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={salesOrderSelectOpen}
                            className="w-full justify-between border-border/60"
                          >
                            {performaInvoiceForm.sales_order_id
                              ? salesOrders.find(so => so.id === performaInvoiceForm.sales_order_id)?.order_number
                              : "Select sales order..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0">
                          <Command>
                            <CommandInput placeholder="Search sales orders..." />
                            <CommandEmpty>No sales order found.</CommandEmpty>
                            <CommandList>
                              <CommandGroup>
                                {salesOrders.map((so) => (
                                  <CommandItem
                                    key={so.id}
                                    value={so.order_number}
                                    onSelect={() => {
                                      handleSalesOrderSelection(so.id);
                                      setSalesOrderSelectOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        performaInvoiceForm.sales_order_id === so.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {so.order_number} - {so.customer.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="customer_name">Customer Name</Label>
                    <Input
                      id="customer_name"
                      value={performaInvoiceForm.customer_name}
                      onChange={(e) => setPerformaInvoiceForm({
                        ...performaInvoiceForm,
                        customer_name: e.target.value
                      })}
                      required
                      className="border-border/60"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select 
                      value={performaInvoiceForm.status} 
                      onValueChange={(value) => setPerformaInvoiceForm({
                        ...performaInvoiceForm,
                        status: value
                      })}
                    >
                      <SelectTrigger className="border-border/60">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Items Section with Tax Fields */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Items & Tax Details</h3>
                  </div>
                  <Button type="button" onClick={addPerformaInvoiceItem} size="sm" variant="outline">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                </div>

                {performaInvoiceForm.items.length > 0 && (
                  <div className="space-y-6">
                    {performaInvoiceForm.items.map((item, index) => (
                      <div key={index} className="p-6 border border-border/40 rounded-lg bg-gradient-to-br from-muted/20 to-muted/5 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-lg flex items-center space-x-2">
                            <span className="bg-primary/10 text-primary px-2 py-1 rounded text-sm">#{index + 1}</span>
                            <span>Item Details</span>
                          </h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removePerformaInvoiceItem(index)}
                            className="text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Basic Item Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="lg:col-span-2">
                            <Label>Item Description</Label>
                            <Input
                              value={item.item_description}
                              onChange={(e) => updatePerformaInvoiceItem(index, 'item_description', e.target.value)}
                              placeholder="Enter item description"
                              className="border-border/60"
                            />
                          </div>
                          <div>
                            <Label>HSN/SAC Code</Label>
                            <Input
                              value={item.hsn_sac_code}
                              onChange={(e) => updatePerformaInvoiceItem(index, 'hsn_sac_code', e.target.value)}
                              placeholder="HSN/SAC code"
                              className="border-border/60"
                            />
                          </div>
                          <div>
                            <Label>Unit of Measure</Label>
                            <Input
                              value={item.unit_of_measure}
                              onChange={(e) => updatePerformaInvoiceItem(index, 'unit_of_measure', e.target.value)}
                              placeholder="e.g., pcs, kg, m"
                              className="border-border/60"
                            />
                          </div>
                        </div>

                        {/* Pricing & Quantity */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div>
                            <Label>Quantity</Label>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updatePerformaInvoiceItem(index, 'quantity', parseInt(e.target.value) || 0)}
                              min="1"
                              className="border-border/60"
                            />
                          </div>
                          <div>
                            <Label>Unit Price (₹)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => updatePerformaInvoiceItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                              min="0"
                              className="border-border/60"
                            />
                          </div>
                          <div>
                            <Label>Discount %</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.discount_percentage}
                              onChange={(e) => updatePerformaInvoiceItem(index, 'discount_percentage', parseFloat(e.target.value) || 0)}
                              min="0"
                              max="100"
                              className="border-border/60"
                            />
                          </div>
                          <div>
                            <Label>Discount Amount (₹)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.discount_amount.toFixed(2)}
                              readOnly
                              className="bg-muted/50 border-border/30"
                            />
                          </div>
                        </div>

                        {/* Tax Section */}
                        <div className="bg-gradient-to-r from-blue-50/50 to-green-50/50 p-4 rounded-lg border border-blue-200/30">
                          <h5 className="font-semibold text-sm mb-3 text-blue-900">Tax Configuration (Manual Entry Required)</h5>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <Label className="text-xs font-medium">CGST Rate %</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.cgst_rate}
                                onChange={(e) => updatePerformaInvoiceItem(index, 'cgst_rate', parseFloat(e.target.value) || 0)}
                                min="0"
                                placeholder="0.00"
                                className="border-blue-200/50"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium">SGST Rate %</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.sgst_rate}
                                onChange={(e) => updatePerformaInvoiceItem(index, 'sgst_rate', parseFloat(e.target.value) || 0)}
                                min="0"
                                placeholder="0.00"
                                className="border-blue-200/50"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium">IGST Rate %</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.igst_rate}
                                onChange={(e) => updatePerformaInvoiceItem(index, 'igst_rate', parseFloat(e.target.value) || 0)}
                                min="0"
                                placeholder="0.00"
                                className="border-blue-200/50"
                              />
                            </div>
                          </div>

                          {/* Tax Amounts (Calculated) */}
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                            <div>
                              <Label className="text-xs font-medium text-muted-foreground">CGST Amount</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.cgst_amount.toFixed(2)}
                                readOnly
                                className="bg-green-50/50 border-green-200/30 text-green-800"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-muted-foreground">SGST Amount</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.sgst_amount.toFixed(2)}
                                readOnly
                                className="bg-green-50/50 border-green-200/30 text-green-800"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-muted-foreground">IGST Amount</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.igst_amount.toFixed(2)}
                                readOnly
                                className="bg-green-50/50 border-green-200/30 text-green-800"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-primary">Total Price</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.total_price.toFixed(2)}
                                readOnly
                                className="bg-primary/5 border-primary/30 font-bold text-primary"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {performaInvoiceForm.items.length === 0 && (
                  <div className="text-center py-12 border-2 border-dashed border-border/30 rounded-lg">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No items added yet</p>
                    <p className="text-sm text-muted-foreground mt-1">Click "Add Item" to start building your invoice</p>
                  </div>
                )}
              </div>
              
              {/* Order Summary */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2 border-b pb-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Order Summary</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-gradient-to-br from-primary/5 via-primary/3 to-secondary/5 rounded-lg border border-primary/20">
                  <div className="text-center">
                    <Label className="text-sm text-muted-foreground">Subtotal</Label>
                    <p className="text-2xl font-bold">₹{performaInvoiceForm.subtotal_amount.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <Label className="text-sm text-muted-foreground">Discount</Label>
                    <p className="text-2xl font-bold text-green-600">-₹{performaInvoiceForm.discount_amount.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <Label className="text-sm text-muted-foreground">Tax</Label>
                    <p className="text-2xl font-bold text-blue-600">₹{performaInvoiceForm.tax_amount.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <Label className="text-sm text-muted-foreground">Total</Label>
                    <p className="text-3xl font-bold text-primary">₹{performaInvoiceForm.total_amount.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={performaInvoiceForm.notes}
                  onChange={(e) => setPerformaInvoiceForm({
                    ...performaInvoiceForm,
                    notes: e.target.value
                  })}
                  placeholder="Additional notes, terms & conditions..."
                  rows={3}
                  className="border-border/60"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t border-border/30">
                <Button type="button" variant="outline" onClick={() => setShowPerformaInvoiceForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 px-8">
                  {editingPerformaInvoice ? 'Update' : 'Create'} Performa Invoice
                </Button>
              </div>
            </form>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Customer Dialog */}
      <Dialog open={showAddCustomerDialog} onOpenChange={(open) => {
        setShowAddCustomerDialog(open);
        if (!open) {
          setEditingCustomer(null);
          setSameAsRegistered(false);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
            </DialogTitle>
            <DialogDescription>
              {editingCustomer ? 'Update customer information' : 'Enter customer details to add them to your system'}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[75vh] pr-4">
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              
              const customerData = {
                name: formData.get('name') as string,
                email: formData.get('email') as string,
                phone: formData.get('phone') as string,
                contact_person: formData.get('contact_person') as string,
                customer_type: formData.get('customer_type') as string,
                address_line1: formData.get('address_line1') as string,
                address_line2: formData.get('address_line2') as string,
                city: formData.get('city') as string,
                state: formData.get('state') as string,
                country: formData.get('country') as string,
                pin_code: formData.get('pin_code') as string,
                gstin: formData.get('gstin') as string,
                credit_limit: parseFloat(formData.get('credit_limit') as string) || 0,
                payment_terms: formData.get('payment_terms') as string,
                company_id: profile?.company_id
              };

              supabase
                .from('customers')
                .insert([customerData])
                .then(({ error }) => {
                  if (error) {
                    toast({
                      title: "Error",
                      description: "Failed to create customer",
                      variant: "destructive",
                    });
                  } else {
                    toast({
                      title: "Success",
                      description: "Customer created successfully",
                    });
                    setShowAddCustomerDialog(false);
                    fetchCustomers();
                  }
                });
            }} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">1. Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Company/Customer Name *</Label>
                    <Input 
                      id="name" 
                      name="name" 
                      required 
                      defaultValue={editingCustomer?.name || ''} 
                      placeholder="Enter customer name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="customer_type">Customer Type</Label>
                    <Select name="customer_type" defaultValue={editingCustomer?.customer_type || 'business'}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select customer type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="business">Business</SelectItem>
                        <SelectItem value="individual">Individual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="contact_person">Contact Person</Label>
                    <Input 
                      id="contact_person" 
                      name="contact_person" 
                      defaultValue={editingCustomer?.contact_person || ''} 
                      placeholder="Primary contact person"
                    />
                  </div>
                  <div>
                    <Label htmlFor="credit_limit">Credit Limit</Label>
                    <Input 
                      id="credit_limit" 
                      name="credit_limit" 
                      type="number" 
                      step="0.01" 
                      placeholder="0.00" 
                      defaultValue={editingCustomer?.credit_limit || 0} 
                    />
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">2. Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input 
                      id="email" 
                      name="email" 
                      type="email" 
                      defaultValue={editingCustomer?.email || ''} 
                      placeholder="customer@example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input 
                      id="phone" 
                      name="phone" 
                      defaultValue={editingCustomer?.phone || ''} 
                      placeholder="+91 9876543210"
                    />
                  </div>
                </div>
              </div>

              {/* Address Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">3. Registered Address Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="address_line1">Address Line 1 *</Label>
                    <Input 
                      id="address_line1" 
                      name="address_line1" 
                      required 
                      defaultValue={editingCustomer?.address_line1 || ''} 
                      placeholder="Street address, building number"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="address_line2">Address Line 2 (optional)</Label>
                    <Input 
                      id="address_line2" 
                      name="address_line2" 
                      defaultValue={editingCustomer?.address_line2 || ''} 
                      placeholder="Apartment, suite, unit, etc."
                    />
                  </div>
                  <div>
                    <Label htmlFor="city">City *</Label>
                    <Input 
                      id="city" 
                      name="city" 
                      required 
                      defaultValue={editingCustomer?.city || ''} 
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State/Province *</Label>
                    <Input 
                      id="state" 
                      name="state" 
                      required 
                      defaultValue={editingCustomer?.state || ''} 
                      placeholder="State"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pin_code">PIN / ZIP Code *</Label>
                    <Input 
                      id="pin_code" 
                      name="pin_code" 
                      required 
                      defaultValue={editingCustomer?.pin_code || ''} 
                      placeholder="123456"
                    />
                  </div>
                  <div>
                    <Label htmlFor="country">Country *</Label>
                    <Input 
                      id="country" 
                      name="country" 
                      required 
                      defaultValue={editingCustomer?.country || 'India'} 
                      placeholder="India"
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Address Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">4. Delivery Address Information</h3>
                <div className="flex items-center space-x-2 mb-4">
                  <Checkbox 
                    id="same_as_registered_address" 
                    name="same_as_registered_address"
                    defaultChecked={editingCustomer?.same_as_registered_address || false}
                    onCheckedChange={(checked) => {
                      const form = document.querySelector('form');
                      if (form) {
                        const inputs = form.querySelectorAll('[data-shipping]') as NodeListOf<HTMLInputElement>;
                        const registeredInputs = form.querySelectorAll('[name^="address_line1"], [name="address_line2"], [name="city"], [name="state"], [name="pin_code"], [name="country"]') as NodeListOf<HTMLInputElement>;
                        
                        if (checked) {
                          registeredInputs.forEach((input, index) => {
                            if (inputs[index]) {
                              inputs[index].value = input.value;
                            }
                          });
                        } else {
                          inputs.forEach(input => input.value = '');
                        }
                      }
                    }}
                  />
                  <Label htmlFor="same_as_registered_address">Same as registered address</Label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="shipping_address_line1">Delivery Address Line 1</Label>
                    <Input 
                      id="shipping_address_line1" 
                      name="shipping_address_line1" 
                      data-shipping
                      defaultValue={editingCustomer?.shipping_address_line1 || ''} 
                      placeholder="Street address, building number"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="shipping_address_line2">Delivery Address Line 2 (optional)</Label>
                    <Input 
                      id="shipping_address_line2" 
                      name="shipping_address_line2" 
                      data-shipping
                      defaultValue={editingCustomer?.shipping_address_line2 || ''} 
                      placeholder="Apartment, suite, unit, etc."
                    />
                  </div>
                  <div>
                    <Label htmlFor="shipping_city">Delivery City</Label>
                    <Input 
                      id="shipping_city" 
                      name="shipping_city" 
                      data-shipping
                      defaultValue={editingCustomer?.shipping_city || ''} 
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <Label htmlFor="shipping_state">Delivery State/Province</Label>
                    <Input 
                      id="shipping_state" 
                      name="shipping_state" 
                      data-shipping
                      defaultValue={editingCustomer?.shipping_state || ''} 
                      placeholder="State"
                    />
                  </div>
                  <div>
                    <Label htmlFor="shipping_pin_code">Delivery PIN / ZIP Code</Label>
                    <Input 
                      id="shipping_pin_code" 
                      name="shipping_pin_code" 
                      data-shipping
                      defaultValue={editingCustomer?.shipping_pin_code || ''} 
                      placeholder="123456"
                    />
                  </div>
                  <div>
                    <Label htmlFor="shipping_country">Delivery Country</Label>
                    <Input 
                      id="shipping_country" 
                      name="shipping_country" 
                      data-shipping
                      defaultValue={editingCustomer?.shipping_country || 'India'} 
                      placeholder="India"
                    />
                  </div>
                </div>
              </div>

              {/* Tax Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">5. Tax Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="gstin">GSTIN (if applicable)</Label>
                    <Input 
                      id="gstin" 
                      name="gstin" 
                      defaultValue={editingCustomer?.gstin || ''} 
                      placeholder="GST identification number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pan_number">PAN Number</Label>
                    <Input 
                      id="pan_number" 
                      name="pan_number" 
                      defaultValue={editingCustomer?.pan_number || ''} 
                      placeholder="PAN number"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">6. Payment Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="payment_terms">Payment Terms</Label>
                    <Select name="payment_terms" defaultValue={editingCustomer?.payment_terms || 'net_30'}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment terms" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="advance">Advance</SelectItem>
                        <SelectItem value="cod">COD</SelectItem>
                        <SelectItem value="net_15">Net 15</SelectItem>
                        <SelectItem value="net_30">Net 30</SelectItem>
                        <SelectItem value="net_45">Net 45</SelectItem>
                        <SelectItem value="net_60">Net 60</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="preferred_currency">Preferred Currency</Label>
                    <Select name="preferred_currency" defaultValue={editingCustomer?.preferred_currency || 'INR'}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                        <SelectItem value="GBP">GBP - British Pound</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="bank_name">Bank Name</Label>
                    <Input 
                      id="bank_name" 
                      name="bank_name" 
                      defaultValue={editingCustomer?.bank_name || ''} 
                      placeholder="Bank name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="branch_name">Branch Name</Label>
                    <Input 
                      id="branch_name" 
                      name="branch_name" 
                      defaultValue={editingCustomer?.branch_name || ''} 
                      placeholder="Branch name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="account_type">Account Type</Label>
                    <Select name="account_type" defaultValue={editingCustomer?.account_type || 'current'}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select account type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="current">Current Account</SelectItem>
                        <SelectItem value="savings">Savings Account</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="account_number">Account Number</Label>
                    <Input 
                      id="account_number" 
                      name="account_number" 
                      defaultValue={editingCustomer?.account_number || ''} 
                      placeholder="Account number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ifsc_code">IFSC Code</Label>
                    <Input 
                      id="ifsc_code" 
                      name="ifsc_code" 
                      defaultValue={editingCustomer?.ifsc_code || ''} 
                      placeholder="IFSC code"
                    />
                  </div>
                  <div>
                    <Label htmlFor="swift_code">SWIFT Code (if applicable)</Label>
                    <Input 
                      id="swift_code" 
                      name="swift_code" 
                      defaultValue={editingCustomer?.swift_code || ''} 
                      placeholder="SWIFT code"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setShowAddCustomerDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingCustomer ? 'Update Customer' : 'Create Customer'}
                </Button>
              </div>
            </form>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Sales Order Dialog */}
      <Dialog open={showAddSODialog} onOpenChange={setShowAddSODialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Create Sales Order</DialogTitle>
            <DialogDescription>
              Create a new sales order for your customer
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[75vh] pr-4">
            <form onSubmit={(e) => {
              e.preventDefault();
              toast({
                title: "Info",
                description: "Sales order creation coming soon",
              });
              setShowAddSODialog(false);
            }} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="so_customer">Customer *</Label>
                  <Select name="customer_id" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name} ({customer.customer_ref})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="order_date">Order Date *</Label>
                  <Input 
                    id="order_date" 
                    name="order_date" 
                    type="date" 
                    required 
                    defaultValue={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <Label htmlFor="customer_po_number">Customer PO Number</Label>
                  <Input 
                    id="customer_po_number" 
                    name="customer_po_number" 
                    placeholder="Customer's purchase order number"
                  />
                </div>
                <div>
                  <Label htmlFor="expected_delivery_date">Expected Delivery Date</Label>
                  <Input 
                    id="expected_delivery_date" 
                    name="expected_delivery_date" 
                    type="date"
                  />
                </div>
              </div>

              <div className="text-center py-8 border-2 border-dashed border-border/30 rounded-lg">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Sales order item management coming soon</p>
                <p className="text-sm text-muted-foreground mt-1">Advanced features will be available in the next update</p>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setShowAddSODialog(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Create Sales Order
                </Button>
              </div>
            </form>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
