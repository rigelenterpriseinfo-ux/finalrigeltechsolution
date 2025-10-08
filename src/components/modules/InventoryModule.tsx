import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { Plus, Search, Package, AlertTriangle, Edit, Trash2, Eye, Download, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, MapPin, TrendingUp, ClipboardList, ArrowRightLeft, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { WarehouseBinForm } from '@/components/forms/WarehouseBinForm';
import { WarehouseBinTable } from '@/components/tables/WarehouseBinTable';
import { InventoryAdjustmentForm } from '@/components/forms/InventoryAdjustmentForm';
import { InventoryTransferForm } from '@/components/forms/InventoryTransferForm';
import { InventoryAdjustmentTable } from '@/components/tables/InventoryAdjustmentTable';
import { InventoryTransactionTable } from '@/components/tables/InventoryTransactionTable';
import { CurrentStockTable } from '@/components/tables/CurrentStockTable';
import { EnhancedCurrentStockSystem } from '@/components/inventory/EnhancedCurrentStockSystem';
import { BOMModule } from '@/components/modules/BOMModule';
import { ProductViewDialog } from '@/components/dialogs/ProductViewDialog';
import { EditProductDialog } from '@/components/dialogs/EditProductDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

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

export function InventoryModule() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { hasEditAccess } = useBusinessAuth();
  const isMobile = useIsMobile();
  const canEdit = hasEditAccess('inventory');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsWithTransactions, setProductsWithTransactions] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showBOMDialog, setShowBOMDialog] = useState(false);
  const [showBinDialog, setShowBinDialog] = useState(false);
  const [showAdjustmentDialog, setShowAdjustmentDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [adjustmentRefreshTrigger, setAdjustmentRefreshTrigger] = useState(0);
  const [warehouseBins, setWarehouseBins] = useState<any[]>([]);
  const [warehouseBinStats, setWarehouseBinStats] = useState<any[]>([]);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  
  // Form state for auto-calculations and conditional display
  const [isTaxable, setIsTaxable] = useState(true);
  const [dimensions, setDimensions] = useState({ length: '', width: '', height: '' });
  
  // SKU validation state
  const [skuValue, setSkuValue] = useState('');
  const [skuValidation, setSkuValidation] = useState<{
    status: 'idle' | 'checking' | 'valid' | 'duplicate' | 'inactive_found';
    message: string;
    inactiveProduct?: any;
  }>({ status: 'idle', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // BOM state
  type BomComponent = { id: string; productId?: string; name?: string; sku?: string; unit?: string | null; quantity: number; cost: number };
  const [bomComponents, setBomComponents] = useState<BomComponent[]>([]);
  const [bomName, setBomName] = useState('');
  const [bomFinishedProduct, setBomFinishedProduct] = useState('');
  const [bomYield, setBomYield] = useState(1);
  const [bomLaborCost, setBomLaborCost] = useState(0);
  const [bomOverheadCost, setBomOverheadCost] = useState(0);
  const [bomWarehouse, setBomWarehouse] = useState('');
  const [bomBin, setBomBin] = useState('');
  const [bomNotes, setBomNotes] = useState('');
  const [productionQuantity, setProductionQuantity] = useState(1);
  const [isProducing, setIsProducing] = useState(false);
  
  const bomCandidateProducts = useMemo(() => {
    const filtered = products.filter(p => p.product_category !== 'finished_goods' && p.id && p.id.trim() !== '');
    return filtered;
  }, [products]);

  const finishedGoodsProducts = useMemo(() => {
    const filtered = products.filter(p => p.product_category === 'finished_goods');
    return filtered;
  }, [products]);

  // Calculate volume when dimensions change
  const calculateVolume = (length: string, width: string, height: string) => {
    const l = parseFloat(length) || 0;
    const w = parseFloat(width) || 0;
    const h = parseFloat(height) || 0;
    return l > 0 && w > 0 && h > 0 ? (l * w * h).toFixed(2) : '';
  };

  // Debounced SKU validation
  const validateSKU = useCallback(async (sku: string) => {
    if (!sku.trim()) {
      setSkuValidation({ status: 'idle', message: '' });
      return;
    }

    setSkuValidation({ status: 'checking', message: 'Checking availability...' });

    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, sku, name, is_active')
        .eq('company_id', profile?.company_id)
        .eq('sku', sku.trim())
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setSkuValidation({ status: 'valid', message: 'SKU is available' });
      } else if (data.is_active) {
        setSkuValidation({ 
          status: 'duplicate', 
          message: `SKU already exists for "${data.name}"` 
        });
      } else {
        setSkuValidation({ 
          status: 'inactive_found', 
          message: `Inactive product "${data.name}" uses this SKU`,
          inactiveProduct: data 
        });
      }
    } catch (error) {
      console.error('Error validating SKU:', error);
      setSkuValidation({ status: 'idle', message: '' });
    }
  }, [profile?.company_id]);

  // Debounce the SKU validation
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (skuValue) {
        validateSKU(skuValue);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [skuValue, validateSKU]);

  // Handle SKU reactivation
  const handleReactivateProduct = async () => {
    if (!skuValidation.inactiveProduct) return;

    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: true })
        .eq('id', skuValidation.inactiveProduct.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Product "${skuValidation.inactiveProduct.name}" has been reactivated`,
      });

      setShowAddDialog(false);
      fetchProducts();
      setSkuValue('');
      setSkuValidation({ status: 'idle', message: '' });
    } catch (error) {
      console.error('Error reactivating product:', error);
      toast({
        title: "Error",
        description: "Failed to reactivate product",
        variant: "destructive",
      });
    }
  };

  // Fetch warehouse bins
  const fetchWarehouseBins = async () => {
    try {
      const { data, error } = await supabase
        .from('warehouse_bins')
        .select('*')
        .eq('is_active', true)
        .order('wh_bin_code', { ascending: true });

      if (error) throw error;
      setWarehouseBins(data || []);
    } catch (error) {
      console.error('Error fetching warehouse bins:', error);
    }
  };

  // Check for products with transactions
  const checkProductsWithTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_transactions')
        .select('product_id')
        .eq('company_id', profile?.company_id);

      if (error) throw error;
      
      const productIdsWithTransactions = new Set(data?.map(t => t.product_id) || []);
      setProductsWithTransactions(productIdsWithTransactions);
    } catch (error) {
      console.error('Error checking product transactions:', error);
    }
  };

  // Calculate warehouse bin statistics
  const calculateWarehouseBinStats = () => {
    const binStats = warehouseBins.map(bin => {
      return {
        binCode: bin.wh_bin_code,
        binName: bin.bin_name,
        totalUnits: 0,
        totalValue: 0
      };
    });
    setWarehouseBinStats(binStats);
  };

  // Fetch products from Supabase
  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      setProducts(data as Product[] || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: "Error",
        description: "Failed to fetch products",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchWarehouseBins();
    if (profile?.company_id) {
      checkProductsWithTransactions();
    }
  }, [profile?.company_id]);

  useEffect(() => {
    if (warehouseBins.length > 0 && products.length > 0) {
      calculateWarehouseBinStats();
    }
  }, [warehouseBins, products]);

  // Handle sorting
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Get sort icon
  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="w-4 h-4" />;
    }
    return sortConfig.direction === 'asc' ? 
      <ArrowUp className="w-4 h-4" /> : 
      <ArrowDown className="w-4 h-4" />;
  };

  // Handle add product
  const handleAddProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canEdit) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to create products",
        variant: "destructive",
      });
      return;
    }

    // Prevent submission if SKU validation failed
    if (skuValidation.status === 'duplicate') {
      toast({
        title: "Validation Error",
        description: "SKU already exists. Please use a different SKU.",
        variant: "destructive",
      });
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      const form = e.currentTarget;
      
      // Enhanced validation
      const costPrice = parseFloat(formData.get('cost_price') as string || '0');
      const sellingPrice = parseFloat(formData.get('unit_price') as string || '0');
      const mrp = formData.get('mrp') ? parseFloat(formData.get('mrp') as string) : null;
      const gstPercentage = parseFloat(formData.get('gst_percentage') as string || '0');
      const minStock = parseInt(formData.get('min_stock_level') as string || '0');
      const maxStock = formData.get('max_stock_level') ? parseInt(formData.get('max_stock_level') as string) : null;
      
      // Validation checks
      if (costPrice < 0 || sellingPrice < 0 || (mrp && mrp < 0)) {
        toast({
          title: "Validation Error", 
          description: "Prices must be greater than or equal to 0",
          variant: "destructive",
        });
        return;
      }
      
      if (mrp && mrp < sellingPrice) {
        toast({
          title: "Validation Error",
          description: "MRP cannot be less than Selling Price",
          variant: "destructive",
        });
        return;
      }
      
      if (gstPercentage < 0 || gstPercentage > 28) {
        toast({
          title: "Validation Error",
          description: "GST percentage must be between 0-28%",
          variant: "destructive",
        });
        return;
      }
      
      if (minStock < 0 || (maxStock && maxStock < 0)) {
        toast({
          title: "Validation Error",
          description: "Stock levels must be non-negative integers",
          variant: "destructive",
        });
        return;
      }

      // Calculate volume if dimensions are provided
      const length = formData.get('length_cm') ? parseFloat(formData.get('length_cm') as string) : null;
      const width = formData.get('width_cm') ? parseFloat(formData.get('width_cm') as string) : null;
      const height = formData.get('height_cm') ? parseFloat(formData.get('height_cm') as string) : null;
      const volumeCubicCm = (length && width && height) ? length * width * height : null;

      const productData = {
        name: formData.get('name') as string,
        description: formData.get('description') as string,
        sku: formData.get('sku') as string,
        unit: formData.get('unit') as string,
        cost_price: costPrice,
        unit_price: sellingPrice,
        mrp: mrp,
        min_stock_level: minStock,
        max_stock_level: maxStock,
        hsn_code: formData.get('hsn_code') as string,
        gst_percentage: gstPercentage,
        is_taxable: formData.get('is_taxable') === 'on',
        weight_kg: formData.get('weight_kg') ? parseFloat(formData.get('weight_kg') as string) : null,
        length_cm: length,
        width_cm: width,
        height_cm: height,
        volume_cubic_cm: volumeCubicCm,
        barcode: formData.get('barcode') as string || null,
        product_type: formData.get('product_type') as 'goods' | 'service',
        product_category: formData.get('product_category') as 'raw_material' | 'finished_goods' | 'consumables' | 'assets' | 'others',
        company_id: profile?.company_id,
        is_active: formData.get('is_active') !== 'off' // Default to true unless explicitly turned off
      };

      const { error } = await supabase
        .from('products')
        .insert([productData]);

      if (error) {
        // Handle specific database constraint errors
        if (error.code === '23505' && error.message.includes('products_company_id_sku_key')) {
          toast({
            title: "Duplicate SKU",
            description: "This SKU already exists. Please use a different SKU.",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      toast({
        title: "Success",
        description: "Product added successfully",
      });

      setShowAddDialog(false);
      fetchProducts();
      // Reset form and state
      form.reset();
      setIsTaxable(true);
      setDimensions({ length: '', width: '', height: '' });
      setSkuValue('');
      setSkuValidation({ status: 'idle', message: '' });
    } catch (error) {
      console.error('Error adding product:', error);
      toast({
        title: "Error",
        description: "Failed to add product. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle update product
  const handleUpdateProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canEdit || !editingProduct) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to update products",
        variant: "destructive",
      });
      return;
    }

    try {
      const formData = new FormData(e.currentTarget);
      const productData = {
        name: formData.get('name') as string,
        description: formData.get('description') as string,
        sku: formData.get('sku') as string,
        unit: formData.get('unit') as string,
        cost_price: parseFloat(formData.get('cost_price') as string),
        unit_price: parseFloat(formData.get('unit_price') as string),
        min_stock_level: parseInt(formData.get('min_stock_level') as string),
        max_stock_level: formData.get('max_stock_level') ? parseInt(formData.get('max_stock_level') as string) : null,
        hsn_code: formData.get('hsn_code') as string,
        gst_percentage: parseFloat(formData.get('gst_percentage') as string),
        weight_kg: formData.get('weight_kg') ? parseFloat(formData.get('weight_kg') as string) : null,
        length_cm: formData.get('length_cm') ? parseFloat(formData.get('length_cm') as string) : null,
        width_cm: formData.get('width_cm') ? parseFloat(formData.get('width_cm') as string) : null,
        height_cm: formData.get('height_cm') ? parseFloat(formData.get('height_cm') as string) : null,
        product_type: formData.get('product_type') as 'goods' | 'service',
        product_category: formData.get('product_category') as 'raw_material' | 'finished_goods' | 'consumables' | 'assets',
      };

      const { error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', editingProduct.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Product updated successfully",
      });

      setShowEditDialog(false);
      setEditingProduct(null);
      fetchProducts();
    } catch (error) {
      console.error('Error updating product:', error);
      toast({
        title: "Error",
        description: "Failed to update product",
        variant: "destructive",
      });
    }
  };

  // Handle edit product
  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setShowEditDialog(true);
  };

  // Handle delete product
  const handleDeleteProduct = async (productId: string) => {
    if (!canEdit) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to delete products",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', productId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Product deleted successfully",
      });

      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive",
      });
    }
  };

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let filtered = products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (sortConfig) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof Product];
        const bValue = b[sortConfig.key as keyof Product];
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [products, searchTerm, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = filteredProducts.slice(startIndex, endIndex);

  // Export to Excel
  const exportToExcel = () => {
    const exportData = filteredProducts.map(product => ({
      'SKU': product.sku,
      'Name': product.name,
      'Description': product.description || '',
      'Type': product.product_type === 'goods' ? 'Goods' : 'Service',
      'Category': product.product_category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      'Unit': product.unit || '',
      'Cost Price': product.cost_price,
      'Unit Price': product.unit_price,
      'HSN Code': product.hsn_code || '',
      'GST %': product.gst_percentage,
      'Min Stock': product.min_stock_level,
      'Max Stock': product.max_stock_level || '',
      'Weight (kg)': product.weight_kg || '',
      'Length (cm)': product.length_cm || '',
      'Width (cm)': product.width_cm || '',
      'Height (cm)': product.height_cm || '',
      'Status': product.is_active ? 'Active' : 'Inactive'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
    XLSX.writeFile(workbook, 'products.xlsx');
  };

  // Statistics
  const totalProducts = products.length;
  const totalValue = products.reduce((sum, product) => sum + (product.unit_price * product.min_stock_level || 0), 0);
  const lowStockCount = products.filter(product => (product.min_stock_level || 0) <= 10).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center">
        <div className="grid grid-cols-5 gap-4 w-full">
          {canEdit && (
            <>
              <Dialog 
                open={showAddDialog} 
                onOpenChange={(open) => {
                  setShowAddDialog(open);
                  if (!open) {
                    // Reset form state when dialog closes
                    setIsTaxable(true);
                    setDimensions({ length: '', width: '', height: '' });
                    setSkuValue('');
                    setSkuValidation({ status: 'idle', message: '' });
                    setIsSubmitting(false);
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button className={cn(showAddDialog && "bg-primary/90")}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Product
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-6xl max-h-[90vh] sm:max-h-[95vh] overflow-y-auto">
                  <DialogHeader className="pb-3">
                    <DialogTitle className="text-base sm:text-xl">Add New Product</DialogTitle>
                    <DialogDescription className="text-xs sm:text-sm">
                      Enter the product details below
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddProduct} className="space-y-4 animate-fade-in">
                    <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
                      {/* Column 1: Basic Information */}
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-primary border-b pb-1 flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          Basic Information
                        </h3>
                        <div className="space-y-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <Label htmlFor="name" className="text-xs font-medium text-muted-foreground">Product Name *</Label>
                              <Input id="name" name="name" required className="mobile-touch-target text-xs transition-all focus:scale-[1.02]" placeholder="Enter product name" />
                            </div>
                            <div>
                              <Label htmlFor="sku" className="text-xs font-medium text-muted-foreground">SKU *</Label>
                              <div className="relative">
                                <Input 
                                  id="sku" 
                                  name="sku" 
                                  required 
                                  value={skuValue}
                                  onChange={(e) => setSkuValue(e.target.value)}
                                  className={`mobile-touch-target text-xs transition-all focus:scale-[1.02] pr-8 ${
                                    skuValidation.status === 'valid' ? 'border-green-500' :
                                    skuValidation.status === 'duplicate' ? 'border-red-500' :
                                    skuValidation.status === 'inactive_found' ? 'border-yellow-500' : ''
                                  }`}
                                  placeholder="Product SKU" 
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                  {skuValidation.status === 'checking' && (
                                    <div className="animate-spin rounded-full h-3 w-3 border-b border-primary"></div>
                                  )}
                                  {skuValidation.status === 'valid' && (
                                    <CheckCircle className="h-3 w-3 text-green-500" />
                                  )}
                                  {skuValidation.status === 'duplicate' && (
                                    <XCircle className="h-3 w-3 text-red-500" />
                                  )}
                                  {skuValidation.status === 'inactive_found' && (
                                    <AlertTriangle className="h-3 w-3 text-yellow-500" />
                                  )}
                                </div>
                              </div>
                              {skuValidation.message && (
                                <div className={`text-xs mt-1 flex items-center gap-1 ${
                                  skuValidation.status === 'valid' ? 'text-green-600' :
                                  skuValidation.status === 'duplicate' ? 'text-red-600' :
                                  skuValidation.status === 'inactive_found' ? 'text-yellow-600' :
                                  'text-muted-foreground'
                                }`}>
                                  {skuValidation.message}
                                  {skuValidation.status === 'inactive_found' && (
                                    <Button
                                      type="button"
                                      variant="link"
                                      size="sm"
                                      onClick={handleReactivateProduct}
                                      className="h-auto p-0 ml-2 text-xs text-blue-600 hover:text-blue-800"
                                    >
                                      <RotateCcw className="h-3 w-3 mr-1" />
                                      Reactivate
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="description" className="text-xs font-medium text-muted-foreground">Description</Label>
                            <Textarea id="description" name="description" className="mt-0.5 min-h-[50px] resize-none text-xs transition-all focus:scale-[1.01]" placeholder="Product description..." />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label htmlFor="product_type" className="text-xs font-medium text-muted-foreground">Type *</Label>
                              <Select name="product_type" required>
                                <SelectTrigger className="mt-0.5 h-8 text-xs">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="goods">Goods</SelectItem>
                                  <SelectItem value="service">Service</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="unit" className="text-xs font-medium text-muted-foreground">Unit</Label>
                              <Input id="unit" name="unit" placeholder="pcs, kg, ltr" className="mt-0.5 h-8 text-xs transition-all focus:scale-[1.02]" />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="product_category" className="text-xs font-medium text-muted-foreground">Category *</Label>
                            <Select name="product_category" required>
                              <SelectTrigger className="mt-0.5 h-8 text-xs">
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="raw_material">Raw Material</SelectItem>
                                <SelectItem value="finished_goods">Finished Goods</SelectItem>
                                <SelectItem value="consumables">Consumables</SelectItem>
                                <SelectItem value="assets">Assets</SelectItem>
                                <SelectItem value="others">Others / Miscellaneous</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="barcode" className="text-xs font-medium text-muted-foreground">Barcode</Label>
                            <Input id="barcode" name="barcode" placeholder="Enter barcode (optional)" className="mt-0.5 h-8 text-xs transition-all focus:scale-[1.02]" />
                          </div>
                        </div>
                      </div>

                      {/* Column 2: Pricing & Tax */}
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-primary border-b pb-1 flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          Pricing & Tax
                        </h3>
                        <div className="space-y-2.5">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label htmlFor="cost_price" className="text-xs font-medium text-muted-foreground">Cost Price *</Label>
                              <Input 
                                id="cost_price" 
                                name="cost_price" 
                                type="number" 
                                step="0.01" 
                                min="0"
                                required 
                                className="mt-0.5 h-8 text-xs transition-all focus:scale-[1.02]" 
                                placeholder="0.00"
                              />
                            </div>
                            <div>
                              <Label htmlFor="unit_price" className="text-xs font-medium text-muted-foreground">Selling Price *</Label>
                              <Input 
                                id="unit_price" 
                                name="unit_price" 
                                type="number" 
                                step="0.01" 
                                min="0"
                                required 
                                className="mt-0.5 h-8 text-xs transition-all focus:scale-[1.02]" 
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="mrp" className="text-xs font-medium text-muted-foreground">MRP</Label>
                            <Input 
                              id="mrp" 
                              name="mrp" 
                              type="number" 
                              step="0.01" 
                              min="0"
                              placeholder="Maximum Retail Price (optional)" 
                              className="mt-0.5 h-8 text-xs transition-all focus:scale-[1.02]" 
                            />
                          </div>
                          <div className="bg-muted/30 p-2 rounded-md border">
                            <div className="flex items-center justify-between mb-2">
                              <Label htmlFor="is_taxable" className="text-xs font-medium">Taxable Item</Label>
                              <Switch 
                                id="is_taxable"
                                name="is_taxable"
                                checked={isTaxable}
                                onCheckedChange={setIsTaxable}
                                className="scale-75"
                              />
                            </div>
                            {isTaxable && (
                              <div className="space-y-2 animate-fade-in">
                                <div>
                                  <Label htmlFor="hsn_code" className="text-xs font-medium text-muted-foreground">HSN Code</Label>
                                  <Input id="hsn_code" name="hsn_code" className="mt-0.5 h-7 text-xs" placeholder="HSN/SAC Code" />
                                </div>
                                <div>
                                  <Label htmlFor="gst_percentage" className="text-xs font-medium text-muted-foreground">GST Rate</Label>
                                  <Select name="gst_percentage" defaultValue="0">
                                    <SelectTrigger className="mt-0.5 h-7 text-xs">
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

                      {/* Column 3: Stock & Dimensions */}
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-primary border-b pb-1 flex items-center gap-2">
                          <ClipboardList className="h-4 w-4" />
                          Stock & Dimensions
                        </h3>
                        <div className="space-y-2.5">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label htmlFor="min_stock_level" className="text-xs font-medium text-muted-foreground">Min Stock *</Label>
                              <Input 
                                id="min_stock_level" 
                                name="min_stock_level" 
                                type="number" 
                                min="0"
                                defaultValue="0"
                                required 
                                className="mt-0.5 h-8 text-xs transition-all focus:scale-[1.02]" 
                              />
                            </div>
                            <div>
                              <Label htmlFor="max_stock_level" className="text-xs font-medium text-muted-foreground">Max Stock</Label>
                              <Input 
                                id="max_stock_level" 
                                name="max_stock_level" 
                                type="number" 
                                min="0"
                                className="mt-0.5 h-8 text-xs transition-all focus:scale-[1.02]" 
                                placeholder="Optional"
                              />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="weight_kg" className="text-xs font-medium text-muted-foreground">Weight (kg)</Label>
                            <Input 
                              id="weight_kg" 
                              name="weight_kg" 
                              type="number" 
                              step="0.01" 
                              min="0"
                              className="mt-0.5 h-8 text-xs transition-all focus:scale-[1.02]" 
                              placeholder="0.00"
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-medium text-muted-foreground">Dimensions (L × W × H)</Label>
                            <div className="grid grid-cols-3 gap-1 mt-0.5">
                              <Input 
                                id="length_cm" 
                                name="length_cm" 
                                type="number" 
                                step="0.01" 
                                min="0"
                                value={dimensions.length}
                                onChange={(e) => setDimensions(prev => ({ ...prev, length: e.target.value }))}
                                className="h-8 text-xs transition-all focus:scale-[1.02]" 
                                placeholder="L"
                              />
                              <Input 
                                id="width_cm" 
                                name="width_cm" 
                                type="number" 
                                step="0.01" 
                                min="0"
                                value={dimensions.width}
                                onChange={(e) => setDimensions(prev => ({ ...prev, width: e.target.value }))}
                                className="h-8 text-xs transition-all focus:scale-[1.02]" 
                                placeholder="W"
                              />
                              <Input 
                                id="height_cm" 
                                name="height_cm" 
                                type="number" 
                                step="0.01" 
                                min="0"
                                value={dimensions.height}
                                onChange={(e) => setDimensions(prev => ({ ...prev, height: e.target.value }))}
                                className="h-8 text-xs transition-all focus:scale-[1.02]" 
                                placeholder="H"
                              />
                            </div>
                          </div>
                          {calculateVolume(dimensions.length, dimensions.width, dimensions.height) && (
                            <div className="animate-fade-in">
                              <Label className="text-xs font-medium text-muted-foreground">Volume</Label>
                              <div className="mt-0.5 p-2 bg-muted/50 rounded border text-xs text-center font-mono">
                                {calculateVolume(dimensions.length, dimensions.width, dimensions.height)} cm³
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Actions Bar */}
                    <div className="flex items-center justify-between pt-3 border-t mt-4 bg-muted/20 p-3 rounded-md">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Switch 
                            id="is_active"
                            name="is_active"
                            defaultChecked={true}
                            className="scale-90"
                          />
                          <Label htmlFor="is_active" className="text-xs font-medium cursor-pointer">Active Product</Label>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setShowAddDialog(false)} 
                          className="h-8 px-4 text-xs hover-scale"
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={skuValidation.status === 'duplicate' || isSubmitting}
                          className="h-8 px-4 text-xs hover-scale bg-gradient-to-r from-primary to-primary/80"
                        >
                          {isSubmitting ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b border-white mr-1"></div>
                              Adding...
                            </>
                          ) : (
                            <>
                              <Plus className="h-3 w-3 mr-1" />
                              Add Product
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>

              {/* Create BOM Dialog */}
              <Dialog open={showBOMDialog} onOpenChange={setShowBOMDialog}>
                <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden">
                  <DialogHeader>
                    <DialogTitle></DialogTitle>
                    <DialogDescription>
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex-1 overflow-hidden">
                    <BOMModule />
                  </div>
                </DialogContent>
              </Dialog>

              {canEdit && (
                <Button 
                  className={cn(showBOMDialog && "bg-primary/90")}
                  onClick={() => setShowBOMDialog(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create BOM
                </Button>
              )}

              <Button 
                className={cn(showBinDialog && "bg-primary/90")}
                onClick={() => setShowBinDialog(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Warehouse BIN
              </Button>

              <Dialog open={showAdjustmentDialog} onOpenChange={setShowAdjustmentDialog}>
                <DialogTrigger asChild>
                  <Button className={cn(showAdjustmentDialog && "bg-primary/90")}>
                    <Plus className="w-4 h-4 mr-2" />
                    Inventory Adjustment
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create Inventory Adjustment</DialogTitle>
                    <DialogDescription>
                      Adjust stock levels with proper tracking and validation
                    </DialogDescription>
                  </DialogHeader>
                  <InventoryAdjustmentForm
                    onSuccess={() => {
                      setShowAdjustmentDialog(false);
                      setAdjustmentRefreshTrigger(prev => prev + 1);
                      fetchProducts(); // Refresh products to show updated stock
                    }}
                    onCancel={() => setShowAdjustmentDialog(false)}
                  />
                </DialogContent>
              </Dialog>

              <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
                <DialogTrigger asChild>
                  <Button className={cn(showTransferDialog && "bg-primary/90")}>
                    <Plus className="w-4 h-4 mr-2" />
                    Inventory Transfer
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create Inventory Transfer</DialogTitle>
                    <DialogDescription>
                      Transfer stock between warehouses and bins
                    </DialogDescription>
                  </DialogHeader>
                  <InventoryTransferForm
                    onSuccess={() => {
                      setShowTransferDialog(false);
                      setAdjustmentRefreshTrigger(prev => prev + 1);
                      fetchProducts(); // Refresh products to show updated stock
                    }}
                    onCancel={() => setShowTransferDialog(false)}
                  />
                </DialogContent>
              </Dialog>

              <WarehouseBinForm 
                open={showBinDialog}
                onOpenChange={setShowBinDialog}
                onSuccess={() => {
                  setShowBinDialog(false);
                  fetchWarehouseBins();
                }}
              />
            </>
          )}
        </div>
      </div>

      <Tabs defaultValue="products" className="w-full">
         <TabsList className="grid w-full grid-cols-6 border-b border-border">
          <TabsTrigger 
            value="products" 
            className="data-[state=active]:bg-green-500 data-[state=active]:text-white"
          >
            Products
          </TabsTrigger>
          <TabsTrigger 
            value="bom"
            className="data-[state=active]:bg-yellow-500 data-[state=active]:text-white"
          >
            BOM
          </TabsTrigger>
          <TabsTrigger 
            value="bins"
            className="data-[state=active]:bg-green-500 data-[state=active]:text-white"
          >
            Warehouse BINs
          </TabsTrigger>
          <TabsTrigger 
            value="adjustments"
            className="data-[state=active]:bg-green-500 data-[state=active]:text-white"
          >
            Adjustments
          </TabsTrigger>
          <TabsTrigger 
            value="transactions"
            className="data-[state=active]:bg-green-500 data-[state=active]:text-white"
          >
            Transactions
          </TabsTrigger>
          <TabsTrigger 
            value="stock"
            className="data-[state=active]:bg-green-500 data-[state=active]:text-white"
          >
            Current Stock
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-6">

          {/* Search and Export */}
            <div className="flex justify-between items-center">
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search products..." aria-label="Search products by name, SKU, or description"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={exportToExcel}>
                  <Download className="w-4 h-4 mr-2" />
                  Export to Excel
                </Button>
              </div>
            </div>

          {/* Products Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer" onClick={() => handleSort('sku')}>
                      <div className="flex items-center space-x-2">
                        <span>SKU</span>
                        {getSortIcon('sku')}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort('name')}>
                      <div className="flex items-center space-x-2">
                        <span>Name</span>
                        {getSortIcon('name')}
                      </div>
                    </TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort('unit_price')}>
                      <div className="flex items-center space-x-2">
                        <span>Unit Price</span>
                        {getSortIcon('unit_price')}
                      </div>
                    </TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Status</TableHead>
                    {canEdit && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                 <TableBody>
                   {currentProducts.length === 0 ? (
                     <TableRow>
                       <TableCell colSpan={canEdit ? 8 : 7} className="text-center py-8 text-muted-foreground">
                         {searchTerm ? 'No products found matching your search.' : 'No products available.'}
                       </TableCell>
                     </TableRow>
                   ) : (
                     currentProducts.map((product) => (
                       <TableRow key={product.id}>
                         <TableCell className="font-medium">{product.sku}</TableCell>
                         <TableCell>
                           <div>
                             <div className="font-medium">{product.name}</div>
                             {product.description && (
                               <div className="text-sm text-muted-foreground">{product.description}</div>
                             )}
                           </div>
                         </TableCell>
                         <TableCell>
                           <Badge variant={product.product_type === 'goods' ? 'default' : 'secondary'}>
                             {product.product_type === 'goods' ? 'Goods' : 'Service'}
                           </Badge>
                         </TableCell>
                         <TableCell>
                           <Badge variant="outline">
                             {product.product_category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                           </Badge>
                         </TableCell>
                         <TableCell>₹{product.unit_price.toLocaleString()}</TableCell>
                         <TableCell>{product.unit || 'N/A'}</TableCell>
                         <TableCell>
                           <Badge variant={product.is_active ? 'default' : 'secondary'}>
                             {product.is_active ? 'Active' : 'Inactive'}
                           </Badge>
                         </TableCell>
                         {canEdit && (
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setViewingProduct(product);
                                    setShowViewDialog(true);
                                  }}
                                  className="hover:bg-green-50 hover:text-green-600"
                                  title="View Details"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                 <Button
                                   variant="outline"
                                   size="sm"
                                   onClick={() => {
                                     setEditingProduct(product);
                                     setShowEditDialog(true);
                                   }}
                                   title="Edit Product"
                                   className="hover:bg-blue-50 hover:text-blue-600"
                                 >
                                   <Edit className="w-4 h-4" />
                                 </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        title={productsWithTransactions.has(product.id) ? "Cannot delete product with transactions" : "Delete Product"}
                                        className={`${productsWithTransactions.has(product.id) 
                                          ? "opacity-50 cursor-not-allowed" 
                                          : "hover:bg-red-50 hover:text-red-600"}`}
                                        disabled={productsWithTransactions.has(product.id)}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Product</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete "{product.name}" (SKU: {product.sku})? 
                                          This will mark the product as inactive and it will no longer appear in active lists.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction 
                                          onClick={() => handleDeleteProduct(product.id)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Delete Product
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                              </div>
                            </TableCell>
                         )}
                       </TableRow>
                     ))
                   )}
                 </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredProducts.length)} of {filteredProducts.length} products
              </p>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="bins">
          <WarehouseBinTable 
            onEdit={(bin) => {
              // Handle edit - you can implement this based on your needs
              console.log('Edit bin:', bin);
            }}
            onDelete={(bin) => {
              // Handle delete - you can implement this based on your needs
              console.log('Delete bin:', bin);
            }}
          />
        </TabsContent>

        <TabsContent value="adjustments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <ClipboardList className="w-5 h-5" />
                <span>Inventory Adjustments History</span>
              </CardTitle>
              <CardDescription>
                Track all inventory adjustments with detailed audit trail
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InventoryAdjustmentTable refreshTrigger={adjustmentRefreshTrigger} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5" />
                <span>Inventory Transactions</span>
              </CardTitle>
              <CardDescription>
                Complete movement history for all inventory transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InventoryTransactionTable refreshTrigger={adjustmentRefreshTrigger} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stock" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Package className="w-5 h-5" />
                <span>Enhanced Stock Management System</span>
              </CardTitle>
              <CardDescription>
                Advanced inventory tracking with allocation management and comprehensive analytics
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <EnhancedCurrentStockSystem />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bom">
          <BOMModule />
        </TabsContent>
      </Tabs>

      {/* Product View Dialog */}
      <ProductViewDialog
        open={showViewDialog}
        onOpenChange={setShowViewDialog}
        product={viewingProduct}
      />

      {/* Edit Product Dialog */}
      <EditProductDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        product={editingProduct}
        onProductUpdated={() => {
          fetchProducts();
          setAdjustmentRefreshTrigger(prev => prev + 1);
        }}
      />
    </div>
  );
}
