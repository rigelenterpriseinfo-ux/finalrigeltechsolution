import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, Truck, ShoppingCart, FileText, Building2, Package, TrendingUp } from 'lucide-react';
import { EnhancedPurchaseInvoiceForm } from '@/components/forms/EnhancedPurchaseInvoiceForm';
import { PurchaseInvoiceTable } from '@/components/tables/PurchaseInvoiceTable';

interface Supplier {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  contact_person: string | null;
  gst_number: string | null;
  is_active: boolean;
  created_at: string;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  status: string;
  order_date: string;
  total_amount: number;
  supplier: {
    name: string;
  };
}

export function PurchaseModule() {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  // State management
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [showAddSupplierDialog, setShowAddSupplierDialog] = useState(false);
  const [showAddPODialog, setShowAddPODialog] = useState(false);
  const [showAddPIDialog, setShowAddPIDialog] = useState(false);
  const [showEditPIDialog, setShowEditPIDialog] = useState(false);
  const [showViewPIDialog, setShowViewPIDialog] = useState(false);
  const [selectedPI, setSelectedPI] = useState<any>(null);

  // Fetch data
  useEffect(() => {
    if (profile?.company_id) {
      fetchSuppliers();
      fetchPurchaseOrders();
      fetchPurchaseInvoicesData();
    }
  }, [profile?.company_id]);

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
      toast({
        title: "Error",
        description: "Failed to fetch suppliers",
        variant: "destructive",
      });
    }
  };

  const fetchPurchaseOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          supplier:suppliers(name)
        `)
        .eq('company_id', profile?.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPurchaseOrders(data || []);
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
    }
  };

  const fetchPurchaseInvoicesData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('purchase_invoices')
        .select(`
          *,
          purchase_invoice_items(*),
          supplier:suppliers(name)
        `)
        .eq('company_id', profile?.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPurchaseInvoices(data || []);
    } catch (error) {
      console.error('Error fetching purchase invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  // Supplier Management Functions
  const handleAddSupplier = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      const supplierData = {
        company_id: profile?.company_id,
        name: formData.get('name') as string,
        email: formData.get('email') as string,
        phone: formData.get('phone') as string,
        contact_person: formData.get('contact_person') as string,
        address_line1: formData.get('address_line1') as string,
        address_line2: formData.get('address_line2') as string,
        city: formData.get('city') as string,
        state: formData.get('state') as string,
        country: formData.get('country') as string,
        pin_code: formData.get('pin_code') as string,
        place_of_supply: formData.get('place_of_supply') as string,
        gst_number: formData.get('gst_number') as string,
        pan_number: formData.get('pan_number') as string,
        is_active: true,
      };

      const { error } = await supabase
        .from('suppliers')
        .insert([supplierData]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Supplier added successfully",
      });

      setShowAddSupplierDialog(false);
      fetchSuppliers();
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      console.error('Error adding supplier:', error);
      toast({
        title: "Error",
        description: "Failed to add supplier",
        variant: "destructive",
      });
    }
  };

  // Purchase Invoice CRUD Functions
  const handleAddPurchaseInvoice = async (invoiceData: any) => {
    try {
      const { data: invoice, error: piError } = await supabase
        .from('purchase_invoices')
        .insert([{
          company_id: profile?.company_id,
          supplier_id: invoiceData.supplier_id,
          purchase_invoice_number: invoiceData.invoice_no || `PI-${Date.now()}`,
          purchase_invoice_date: invoiceData.purchase_invoice_date,
          purchase_order_id: invoiceData.purchase_order_id,
          status: invoiceData.status || 'received',
          subtotal_amount: invoiceData.subtotal_amount || 0,
          total_discount_amount: invoiceData.total_discount_amount || 0,
          total_tax_amount: invoiceData.total_tax_amount || 0,
          total_amount: invoiceData.total_amount || 0,
          place_of_supply: invoiceData.place_of_supply,
          notes: invoiceData.notes,
          invoice_no: invoiceData.invoice_no,
          payment_due_date: invoiceData.payment_due_date,
          created_by: profile?.user_id,
        }])
        .select()
        .single();

      if (piError) throw piError;

      // Insert invoice items
      if (invoiceData.items && invoiceData.items.length > 0) {
        const itemsToInsert = invoiceData.items.map((item: any) => ({
          purchase_invoice_id: invoice.id,
          item_description: item.item_description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          product_id: item.product_id,
          item_code: item.item_code,
          hsn_sac_code: item.hsn_sac_code,
          unit_of_measure: item.unit_of_measure || 'pcs',
          discount_percentage: item.discount_percentage || 0,
          discount_amount: item.discount_amount || 0,
          taxable_value: item.taxable_value || 0,
          cgst_rate: item.cgst_rate || 0,
          sgst_rate: item.sgst_rate || 0,
          igst_rate: item.igst_rate || 0,
          cgst_amount: item.cgst_amount || 0,
          sgst_amount: item.sgst_amount || 0,
          igst_amount: item.igst_amount || 0,
          is_taxable: item.is_taxable !== false,
          remarks: item.remarks,
        }));

        const { error: itemsError } = await supabase
          .from('purchase_invoice_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      toast({
        title: "Success",
        description: "Purchase invoice created successfully",
      });

      setShowAddPIDialog(false);
      fetchPurchaseInvoicesData();
    } catch (error) {
      console.error('Error creating purchase invoice:', error);
      toast({
        title: "Error",
        description: "Failed to create purchase invoice",
        variant: "destructive",
      });
    }
  };

  function handleUpdatePurchaseInvoice(invoiceData: any) {
    if (!selectedPI) return;
    
    const updateInvoice = async () => {
      try {
        const { error: piError } = await supabase
          .from('purchase_invoices')
          .update({
            supplier_id: invoiceData.supplier_id,
            purchase_invoice_date: invoiceData.purchase_invoice_date,
            purchase_order_id: invoiceData.purchase_order_id,
            status: invoiceData.status || 'received',
            subtotal_amount: invoiceData.subtotal_amount || 0,
            total_discount_amount: invoiceData.total_discount_amount || 0,
            total_tax_amount: invoiceData.total_tax_amount || 0,
            total_amount: invoiceData.total_amount || 0,
            place_of_supply: invoiceData.place_of_supply,
            notes: invoiceData.notes,
            invoice_no: invoiceData.invoice_no,
            payment_due_date: invoiceData.payment_due_date,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedPI.id);

        if (piError) throw piError;

        // Update invoice items
        if (invoiceData.items && invoiceData.items.length > 0) {
          // Delete existing items
          const { error: deleteError } = await supabase
            .from('purchase_invoice_items')
            .delete()
            .eq('purchase_invoice_id', selectedPI.id);

          if (deleteError) throw deleteError;

          // Insert new items
          const itemsToInsert = invoiceData.items.map((item: any) => ({
            purchase_invoice_id: selectedPI.id,
            item_description: item.item_description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            product_id: item.product_id,
            item_code: item.item_code,
            hsn_sac_code: item.hsn_sac_code,
            unit_of_measure: item.unit_of_measure || 'pcs',
            discount_percentage: item.discount_percentage || 0,
            discount_amount: item.discount_amount || 0,
            taxable_value: item.taxable_value || 0,
            cgst_rate: item.cgst_rate || 0,
            sgst_rate: item.sgst_rate || 0,
            igst_rate: item.igst_rate || 0,
            cgst_amount: item.cgst_amount || 0,
            sgst_amount: item.sgst_amount || 0,
            igst_amount: item.igst_amount || 0,
            is_taxable: item.is_taxable !== false,
            remarks: item.remarks,
          }));

          const { error: itemsError } = await supabase
            .from('purchase_invoice_items')
            .insert(itemsToInsert);

          if (itemsError) throw itemsError;
        }

        toast({
          title: "Success",
          description: "Purchase invoice updated successfully",
        });

        setShowEditPIDialog(false);
        setSelectedPI(null);
        fetchPurchaseInvoicesData();
      } catch (error) {
        console.error('Error updating purchase invoice:', error);
        toast({
          title: "Error",
          description: "Failed to update purchase invoice",
          variant: "destructive",
        });
      }
    };

    updateInvoice();
  }

  function handleViewPI(invoice: any) {
    setSelectedPI(invoice);
    setShowViewPIDialog(true);
  }

  function handleEditPI(invoice: any) {
    setSelectedPI(invoice);
    setShowEditPIDialog(true);
  }

  async function handleDeletePI(invoiceId: string) {
    try {
      // First delete all related items
      const { error: itemsError } = await supabase
        .from('purchase_invoice_items')
        .delete()
        .eq('purchase_invoice_id', invoiceId);

      if (itemsError) throw itemsError;

      // Then delete the invoice
      const { error: invoiceError } = await supabase
        .from('purchase_invoices')
        .delete()
        .eq('id', invoiceId);

      if (invoiceError) throw invoiceError;

      toast({
        title: "Success",
        description: "Purchase invoice deleted successfully",
      });

      fetchPurchaseInvoicesData();
    } catch (error) {
      console.error('Error deleting purchase invoice:', error);
      toast({
        title: "Error",
        description: "Failed to delete purchase invoice",
        variant: "destructive",
      });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Purchase Management
          </h1>
          <p className="text-muted-foreground">Manage suppliers, purchase orders, and invoices efficiently</p>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-blue-700">Suppliers</p>
                <p className="text-xl font-bold text-blue-800">{suppliers.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-green-700">Purchase Orders</p>
                <p className="text-xl font-bold text-green-800">{purchaseOrders.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm text-purple-700">Invoices</p>
                <p className="text-xl font-bold text-purple-800">{purchaseInvoices.length}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Three Main Sections */}
      <Tabs defaultValue="suppliers" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="suppliers" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Supplier Management
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Purchase Orders
          </TabsTrigger>
          <TabsTrigger value="invoices" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Purchase Invoices
          </TabsTrigger>
        </TabsList>

        {/* Section 1: Supplier Management */}
        <TabsContent value="suppliers" className="space-y-6">
          <Card>
            <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-blue-100">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl text-blue-800">Supplier Management</CardTitle>
                  <CardDescription>Add and manage your suppliers</CardDescription>
                </div>
                <Dialog open={showAddSupplierDialog} onOpenChange={setShowAddSupplierDialog}>
                  <DialogTrigger asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Supplier
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-xl text-blue-700">Add New Supplier</DialogTitle>
                      <DialogDescription>Add a new supplier with complete details</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddSupplier} className="space-y-6">
                      {/* Basic Information */}
                      <div className="bg-gradient-to-r from-blue/5 to-blue/10 p-6 rounded-xl border border-blue/20">
                        <h3 className="text-lg font-semibold text-blue-700 mb-4">Basic Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="name">Supplier Name *</Label>
                            <Input id="name" name="name" required className="mt-1" />
                          </div>
                          <div>
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" name="email" type="email" className="mt-1" />
                          </div>
                          <div>
                            <Label htmlFor="phone">Phone</Label>
                            <Input id="phone" name="phone" className="mt-1" />
                          </div>
                          <div>
                            <Label htmlFor="contact_person">Contact Person</Label>
                            <Input id="contact_person" name="contact_person" className="mt-1" />
                          </div>
                        </div>
                      </div>

                      {/* Address Information */}
                      <div className="bg-gradient-to-r from-green/5 to-green/10 p-6 rounded-xl border border-green/20">
                        <h3 className="text-lg font-semibold text-green-700 mb-4">Address Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="address_line1">Address Line 1</Label>
                            <Input id="address_line1" name="address_line1" className="mt-1" />
                          </div>
                          <div>
                            <Label htmlFor="address_line2">Address Line 2</Label>
                            <Input id="address_line2" name="address_line2" className="mt-1" />
                          </div>
                          <div>
                            <Label htmlFor="city">City</Label>
                            <Input id="city" name="city" className="mt-1" />
                          </div>
                          <div>
                            <Label htmlFor="state">State</Label>
                            <Input id="state" name="state" className="mt-1" />
                          </div>
                          <div>
                            <Label htmlFor="country">Country</Label>
                            <Input id="country" name="country" defaultValue="India" className="mt-1" />
                          </div>
                          <div>
                            <Label htmlFor="pin_code">Pin Code</Label>
                            <Input id="pin_code" name="pin_code" className="mt-1" />
                          </div>
                        </div>
                        <div className="mt-4">
                          <Label htmlFor="place_of_supply">Place of Supply</Label>
                          <Input id="place_of_supply" name="place_of_supply" className="mt-1" />
                        </div>
                      </div>

                      {/* Tax Information */}
                      <div className="bg-gradient-to-r from-orange/5 to-orange/10 p-6 rounded-xl border border-orange/20">
                        <h3 className="text-lg font-semibold text-orange-700 mb-4">Tax Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="gst_number">GST Number</Label>
                            <Input id="gst_number" name="gst_number" className="mt-1" />
                          </div>
                          <div>
                            <Label htmlFor="pan_number">PAN Number</Label>
                            <Input id="pan_number" name="pan_number" className="mt-1" />
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-4 pt-6 border-t">
                        <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Supplier
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setShowAddSupplierDialog(false)} 
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-4">
                {suppliers.length === 0 ? (
                  <div className="text-center py-12">
                    <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">No suppliers found</h3>
                    <p className="text-muted-foreground">Add your first supplier to get started</p>
                  </div>
                ) : (
                  suppliers.map((supplier) => (
                    <Card key={supplier.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <h4 className="font-semibold">{supplier.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {supplier.contact_person && `Contact: ${supplier.contact_person}`}
                            </p>
                            <div className="flex gap-4 text-sm text-muted-foreground">
                              {supplier.email && <span>{supplier.email}</span>}
                              {supplier.phone && <span>{supplier.phone}</span>}
                            </div>
                          </div>
                          <Badge variant={supplier.is_active ? "default" : "secondary"}>
                            {supplier.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Section 2: Purchase Orders */}
        <TabsContent value="orders" className="space-y-6">
          <Card>
            <CardHeader className="border-b bg-gradient-to-r from-green-50 to-green-100">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl text-green-800">Purchase Orders</CardTitle>
                  <CardDescription>Create and manage purchase orders</CardDescription>
                </div>
                <Button className="bg-green-600 hover:bg-green-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Purchase Order
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {purchaseOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">No purchase orders found</h3>
                    <p className="text-muted-foreground">Create your first purchase order</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {purchaseOrders.slice(0, 5).map((po) => (
                      <Card key={po.id} className="border-l-4 border-l-green-500">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-center">
                            <div className="space-y-1">
                              <h4 className="font-semibold">{po.po_number}</h4>
                              <p className="text-sm text-muted-foreground">
                                Supplier: {po.supplier.name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Date: {new Date(po.order_date).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <Badge variant="outline">{po.status}</Badge>
                              <p className="text-lg font-bold text-green-600 mt-1">
                                ₹{po.total_amount.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Section 3: Purchase Invoices */}
        <TabsContent value="invoices" className="space-y-6">
          <Card>
            <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-purple-100">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl text-purple-800">Purchase Invoices</CardTitle>
                  <CardDescription>Manage purchase invoice entries</CardDescription>
                </div>
                <Button 
                  className="bg-purple-600 hover:bg-purple-700"
                  onClick={() => setShowAddPIDialog(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Invoice
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <PurchaseInvoiceTable
                invoices={purchaseInvoices}
                onView={handleViewPI}
                onEdit={handleEditPI}
                onDelete={handleDeletePI}
                onCreate={() => setShowAddPIDialog(true)}
                loading={loading}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Purchase Invoice Dialogs */}
      {/* Create Purchase Invoice Dialog */}
      <Dialog open={showAddPIDialog} onOpenChange={setShowAddPIDialog}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
          <EnhancedPurchaseInvoiceForm
            onSubmit={handleAddPurchaseInvoice}
            onCancel={() => setShowAddPIDialog(false)}
            mode="create"
          />
        </DialogContent>
      </Dialog>

      {/* Edit Purchase Invoice Dialog */}
      <Dialog open={showEditPIDialog} onOpenChange={setShowEditPIDialog}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
          <EnhancedPurchaseInvoiceForm
            invoice={selectedPI}
            onSubmit={handleUpdatePurchaseInvoice}
            onCancel={() => {
              setShowEditPIDialog(false);
              setSelectedPI(null);
            }}
            mode="edit"
          />
        </DialogContent>
      </Dialog>

      {/* View Purchase Invoice Dialog */}
      <Dialog open={showViewPIDialog} onOpenChange={setShowViewPIDialog}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Purchase Invoice Details</DialogTitle>
            <DialogDescription>
              Invoice: {selectedPI?.invoice_no || selectedPI?.purchase_invoice_number}
            </DialogDescription>
          </DialogHeader>
          {selectedPI && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-sm font-medium">Invoice Number</Label>
                  <p className="mt-1">{selectedPI.invoice_no || selectedPI.purchase_invoice_number}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Date</Label>
                  <p className="mt-1">{new Date(selectedPI.purchase_invoice_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <Badge className="mt-1">{selectedPI.status}</Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium">Total Amount</Label>
                  <p className="mt-1 font-bold">₹{selectedPI.total_amount?.toFixed(2)}</p>
                </div>
              </div>
              
              {selectedPI.purchase_invoice_items && (
                <div>
                  <Label className="text-sm font-medium">Items</Label>
                  <div className="mt-2 border rounded-lg overflow-hidden">
                    <div className="bg-muted/50 p-4">
                      <div className="grid grid-cols-4 gap-4 font-medium">
                        <span>Item</span>
                        <span>Qty</span>
                        <span>Price</span>
                        <span>Total</span>
                      </div>
                    </div>
                    <div className="p-4 space-y-2">
                      {selectedPI.purchase_invoice_items.map((item: any, index: number) => (
                        <div key={index} className="grid grid-cols-4 gap-4 py-2 border-b last:border-0">
                          <span>{item.item_description}</span>
                          <span>{item.quantity}</span>
                          <span>₹{item.unit_price?.toFixed(2)}</span>
                          <span>₹{item.total_price?.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}