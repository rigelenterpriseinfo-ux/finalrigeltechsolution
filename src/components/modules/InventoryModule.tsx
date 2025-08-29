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
import { Plus, Search, Package, AlertTriangle, Edit, Trash2, Download, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, MapPin, TrendingUp } from 'lucide-react';
import { WarehouseBinForm } from '@/components/forms/WarehouseBinForm';
import { WarehouseBinTable } from '@/components/tables/WarehouseBinTable';
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
  stock_quantity: number;
  min_stock_level: number;
  max_stock_level: number | null;
  is_active: boolean;
  company_id: string;
  category_id: string | null;
  wh_bin_code: string | null;
  bin_name: string | null;
  created_at: string;
  updated_at: string;
}

export function InventoryModule() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showBinDialog, setShowBinDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [warehouseBins, setWarehouseBins] = useState<any[]>([]);
  const [selectedBinCode, setSelectedBinCode] = useState('');
  const [selectedBinName, setSelectedBinName] = useState('');
  const [editSelectedBinCode, setEditSelectedBinCode] = useState('');
  const [editSelectedBinName, setEditSelectedBinName] = useState('');
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
      const binProducts = products.filter(product => product.wh_bin_code === bin.wh_bin_code);
      const totalUnits = binProducts.reduce((sum, product) => sum + product.stock_quantity, 0);
      const totalValue = binProducts.reduce((sum, product) => sum + (product.stock_quantity * product.cost_price), 0);
      
      return {
        binCode: bin.wh_bin_code,
        binName: bin.bin_name,
        totalUnits,
        totalValue
      };
    });

    // Add "Unassigned" bin for products without warehouse bin
    const unassignedProducts = products.filter(product => !product.wh_bin_code);
    if (unassignedProducts.length > 0) {
      const totalUnits = unassignedProducts.reduce((sum, product) => sum + product.stock_quantity, 0);
      const totalValue = unassignedProducts.reduce((sum, product) => sum + (product.stock_quantity * product.cost_price), 0);
      
      binStats.push({
        binCode: 'UNASSIGNED',
        binName: 'Unassigned',
        totalUnits,
        totalValue
      });
    }

    setWarehouseBinStats(binStats);
  };

  useEffect(() => {
    fetchProducts();
    fetchWarehouseBins();
  }, [profile?.company_id]);

  useEffect(() => {
    calculateWarehouseBinStats();
  }, [products, warehouseBins]);

  // Sort function
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleBinCodeChange = (binCode: string) => {
    setSelectedBinCode(binCode);
    const selectedBin = warehouseBins.find(bin => bin.wh_bin_code === binCode);
    if (selectedBin) {
      setSelectedBinName(selectedBin.bin_name);
    } else {
      setSelectedBinName('');
    }
  };

  const handleEditBinCodeChange = (binCode: string) => {
    setEditSelectedBinCode(binCode);
    const selectedBin = warehouseBins.find(bin => bin.wh_bin_code === binCode);
    if (selectedBin) {
      setEditSelectedBinName(selectedBin.bin_name);
    } else {
      setEditSelectedBinName('');
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching products:', error);
        return;
      }

      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Check if user has company_id
    if (!profile?.company_id) {
      toast({
        title: "Error",
        description: "User profile not found or company not set",
        variant: "destructive",
      });
      return;
    }
    
    // Store form reference before async operations
    const form = e.currentTarget;
    
    const formData = new FormData(form);
    const productData = {
      name: formData.get('name') as string,
      sku: formData.get('sku') as string,
      unit: formData.get('unit') as string,
      cost_price: parseFloat(formData.get('cost_price') as string),
      unit_price: parseFloat(formData.get('unit_price') as string),
      hsn_code: formData.get('hsn_code') as string || null,
      gst_percentage: parseFloat(formData.get('gst_percentage') as string) || 18,
      weight_kg: formData.get('weight_kg') ? parseFloat(formData.get('weight_kg') as string) : null,
      length_cm: formData.get('length_cm') ? parseFloat(formData.get('length_cm') as string) : null,
      width_cm: formData.get('width_cm') ? parseFloat(formData.get('width_cm') as string) : null,
      height_cm: formData.get('height_cm') ? parseFloat(formData.get('height_cm') as string) : null,
      description: formData.get('description') as string || null,
      min_stock_level: parseInt(formData.get('min_stock_level') as string),
      max_stock_level: formData.get('max_stock_level') ? parseInt(formData.get('max_stock_level') as string) : null,
      stock_quantity: parseInt(formData.get('stock_on_hand') as string) || 0,
      company_id: profile.company_id,
    };

    try {
      const { error } = await supabase
        .from('products')
        .insert([productData]);

      if (error) {
        console.error('Insert error:', error);
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Product added successfully",
      });

      setShowAddDialog(false);
      setSelectedBinCode('');
      setSelectedBinName('');
      fetchProducts();
      fetchWarehouseBins();
      
      // Reset form safely
      if (form) {
        form.reset();
      }
    } catch (error: any) {
      console.error('Catch error:', error);
      toast({
        title: "Error",
        description: "Failed to add product",
        variant: "destructive",
      });
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!editingProduct) return;
    
    const formData = new FormData(e.currentTarget);
    const updateData = {
      name: formData.get('name') as string,
      sku: formData.get('sku') as string,
      unit: formData.get('unit') as string,
      cost_price: parseFloat(formData.get('cost_price') as string),
      unit_price: parseFloat(formData.get('unit_price') as string),
      hsn_code: formData.get('hsn_code') as string || null,
      gst_percentage: parseFloat(formData.get('gst_percentage') as string) || 18,
      weight_kg: formData.get('weight_kg') ? parseFloat(formData.get('weight_kg') as string) : null,
      length_cm: formData.get('length_cm') ? parseFloat(formData.get('length_cm') as string) : null,
      width_cm: formData.get('width_cm') ? parseFloat(formData.get('width_cm') as string) : null,
      height_cm: formData.get('height_cm') ? parseFloat(formData.get('height_cm') as string) : null,
      description: formData.get('description') as string || null,
      min_stock_level: parseInt(formData.get('min_stock_level') as string),
      max_stock_level: formData.get('max_stock_level') ? parseInt(formData.get('max_stock_level') as string) : null,
      stock_quantity: parseInt(formData.get('stock_quantity') as string),
    };

    try {
      const { error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', editingProduct.id);

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Product updated successfully",
      });

      setShowEditDialog(false);
      setEditingProduct(null);
      fetchProducts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update product",
        variant: "destructive",
      });
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setShowEditDialog(true);
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm('Are you sure you want to delete this product?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Product deleted successfully",
      });

      fetchProducts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive",
      });
    }
  };

  // Enhanced search and sort functionality
  const filteredProducts = useMemo(() => {
    let filtered = products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.hsn_code && product.hsn_code.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Apply sorting
    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortConfig.key) {
          case 'sku':
            aValue = a.sku;
            bValue = b.sku;
            break;
          case 'name':
            aValue = a.name;
            bValue = b.name;
            break;
          case 'unit':
            aValue = a.unit || '';
            bValue = b.unit || '';
            break;
          case 'hsn_code':
            aValue = a.hsn_code || '';
            bValue = b.hsn_code || '';
            break;
          case 'stock_quantity':
            aValue = a.stock_quantity;
            bValue = b.stock_quantity;
            break;
          case 'cost_price':
            aValue = a.cost_price;
            bValue = b.cost_price;
            break;
          case 'unit_price':
            aValue = a.unit_price;
            bValue = b.unit_price;
            break;
          case 'gst_percentage':
            aValue = a.gst_percentage;
            bValue = b.gst_percentage;
            break;
          default:
            return 0;
        }

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

  // Reset to first page when search or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortConfig]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = filteredProducts.slice(startIndex, endIndex);

  // Pagination handlers
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const goToPrevious = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const goToNext = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const lowStockProducts = products.filter(product => 
    product.stock_quantity <= product.min_stock_level
  );

  const exportToExcel = () => {
    try {
      // Prepare data for export
      const exportData = filteredProducts.map(product => ({
        'SKU': product.sku,
        'Product Name': product.name,
        'Description': product.description || '',
        'Unit': product.unit || '',
        'HSN Code': product.hsn_code || '',
        'Cost Price (₹)': product.cost_price.toFixed(2),
        'Selling Price (₹)': product.unit_price.toFixed(2),
        'GST %': product.gst_percentage,
        'Current Stock': product.stock_quantity,
        'Min Stock Level': product.min_stock_level,
        'Max Stock Level': product.max_stock_level || '',
        'Weight (kg)': product.weight_kg || '',
        'Length (cm)': product.length_cm || '',
        'Width (cm)': product.width_cm || '',
        'Height (cm)': product.height_cm || '',
        'Status': product.is_active ? 'Active' : 'Inactive',
        'Created Date': new Date(product.created_at).toLocaleDateString('en-IN'),
        'Last Updated': new Date(product.updated_at).toLocaleDateString('en-IN')
      }));

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Auto-size columns
      const colWidths = Object.keys(exportData[0] || {}).map(key => ({
        wch: Math.max(key.length, 15)
      }));
      worksheet['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

      // Generate filename with current date
      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `Products_Export_${currentDate}.xlsx`;

      // Save file
      XLSX.writeFile(workbook, filename);

      toast({
        title: "Export Successful",
        description: `${filteredProducts.length} products exported to ${filename}`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: "An error occurred while exporting the data",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground">Manage your products, stock levels, and warehouse locations</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowBinDialog(true)} variant="outline">
            <MapPin className="h-4 w-4 mr-2" />
            Create Warehouse BIN
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Product</DialogTitle>
                <DialogDescription>Add a new product to your inventory</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddProduct} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Item Name *</Label>
                    <Input 
                      id="name" 
                      name="name" 
                      required 
                      minLength={2}
                      maxLength={100}
                      placeholder="Enter product name"
                      pattern="[A-Za-z0-9\s\-_]+"
                      title="Only letters, numbers, spaces, hyphens and underscores allowed"
                    />
                  </div>
                  <div>
                    <Label htmlFor="sku">SKU Number *</Label>
                    <Input 
                      id="sku" 
                      name="sku" 
                      required 
                      minLength={3}
                      maxLength={50}
                      placeholder="e.g., PROD-001"
                      pattern="[A-Za-z0-9\-_]+"
                      title="Only letters, numbers, hyphens and underscores allowed"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="unit">Unit *</Label>
                    <Select name="unit" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">Kg</SelectItem>
                        <SelectItem value="gram">Gram</SelectItem>
                        <SelectItem value="piece">Piece</SelectItem>
                        <SelectItem value="liter">Liter</SelectItem>
                        <SelectItem value="meter">Meter</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="hsn_code">HSN Code</Label>
                    <Input 
                      id="hsn_code" 
                      name="hsn_code" 
                      placeholder="8-digit numeric code"
                      pattern="[0-9]{4,8}"
                      title="HSN code must be 4-8 digits only"
                      maxLength={8}
                      onInput={(e) => {
                        const target = e.target as HTMLInputElement;
                        target.value = target.value.replace(/[^0-9]/g, '');
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="cost_price">Cost Price *</Label>
                    <Input 
                      id="cost_price" 
                      name="cost_price" 
                      type="number" 
                      step="0.01" 
                      min="0.01"
                      max="999999.99"
                      required 
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="unit_price">Selling Price *</Label>
                    <Input 
                      id="unit_price" 
                      name="unit_price" 
                      type="number" 
                      step="0.01" 
                      min="0.01"
                      max="999999.99"
                      required 
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="gst_percentage">GST % *</Label>
                    <Input 
                      id="gst_percentage" 
                      name="gst_percentage" 
                      type="number" 
                      step="0.01" 
                      min="0" 
                      max="100" 
                      defaultValue="18"
                      required
                      placeholder="18.00"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="description">Item Description</Label>
                  <Textarea 
                    id="description" 
                    name="description" 
                    maxLength={500}
                    placeholder="Enter product description (optional)"
                    className="resize-none"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="weight_kg">Weight (kg)</Label>
                    <Input 
                      id="weight_kg" 
                      name="weight_kg" 
                      type="number" 
                      step="0.001" 
                      min="0" 
                      max="99999.999"
                      placeholder="0.000" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="length_cm">Length (cm)</Label>
                    <Input 
                      id="length_cm" 
                      name="length_cm" 
                      type="number" 
                      step="0.1" 
                      min="0" 
                      max="99999.9"
                      placeholder="0.0" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="width_cm">Width (cm)</Label>
                    <Input 
                      id="width_cm" 
                      name="width_cm" 
                      type="number" 
                      step="0.1" 
                      min="0" 
                      max="99999.9"
                      placeholder="0.0" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="height_cm">Height (cm)</Label>
                    <Input 
                      id="height_cm" 
                      name="height_cm" 
                      type="number" 
                      step="0.1" 
                      min="0" 
                      max="99999.9"
                      placeholder="0.0" 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="wh_bin_code">WH BIN Code</Label>
                  <Select name="wh_bin_code" value={selectedBinCode} onValueChange={handleBinCodeChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select WH BIN Code" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouseBins.map((bin) => (
                        <SelectItem key={bin.id} value={bin.wh_bin_code}>
                          {bin.wh_bin_code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="bin_name">Bin Name</Label>
                  <Input 
                    name="bin_name" 
                    value={selectedBinName}
                    placeholder="Auto-filled when WH BIN Code is selected"
                    readOnly
                    className="bg-muted/50"
                  />
                </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="stock_on_hand">Stock on Hand *</Label>
                    <Input 
                      id="stock_on_hand" 
                      name="stock_on_hand" 
                      type="number" 
                      min="0" 
                      max="999999"
                      required 
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="min_stock_level">Min Stock Level *</Label>
                    <Input 
                      id="min_stock_level" 
                      name="min_stock_level" 
                      type="number" 
                      min="0" 
                      max="999999"
                      required 
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="max_stock_level">Max Stock Level</Label>
                    <Input 
                      id="max_stock_level" 
                      name="max_stock_level" 
                      type="number" 
                      min="1" 
                      max="999999"
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  <p className="font-medium mb-1">Field Guidelines:</p>
                  <ul className="space-y-1 text-xs">
                    <li>• HSN Code: Only numeric values (4-8 digits)</li>
                    <li>• SKU: Alphanumeric with hyphens/underscores only</li>
                    <li>• Prices: Must be positive values with up to 2 decimal places</li>
                    <li>• Stock levels: Whole numbers only</li>
                  </ul>
                </div>
                <Button type="submit" className="w-full">Add Product</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Edit Product Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>Update product information</DialogDescription>
          </DialogHeader>
          {editingProduct && (
            <form onSubmit={handleUpdateProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-name">Item Name *</Label>
                  <Input 
                    id="edit-name" 
                    name="name" 
                    defaultValue={editingProduct.name} 
                    required 
                    minLength={2}
                    maxLength={100}
                    pattern="[A-Za-z0-9\s\-_]+"
                    title="Only letters, numbers, spaces, hyphens and underscores allowed"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-sku">SKU Number *</Label>
                  <Input 
                    id="edit-sku" 
                    name="sku" 
                    defaultValue={editingProduct.sku} 
                    required 
                    minLength={3}
                    maxLength={50}
                    pattern="[A-Za-z0-9\-_]+"
                    title="Only letters, numbers, hyphens and underscores allowed"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-unit">Unit *</Label>
                  <Select name="unit" defaultValue={editingProduct.unit || ""} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">Kg</SelectItem>
                      <SelectItem value="gram">Gram</SelectItem>
                      <SelectItem value="piece">Piece</SelectItem>
                      <SelectItem value="liter">Liter</SelectItem>
                      <SelectItem value="meter">Meter</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-hsn_code">HSN Code</Label>
                  <Input 
                    id="edit-hsn_code" 
                    name="hsn_code" 
                    defaultValue={editingProduct.hsn_code || ""} 
                    placeholder="8-digit numeric code"
                    pattern="[0-9]{4,8}"
                    title="HSN code must be 4-8 digits only"
                    maxLength={8}
                    onInput={(e) => {
                      const target = e.target as HTMLInputElement;
                      target.value = target.value.replace(/[^0-9]/g, '');
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="edit-cost_price">Cost Price *</Label>
                  <Input 
                    id="edit-cost_price" 
                    name="cost_price" 
                    type="number" 
                    step="0.01" 
                    min="0.01"
                    max="999999.99"
                    defaultValue={editingProduct.cost_price} 
                    required 
                  />
                </div>
                <div>
                  <Label htmlFor="edit-unit_price">Selling Price *</Label>
                  <Input 
                    id="edit-unit_price" 
                    name="unit_price" 
                    type="number" 
                    step="0.01" 
                    min="0.01"
                    max="999999.99"
                    defaultValue={editingProduct.unit_price} 
                    required 
                  />
                </div>
                <div>
                  <Label htmlFor="edit-gst_percentage">GST % *</Label>
                  <Input 
                    id="edit-gst_percentage" 
                    name="gst_percentage" 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    max="100" 
                    defaultValue={editingProduct.gst_percentage}
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-description">Item Description</Label>
                <Textarea 
                  id="edit-description" 
                  name="description" 
                  defaultValue={editingProduct.description || ""} 
                  maxLength={500}
                  className="resize-none"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="edit-weight_kg">Weight (kg)</Label>
                  <Input 
                    id="edit-weight_kg" 
                    name="weight_kg" 
                    type="number" 
                    step="0.001" 
                    min="0" 
                    max="99999.999"
                    defaultValue={editingProduct.weight_kg || ""} 
                    placeholder="0.000" 
                  />
                </div>
                <div>
                  <Label htmlFor="edit-length_cm">Length (cm)</Label>
                  <Input 
                    id="edit-length_cm" 
                    name="length_cm" 
                    type="number" 
                    step="0.1" 
                    min="0" 
                    max="99999.9"
                    defaultValue={editingProduct.length_cm || ""} 
                    placeholder="0.0" 
                  />
                </div>
                <div>
                  <Label htmlFor="edit-width_cm">Width (cm)</Label>
                  <Input 
                    id="edit-width_cm" 
                    name="width_cm" 
                    type="number" 
                    step="0.1" 
                    min="0" 
                    max="99999.9"
                    defaultValue={editingProduct.width_cm || ""} 
                    placeholder="0.0" 
                  />
                </div>
                <div>
                  <Label htmlFor="edit-height_cm">Height (cm)</Label>
                  <Input 
                    id="edit-height_cm" 
                    name="height_cm" 
                    type="number" 
                    step="0.1" 
                    min="0" 
                    max="99999.9"
                    defaultValue={editingProduct.height_cm || ""} 
                    placeholder="0.0" 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-wh_bin_code">WH BIN Code</Label>
                  <Select name="wh_bin_code" value={editSelectedBinCode} onValueChange={handleEditBinCodeChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select WH BIN Code" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouseBins.map((bin) => (
                        <SelectItem key={bin.id} value={bin.wh_bin_code}>
                          {bin.wh_bin_code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-bin_name">Bin Name</Label>
                  <Input 
                    name="bin_name" 
                    value={editSelectedBinName}
                    placeholder="Auto-filled when WH BIN Code is selected"
                    readOnly
                    className="bg-muted/50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="edit-stock_quantity">Current Stock *</Label>
                  <Input 
                    id="edit-stock_quantity" 
                    name="stock_quantity" 
                    type="number" 
                    min="0" 
                    max="999999"
                    defaultValue={editingProduct.stock_quantity} 
                    required 
                  />
                </div>
                <div>
                  <Label htmlFor="edit-min_stock_level">Min Stock Level *</Label>
                  <Input 
                    id="edit-min_stock_level" 
                    name="min_stock_level" 
                    type="number" 
                    min="0" 
                    max="999999"
                    defaultValue={editingProduct.min_stock_level} 
                    required 
                  />
                </div>
                <div>
                  <Label htmlFor="edit-max_stock_level">Max Stock Level</Label>
                  <Input 
                    id="edit-max_stock_level" 
                    name="max_stock_level" 
                    type="number" 
                    min="1" 
                    max="999999"
                    defaultValue={editingProduct.max_stock_level || ""} 
                  />
                </div>
              </div>
              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                <p className="font-medium mb-1">Field Guidelines:</p>
                <ul className="space-y-1 text-xs">
                  <li>• HSN Code: Only numeric values (4-8 digits)</li>
                  <li>• SKU: Alphanumeric with hyphens/underscores only</li>
                  <li>• Prices: Must be positive values with up to 2 decimal places</li>
                  <li>• Stock levels: Whole numbers only</li>
                </ul>
              </div>
              <Button type="submit" className="w-full">Update Product</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Warehouse Bin Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Stock on Hand Card */}
        <div className="bg-card rounded-lg border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Stock on Hand</p>
              <p className="text-2xl font-bold">
                {warehouseBinStats.reduce((sum, stat) => sum + stat.totalUnits, 0)} Total units
              </p>
            </div>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <MapPin className="h-4 w-4 text-primary" />
            </div>
          </div>
          <div className="space-y-2">
            {warehouseBinStats.map((stat) => (
              <div key={stat.binCode} className="flex justify-between items-center py-2 px-3 bg-muted/50 rounded-md">
                <span className="text-sm font-medium">{stat.binName} ({stat.binCode})</span>
                <span className="text-sm font-bold">{stat.totalUnits}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Total Stock Value Card */}
        <div className="bg-card rounded-lg border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Stock Value</p>
              <p className="text-2xl font-bold">
                ₹{warehouseBinStats.reduce((sum, stat) => sum + stat.totalValue, 0).toFixed(2)}
              </p>
            </div>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
          </div>
          <div className="space-y-2">
            {warehouseBinStats.map((stat) => (
              <div key={stat.binCode} className="flex justify-between items-center py-2 px-3 bg-muted/50 rounded-md">
                <span className="text-sm font-medium">{stat.binName} ({stat.binCode})</span>
                <span className="text-sm font-bold">₹{stat.totalValue.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content - Tabbed Interface */}
      <Tabs defaultValue="products" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Products Management
          </TabsTrigger>
          <TabsTrigger value="warehouse" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Warehouse BIN Locations
          </TabsTrigger>
        </TabsList>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-6">
          {/* Low Stock Alert */}
          {lowStockProducts.length > 0 && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardHeader>
                <CardTitle className="text-yellow-800 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Low Stock Alert
                </CardTitle>
                <CardDescription className="text-yellow-700">
                  {lowStockProducts.length} product(s) are running low on stock
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {lowStockProducts.map((product) => (
                    <Badge key={product.id} variant="outline" className="text-yellow-800 border-yellow-300">
                      {product.name} ({product.stock_quantity} left)
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats Cards */}
          <div className="grid gap-6 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{products.length}</div>
                <p className="text-xs text-muted-foreground">
                  {products.filter(p => p.is_active).length} active products
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Stock on Hand</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {products.reduce((sum, p) => sum + p.stock_quantity, 0)}
                </div>
                <p className="text-xs text-muted-foreground">Total units</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Stock Value</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ₹{products.reduce((sum, p) => sum + (p.stock_quantity * p.cost_price), 0).toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">At cost price</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{lowStockProducts.length}</div>
                <p className="text-xs text-muted-foreground">Require attention</p>
              </CardContent>
            </Card>
          </div>

          {/* Search and Export */}
          <div className="flex items-center gap-4">
            <Button
              onClick={exportToExcel}
              variant="outline"
              className="flex items-center gap-2"
              disabled={filteredProducts.length === 0}
            >
              <Download className="h-4 w-4" />
              Export to Excel
            </Button>
            
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by SKU, Name, or HSN Code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Products Table */}
          <Card>
            <CardHeader>
              <CardTitle>Products</CardTitle>
              <CardDescription>Manage your product inventory</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 font-semibold hover:bg-transparent"
                        onClick={() => handleSort('sku')}
                      >
                        SKU
                        {sortConfig?.key === 'sku' ? (
                          sortConfig.direction === 'asc' ? (
                            <ArrowUp className="ml-1 h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 font-semibold hover:bg-transparent"
                        onClick={() => handleSort('name')}
                      >
                        Name
                        {sortConfig?.key === 'name' ? (
                          sortConfig.direction === 'asc' ? (
                            <ArrowUp className="ml-1 h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>HSN Code</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Cost Price</TableHead>
                    <TableHead>Selling Price</TableHead>
                    <TableHead>GST %</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.sku}</TableCell>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>{product.unit || '-'}</TableCell>
                      <TableCell>{product.hsn_code || '-'}</TableCell>
                      <TableCell>
                        <span className={product.stock_quantity <= product.min_stock_level ? 'text-yellow-600' : ''}>
                          {product.stock_quantity}
                        </span>
                      </TableCell>
                      <TableCell>₹{product.cost_price.toFixed(2)}</TableCell>
                      <TableCell>₹{product.unit_price.toFixed(2)}</TableCell>
                      <TableCell>{product.gst_percentage}%</TableCell>
                      <TableCell>
                        <Badge variant={product.is_active ? "default" : "secondary"}>
                          {product.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditProduct(product)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteProduct(product.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {currentProducts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground">
                        {filteredProducts.length === 0 ? 'No products found' : 'No products on this page'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              
              {/* Pagination */}
              {filteredProducts.length > 0 && totalPages > 1 && (
                <div className="flex items-center justify-between pt-6 border-t border-border">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <span>
                      Showing {startIndex + 1} to {Math.min(endIndex, filteredProducts.length)} of {filteredProducts.length} products
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToPrevious}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    
                    <div className="flex items-center space-x-1">
                      {getPageNumbers().map((page, index) => (
                        page === '...' ? (
                          <span key={`ellipsis-${index}`} className="px-3 py-2 text-sm text-muted-foreground">
                            ...
                          </span>
                        ) : (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => goToPage(page as number)}
                          >
                            {page}
                          </Button>
                        )
                      ))}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToNext}
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-1"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Warehouse BIN Locations Tab */}
        <TabsContent value="warehouse" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Warehouse BIN Locations
              </CardTitle>
              <CardDescription>
                Organize your inventory with warehouse bin locations for efficient storage management
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WarehouseBinTable />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Warehouse BIN Form Dialog */}
      <WarehouseBinForm
        open={showBinDialog}
        onOpenChange={setShowBinDialog}
        onSuccess={() => {
          // No need to refresh here as WarehouseBinTable manages its own state
        }}
      />
    </div>
  );
}
