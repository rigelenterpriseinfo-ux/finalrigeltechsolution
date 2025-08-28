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

interface SalesOrder {
  id: string;
  order_number: string;
  status: string;
  order_date: string;
  delivery_date: string | null;
  total_amount: number;
  discount_amount: number;
  tax_amount: number;
  notes: string | null;
  customer: {
    name: string;
    email: string | null;
  };
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
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pin_code?: string | null;
  website?: string | null;
  payment_terms?: string | null;
  preferred_currency?: string;
  same_as_registered_address?: boolean;
}

export function SalesModule() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [showAddSODialog, setShowAddSODialog] = useState(false);
  const [showAddCustomerDialog, setShowAddCustomerDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [sameAsRegistered, setSameAsRegistered] = useState(false);
  const [sortField, setSortField] = useState<'name' | 'customer_ref' | 'gstin'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    fetchSalesOrders();
    fetchCustomers();
  }, []);

  const fetchSalesOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          *,
          customer:customers(name, email)
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

  const generateSONumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    return `SO-${timestamp}`;
  };

  const handleAddSalesOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    const soData = {
      order_number: generateSONumber(),
      customer_id: formData.get('customer_id') as string,
      order_date: formData.get('order_date') as string,
      delivery_date: formData.get('delivery_date') as string || null,
      discount_amount: parseFloat(formData.get('discount_amount') as string) || 0,
      tax_amount: parseFloat(formData.get('tax_amount') as string) || 0,
      notes: formData.get('notes') as string || null,
      company_id: profile?.company_id,
      created_by: profile?.id,
      status: 'draft',
      total_amount: 0,
    };

    try {
      const { error } = await supabase
        .from('sales_orders')
        .insert([soData]);

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Sales order created successfully",
      });

      setShowAddSODialog(false);
      fetchSalesOrders();
      e.currentTarget.reset();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to create sales order",
        variant: "destructive",
      });
    }
  };

  const handleAddCustomer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!profile?.company_id) {
      toast({
        title: "Error",
        description: "Company information not found. Please refresh the page and try again.",
        variant: "destructive",
      });
      return;
    }
    
    const formData = new FormData(e.currentTarget);
    const customerData = buildCustomerData(formData, profile.company_id);

    try {
      const { data, error } = editingCustomer 
        ? await supabase
            .from('customers')
            .update(customerData)
            .eq('id', editingCustomer.id)
            .select()
        : await supabase
            .from('customers')
            .insert([customerData])
            .select();

      if (error) {
        console.error('Customer operation error:', error);
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: editingCustomer ? "Customer updated successfully" : "Customer added successfully",
      });

      setShowAddCustomerDialog(false);
      setEditingCustomer(null);
      setSameAsRegistered(false);
      await fetchCustomers();
      
      try {
        e.currentTarget.reset();
      } catch (formResetError) {
        console.warn('Form reset error:', formResetError);
      }
    } catch (error: any) {
      console.error('Unexpected error in handleAddCustomer:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save customer",
        variant: "destructive",
      });
    }
  };

  const buildCustomerData = (formData: FormData, companyId: string) => {
    return {
      name: formData.get('name') as string,
      customer_type: formData.get('customer_type') as string,
      contact_person: formData.get('contact_person') as string || null,
      // Registered Address
      address_line1: formData.get('address_line1') as string || null,
      address_line2: formData.get('address_line2') as string || null,
      city: formData.get('city') as string || null,
      state: formData.get('state') as string || null,
      pin_code: formData.get('pin_code') as string || null,
      country: formData.get('country') as string || null,
      // Communication Details
      email: formData.get('email') as string || null,
      alternate_email: formData.get('alternate_email') as string || null,
      phone: formData.get('phone') as string || null,
      landline_number: formData.get('landline_number') as string || null,
      website: formData.get('website') as string || null,
      // Tax & Legal Information
      gstin: formData.get('gstin') as string || null,
      pan_number: formData.get('pan_number') as string || null,
      msme_registration_no: formData.get('msme_registration_no') as string || null,
      business_registration_no: formData.get('business_registration_no') as string || null,
      // Shipping Address
      same_as_registered_address: sameAsRegistered,
      shipping_address_line1: sameAsRegistered ? null : (formData.get('shipping_address_line1') as string || null),
      shipping_address_line2: sameAsRegistered ? null : (formData.get('shipping_address_line2') as string || null),
      shipping_city: sameAsRegistered ? null : (formData.get('shipping_city') as string || null),
      shipping_state: sameAsRegistered ? null : (formData.get('shipping_state') as string || null),
      shipping_pin_code: sameAsRegistered ? null : (formData.get('shipping_pin_code') as string || null),
      shipping_country: sameAsRegistered ? null : (formData.get('shipping_country') as string || null),
      // Payment Terms & Credit Control
      payment_terms: formData.get('payment_terms') as string || null,
      credit_limit: parseFloat(formData.get('credit_limit') as string) || 0,
      preferred_currency: formData.get('preferred_currency') as string || 'INR',
      billing_cycle: formData.get('billing_cycle') as string || null,
      // Bank & Payment Details
      bank_name: formData.get('bank_name') as string || null,
      branch_name: formData.get('branch_name') as string || null,
      account_number: formData.get('account_number') as string || null,
      account_type: formData.get('account_type') as string || null,
      ifsc_code: formData.get('ifsc_code') as string || null,
      swift_code: formData.get('swift_code') as string || null,
      upi_id: formData.get('upi_id') as string || null,
      company_id: companyId,
    };
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setSameAsRegistered(customer.same_as_registered_address || false);
    setShowAddCustomerDialog(true);
  };

  const handleDeleteCustomer = async (customerId: string) => {
    if (!confirm('Are you sure you want to delete this customer?')) return;

    try {
      const { error } = await supabase
        .from('customers')
        .update({ is_active: false })
        .eq('id', customerId);

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Customer deleted successfully",
      });

      await fetchCustomers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete customer",
        variant: "destructive",
      });
    }
  };

  const handleSort = (field: 'name' | 'customer_ref' | 'gstin') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'secondary';
      case 'confirmed': return 'default';
      case 'shipped': return 'default';
      case 'delivered': return 'default';
      case 'cancelled': return 'destructive';
      default: return 'secondary';
    }
  };

  const filteredSOs = salesOrders.filter(so =>
    so.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    so.customer.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    (customer.gstin && customer.gstin.toLowerCase().includes(customerSearchTerm.toLowerCase())) ||
    (customer.customer_ref && customer.customer_ref.toLowerCase().includes(customerSearchTerm.toLowerCase()))
  );

  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    const aValue = a[sortField] || '';
    const bValue = b[sortField] || '';
    const comparison = aValue.toString().localeCompare(bValue.toString());
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const totalPages = Math.ceil(sortedCustomers.length / itemsPerPage);
  const paginatedCustomers = sortedCustomers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Sales Management</h1>
          <p className="text-muted-foreground">Manage sales orders and customers</p>
        </div>
      </div>

      <Tabs defaultValue="orders" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="orders">Sales Orders</TabsTrigger>
          <TabsTrigger value="customers">Customer Management</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Dialog open={showAddSODialog} onOpenChange={setShowAddSODialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Sales Order
                </Button>
              </DialogTrigger>
              {/* Add Sales Order Dialog content would go here */}
            </Dialog>
          </div>

          {/* Sales Orders Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Sales Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order Number</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSOs.map((so) => (
                    <TableRow key={so.id}>
                      <TableCell className="font-medium">{so.order_number}</TableCell>
                      <TableCell>{so.customer.name}</TableCell>
                      <TableCell>{new Date(so.order_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(so.status)}>{so.status}</Badge>
                      </TableCell>
                      <TableCell>₹{so.total_amount.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, GSTIN, or reference..."
                  value={customerSearchTerm}
                  onChange={(e) => setCustomerSearchTerm(e.target.value)}
                  className="pl-8 w-80"
                />
              </div>
            </div>
            <Dialog open={showAddCustomerDialog} onOpenChange={(open) => {
              setShowAddCustomerDialog(open);
              if (!open) {
                setEditingCustomer(null);
                setSameAsRegistered(false);
              }
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Customer
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
                <DialogDescription>{editingCustomer ? 'Update customer information' : 'Add a comprehensive customer profile to your database'}</DialogDescription>
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
                        <Input id="address_line1" name="address_line1" />
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="address_line2">Address Line 2 (optional)</Label>
                        <Input id="address_line2" name="address_line2" />
                      </div>
                      <div>
                        <Label htmlFor="city">City</Label>
                        <Input id="city" name="city" />
                      </div>
                      <div>
                        <Label htmlFor="state">State</Label>
                        <Input id="state" name="state" />
                      </div>
                      <div>
                        <Label htmlFor="pin_code">PIN / ZIP Code</Label>
                        <Input id="pin_code" name="pin_code" />
                      </div>
                      <div>
                        <Label htmlFor="country">Country</Label>
                        <Input id="country" name="country" defaultValue="India" />
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
                        <Input id="email" name="email" type="email" />
                      </div>
                      <div>
                        <Label htmlFor="alternate_email">Alternate Email ID (optional)</Label>
                        <Input id="alternate_email" name="alternate_email" type="email" />
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone Number (mobile)</Label>
                        <Input id="phone" name="phone" />
                      </div>
                      <div>
                        <Label htmlFor="landline_number">Landline Number (optional)</Label>
                        <Input id="landline_number" name="landline_number" />
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="website">Website (if business customer)</Label>
                        <Input id="website" name="website" placeholder="https://example.com" />
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
                        <Input id="gstin" name="gstin" />
                      </div>
                      <div>
                        <Label htmlFor="pan_number">PAN (India) / Tax ID (International)</Label>
                        <Input id="pan_number" name="pan_number" />
                      </div>
                      <div>
                        <Label htmlFor="msme_registration_no">MSME Registration No. (optional)</Label>
                        <Input id="msme_registration_no" name="msme_registration_no" />
                      </div>
                      <div>
                        <Label htmlFor="business_registration_no">Business Registration No. (optional)</Label>
                        <Input id="business_registration_no" name="business_registration_no" />
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
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="shipping_address_line2">Shipping Address Line 2 (optional)</Label>
                        <Input 
                          id="shipping_address_line2" 
                          name="shipping_address_line2" 
                          disabled={sameAsRegistered}
                          className={sameAsRegistered ? 'bg-muted' : ''}
                        />
                      </div>
                      <div>
                        <Label htmlFor="shipping_city">Shipping City</Label>
                        <Input 
                          id="shipping_city" 
                          name="shipping_city" 
                          disabled={sameAsRegistered}
                          className={sameAsRegistered ? 'bg-muted' : ''}
                        />
                      </div>
                      <div>
                        <Label htmlFor="shipping_state">Shipping State</Label>
                        <Input 
                          id="shipping_state" 
                          name="shipping_state" 
                          disabled={sameAsRegistered}
                          className={sameAsRegistered ? 'bg-muted' : ''}
                        />
                      </div>
                      <div>
                        <Label htmlFor="shipping_pin_code">Shipping PIN / ZIP Code</Label>
                        <Input 
                          id="shipping_pin_code" 
                          name="shipping_pin_code" 
                          disabled={sameAsRegistered}
                          className={sameAsRegistered ? 'bg-muted' : ''}
                        />
                      </div>
                      <div>
                        <Label htmlFor="shipping_country">Shipping Country</Label>
                        <Input 
                          id="shipping_country" 
                          name="shipping_country" 
                          defaultValue="India" 
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
                        <Select name="payment_terms">
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
                        <Input id="credit_limit" name="credit_limit" type="number" step="0.01" placeholder="0.00" />
                      </div>
                      <div>
                        <Label htmlFor="preferred_currency">Preferred Currency</Label>
                        <Select name="preferred_currency" defaultValue="INR">
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
                        <Select name="billing_cycle">
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
                        <Input id="bank_name" name="bank_name" />
                      </div>
                      <div>
                        <Label htmlFor="branch_name">Branch Name</Label>
                        <Input id="branch_name" name="branch_name" />
                      </div>
                      <div>
                        <Label htmlFor="account_number">Account Number</Label>
                        <Input id="account_number" name="account_number" />
                      </div>
                      <div>
                        <Label htmlFor="account_type">Account Type</Label>
                        <Select name="account_type">
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
                        <Input id="ifsc_code" name="ifsc_code" />
                      </div>
                      <div>
                        <Label htmlFor="swift_code">SWIFT Code (International)</Label>
                        <Input id="swift_code" name="swift_code" />
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="upi_id">UPI ID (optional)</Label>
                        <Input id="upi_id" name="upi_id" placeholder="example@upi" />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4">
                    <Button type="submit" className="w-full">
                      {editingCustomer ? 'Update Customer' : 'Add Customer'}
                    </Button>
                  </div>
                </form>
              </ScrollArea>
              </DialogContent>
            </Dialog>
          </div>

          {/* Customer List with Search, Sort, and Pagination */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Customer Management
              </CardTitle>
              <CardDescription>Manage your customer database</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer" onClick={() => handleSort('customer_ref')}>
                      <div className="flex items-center gap-1">
                        Reference No.
                        {sortField === 'customer_ref' && (
                          sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort('name')}>
                      <div className="flex items-center gap-1">
                        Name
                        {sortField === 'name' && (
                          sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort('gstin')}>
                      <div className="flex items-center gap-1">
                        GSTIN
                        {sortField === 'gstin' && (
                          sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Credit Limit</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">
                        {customer.customer_ref || 'N/A'}
                      </TableCell>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {customer.customer_type || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm">{customer.email || 'No email'}</p>
                          <p className="text-xs text-muted-foreground">{customer.phone || 'No phone'}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{customer.gstin || 'N/A'}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{customer.city || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">{customer.state || 'N/A'}</p>
                        </div>
                      </TableCell>
                      <TableCell>₹{customer.credit_limit.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditCustomer(customer)}
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
                  {paginatedCustomers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No customers found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-2 py-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sortedCustomers.length)} of {sortedCustomers.length} customers
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className="w-8 h-8 p-0"
                        >
                          {page}
                        </Button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}