import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { Plus, Search, Edit, Trash2, Play, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku: string;
  cost_price: number;
  product_category: string;
  is_active: boolean;
}

interface BOMHeader {
  id: string;
  bom_name: string;
  finished_product_id: string;
  yield_quantity: number;
  material_cost_per_unit: number;
  labor_cost_per_unit: number;
  overhead_cost_per_unit: number;
  total_cost_per_unit: number;
  production_ready?: boolean;
  is_active: boolean;
}

export function BOMModule() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { hasEditAccess } = useBusinessAuth();
  const canEdit = hasEditAccess('inventory');

  const [products, setProducts] = useState<Product[]>([]);
  const [boms, setBoms] = useState<BOMHeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBOMDialog, setShowBOMDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    bomName: '',
    finishedProductId: '',
    yieldQuantity: 1,
    laborCost: 0,
    overheadCost: 0,
    productionReady: false,
  });

  const fetchData = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      setLoading(true);
      
      const [productsRes, bomsRes] = await Promise.all([
        supabase.from('products').select('*').eq('company_id', profile.company_id).eq('is_active', true),
        supabase.from('bom_headers').select('*').eq('company_id', profile.company_id)
      ]);

      if (productsRes.data) setProducts(productsRes.data);
      if (bomsRes.data) setBoms(bomsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredBoms = useMemo(() => 
    boms.filter(bom => 
      bom.bom_name.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [boms, searchTerm]
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Bill of Materials (BOM)</h2>
          <p className="text-muted-foreground">Manage production recipes with proper warehouse/bin mapping and production ready controls</p>
        </div>
        {canEdit && (
          <Button onClick={() => setShowBOMDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create BOM
          </Button>
        )}
      </div>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">BOM List</TabsTrigger>
          <TabsTrigger value="production">Production</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search BOMs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <div className="grid gap-4">
            {filteredBoms.map((bom) => (
              <Card key={bom.id}>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        {bom.bom_name}
                        {bom.production_ready ? (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Production Ready
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="h-3 w-3 mr-1" />
                            Draft
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        Yield: {bom.yield_quantity} units
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {bom.production_ready && (
                        <Button size="sm">
                          <Play className="h-4 w-4 mr-1" />
                          Produce
                        </Button>
                      )}
                      {canEdit && (
                        <Button size="sm" variant="outline">
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Material Cost:</span>
                      <p>₹{bom.material_cost_per_unit.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="font-medium">Labor Cost:</span>
                      <p>₹{bom.labor_cost_per_unit.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="font-medium">Overhead Cost:</span>
                      <p>₹{bom.overhead_cost_per_unit.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="font-medium">Total Cost:</span>
                      <p className="font-bold text-lg">₹{bom.total_cost_per_unit.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="production" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Production Dashboard</CardTitle>
              <CardDescription>Run production for ready BOMs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground">Production features will be available here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showBOMDialog} onOpenChange={setShowBOMDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Create New BOM</DialogTitle>
            <DialogDescription>
              Configure BOM with proper warehouse/bin mapping and production ready controls
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>BOM Name *</Label>
              <Input
                value={formData.bomName}
                onChange={(e) => setFormData(prev => ({ ...prev, bomName: e.target.value }))}
                placeholder="Enter BOM name"
              />
            </div>
            <div>
              <Label>Finished Product *</Label>
              <Select
                value={formData.finishedProductId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, finishedProductId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select finished product" />
                </SelectTrigger>
                <SelectContent>
                  {products.filter(p => p.product_category === 'finished_goods').map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} ({product.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.productionReady}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, productionReady: checked }))}
              />
              <Label>Production Ready (default: 0)</Label>
            </div>
            {!formData.productionReady && (
              <p className="text-xs text-muted-foreground flex items-center">
                <AlertTriangle className="h-3 w-3 mr-1" />
                When disabled, no inventory actions will be performed during production
              </p>
            )}
            <div className="flex gap-2 pt-4">
              <Button onClick={() => setShowBOMDialog(false)} className="flex-1">
                Save BOM
              </Button>
              <Button variant="outline" onClick={() => setShowBOMDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}