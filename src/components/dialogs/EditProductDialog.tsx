import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Package, TrendingUp, ClipboardList } from 'lucide-react';

interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unit: string | null;
  cost_price: number;
  unit_price: number;
  mrp: number | null;
  hsn_code: string | null;
  gst_percentage: number;
  is_taxable: boolean;
  weight_kg: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  barcode: string | null;
  min_stock_level: number;
  max_stock_level: number | null;
  is_active: boolean;
  product_type: 'goods' | 'service';
  product_category: 'raw_material' | 'finished_goods' | 'consumables' | 'assets' | 'others';
}

interface EditProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onProductUpdated: () => void;
}

export const EditProductDialog: React.FC<EditProductDialogProps> = ({
  open,
  onOpenChange,
  product,
  onProductUpdated,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Product>>({});

  useEffect(() => {
    if (product && open) {
      setFormData(product);
    }
  }, [product, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('products')
        .update({
          name: formData.name,
          description: formData.description,
          unit: formData.unit,
          cost_price: formData.cost_price,
          unit_price: formData.unit_price,
          mrp: formData.mrp,
          hsn_code: formData.hsn_code,
          gst_percentage: formData.gst_percentage,
          is_taxable: formData.is_taxable,
          weight_kg: formData.weight_kg,
          length_cm: formData.length_cm,
          width_cm: formData.width_cm,
          height_cm: formData.height_cm,
          volume_cubic_cm: formData.length_cm && formData.width_cm && formData.height_cm 
            ? formData.length_cm * formData.width_cm * formData.height_cm 
            : null,
          barcode: formData.barcode,
          min_stock_level: formData.min_stock_level,
          max_stock_level: formData.max_stock_level,
          product_type: formData.product_type,
          product_category: formData.product_category,
        })
        .eq('id', product.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Product updated successfully",
      });

      onOpenChange(false);
      onProductUpdated();
    } catch (error) {
      console.error('Error updating product:', error);
      toast({
        title: "Error",
        description: "Failed to update product",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof Product, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Edit Product
          </DialogTitle>
          <DialogDescription>
            Update product information. SKU cannot be changed.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-primary">
                <Package className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-primary">Basic Information</h3>
              </div>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    value={formData.name || ''}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    value={formData.sku || ''}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground mt-1">SKU cannot be changed</p>
                </div>
                
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={3}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="product_type">Type</Label>
                    <Select
                      value={formData.product_type}
                      onValueChange={(value) => handleInputChange('product_type', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="goods">Goods</SelectItem>
                        <SelectItem value="service">Service</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="unit">Unit</Label>
                    <Input
                      id="unit"
                      value={formData.unit || ''}
                      onChange={(e) => handleInputChange('unit', e.target.value)}
                      placeholder="pcs, kg, ltr"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="product_category">Category</Label>
                  <Select
                    value={formData.product_category}
                    onValueChange={(value) => handleInputChange('product_category', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="raw_material">Raw Material</SelectItem>
                      <SelectItem value="finished_goods">Finished Goods</SelectItem>
                      <SelectItem value="consumables">Consumables</SelectItem>
                      <SelectItem value="assets">Assets</SelectItem>
                      <SelectItem value="others">Others</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="barcode">Barcode</Label>
                  <Input
                    id="barcode"
                    value={formData.barcode || ''}
                    onChange={(e) => handleInputChange('barcode', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Pricing & Tax */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-primary">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-primary">Pricing & Tax</h3>
              </div>
              
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="cost_price">Cost Price *</Label>
                    <Input
                      id="cost_price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.cost_price || ''}
                      onChange={(e) => handleInputChange('cost_price', parseFloat(e.target.value) || 0)}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="unit_price">Selling Price *</Label>
                    <Input
                      id="unit_price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.unit_price || ''}
                      onChange={(e) => handleInputChange('unit_price', parseFloat(e.target.value) || 0)}
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="mrp">MRP</Label>
                  <Input
                    id="mrp"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.mrp || ''}
                    onChange={(e) => handleInputChange('mrp', parseFloat(e.target.value) || null)}
                  />
                </div>
                
                <div className="border rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Taxable Item</Label>
                    <Switch
                      checked={formData.is_taxable}
                      onCheckedChange={(checked) => handleInputChange('is_taxable', checked)}
                    />
                  </div>
                  
                  {formData.is_taxable && (
                    <div className="space-y-2">
                      <div>
                        <Label htmlFor="hsn_code">HSN Code</Label>
                        <Input
                          id="hsn_code"
                          value={formData.hsn_code || ''}
                          onChange={(e) => handleInputChange('hsn_code', e.target.value)}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="gst_percentage">GST Rate</Label>
                        <Select
                          value={formData.gst_percentage?.toString()}
                          onValueChange={(value) => handleInputChange('gst_percentage', parseFloat(value))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0%</SelectItem>
                            <SelectItem value="5">5%</SelectItem>
                            <SelectItem value="12">12%</SelectItem>
                            <SelectItem value="18">18%</SelectItem>
                            <SelectItem value="28">28%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Physical Attributes & Stock */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-primary">
                <ClipboardList className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-primary">Physical & Stock</h3>
              </div>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="weight_kg">Weight (kg)</Label>
                  <Input
                    id="weight_kg"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.weight_kg || ''}
                    onChange={(e) => handleInputChange('weight_kg', parseFloat(e.target.value) || null)}
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label htmlFor="length_cm">Length (cm)</Label>
                    <Input
                      id="length_cm"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.length_cm || ''}
                      onChange={(e) => handleInputChange('length_cm', parseFloat(e.target.value) || null)}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="width_cm">Width (cm)</Label>
                    <Input
                      id="width_cm"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.width_cm || ''}
                      onChange={(e) => handleInputChange('width_cm', parseFloat(e.target.value) || null)}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="height_cm">Height (cm)</Label>
                    <Input
                      id="height_cm"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.height_cm || ''}
                      onChange={(e) => handleInputChange('height_cm', parseFloat(e.target.value) || null)}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="min_stock_level">Min Stock Level *</Label>
                    <Input
                      id="min_stock_level"
                      type="number"
                      min="0"
                      value={formData.min_stock_level || ''}
                      onChange={(e) => handleInputChange('min_stock_level', parseInt(e.target.value) || 0)}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="max_stock_level">Max Stock Level</Label>
                    <Input
                      id="max_stock_level"
                      type="number"
                      min="0"
                      value={formData.max_stock_level || ''}
                      onChange={(e) => handleInputChange('max_stock_level', parseInt(e.target.value) || null)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update Product'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};