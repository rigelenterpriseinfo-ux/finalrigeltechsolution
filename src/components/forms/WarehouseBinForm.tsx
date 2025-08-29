import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface WarehouseBin {
  id: string;
  wh_bin_code: string;
  bin_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface WarehouseBinFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editingBin?: WarehouseBin | null;
}

export function WarehouseBinForm({ open, onOpenChange, onSuccess, editingBin }: WarehouseBinFormProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!profile?.company_id) {
      toast({
        title: "Error",
        description: "User profile not found or company not set",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    
    const whBinCode = formData.get('wh_bin_code') as string;
    const binName = formData.get('bin_name') as string;

    // Validation
    if (!/^[A-Z0-9]{4}$/.test(whBinCode)) {
      toast({
        title: "Invalid WH BIN Code",
        description: "WH BIN code must be exactly 4 characters (letters and numbers only)",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (!/^[A-Za-z]{1,10}$/.test(binName)) {
      toast({
        title: "Invalid Bin Name",
        description: "Bin name must be 1-10 characters (letters only)",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const binData = {
      wh_bin_code: whBinCode.toUpperCase(),
      bin_name: binName,
      company_id: profile.company_id,
    };

    try {
      let error;
      
      if (editingBin) {
        const { error: updateError } = await supabase
          .from('warehouse_bins')
          .update(binData)
          .eq('id', editingBin.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('warehouse_bins')
          .insert([binData]);
        error = insertError;
      }

      if (error) {
        if (error.code === '23505') {
          toast({
            title: "Error",
            description: "A bin with this code already exists",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        }
        return;
      }

      toast({
        title: "Success",
        description: `Warehouse bin ${editingBin ? 'updated' : 'created'} successfully`,
      });

      onOpenChange(false);
      onSuccess();
      
      // Reset form
      (e.target as HTMLFormElement).reset();
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to ${editingBin ? 'update' : 'create'} warehouse bin`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingBin ? 'Edit Warehouse BIN Location' : 'Create Warehouse BIN Location'}
          </DialogTitle>
          <DialogDescription>
            {editingBin ? 'Update the warehouse bin details' : 'Add a new warehouse bin location to organize your inventory'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="wh_bin_code">WH BIN Code *</Label>
            <Input 
              id="wh_bin_code" 
              name="wh_bin_code" 
              required 
              maxLength={4}
              minLength={4}
              placeholder="e.g., A001"
              defaultValue={editingBin?.wh_bin_code || ''}
              pattern="[A-Za-z0-9]{4}"
              title="Exactly 4 characters (letters and numbers only)"
              className="uppercase"
              style={{ textTransform: 'uppercase' }}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Exactly 4 characters - combination of letters and numbers
            </p>
          </div>
          
          <div>
            <Label htmlFor="bin_name">Bin Name *</Label>
            <Input 
              id="bin_name" 
              name="bin_name" 
              required 
              maxLength={10}
              placeholder="e.g., Electronics"
              defaultValue={editingBin?.bin_name || ''}
              pattern="[A-Za-z]+"
              title="Only letters allowed, maximum 10 characters"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Maximum 10 characters - letters only
            </p>
          </div>
          
          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Processing...' : (editingBin ? 'Update Bin' : 'Create Bin')}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}