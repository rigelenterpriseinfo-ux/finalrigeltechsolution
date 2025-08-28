
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Users, ShoppingCart, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CustomerForm } from "../forms/CustomerForm";
import { SalesOrderForm } from "../forms/SalesOrderForm";
import { SalesOrderTable } from "../tables/SalesOrderTable";
import { SalesOrderDetailsDialog } from "../dialogs/SalesOrderDetailsDialog";
import { CustomerTable } from "../tables/CustomerTable";

export const SalesModule = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedSalesOrder, setSelectedSalesOrder] = useState(null);
  const [selectedSalesOrderForDetails, setSelectedSalesOrderForDetails] = useState(null);
  const [salesOrderItems, setSalesOrderItems] = useState([]);
  const [customerForDetails, setCustomerForDetails] = useState(null);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showSalesOrderDialog, setShowSalesOrderDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteType, setDeleteType] = useState('');

  useEffect(() => {
    fetchCustomers();
    fetchSalesOrders();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast({
        title: "Error",
        description: "Failed to fetch customers",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          *,
          customer:customers(name, customer_ref)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSalesOrders(data || []);
    } catch (error) {
      console.error('Error fetching sales orders:', error);
      toast({
        title: "Error",
        description: "Failed to fetch sales orders",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSubmit = async (customerData) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('User profile not found');

      const dataWithCompany = {
        ...customerData,
        company_id: profile.company_id
      };

      let result;
      if (selectedCustomer) {
        // Update existing customer
        result = await supabase
          .from('customers')
          .update(dataWithCompany)
          .eq('id', selectedCustomer.id);
      } else {
        // Create new customer
        result = await supabase
          .from('customers')
          .insert(dataWithCompany);
      }

      if (result.error) throw result.error;

      toast({
        title: "Success",
        description: `Customer ${selectedCustomer ? 'updated' : 'created'} successfully`,
      });

      setShowCustomerDialog(false);
      setSelectedCustomer(null);
      fetchCustomers();
    } catch (error) {
      console.error('Error saving customer:', error);
      toast({
        title: "Error",
        description: `Failed to ${selectedCustomer ? 'update' : 'create'} customer`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSalesOrderSubmit = async ({ orderData, lineItems }) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('User profile not found');

      const orderWithCompany = {
        ...orderData,
        company_id: profile.company_id,
        created_by: profile.id
      };

      let salesOrderResult;
      if (selectedSalesOrder) {
        // Update existing sales order
        salesOrderResult = await supabase
          .from('sales_orders')
          .update(orderWithCompany)
          .eq('id', selectedSalesOrder.id)
          .select()
          .single();
      } else {
        // Create new sales order
        salesOrderResult = await supabase
          .from('sales_orders')
          .insert(orderWithCompany)
          .select()
          .single();
      }

      if (salesOrderResult.error) throw salesOrderResult.error;

      const salesOrderId = salesOrderResult.data.id;

      // Handle line items
      if (selectedSalesOrder) {
        // Delete existing items and insert new ones
        await supabase
          .from('sales_order_items')
          .delete()
          .eq('sales_order_id', salesOrderId);
      }

      // Insert line items
      if (lineItems.length > 0) {
        const itemsToInsert = lineItems.map(item => ({
          sales_order_id: salesOrderId,
          product_id: item.product_id,
          item_description: item.item_description,
          hsn_sac_code: item.hsn_sac_code,
          quantity: item.quantity,
          unit_of_measure: item.unit_of_measure,
          unit_price: item.unit_price,
          discount_percentage: item.discount_percentage,
          discount_amount: item.discount_amount,
          cgst_rate: item.cgst_rate,
          sgst_rate: item.sgst_rate,
          igst_rate: item.igst_rate,
          cgst_amount: item.cgst_amount,
          sgst_amount: item.sgst_amount,
          igst_amount: item.igst_amount,
          total_price: item.total_price
        }));

        const itemsResult = await supabase
          .from('sales_order_items')
          .insert(itemsToInsert);

        if (itemsResult.error) throw itemsResult.error;
      }

      toast({
        title: "Success",
        description: `Sales order ${selectedSalesOrder ? 'updated' : 'created'} successfully`,
      });

      setShowSalesOrderDialog(false);
      setSelectedSalesOrder(null);
      fetchSalesOrders();
    } catch (error) {
      console.error('Error saving sales order:', error);
      toast({
        title: "Error",
        description: `Failed to ${selectedSalesOrder ? 'update' : 'create'} sales order`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewSalesOrder = async (salesOrder) => {
    try {
      // Fetch sales order items
      const { data: items, error: itemsError } = await supabase
        .from('sales_order_items')
        .select('*')
        .eq('sales_order_id', salesOrder.id);

      if (itemsError) throw itemsError;

      // Fetch customer details
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', salesOrder.customer_id)
        .single();

      if (customerError) throw customerError;

      setSelectedSalesOrderForDetails(salesOrder);
      setSalesOrderItems(items || []);
      setCustomerForDetails(customer);
      setShowDetailsDialog(true);
    } catch (error) {
      console.error('Error fetching sales order details:', error);
      toast({
        title: "Error",
        description: "Failed to fetch sales order details",
        variant: "destructive"
      });
    }
  };

  const handleEditCustomer = (customer) => {
    setSelectedCustomer(customer);
    setShowCustomerDialog(true);
  };

  const handleEditSalesOrder = (salesOrder) => {
    setSelectedSalesOrder(salesOrder);
    setShowSalesOrderDialog(true);
  };

  const handleDeleteConfirm = (item, type) => {
    setDeleteTarget(item);
    setDeleteType(type);
    setShowDeleteDialog(true);
  };

  const handleDeleteExecute = async () => {
    if (!deleteTarget || !deleteType) return;

    setLoading(true);
    try {
      if (deleteType === 'customer') {
        const { error } = await supabase
          .from('customers')
          .delete()
          .eq('id', deleteTarget.id);

        if (error) throw error;
        fetchCustomers();
      } else if (deleteType === 'salesOrder') {
        // Delete sales order items first
        await supabase
          .from('sales_order_items')
          .delete()
          .eq('sales_order_id', deleteTarget.id);

        // Then delete the sales order
        const { error } = await supabase
          .from('sales_orders')
          .delete()
          .eq('id', deleteTarget.id);

        if (error) throw error;
        fetchSalesOrders();
      }

      toast({
        title: "Success",
        description: `${deleteType === 'customer' ? 'Customer' : 'Sales order'} deleted successfully`,
      });
    } catch (error) {
      console.error(`Error deleting ${deleteType}:`, error);
      toast({
        title: "Error",
        description: `Failed to delete ${deleteType}. ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setShowDeleteDialog(false);
      setDeleteTarget(null);
      setDeleteType('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Sales Management</h2>
          <p className="text-muted-foreground">Manage customers and sales orders</p>
        </div>
      </div>

      <Tabs defaultValue="customers" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="customers" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Customers
          </TabsTrigger>
          <TabsTrigger value="sales-orders" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Sales Orders
          </TabsTrigger>
          <TabsTrigger value="performa-invoices" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Performa Invoices
          </TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold">Customer Management</h3>
            <Dialog open={showCustomerDialog} onOpenChange={setShowCustomerDialog}>
              <DialogTrigger asChild>
                <Button onClick={() => setSelectedCustomer(null)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Customer
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {selectedCustomer ? 'Edit Customer' : 'Add New Customer'}
                  </DialogTitle>
                </DialogHeader>
                <CustomerForm
                  customer={selectedCustomer}
                  onSubmit={handleCustomerSubmit}
                  onCancel={() => {
                    setShowCustomerDialog(false);
                    setSelectedCustomer(null);
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>

          <CustomerTable
            customers={customers}
            onEdit={handleEditCustomer}
            onDelete={(customer) => handleDeleteConfirm(customer, 'customer')}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="sales-orders" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold">Sales Orders</h3>
            <Dialog open={showSalesOrderDialog} onOpenChange={setShowSalesOrderDialog}>
              <DialogTrigger asChild>
                <Button onClick={() => setSelectedSalesOrder(null)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Sales Order
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {selectedSalesOrder ? 'Edit Sales Order' : 'Create Sales Order'}
                  </DialogTitle>
                </DialogHeader>
                <SalesOrderForm
                  salesOrder={selectedSalesOrder}
                  onSubmit={handleSalesOrderSubmit}
                  onCancel={() => {
                    setShowSalesOrderDialog(false);
                    setSelectedSalesOrder(null);
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>

          <SalesOrderTable
            salesOrders={salesOrders}
            onView={handleViewSalesOrder}
            onEdit={handleEditSalesOrder}
            onDelete={(salesOrder) => handleDeleteConfirm(salesOrder, 'salesOrder')}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="performa-invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performa Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Performa invoice management coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sales Order Details Dialog */}
      <SalesOrderDetailsDialog
        isOpen={showDetailsDialog}
        onClose={() => setShowDetailsDialog(false)}
        salesOrder={selectedSalesOrderForDetails}
        salesOrderItems={salesOrderItems}
        customer={customerForDetails}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the{' '}
              {deleteType === 'customer' ? 'customer' : 'sales order'} and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteExecute}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
