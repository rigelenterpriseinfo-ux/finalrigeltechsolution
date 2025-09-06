import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Building2, MapPin, User, Phone } from 'lucide-react';

interface WarehouseBin {
  id: string;
  wh_bin_code: string;
  bin_name: string;
  warehouse_name?: string;
  warehouse_code?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  contact_person_name?: string;
  contact_person_phone?: string;
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
    const warehouseName = formData.get('warehouse_name') as string;
    const warehouseCode = formData.get('warehouse_code') as string;

    // Validation
    if (!/^[A-Z0-9]{4}$/.test(whBinCode)) {
      toast({
        title: "Invalid BIN Code",
        description: "BIN code must be exactly 4 characters (letters and numbers only)",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (!/^[A-Za-z\s]{1,50}$/.test(binName)) {
      toast({
        title: "Invalid Bin Name",
        description: "Bin name must be 1-50 characters (letters and spaces only)",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (warehouseName && !/^[A-Za-z0-9\s\-\.]{1,100}$/.test(warehouseName)) {
      toast({
        title: "Invalid Warehouse Name",
        description: "Warehouse name must be 1-100 characters",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const binData = {
      wh_bin_code: whBinCode.toUpperCase(),
      bin_name: binName.trim(),
      warehouse_name: warehouseName?.trim() || null,
      warehouse_code: warehouseCode?.trim().toUpperCase() || null,
      address_line1: (formData.get('address_line1') as string)?.trim() || null,
      address_line2: (formData.get('address_line2') as string)?.trim() || null,
      city: (formData.get('city') as string)?.trim() || null,
      state: (formData.get('state') as string)?.trim() || null,
      country: (formData.get('country') as string)?.trim() || null,
      postal_code: (formData.get('postal_code') as string)?.trim() || null,
      contact_person_name: (formData.get('contact_person_name') as string)?.trim() || null,
      contact_person_phone: (formData.get('contact_person_phone') as string)?.trim() || null,
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
          // Check which constraint was violated
          if (error.message?.includes('warehouse_bins_unique_warehouse_bin')) {
            toast({
              title: "Error",
              description: "This BIN code already exists in this warehouse. Please use a different BIN code for this warehouse.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Error",
              description: "A duplicate entry was detected. Please check your warehouse and BIN details.",
              variant: "destructive",
            });
          }
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
        description: `Warehouse and BIN ${editingBin ? 'updated' : 'created'} successfully`,
      });

      onOpenChange(false);
      onSuccess();
      
      // Reset form
      (e.target as HTMLFormElement).reset();
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to ${editingBin ? 'update' : 'create'} warehouse and BIN`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5" />
            {editingBin ? 'Edit Warehouse & BIN' : 'Create Warehouse & BIN Location'}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {editingBin ? 'Update warehouse and bin details' : 'Create warehouse location with bin details to organize inventory'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Warehouse & BIN Information - Combined in one row */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Building2 className="h-4 w-4 text-primary" />
              <h3 className="font-medium">Warehouse & BIN Information</h3>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="warehouse_name" className="text-sm">Warehouse Name</Label>
                <Input 
                  id="warehouse_name" 
                  name="warehouse_name" 
                  placeholder="Main Distribution Center"
                  defaultValue={editingBin?.warehouse_name || ''}
                  maxLength={100}
                  className="h-9"
                />
              </div>
              
              <div>
                <Label htmlFor="warehouse_code" className="text-sm">Warehouse Code</Label>
                <Input 
                  id="warehouse_code" 
                  name="warehouse_code" 
                  placeholder="WH001"
                  defaultValue={editingBin?.warehouse_code || ''}
                  maxLength={20}
                  className="h-9 uppercase"
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
              
              <div>
                <Label htmlFor="wh_bin_code" className="text-sm">BIN Code *</Label>
                <Input 
                  id="wh_bin_code" 
                  name="wh_bin_code" 
                  required 
                  maxLength={4}
                  minLength={4}
                  placeholder="A001"
                  defaultValue={editingBin?.wh_bin_code || ''}
                  pattern="[A-Za-z0-9]{4}"
                  title="Exactly 4 characters (letters and numbers only)"
                  className="h-9 uppercase"
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
              
              <div>
                <Label htmlFor="bin_name" className="text-sm">BIN Name *</Label>
                <Input 
                  id="bin_name" 
                  name="bin_name" 
                  required 
                  maxLength={50}
                  placeholder="Electronics Section A"
                  defaultValue={editingBin?.bin_name || ''}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          {/* Address Information - Optimized layout */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b">
              <MapPin className="h-4 w-4 text-primary" />
              <h3 className="font-medium">Warehouse Address</h3>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="address_line1" className="text-sm">Address Line 1</Label>
                <Input 
                  id="address_line1" 
                  name="address_line1" 
                  placeholder="123 Industrial Street"
                  defaultValue={editingBin?.address_line1 || ''}
                  maxLength={255}
                  className="h-9"
                />
              </div>
              
              <div>
                <Label htmlFor="address_line2" className="text-sm">Address Line 2</Label>
                <Input 
                  id="address_line2" 
                  name="address_line2" 
                  placeholder="Building B, Floor 2"
                  defaultValue={editingBin?.address_line2 || ''}
                  maxLength={255}
                  className="h-9"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="city" className="text-sm">City</Label>
                <Input 
                  id="city" 
                  name="city" 
                  placeholder="Mumbai"
                  defaultValue={editingBin?.city || ''}
                  maxLength={100}
                  className="h-9"
                />
              </div>
              
              <div>
                <Label htmlFor="state" className="text-sm">State</Label>
                <Input 
                  id="state" 
                  name="state" 
                  placeholder="Maharashtra"
                  defaultValue={editingBin?.state || ''}
                  maxLength={100}
                  className="h-9"
                />
              </div>
              
              <div>
                <Label htmlFor="postal_code" className="text-sm">PIN Code</Label>
                <Input 
                  id="postal_code" 
                  name="postal_code" 
                  placeholder="400001"
                  defaultValue={editingBin?.postal_code || ''}
                  maxLength={10}
                  className="h-9"
                />
              </div>
              
              <div>
                <Label htmlFor="country" className="text-sm">Country</Label>
                <Input 
                  id="country" 
                  name="country" 
                  placeholder="India"
                  defaultValue={editingBin?.country || ''}
                  maxLength={100}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b">
              <User className="h-4 w-4 text-primary" />
              <h3 className="font-medium">Contact Information</h3>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contact_person_name" className="text-sm">Contact Person</Label>
                <Input 
                  id="contact_person_name" 
                  name="contact_person_name" 
                  placeholder="John Smith"
                  defaultValue={editingBin?.contact_person_name || ''}
                  maxLength={100}
                  className="h-9"
                />
              </div>
              
              <div>
                <Label htmlFor="contact_person_phone" className="text-sm">Phone Number</Label>
                <Input 
                  id="contact_person_phone" 
                  name="contact_person_phone" 
                  type="tel"
                  placeholder="+91 98765 43210"
                  defaultValue={editingBin?.contact_person_phone || ''}
                  maxLength={20}
                  className="h-9"
                />
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button type="submit" disabled={loading} className="flex-1 h-10">
              {loading ? 'Processing...' : (editingBin ? 'Update Location' : 'Create Location')}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="flex-1 h-10"
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}