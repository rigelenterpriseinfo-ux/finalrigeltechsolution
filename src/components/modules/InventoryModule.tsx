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
import { Plus, Search, Package, AlertTriangle, Edit, Trash2, Eye, Download, Upload, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, MapPin, TrendingUp, ClipboardList, ArrowRightLeft, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
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
import { BulkUploadDialog } from '@/components/dialogs/BulkUploadDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
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
  stock_quantity: number;
}

export default function InventoryModule() {
  const { user } = useAuth();
  const { profile, businessUser } = useBusinessAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // State management
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
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
  
  // Bulk upload states
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  
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

  // Check permissions
  const canEdit = businessUser?.access_type === 'OWNER' || businessUser?.access_type === 'ADMIN' || profile?.role === 'owner' || profile?.role === 'admin';
  const canDelete = canEdit;

  // Debounced SKU validation
  const validateSKU = useCallback(async (sku: string) => {
    if (!sku.trim()) {
      setSkuValidation({ status: 'idle', message: '' });
      return;
    }

    setSkuValidation({ status: 'checking', message: 'Checking SKU availability...' });

    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, sku, name, is_active')
        .eq('company_id', profile?.company_id)
        .eq('sku', sku.trim())
        .maybeSingle();

      if (error) throw error;

      if (data) {
        if (data.is_active) {
          setSkuValidation({ 
            status: 'duplicate', 
            message: `SKU "${sku}" is already in use by "${data.name}"` 
          });
        } else {
          setSkuValidation({ 
            status: 'inactive_found', 
            message: `Found inactive product "${data.name}" with this SKU`,
            inactiveProduct: data
          });
        }
      } else {
        setSkuValidation({ status: 'valid', message: 'SKU is available' });
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

  // Track products with inventory transactions
  const [productsWithTransactions, setProductsWithTransactions] = useState<Set<string>>(new Set());

  useEffect(() => {
    // When products are deleted, clear them from the form state
    if (deletingProduct) {
      setEditingProduct(null);
      setViewingProduct(null);
    }
  }, [deletingProduct]);

  useEffect(() => {
    const calculateBinStats = () => {
      const stats = warehouseBins.map(bin => {
        // Count products assigned to this bin
        const productsInBin = products.filter(product => 
          product.bin_name && product.bin_name.toLowerCase() === bin.bin_name.toLowerCase()
        ).length;

        return {
          ...bin,
          products_count: productsInBin
        };
      });
      
      setWarehouseBinStats(stats);
    };

    if (warehouseBins.length > 0 && products.length > 0) {
      calculateBinStats();
    }
  }, [warehouseBins, products]);

  // Check for products with inventory transactions
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
      console.error('Error checking products with transactions:', error);
    }
  };

  const calculateWarehouseBinStats = () => {
    const stats = warehouseBins.map(bin => {
      // Count products assigned to this bin
      const productsInBin = products.filter(product => 
        product.bin_name && product.bin_name.toLowerCase() === bin.bin_name.toLowerCase()
      ).length;
      
      // Calculate total value of products in this bin
      const totalValue = products
        .filter(product => 
          product.bin_name && product.bin_name.toLowerCase() === bin.bin_name.toLowerCase()
        )
        .reduce((sum, product) => sum + (product.unit_price * (product.stock_quantity || 0)), 0);

      return {
        ...bin,
        products_count: productsInBin,
        total_value: totalValue
      };
    });
    
    setWarehouseBinStats(stats);
  };

  const fetchWarehouseBins = async () => {
    try {
      const { data, error } = await supabase
        .from('warehouse_bins')
        .select('*')
        .eq('company_id', profile?.company_id)
        .order('bin_name');

      if (error) throw error;
      setWarehouseBins(data || []);
    } catch (error) {
      console.error('Error fetching warehouse bins:', error);
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

  // Fetch products
  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', profile?.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
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

  // Handle product creation
  const handleAddProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile?.company_id) {
      toast({
        title: "Error",
        description: "Company information not found",
        variant: "destructive",
      });
      return;
    }

    // Check if SKU is valid
    if (skuValidation.status === 'duplicate') {
      toast({
        title: "Invalid SKU",
        description: "Please use a different SKU as this one is already in use.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);

      // Calculate volume if dimensions are provided
      const length = parseFloat(formData.get('length_cm') as string) || null;
      const width = parseFloat(formData.get('width_cm') as string) || null;
      const height = parseFloat(formData.get('height_cm') as string) || null;
      const volumeCubicCm = (length && width && height) ? length * width * height : null;

      const productData = {
        sku: formData.get('sku') as string,
        name: formData.get('name') as string,
        description: formData.get('description') as string || null,
        unit: formData.get('unit') as string || null,
        cost_price: parseFloat(formData.get('cost_price') as string) || 0,
        unit_price: parseFloat(formData.get('unit_price') as string) || 0,
        mrp: parseFloat(formData.get('mrp') as string) || null,
        hsn_code: formData.get('hsn_code') as string || null,
        gst_percentage: parseFloat(formData.get('gst_percentage') as string) || 0,
        is_taxable: formData.get('is_taxable') === 'on',
        min_stock_level: parseInt(formData.get('min_stock_level') as string) || 0,
        max_stock_level: parseInt(formData.get('max_stock_level') as string) || null,
        weight_kg: parseFloat(formData.get('weight_kg') as string) || null,
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
      
      // Reset form validation state
      setSkuValue('');
      setSkuValidation({ status: 'idle', message: '' });
      
      // Reset form
      event.currentTarget.reset();

    } catch (error) {
      console.error('Error adding product:', error);
      toast({
        title: "Error",
        description: "Failed to add product",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle product deletion
  const handleDeleteProduct = async (product: Product) => {
    // Check if product has inventory transactions
    if (productsWithTransactions.has(product.id)) {
      toast({
        title: "Cannot Delete Product",
        description: "This product has inventory transactions and cannot be deleted. Consider marking it as inactive instead.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Product deleted successfully",
      });

      fetchProducts();
      setDeletingProduct(null);
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive",
      });
    }
  };

  // Toggle product active status
  const toggleProductStatus = async (product: Product) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: !product.is_active })
        .eq('id', product.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Product ${!product.is_active ? 'activated' : 'deactivated'} successfully`,
      });

      fetchProducts();
    } catch (error) {
      console.error('Error updating product status:', error);
      toast({
        title: "Error",
        description: "Failed to update product status",
        variant: "destructive",
      });
    }
  };

  // Sorting function
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let filtered = products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (sortConfig !== null) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof Product];
        const bValue = b[sortConfig.key as keyof Product];

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
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
                    setSkuValue('');
                    setSkuValidation({ status: 'idle', message: '' });
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button className="bg-blue-500 hover:bg-blue-600 text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Product
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add New Product</DialogTitle>
                    <DialogDescription>
                      Create a new product with detailed information
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddProduct} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="sku">SKU *</Label>
                        <Input
                          id="sku"
                          name="sku"
                          placeholder="Product SKU"
                          required
                          value={skuValue}
                          onChange={(e) => setSkuValue(e.target.value)}
                          className={`${
                            skuValidation.status === 'valid' ? 'border-green-500' :
                            skuValidation.status === 'duplicate' ? 'border-red-500' :
                            skuValidation.status === 'inactive_found' ? 'border-yellow-500' : ''
                          }`}
                        />
                        {skuValidation.message && (
                          <p className={`text-xs ${
                            skuValidation.status === 'valid' ? 'text-green-600' :
                            skuValidation.status === 'duplicate' ? 'text-red-600' :
                            skuValidation.status === 'inactive_found' ? 'text-yellow-600' :
                            'text-gray-500'
                          }`}>
                            {skuValidation.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="name">Product Name *</Label>
                        <Input
                          id="name"
                          name="name"
                          placeholder="Product name"
                          required
                        />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          name="description"
                          placeholder="Product description"
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="product_type">Product Type *</Label>
                        <Select name="product_type" defaultValue="goods">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="goods">Goods</SelectItem>
                            <SelectItem value="service">Service</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="product_category">Category *</Label>
                        <Select name="product_category" defaultValue="raw_material">
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
                      <div className="space-y-2">
                        <Label htmlFor="unit">Unit</Label>
                        <Input
                          id="unit"
                          name="unit"
                          placeholder="e.g., pcs, kg, meters"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cost_price">Cost Price *</Label>
                        <Input
                          id="cost_price"
                          name="cost_price"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="unit_price">Selling Price *</Label>
                        <Input
                          id="unit_price"
                          name="unit_price"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="mrp">MRP</Label>
                        <Input
                          id="mrp"
                          name="mrp"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="hsn_code">HSN Code</Label>
                        <Input
                          id="hsn_code"
                          name="hsn_code"
                          placeholder="HSN/SAC Code"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="gst_percentage">GST %</Label>
                        <Input
                          id="gst_percentage"
                          name="gst_percentage"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          disabled={!isTaxable}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="min_stock_level">Min Stock Level</Label>
                        <Input
                          id="min_stock_level"
                          name="min_stock_level"
                          type="number"
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="max_stock_level">Max Stock Level</Label>
                        <Input
                          id="max_stock_level"
                          name="max_stock_level"
                          type="number"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="weight_kg">Weight (kg)</Label>
                        <Input
                          id="weight_kg"
                          name="weight_kg"
                          type="number"
                          step="0.001"
                          placeholder="0.000"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="length_cm">Length (cm)</Label>
                        <Input
                          id="length_cm"
                          name="length_cm"
                          type="number"
                          step="0.1"
                          placeholder="0.0"
                          value={dimensions.length}
                          onChange={(e) => setDimensions(prev => ({ ...prev, length: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="width_cm">Width (cm)</Label>
                        <Input
                          id="width_cm"
                          name="width_cm"
                          type="number"
                          step="0.1"
                          placeholder="0.0"
                          value={dimensions.width}
                          onChange={(e) => setDimensions(prev => ({ ...prev, width: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="height_cm">Height (cm)</Label>
                        <Input
                          id="height_cm"
                          name="height_cm"
                          type="number"
                          step="0.1"
                          placeholder="0.0"
                          value={dimensions.height}
                          onChange={(e) => setDimensions(prev => ({ ...prev, height: e.target.value }))}
                        />
                      </div>
                    </div>

                    {dimensions.length && dimensions.width && dimensions.height && (
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-700">
                          Calculated Volume: {calculateVolume(dimensions.length, dimensions.width, dimensions.height)} cubic cm
                        </p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="barcode">Barcode</Label>
                      <Input
                        id="barcode"
                        name="barcode"
                        placeholder="Product barcode"
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="is_taxable"
                        name="is_taxable"
                        checked={isTaxable}
                        onCheckedChange={setIsTaxable}
                      />
                      <Label htmlFor="is_taxable">Taxable Product</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="is_active"
                        name="is_active"
                        defaultChecked
                      />
                      <Label htmlFor="is_active">Active Product</Label>
                    </div>

                    <div className="flex justify-end space-x-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={isSubmitting || skuValidation.status === 'duplicate'}
                      >
                        {isSubmitting ? 'Adding...' : 'Add Product'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
              <Button 
                onClick={() => setShowBinDialog(true)} 
                className="bg-green-500 hover:bg-green-600 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Warehouse BIN
              </Button>
              <Button 
                onClick={() => setShowAdjustmentDialog(true)} 
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Inventory Adjustment
              </Button>
              <Button 
                onClick={() => setShowTransferDialog(true)} 
                className="bg-green-500 hover:bg-green-600 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Inventory Transfer
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs defaultValue="products" className="w-full">
         <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger 
            value="products" 
            className="data-[state=active]:bg-green-500 data-[state=active]:text-white"
          >
            Products
          </TabsTrigger>
          <TabsTrigger 
            value="bins" 
            className="data-[state=active]:bg-purple-500 data-[state=active]:text-white"
          >
            Warehouse BINs
          </TabsTrigger>
          <TabsTrigger 
            value="adjustments" 
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
          >
            Adjustments
          </TabsTrigger>
          <TabsTrigger 
            value="transactions" 
            className="data-[state=active]:bg-red-500 data-[state=active]:text-white"
          >
            Transactions
          </TabsTrigger>
          <TabsTrigger 
            value="current_stock" 
            className="data-[state=active]:bg-teal-500 data-[state=active]:text-white"
          >
            Current Stock
          </TabsTrigger>
          <TabsTrigger 
            value="bom" 
            className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white"
          >
            BOM
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalProducts}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Value</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{totalValue.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Low Stock Alert</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{lowStockCount}</div>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
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
                <Button variant="outline" onClick={() => setShowBulkUpload(true)}>
                  <Upload className="w-4 h-4 mr-2" />
                  Bulk Upload
                </Button>
                <Button variant="outline" onClick={exportToExcel}>
                  <Download className="w-4 h-4 mr-2" />
                  Export to Excel
                </Button>
              </div>
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
                        {sortConfig?.key === 'sku' && (
                          sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort('name')}>
                      <div className="flex items-center space-x-2">
                        <span>Name</span>
                        {sortConfig?.key === 'name' && (
                          sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort('unit_price')}>
                      <div className="flex items-center space-x-2">
                        <span>Unit Price</span>
                        {sortConfig?.key === 'unit_price' && (
                          sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{product.name}</div>
                          {product.description && (
                            <div className="text-sm text-muted-foreground truncate max-w-xs">
                              {product.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.product_type === 'goods' ? 'default' : 'secondary'}>
                          {product.product_type === 'goods' ? 'Goods' : 'Service'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="capitalize">
                          {product.product_category.replace('_', ' ')}
                        </span>
                      </TableCell>
                      <TableCell>₹{product.unit_price.toLocaleString()}</TableCell>
                      <TableCell>{product.unit || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Badge variant={product.is_active ? 'default' : 'secondary'}>
                            {product.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          {canEdit && (
                            <Switch
                              checked={product.is_active}
                            onCheckedChange={() => toggleProductStatus(product)}
                          />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setViewingProduct(product);
                              setShowViewDialog(true);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingProduct(product);
                                setShowEditDialog(true);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeletingProduct(product)}
                                  disabled={productsWithTransactions.has(product.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Product</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{product.name}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteProduct(product)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
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

        <TabsContent value="adjustments">
          <InventoryAdjustmentTable refreshTrigger={adjustmentRefreshTrigger} />
        </TabsContent>

        <TabsContent value="transactions">
          <InventoryTransactionTable refreshTrigger={adjustmentRefreshTrigger} />
        </TabsContent>

        <TabsContent value="current_stock">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Current Stock Levels
              </CardTitle>
              <CardDescription>
                Real-time inventory levels across all products and locations
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

      {/* Bulk Upload Dialog */}
      <BulkUploadDialog
        open={showBulkUpload}
        onOpenChange={setShowBulkUpload}
        companyId={profile?.company_id}
        onUploadComplete={() => {
          fetchProducts();
          setAdjustmentRefreshTrigger(prev => prev + 1);
        }}
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

      {/* Warehouse Bin Dialog */}
      <Dialog open={showBinDialog} onOpenChange={setShowBinDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Warehouse BIN</DialogTitle>
            <DialogDescription>
              Add a new warehouse bin for better inventory organization
            </DialogDescription>
          </DialogHeader>
          <WarehouseBinForm
            onSuccess={() => {
              setShowBinDialog(false);
              fetchWarehouseBins();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Inventory Adjustment Dialog */}
      <Dialog open={showAdjustmentDialog} onOpenChange={setShowAdjustmentDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Inventory Adjustment</DialogTitle>
            <DialogDescription>
              Adjust inventory levels for products
            </DialogDescription>
          </DialogHeader>
          <InventoryAdjustmentForm
            onSuccess={() => {
              setShowAdjustmentDialog(false);
              fetchProducts();
              setAdjustmentRefreshTrigger(prev => prev + 1);
            }}
            onCancel={() => setShowAdjustmentDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Inventory Transfer Dialog */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Inventory Transfer</DialogTitle>
            <DialogDescription>
              Transfer inventory between warehouses or bins
            </DialogDescription>
          </DialogHeader>
          <InventoryTransferForm
            onSuccess={() => {
              setShowTransferDialog(false);
              fetchProducts();
              setAdjustmentRefreshTrigger(prev => prev + 1);
            }}
            onCancel={() => setShowTransferDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}