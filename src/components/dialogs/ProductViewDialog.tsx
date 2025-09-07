import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Package, DollarSign, ShoppingCart, Ruler, BarChart3, Calendar, Settings, Tag } from 'lucide-react';

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
  volume_cubic_cm: number | null;
  barcode: string | null;
  min_stock_level: number;
  max_stock_level: number | null;
  is_active: boolean;
  company_id: string;
  category_id: string | null;
  product_type: 'goods' | 'service';
  product_category: 'raw_material' | 'finished_goods' | 'consumables' | 'assets' | 'others';
  created_at: string;
  updated_at: string;
}

interface ProductViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}

export const ProductViewDialog: React.FC<ProductViewDialogProps> = ({
  open,
  onOpenChange,
  product,
}) => {
  if (!product) return null;

  const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

  const getCategoryLabel = (category: string) => {
    return category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <Package className="h-5 w-5 text-primary" />
            Product Details
          </DialogTitle>
          <DialogDescription>
            Complete information about this product including pricing, tax, and physical attributes
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-h-[calc(90vh-8rem)] overflow-y-auto">
          {/* Basic Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-primary/20">
              <Package className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-primary">Basic Information</h3>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Product Name</label>
                <p className="text-sm font-semibold mt-1">{product.name}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">SKU</label>
                <p className="text-sm font-mono bg-muted/50 px-2 py-1 rounded mt-1">
                  {product.sku}
                </p>
              </div>
              
              {product.description && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Description</label>
                  <p className="text-sm mt-1 p-2 bg-muted/30 rounded">{product.description}</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Product Type</label>
                  <div className="mt-1">
                    <Badge variant={product.product_type === 'goods' ? 'default' : 'secondary'}>
                      {product.product_type === 'goods' ? 'Goods' : 'Service'}
                    </Badge>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Category</label>
                  <div className="mt-1">
                    <Badge variant="outline">
                      {getCategoryLabel(product.product_category)}
                    </Badge>
                  </div>
                </div>
              </div>
              
              {product.unit && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Unit of Measure</label>
                  <p className="text-sm font-medium mt-1">{product.unit}</p>
                </div>
              )}
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <div className="mt-1">
                  <Badge variant={product.is_active ? 'default' : 'secondary'}>
                    {product.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing & Tax */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-green-500/20">
              <DollarSign className="h-4 w-4 text-green-600" />
              <h3 className="font-semibold text-green-600">Pricing & Tax</h3>
            </div>
            
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <label className="text-sm font-medium text-blue-600">Cost Price</label>
                  <p className="text-lg font-bold text-blue-700 mt-1">
                    {formatCurrency(product.cost_price)}
                  </p>
                </div>
                
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <label className="text-sm font-medium text-green-600">Selling Price</label>
                  <p className="text-lg font-bold text-green-700 mt-1">
                    {formatCurrency(product.unit_price)}
                  </p>
                </div>
              </div>
              
              {product.mrp && (
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 text-center">
                  <label className="text-sm font-medium text-purple-600">Maximum Retail Price (MRP)</label>
                  <p className="text-xl font-bold text-purple-700 mt-1">
                    {formatCurrency(product.mrp)}
                  </p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Taxable</label>
                  <div className="mt-1">
                    <Badge variant={product.is_taxable ? 'default' : 'secondary'}>
                      {product.is_taxable ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">GST Rate</label>
                  <p className="text-sm font-semibold mt-1 bg-muted/50 px-2 py-1 rounded">
                    {product.gst_percentage}%
                  </p>
                </div>
              </div>
              
              {product.hsn_code && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">HSN/SAC Code</label>
                  <p className="text-sm font-mono bg-muted/50 px-2 py-1 rounded mt-1">
                    {product.hsn_code}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Physical Attributes */}
          {(product.weight_kg || product.length_cm || product.width_cm || product.height_cm || product.barcode) && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-blue-500/20">
                <Ruler className="h-4 w-4 text-blue-600" />
                <h3 className="font-semibold text-blue-600">Physical Attributes</h3>
              </div>
              
              <div className="space-y-3">
                {product.weight_kg && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Weight</label>
                    <p className="text-sm font-semibold mt-1">{product.weight_kg} kg</p>
                  </div>
                )}
                
                {(product.length_cm && product.width_cm && product.height_cm) && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Dimensions (L×W×H)</label>
                    <p className="text-sm font-semibold mt-1">
                      {product.length_cm} × {product.width_cm} × {product.height_cm} cm
                    </p>
                  </div>
                )}
                
                {product.volume_cubic_cm && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Volume</label>
                    <p className="text-sm font-semibold mt-1">{product.volume_cubic_cm} cm³</p>
                  </div>
                )}
                
                {product.barcode && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Barcode</label>
                    <p className="text-sm font-mono bg-muted/50 px-2 py-1 rounded mt-1">
                      {product.barcode}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stock Management */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-orange-500/20">
              <BarChart3 className="h-4 w-4 text-orange-600" />
              <h3 className="font-semibold text-orange-600">Stock Management</h3>
            </div>
            
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <label className="text-sm font-medium text-orange-600">Min Stock Level</label>
                  <p className="text-xl font-bold text-orange-700 mt-1">
                    {product.min_stock_level}
                  </p>
                </div>
                
                <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <label className="text-sm font-medium text-orange-600">Max Stock Level</label>
                  <p className="text-xl font-bold text-orange-700 mt-1">
                    {product.max_stock_level || 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="space-y-4 lg:col-span-2">
            <div className="flex items-center gap-2 pb-2 border-b border-purple-500/20">
              <Settings className="h-4 w-4 text-purple-600" />
              <h3 className="font-semibold text-purple-600">Metadata</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created</label>
                  <p className="text-sm">
                    {new Date(product.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
                  <p className="text-sm">
                    {new Date(product.updated_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};