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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, FileText, Users } from 'lucide-react';

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
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  contact_person: string | null;
  credit_limit: number;
  is_active: boolean;
}

export function SalesModule() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddSODialog, setShowAddSODialog] = useState(false);
  const [showAddCustomerDialog, setShowAddCustomerDialog] = useState(false);

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
    
    const formData = new FormData(e.currentTarget);
    const customerData = {
      name: formData.get('name') as string,
      email: formData.get('email') as string || null,
      phone: formData.get('phone') as string || null,
      address: formData.get('address') as string || null,
      contact_person: formData.get('contact_person') as string || null,
      credit_limit: parseFloat(formData.get('credit_limit') as string) || 0,
      company_id: profile?.company_id,
    };

    try {
      const { error } = await supabase
        .from('customers')
        .insert([customerData]);

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
        description: "Customer added successfully",
      });

      setShowAddCustomerDialog(false);
      fetchCustomers();
      e.currentTarget.reset();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to add customer",
        variant: "destructive",
      });
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
        <div className="flex gap-2">
          <Dialog open={showAddCustomerDialog} onOpenChange={setShowAddCustomerDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">Add Customer</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Customer</DialogTitle>
                <DialogDescription>Add a new customer to your database</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddCustomer} className="space-y-4">
                <div>
                  <Label htmlFor="cust-name">Customer Name</Label>
                  <Input id="cust-name" name="name" required />
                </div>
                <div>
                  <Label htmlFor="cust-email">Email</Label>
                  <Input id="cust-email" name="email" type="email" />
                </div>
                <div>
                  <Label htmlFor="cust-phone">Phone</Label>
                  <Input id="cust-phone" name="phone" />
                </div>
                <div>
                  <Label htmlFor="cust-contact">Contact Person</Label>
                  <Input id="cust-contact" name="contact_person" />
                </div>
                <div>
                  <Label htmlFor="cust-credit">Credit Limit</Label>
                  <Input id="cust-credit" name="credit_limit" type="number" step="0.01" />
                </div>
                <div>
                  <Label htmlFor="cust-address">Address</Label>
                  <Textarea id="cust-address" name="address" />
                </div>
                <Button type="submit" className="w-full">Add Customer</Button>
              </form>
            </DialogContent>
          </Dialog>
          
          <Dialog open={showAddSODialog} onOpenChange={setShowAddSODialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Sales Order
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Sales Order</DialogTitle>
                <DialogDescription>Create a new sales order</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddSalesOrder} className="space-y-4">
                <div>
                  <Label htmlFor="customer_id">Customer</Label>
                  <Select name="customer_id" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="order_date">Order Date</Label>
                    <Input 
                      id="order_date" 
                      name="order_date" 
                      type="date" 
                      defaultValue={new Date().toISOString().split('T')[0]}
                      required 
                    />
                  </div>
                  <div>
                    <Label htmlFor="delivery_date">Delivery Date</Label>
                    <Input id="delivery_date" name="delivery_date" type="date" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="discount_amount">Discount Amount</Label>
                    <Input id="discount_amount" name="discount_amount" type="number" step="0.01" defaultValue="0" />
                  </div>
                  <div>
                    <Label htmlFor="tax_amount">Tax Amount</Label>
                    <Input id="tax_amount" name="tax_amount" type="number" step="0.01" defaultValue="0" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" name="notes" />
                </div>
                <Button type="submit" className="w-full">Create Sales Order</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total SOs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salesOrders.length}</div>
            <p className="text-xs text-muted-foreground">All sales orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending SOs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {salesOrders.filter(so => ['draft', 'confirmed', 'shipped'].includes(so.status)).length}
            </div>
            <p className="text-xs text-muted-foreground">Not yet delivered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers.length}</div>
            <p className="text-xs text-muted-foreground">Registered customers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${salesOrders.reduce((sum, so) => sum + so.total_amount, 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">All sales orders</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search sales orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Sales Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Orders</CardTitle>
          <CardDescription>Manage your sales orders</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead>Delivery Date</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSOs.map((so) => (
                <TableRow key={so.id}>
                  <TableCell className="font-medium">{so.order_number}</TableCell>
                  <TableCell>{so.customer.name}</TableCell>
                  <TableCell>{new Date(so.order_date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {so.delivery_date ? new Date(so.delivery_date).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell>${so.total_amount.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(so.status)}>
                      {so.status.charAt(0).toUpperCase() + so.status.slice(1)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filteredSOs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No sales orders found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}