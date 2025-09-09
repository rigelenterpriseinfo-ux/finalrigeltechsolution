import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const backorderFormSchema = z.object({
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  unitPrice: z.number().min(0, 'Unit price must be non-negative'),
  notes: z.string().optional(),
});

type BackorderFormData = z.infer<typeof backorderFormSchema>;

interface BackorderFormProps {
  backorder: {
    customer_name: string;
    product_name: string;
    product_sku: string;
    total_backordered: number;
    avg_unit_price: number;
  };
  onSubmit: (data: BackorderFormData) => void;
  onCancel: () => void;
}

export default function BackorderForm({ backorder, onSubmit, onCancel }: BackorderFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BackorderFormData>({
    resolver: zodResolver(backorderFormSchema),
    defaultValues: {
      quantity: backorder.total_backordered,
      unitPrice: backorder.avg_unit_price,
      notes: '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium">Customer</Label>
          <p className="text-sm text-muted-foreground">{backorder.customer_name}</p>
        </div>
        <div>
          <Label className="text-sm font-medium">Product</Label>
          <p className="text-sm text-muted-foreground">{backorder.product_name}</p>
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium">SKU</Label>
        <p className="text-sm text-muted-foreground font-mono">{backorder.product_sku}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="quantity">Quantity *</Label>
          <Input
            id="quantity"
            type="number"
            min="1"
            {...register('quantity', { valueAsNumber: true })}
            className={errors.quantity ? 'border-red-500' : ''}
          />
          {errors.quantity && (
            <p className="text-red-500 text-sm mt-1">{errors.quantity.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="unitPrice">Unit Price *</Label>
          <Input
            id="unitPrice"
            type="number"
            step="0.01"
            min="0"
            {...register('unitPrice', { valueAsNumber: true })}
            className={errors.unitPrice ? 'border-red-500' : ''}
          />
          {errors.unitPrice && (
            <p className="text-red-500 text-sm mt-1">{errors.unitPrice.message}</p>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          {...register('notes')}
          placeholder="Optional notes about this backorder update..."
        />
      </div>

      <div className="flex gap-2 pt-4">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="flex-1"
        >
          {isSubmitting ? 'Updating...' : 'Update Backorder'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}