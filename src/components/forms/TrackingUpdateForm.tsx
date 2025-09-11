import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const trackingUpdateSchema = z.object({
  destination: z.string().optional(),
  item_count: z.number().min(0).optional(),
  eway_bill_no: z.string().optional(),
  eway_bill_date: z.date().optional(),
  carrier_transporter: z.string().optional(),
  awb_no: z.string().optional(),
  eta: z.date().optional(),
  tracking_status: z.enum(['pending', 'processing', 'dispatched', 'in_transit', 'delivered']),
  dispatch_date: z.date().optional(),
  delivery_date: z.date().optional(),
  pod_document_url: z.string().optional(),
});

type TrackingUpdateData = z.infer<typeof trackingUpdateSchema>;

interface TrackingUpdateFormProps {
  orderId: string;
  orderType: 'sales' | 'debit_note';
  initialData?: Partial<TrackingUpdateData>;
  onSuccess: () => void;
  onCancel: () => void;
}

export function TrackingUpdateForm({ 
  orderId, 
  orderType, 
  initialData, 
  onSuccess, 
  onCancel 
}: TrackingUpdateFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const form = useForm<TrackingUpdateData>({
    resolver: zodResolver(trackingUpdateSchema),
    defaultValues: {
      destination: initialData?.destination || '',
      item_count: initialData?.item_count || 0,
      eway_bill_no: initialData?.eway_bill_no || '',
      eway_bill_date: initialData?.eway_bill_date,
      carrier_transporter: initialData?.carrier_transporter || '',
      awb_no: initialData?.awb_no || '',
      eta: initialData?.eta,
      tracking_status: initialData?.tracking_status || 'pending',
      dispatch_date: initialData?.dispatch_date,
      delivery_date: initialData?.delivery_date,
      pod_document_url: initialData?.pod_document_url || '',
    },
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${orderId}_pod_${Date.now()}.${fileExt}`;
      const filePath = `pod-documents/${fileName}`;

      const { data, error } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (error) {
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      form.setValue('pod_document_url', publicUrl);
      toast({
        title: 'Success',
        description: 'POD document uploaded successfully',
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload POD document',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (data: TrackingUpdateData) => {
    try {
      setLoading(true);

      const tableName = orderType === 'sales' ? 'sales_orders' : 'debit_notes';
      
      const updateData = {
        destination: data.destination,
        item_count: data.item_count,
        eway_bill_no: data.eway_bill_no,
        eway_bill_date: data.eway_bill_date?.toISOString().split('T')[0],
        carrier_transporter: data.carrier_transporter,
        awb_no: data.awb_no,
        eta: data.eta?.toISOString().split('T')[0],
        tracking_status: data.tracking_status,
        dispatch_date: data.dispatch_date?.toISOString().split('T')[0],
        delivery_date: data.delivery_date?.toISOString().split('T')[0],
        pod_document_url: data.pod_document_url,
      };

      const { error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', orderId);

      if (error) {
        throw error;
      }

      toast({
        title: 'Success',
        description: 'Tracking information updated successfully',
      });
      
      onSuccess();
    } catch (error) {
      console.error('Update error:', error);
      toast({
        title: 'Error',
        description: 'Failed to update tracking information',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="destination">Destination</Label>
          <Input
            id="destination"
            {...form.register('destination')}
            placeholder="Enter destination"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="item_count">Item Count</Label>
          <Input
            id="item_count"
            type="number"
            min="0"
            {...form.register('item_count', { valueAsNumber: true })}
            placeholder="0"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="eway_bill_no">E-way Bill No</Label>
          <Input
            id="eway_bill_no"
            {...form.register('eway_bill_no')}
            placeholder="Enter e-way bill number"
          />
        </div>

        <div className="space-y-2">
          <Label>E-way Bill Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {form.watch('eway_bill_date') 
                  ? format(form.watch('eway_bill_date')!, 'PPP')
                  : 'Select date'
                }
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={form.watch('eway_bill_date')}
                onSelect={(date) => form.setValue('eway_bill_date', date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label htmlFor="carrier_transporter">Carrier/Transporter</Label>
          <Input
            id="carrier_transporter"
            {...form.register('carrier_transporter')}
            placeholder="Enter carrier/transporter"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="awb_no">AWB No</Label>
          <Input
            id="awb_no"
            {...form.register('awb_no')}
            placeholder="Enter AWB number"
          />
        </div>

        <div className="space-y-2">
          <Label>ETA</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {form.watch('eta') 
                  ? format(form.watch('eta')!, 'PPP')
                  : 'Select ETA'
                }
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={form.watch('eta')}
                onSelect={(date) => form.setValue('eta', date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>Tracking Status</Label>
          <Select 
            value={form.watch('tracking_status')} 
            onValueChange={(value) => form.setValue('tracking_status', value as any)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="dispatched">Dispatched</SelectItem>
              <SelectItem value="in_transit">In Transit</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Dispatch Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {form.watch('dispatch_date') 
                  ? format(form.watch('dispatch_date')!, 'PPP')
                  : 'Select dispatch date'
                }
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={form.watch('dispatch_date')}
                onSelect={(date) => form.setValue('dispatch_date', date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>Delivery Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {form.watch('delivery_date') 
                  ? format(form.watch('delivery_date')!, 'PPP')
                  : 'Select delivery date'
                }
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={form.watch('delivery_date')}
                onSelect={(date) => form.setValue('delivery_date', date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="col-span-2 space-y-2">
          <Label>POD Document</Label>
          <div className="flex gap-2">
            <Input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileUpload}
              disabled={uploading}
            />
            {form.watch('pod_document_url') && (
              <Button
                type="button"
                variant="outline"
                onClick={() => window.open(form.watch('pod_document_url'), '_blank')}
              >
                View
              </Button>
            )}
          </div>
          {uploading && <p className="text-sm text-muted-foreground">Uploading...</p>}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Updating...' : 'Update Tracking'}
        </Button>
      </div>
    </form>
  );
}