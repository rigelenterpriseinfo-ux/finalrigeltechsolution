import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, Package, X, RefreshCw, Barcode } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  stock_quantity: number;
  unit_price: number;
  category: string;
}

interface ItemSearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  onRefresh: () => void;
}

export const ItemSearchBox = ({ value, onChange, onRefresh }: ItemSearchBoxProps) => {
  const { company } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch products
  useEffect(() => {
    if (company?.id) {
      fetchProducts();
    }
  }, [company?.id]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select(`
          id, name, sku, barcode, stock_quantity, unit_price,
          product_category
        `)
        .eq('company_id', company?.id)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;

      const formattedProducts = (data || []).map(product => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        stock_quantity: product.stock_quantity,
        unit_price: product.unit_price,
        category: product.product_category,
      }));

      setProducts(formattedProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter products based on search
  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products.slice(0, 20); // Show top 20 products

    const term = searchTerm.toLowerCase();
    return products
      .filter(product => 
        product.name.toLowerCase().includes(term) ||
        product.sku.toLowerCase().includes(term) ||
        (product.barcode && product.barcode.toLowerCase().includes(term))
      )
      .slice(0, 50); // Limit results
  }, [products, searchTerm]);

  // Get selected product details
  const selectedProduct = products.find(p => p.id === value || p.sku === value);

  const handleSelect = (productId: string) => {
    onChange(productId);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = () => {
    onChange('');
    setSearchTerm('');
  };

  const handleBarcodeScan = () => {
    // Placeholder for barcode scanning functionality
    console.log('Barcode scan requested');
  };

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by product name, SKU, or barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={() => setIsOpen(true)}
                className="pl-10 pr-20 h-12"
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleBarcodeScan}
                  className="h-8 w-8 p-0"
                >
                  <Barcode className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onRefresh}
                  className="h-8 w-8 p-0"
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-96 p-0" align="start">
            <Command>
              <CommandInput 
                placeholder="Search products..." 
                value={searchTerm}
                onValueChange={setSearchTerm}
              />
              <CommandList>
                <CommandEmpty>
                  {loading ? 'Loading products...' : 'No products found.'}
                </CommandEmpty>
                <CommandGroup>
                  {filteredProducts.map((product) => (
                    <CommandItem
                      key={product.id}
                      value={product.id}
                      onSelect={() => handleSelect(product.id)}
                      className="flex items-center justify-between p-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{product.name}</div>
                          <div className="text-sm text-muted-foreground">
                            SKU: {product.sku}
                            {product.barcode && ` | Barcode: ${product.barcode}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="outline" className="text-xs">
                          {product.stock_quantity} units
                        </Badge>
                        <div className="text-sm font-medium text-right">
                          ₹{product.unit_price.toFixed(2)}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Selected Product Display */}
      {selectedProduct && (
        <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-2 bg-primary/10 rounded-md">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{selectedProduct.name}</div>
              <div className="text-sm text-muted-foreground">
                SKU: {selectedProduct.sku} | Stock: {selectedProduct.stock_quantity} units
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Quick Stats */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{products.length} products available</span>
        {searchTerm && (
          <span>{filteredProducts.length} matches found</span>
        )}
      </div>
    </div>
  );
};