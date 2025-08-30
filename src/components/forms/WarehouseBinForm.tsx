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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Building2 className="h-5 w-5" />
            {editingBin ? 'Edit Warehouse and BIN Location' : 'Create New Warehouse and BIN Location'}
          </DialogTitle>
          <DialogDescription>
            {editingBin ? 'Update the warehouse and bin details' : 'Create a comprehensive warehouse location with bin details to organize your inventory efficiently'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Warehouse Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="h-4 w-4" />
                Warehouse Information
              </CardTitle>
              <CardDescription>
                Basic warehouse details and identification
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="warehouse_name">Warehouse Name</Label>
                  <Input 
                    id="warehouse_name" 
                    name="warehouse_name" 
                    placeholder="e.g., Main Distribution Center"
                    defaultValue={editingBin?.warehouse_name || ''}
                    maxLength={100}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Optional: Descriptive name for the warehouse
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="warehouse_code">Warehouse Code</Label>
                  <Input 
                    id="warehouse_code" 
                    name="warehouse_code" 
                    placeholder="e.g., WH001"
                    defaultValue={editingBin?.warehouse_code || ''}
                    maxLength={20}
                    className="uppercase"
                    style={{ textTransform: 'uppercase' }}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Optional: Unique identifier for the warehouse
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* BIN Location Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-4 w-4" />
                BIN Location Details
              </CardTitle>
              <CardDescription>
                Specific bin identification within the warehouse
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="wh_bin_code">BIN Code *</Label>
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
                    Required: Exactly 4 characters - combination of letters and numbers
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="bin_name">BIN Name *</Label>
                  <Input 
                    id="bin_name" 
                    name="bin_name" 
                    required 
                    maxLength={50}
                    placeholder="e.g., Electronics Section A"
                    defaultValue={editingBin?.bin_name || ''}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Required: Descriptive name for this bin location
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Address Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-4 w-4" />
                Warehouse Address
              </CardTitle>
              <CardDescription>
                Physical location of the warehouse
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="address_line1">Address Line 1</Label>
                  <Input 
                    id="address_line1" 
                    name="address_line1" 
                    placeholder="e.g., 123 Industrial Street"
                    defaultValue={editingBin?.address_line1 || ''}
                    maxLength={255}
                  />
                </div>
                
                <div>
                  <Label htmlFor="address_line2">Address Line 2</Label>
                  <Input 
                    id="address_line2" 
                    name="address_line2" 
                    placeholder="e.g., Building B, Floor 2"
                    defaultValue={editingBin?.address_line2 || ''}
                    maxLength={255}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input 
                    id="city" 
                    name="city" 
                    placeholder="e.g., Mumbai"
                    defaultValue={editingBin?.city || ''}
                    maxLength={100}
                  />
                </div>
                
                <div>
                  <Label htmlFor="state">State</Label>
                  <Input 
                    id="state" 
                    name="state" 
                    placeholder="e.g., Maharashtra"
                    defaultValue={editingBin?.state || ''}
                    maxLength={100}
                  />
                </div>
                
                <div>
                  <Label htmlFor="postal_code">PIN Code</Label>
                  <Input 
                    id="postal_code" 
                    name="postal_code" 
                    placeholder="e.g., 400001"
                    defaultValue={editingBin?.postal_code || ''}
                    maxLength={10}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="country">Country</Label>
                <Input 
                  id="country" 
                  name="country" 
                  placeholder="e.g., India"
                  defaultValue={editingBin?.country || ''}
                  maxLength={100}
                />
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-4 w-4" />
                Contact Information
              </CardTitle>
              <CardDescription>
                Point of contact for this warehouse location
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contact_person_name">Contact Person Name</Label>
                  <Input 
                    id="contact_person_name" 
                    name="contact_person_name" 
                    placeholder="e.g., John Smith"
                    defaultValue={editingBin?.contact_person_name || ''}
                    maxLength={100}
                  />
                </div>
                
                <div>
                  <Label htmlFor="contact_person_phone">Contact Person Phone</Label>
                  <Input 
                    id="contact_person_phone" 
                    name="contact_person_phone" 
                    type="tel"
                    placeholder="e.g., +91 98765 43210"
                    defaultValue={editingBin?.contact_person_phone || ''}
                    maxLength={20}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator />
          
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Processing...' : (editingBin ? 'Update Warehouse and BIN' : 'Create Warehouse and BIN')}
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