import React, { useState, useEffect } from 'react';
import { Plus, Package, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import BackorderTable from '@/components/tables/BackorderTable';
import ProcessBackorderDialog from '@/components/dialogs/ProcessBackorderDialog';
import BackorderForm from '@/components/forms/BackorderForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface BackorderSummary {
  customer_id: string;
  customer_name: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  total_backordered: number;
  current_stock: number;
  ready_to_deliver: number;
  available_to_process: number;
  avg_unit_price: number;
  oldest_backorder_date: string;
}

interface BackorderStats {
  total_backorders: number;
  total_value: number;
  available_to_process: number;
  processable_value: number;
}

export default function BackorderModule() {
  const [backorders, setBackorders] = useState<BackorderSummary[]>([]);
  const [stats, setStats] = useState<BackorderStats>({
    total_backorders: 0,
    total_value: 0,
    available_to_process: 0,
    processable_value: 0
  });
  const [loading, setLoading] = useState(true);
  const [processDialogOpen, setProcessDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedBackorders, setSelectedBackorders] = useState<string[]>([]);
  const [editingBackorder, setEditingBackorder] = useState<any>(null);

  const { user } = useAuth();
  const { businessUser, hasAccess, hasEditAccess } = useBusinessAuth();
  const { toast } = useToast();

  const canEdit = hasEditAccess('sales');

  useEffect(() => {
    if (businessUser?.company_id) {
      fetchBackorders();
    }
  }, [businessUser?.company_id]);

  const fetchBackorders = async () => {
    try {
      setLoading(true);
      
      // Fetch backorder summary using the database function
      const { data, error } = await supabase.rpc('get_backorder_summary', {
        p_company_id: businessUser?.company_id
      });

      if (error) throw error;

      const backorderData = data || [];
      setBackorders(backorderData);

      // Calculate stats
      const totalBackorders = backorderData.reduce((sum: number, item: any) => sum + item.total_backordered, 0);
      const totalValue = backorderData.reduce((sum: number, item: any) => sum + (item.total_backordered * item.avg_unit_price), 0);
      const availableToProcess = backorderData.reduce((sum: number, item: any) => sum + Math.min(item.total_backordered, item.available_to_process), 0);
      const processableValue = backorderData.reduce((sum: number, item: any) => sum + (Math.min(item.total_backordered, item.available_to_process) * item.avg_unit_price), 0);

      setStats({
        total_backorders: totalBackorders,
        total_value: totalValue,
        available_to_process: availableToProcess,
        processable_value: processableValue
      });

    } catch (error) {
      console.error('Error fetching backorders:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch backorders. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProcessSelected = async (backorderIds: string[]) => {
    try {
      const { data, error } = await supabase.rpc('process_backorder_fulfillment', {
        p_backorder_ids: backorderIds,
        p_company_id: businessUser?.company_id
      });

      if (error) throw error;

      const result = data as any;
      toast({
        title: 'Success',
        description: `Processed ${result.processed_count} backorder items, created ${result.orders_created} new sales orders`,
      });

      setProcessDialogOpen(false);
      setSelectedBackorders([]);
      fetchBackorders();
    } catch (error) {
      console.error('Error processing backorders:', error);
      toast({
        title: 'Error',
        description: 'Failed to process backorders. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleEditBackorder = (backorder: BackorderSummary) => {
    setEditingBackorder(backorder);
    setEditDialogOpen(true);
  };

  const handleDeleteBackorder = async (backorderId: string) => {
    try {
      const { error } = await supabase
        .from('backorder_items')
        .delete()
        .eq('id', backorderId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Backorder deleted successfully',
      });

      fetchBackorders();
    } catch (error) {
      console.error('Error deleting backorder:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete backorder. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (!hasAccess('sales')) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">You don't have access to view backorders.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Backorders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_backorders}</div>
            <p className="text-xs text-muted-foreground">
              ₹{stats.total_value.toLocaleString()} value
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available to Process</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.available_to_process}</div>
            <p className="text-xs text-muted-foreground">
              ₹{stats.processable_value.toLocaleString()} value
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats.total_backorders - stats.available_to_process}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting stock
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Action Required</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {backorders.filter(b => b.available_to_process > 0).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Items ready to process
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      {canEdit && (
        <div className="flex gap-2">
          <Button
            onClick={() => setProcessDialogOpen(true)}
            disabled={stats.available_to_process === 0}
            className="flex items-center gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            Process Available ({stats.available_to_process})
          </Button>
        </div>
      )}

      {/* Backorders Table */}
      <BackorderTable
        backorders={backorders}
        loading={loading}
        selectedIds={selectedBackorders}
        onSelectionChange={setSelectedBackorders}
        onEdit={canEdit ? handleEditBackorder : undefined}
        onDelete={canEdit ? handleDeleteBackorder : undefined}
        onRefresh={fetchBackorders}
      />

      {/* Process Dialog */}
      <ProcessBackorderDialog
        open={processDialogOpen}
        onOpenChange={setProcessDialogOpen}
        backorders={backorders.filter(b => b.available_to_process > 0)}
        onProcess={handleProcessSelected}
      />

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Backorder</DialogTitle>
          </DialogHeader>
          {editingBackorder && (
            <BackorderForm
              backorder={editingBackorder}
              onSubmit={async (data) => {
                // Handle backorder update
                try {
                  const { error } = await supabase
                    .from('backorder_items')
                    .update({
                      quantity_backordered: data.quantity,
                      unit_price: data.unitPrice,
                      updated_at: new Date().toISOString()
                    })
                    .eq('product_id', editingBackorder.product_id)
                    .eq('customer_id', editingBackorder.customer_id)
                    .eq('company_id', businessUser?.company_id);

                  if (error) throw error;

                  toast({
                    title: 'Success',
                    description: 'Backorder updated successfully',
                  });

                  setEditDialogOpen(false);
                  setEditingBackorder(null);
                  fetchBackorders();
                } catch (error) {
                  console.error('Error updating backorder:', error);
                  toast({
                    title: 'Error',
                    description: 'Failed to update backorder. Please try again.',
                    variant: 'destructive',
                  });
                }
              }}
              onCancel={() => {
                setEditDialogOpen(false);
                setEditingBackorder(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}