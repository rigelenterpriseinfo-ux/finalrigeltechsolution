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
import { Plus, Search, ShoppingCart, Truck } from 'lucide-react';

interface PurchaseOrder {
  id: string;
  po_number: string;
  status: string;
  order_date: string;
  expected_date: string | null;
  total_amount: number;
  notes: string | null;
  supplier: {
    name: string;
    email: string | null;
  };
}

interface Supplier {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  contact_person: string | null;
  vendor_registered_address: string | null;
  gst_number: string | null;
  pan_number: string | null;
  pin_code: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  bank_name: string | null;
  bank_address: string | null;
  ifsc_code: string | null;
  account_number: string | null;
  account_type: string | null;
  is_active: boolean;
}

export function PurchaseModule() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddPODialog, setShowAddPODialog] = useState(false);
  const [showAddSupplierDialog, setShowAddSupplierDialog] = useState(false);

  useEffect(() => {
    fetchPurchaseOrders();
    fetchSuppliers();
  }, []);

  const fetchPurchaseOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          supplier:suppliers(name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching purchase orders:', error);
        return;
      }

      setPurchaseOrders(data || []);
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching suppliers:', error);
        return;
      }

      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const generatePONumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    return `PO-${timestamp}`;
  };

  const handleAddPurchaseOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    const poData = {
      po_number: generatePONumber(),
      supplier_id: formData.get('supplier_id') as string,
      order_date: formData.get('order_date') as string,
      expected_date: formData.get('expected_date') as string || null,
      notes: formData.get('notes') as string || null,
      company_id: profile?.company_id,
      created_by: profile?.id,
      status: 'draft',
      total_amount: 0,
    };

    try {
      const { error } = await supabase
        .from('purchase_orders')
        .insert([poData]);

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
        description: "Purchase order created successfully",
      });

      setShowAddPODialog(false);
      fetchPurchaseOrders();
      e.currentTarget.reset();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to create purchase order",
        variant: "destructive",
      });
    }
  };

  const handleAddSupplier = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    const supplierData = {
      name: formData.get('name') as string,
      email: formData.get('email') as string || null,
      phone: formData.get('phone') as string || null,
      contact_person: formData.get('contact_person') as string || null,
      address: formData.get('address') as string || null,
      vendor_registered_address: formData.get('vendor_registered_address') as string || null,
      gst_number: formData.get('gst_number') as string || null,
      pan_number: formData.get('pan_number') as string || null,
      pin_code: formData.get('pin_code') as string || null,
      city: formData.get('city') as string || null,
      state: formData.get('state') as string || null,
      country: formData.get('country') as string || null,
      bank_name: formData.get('bank_name') as string || null,
      bank_address: formData.get('bank_address') as string || null,
      ifsc_code: formData.get('ifsc_code') as string || null,
      account_number: formData.get('account_number') as string || null,
      account_type: formData.get('account_type') as string || null,
      company_id: profile?.company_id,
    };

    try {
      const { error } = await supabase
        .from('suppliers')
        .insert([supplierData]);

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
        description: "Supplier added successfully",
      });

      setShowAddSupplierDialog(false);
      fetchSuppliers();
      e.currentTarget.reset();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to add supplier",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'secondary';
      case 'sent': return 'default';
      case 'confirmed': return 'default';
      case 'received': return 'default';
      case 'cancelled': return 'destructive';
      default: return 'secondary';
    }
  };

  const filteredPOs = purchaseOrders.filter(po =>
    po.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    po.supplier.name.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className="text-3xl font-bold">Purchase Management</h1>
          <p className="text-muted-foreground">Manage purchase orders and suppliers</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showAddSupplierDialog} onOpenChange={setShowAddSupplierDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">Add Supplier</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Supplier</DialogTitle>
                <DialogDescription>Complete supplier information including contact details, tax info, and banking details</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddSupplier} className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium border-b pb-2">Basic Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="sup-name">Vendor Name *</Label>
                      <Input 
                        id="sup-name" 
                        name="name" 
                        required 
                        placeholder="Enter vendor/supplier name"
                        minLength={2}
                        maxLength={100}
                      />
                    </div>
                    <div>
                      <Label htmlFor="sup-contact">Contact Person *</Label>
                      <Input 
                        id="sup-contact" 
                        name="contact_person" 
                        required
                        placeholder="Primary contact person"
                        minLength={2}
                        maxLength={50}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="sup-email">Email ID *</Label>
                      <Input 
                        id="sup-email" 
                        name="email" 
                        type="email" 
                        required
                        placeholder="contact@vendor.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="sup-phone">Phone Number *</Label>
                      <Input 
                        id="sup-phone" 
                        name="phone" 
                        required
                        placeholder="+91 XXXXX XXXXX"
                        pattern="[\+\d\s\-\(\)]+"
                        title="Enter a valid phone number"
                      />
                    </div>
                  </div>
                </div>

                {/* Address Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium border-b pb-2">Address Information</h3>
                  <div>
                    <Label htmlFor="sup-registered-address">Vendor Registered Address *</Label>
                    <Textarea 
                      id="sup-registered-address" 
                      name="vendor_registered_address" 
                      required
                      placeholder="Complete registered address"
                      maxLength={500}
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="sup-city">City *</Label>
                      <Input 
                        id="sup-city" 
                        name="city" 
                        required
                        placeholder="City name"
                        minLength={2}
                        maxLength={50}
                      />
                    </div>
                    <div>
                      <Label htmlFor="sup-state">State *</Label>
                      <Input 
                        id="sup-state" 
                        name="state" 
                        required
                        placeholder="State name"
                        minLength={2}
                        maxLength={50}
                      />
                    </div>
                    <div>
                      <Label htmlFor="sup-country">Country *</Label>
                      <Input 
                        id="sup-country" 
                        name="country" 
                        required
                        placeholder="Country name"
                        defaultValue="India"
                        minLength={2}
                        maxLength={50}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="sup-pin-code">PIN Code *</Label>
                      <Input 
                        id="sup-pin-code" 
                        name="pin_code" 
                        required
                        placeholder="6-digit PIN code"
                        pattern="[0-9]{6}"
                        title="Enter a valid 6-digit PIN code"
                        maxLength={6}
                        onInput={(e) => {
                          const target = e.target as HTMLInputElement;
                          target.value = target.value.replace(/[^0-9]/g, '');
                        }}
                      />
                    </div>
                    <div>
                      <Label htmlFor="sup-address">Additional Address</Label>
                      <Input 
                        id="sup-address" 
                        name="address" 
                        placeholder="Additional address info (optional)"
                        maxLength={200}
                      />
                    </div>
                  </div>
                </div>

                {/* Tax Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium border-b pb-2">Tax Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="sup-gst">GST Number</Label>
                      <Input 
                        id="sup-gst" 
                        name="gst_number" 
                        placeholder="15-digit GST number"
                        pattern="[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}"
                        title="Enter a valid GST number (15 characters)"
                        maxLength={15}
                        onInput={(e) => {
                          const target = e.target as HTMLInputElement;
                          target.value = target.value.toUpperCase();
                        }}
                      />
                    </div>
                    <div>
                      <Label htmlFor="sup-pan">PAN Number</Label>
                      <Input 
                        id="sup-pan" 
                        name="pan_number" 
                        placeholder="10-digit PAN number"
                        pattern="[A-Z]{5}[0-9]{4}[A-Z]{1}"
                        title="Enter a valid PAN number"
                        maxLength={10}
                        onInput={(e) => {
                          const target = e.target as HTMLInputElement;
                          target.value = target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Banking Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium border-b pb-2">Payment Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="sup-bank-name">Bank Name</Label>
                      <Input 
                        id="sup-bank-name" 
                        name="bank_name" 
                        placeholder="Bank name"
                        maxLength={100}
                      />
                    </div>
                    <div>
                      <Label htmlFor="sup-account-type">Account Type</Label>
                      <Select name="account_type">
                        <SelectTrigger>
                          <SelectValue placeholder="Select account type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="saving">Saving</SelectItem>
                          <SelectItem value="current">Current</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="sup-bank-address">Bank Address</Label>
                    <Textarea 
                      id="sup-bank-address" 
                      name="bank_address" 
                      placeholder="Bank branch address"
                      maxLength={300}
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="sup-ifsc">IFSC Code</Label>
                      <Input 
                        id="sup-ifsc" 
                        name="ifsc_code" 
                        placeholder="11-character IFSC code"
                        pattern="[A-Z]{4}0[A-Z0-9]{6}"
                        title="Enter a valid IFSC code"
                        maxLength={11}
                        onInput={(e) => {
                          const target = e.target as HTMLInputElement;
                          target.value = target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                        }}
                      />
                    </div>
                    <div>
                      <Label htmlFor="sup-account-no">Account Number</Label>
                      <Input 
                        id="sup-account-no" 
                        name="account_number" 
                        placeholder="Bank account number"
                        pattern="[0-9]+"
                        title="Enter a valid account number (numbers only)"
                        maxLength={20}
                        onInput={(e) => {
                          const target = e.target as HTMLInputElement;
                          target.value = target.value.replace(/[^0-9]/g, '');
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Validation Guidelines */}
                <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
                  <p className="font-medium mb-2">Validation Guidelines:</p>
                  <ul className="space-y-1 text-xs grid grid-cols-2 gap-2">
                    <li>• GST: 15 characters (format: NNAAAANNNNANN)</li>
                    <li>• PAN: 10 characters (format: AAAAANNNNNA)</li>
                    <li>• PIN Code: 6-digit number only</li>
                    <li>• IFSC: 11 characters (format: AAAA0NNNNNN)</li>
                    <li>• Phone: Include country code if international</li>
                    <li>• Account Number: Numbers only</li>
                  </ul>
                </div>

                <Button type="submit" className="w-full">Add Supplier</Button>
              </form>
            </DialogContent>
          </Dialog>
          
          <Dialog open={showAddPODialog} onOpenChange={setShowAddPODialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Purchase Order
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Purchase Order</DialogTitle>
                <DialogDescription>Create a new purchase order</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddPurchaseOrder} className="space-y-4">
                <div>
                  <Label htmlFor="supplier_id">Supplier</Label>
                  <Select name="supplier_id" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
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
                    <Label htmlFor="expected_date">Expected Date</Label>
                    <Input id="expected_date" name="expected_date" type="date" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" name="notes" />
                </div>
                <Button type="submit" className="w-full">Create Purchase Order</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total POs</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{purchaseOrders.length}</div>
            <p className="text-xs text-muted-foreground">All purchase orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending POs</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {purchaseOrders.filter(po => ['draft', 'sent', 'confirmed'].includes(po.status)).length}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting completion</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Suppliers</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{suppliers.length}</div>
            <p className="text-xs text-muted-foreground">Registered suppliers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${purchaseOrders.reduce((sum, po) => sum + po.total_amount, 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">All purchase orders</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search purchase orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Purchase Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase Orders</CardTitle>
          <CardDescription>Manage your purchase orders</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead>Expected Date</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPOs.map((po) => (
                <TableRow key={po.id}>
                  <TableCell className="font-medium">{po.po_number}</TableCell>
                  <TableCell>{po.supplier.name}</TableCell>
                  <TableCell>{new Date(po.order_date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {po.expected_date ? new Date(po.expected_date).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell>${po.total_amount.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(po.status)}>
                      {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filteredPOs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No purchase orders found
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