import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';

const formSchema = z.object({
  product_id: z.string().min(1, 'Product is required'),
  warehouse_id: z.string().min(1, 'Warehouse/Bin is required'),
  adjustment_type: z.enum(['positive', 'negative'], {
    required_error: 'Adjustment type is required',
  }),
  reason: z.enum(['opening_balance', 'damage', 'audit', 'scrap', 'transfer', 'other'], {
    required_error: 'Reason is required',
  }),
  adjustment_quantity: z.number().min(1, 'Quantity must be greater than 0'),
  adjustment_amount: z.number().optional(),
  remarks: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface Product {
  id: string;
  name: string;
  sku: string;
  stock_quantity: number;
}

interface WarehouseBin {
  id: string;
  warehouse_code: string;
  warehouse_name: string;
  bin_name: string;
  wh_bin_code: string;
}

interface InventoryAdjustmentFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const InventoryAdjustmentForm: React.FC<InventoryAdjustmentFormProps> = ({
  onSuccess,
  onCancel,
}) => {
  const { user, company } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouseBins, setWarehouseBins] = useState<WarehouseBin[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      adjustment_quantity: 1,
      adjustment_amount: 0,
    },
  });

  const adjustmentType = form.watch('adjustment_type');
  const adjustmentQuantity = form.watch('adjustment_quantity');

  useEffect(() => {
    if (company) {
      fetchProducts();
      fetchWarehouseBins();
    }
  }, [company]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, stock_quantity')
        .eq('company_id', company?.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch products',
        variant: 'destructive',
      });
    }
  };

  const fetchWarehouseBins = async () => {
    try {
      const { data, error } = await supabase
        .from('warehouse_bins')
        .select('id, warehouse_code, warehouse_name, bin_name, wh_bin_code')
        .eq('company_id', company?.id)
        .eq('is_active', true)
        .order('warehouse_name, bin_name');

      if (error) throw error;
      setWarehouseBins(data || []);
    } catch (error) {
      console.error('Error fetching warehouse bins:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch warehouse bins',
        variant: 'destructive',
      });
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!user || !company) return;

    // Validate negative adjustment
    if (data.adjustment_type === 'negative' && selectedProduct) {
      if (data.adjustment_quantity > selectedProduct.stock_quantity) {
        toast({
          title: 'Invalid Quantity',
          description: `Cannot reduce stock by ${data.adjustment_quantity}. Current stock is ${selectedProduct.stock_quantity}`,
          variant: 'destructive',
        });
        return;
      }
    }

    setLoading(true);

    try {
      const currentStockBefore = selectedProduct?.stock_quantity || 0;
      const currentStockAfter = data.adjustment_type === 'positive'
        ? currentStockBefore + data.adjustment_quantity
        : currentStockBefore - data.adjustment_quantity;

      const { error } = await supabase
        .from('inventory_adjustments')
        .insert({
          company_id: company.id,
          product_id: data.product_id,
          warehouse_id: data.warehouse_id,
          adjustment_type: data.adjustment_type,
          reason: data.reason,
          adjustment_quantity: data.adjustment_quantity,
          adjustment_amount: data.adjustment_amount || 0,
          remarks: data.remarks,
          current_stock_before: currentStockBefore,
          current_stock_after: currentStockAfter,
          created_by: user.id,
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Inventory adjustment created successfully',
      });

      onSuccess();
    } catch (error) {
      console.error('Error creating inventory adjustment:', error);
      toast({
        title: 'Error',
        description: 'Failed to create inventory adjustment',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProductChange = (productId: string) => {
    const product = products.find(p => p.id === productId);
    setSelectedProduct(product || null);
  };

  const reasonOptions = [
    { value: 'opening_balance', label: 'Opening Balance' },
    { value: 'damage', label: 'Damage' },
    { value: 'audit', label: 'Audit' },
    { value: 'scrap', label: 'Scrap' },
    { value: 'transfer', label: 'Transfer' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="product_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Product</FormLabel>
                <Select 
                  onValueChange={(value) => {
                    field.onChange(value);
                    handleProductChange(value);
                  }} 
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} ({product.sku}) - Stock: {product.stock_quantity}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="warehouse_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Warehouse & Bin</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select warehouse & bin" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {warehouseBins.map((bin) => (
                      <SelectItem key={bin.id} value={bin.id}>
                        {bin.warehouse_name} ({bin.warehouse_code}) - {bin.bin_name} ({bin.wh_bin_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="adjustment_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Adjustment Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select adjustment type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="positive">Positive (Add Stock)</SelectItem>
                    <SelectItem value="negative">Negative (Reduce Stock)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reason</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {reasonOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="adjustment_quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Adjustment Quantity</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min="1" 
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  />
                </FormControl>
                {adjustmentType === 'negative' && selectedProduct && adjustmentQuantity > selectedProduct.stock_quantity && (
                  <p className="text-sm text-destructive">
                    Quantity exceeds available stock ({selectedProduct.stock_quantity})
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="adjustment_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Adjustment Amount (Optional)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01" 
                    min="0"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="remarks"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Additional Remarks</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter any additional notes..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Adjustment'}
          </Button>
        </div>
      </form>
    </Form>
  );
};