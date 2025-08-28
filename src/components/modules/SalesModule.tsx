import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Plus, Search, FileText, Users, Edit, Trash2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

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
  const itemsPerPage = 5;

  useEffect(() => {
    fetchSalesOrders();
    fetchCustomers();
    fetchProducts();
  }, []);

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

  // Line item calculation functions
  const calculateLineTotal = (quantity: number, unitPrice: number, discountAmount: number, taxAmount: number) => {
    const subtotal = quantity * unitPrice;
    return subtotal - discountAmount + taxAmount;
  };

  const calculateTaxBreakdown = (amount: number, gstRate: number, isInterstate: boolean = false) => {
    const taxAmount = (amount * gstRate) / 100;
    
    if (isInterstate) {
      return {
        cgst_rate: 0,
        sgst_rate: 0,
        igst_rate: gstRate,
        cgst_amount: 0,
        sgst_amount: 0,
        igst_amount: taxAmount,
      };
    } else {
      return {
        cgst_rate: gstRate / 2,
        sgst_rate: gstRate / 2,
        igst_rate: 0,
        cgst_amount: taxAmount / 2,
        sgst_amount: taxAmount / 2,
        igst_amount: 0,
      };
    }
  };

  const calculateOrderTotals = () => {
    const subtotal = orderItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const totalDiscount = orderItems.reduce((sum, item) => sum + item.discount_amount, 0);
    const totalTax = orderItems.reduce((sum, item) => sum + item.cgst_amount + item.sgst_amount + item.igst_amount, 0);
    const total = subtotal - totalDiscount + totalTax;

    return {
      subtotal,
      totalDiscount,
      totalTax,
      total,
    };
  };

  const addLineItem = () => {
    const newItem: SalesOrderItem = {
      product_id: null,
      item_description: '',
      hsn_sac_code: '',
      quantity: 1,
      unit_of_measure: 'pcs',
      unit_price: 0,
      discount_percentage: 0,
      discount_amount: 0,
      tax_percentage: 18,
      cgst_rate: 9,
      sgst_rate: 9,
      igst_rate: 0,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      line_total: 0,
    };
    setOrderItems([...orderItems, newItem]);
  };

  const updateLineItem = (index: number, field: keyof SalesOrderItem, value: any) => {
    const updatedItems = [...orderItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };

    // Auto-calculate amounts when relevant fields change
    if (['quantity', 'unit_price', 'discount_percentage', 'cgst_rate', 'sgst_rate', 'igst_rate'].includes(field)) {
      const item = updatedItems[index];
      const subtotal = item.quantity * item.unit_price;
      
      // Calculate discount
      item.discount_amount = (subtotal * item.discount_percentage) / 100;
      
      // Calculate tax amounts based on manual rates
      const taxableAmount = subtotal - item.discount_amount;
      item.cgst_amount = (taxableAmount * item.cgst_rate) / 100;
      item.sgst_amount = (taxableAmount * item.sgst_rate) / 100;
      item.igst_amount = (taxableAmount * item.igst_rate) / 100;
      
      // Calculate total tax percentage for reference
      item.tax_percentage = item.cgst_rate + item.sgst_rate + item.igst_rate;
      
      // Calculate line total
      item.line_total = taxableAmount + item.cgst_amount + item.sgst_amount + item.igst_amount;
    }

    setOrderItems(updatedItems);
  };

  const removeLineItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const handleProductSelection = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      updateLineItem(index, 'product_id', productId);
      updateLineItem(index, 'item_description', product.description || product.name);
      updateLineItem(index, 'hsn_sac_code', product.hsn_code || '');
      updateLineItem(index, 'unit_price', product.unit_price);
      updateLineItem(index, 'unit_of_measure', product.unit || 'pcs');
      
      // Set default tax rates (can be manually edited)
      const gstRate = product.gst_percentage || 18;
      updateLineItem(index, 'cgst_rate', gstRate / 2);
      updateLineItem(index, 'sgst_rate', gstRate / 2);
      updateLineItem(index, 'igst_rate', 0); // Default to intrastate
      
      // Clear search term for this index
      setProductSearchTerms(prev => ({
        ...prev,
        [index]: ''
      }));
    }
  };

  const handleAddSalesOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!profile?.company_id || !selectedCustomer) {
      toast({
        title: "Error",
        description: "Please select a customer",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData(e.currentTarget);
    
    try {
      const salesOrderData = {
        company_id: profile.company_id,
        customer_id: formData.get('customer_id') as string,
        order_number: '', // Will be auto-generated by trigger
        order_date: formData.get('order_date') as string,
        customer_po_number: formData.get('customer_po_number') as string,
        customer_reference_no: selectedCustomer.customer_ref,
        status: formData.get('order_status') as string,
        delivery_address_line1: deliverySameAsRegistered ? selectedCustomer.address_line1 : formData.get('delivery_address_line1') as string,
        delivery_address_line2: deliverySameAsRegistered ? selectedCustomer.address_line2 : formData.get('delivery_address_line2') as string,
        delivery_city: deliverySameAsRegistered ? selectedCustomer.city : formData.get('delivery_city') as string,
        delivery_state: deliverySameAsRegistered ? selectedCustomer.state : formData.get('delivery_state') as string,
        delivery_pin_code: deliverySameAsRegistered ? selectedCustomer.pin_code : formData.get('delivery_pin_code') as string,
        delivery_country: deliverySameAsRegistered ? selectedCustomer.country : formData.get('delivery_country') as string,
        same_as_registered_address: deliverySameAsRegistered,
        expected_delivery_date: formData.get('expected_delivery_date') as string || null,
        mode_of_transport: formData.get('mode_of_transport') as string,
        shipping_instructions: formData.get('shipping_instructions') as string,
        currency: formData.get('currency') as string,
        payment_terms: formData.get('payment_terms') as string,
        notes: formData.get('notes') as string,
        created_by: profile.id, // Use profile.id instead of profile.user_id
        total_amount: 0,
        discount_amount: 0,
        tax_amount: 0,
        subtotal_amount: 0,
      };

      // Insert sales order first
      const { data: salesOrderResult, error } = await supabase
        .from('sales_orders')
        .insert(salesOrderData)
        .select()
        .single();

      if (error) {
        console.error('Error creating sales order:', error);
        toast({
          title: "Error",
          description: "Failed to create sales order",
          variant: "destructive",
        });
        return;
      }

      // Insert line items if any exist
      if (orderItems.length > 0) {
        const lineItemsData = orderItems.map(item => ({
          sales_order_id: salesOrderResult.id,
          product_id: item.product_id,
          item_description: item.item_description,
          hsn_sac_code: item.hsn_sac_code,
          quantity: item.quantity,
          unit_of_measure: item.unit_of_measure,
          unit_price: item.unit_price,
          discount_percentage: item.discount_percentage,
          discount_amount: item.discount_amount,
          tax_percentage: item.tax_percentage,
          cgst_rate: item.cgst_rate,
          sgst_rate: item.sgst_rate,
          igst_rate: item.igst_rate,
          cgst_amount: item.cgst_amount,
          sgst_amount: item.sgst_amount,
          igst_amount: item.igst_amount,
          total_price: item.line_total, // Map line_total to total_price for database
        }));

        const { error: itemsError } = await supabase
          .from('sales_order_items')
          .insert(lineItemsData);

        if (itemsError) {
          console.error('Error creating line items:', itemsError);
          toast({
            title: "Warning",
            description: "Sales order created but failed to add line items",
            variant: "destructive",
          });
        }

        // Update sales order totals
        const totals = calculateOrderTotals();
        if (totals.total > 0) {
          await supabase
            .from('sales_orders')
            .update({
              subtotal_amount: totals.subtotal,
              total_amount: totals.total,
              tax_amount: totals.totalTax,
              discount_amount: totals.totalDiscount,
            })
            .eq('id', salesOrderResult.id);
        }
      }

      toast({
        title: "Success",
        description: "Sales order created successfully",
      });

      setShowAddSODialog(false);
      setSelectedCustomer(null);
      setDeliverySameAsRegistered(false);
      setOrderItems([]); // Reset order items
      fetchSalesOrders();
      
    } catch (error) {
      console.error('Error creating sales order:', error);
      toast({
        title: "Error",
        description: "Failed to create sales order",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSalesOrder = async (id: string) => {
    try {
      const { error } = await supabase
        .from('sales_orders')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting sales order:', error);
        toast({
          title: "Error",
          description: "Failed to delete sales order",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Sales order deleted successfully",
      });

      fetchSalesOrders();
    } catch (error) {
      console.error('Error deleting sales order:', error);
      toast({
        title: "Error",
        description: "Failed to delete sales order",
        variant: "destructive",
      });
    }
  };

  const handleAddCustomer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!profile?.company_id) {
      toast({
        title: "Error",
        description: "Company not found",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData(e.currentTarget);
    
    try {
      const customerData = {
        company_id: profile.company_id,
        name: formData.get('name') as string,
        customer_type: formData.get('customer_type') as string,
        contact_person: formData.get('contact_person') as string,
        email: formData.get('email') as string,
        phone: formData.get('phone') as string,
        address_line1: formData.get('address_line1') as string,
        address_line2: formData.get('address_line2') as string,
        city: formData.get('city') as string,
        state: formData.get('state') as string,
        pin_code: formData.get('pin_code') as string,
        country: formData.get('country') as string,
        alternate_email: formData.get('alternate_email') as string,
        landline_number: formData.get('landline_number') as string,
        website: formData.get('website') as string,
        gstin: formData.get('gstin') as string,
        pan_number: formData.get('pan_number') as string,
        msme_registration_no: formData.get('msme_registration_no') as string,
        business_registration_no: formData.get('business_registration_no') as string,
        shipping_address_line1: sameAsRegistered ? formData.get('address_line1') as string : formData.get('shipping_address_line1') as string,
        shipping_address_line2: sameAsRegistered ? formData.get('address_line2') as string : formData.get('shipping_address_line2') as string,
        shipping_city: sameAsRegistered ? formData.get('city') as string : formData.get('shipping_city') as string,
        shipping_state: sameAsRegistered ? formData.get('state') as string : formData.get('shipping_state') as string,
        shipping_pin_code: sameAsRegistered ? formData.get('pin_code') as string : formData.get('shipping_pin_code') as string,
        shipping_country: sameAsRegistered ? formData.get('country') as string : formData.get('shipping_country') as string,
        same_as_registered_address: sameAsRegistered,
        payment_terms: formData.get('payment_terms') as string,
        credit_limit: parseFloat(formData.get('credit_limit') as string) || 0,
        preferred_currency: formData.get('preferred_currency') as string,
        billing_cycle: formData.get('billing_cycle') as string,
        bank_name: formData.get('bank_name') as string,
        branch_name: formData.get('branch_name') as string,
        account_number: formData.get('account_number') as string,
        account_type: formData.get('account_type') as string,
        ifsc_code: formData.get('ifsc_code') as string,
        swift_code: formData.get('swift_code') as string,
        upi_id: formData.get('upi_id') as string,
      };

      if (editingCustomer) {
        const { error } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', editingCustomer.id);

        if (error) {
          console.error('Error updating customer:', error);
          toast({
            title: "Error",
            description: "Failed to update customer",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Success",
          description: "Customer updated successfully",
        });
      } else {
        const { error } = await supabase
          .from('customers')
          .insert([customerData]);

        if (error) {
          console.error('Error creating customer:', error);
          toast({
            title: "Error",
            description: "Failed to create customer",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Success",
          description: "Customer created successfully",
        });
      }

      setShowAddCustomerDialog(false);
      setEditingCustomer(null);
      setSameAsRegistered(false);
      fetchCustomers();
      
    } catch (error) {
      console.error('Error processing customer:', error);
      toast({
        title: "Error",
        description: "Failed to process customer",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting customer:', error);
        toast({
          title: "Error",
          description: "Failed to delete customer",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Customer deleted successfully",
      });

      fetchCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast({
        title: "Error",
        description: "Failed to delete customer",
        variant: "destructive",
      });
    }
  };

  // Filter and sort sales orders
  const filteredSalesOrders = salesOrders.filter(order => {
    const searchLower = searchTerm.toLowerCase();
    return (
      order.order_number.toLowerCase().includes(searchLower) ||
      order.customer_po_number?.toLowerCase().includes(searchLower) ||
      order.customer.name.toLowerCase().includes(searchLower) ||
      order.customer.customer_ref?.toLowerCase().includes(searchLower)
    );
  }).sort((a, b) => {
    const direction = soSortDirection === 'asc' ? 1 : -1;
    
    switch (soSortField) {
      case 'order_number':
        return direction * a.order_number.localeCompare(b.order_number);
      case 'customer_po_number':
        return direction * (a.customer_po_number || '').localeCompare(b.customer_po_number || '');
      case 'customer_name':
        return direction * a.customer.name.localeCompare(b.customer.name);
      case 'order_date':
        return direction * new Date(a.order_date).getTime() - direction * new Date(b.order_date).getTime();
      default:
        return 0;
    }
  });

  // Filter and sort customers
  const filteredCustomers = customers.filter(customer => {
    const searchLower = customerSearchTerm.toLowerCase();
    return (
      customer.name.toLowerCase().includes(searchLower) ||
      customer.customer_ref?.toLowerCase().includes(searchLower) ||
      customer.gstin?.toLowerCase().includes(searchLower)
    );
  }).sort((a, b) => {
    const direction = sortDirection === 'asc' ? 1 : -1;
    
    switch (sortField) {
      case 'name':
        return direction * a.name.localeCompare(b.name);
      case 'customer_ref':
        return direction * (a.customer_ref || '').localeCompare(b.customer_ref || '');
      case 'gstin':
        return direction * (a.gstin || '').localeCompare(b.gstin || '');
      default:
        return 0;
    }
  });

  // Pagination for sales orders
  const soTotalPages = Math.ceil(filteredSalesOrders.length / itemsPerPage);
  const soPaginatedOrders = filteredSalesOrders.slice(
    (soCurrentPage - 1) * itemsPerPage,
    soCurrentPage * itemsPerPage
  );

  // Pagination for customers
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (field: 'name' | 'customer_ref' | 'gstin') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSOSort = (field: 'order_number' | 'customer_po_number' | 'customer_name' | 'order_date') => {
    if (soSortField === field) {
      setSoSortDirection(soSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSoSortField(field);
      setSoSortDirection('asc');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Sales Management</h2>
          <p className="text-muted-foreground">Manage sales orders and customers</p>
        </div>
      </div>

      <Tabs defaultValue="sales-orders" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sales-orders">Sales Orders</TabsTrigger>
          <TabsTrigger value="customers">Customer Management</TabsTrigger>
        </TabsList>

        <TabsContent value="sales-orders" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Sales Orders
                  </CardTitle>
                  <CardDescription>Manage and track sales orders</CardDescription>
                </div>
                <Dialog open={showAddSODialog} onOpenChange={setShowAddSODialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Sales Order
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-6xl max-h-[90vh]">
                    <DialogHeader>
                      <DialogTitle>{editingSalesOrder ? 'Edit Sales Order' : 'Create New Sales Order'}</DialogTitle>
                      <DialogDescription>
                        {editingSalesOrder ? 'Update sales order information' : 'Create a comprehensive sales order with line items'}
                      </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[75vh] pr-4">
                      <form onSubmit={handleAddSalesOrder} className="space-y-6">
                        {/* Order Identification */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold">1. Order Identification</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <Label htmlFor="order_date">Order Receipt Date *</Label>
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
                              <Input id="customer_po_number" name="customer_po_number" placeholder="Customer's purchase order number" />
                            </div>
                            <div>
                              <Label htmlFor="order_status">Order Status *</Label>
                              <Select name="order_status" defaultValue="confirmed">
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="confirmed">Confirmed</SelectItem>
                                  <SelectItem value="in_progress">In Progress</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                  <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>

                        <Separator />

                        {/* Customer Link */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold">2. Customer Information</h3>
                          <div>
                            <Label htmlFor="customer_id">Select Customer *</Label>
                            <Select 
                              name="customer_id" 
                              required
                              onValueChange={(value) => {
                                const customer = customers.find(c => c.id === value);
                                setSelectedCustomer(customer || null);
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Search and select customer" />
                              </SelectTrigger>
                              <SelectContent>
                                {customers.map((customer) => (
                                  <SelectItem key={customer.id} value={customer.id}>
                                    {customer.name} - {customer.customer_ref || 'No Ref'} - {customer.gstin || 'No GSTIN'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {selectedCustomer && (
                            <div className="bg-muted/50 p-4 rounded-lg">
                              <h4 className="font-medium mb-2">Customer Details</h4>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <p><strong>Name:</strong> {selectedCustomer.name}</p>
                                <p><strong>Email:</strong> {selectedCustomer.email || 'N/A'}</p>
                                <p><strong>Phone:</strong> {selectedCustomer.phone || 'N/A'}</p>
                                <p><strong>GSTIN:</strong> {selectedCustomer.gstin || 'N/A'}</p>
                                <p><strong>Payment Terms:</strong> {selectedCustomer.payment_terms || 'N/A'}</p>
                                <p><strong>Credit Limit:</strong> ₹{selectedCustomer.credit_limit.toLocaleString()}</p>
                              </div>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Order Line Items */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">3. Order Line Items</h3>
                        <Button type="button" onClick={addLineItem} variant="outline" size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Item
                        </Button>
                      </div>
                      
                      {orderItems.length > 0 && (
                        <div className="space-y-4">
                          <div className="border rounded-lg overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/50">
                                  <TableHead className="w-48">Product</TableHead>
                                  <TableHead className="w-40">Description</TableHead>
                                  <TableHead className="w-24">HSN/SAC</TableHead>
                                  <TableHead className="w-20">Qty</TableHead>
                                  <TableHead className="w-20">UOM</TableHead>
                                  <TableHead className="w-24">Unit Price</TableHead>
                                  <TableHead className="w-20">Disc %</TableHead>
                                  <TableHead className="w-20">CGST %</TableHead>
                                  <TableHead className="w-20">SGST %</TableHead>
                                  <TableHead className="w-20">IGST %</TableHead>
                                  <TableHead className="w-24">Line Total</TableHead>
                                  <TableHead className="w-12"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {orderItems.map((item, index) => (
                                  <TableRow key={index}>
                                    <TableCell className="w-48">
                                      <div className="space-y-2">
                                        <div className="relative">
                                          <Select
                                            value={item.product_id || ''}
                                            onValueChange={(value) => handleProductSelection(index, value)}
                                          >
                                            <SelectTrigger className="w-full">
                                              <span className="truncate">
                                                {item.product_id ? (products.find(p => p.id === item.product_id)?.sku || 'SKU') : 'Select SKU'}
                                              </span>
                                            </SelectTrigger>
                                            <SelectContent className="max-h-60 z-[100]">
                                              {products
                                                .filter(product => {
                                                  const term = (productSearchTerms[index] || '').toLowerCase();
                                                  return term === '' ||
                                                         product.name.toLowerCase().includes(term) ||
                                                         product.sku.toLowerCase().includes(term) ||
                                                         (product.description && product.description.toLowerCase().includes(term));
                                                })
                                                .map((product) => (
                                                <SelectItem key={product.id} value={product.id}>
                                                  {product.sku}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                          <Input
                                            placeholder="Search products..."
                                            className="mt-1 text-xs"
                                            value={productSearchTerms[index] || ''}
                                            onChange={(e) => {
                                              setProductSearchTerms(prev => ({
                                                ...prev,
                                                [index]: e.target.value
                                              }));
                                            }}
                                          />
                                        </div>
                                        {item.product_id && (
                                          <div className="text-xs text-muted-foreground">
                                            SKU: {products.find(p => p.id === item.product_id)?.sku}
                                          </div>
                                        )}
                                      </div>
                                    </TableCell>
                                      <TableCell className="w-40">
                                        <div className="space-y-2">
                                          <Select
                                            value={item.product_id || ''}
                                            onValueChange={(value) => handleProductSelection(index, value)}
                                          >
                                            <SelectTrigger className="w-full">
                                              <span className="truncate">
                                                {item.product_id ? (products.find(p => p.id === item.product_id)?.sku || 'SKU') : 'Search by description'}
                                              </span>
                                            </SelectTrigger>
                                            <SelectContent className="max-h-60 z-[100]">
                                              {products
                                                .filter(product => {
                                                  const term = (productSearchTerms[index] || '').toLowerCase();
                                                  return term === '' ||
                                                         (product.description && product.description.toLowerCase().includes(term)) ||
                                                         product.name.toLowerCase().includes(term) ||
                                                         product.sku.toLowerCase().includes(term);
                                                })
                                                .map((product) => (
                                                <SelectItem key={product.id} value={product.id}>
                                                  {product.name}{product.description ? ` — ${product.description}` : ''}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                          <Input
                                            placeholder="Search in description..."
                                            className="text-xs"
                                            value={productSearchTerms[index] || ''}
                                            onChange={(e) => {
                                              setProductSearchTerms(prev => ({
                                                ...prev,
                                                [index]: e.target.value
                                              }));
                                            }}
                                          />
                                          <Textarea
                                            value={item.item_description}
                                            onChange={(e) => updateLineItem(index, 'item_description', e.target.value)}
                                            placeholder="Description"
                                            className="text-xs min-h-[60px] resize-none"
                                          />
                                        </div>
                                      </TableCell>
                                    <TableCell className="w-24">
                                      <Input
                                        value={item.hsn_sac_code}
                                        onChange={(e) => updateLineItem(index, 'hsn_sac_code', e.target.value)}
                                        placeholder="HSN"
                                        className="text-xs"
                                      />
                                    </TableCell>
                                    <TableCell className="w-20">
                                      <Input
                                        type="number"
                                        value={item.quantity}
                                        onChange={(e) => updateLineItem(index, 'quantity', parseInt(e.target.value) || 0)}
                                        className="text-xs"
                                        min="1"
                                      />
                                    </TableCell>
                                    <TableCell className="w-20">
                                      <Input
                                        value={item.unit_of_measure}
                                        onChange={(e) => updateLineItem(index, 'unit_of_measure', e.target.value)}
                                        className="text-xs"
                                        placeholder="pcs"
                                      />
                                    </TableCell>
                                    <TableCell className="w-24">
                                      <Input
                                        type="number"
                                        value={item.unit_price}
                                        onChange={(e) => updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                        className="text-xs"
                                        step="0.01"
                                        placeholder="0.00"
                                      />
                                    </TableCell>
                                    <TableCell className="w-20">
                                      <Input
                                        type="number"
                                        value={item.discount_percentage}
                                        onChange={(e) => updateLineItem(index, 'discount_percentage', parseFloat(e.target.value) || 0)}
                                        className="text-xs"
                                        step="0.1"
                                        max="100"
                                        placeholder="0"
                                      />
                                    </TableCell>
                                    <TableCell className="w-20">
                                      <Input
                                        type="number"
                                        value={item.cgst_rate}
                                        onChange={(e) => updateLineItem(index, 'cgst_rate', parseFloat(e.target.value) || 0)}
                                        className="text-xs"
                                        step="0.1"
                                        placeholder="9"
                                      />
                                    </TableCell>
                                    <TableCell className="w-20">
                                      <Input
                                        type="number"
                                        value={item.sgst_rate}
                                        onChange={(e) => updateLineItem(index, 'sgst_rate', parseFloat(e.target.value) || 0)}
                                        className="text-xs"
                                        step="0.1"
                                        placeholder="9"
                                      />
                                    </TableCell>
                                    <TableCell className="w-20">
                                      <Input
                                        type="number"
                                        value={item.igst_rate}
                                        onChange={(e) => updateLineItem(index, 'igst_rate', parseFloat(e.target.value) || 0)}
                                        className="text-xs"
                                        step="0.1"
                                        placeholder="18"
                                      />
                                    </TableCell>
                                    <TableCell className="w-24 font-medium">
                                      ₹{item.line_total.toFixed(2)}
                                    </TableCell>
                                    <TableCell className="w-12">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => removeLineItem(index)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>

                          {/* Tax Breakdown and Totals */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-muted/50 p-4 rounded-lg">
                              <h4 className="font-medium mb-3">Tax Breakdown</h4>
                              <div className="space-y-2 text-sm">
                                {orderItems.map((item, index) => (
                                  item.line_total > 0 && (
                                    <div key={index} className="border-b pb-2">
                                      <p className="font-medium">{item.item_description || `Item ${index + 1}`}</p>
                                      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                                        <div>CGST ({item.cgst_rate}%): ₹{item.cgst_amount.toFixed(2)}</div>
                                        <div>SGST ({item.sgst_rate}%): ₹{item.sgst_amount.toFixed(2)}</div>
                                        <div>IGST ({item.igst_rate}%): ₹{item.igst_amount.toFixed(2)}</div>
                                      </div>
                                    </div>
                                  )
                                ))}
                              </div>
                            </div>
                            
                            <div className="bg-primary/5 p-4 rounded-lg">
                              <h4 className="font-medium mb-3">Order Summary</h4>
                              <div className="space-y-2">
                                <div className="flex justify-between">
                                  <span>Subtotal:</span>
                                  <span>₹{calculateOrderTotals().subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Discount:</span>
                                  <span>-₹{calculateOrderTotals().totalDiscount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Tax:</span>
                                  <span>₹{calculateOrderTotals().totalTax.toFixed(2)}</span>
                                </div>
                                <Separator />
                                <div className="flex justify-between font-bold text-lg">
                                  <span>Total:</span>
                                  <span>₹{calculateOrderTotals().total.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {orderItems.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No line items added yet</p>
                          <p className="text-sm">Click "Add Item" to start adding products to this order</p>
                        </div>
                      )}
                    </div>

                    <Separator />

                        {/* Shipping & Delivery */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold">4. Shipping & Delivery</h3>
                          <div className="flex items-center space-x-2 mb-4">
                            <Checkbox 
                              id="same_as_registered_delivery" 
                              checked={deliverySameAsRegistered}
                              onCheckedChange={(checked) => setDeliverySameAsRegistered(checked === true)}
                            />
                            <Label htmlFor="same_as_registered_delivery">Same as Customer Registered Address</Label>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                              <Label htmlFor="delivery_address_line1">Delivery Address Line 1</Label>
                              <Input 
                                id="delivery_address_line1" 
                                name="delivery_address_line1" 
                                disabled={deliverySameAsRegistered}
                                className={deliverySameAsRegistered ? 'bg-muted' : ''}
                                defaultValue={deliverySameAsRegistered ? selectedCustomer?.address_line1 || '' : ''}
                              />
                            </div>
                            <div className="md:col-span-2">
                              <Label htmlFor="delivery_address_line2">Delivery Address Line 2</Label>
                              <Input 
                                id="delivery_address_line2" 
                                name="delivery_address_line2" 
                                disabled={deliverySameAsRegistered}
                                className={deliverySameAsRegistered ? 'bg-muted' : ''}
                              />
                            </div>
                            <div>
                              <Label htmlFor="delivery_city">City</Label>
                              <Input 
                                id="delivery_city" 
                                name="delivery_city" 
                                disabled={deliverySameAsRegistered}
                                className={deliverySameAsRegistered ? 'bg-muted' : ''}
                                defaultValue={deliverySameAsRegistered ? selectedCustomer?.city || '' : ''}
                              />
                            </div>
                            <div>
                              <Label htmlFor="delivery_state">State</Label>
                              <Input 
                                id="delivery_state" 
                                name="delivery_state" 
                                disabled={deliverySameAsRegistered}
                                className={deliverySameAsRegistered ? 'bg-muted' : ''}
                                defaultValue={deliverySameAsRegistered ? selectedCustomer?.state || '' : ''}
                              />
                            </div>
                            <div>
                              <Label htmlFor="delivery_pin_code">PIN Code</Label>
                              <Input 
                                id="delivery_pin_code" 
                                name="delivery_pin_code" 
                                disabled={deliverySameAsRegistered}
                                className={deliverySameAsRegistered ? 'bg-muted' : ''}
                                defaultValue={deliverySameAsRegistered ? selectedCustomer?.pin_code || '' : ''}
                              />
                            </div>
                            <div>
                              <Label htmlFor="delivery_country">Country</Label>
                              <Input 
                                id="delivery_country" 
                                name="delivery_country" 
                                disabled={deliverySameAsRegistered}
                                className={deliverySameAsRegistered ? 'bg-muted' : ''}
                                defaultValue={deliverySameAsRegistered ? selectedCustomer?.country || 'India' : 'India'}
                              />
                            </div>
                            <div>
                              <Label htmlFor="expected_delivery_date">Expected Delivery Date</Label>
                              <Input id="expected_delivery_date" name="expected_delivery_date" type="date" />
                            </div>
                            <div>
                              <Label htmlFor="mode_of_transport">Mode of Transport</Label>
                              <Input id="mode_of_transport" name="mode_of_transport" placeholder="Courier, Road, Air, etc." />
                            </div>
                            <div className="md:col-span-2">
                              <Label htmlFor="shipping_instructions">Shipping Instructions</Label>
                              <Textarea id="shipping_instructions" name="shipping_instructions" placeholder="Special packaging, handling instructions..." />
                            </div>
                          </div>
                        </div>

                        <Separator />

                        {/* Payment & Commercials */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold">5. Payment & Commercials</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="currency">Currency</Label>
                              <Select name="currency" defaultValue="INR">
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="INR">INR</SelectItem>
                                  <SelectItem value="USD">USD</SelectItem>
                                  <SelectItem value="EUR">EUR</SelectItem>
                                  <SelectItem value="GBP">GBP</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="payment_terms">Payment Terms</Label>
                              <Input 
                                id="payment_terms" 
                                name="payment_terms" 
                                placeholder="Net 30, Advance, etc."
                                defaultValue={selectedCustomer?.payment_terms || ''}
                              />
                            </div>
                          </div>
                        </div>

                        <Separator />

                        {/* Notes */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold">6. Additional Notes</h3>
                          <div>
                            <Label htmlFor="notes">Order Notes</Label>
                            <Textarea id="notes" name="notes" placeholder="Any additional information..." />
                          </div>
                        </div>

                        <div className="pt-4">
                          <Button type="submit" className="w-full">
                            {editingSalesOrder ? 'Update Sales Order' : 'Create Sales Order'}
                          </Button>
                        </div>
                      </form>
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by order number, PO number, customer name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleSOSort('order_number')}
                          className="h-auto p-0 font-semibold"
                        >
                          Order Number
                          {soSortField === 'order_number' && (
                            soSortDirection === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                          )}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleSOSort('customer_name')}
                          className="h-auto p-0 font-semibold"
                        >
                          Customer
                          {soSortField === 'customer_name' && (
                            soSortDirection === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                          )}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleSOSort('customer_po_number')}
                          className="h-auto p-0 font-semibold"
                        >
                          PO Number
                          {soSortField === 'customer_po_number' && (
                            soSortDirection === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                          )}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleSOSort('order_date')}
                          className="h-auto p-0 font-semibold"
                        >
                          Order Date
                          {soSortField === 'order_date' && (
                            soSortDirection === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                          )}
                        </Button>
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {soPaginatedOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.order_number}</TableCell>
                        <TableCell>{order.customer.name}</TableCell>
                        <TableCell>{order.customer_po_number || 'N/A'}</TableCell>
                        <TableCell>{new Date(order.order_date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge variant={
                            order.status === 'completed' ? 'default' :
                            order.status === 'confirmed' ? 'secondary' :
                            order.status === 'in_progress' ? 'outline' : 'destructive'
                          }>
                            {order.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>₹{order.total_amount.toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingSalesOrder(order);
                                setShowAddSODialog(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteSalesOrder(order.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Sales Orders Pagination */}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {((soCurrentPage - 1) * itemsPerPage) + 1} to {Math.min(soCurrentPage * itemsPerPage, filteredSalesOrders.length)} of {filteredSalesOrders.length} orders
                  </p>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSOCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={soCurrentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {soCurrentPage} of {soTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSOCurrentPage(prev => Math.min(prev + 1, soTotalPages))}
                      disabled={soCurrentPage === soTotalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
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
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Customer Management
                  </CardTitle>
                  <CardDescription>Manage customer information and details</CardDescription>
                </div>
                <Dialog open={showAddCustomerDialog} onOpenChange={setShowAddCustomerDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Customer
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh]">
                    <DialogHeader>
                      <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
                      <DialogDescription>
                        {editingCustomer ? 'Update customer information' : 'Create a comprehensive customer profile'}
                      </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[75vh] pr-4">
                      <form onSubmit={handleAddCustomer} className="space-y-6">
                        {/* Basic Information */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold">1. Basic Information</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="name">Customer Name / Business Name *</Label>
                              <Input id="name" name="name" required defaultValue={editingCustomer?.name || ''} />
                            </div>
                            <div>
                              <Label htmlFor="customer_type">Customer Type *</Label>
                              <Select name="customer_type" required defaultValue={editingCustomer?.customer_type || ''}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select customer type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="individual">Individual</SelectItem>
                                  <SelectItem value="business">Business</SelectItem>
                                  <SelectItem value="government">Government</SelectItem>
                                  <SelectItem value="msme">MSME</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="contact_person">Contact Person Name</Label>
                              <Input id="contact_person" name="contact_person" placeholder="For business customers" defaultValue={editingCustomer?.contact_person || ''} />
                            </div>
                          </div>
                        </div>

                        <Separator />

                        {/* Registered Address */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold">2. Registered Address</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                              <Label htmlFor="address_line1">Address Line 1</Label>
                              <Input id="address_line1" name="address_line1" defaultValue={editingCustomer?.address_line1 || ''} />
                            </div>
                            <div className="md:col-span-2">
                              <Label htmlFor="address_line2">Address Line 2 (optional)</Label>
                              <Input id="address_line2" name="address_line2" defaultValue={editingCustomer?.address_line2 || ''} />
                            </div>
                            <div>
                              <Label htmlFor="city">City</Label>
                              <Input id="city" name="city" defaultValue={editingCustomer?.city || ''} />
                            </div>
                            <div>
                              <Label htmlFor="state">State</Label>
                              <Input id="state" name="state" defaultValue={editingCustomer?.state || ''} />
                            </div>
                            <div>
                              <Label htmlFor="pin_code">PIN / ZIP Code</Label>
                              <Input id="pin_code" name="pin_code" defaultValue={editingCustomer?.pin_code || ''} />
                            </div>
                            <div>
                              <Label htmlFor="country">Country</Label>
                              <Input id="country" name="country" defaultValue={editingCustomer?.country || 'India'} />
                            </div>
                          </div>
                        </div>

                        <Separator />

                        {/* Communication Details */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold">3. Communication Details</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="email">Primary Email ID</Label>
                              <Input id="email" name="email" type="email" defaultValue={editingCustomer?.email || ''} />
                            </div>
                            <div>
                              <Label htmlFor="alternate_email">Alternate Email ID (optional)</Label>
                              <Input id="alternate_email" name="alternate_email" type="email" defaultValue={editingCustomer?.alternate_email || ''} />
                            </div>
                            <div>
                              <Label htmlFor="phone">Phone Number (mobile)</Label>
                              <Input id="phone" name="phone" defaultValue={editingCustomer?.phone || ''} />
                            </div>
                            <div>
                              <Label htmlFor="landline_number">Landline Number (optional)</Label>
                              <Input id="landline_number" name="landline_number" defaultValue={editingCustomer?.landline_number || ''} />
                            </div>
                            <div className="md:col-span-2">
                              <Label htmlFor="website">Website (if business customer)</Label>
                              <Input id="website" name="website" placeholder="https://example.com" defaultValue={editingCustomer?.website || ''} />
                            </div>
                          </div>
                        </div>

                        <Separator />

                        {/* Tax & Legal Information */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold">4. Tax & Legal Information</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="gstin">GSTIN (if applicable)</Label>
                              <Input id="gstin" name="gstin" defaultValue={editingCustomer?.gstin || ''} />
                            </div>
                            <div>
                              <Label htmlFor="pan_number">PAN (India) / Tax ID (International)</Label>
                              <Input id="pan_number" name="pan_number" defaultValue={editingCustomer?.pan_number || ''} />
                            </div>
                            <div>
                              <Label htmlFor="msme_registration_no">MSME Registration No. (optional)</Label>
                              <Input id="msme_registration_no" name="msme_registration_no" defaultValue={editingCustomer?.msme_registration_no || ''} />
                            </div>
                            <div>
                              <Label htmlFor="business_registration_no">Business Registration No. (optional)</Label>
                              <Input id="business_registration_no" name="business_registration_no" defaultValue={editingCustomer?.business_registration_no || ''} />
                            </div>
                          </div>
                        </div>

                        <Separator />

                        {/* Shipping Address */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold">5. Shipping Address</h3>
                          <div className="flex items-center space-x-2">
                            <Checkbox 
                              id="same_as_registered_address" 
                              name="same_as_registered_address" 
                              checked={sameAsRegistered}
                              onCheckedChange={(checked) => setSameAsRegistered(checked === true)}
                            />
                            <Label htmlFor="same_as_registered_address">Same as Registered Address</Label>
                          </div>
                          <div id="shipping-address-fields" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                              <Label htmlFor="shipping_address_line1">Shipping Address Line 1</Label>
                              <Input 
                                id="shipping_address_line1" 
                                name="shipping_address_line1" 
                                disabled={sameAsRegistered}
                                className={sameAsRegistered ? 'bg-muted' : ''}
                                defaultValue={sameAsRegistered ? editingCustomer?.address_line1 || '' : editingCustomer?.shipping_address_line1 || ''}
                              />
                            </div>
                            <div className="md:col-span-2">
                              <Label htmlFor="shipping_address_line2">Shipping Address Line 2 (optional)</Label>
                              <Input 
                                id="shipping_address_line2" 
                                name="shipping_address_line2" 
                                disabled={sameAsRegistered}
                                className={sameAsRegistered ? 'bg-muted' : ''}
                                defaultValue={sameAsRegistered ? editingCustomer?.address_line2 || '' : editingCustomer?.shipping_address_line2 || ''}
                              />
                            </div>
                            <div>
                              <Label htmlFor="shipping_city">Shipping City</Label>
                              <Input 
                                id="shipping_city" 
                                name="shipping_city" 
                                disabled={sameAsRegistered}
                                className={sameAsRegistered ? 'bg-muted' : ''}
                                defaultValue={sameAsRegistered ? editingCustomer?.city || '' : editingCustomer?.shipping_city || ''}
                              />
                            </div>
                            <div>
                              <Label htmlFor="shipping_state">Shipping State</Label>
                              <Input 
                                id="shipping_state" 
                                name="shipping_state" 
                                disabled={sameAsRegistered}
                                className={sameAsRegistered ? 'bg-muted' : ''}
                                defaultValue={sameAsRegistered ? editingCustomer?.state || '' : editingCustomer?.shipping_state || ''}
                              />
                            </div>
                            <div>
                              <Label htmlFor="shipping_pin_code">Shipping PIN / ZIP Code</Label>
                              <Input 
                                id="shipping_pin_code" 
                                name="shipping_pin_code" 
                                disabled={sameAsRegistered}
                                className={sameAsRegistered ? 'bg-muted' : ''}
                                defaultValue={sameAsRegistered ? editingCustomer?.pin_code || '' : editingCustomer?.shipping_pin_code || ''}
                              />
                            </div>
                            <div>
                              <Label htmlFor="shipping_country">Shipping Country</Label>
                              <Input 
                                id="shipping_country" 
                                name="shipping_country" 
                                defaultValue={sameAsRegistered ? editingCustomer?.country || 'India' : editingCustomer?.shipping_country || 'India'} 
                                disabled={sameAsRegistered}
                                className={sameAsRegistered ? 'bg-muted' : ''}
                              />
                            </div>
                          </div>
                        </div>

                        <Separator />

                        {/* Payment Terms & Credit Control */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold">6. Payment Terms & Credit Control</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="payment_terms">Payment Terms</Label>
                              <Select name="payment_terms" defaultValue={editingCustomer?.payment_terms || ''}>
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
                              <Label htmlFor="credit_limit">Credit Limit</Label>
                              <Input id="credit_limit" name="credit_limit" type="number" step="0.01" placeholder="0.00" defaultValue={editingCustomer?.credit_limit || 0} />
                            </div>
                            <div>
                              <Label htmlFor="preferred_currency">Preferred Currency</Label>
                              <Select name="preferred_currency" defaultValue={editingCustomer?.preferred_currency || 'INR'}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="INR">INR</SelectItem>
                                  <SelectItem value="USD">USD</SelectItem>
                                  <SelectItem value="EUR">EUR</SelectItem>
                                  <SelectItem value="GBP">GBP</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="billing_cycle">Billing Cycle</Label>
                              <Select name="billing_cycle" defaultValue={editingCustomer?.billing_cycle || ''}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select billing cycle" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="monthly">Monthly</SelectItem>
                                  <SelectItem value="quarterly">Quarterly</SelectItem>
                                  <SelectItem value="on_delivery">On Delivery</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>

                        <Separator />

                        {/* Bank & Payment Details */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold">7. Bank & Payment Details</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="bank_name">Bank Name</Label>
                              <Input id="bank_name" name="bank_name" defaultValue={editingCustomer?.bank_name || ''} />
                            </div>
                            <div>
                              <Label htmlFor="branch_name">Branch Name</Label>
                              <Input id="branch_name" name="branch_name" defaultValue={editingCustomer?.branch_name || ''} />
                            </div>
                            <div>
                              <Label htmlFor="account_number">Account Number</Label>
                              <Input id="account_number" name="account_number" defaultValue={editingCustomer?.account_number || ''} />
                            </div>
                            <div>
                              <Label htmlFor="account_type">Account Type</Label>
                              <Select name="account_type" defaultValue={editingCustomer?.account_type || ''}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select account type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="savings">Savings</SelectItem>
                                  <SelectItem value="current">Current</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="ifsc_code">IFSC Code (India)</Label>
                              <Input id="ifsc_code" name="ifsc_code" defaultValue={editingCustomer?.ifsc_code || ''} />
                            </div>
                            <div>
                              <Label htmlFor="swift_code">SWIFT Code (International)</Label>
                              <Input id="swift_code" name="swift_code" defaultValue={editingCustomer?.swift_code || ''} />
                            </div>
                            <div className="md:col-span-2">
                              <Label htmlFor="upi_id">UPI ID (optional)</Label>
                              <Input id="upi_id" name="upi_id" placeholder="example@upi" defaultValue={editingCustomer?.upi_id || ''} />
                            </div>
                          </div>
                        </div>

                        <div className="pt-4">
                          <Button type="submit" className="w-full">
                            {editingCustomer ? 'Update Customer' : 'Create Customer'}
                          </Button>
                        </div>
                      </form>
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
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

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleSort('name')}
                          className="h-auto p-0 font-semibold"
                        >
                          Name
                          {sortField === 'name' && (
                            sortDirection === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                          )}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleSort('customer_ref')}
                          className="h-auto p-0 font-semibold"
                        >
                          Reference No.
                          {sortField === 'customer_ref' && (
                            sortDirection === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                          )}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleSort('gstin')}
                          className="h-auto p-0 font-semibold"
                        >
                          GSTIN
                          {sortField === 'gstin' && (
                            sortDirection === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                          )}
                        </Button>
                      </TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Credit Limit</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedCustomers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell>{customer.customer_ref || 'N/A'}</TableCell>
                        <TableCell>{customer.gstin || 'N/A'}</TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{customer.email || 'No email'}</p>
                            <p className="text-xs text-muted-foreground">{customer.phone || 'No phone'}</p>
                          </div>
                        </TableCell>
                        <TableCell>₹{customer.credit_limit.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={customer.is_active ? 'default' : 'secondary'}>
                            {customer.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingCustomer(customer);
                                setShowAddCustomerDialog(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteCustomer(customer.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Customer Pagination */}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredCustomers.length)} of {filteredCustomers.length} customers
                  </p>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
