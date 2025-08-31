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
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, Truck, ShoppingCart, FileText, Building2, Package, TrendingUp } from 'lucide-react';
import { EnhancedPurchaseInvoiceForm } from '@/components/forms/EnhancedPurchaseInvoiceForm';
import { PurchaseInvoiceTable } from '@/components/tables/PurchaseInvoiceTable';
import { SupplierForm } from '@/components/forms/SupplierForm';
import { SupplierTable } from '@/components/tables/SupplierTable';
import { PurchaseOrderForm } from '@/components/forms/PurchaseOrderForm';
import { PurchaseOrderTable } from '@/components/tables/PurchaseOrderTable';
import { GRNForm } from '@/components/forms/GRNForm';
import { GRNTable } from '@/components/tables/GRNTable';

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
  expected_date?: string;
  total_amount: number;
  currency: string;
  supplier: {
    name: string;
  };
  created_at: string;
  notes?: string;
}

export function PurchaseModule() {
  const { user, profile } = useAuth();
  const { hasEditAccess } = useBusinessAuth();
  const { toast } = useToast();
  const canEdit = hasEditAccess('purchases');
  
  // State management
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<any[]>([]);
  const [grns, setGRNs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [showAddSupplierDialog, setShowAddSupplierDialog] = useState(false);
  const [showEditSupplierDialog, setShowEditSupplierDialog] = useState(false);
  const [showViewSupplierDialog, setShowViewSupplierDialog] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [showAddPODialog, setShowAddPODialog] = useState(false);
  const [showEditPODialog, setShowEditPODialog] = useState(false);
  const [showViewPODialog, setShowViewPODialog] = useState(false);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [showAddPIDialog, setShowAddPIDialog] = useState(false);
  const [showEditPIDialog, setShowEditPIDialog] = useState(false);
  const [showViewPIDialog, setShowViewPIDialog] = useState(false);
  const [selectedPI, setSelectedPI] = useState<any>(null);
  const [showAddGRNDialog, setShowAddGRNDialog] = useState(false);
  const [showEditGRNDialog, setShowEditGRNDialog] = useState(false);
  const [showViewGRNDialog, setShowViewGRNDialog] = useState(false);
  const [selectedGRN, setSelectedGRN] = useState<any>(null);
  const [refreshGRNTrigger, setRefreshGRNTrigger] = useState(0);

  // Fetch data
  useEffect(() => {
    if (profile?.company_id) {
      fetchSuppliers();
      fetchPurchaseOrders();
      fetchPurchaseInvoicesData();
      fetchGRNs();
    }
  }, [profile?.company_id]);

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('company_id', profile?.company_id)
        .order('created_at', { ascending: false });

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
          supplier:suppliers(name),
          purchase_order_items(*)
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

  const fetchGRNs = async () => {
    try {
      const { data, error } = await supabase
        .from('grn_header')
        .select(`
          *,
          grn_line_items(*)
        `)
        .eq('company_id', profile?.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGRNs(data || []);
    } catch (error) {
      console.error('Error fetching GRNs:', error);
    }
  };

  // Supplier Management Functions
  const handleAddSupplier = async (data: any) => {
    if (!canEdit) {
      toast({ title: "Permission denied", description: "You don't have edit access to Purchases.", variant: "destructive" });
      return;
    }
    
    try {
      const supplierData = {
        ...data,
        company_id: profile?.company_id,
        is_active: data.is_active !== false,
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
    } catch (error) {
      console.error('Error adding supplier:', error);
      toast({
        title: "Error",
        description: "Failed to add supplier",
        variant: "destructive",
      });
    }
  };

  const handleEditSupplier = async (data: any) => {
    if (!canEdit) {
      toast({ title: "Permission denied", description: "You don't have edit access to Purchases.", variant: "destructive" });
      return;
    }
    
    try {
      const { error } = await supabase
        .from('suppliers')
        .update({
          ...data,
          is_active: data.is_active !== false,
        })
        .eq('id', selectedSupplier.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Supplier updated successfully",
      });

      setShowEditSupplierDialog(false);
      setSelectedSupplier(null);
      fetchSuppliers();
    } catch (error) {
      console.error('Error updating supplier:', error);
      toast({
        title: "Error",
        description: "Failed to update supplier",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSupplier = async (supplierId: string) => {
    if (!canEdit) {
      toast({ title: "Permission denied", description: "You don't have edit access to Purchases.", variant: "destructive" });
      return;
    }

    if (!confirm('Are you sure you want to delete this supplier?')) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', supplierId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Supplier deleted successfully",
      });

      fetchSuppliers();
    } catch (error) {
      console.error('Error deleting supplier:', error);
      toast({
        title: "Error",
        description: "Failed to delete supplier",
        variant: "destructive",
      });
    }
  };

  const handleViewSupplier = (supplier: any) => {
    setSelectedSupplier(supplier);
    setShowViewSupplierDialog(true);
  };

  const handleEditSupplierClick = (supplier: any) => {
    setSelectedSupplier(supplier);
    setShowEditSupplierDialog(true);
  };

  // Purchase Order CRUD Functions
  const handleAddPurchaseOrder = async (poData: any) => {
    if (!canEdit) {
      toast({ title: "Permission denied", description: "You don't have edit access to Purchases.", variant: "destructive" });
      return;
    }
    try {
      // Generate PO number using the database function
      const { data: poNumberData, error: poNumberError } = await supabase
        .rpc('generate_po_number', { comp_id: profile?.company_id });

      if (poNumberError) {
        console.error('Error generating PO number:', poNumberError);
        throw poNumberError;
      }

      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          company_id: profile?.company_id,
          supplier_id: poData.supplier_id,
          po_number: poNumberData,
          order_date: poData.order_date,
          currency: poData.currency,
          payment_terms: poData.payment_terms,
          expected_date: poData.expected_date,
          status: poData.status,
          notes: poData.notes,
          subtotal_amount: poData.subtotal_amount,
          total_discount_amount: poData.total_discount_amount,
          total_tax_amount: poData.total_tax_amount,
          total_amount: poData.total_amount,
          created_by: profile?.id,
        } as any)
        .select()
        .single();

      if (poError) throw poError;

      // Insert PO items
      if (poData.items && poData.items.length > 0) {
        const itemsToInsert = poData.items.map((item: any) => ({
          purchase_order_id: po.id,
          product_id: item.product_id,
          item_description: item.product_name || '',
          item_code: item.item_code,
          hsn_sac_code: item.hsn_sac_code,
          quantity: item.quantity,
          unit_of_measure: item.unit_of_measure,
          unit_price: item.unit_price,
          discount_percentage: item.discount_percentage || 0,
          discount_amount: item.discount_amount || 0,
          taxable_value: (item.line_subtotal || 0) - (item.discount_amount || 0),
          cgst_rate: item.cgst_rate || 0,
          sgst_rate: item.sgst_rate || 0,
          igst_rate: item.igst_rate || 0,
          cgst_amount: item.cgst_amount || 0,
          sgst_amount: item.sgst_amount || 0,
          igst_amount: item.igst_amount || 0,
          total_price: item.line_total || 0,
          received_quantity: 0,
          pending_quantity: item.quantity,
          remarks: item.remarks,
        }));

        const { error: itemsError } = await supabase
          .from('purchase_order_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      toast({
        title: "Success",
        description: `Purchase order created successfully (PO: ${po.po_number})`,
      });

      fetchPurchaseOrders();
      return po;
    } catch (error) {
      console.error('Error creating purchase order:', error);
      toast({
        title: "Error",
        description: "Failed to create purchase order",
        variant: "destructive",
      });
    }
  };

  const handleEditPurchaseOrder = async (poData: any) => {
    if (!selectedPO || !canEdit) return;
    
    try {
      const { error: poError } = await supabase
        .from('purchase_orders')
        .update({
          supplier_id: poData.supplier_id,
          order_date: poData.order_date,
          currency: poData.currency,
          payment_terms: poData.payment_terms,
          expected_date: poData.expected_date,
          status: poData.status,
          notes: poData.notes,
          subtotal_amount: poData.subtotal_amount,
          total_discount_amount: poData.total_discount_amount,
          total_tax_amount: poData.total_tax_amount,
          total_amount: poData.total_amount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedPO.id);

      if (poError) throw poError;

      // Update PO items
      if (poData.items && poData.items.length > 0) {
        // Delete existing items
        const { error: deleteError } = await supabase
          .from('purchase_order_items')
          .delete()
          .eq('purchase_order_id', selectedPO.id);

        if (deleteError) throw deleteError;

        // Insert new items
        const itemsToInsert = poData.items.map((item: any) => ({
          purchase_order_id: selectedPO.id,
          product_id: item.product_id,
          item_description: item.product_name || '',
          item_code: item.item_code,
          hsn_sac_code: item.hsn_sac_code,
          quantity: item.quantity,
          unit_of_measure: item.unit_of_measure,
          unit_price: item.unit_price,
          discount_percentage: item.discount_percentage || 0,
          discount_amount: item.discount_amount || 0,
          taxable_value: (item.line_subtotal || 0) - (item.discount_amount || 0),
          cgst_rate: item.cgst_rate || 0,
          sgst_rate: item.sgst_rate || 0,
          igst_rate: item.igst_rate || 0,
          cgst_amount: item.cgst_amount || 0,
          sgst_amount: item.sgst_amount || 0,
          igst_amount: item.igst_amount || 0,
          total_price: item.line_total || 0,
          received_quantity: item.received_quantity || 0,
          pending_quantity: item.quantity - (item.received_quantity || 0),
          remarks: item.remarks,
        }));

        const { error: itemsError } = await supabase
          .from('purchase_order_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      toast({
        title: "Success",
        description: "Purchase order updated successfully",
      });

      setShowEditPODialog(false);
      setSelectedPO(null);
      fetchPurchaseOrders();
    } catch (error) {
      console.error('Error updating purchase order:', error);
      toast({
        title: "Error",
        description: "Failed to update purchase order",
        variant: "destructive",
      });
    }
  };

  const handleDeletePurchaseOrder = async (poId: string) => {
    if (!canEdit) {
      toast({ title: "Permission denied", description: "You don't have edit access to Purchases.", variant: "destructive" });
      return;
    }

    if (!confirm('Are you sure you want to delete this purchase order?')) {
      return;
    }
    
    try {
      // First delete all related items
      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .delete()
        .eq('purchase_order_id', poId);

      if (itemsError) throw itemsError;

      // Then delete the purchase order
      const { error: poError } = await supabase
        .from('purchase_orders')
        .delete()
        .eq('id', poId);

      if (poError) throw poError;

      toast({
        title: "Success",
        description: "Purchase order deleted successfully",
      });

      fetchPurchaseOrders();
    } catch (error) {
      console.error('Error deleting purchase order:', error);
      toast({
        title: "Error",
        description: "Failed to delete purchase order",
        variant: "destructive",
      });
    }
  };

  const handleViewPurchaseOrder = (po: any) => {
    setSelectedPO(po);
    setShowViewPODialog(true);
  };

  const handleEditPurchaseOrderClick = (po: any) => {
    setSelectedPO(po);
    setShowEditPODialog(true);
  };

  // Purchase Invoice CRUD Functions
  const handleAddPurchaseInvoice = async (invoiceData: any) => {
    if (!canEdit) {
      toast({ title: "Permission denied", description: "You don't have edit access to Purchases.", variant: "destructive" });
      return;
    }
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
    if (!canEdit) {
      toast({ title: "Permission denied", description: "You don't have edit access to Purchases.", variant: "destructive" });
      return;
    }
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
    if (!canEdit) {
      toast({ title: "Permission denied", description: "You don't have edit access to Purchases.", variant: "destructive" });
      return;
    }
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
          <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-green-700">Open Purchase Orders</p>
                <div className="flex flex-col">
                  <p className="text-xl font-bold text-green-800">
                    {purchaseOrders.filter(po => po.status === 'open' || po.status === 'confirmed').length}
                  </p>
                  <p className="text-sm text-green-600">
                    Total: ₹{purchaseOrders
                      .filter(po => po.status === 'open' || po.status === 'confirmed')
                      .reduce((sum, po) => sum + po.total_amount, 0)
                      .toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

        {/* Four Main Sections */}
      <Tabs defaultValue="suppliers" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="suppliers" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Supplier Management
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Purchase Orders
          </TabsTrigger>
          <TabsTrigger value="grn" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Purchase Receipt (GRN)
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
                 <Button className="bg-blue-600 hover:bg-blue-700" disabled={!canEdit}>
                   <Plus className="h-4 w-4 mr-2" />
                   Add Supplier
                 </Button>
                  </DialogTrigger>
                   <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
                     <DialogHeader>
                       <DialogTitle className="text-xl text-blue-700">Add New Supplier</DialogTitle>
                       <DialogDescription>Add a new supplier with complete details</DialogDescription>
                     </DialogHeader>
                     <SupplierForm
                       onSubmit={handleAddSupplier}
                       onCancel={() => setShowAddSupplierDialog(false)}
                     />
                   </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <SupplierTable
                suppliers={suppliers}
                onView={handleViewSupplier}
                onEdit={handleEditSupplierClick}
                onDelete={handleDeleteSupplier}
                onCreate={() => setShowAddSupplierDialog(true)}
                loading={loading}
              />
            </CardContent>
          </Card>

          {/* Edit Supplier Dialog */}
          <Dialog open={showEditSupplierDialog} onOpenChange={setShowEditSupplierDialog}>
            <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl text-blue-700">Edit Supplier</DialogTitle>
                <DialogDescription>Update supplier details</DialogDescription>
              </DialogHeader>
              <SupplierForm
                supplier={selectedSupplier}
                onSubmit={handleEditSupplier}
                onCancel={() => {
                  setShowEditSupplierDialog(false);
                  setSelectedSupplier(null);
                }}
              />
            </DialogContent>
          </Dialog>

          {/* View Supplier Dialog */}
          <Dialog open={showViewSupplierDialog} onOpenChange={setShowViewSupplierDialog}>
            <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl text-blue-700">Supplier Details</DialogTitle>
                <DialogDescription>View supplier information</DialogDescription>
              </DialogHeader>
              <SupplierForm
                supplier={selectedSupplier}
                onSubmit={() => Promise.resolve()}
                onCancel={() => {
                  setShowViewSupplierDialog(false);
                  setSelectedSupplier(null);
                }}
                readOnly={true}
              />
            </DialogContent>
          </Dialog>
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
                 <Dialog open={showAddPODialog} onOpenChange={setShowAddPODialog}>
                   <DialogTrigger asChild>
                     <Button className="bg-green-600 hover:bg-green-700" disabled={!canEdit}>
                       <Plus className="h-4 w-4 mr-2" />
                       Create Purchase Order
                     </Button>
                   </DialogTrigger>
                   <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
                     <PurchaseOrderForm
                       onSubmit={handleAddPurchaseOrder}
                       onCancel={() => setShowAddPODialog(false)}
                       mode="create"
                     />
                   </DialogContent>
                 </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <PurchaseOrderTable
                purchaseOrders={purchaseOrders}
                onView={(po) => {
                  setSelectedPO(po);
                  setShowViewPODialog(true);
                }}
                onEdit={(po) => {
                  setSelectedPO(po);
                  setShowEditPODialog(true);
                }}
                onDelete={handleDeletePurchaseOrder}
                loading={loading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Section 3: GRN Management */}
        <TabsContent value="grn" className="space-y-6">
          <Card>
            <CardHeader className="border-b bg-gradient-to-r from-orange-50 to-orange-100">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl text-orange-800">Purchase Receipt (GRN)</CardTitle>
                  <CardDescription>Create and manage Goods Receipt Notes</CardDescription>
                </div>
                <Dialog open={showAddGRNDialog} onOpenChange={setShowAddGRNDialog}>
                  <DialogTrigger asChild>
                    <Button className="bg-orange-600 hover:bg-orange-700" disabled={!canEdit}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create GRN
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
                    <GRNForm
                       onSubmit={async (data) => {
                         try {
                           // Calculate totals from line items
                           const totals = data.items.reduce(
                             (acc: any, item: any) => ({
                               totalOrderedQty: acc.totalOrderedQty + (item.ordered_quantity || 0),
                               totalReceivedQty: acc.totalReceivedQty + (item.received_quantity || 0),
                               totalAcceptedQty: acc.totalAcceptedQty + (item.accepted_quantity || 0),
                               totalRejectedQty: acc.totalRejectedQty + (item.rejected_quantity || 0),
                               subtotalAmount: acc.subtotalAmount + ((item.accepted_quantity || 0) * (item.unit_price || 0)),
                               totalDiscountAmount: acc.totalDiscountAmount + (item.discount_amount || 0),
                               totalTaxAmount: acc.totalTaxAmount + (item.total_tax_amount || 0),
                               totalAmount: acc.totalAmount + (item.line_total || 0),
                             }),
                             {
                               totalOrderedQty: 0,
                               totalReceivedQty: 0,
                               totalAcceptedQty: 0,
                               totalRejectedQty: 0,
                               subtotalAmount: 0,
                               totalDiscountAmount: 0,
                               totalTaxAmount: 0,
                               totalAmount: 0,
                             }
                           );

                            const { data: grn, error } = await supabase
                              .from('grn_header')
                              .insert({
                                company_id: profile?.company_id,
                                purchase_order_id: data.purchase_order_id,
                                supplier_id: data.supplier_id,
                                supplier_name: data.supplier_name,
                                grn_date: data.grn_date,
                                supplier_invoice_number: data.supplier_invoice_number,
                                supplier_invoice_date: data.supplier_invoice_date,
                                remarks: data.remarks,
                                status: data.status,
                                total_ordered_quantity: totals.totalOrderedQty,
                                total_received_quantity: totals.totalReceivedQty,
                                total_accepted_quantity: totals.totalAcceptedQty,
                                total_rejected_quantity: totals.totalRejectedQty,
                                subtotal_amount: totals.subtotalAmount,
                                total_discount_amount: totals.totalDiscountAmount,
                                total_tax_amount: totals.totalTaxAmount,
                                total_amount: totals.totalAmount,
                                created_by: profile?.user_id,
                              } as any)
                              .select()
                              .single();

                           if (error) throw error;

                           if (data.items?.length > 0) {
                              const itemsToInsert = data.items.map((item) => ({
                                grn_header_id: grn.id,
                                product_id: item.product_id,
                                product_name: item.product_name,
                                product_sku: item.product_sku,
                                unit_of_measure: item.unit_of_measure,
                                ordered_quantity: item.ordered_quantity,
                                received_quantity: item.received_quantity,
                                accepted_quantity: item.accepted_quantity,
                                rejected_quantity: item.rejected_quantity,
                                unit_price: item.unit_price,
                                discount_percentage: item.discount_percentage || 0,
                                discount_amount: item.discount_amount || 0,
                                warehouse_id: item.warehouse_id,
                                bin_id: item.bin_id,
                                hsn_sac_code: item.hsn_sac_code,
                                cgst_rate: item.cgst_rate || 0,
                                cgst_amount: item.cgst_amount || 0,
                                sgst_rate: item.sgst_rate || 0,
                                sgst_amount: item.sgst_amount || 0,
                                igst_rate: item.igst_rate || 0,
                                igst_amount: item.igst_amount || 0,
                                total_tax_amount: item.total_tax_amount || 0,
                                line_total: item.line_total || 0,
                              }));
                             
                             const { error: itemsError } = await supabase
                               .from('grn_line_items')
                               .insert(itemsToInsert);
                             if (itemsError) throw itemsError;
                           }

                           toast({ 
                             title: "Success", 
                             description: `GRN created successfully${grn.grn_number ? ` (GRN: ${grn.grn_number})` : ''}` 
                           });
                           setShowAddGRNDialog(false);
                           setRefreshGRNTrigger(prev => prev + 1);
                           fetchGRNs();
                         } catch (error) {
                           console.error('Error creating GRN:', error);
                           toast({ 
                             title: "Error", 
                             description: "Failed to create GRN. Please check that all products are properly selected.", 
                             variant: "destructive" 
                           });
                         }
                       }}
                      onCancel={() => setShowAddGRNDialog(false)}
                      mode="create"
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <GRNTable
                refreshTrigger={refreshGRNTrigger}
                onView={(grn) => {
                  setSelectedGRN(grn);
                  setShowViewGRNDialog(true);
                }}
                onEdit={(grn) => {
                  setSelectedGRN(grn);
                  setShowEditGRNDialog(true);
                }}
                onDelete={async (grnId) => {
                  if (!confirm('Are you sure you want to delete this GRN?')) return;
                  try {
                    const { error } = await supabase.from('grn_header').delete().eq('id', grnId);
                    if (error) throw error;
                    toast({ title: "Success", description: "GRN deleted successfully" });
                    setRefreshGRNTrigger(prev => prev + 1);
                  } catch (error) {
                    console.error('Error deleting GRN:', error);
                    toast({ title: "Error", description: "Failed to delete GRN", variant: "destructive" });
                  }
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Section 4: Purchase Invoices */}
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
                   disabled={!canEdit}
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
                onEdit={(inv) => { if (!canEdit) { toast({ title: 'Permission denied', description: "You don't have edit access to Purchases.", variant: 'destructive' }); return; } handleEditPI(inv); }}
                onDelete={(id) => { if (!canEdit) { toast({ title: 'Permission denied', description: "You don't have edit access to Purchases.", variant: 'destructive' }); return; } handleDeletePI(id); }}
                onCreate={() => { if (!canEdit) { toast({ title: 'Permission denied', description: "You don't have edit access to Purchases.", variant: 'destructive' }); return; } setShowAddPIDialog(true); }}
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

      {/* Purchase Order Dialogs */}
      {/* Edit Purchase Order Dialog */}
      <Dialog open={showEditPODialog} onOpenChange={setShowEditPODialog}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
          <PurchaseOrderForm
            purchaseOrder={selectedPO}
            onSubmit={handleEditPurchaseOrder}
            onCancel={() => {
              setShowEditPODialog(false);
              setSelectedPO(null);
            }}
            mode="edit"
          />
        </DialogContent>
      </Dialog>

      {/* View Purchase Order Dialog */}
      <Dialog open={showViewPODialog} onOpenChange={setShowViewPODialog}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
          <PurchaseOrderForm
            purchaseOrder={selectedPO}
            onSubmit={() => Promise.resolve()}
            onCancel={() => {
              setShowViewPODialog(false);
              setSelectedPO(null);
            }}
            readOnly={true}
            mode="view"
          />
        </DialogContent>
      </Dialog>

      {/* GRN Dialogs */}
      {/* Edit GRN Dialog */}
      <Dialog open={showEditGRNDialog} onOpenChange={setShowEditGRNDialog}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
          <GRNForm
            grn={selectedGRN}
            onSubmit={async (grnData) => {
              try {
                const { error } = await supabase
                  .from('grn_header')
                  .update(grnData)
                  .eq('id', selectedGRN.id);
                
                if (error) throw error;
                
                toast({
                  title: "Success", 
                  description: "GRN updated successfully"
                });
                
                setShowEditGRNDialog(false);
                setSelectedGRN(null);
                setRefreshGRNTrigger(prev => prev + 1);
              } catch (error) {
                console.error('Error updating GRN:', error);
                toast({
                  title: "Error",
                  description: "Failed to update GRN",
                  variant: "destructive",
                });
              }
            }}
            onCancel={() => {
              setShowEditGRNDialog(false);
              setSelectedGRN(null);
            }}
            mode="edit"
          />
        </DialogContent>
      </Dialog>

      {/* View GRN Dialog */}
      <Dialog open={showViewGRNDialog} onOpenChange={setShowViewGRNDialog}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
          <GRNForm
            grn={selectedGRN}
            onSubmit={() => Promise.resolve()}
            onCancel={() => {
              setShowViewGRNDialog(false);
              setSelectedGRN(null);
            }}
            readOnly={true}
            mode="view"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}