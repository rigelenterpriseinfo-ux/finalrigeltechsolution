import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface DocumentFormatConfig {
  id: string;
  company_id: string;
  document_type: string;
  prefix: string;
  suffix: string;
  current_counter: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DocumentFormatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config?: DocumentFormatConfig | null;
  onSuccess: () => void;
}

const DOCUMENT_TYPES = [
  { value: 'purchase_order', label: 'Purchase Order' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'debit_note', label: 'Debit Note' },
  { value: 'credit_note', label: 'Credit Note' },
  { value: 'customer_id', label: 'Customer ID' },
  { value: 'supplier_id', label: 'Supplier ID' },
  { value: 'grn', label: 'GRN' },
  { value: 'return_sales_order', label: 'Return Sales Order' },
];

export const DocumentFormatDialog: React.FC<DocumentFormatDialogProps> = ({
  open,
  onOpenChange,
  config,
  onSuccess,
}) => {
  const { company } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    document_type: '',
    prefix: '',
    suffix: '001',
    current_counter: 1001,
    is_active: true,
  });

  useEffect(() => {
    if (config) {
      setFormData({
        document_type: config.document_type,
        prefix: config.prefix,
        suffix: config.suffix,
        current_counter: config.current_counter,
        is_active: config.is_active,
      });
    } else {
      setFormData({
        document_type: '',
        prefix: '',
        suffix: '001',
        current_counter: 1001,
        is_active: true,
      });
    }
  }, [config, open]);

  const generatePreview = () => {
    if (!formData.prefix && !formData.suffix) return 'No preview available';
    const counter = formData.current_counter.toString().padStart(formData.suffix.length, '0');
    return `${formData.prefix}${counter}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;

    setLoading(true);

    try {
      const payload = {
        company_id: company.id,
        document_type: formData.document_type,
        prefix: formData.prefix,
        suffix: formData.suffix,
        current_counter: formData.current_counter,
        is_active: formData.is_active,
      };

      if (config) {
        // Update existing config
        const { error } = await supabase
          .from('document_format_configs')
          .update(payload)
          .eq('id', config.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Document format configuration updated successfully',
        });
      } else {
        // Create new config
        const { error } = await supabase
          .from('document_format_configs')
          .insert(payload);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Document format configuration created successfully',
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving config:', error);
      
      let errorMessage = 'Failed to save document format configuration';
      if (error.code === '23505') {
        errorMessage = 'A configuration for this document type already exists';
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {config ? 'Edit Document Format' : 'Create Document Format'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="document_type">Document Type</Label>
            <Select
              value={formData.document_type}
              onValueChange={(value) => setFormData({ ...formData, document_type: value })}
              disabled={!!config} // Don't allow changing document type when editing
            >
              <SelectTrigger>
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prefix">Prefix</Label>
            <Input
              id="prefix"
              value={formData.prefix}
              onChange={(e) => setFormData({ ...formData, prefix: e.target.value.toUpperCase() })}
              placeholder="e.g., INV, PO, DN, CN"
              maxLength={10}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="suffix">Suffix Format</Label>
            <Input
              id="suffix"
              value={formData.suffix}
              onChange={(e) => setFormData({ ...formData, suffix: e.target.value })}
              placeholder="e.g., 001, 0001"
              maxLength={10}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="current_counter">Starting Counter</Label>
            <Input
              id="current_counter"
              type="number"
              value={formData.current_counter}
              onChange={(e) => setFormData({ ...formData, current_counter: parseInt(e.target.value) || 1 })}
              min={1}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label htmlFor="is_active">Active</Label>
          </div>

          {formData.document_type && (
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="p-3 bg-muted rounded-md">
                <code className="text-sm font-medium">{generatePreview()}</code>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.document_type}>
              {loading ? 'Saving...' : config ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};