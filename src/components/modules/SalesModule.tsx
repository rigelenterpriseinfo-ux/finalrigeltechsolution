
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import InvoiceTable from '@/components/tables/InvoiceTable';
import InvoiceForm from '@/components/forms/InvoiceForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

export default function SalesModule() {
  const { profile } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

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
          total_cgst_amount,
          total_sgst_amount,
          total_igst_amount,
          total_amount,
          status,
          notes,
          terms_conditions,
          created_at,
          updated_at,
          performa_invoice_items (
            id,
            product_name,
            description,
            quantity,
            unit_price,
            cgst_rate,
            sgst_rate,
            igst_rate,
            cgst_amount,
            sgst_amount,
            igst_amount,
            total_amount
          )
        `)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })
        .limit(5);

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
        description: "Failed to fetch invoices",
        variant: "destructive",
      });
    }
  };

  const fetchSalesOrders = async () => {
    if (!profile?.company_id) return;

    try {
      const { data, error } = await supabase
        .from('sales_orders')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })
        .limit(50);

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

  useEffect(() => {
    fetchInvoices();
    fetchSalesOrders();
  }, [profile?.company_id]);

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
        description: "Invoice deleted successfully",
      });
      fetchInvoices();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast({
        title: "Error",
        description: "Failed to delete invoice",
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
        total_cgst_amount: invoiceData.total_cgst_amount,
        total_sgst_amount: invoiceData.total_sgst_amount,
        total_igst_amount: invoiceData.total_igst_amount,
        total_amount: invoiceData.total_amount,
        status: invoiceData.status,
        notes: invoiceData.notes,
        terms_conditions: invoiceData.terms_conditions,
        created_by: profile.id
      };

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
          product_name: item.product_name,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          cgst_rate: item.cgst_rate,
          sgst_rate: item.sgst_rate,
          igst_rate: item.igst_rate,
          cgst_amount: item.cgst_amount,
          sgst_amount: item.sgst_amount,
          igst_amount: item.igst_amount,
          total_amount: item.total_amount
        }));

        const { error: itemsError } = await supabase
          .from('performa_invoice_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      toast({
        title: "Success",
        description: action === 'draft' 
          ? "Invoice saved as draft successfully" 
          : "Invoice generated successfully",
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
        description: `Failed to ${action === 'draft' ? 'save' : 'generate'} invoice`,
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
        <h2 className="text-2xl font-semibold">Invoices</h2>
        <Dialog>
          <DialogTrigger asChild>
            <Button onClick={handleOpenInvoiceDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Create Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[80%] md:max-w-[70%] lg:max-w-[60%] xl:max-w-[50%]">
            <DialogHeader>
              <DialogTitle>{editingInvoice ? 'Edit Invoice' : 'Create Invoice'}</DialogTitle>
            </DialogHeader>
            <InvoiceForm
              invoice={editingInvoice}
              onSubmit={handleInvoiceSubmit}
              onCancel={handleCancelInvoice}
            />
          </DialogContent>
        </Dialog>
      </div>

      <InvoiceTable
        invoices={invoices}
        onEdit={handleEditInvoice}
        onDelete={handleDeleteInvoice}
      />
    </div>
  );
}
