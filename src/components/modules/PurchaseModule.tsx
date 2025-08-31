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
import { Plus, Truck, ShoppingCart, Building2, Package, TrendingUp, AlertCircle, BarChart3 } from 'lucide-react';
import { SupplierForm } from '@/components/forms/SupplierForm';
import { SupplierTable } from '@/components/tables/SupplierTable';
import { PurchaseOrderForm } from '@/components/forms/PurchaseOrderForm';
import { PurchaseOrderTable } from '@/components/tables/PurchaseOrderTable';
import { GRNForm } from '@/components/forms/GRNForm';
import { GRNTable } from '@/components/tables/GRNTable';
import { StatsCard } from '@/components/ui/stats-card';

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
  const [grns, setGRNs] = useState<any[]>([]);
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

  // Fetch data
  useEffect(() => {
    if (profile?.company_id) {
      fetchSuppliers();
      fetchPurchaseOrders();
      fetchGRNs();
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
          supplier:suppliers(name)
        `)
        .eq('company_id', profile?.company_id)
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
        .in('status', ['draft', 'sent', 'partially_received']);

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

  // Purchase Order handlers
  const handleAddPurchaseOrder = async (poData: any) => {
    try {
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          ...poData,
          company_id: profile?.company_id,
          created_by: profile?.user_id,
        })
        .select()
        .single();

      if (poError) throw poError;

      if (poData.items && poData.items.length > 0) {
        const { error: itemsError } = await supabase
          .from('purchase_order_items')
          .insert(
            poData.items.map((item: any) => ({
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
      const { error: poError } = await supabase
        .from('purchase_orders')
        .update(poData)
        .eq('id', selectedPO.id);

      if (poError) throw poError;

      if (poData.items && poData.items.length > 0) {
        // Delete existing items
        const { error: deleteError } = await supabase
          .from('purchase_order_items')
          .delete()
          .eq('purchase_order_id', selectedPO.id);

        if (deleteError) throw deleteError;

        // Insert updated items
        const { error: itemsError } = await supabase
          .from('purchase_order_items')
          .insert(
            poData.items.map((item: any) => ({
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
      {/* Purchase Stats */}
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
            ? `${stats.overduePOs.details.slice(0, 2).map((po: any) => `${po.po_number} (${po.supplier?.name || 'Unknown'})`).join(', ')}${stats.overduePOs.details.length > 2 ? '...' : ''}`
            : `₹${stats.overduePOs.value.toLocaleString()}`
          }
          icon={AlertCircle}
          className="border-red-200 bg-gradient-to-br from-red-50 to-red-100"
        />
      </div>

      <Tabs defaultValue="suppliers" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="orders">Purchase Orders</TabsTrigger>
          <TabsTrigger value="grn">GRN Management</TabsTrigger>
        </TabsList>

        {/* Section 1: Supplier Management */}
        <TabsContent value="suppliers" className="space-y-6">
          <Card>
            <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-blue-100">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl text-blue-800">Supplier Management</CardTitle>
                  <CardDescription>Manage your supplier database</CardDescription>
                </div>
                <Dialog open={showAddSupplierDialog} onOpenChange={setShowAddSupplierDialog}>
                  <DialogTrigger asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700" disabled={!canEdit}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Supplier
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Add New Supplier</DialogTitle>
                      <DialogDescription>Enter supplier information below</DialogDescription>
                    </DialogHeader>
                    <SupplierForm
                      onSubmit={handleAddSupplier}
                      onCancel={() => setShowAddSupplierDialog(false)}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-6">
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
                onDelete={handleDeleteSupplier}
                onCreate={() => setShowAddSupplierDialog(true)}
                loading={loading}
              />
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
                 <Dialog open={showAddPODialog} onOpenChange={setShowAddPODialog}>
                   <DialogTrigger asChild>
                     <Button className="bg-green-600 hover:bg-green-700" disabled={!canEdit}>
                       <Plus className="h-4 w-4 mr-2" />
                       Create Purchase Order
                     </Button>
                   </DialogTrigger>
                   <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
                     <DialogHeader>
                       <DialogTitle>Create Purchase Order</DialogTitle>
                       <DialogDescription>Create a new purchase order</DialogDescription>
                     </DialogHeader>
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
                    <DialogHeader>
                      <DialogTitle>Create GRN</DialogTitle>
                      <DialogDescription>Record goods received against a purchase order</DialogDescription>
                    </DialogHeader>
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
      </Tabs>

      {/* Supplier Dialogs */}
      {/* Edit Supplier Dialog */}
      <Dialog open={showEditSupplierDialog} onOpenChange={setShowEditSupplierDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Supplier</DialogTitle>
            <DialogDescription>Update supplier information</DialogDescription>
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
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Supplier Details</DialogTitle>
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

      {/* Purchase Order Dialogs */}
      {/* Edit Purchase Order Dialog */}
      <Dialog open={showEditPODialog} onOpenChange={setShowEditPODialog}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Purchase Order</DialogTitle>
            <DialogDescription>Update purchase order details</DialogDescription>
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

      {/* View Purchase Order Dialog */}
      <Dialog open={showViewPODialog} onOpenChange={setShowViewPODialog}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Purchase Order Details</DialogTitle>
            <DialogDescription>View purchase order information</DialogDescription>
          </DialogHeader>
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
          <DialogHeader>
            <DialogTitle>Edit GRN</DialogTitle>
            <DialogDescription>Update received quantities and details</DialogDescription>
          </DialogHeader>
          <GRNForm
            grn={selectedGRN}
            onSubmit={async (grnData) => {
              try {
                // 1) Recalculate totals from line items
                const totals = (grnData.items || []).reduce(
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

                // 2) Update GRN header (exclude items array)
                const { error: headerError } = await supabase
                  .from('grn_header')
                  .update({
                    purchase_order_id: grnData.purchase_order_id,
                    supplier_id: grnData.supplier_id,
                    supplier_name: grnData.supplier_name,
                    grn_date: grnData.grn_date,
                    supplier_invoice_number: grnData.supplier_invoice_number,
                    supplier_invoice_date: grnData.supplier_invoice_date,
                    remarks: grnData.remarks,
                    status: grnData.status,
                    total_ordered_quantity: totals.totalOrderedQty,
                    total_received_quantity: totals.totalReceivedQty,
                    total_accepted_quantity: totals.totalAcceptedQty,
                    total_rejected_quantity: totals.totalRejectedQty,
                    subtotal_amount: totals.subtotalAmount,
                    total_discount_amount: totals.totalDiscountAmount,
                    total_tax_amount: totals.totalTaxAmount,
                    total_amount: totals.totalAmount,
                  } as any)
                  .eq('id', selectedGRN.id);

                if (headerError) throw headerError;

                // 3) Replace line items
                if (Array.isArray(grnData.items)) {
                  const { error: delErr } = await supabase
                    .from('grn_line_items')
                    .delete()
                    .eq('grn_header_id', selectedGRN.id);
                  if (delErr) throw delErr;

                  const itemsToInsert = grnData.items.map((item: any) => ({
                    grn_header_id: selectedGRN.id,
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

                  if (itemsToInsert.length > 0) {
                    const { error: insErr } = await supabase
                      .from('grn_line_items')
                      .insert(itemsToInsert);
                    if (insErr) throw insErr;
                  }
                }
                
                toast({ title: 'Success', description: 'GRN updated successfully' });
                setShowEditGRNDialog(false);
                setSelectedGRN(null);
                setRefreshGRNTrigger(prev => prev + 1);
              } catch (error) {
                console.error('Error updating GRN:', error);
                toast({ title: 'Error', description: 'Failed to update GRN', variant: 'destructive' });
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
          <DialogHeader>
            <DialogTitle>GRN Details</DialogTitle>
            <DialogDescription>Review received goods information</DialogDescription>
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
    </div>
  );
}

export default PurchaseModule;