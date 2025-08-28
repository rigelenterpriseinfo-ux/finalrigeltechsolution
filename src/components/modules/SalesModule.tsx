import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Import table and form components
import { CustomerTable } from '@/components/tables/CustomerTable';
import { CustomerForm } from '@/components/forms/CustomerForm';
import { SalesOrderTable } from '@/components/tables/SalesOrderTable';
import { SalesOrderForm } from '@/components/forms/SalesOrderForm';
import InvoiceTable from '@/components/tables/InvoiceTable';
import InvoiceForm from '@/components/forms/InvoiceForm';

export default function SalesModule() {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  // State for all three modules
  const [customers, setCustomers] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  
  // Dialog states
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showSalesOrderDialog, setShowSalesOrderDialog] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  
  // Editing states
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editingSalesOrder, setEditingSalesOrder] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);
  
  const [loading, setLoading] = useState(false);

  // Fetch functions
  const fetchCustomers = async () => {
    if (!profile?.company_id) return;

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast({
        title: "Error",
        description: "Failed to fetch customers",
        variant: "destructive",
      });
    }
  };

  const fetchSalesOrders = async () => {
    if (!profile?.company_id) return;

    try {
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          *,
          customers!inner(
            name,
            customer_ref
          )
        `)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSalesOrders(data || []);
    } catch (error) {
      console.error('Error fetching sales orders:', error);
      toast({
        title: "Error",
        description: "Failed to fetch sales orders",
        variant: "destructive",
      });
    }
  };

  const fetchInvoices = async () => {
    if (!profile?.company_id) return;

    try {
        const { data, error } = await supabase
          .from('performa_invoices')
          .select(`
            id,
            sales_order_id,
            customer_id,
            customer_name,
            performa_invoice_number,
            performa_invoice_date,
            place_of_supply,
            subtotal_amount,
            tax_amount,
            total_amount,
            status,
            notes,
            created_at,
            updated_at,
            performa_invoice_items (
              id,
              item_description,
              quantity,
              unit_price,
              cgst_rate,
              sgst_rate,
              igst_rate,
              cgst_amount,
              sgst_amount,
              igst_amount,
              total_price
            )
          `)
          .eq('company_id', profile.company_id)
          .order('created_at', { ascending: false })

        if (error) throw error;

        const invoicesWithItems = data?.map(invoice => ({
          ...invoice,
          items: invoice.performa_invoice_items || []
        })) || [];

      setInvoices(invoicesWithItems);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast({
        title: "Error",
        description: "Failed to fetch sales invoices",
        variant: "destructive",
      });
    }
  };


  useEffect(() => {
    if (profile?.company_id) {
      fetchCustomers();
      fetchSalesOrders();
      fetchInvoices();
    }
  }, [profile?.company_id]);

  // Customer handlers
  const handleOpenCustomerDialog = () => {
    setEditingCustomer(null);
    setShowCustomerDialog(true);
  };

  const handleEditCustomer = (customer: any) => {
    setEditingCustomer(customer);
    setShowCustomerDialog(true);
  };

  const handleDeleteCustomer = async (customer: any) => {
    if (!profile?.company_id) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customer.id);

      if (error) throw error;

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
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSubmit = async (customerData: any) => {
    if (!profile?.company_id) return;

    try {
      setLoading(true);
      const payload = {
        ...customerData,
        company_id: profile.company_id,
      };

      if (editingCustomer) {
        const { error } = await supabase
          .from('customers')
          .update(payload)
          .eq('id', editingCustomer.id);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Customer updated successfully",
        });
      } else {
        const { error } = await supabase
          .from('customers')
          .insert([payload]);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Customer created successfully",
        });
      }

      fetchCustomers();
      setShowCustomerDialog(false);
      setEditingCustomer(null);
    } catch (error) {
      console.error('Error saving customer:', error);
      toast({
        title: "Error",
        description: "Failed to save customer",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Sales Order handlers
  const handleOpenSalesOrderDialog = () => {
    setEditingSalesOrder(null);
    setShowSalesOrderDialog(true);
  };

  const handleEditSalesOrder = (salesOrder: any) => {
    setEditingSalesOrder(salesOrder);
    setShowSalesOrderDialog(true);
  };

  const handleDeleteSalesOrder = async (salesOrder: any) => {
    if (!profile?.company_id) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('sales_orders')
        .delete()
        .eq('id', salesOrder.id);

      if (error) throw error;

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
    } finally {
      setLoading(false);
    }
  };

  const handleSalesOrderSubmit = async (data: any) => {
    if (!profile?.company_id) return;

    try {
      setLoading(true);
      const { orderData, lineItems } = data;
      
      const salesOrderPayload = {
        ...orderData,
        company_id: profile.company_id,
        created_by: profile.id,
      };

      let result;
      if (editingSalesOrder) {
        const { data: updatedOrder, error } = await supabase
          .from('sales_orders')
          .update(salesOrderPayload)
          .eq('id', editingSalesOrder.id)
          .select()
          .single();

        if (error) throw error;
        result = updatedOrder;

        // Delete existing items
        await supabase
          .from('sales_order_items')
          .delete()
          .eq('sales_order_id', result.id);
      } else {
        const { data: newOrder, error } = await supabase
          .from('sales_orders')
          .insert([salesOrderPayload])
          .select()
          .single();

        if (error) throw error;
        result = newOrder;
      }

      // Insert line items
      if (lineItems?.length > 0) {
        const itemsToInsert = lineItems.map((item: any) => ({
          sales_order_id: result.id,
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
          total_price: item.total_price,
        }));

        const { error: itemsError } = await supabase
          .from('sales_order_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      toast({
        title: "Success",
        description: editingSalesOrder ? "Sales order updated successfully" : "Sales order created successfully",
      });

      fetchSalesOrders();
      setShowSalesOrderDialog(false);
      setEditingSalesOrder(null);
    } catch (error) {
      console.error('Error saving sales order:', error);
      toast({
        title: "Error",
        description: "Failed to save sales order",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Invoice handlers
  const handleOpenInvoiceDialog = () => {
    setEditingInvoice(null);
    setShowInvoiceDialog(true);
  };

  const handleEditInvoice = (invoice: any) => {
    setEditingInvoice(invoice);
    setShowInvoiceDialog(true);
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!profile?.company_id) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('performa_invoices')
        .delete()
        .eq('id', invoiceId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Sales invoice deleted successfully",
      });
      fetchInvoices();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast({
        title: "Error",
        description: "Failed to delete sales invoice",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInvoiceSubmit = async (invoiceData: any, action: 'draft' | 'invoice') => {
    if (!profile?.company_id) {
      toast({
        title: "Error",
        description: "Company information not found",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const invoicePayload = {
        company_id: profile.company_id,
        sales_order_id: invoiceData.sales_order_id,
        customer_id: invoiceData.customer_id,
        customer_name: invoiceData.customer_name,
        performa_invoice_date: invoiceData.performa_invoice_date,
        place_of_supply: invoiceData.place_of_supply,
        subtotal_amount: invoiceData.subtotal_amount,
        tax_amount: invoiceData.tax_amount || 0,
        total_amount: invoiceData.total_amount,
        status: invoiceData.status,
        notes: invoiceData.notes,
        created_by: profile.id
      };

      // Only include performa_invoice_number if it's not null/undefined
      if (invoiceData.performa_invoice_number) {
        (invoicePayload as any).performa_invoice_number = invoiceData.performa_invoice_number;
      }

      let result;
      if (editingInvoice) {
        // Update existing invoice
        const { data, error } = await supabase
          .from('performa_invoices')
          .update(invoicePayload)
          .eq('id', editingInvoice.id)
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        // Create new invoice
        const { data, error } = await supabase
          .from('performa_invoices')
          .insert([invoicePayload])
          .select()
          .single();

        if (error) throw error;
        result = data;
      }

      // Handle invoice items
      if (result && invoiceData.items?.length > 0) {
        // Delete existing items if editing
        if (editingInvoice) {
          await supabase
            .from('performa_invoice_items')
            .delete()
            .eq('performa_invoice_id', result.id);
        }

        // Insert new items
        const itemsToInsert = invoiceData.items.map((item: any) => ({
          performa_invoice_id: result.id,
          product_id: item.product_id || null,
          item_description: item.description || item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          cgst_rate: item.cgst_rate,
          sgst_rate: item.sgst_rate,
          igst_rate: item.igst_rate,
          cgst_amount: item.cgst_amount,
          sgst_amount: item.sgst_amount,
          igst_amount: item.igst_amount,
          total_price: item.total_amount
        }));

        const { error: itemsError } = await supabase
          .from('performa_invoice_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      toast({
        title: "Success",
        description: action === 'draft' 
          ? "Sales invoice saved as draft successfully" 
          : "Sales invoice generated successfully",
      });

      // Refresh the invoices list
      await fetchInvoices();
      
      // Close the dialog and reset state
      setShowInvoiceDialog(false);
      setEditingInvoice(null);

    } catch (error) {
      console.error('Error saving invoice:', error);
      toast({
        title: "Error",
        description: `Failed to ${action === 'draft' ? 'save' : 'generate'} sales invoice`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelInvoice = () => {
    setShowInvoiceDialog(false);
    setEditingInvoice(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Sales Management</h2>
      </div>

      <Tabs defaultValue="customers" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="sales-orders">Sales Orders</TabsTrigger>
          <TabsTrigger value="sales-invoices">Sales Invoice</TabsTrigger>
        </TabsList>

        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Customer Management</h3>
            <Button onClick={handleOpenCustomerDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Customer
            </Button>
          </div>
          <CustomerTable
            customers={customers}
            onEdit={handleEditCustomer}
            onDelete={handleDeleteCustomer}
            loading={loading}
          />
        </TabsContent>

        {/* Sales Orders Tab */}
        <TabsContent value="sales-orders" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Sales Order Management</h3>
            <Button onClick={handleOpenSalesOrderDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Create Sales Order
            </Button>
          </div>
          <SalesOrderTable
            salesOrders={salesOrders}
            onView={(order) => {/* Implement view logic */}}
            onEdit={handleEditSalesOrder}
            onDelete={handleDeleteSalesOrder}
            loading={loading}
          />
        </TabsContent>

        {/* Sales Invoice Tab */}
        <TabsContent value="sales-invoices" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Sales Invoice Management</h3>
            <Button onClick={handleOpenInvoiceDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Create Sales Invoice
            </Button>
          </div>
          <InvoiceTable
            invoices={invoices}
            onEdit={handleEditInvoice}
            onDelete={handleDeleteInvoice}
          />
        </TabsContent>
      </Tabs>

      {/* Customer Dialog */}
      <Dialog open={showCustomerDialog} onOpenChange={setShowCustomerDialog}>
        <DialogContent className="sm:max-w-[80%] md:max-w-[70%] lg:max-w-[60%] xl:max-w-[50%] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
          </DialogHeader>
          <CustomerForm
            customer={editingCustomer}
            onSubmit={handleCustomerSubmit}
            onCancel={() => {
              setShowCustomerDialog(false);
              setEditingCustomer(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Sales Order Dialog */}
      <Dialog open={showSalesOrderDialog} onOpenChange={setShowSalesOrderDialog}>
        <DialogContent className="sm:max-w-[90%] md:max-w-[80%] lg:max-w-[70%] xl:max-w-[60%] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSalesOrder ? 'Edit Sales Order' : 'Create Sales Order'}</DialogTitle>
          </DialogHeader>
          <SalesOrderForm
            salesOrder={editingSalesOrder}
            onSubmit={handleSalesOrderSubmit}
            onCancel={() => {
              setShowSalesOrderDialog(false);
              setEditingSalesOrder(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Sales Invoice Dialog */}
      <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <DialogContent className="sm:max-w-[80%] md:max-w-[70%] lg:max-w-[60%] xl:max-w-[50%] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingInvoice ? 'Edit Sales Invoice' : 'Create Sales Invoice'}</DialogTitle>
          </DialogHeader>
          <InvoiceForm
            invoice={editingInvoice}
            onSubmit={handleInvoiceSubmit}
            onCancel={handleCancelInvoice}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
