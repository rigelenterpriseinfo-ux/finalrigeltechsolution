import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Truck, 
  ShoppingCart, 
  Building2, 
  Package, 
  AlertCircle, 
  FileText, 
  CreditCard,
  TrendingUp,
  Users,
  DollarSign,
  Clock,
  Receipt,
  FileSpreadsheet
} from 'lucide-react';
import { SupplierForm } from '@/components/forms/SupplierForm';
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

export function EnhancedPurchaseModule() {
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
  const [debitNotes, setDebitNotes] = useState<any[]>([]);
  const [supplierCreditNotes, setSupplierCreditNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Enhanced Stats state
  const [dashboardStats, setDashboardStats] = useState({
    suppliers: { total: 0, active: 0, newThisMonth: 0 },
    purchaseOrders: { open: 0, totalValue: 0, overdue: 0 },
    grns: { recent: 0, totalReceived: 0, pending: 0 },
    debitNotes: { total: 0, thisMonth: 0, totalAmount: 0 },
    creditNotes: { total: 0, pending: 0, totalAmount: 0 }
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
  const [showAddDebitNoteDialog, setShowAddDebitNoteDialog] = useState(false);
  const [showEditDebitNoteDialog, setShowEditDebitNoteDialog] = useState(false);
  const [showViewDebitNoteDialog, setShowViewDebitNoteDialog] = useState(false);
  const [selectedDebitNote, setSelectedDebitNote] = useState<any>(null);
  const [refreshDebitNoteTrigger, setRefreshDebitNoteTrigger] = useState(0);
  const [showAddSupplierCreditNoteDialog, setShowAddSupplierCreditNoteDialog] = useState(false);
  const [showEditSupplierCreditNoteDialog, setShowEditSupplierCreditNoteDialog] = useState(false);
  const [showViewSupplierCreditNoteDialog, setShowViewSupplierCreditNoteDialog] = useState(false);
  const [selectedSupplierCreditNote, setSelectedSupplierCreditNote] = useState<any>(null);
  const [supplierCreditNoteRefreshTrigger, setSupplierCreditNoteRefreshTrigger] = useState(0);

  // Fetch enhanced stats
  const fetchEnhancedStats = async () => {
    if (!profile?.company_id) return;
    
    try {
      // Suppliers stats
      const { data: suppliersData } = await supabase
        .from('suppliers')
        .select('id, is_active, created_at')
        .eq('company_id', profile.company_id);
      
      const totalSuppliers = suppliersData?.length || 0;
      const activeSuppliers = suppliersData?.filter(s => s.is_active).length || 0;
      const thisMonth = new Date();
      thisMonth.setDate(1);
      const newThisMonth = suppliersData?.filter(s => new Date(s.created_at) >= thisMonth).length || 0;
      
      // Purchase Orders stats
      const { data: poData } = await supabase
        .from('purchase_orders')
        .select('id, status, total_amount, expected_date')
        .eq('company_id', profile.company_id);
      
      const openPOs = poData?.filter(po => po.status === 'open').length || 0;
      const totalPOValue = poData?.filter(po => po.status !== 'cancelled')
        .reduce((sum, po) => sum + (po.total_amount || 0), 0) || 0;
      const today = new Date();
      const overduePOs = poData?.filter(po => 
        po.status === 'open' && po.expected_date && new Date(po.expected_date) < today
      ).length || 0;
      
      // GRNs stats
      const { data: grnData } = await supabase
        .from('grn_header')
        .select('id, status, created_at, total_accepted_quantity, total_received_quantity')
        .eq('company_id', profile.company_id);
      
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentGRNs = grnData?.filter(grn => new Date(grn.created_at) >= sevenDaysAgo).length || 0;
      const totalReceived = grnData?.reduce((sum, grn) => sum + (grn.total_received_quantity || 0), 0) || 0;
      const pendingGRNs = grnData?.filter(grn => grn.status === 'draft').length || 0;
      
      // Debit Notes stats
      const { data: debitData } = await supabase
        .from('debit_notes')
        .select('id, total_amount, created_at')
        .eq('company_id', profile.company_id);
      
      const totalDebitNotes = debitData?.length || 0;
      const debitThisMonth = debitData?.filter(dn => new Date(dn.created_at) >= thisMonth).length || 0;
      const totalDebitAmount = debitData?.reduce((sum, dn) => sum + (dn.total_amount || 0), 0) || 0;
      
      // Credit Notes stats
      const { data: creditData } = await supabase
        .from('supplier_credit_notes')
        .select('id, total_amount, status')
        .eq('company_id', profile.company_id);
      
      const totalCreditNotes = creditData?.length || 0;
      const pendingCreditNotes = creditData?.filter(cn => cn.status === 'received').length || 0;
      const totalCreditAmount = creditData?.reduce((sum, cn) => sum + (cn.total_amount || 0), 0) || 0;
      
      setDashboardStats({
        suppliers: { total: totalSuppliers, active: activeSuppliers, newThisMonth },
        purchaseOrders: { open: openPOs, totalValue: totalPOValue, overdue: overduePOs },
        grns: { recent: recentGRNs, totalReceived, pending: pendingGRNs },
        debitNotes: { total: totalDebitNotes, thisMonth: debitThisMonth, totalAmount: totalDebitAmount },
        creditNotes: { total: totalCreditNotes, pending: pendingCreditNotes, totalAmount: totalCreditAmount }
      });
      
    } catch (error) {
      console.error('Error fetching enhanced stats:', error);
    }
  };

  // Fetch data functions (keep existing implementations)
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

  // Load data and stats
  useEffect(() => {
    if (profile?.company_id) {
      fetchSuppliers();
      fetchEnhancedStats();
    }
  }, [profile?.company_id]);

  return (
    <div className="space-y-6">
      {/* Enhanced Stats Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-6 w-6" />
            Purchase Management Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
              <TabsTrigger value="orders">Orders</TabsTrigger>
              <TabsTrigger value="grn">GRN</TabsTrigger>
              <TabsTrigger value="debits">Debits</TabsTrigger>
              <TabsTrigger value="credits">Credits</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatsCard
                  title="Active Suppliers"
                  value={dashboardStats.suppliers.active}
                  subtitle={`${dashboardStats.suppliers.total} total`}
                  icon={Users}
                  variant="default"
                />
                <StatsCard
                  title="Open POs"
                  value={dashboardStats.purchaseOrders.open}
                  subtitle="Pending orders"
                  icon={ShoppingCart}
                  variant="secondary"
                />
                <StatsCard
                  title="Recent GRNs"
                  value={dashboardStats.grns.recent}
                  subtitle="Last 7 days"
                  icon={Receipt}
                  variant="default"
                />
                <StatsCard
                  title="Overdue POs"
                  value={dashboardStats.purchaseOrders.overdue}
                  subtitle="Need attention"
                  icon={AlertCircle}
                  variant="secondary"
                />
              </div>
            </TabsContent>
            
            <TabsContent value="suppliers" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatsCard
                  title="Total Suppliers"
                  value={dashboardStats.suppliers.total}
                  subtitle="All suppliers"
                  icon={Users}
                  variant="default"
                />
                <StatsCard
                  title="Active Suppliers"
                  value={dashboardStats.suppliers.active}
                  subtitle="Currently active"
                  icon={Building2}
                  variant="primary"
                />
                <StatsCard
                  title="New This Month"
                  value={dashboardStats.suppliers.newThisMonth}
                  subtitle="Recently added"
                  icon={TrendingUp}
                  variant="accent"
                />
              </div>
            </TabsContent>
            
            <TabsContent value="orders" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatsCard
                  title="Open POs"
                  value={dashboardStats.purchaseOrders.open}
                  subtitle="Pending orders"
                  icon={ShoppingCart}
                  variant="default"
                />
                <StatsCard
                  title="Total Value"
                  value={`₹${dashboardStats.purchaseOrders.totalValue.toLocaleString()}`}
                  subtitle="All orders"
                  icon={DollarSign}
                  variant="primary"
                />
                <StatsCard
                  title="Overdue POs"
                  value={dashboardStats.purchaseOrders.overdue}
                  subtitle="Need attention"
                  icon={AlertCircle}
                  variant="secondary"
                />
              </div>
            </TabsContent>
            
            <TabsContent value="grn" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatsCard
                  title="Recent GRNs"
                  value={dashboardStats.grns.recent}
                  subtitle="Last 7 days"
                  icon={Receipt}
                  variant="default"
                />
                <StatsCard
                  title="Total Received"
                  value={dashboardStats.grns.totalReceived}
                  subtitle="Quantity received"
                  icon={Package}
                  variant="primary"
                />
                <StatsCard
                  title="Pending GRNs"
                  value={dashboardStats.grns.pending}
                  subtitle="In draft"
                  icon={Clock}
                  variant="secondary"
                />
              </div>
            </TabsContent>
            
            <TabsContent value="debits" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatsCard
                  title="Total Notes"
                  value={dashboardStats.debitNotes.total}
                  subtitle="All debit notes"
                  icon={FileText}
                  variant="default"
                />
                <StatsCard
                  title="This Month"
                  value={dashboardStats.debitNotes.thisMonth}
                  subtitle="New this month"
                  icon={TrendingUp}
                  variant="primary"
                />
                <StatsCard
                  title="Total Amount"
                  value={`₹${dashboardStats.debitNotes.totalAmount.toLocaleString()}`}
                  subtitle="Total value"
                  icon={DollarSign}
                  variant="accent"
                />
              </div>
            </TabsContent>
            
            <TabsContent value="credits" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatsCard
                  title="Total Credits"
                  value={dashboardStats.creditNotes.total}
                  subtitle="All credit notes"
                  icon={CreditCard}
                  variant="default"
                />
                <StatsCard
                  title="Pending"
                  value={dashboardStats.creditNotes.pending}
                  subtitle="Awaiting processing"
                  icon={Clock}
                  variant="secondary"
                />
                <StatsCard
                  title="Total Amount"
                  value={`₹${dashboardStats.creditNotes.totalAmount.toLocaleString()}`}
                  subtitle="Total value"
                  icon={DollarSign}
                  variant="primary"
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      {/* Purchase Management Tabs */}
      <Tabs defaultValue="suppliers" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="purchase-orders">Purchase Orders</TabsTrigger>
          <TabsTrigger value="grn">GRN</TabsTrigger>
          <TabsTrigger value="debit-notes">Debit Notes</TabsTrigger>
          <TabsTrigger value="supplier-credit-notes">Credit Notes</TabsTrigger>
        </TabsList>
        
        <TabsContent value="suppliers" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Suppliers</h2>
            {canEdit && (
              <Button onClick={() => setShowAddSupplierDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Supplier
              </Button>
            )}
          </div>
          <SupplierTable
            suppliers={suppliers}
            onView={(supplier) => {
              setSelectedSupplier(supplier);
              setShowViewSupplierDialog(true);
            }}
            onEdit={(supplier) => {
              setSelectedSupplier(supplier);
              setShowEditSupplierDialog(true);
            }}
            onDelete={async (id) => {
              try {
                const { error } = await supabase
                  .from('suppliers')
                  .delete()
                  .eq('id', id);

                if (error) throw error;

                toast({
                  title: "Success",
                  description: "Supplier deleted successfully",
                });
                fetchSuppliers();
                fetchEnhancedStats();
              } catch (error) {
                console.error('Error deleting supplier:', error);
                toast({
                  title: "Error",
                  description: "Failed to delete supplier",
                  variant: "destructive",
                });
              }
            }}
            onCreate={() => setShowAddSupplierDialog(true)}
            loading={loading}
          />
        </TabsContent>
        
        {/* Other tabs remain similar to original implementation */}
        <TabsContent value="purchase-orders">
          <div className="text-center py-8">
            <h3 className="text-lg font-medium">Purchase Orders Module</h3>
            <p className="text-muted-foreground">Enhanced Purchase Orders management coming soon...</p>
          </div>
        </TabsContent>
        
        <TabsContent value="grn">
          <div className="text-center py-8">
            <h3 className="text-lg font-medium">GRN Module</h3>
            <p className="text-muted-foreground">Enhanced GRN management coming soon...</p>
          </div>
        </TabsContent>
        
        <TabsContent value="debit-notes">
          <div className="text-center py-8">
            <h3 className="text-lg font-medium">Debit Notes Module</h3>
            <p className="text-muted-foreground">Enhanced Debit Notes management coming soon...</p>
          </div>
        </TabsContent>
        
        <TabsContent value="supplier-credit-notes">
          <div className="text-center py-8">
            <h3 className="text-lg font-medium">Credit Notes Module</h3>
            <p className="text-muted-foresonColor">Enhanced Credit Notes management coming soon...</p>
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Dialogs */}
      <Dialog open={showAddSupplierDialog} onOpenChange={setShowAddSupplierDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Supplier</DialogTitle>
            <DialogDescription>
              Create a new supplier for your purchase operations.
            </DialogDescription>
          </DialogHeader>
          <SupplierForm
            onSubmit={async (data) => {
              try {
                const { error } = await supabase
                  .from('suppliers')
                  .insert({
                    ...data,
                    company_id: profile?.company_id,
                  });

                if (error) throw error;

                toast({
                  title: "Success",
                  description: "Supplier created successfully",
                });
                setShowAddSupplierDialog(false);
                fetchSuppliers();
                fetchEnhancedStats();
              } catch (error) {
                console.error('Error creating supplier:', error);
                toast({
                  title: "Error",
                  description: "Failed to create supplier",
                  variant: "destructive",
                });
              }
            }}
            onCancel={() => setShowAddSupplierDialog(false)}
            
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
