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
  from_warehouse_id: z.string().min(1, 'From Warehouse/Bin is required'),
  to_warehouse_id: z.string().min(1, 'To Warehouse/Bin is required'),
  quantity: z.number().min(1, 'Quantity must be greater than 0'),
  reason: z.enum(['rebalancing', 'stock_movement', 'customer_return', 'other'], {
    required_error: 'Reason is required',
  }),
  remarks: z.string().min(1, 'Remarks are required'),
});

type FormData = z.infer<typeof formSchema>;

interface Product {
  id: string;
  name: string;
  sku: string;
}

interface WarehouseBin {
  id: string;
  warehouse_code: string;
  warehouse_name: string;
  bin_name: string;
  wh_bin_code: string;
}

interface InventoryTransferFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const InventoryTransferForm: React.FC<InventoryTransferFormProps> = ({
  onSuccess,
  onCancel,
}) => {
  const { user, company } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouseBins, setWarehouseBins] = useState<WarehouseBin[]>([]);
  const [fromWarehouseBins, setFromWarehouseBins] = useState<WarehouseBin[]>([]);
  const [toWarehouseBins, setToWarehouseBins] = useState<WarehouseBin[]>([]);
  const [sourceStock, setSourceStock] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: 1,
      remarks: '',
    },
  });

  const selectedProductId = form.watch('product_id');
  const selectedFromWarehouseId = form.watch('from_warehouse_id');
  const quantity = form.watch('quantity');

  useEffect(() => {
    if (company) {
      fetchProducts();
      fetchWarehouseBins();
    }
  }, [company]);

  useEffect(() => {
    if (selectedProductId && selectedFromWarehouseId) {
      fetchSourceStock();
    }
  }, [selectedProductId, selectedFromWarehouseId]);

  useEffect(() => {
    // Update available bins based on selected from warehouse
    if (selectedFromWarehouseId) {
      const selectedBin = warehouseBins.find(bin => bin.id === selectedFromWarehouseId);
      if (selectedBin) {
        setFromWarehouseBins([selectedBin]);
        // Filter out the selected from warehouse from to warehouse options
        setToWarehouseBins(warehouseBins.filter(bin => bin.id !== selectedFromWarehouseId));
      }
    } else {
      setFromWarehouseBins(warehouseBins);
      setToWarehouseBins(warehouseBins);
    }
  }, [selectedFromWarehouseId, warehouseBins]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku')
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
      setFromWarehouseBins(data || []);
      setToWarehouseBins(data || []);
    } catch (error) {
      console.error('Error fetching warehouse bins:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch warehouse bins',
        variant: 'destructive',
      });
    }
  };

  const fetchSourceStock = async () => {
    if (!selectedProductId || !selectedFromWarehouseId || !company) return;

    try {
      const { data, error } = await supabase
        .from('current_stock_levels')
        .select('current_stock')
        .eq('company_id', company.id)
        .eq('product_id', selectedProductId)
        .eq('warehouse_id', selectedFromWarehouseId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching source stock:', error);
        setSourceStock(0);
        return;
      }

      setSourceStock(data?.current_stock || 0);
    } catch (error) {
      console.error('Error fetching source stock:', error);
      setSourceStock(0);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!user || !company) return;

    // Validate source has enough stock
    if (data.quantity > sourceStock) {
      toast({
        title: 'Insufficient Stock',
        description: `Cannot transfer ${data.quantity} units. Only ${sourceStock} units available in source bin`,
        variant: 'destructive',
      });
      return;
    }

    // Prevent transfer to same location
    if (data.from_warehouse_id === data.to_warehouse_id) {
      toast({
        title: 'Invalid Transfer',
        description: 'Cannot transfer to the same warehouse/bin',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Create stock transfer record
      const { data: transferData, error: transferError } = await supabase
        .from('stock_transfers')
        .insert({
          company_id: company.id,
          product_id: data.product_id,
          from_warehouse_id: data.from_warehouse_id,
          from_bin_id: data.from_warehouse_id, // Using warehouse_id as bin_id
          to_warehouse_id: data.to_warehouse_id,
          to_bin_id: data.to_warehouse_id, // Using warehouse_id as bin_id
          quantity: data.quantity,
          reason: data.reason,
          remarks: data.remarks,
          created_by: user.id,
        })
        .select()
        .single();

      if (transferError) throw transferError;

      // Record transfer_out transaction (negative)
      const { error: outTransactionError } = await supabase.rpc('record_inventory_transaction', {
        p_company_id: company.id,
        p_transaction_type: 'transfer_out',
        p_reference_id: transferData.id,
        p_reference_number: transferData.transfer_number,
        p_product_id: data.product_id,
        p_warehouse_id: data.from_warehouse_id,
        p_bin_id: data.from_warehouse_id,
        p_quantity_change: -data.quantity,
        p_unit_cost: 0,
        p_notes: `Transfer out to ${data.to_warehouse_id}: ${data.remarks}`,
        p_created_by: user.id
      });

      if (outTransactionError) {
        console.error('Error recording transfer out transaction:', outTransactionError);
      }

      // Record transfer_in transaction (positive)
      const { error: inTransactionError } = await supabase.rpc('record_inventory_transaction', {
        p_company_id: company.id,
        p_transaction_type: 'transfer_in',
        p_reference_id: transferData.id,
        p_reference_number: transferData.transfer_number,
        p_product_id: data.product_id,
        p_warehouse_id: data.to_warehouse_id,
        p_bin_id: data.to_warehouse_id,
        p_quantity_change: data.quantity,
        p_unit_cost: 0,
        p_notes: `Transfer in from ${data.from_warehouse_id}: ${data.remarks}`,
        p_created_by: user.id
      });

      if (inTransactionError) {
        console.error('Error recording transfer in transaction:', inTransactionError);
      }

      toast({
        title: 'Success',
        description: `Stock transfer ${transferData.transfer_number} created successfully`,
      });

      onSuccess();
    } catch (error) {
      console.error('Error creating stock transfer:', error);
      toast({
        title: 'Error',
        description: 'Failed to create stock transfer',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const reasonOptions = [
    { value: 'rebalancing', label: 'Rebalancing' },
    { value: 'stock_movement', label: 'Stock Movement' },
    { value: 'customer_return', label: 'Customer Return' },
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
                <FormLabel>Product *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.sku} - {product.name}
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
            name="from_warehouse_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>From Warehouse & Bin *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source warehouse & bin" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {fromWarehouseBins.map((bin) => (
                      <SelectItem key={bin.id} value={bin.id}>
                        {bin.warehouse_name} ({bin.warehouse_code}) - {bin.bin_name} ({bin.wh_bin_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProductId && selectedFromWarehouseId && (
                  <p className="text-sm text-muted-foreground">
                    Available stock: {sourceStock} units
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="to_warehouse_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>To Warehouse & Bin *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select destination warehouse & bin" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {toWarehouseBins.map((bin) => (
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
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Transfer Quantity *</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min="1" 
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  />
                </FormControl>
                {quantity > sourceStock && sourceStock > 0 && (
                  <p className="text-sm text-destructive">
                    Quantity exceeds available stock ({sourceStock})
                  </p>
                )}
                {sourceStock === 0 && selectedProductId && selectedFromWarehouseId && (
                  <p className="text-sm text-destructive">
                    No stock available in source warehouse/bin
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reason *</FormLabel>
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
        </div>

        <FormField
          control={form.control}
          name="remarks"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Remarks *</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter remarks for this transfer..."
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
            {loading ? 'Creating Transfer...' : 'Create Transfer'}
          </Button>
        </div>
      </form>
    </Form>
  );
};