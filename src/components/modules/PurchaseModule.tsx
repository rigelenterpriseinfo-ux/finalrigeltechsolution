import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, Truck, ShoppingCart, Building2, Package, AlertCircle, FileText, CreditCard } from 'lucide-react';
import { EnhancedSupplierForm } from '@/components/forms/EnhancedSupplierForm';
import { SupplierTable } from '@/components/tables/SupplierTable';
import { PurchaseOrderForm } from '@/components/forms/PurchaseOrderForm';
import { PurchaseOrderTable } from '@/components/tables/PurchaseOrderTable';
import { GRNForm } from '@/components/forms/GRNForm';
import { GRNTable } from '@/components/tables/GRNTable';
import { DebitNoteForm } from '@/components/forms/DebitNoteForm';
import { DebitNoteTable } from '@/components/tables/DebitNoteTable';
import { SupplierCreditNoteForm } from '@/components/forms/SupplierCreditNoteForm';
import { SupplierCreditNoteTable } from '@/components/tables/SupplierCreditNoteTable';
import { PurchaseOrderDetailsDialog } from '@/components/dialogs/PurchaseOrderDetailsDialog';
import { DebitNoteViewDialog } from '@/components/dialogs/DebitNoteViewDialog';
import { SupplierCreditNoteViewDialog } from '@/components/dialogs/SupplierCreditNoteViewDialog';
import { StatsCard } from '@/components/ui/stats-card';
import { APDashboardWidget } from '@/components/dashboard/APDashboardWidget';
import { APARFilterProvider, useAPARFilters } from '@/contexts/APARFilterContext';

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
  return (
    <APARFilterProvider>
      <PurchaseModuleContent />
    </APARFilterProvider>
  );
}

function PurchaseModuleContent() {
  const { user, profile } = useAuth();
  const { hasEditAccess } = useBusinessAuth();
  const { toast } = useToast();
  const { apFilters, setAPFilters, clearAPFilters } = useAPARFilters();
  const canEdit = hasEditAccess('purchases');
  
  // State management
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [grns, setGRNs] = useState<any[]>([]);
      // Remove unused state variables since data fetching moved to DebitNoteTable
      const [debitNotes, setDebitNotes] = useState<any[]>([]);
  const [supplierCreditNotes, setSupplierCreditNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Stats state
  const [stats, setStats] = useState({
    openPOs: { count: 0, value: 0 },
    recentGRNs: { count: 0, value: 0 },
    overduePOs: { count: 0, value: 0, details: [] as any[] }
  });
  
  // Dialog states
  const [showAddSupplierDialog, setShowAddSupplierDialog] = useState(false);
  const [showEditSupplierDialog, setShowEditSupplierDialog] = useState(false);
  const [showViewSupplierDialog, setShowViewSupplierDialog] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [showAddPODialog, setShowAddPODialog] = useState(false);
  const [showEditPODialog, setShowEditPODialog] = useState(false);
  const [showViewPODialog, setShowViewPODialog] = useState(false);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [showAddGRNDialog, setShowAddGRNDialog] = useState(false);
  const [showEditGRNDialog, setShowEditGRNDialog] = useState(false);
  const [showViewGRNDialog, setShowViewGRNDialog] = useState(false);
  const [selectedGRN, setSelectedGRN] = useState<any>(null);
  const [refreshGRNTrigger, setRefreshGRNTrigger] = useState(0);
  
  // Debit Note dialog states
  const [showAddDebitNoteDialog, setShowAddDebitNoteDialog] = useState(false);
  const [showEditDebitNoteDialog, setShowEditDebitNoteDialog] = useState(false);
  const [showViewDebitNoteDialog, setShowViewDebitNoteDialog] = useState(false);
  const [selectedDebitNote, setSelectedDebitNote] = useState<any>(null);
  const [refreshDebitNoteTrigger, setRefreshDebitNoteTrigger] = useState(0);
  
  // Supplier Credit Note dialog states
  const [showAddSupplierCreditNoteDialog, setShowAddSupplierCreditNoteDialog] = useState(false);
  const [showEditSupplierCreditNoteDialog, setShowEditSupplierCreditNoteDialog] = useState(false);
  const [showViewSupplierCreditNoteDialog, setShowViewSupplierCreditNoteDialog] = useState(false);
  const [selectedSupplierCreditNote, setSelectedSupplierCreditNote] = useState<any>(null);

  // Fetch data
  useEffect(() => {
    if (profile?.company_id) {
      fetchSuppliers();
      fetchPurchaseOrders();
      fetchSupplierCreditNotes();
      fetchStats();
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
    }
  };

  const fetchPurchaseOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          supplier:suppliers(name),
          purchase_order_items:purchase_order_items(*)
        `)
        .eq('company_id', profile?.company_id)
        .order('order_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPurchaseOrders(data || []);
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
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
      toast({
        title: "Error",
        description: "Failed to fetch GRNs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!profile?.company_id) return;

    try {
      // Fetch open PO stats
      const { data: openPOs, error: openPOError } = await supabase
        .from('purchase_orders')
        .select('total_amount')
        .eq('company_id', profile.company_id)
        .in('status', ['draft', 'open', 'partially_received']);

      if (openPOError) throw openPOError;

      const openPOStats = {
        count: openPOs?.length || 0,
        value: openPOs?.reduce((sum, po) => sum + (po.total_amount || 0), 0) || 0
      };

      // Fetch recent GRN stats (last 15 days)
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
      
      const { data: recentGRNs, error: grnError } = await supabase
        .from('grn_header')
        .select('total_amount')
        .eq('company_id', profile.company_id)
        .gte('created_at', fifteenDaysAgo.toISOString());

      if (grnError) throw grnError;

      const recentGRNStats = {
        count: recentGRNs?.length || 0,
        value: recentGRNs?.reduce((sum, grn) => sum + (grn.total_amount || 0), 0) || 0
      };

      // Fetch overdue POs
      const today = new Date().toISOString().split('T')[0];
      const { data: overduePOs, error: overdueError } = await supabase
        .from('purchase_orders')
        .select(`
          po_number,
          total_amount,
          expected_date,
          supplier:suppliers(name)
        `)
        .eq('company_id', profile.company_id)
        .lt('expected_date', today)
        .neq('status', 'closed');

      if (overdueError) throw overdueError;

      const overduePOStats = {
        count: overduePOs?.length || 0,
        value: overduePOs?.reduce((sum, po) => sum + (po.total_amount || 0), 0) || 0,
        details: overduePOs || []
      };

      setStats({
        openPOs: openPOStats,
        recentGRNs: recentGRNStats,
        overduePOs: overduePOStats
      });

    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchSupplierCreditNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('supplier_credit_notes')
        .select('*')
        .eq('company_id', profile?.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSupplierCreditNotes(data || []);
    } catch (error) {
      console.error('Error fetching supplier credit notes:', error);
    }
  };

  // Supplier handlers
  const handleAddSupplier = async (supplierData: any) => {
    try {
      const { error } = await supabase
        .from('suppliers')
        .insert({
          ...supplierData,
          company_id: profile?.company_id
        });

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

  const handleEditSupplier = async (supplierData: any) => {
    if (!selectedSupplier) return;

    try {
      const { error } = await supabase
        .from('suppliers')
        .update(supplierData)
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
    if (!confirm('Are you sure you want to delete this supplier?')) return;

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

  // Debit Note handlers
  const handleDeleteDebitNote = async (debitNoteId: string) => {
    if (!confirm('Are you sure you want to delete this debit note?')) return;

    try {
      const { error } = await supabase
        .from('debit_notes')
        .delete()
        .eq('id', debitNoteId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Debit note deleted successfully",
      });

      // Trigger refresh of the DebitNoteTable
      setRefreshDebitNoteTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error deleting debit note:', error);
      toast({
        title: "Error",
        description: "Failed to delete debit note",
        variant: "destructive",
      });
    }
  };

  // Purchase Order handlers
  const handleAddPurchaseOrder = async (poData: any) => {
    try {
      const { items, ...purchaseOrderData } = poData;
      
      if (!purchaseOrderData.po_number) {
        const { data: poNumber, error: poNumberError } = await supabase
          .rpc('generate_po_number', { comp_id: profile?.company_id });
        
        if (poNumberError) throw poNumberError;
        purchaseOrderData.po_number = poNumber;
      }

      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          ...purchaseOrderData,
          company_id: profile?.company_id,
          created_by: profile?.id,
        })
        .select()
        .single();

      if (poError) throw poError;

      if (items && items.length > 0) {
        const { error: itemsError } = await supabase
          .from('purchase_order_items')
          .insert(
            items.map((item: any) => ({
              ...item,
              purchase_order_id: po.id,
            }))
          );

        if (itemsError) throw itemsError;
      }

      toast({
        title: "Success",
        description: "Purchase order created successfully",
      });

      setShowAddPODialog(false);
      fetchPurchaseOrders();
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
    if (!selectedPO) return;

    try {
      const { items, ...purchaseOrderData } = poData;
      
      const { error: poError } = await supabase
        .from('purchase_orders')
        .update(purchaseOrderData)
        .eq('id', selectedPO.id);

      if (poError) throw poError;

      if (items && items.length > 0) {
        const { error: deleteError } = await supabase
          .from('purchase_order_items')
          .delete()
          .eq('purchase_order_id', selectedPO.id);

        if (deleteError) throw deleteError;

        const { error: itemsError } = await supabase
          .from('purchase_order_items')
          .insert(
            items.map((item: any) => ({
              ...item,
              purchase_order_id: selectedPO.id,
            }))
          );

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
    if (!confirm('Are you sure you want to delete this purchase order?')) return;

    try {
      const { error } = await supabase
        .from('purchase_orders')
        .delete()
        .eq('id', poId);

      if (error) throw error;

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

  return (
    <div className="space-y-6">
      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard
          title="Open Purchase Orders"
          value={stats.openPOs.count}
          subtitle={`₹${stats.openPOs.value.toLocaleString()}`}
          icon={ShoppingCart}
          variant="primary"
        />
        
        <StatsCard
          title="Recent GRNs (15 days)"
          value={stats.recentGRNs.count}
          subtitle={`₹${stats.recentGRNs.value.toLocaleString()}`}
          icon={Package}
          variant="secondary"
        />
        
        <StatsCard
          title="Overdue Purchase Orders"
          value={stats.overduePOs.count}
          subtitle={stats.overduePOs.details.length > 0 
            ? `${stats.overduePOs.details.slice(0, 2).map((po: any) => `${po.po_number}`).join(', ')}${stats.overduePOs.details.length > 2 ? '...' : ''}`
            : `₹${stats.overduePOs.value.toLocaleString()}`
          }
          icon={AlertCircle}
          variant="secondary"
        />
      </div>

      <Tabs defaultValue="suppliers" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="purchase-orders">Purchase Orders</TabsTrigger>
          <TabsTrigger value="grn">Goods Receipt Notes</TabsTrigger>
          <TabsTrigger value="debit-notes">Debit Notes</TabsTrigger>
          <TabsTrigger value="supplier-credit-notes">Supplier Credit Notes</TabsTrigger>
        </TabsList>

        {/* Suppliers Tab */}
        <TabsContent value="suppliers" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Supplier Management</h3>
            {canEdit && (
              <Button onClick={() => setShowAddSupplierDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Supplier
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="p-6">
              <SupplierTable
                suppliers={suppliers}
                onView={(supplier) => {
                  setSelectedSupplier(supplier);
                  setShowViewSupplierDialog(true);
                }}
                onEdit={canEdit ? (supplier) => {
                  setSelectedSupplier(supplier);
                  setShowEditSupplierDialog(true);
                } : undefined}
                onCreate={() => setShowAddSupplierDialog(true)}
                onDelete={canEdit ? async (supplierId) => {
                  handleDeleteSupplier(supplierId);
                } : undefined}
                loading={loading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Purchase Orders Tab */}
        <TabsContent value="purchase-orders" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Purchase Order Management</h3>
            {canEdit && (
              <Button onClick={() => setShowAddPODialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Purchase Order
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="p-6">
              <PurchaseOrderTable
                purchaseOrders={purchaseOrders}
                onView={(po) => {
                  setSelectedPO(po);
                  setShowViewPODialog(true);
                }}
                onEdit={canEdit ? (po) => {
                  setSelectedPO(po);
                  setShowEditPODialog(true);
                } : undefined}
                onDelete={canEdit ? handleDeletePurchaseOrder : undefined}
                loading={loading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* GRN Tab */}
        <TabsContent value="grn" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Goods Receipt Notes</h3>
            {canEdit && (
              <Button onClick={() => setShowAddGRNDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create GRN
              </Button>
            )}
          </div>
          <Card>
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

        {/* Debit Notes Tab */}
        <TabsContent value="debit-notes" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Debit Notes</h3>
            {canEdit && (
              <Button onClick={() => setShowAddDebitNoteDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Debit Note
              </Button>
            )}
          </div>
          
          
          <Card>
            <CardContent className="p-6">
              <DebitNoteTable
                refreshTrigger={refreshDebitNoteTrigger}
                onFiltersChange={(filters) => {
                  setAPFilters({
                    searchTerm: filters.searchTerm,
                    statusFilter: filters.statusFilter
                  });
                }}
                onView={(debitNote) => {
                  setSelectedDebitNote(debitNote);
                  setShowViewDebitNoteDialog(true);
                }}
                onEdit={(debitNote) => {
                  setSelectedDebitNote(debitNote);
                  setShowEditDebitNoteDialog(true);
                }}
                onDelete={handleDeleteDebitNote}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Supplier Credit Notes Tab */}
        <TabsContent value="supplier-credit-notes" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Supplier Credit Notes</h3>
            {canEdit && (
              <Button onClick={() => setShowAddSupplierCreditNoteDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Credit Note
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="p-6">
              <SupplierCreditNoteTable
                supplierCreditNotes={supplierCreditNotes}
                onView={(creditNote) => {
                  setSelectedSupplierCreditNote(creditNote);
                  setShowViewSupplierCreditNoteDialog(true);
                }}
                onEdit={(creditNote) => {
                  setSelectedSupplierCreditNote(creditNote);
                  setShowEditSupplierCreditNoteDialog(true);
                }}
                onDelete={async (creditNote) => {
                  if (!confirm('Are you sure you want to delete this credit note?')) return;
                  try {
                    const { error } = await supabase.from('supplier_credit_notes').delete().eq('id', creditNote.id);
                    if (error) throw error;
                    toast({ title: "Success", description: "Credit note deleted successfully" });
                    fetchSupplierCreditNotes();
                  } catch (error) {
                    console.error('Error deleting credit note:', error);
                    toast({ title: "Error", description: "Failed to delete credit note", variant: "destructive" });
                  }
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Debit Note Dialog */}
      <Dialog open={showAddDebitNoteDialog} onOpenChange={setShowAddDebitNoteDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Debit Note</DialogTitle>
          </DialogHeader>
          <DebitNoteForm
            onSubmit={async (data) => {
              try {
                const { items, ...debitNoteData } = data;
                
                // Add required fields
                const completeDebitNoteData = {
                  ...debitNoteData,
                  company_id: profile?.company_id,
                  created_by: profile?.id,
                  status: 'draft'
                };

                const { data: debitNote, error } = await supabase
                  .from('debit_notes')
                  .insert(completeDebitNoteData)
                  .select()
                  .single();

                if (error) throw error;

                if (items?.length > 0) {
                  const { error: itemsError } = await supabase
                    .from('debit_note_items')
                    .insert(items.map((item: any) => ({
                      ...item,
                      debit_note_id: debitNote.id
                    })));
                  if (itemsError) throw itemsError;
                }

                toast({ 
                  title: "Success", 
                  description: `Debit note created successfully. DN Number: ${debitNote.debit_note_number}` 
                });
                setShowAddDebitNoteDialog(false);
                // Trigger refresh of the DebitNoteTable
                setRefreshDebitNoteTrigger(prev => prev + 1);
              } catch (error) {
                console.error('Error creating debit note:', error);
                toast({ title: "Error", description: "Failed to create debit note", variant: "destructive" });
              }
            }}
            onCancel={() => setShowAddDebitNoteDialog(false)}
            mode="add"
          />
        </DialogContent>
      </Dialog>

      {/* Edit Debit Note Dialog */}
      <Dialog open={showEditDebitNoteDialog} onOpenChange={setShowEditDebitNoteDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Debit Note</DialogTitle>
          </DialogHeader>
          <DebitNoteForm
            debitNote={selectedDebitNote}
            onSubmit={async (data) => {
              try {
                const { items, ...header } = data;
                const { error: updateError } = await supabase
                  .from('debit_notes')
                  .update(header)
                  .eq('id', selectedDebitNote.id);
                if (updateError) throw updateError;

                // Replace items
                const { error: deleteError } = await supabase
                  .from('debit_note_items')
                  .delete()
                  .eq('debit_note_id', selectedDebitNote.id);
                if (deleteError) throw deleteError;

                if (items && items.length > 0) {
                  const { error: insertError } = await supabase
                    .from('debit_note_items')
                    .insert(items.map((it: any) => ({
                      ...it,
                      debit_note_id: selectedDebitNote.id,
                    })));
                  if (insertError) throw insertError;
                }

                toast({ title: "Success", description: "Debit note updated successfully" });
                setShowEditDebitNoteDialog(false);
                setSelectedDebitNote(null);
                setRefreshDebitNoteTrigger(prev => prev + 1);
              } catch (error) {
                console.error('Error updating debit note:', error);
                toast({ title: "Error", description: "Failed to update debit note", variant: "destructive" });
              }
            }}
            onCancel={() => {
              setShowEditDebitNoteDialog(false);
              setSelectedDebitNote(null);
            }}
            mode="edit"
          />
        </DialogContent>
      </Dialog>

      {/* Add Supplier Credit Note Dialog */}
      <Dialog open={showAddSupplierCreditNoteDialog} onOpenChange={setShowAddSupplierCreditNoteDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Supplier Credit Note</DialogTitle>
          </DialogHeader>
          <SupplierCreditNoteForm
            onSubmit={async (data) => {
              try {
                const { items, ...creditNoteData } = data;
                const { data: creditNote, error } = await supabase
                  .from('supplier_credit_notes')
                  .insert({
                    ...creditNoteData,
                    company_id: profile?.company_id,
                    created_by: profile?.id
                  })
                  .select()
                  .single();

                if (error) throw error;

                if (items?.length > 0) {
                  const { error: itemsError } = await supabase
                    .from('supplier_credit_note_items')
                    .insert(items.map((item: any) => ({
                      ...item,
                      supplier_credit_note_id: creditNote.id
                    })));
                  if (itemsError) throw itemsError;
                }

                toast({ title: "Success", description: "Credit note added successfully" });
                setShowAddSupplierCreditNoteDialog(false);
                fetchSupplierCreditNotes();
              } catch (error) {
                console.error('Error adding credit note:', error);
                toast({ title: "Error", description: "Failed to add credit note", variant: "destructive" });
              }
            }}
            onCancel={() => setShowAddSupplierCreditNoteDialog(false)}
            mode="add"
          />
        </DialogContent>
      </Dialog>

      {/* View Dialogs */}
      <DebitNoteViewDialog
        debitNote={selectedDebitNote}
        open={showViewDebitNoteDialog}
        onOpenChange={setShowViewDebitNoteDialog}
      />
      
      <SupplierCreditNoteViewDialog
        supplierCreditNote={selectedSupplierCreditNote}
        open={showViewSupplierCreditNoteDialog}
        onOpenChange={setShowViewSupplierCreditNoteDialog}
      />

      {/* Add Supplier Dialog */}
      <Dialog open={showAddSupplierDialog} onOpenChange={setShowAddSupplierDialog}>
        <DialogContent className="sm:max-w-[80%] md:max-w-[70%] lg:max-w-[60%] xl:max-w-[50%] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Supplier</DialogTitle>
          </DialogHeader>
          <EnhancedSupplierForm
            onSubmit={handleAddSupplier}
            onCancel={() => setShowAddSupplierDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Supplier Dialog */}
      <Dialog open={showEditSupplierDialog} onOpenChange={setShowEditSupplierDialog}>
        <DialogContent className="sm:max-w-[80%] md:max-w-[70%] lg:max-w-[60%] xl:max-w-[50%] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Supplier</DialogTitle>
          </DialogHeader>
          <EnhancedSupplierForm
            supplier={selectedSupplier}
            onSubmit={handleEditSupplier}
            onCancel={() => {
              setShowEditSupplierDialog(false);
              setSelectedSupplier(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Add Purchase Order Dialog */}
      <Dialog open={showAddPODialog} onOpenChange={setShowAddPODialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Purchase Order</DialogTitle>
          </DialogHeader>
          <PurchaseOrderForm
            onSubmit={handleAddPurchaseOrder}
            onCancel={() => setShowAddPODialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Purchase Order Dialog */}
      <Dialog open={showEditPODialog} onOpenChange={setShowEditPODialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Purchase Order</DialogTitle>
          </DialogHeader>
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

      {/* Add GRN Dialog */}
      <Dialog open={showAddGRNDialog} onOpenChange={setShowAddGRNDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create GRN</DialogTitle>
          </DialogHeader>
          <GRNForm
            onSubmit={async (data) => {
              try {
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
                    supplier_invoice_date: data.supplier_invoice_date || null,
                    remarks: data.remarks,
                    status: data.status === 'received' ? 'accepted' : data.status,
                    total_ordered_quantity: totals.totalOrderedQty,
                    total_received_quantity: totals.totalReceivedQty,
                    total_accepted_quantity: totals.totalAcceptedQty,
                    total_rejected_quantity: totals.totalRejectedQty,
                    subtotal_amount: totals.subtotalAmount,
                    total_discount_amount: totals.totalDiscountAmount,
                    total_tax_amount: totals.totalTaxAmount,
                    total_amount: totals.totalAmount,
                    created_by: profile?.id,
                    grn_number: ''
                  } as any)
                  .select()
                  .single();

                if (error) throw error;

                if (data.items?.length > 0) {
                  const itemsToInsert = data.items.map((item) => ({
                    grn_header_id: grn.id,
                    product_id: item.product_id,
                    product_name: item.product_name,
                    ordered_quantity: item.ordered_quantity || 0,
                    received_quantity: item.received_quantity || 0,
                    accepted_quantity: item.accepted_quantity || 0,
                    rejected_quantity: item.rejected_quantity || 0,
                    unit_price: item.unit_price || 0,
                    discount_percentage: item.discount_percentage || 0,
                    discount_amount: item.discount_amount || 0,
                    cgst_rate: item.cgst_rate || 0,
                    cgst_amount: item.cgst_amount || 0,
                    sgst_rate: item.sgst_rate || 0,
                    sgst_amount: item.sgst_amount || 0,
                    igst_rate: item.igst_rate || 0,
                    igst_amount: item.igst_amount || 0,
                    total_tax_amount: item.total_tax_amount || 0,
                    line_total: item.line_total || 0,
                    warehouse_id: item.warehouse_id,
                    bin_id: item.bin_id,
                    remarks: item.remarks || null,
                  }));

                  const { error: itemsError } = await supabase
                    .from('grn_line_items')
                    .insert(itemsToInsert);

                  if (itemsError) throw itemsError;
                }

                toast({
                  title: "Success",
                  description: "GRN created successfully",
                });

                setShowAddGRNDialog(false);
                setRefreshGRNTrigger(prev => prev + 1);
                fetchPurchaseOrders();
              } catch (error) {
                console.error('Error creating GRN:', error);
                toast({
                  title: "Error",
                  description: "Failed to create GRN",
                  variant: "destructive",
                });
              }
            }}
            onCancel={() => setShowAddGRNDialog(false)}
            mode="create"
          />
        </DialogContent>
      </Dialog>

      {/* Edit GRN Dialog */}
      <Dialog open={showEditGRNDialog} onOpenChange={setShowEditGRNDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit GRN</DialogTitle>
          </DialogHeader>
          <GRNForm
            grn={selectedGRN}
            onSubmit={async (data) => {
              try {
                const { error } = await supabase
                  .from('grn_header')
                  .update(data)
                  .eq('id', selectedGRN.id);

                if (error) throw error;

                toast({
                  title: "Success",
                  description: "GRN updated successfully",
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
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>GRN Details</DialogTitle>
          </DialogHeader>
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

      {/* Purchase Order Details Dialog */}
      <PurchaseOrderDetailsDialog
        purchaseOrder={selectedPO}
        open={showViewPODialog}
        onOpenChange={setShowViewPODialog}
      />
    </div>
  );
}

export default PurchaseModule;