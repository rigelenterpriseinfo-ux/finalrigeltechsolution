import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Package, Factory, Building2, User, Calendar, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

interface BOMViewData {
  id: string;
  bom_name: string;
  finished_product_name: string;
  finished_product_sku: string;
  yield_quantity: number;
  material_cost_per_unit: number;
  labor_cost_per_unit: number;
  overhead_cost_per_unit: number;
  total_cost_per_unit: number;
  warehouse_name?: string;
  bin_name?: string;
  is_active: boolean;
  production_ready: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by_name?: string;
  components: Array<{
    id: string;
    product_name: string;
    product_sku: string;
    quantity_per_unit: number;
    unit_cost: number;
    line_total: number;
    unit: string | null;
  }>;
}

interface BOMViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bomId: string | null;
}

export const BOMViewDialog: React.FC<BOMViewDialogProps> = ({
  open,
  onOpenChange,
  bomId,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [bomData, setBomData] = useState<BOMViewData | null>(null);

  useEffect(() => {
    if (bomId && open) {
      fetchBOMData();
    }
  }, [bomId, open]);

  const fetchBOMData = async () => {
    if (!bomId) return;

    setLoading(true);
    try {
      // Fetch BOM header with related data
      const { data: bomHeader, error: bomError } = await supabase
        .from('bom_headers')
        .select(`
          *,
          finished_product:products!bom_headers_finished_product_id_fkey(name, sku),
          warehouse_bin:warehouse_bins!bom_headers_warehouse_id_fkey(warehouse_name, bin_name)
        `)
        .eq('id', bomId)
        .single();

      if (bomError) throw bomError;

      // Fetch creator profile separately
      let createdByName = 'System';
      if (bomHeader.created_by) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', bomHeader.created_by)
          .single();
        
        if (profile) {
          createdByName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'System';
        }
      }

      // Fetch BOM components
      const { data: components, error: componentsError } = await supabase
        .from('bom_components')
        .select(`
          *,
          product:products!bom_components_component_product_id_fkey(name, sku, unit)
        `)
        .eq('bom_id', bomId);

      if (componentsError) throw componentsError;

      // Format the data
      const formattedData: BOMViewData = {
        id: bomHeader.id,
        bom_name: bomHeader.bom_name,
        finished_product_name: bomHeader.finished_product?.name || 'N/A',
        finished_product_sku: bomHeader.finished_product?.sku || 'N/A',
        yield_quantity: bomHeader.yield_quantity,
        material_cost_per_unit: bomHeader.material_cost_per_unit,
        labor_cost_per_unit: bomHeader.labor_cost_per_unit,
        overhead_cost_per_unit: bomHeader.overhead_cost_per_unit,
        total_cost_per_unit: bomHeader.total_cost_per_unit,
        warehouse_name: bomHeader.warehouse_bin?.warehouse_name,
        bin_name: bomHeader.warehouse_bin?.bin_name,
        is_active: bomHeader.is_active,
        production_ready: bomHeader.production_ready,
        notes: bomHeader.notes,
        created_at: bomHeader.created_at,
        updated_at: bomHeader.updated_at,
        created_by_name: createdByName,
        components: components?.map(comp => ({
          id: comp.id,
          product_name: comp.product?.name || 'N/A',
          product_sku: comp.product?.sku || 'N/A',
          quantity_per_unit: comp.quantity_per_unit,
          unit_cost: comp.unit_cost,
          line_total: comp.quantity_per_unit * comp.unit_cost,
          unit: comp.product?.unit,
        })) || []
      };

      setBomData(formattedData);
    } catch (error) {
      console.error('Error fetching BOM data:', error);
      toast({
        title: "Error",
        description: "Failed to load BOM details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  if (!bomData && !loading) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5" />
            BOM Details - {bomData?.bom_name}
          </DialogTitle>
          <DialogDescription>
            Complete Bill of Materials information including components and costs
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : bomData ? (
          <div className="space-y-6">
            {/* Status and Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2 pb-2 border-b border-primary/20">
                    <Package className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Basic Information</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">BOM Name</p>
                    <p className="font-medium">{bomData.bom_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <div className="flex gap-2">
                      <Badge variant={bomData.is_active ? "default" : "secondary"}>
                        {bomData.is_active ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3 mr-1" />
                            Inactive
                          </>
                        )}
                      </Badge>
                      <Badge variant={bomData.production_ready ? "default" : "secondary"} 
                             className={bomData.production_ready ? "bg-green-100 text-green-800" : ""}>
                        {bomData.production_ready ? 'Production Ready' : 'Draft'}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Finished Product</p>
                    <p className="font-medium">{bomData.finished_product_name}</p>
                    <p className="text-xs text-muted-foreground">{bomData.finished_product_sku}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Yield Quantity</p>
                    <p className="font-medium">{bomData.yield_quantity} units</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2 pb-2 border-b border-primary/20">
                    <Building2 className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Location & Storage</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Warehouse</p>
                    <p className="font-medium">{bomData.warehouse_name || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Bin Location</p>
                    <p className="font-medium">{bomData.bin_name || 'Not specified'}</p>
                  </div>
                  {bomData.notes && (
                    <div>
                      <p className="text-xs text-muted-foreground">Notes</p>
                      <p className="text-sm">{bomData.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2 pb-2 border-b border-primary/20">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Cost Summary</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Material</p>
                      <p className="font-medium">{formatCurrency(bomData.material_cost_per_unit)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Labor</p>
                      <p className="font-medium">{formatCurrency(bomData.labor_cost_per_unit)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Overhead</p>
                      <p className="font-medium">{formatCurrency(bomData.overhead_cost_per_unit)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">Total Cost</p>
                      <p className="font-bold text-base text-primary">{formatCurrency(bomData.total_cost_per_unit)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Components Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 pb-2 border-b border-primary/20">
                  <Package className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Components ({bomData.components.length})</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {bomData.components.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Unit Cost</TableHead>
                        <TableHead className="text-right">Line Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bomData.components.map((component) => (
                        <TableRow key={component.id}>
                          <TableCell className="font-medium">{component.product_name}</TableCell>
                          <TableCell className="text-muted-foreground">{component.product_sku}</TableCell>
                          <TableCell className="text-right">
                            {component.quantity_per_unit} {component.unit || 'units'}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(component.unit_cost)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(component.line_total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No components found for this BOM
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Metadata */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 pb-2 border-b border-primary/20">
                  <User className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Record Information</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Created By</p>
                    <p className="font-medium">{bomData.created_by_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Created At</p>
                    <p className="font-medium">{format(new Date(bomData.created_at), 'PPp')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Last Updated</p>
                    <p className="font-medium">{format(new Date(bomData.updated_at), 'PPp')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No BOM data found
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};