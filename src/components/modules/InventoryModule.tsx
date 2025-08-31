import { useState, useEffect, useMemo } from 'react';
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
import { Plus, Search, Package, AlertTriangle, Edit, Trash2, Download, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, MapPin, TrendingUp, ClipboardList } from 'lucide-react';
import { WarehouseBinForm } from '@/components/forms/WarehouseBinForm';
import { WarehouseBinTable } from '@/components/tables/WarehouseBinTable';
import { InventoryAdjustmentForm } from '@/components/forms/InventoryAdjustmentForm';
import { InventoryAdjustmentTable } from '@/components/tables/InventoryAdjustmentTable';
import { InventoryTransactionTable } from '@/components/tables/InventoryTransactionTable';
import { CurrentStockTable } from '@/components/tables/CurrentStockTable';
import * as XLSX from 'xlsx';

interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unit: string | null;
  cost_price: number;
  unit_price: number;
  hsn_code: string | null;
  gst_percentage: number;
  weight_kg: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  min_stock_level: number;
  max_stock_level: number | null;
  is_active: boolean;
  company_id: string;
  category_id: string | null;
  product_type: 'goods' | 'service';
  product_category: 'raw_material' | 'finished_goods' | 'consumables' | 'assets';
  created_at: string;
  updated_at: string;
}

export function InventoryModule() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { hasEditAccess } = useBusinessAuth();
  const canEdit = hasEditAccess('inventory');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showBinDialog, setShowBinDialog] = useState(false);
  const [showAdjustmentDialog, setShowAdjustmentDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adjustmentRefreshTrigger, setAdjustmentRefreshTrigger] = useState(0);
  const [warehouseBins, setWarehouseBins] = useState<any[]>([]);
  const [warehouseBinStats, setWarehouseBinStats] = useState<any[]>([]);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

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
  }, []);

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
        company_id: profile?.company_id,
        is_active: true
      };

      const { error } = await supabase
        .from('products')
        .insert([productData]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Product added successfully",
      });

      setShowAddDialog(false);
      fetchProducts();
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      console.error('Error adding product:', error);
      toast({
        title: "Error",
        description: "Failed to add product",
        variant: "destructive",
      });
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
  const totalValue = products.reduce((sum, product) => sum + (product.unit_price * product.min_stock_level), 0);
  const lowStockCount = products.filter(product => product.min_stock_level <= 10).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground">Manage your product inventory</p>
        </div>
        <div className="flex space-x-2">
          {canEdit && (
            <>
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Product
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add New Product</DialogTitle>
                    <DialogDescription>
                      Enter the product details below
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddProduct} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Basic Information */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-primary">Basic Information</h3>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="name" className="text-sm font-medium">Product Name *</Label>
                            <Input id="name" name="name" required className="mt-1" />
                          </div>
                          <div>
                            <Label htmlFor="sku" className="text-sm font-medium">SKU *</Label>
                            <Input id="sku" name="sku" required className="mt-1" />
                          </div>
                          <div>
                            <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                            <Textarea id="description" name="description" className="mt-1" />
                          </div>
                          <div>
                            <Label htmlFor="product_type" className="text-sm font-medium">Product Type *</Label>
                            <Select name="product_type" required>
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Select product type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="goods">Goods</SelectItem>
                                <SelectItem value="service">Service</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="product_category" className="text-sm font-medium">Product Category *</Label>
                            <Select name="product_category" required>
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="raw_material">Raw Material</SelectItem>
                                <SelectItem value="finished_goods">Finished Goods</SelectItem>
                                <SelectItem value="consumables">Consumables</SelectItem>
                                <SelectItem value="assets">Assets</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {/* Pricing & Stock */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-primary">Pricing & Stock</h3>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="unit" className="text-sm font-medium">Unit</Label>
                            <Input id="unit" name="unit" placeholder="e.g., pcs, kg, ltr" className="mt-1" />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="cost_price" className="text-sm font-medium">Cost Price *</Label>
                              <Input id="cost_price" name="cost_price" type="number" step="0.01" required className="mt-1" />
                            </div>
                            <div>
                              <Label htmlFor="unit_price" className="text-sm font-medium">Unit Price *</Label>
                              <Input id="unit_price" name="unit_price" type="number" step="0.01" required className="mt-1" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="min_stock_level" className="text-sm font-medium">Min Stock Level *</Label>
                              <Input id="min_stock_level" name="min_stock_level" type="number" required className="mt-1" />
                            </div>
                            <div>
                              <Label htmlFor="max_stock_level" className="text-sm font-medium">Max Stock Level</Label>
                              <Input id="max_stock_level" name="max_stock_level" type="number" className="mt-1" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Tax Information */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-primary">Tax Information</h3>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="hsn_code" className="text-sm font-medium">HSN Code</Label>
                            <Input id="hsn_code" name="hsn_code" className="mt-1" />
                          </div>
                          <div>
                            <Label htmlFor="gst_percentage" className="text-sm font-medium">GST Percentage</Label>
                            <Input id="gst_percentage" name="gst_percentage" type="number" step="0.01" defaultValue="0" className="mt-1" />
                          </div>
                        </div>
                      </div>

                      {/* Physical Dimensions */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-primary">Physical Dimensions</h3>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="weight_kg" className="text-sm font-medium">Weight (kg)</Label>
                            <Input id="weight_kg" name="weight_kg" type="number" step="0.01" className="mt-1" />
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <Label htmlFor="length_cm" className="text-sm font-medium">Length (cm)</Label>
                              <Input id="length_cm" name="length_cm" type="number" step="0.01" className="mt-1" />
                            </div>
                            <div>
                              <Label htmlFor="width_cm" className="text-sm font-medium">Width (cm)</Label>
                              <Input id="width_cm" name="width_cm" type="number" step="0.01" className="mt-1" />
                            </div>
                            <div>
                              <Label htmlFor="height_cm" className="text-sm font-medium">Height (cm)</Label>
                              <Input id="height_cm" name="height_cm" type="number" step="0.01" className="mt-1" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2 pt-4 border-t">
                      <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">Add Product</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>

              <Button variant="outline" onClick={() => setShowBinDialog(true)}>
                <MapPin className="w-4 h-4 mr-2" />
                Create Warehouse BIN
              </Button>

              <Dialog open={showAdjustmentDialog} onOpenChange={setShowAdjustmentDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <ClipboardList className="w-4 h-4 mr-2" />
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="bins">Warehouse BINs</TabsTrigger>
          <TabsTrigger value="adjustments">Adjustments</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="stock">Current Stock</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalProducts}</div>
                <p className="text-xs text-muted-foreground">Active products in inventory</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Value</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{totalValue.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Total inventory value</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{lowStockCount}</div>
                <p className="text-xs text-muted-foreground">Items with low stock</p>
              </CardContent>
            </Card>
          </div>

          {/* Search and Export */}
          <div className="flex justify-between items-center">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={exportToExcel}>
              <Download className="w-4 h-4 mr-2" />
              Export to Excel
            </Button>
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
                  {currentProducts.map((product) => (
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
                              onClick={() => handleEditProduct(product)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteProduct(product.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
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
          <WarehouseBinTable />
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
                <span>Current Stock Levels (SOH)</span>
              </CardTitle>
              <CardDescription>
                Real-time stock on hand calculated from all inventory transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CurrentStockTable refreshTrigger={adjustmentRefreshTrigger} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Product Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>
              Update the product details below
            </DialogDescription>
          </DialogHeader>
          {editingProduct && (
            <form onSubmit={handleUpdateProduct} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary">Basic Information</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="edit_name" className="text-sm font-medium">Product Name *</Label>
                      <Input id="edit_name" name="name" required defaultValue={editingProduct.name} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="edit_sku" className="text-sm font-medium">SKU *</Label>
                      <Input id="edit_sku" name="sku" required defaultValue={editingProduct.sku} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="edit_description" className="text-sm font-medium">Description</Label>
                      <Textarea id="edit_description" name="description" defaultValue={editingProduct.description || ''} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="edit_product_type" className="text-sm font-medium">Product Type *</Label>
                      <Select name="product_type" defaultValue={editingProduct.product_type} required>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select product type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="goods">Goods</SelectItem>
                          <SelectItem value="service">Service</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="edit_product_category" className="text-sm font-medium">Product Category *</Label>
                      <Select name="product_category" defaultValue={editingProduct.product_category} required>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="raw_material">Raw Material</SelectItem>
                          <SelectItem value="finished_goods">Finished Goods</SelectItem>
                          <SelectItem value="consumables">Consumables</SelectItem>
                          <SelectItem value="assets">Assets</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Continue with same form structure as add dialog */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary">Pricing & Stock</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="edit_unit" className="text-sm font-medium">Unit</Label>
                      <Input id="edit_unit" name="unit" defaultValue={editingProduct.unit || ''} className="mt-1" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="edit_cost_price" className="text-sm font-medium">Cost Price *</Label>
                        <Input id="edit_cost_price" name="cost_price" type="number" step="0.01" required defaultValue={editingProduct.cost_price} className="mt-1" />
                      </div>
                      <div>
                        <Label htmlFor="edit_unit_price" className="text-sm font-medium">Unit Price *</Label>
                        <Input id="edit_unit_price" name="unit_price" type="number" step="0.01" required defaultValue={editingProduct.unit_price} className="mt-1" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="edit_min_stock_level" className="text-sm font-medium">Min Stock Level *</Label>
                        <Input id="edit_min_stock_level" name="min_stock_level" type="number" required defaultValue={editingProduct.min_stock_level} className="mt-1" />
                      </div>
                      <div>
                        <Label htmlFor="edit_max_stock_level" className="text-sm font-medium">Max Stock Level</Label>
                        <Input id="edit_max_stock_level" name="max_stock_level" type="number" defaultValue={editingProduct.max_stock_level || ''} className="mt-1" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary">Tax Information</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="edit_hsn_code" className="text-sm font-medium">HSN Code</Label>
                      <Input id="edit_hsn_code" name="hsn_code" defaultValue={editingProduct.hsn_code || ''} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="edit_gst_percentage" className="text-sm font-medium">GST Percentage</Label>
                      <Input id="edit_gst_percentage" name="gst_percentage" type="number" step="0.01" defaultValue={editingProduct.gst_percentage} className="mt-1" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary">Physical Dimensions</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="edit_weight_kg" className="text-sm font-medium">Weight (kg)</Label>
                      <Input id="edit_weight_kg" name="weight_kg" type="number" step="0.01" defaultValue={editingProduct.weight_kg || ''} className="mt-1" />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="edit_length_cm" className="text-sm font-medium">Length (cm)</Label>
                        <Input id="edit_length_cm" name="length_cm" type="number" step="0.01" defaultValue={editingProduct.length_cm || ''} className="mt-1" />
                      </div>
                      <div>
                        <Label htmlFor="edit_width_cm" className="text-sm font-medium">Width (cm)</Label>
                        <Input id="edit_width_cm" name="width_cm" type="number" step="0.01" defaultValue={editingProduct.width_cm || ''} className="mt-1" />
                      </div>
                      <div>
                        <Label htmlFor="edit_height_cm" className="text-sm font-medium">Height (cm)</Label>
                        <Input id="edit_height_cm" name="height_cm" type="number" step="0.01" defaultValue={editingProduct.height_cm || ''} className="mt-1" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit">Update Product</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}