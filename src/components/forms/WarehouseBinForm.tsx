import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Building2, MapPin, User, Phone, Mail, Settings } from 'lucide-react';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 
  'Uttarakhand', 'West Bengal', 'Andaman & Nicobar Islands', 'Chandigarh', 
  'Dadra & Nagar Haveli and Daman & Diu', 'Delhi', 'Jammu & Kashmir', 'Ladakh', 
  'Lakshadweep', 'Puducherry'
];

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
  contact_person_email?: string;
  is_active: boolean;
  is_default?: boolean;
  created_at: string;
  updated_at: string;
}

interface ValidationErrors {
  warehouse_name?: string;
  warehouse_code?: string;
  wh_bin_code?: string;
  bin_name?: string;
  address_line1?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  contact_person_name?: string;
  contact_person_phone?: string;
  contact_person_email?: string;
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
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isActive, setIsActive] = useState(editingBin?.is_active ?? true);
  const [isDefault, setIsDefault] = useState(editingBin?.is_default ?? false);

  // Validation functions
  const validateWarehouseName = (value: string): string | undefined => {
    const trimmed = value.trim();
    if (!trimmed) return "Enter warehouse name (3–100 characters).";
    if (trimmed.length < 3 || trimmed.length > 100) return "Enter warehouse name (3–100 characters).";
    return undefined;
  };

  const validateWarehouseCode = (value: string): string | undefined => {
    if (!value) return undefined; // Optional
    if (!/^[A-Z0-9-_]{1,20}$/.test(value)) return "Use 1–20 uppercase letters/numbers (- or _ allowed).";
    return undefined;
  };

  const validateBinCode = (value: string): string | undefined => {
    if (!value) return "Enter BIN code (1–12 uppercase letters/numbers).";
    if (!/^[A-Z0-9]{1,12}$/.test(value)) return "Enter BIN code (1–12 uppercase letters/numbers).";
    return undefined;
  };

  const validateBinName = (value: string): string | undefined => {
    const trimmed = value.trim();
    if (!trimmed) return "Enter BIN/section name.";
    if (trimmed.length < 2 || trimmed.length > 100) return "Enter BIN/section name.";
    return undefined;
  };

  const validateAddressLine1 = (value: string): string | undefined => {
    const trimmed = value.trim();
    if (!trimmed) return "Enter address line 1.";
    if (trimmed.length > 200) return "Enter address line 1.";
    return undefined;
  };

  const validateCity = (value: string): string | undefined => {
    const trimmed = value.trim();
    if (!trimmed) return "Enter city.";
    if (trimmed.length > 100) return "Enter city.";
    return undefined;
  };

  const validateState = (value: string): string | undefined => {
    if (!value) return "Select state.";
    if (!INDIAN_STATES.includes(value)) return "Select state.";
    return undefined;
  };

  const validatePinCode = (value: string): string | undefined => {
    if (!value) return "Enter a valid 6-digit PIN code.";
    if (!/^\d{6}$/.test(value)) return "Enter a valid 6-digit PIN code.";
    return undefined;
  };

  const validateCountry = (value: string): string | undefined => {
    if (value !== "IN") return "Select country (India).";
    return undefined;
  };

  const validateContactPerson = (value: string): string | undefined => {
    if (value && value.length > 100) return "Contact person name too long.";
    return undefined;
  };

  const validatePhone = (value: string): string | undefined => {
    if (!value) return undefined; // Optional but recommended
    // Normalize and validate Indian phone numbers
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) return undefined; // 10 digit starting with 6-9
    if (cleaned.length === 12 && cleaned.startsWith('91') && /^91[6-9]/.test(cleaned)) return undefined; // +91 format
    if (cleaned.length === 13 && cleaned.startsWith('091')) return undefined; // 0091 format
    return "Enter a valid Indian phone number (include +91 or start with 9/8/7/6).";
  };

  const validateEmail = (value: string): string | undefined => {
    if (!value) return undefined; // Optional
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) return "Enter a valid email address.";
    return undefined;
  };

  const validateField = (name: keyof ValidationErrors, value: string) => {
    let error: string | undefined;
    
    switch (name) {
      case 'warehouse_name':
        error = validateWarehouseName(value);
        break;
      case 'warehouse_code':
        error = validateWarehouseCode(value.toUpperCase());
        break;
      case 'wh_bin_code':
        error = validateBinCode(value.toUpperCase());
        break;
      case 'bin_name':
        error = validateBinName(value);
        break;
      case 'address_line1':
        error = validateAddressLine1(value);
        break;
      case 'city':
        error = validateCity(value);
        break;
      case 'state':
        error = validateState(value);
        break;
      case 'postal_code':
        error = validatePinCode(value);
        break;
      case 'country':
        error = validateCountry(value);
        break;
      case 'contact_person_name':
        error = validateContactPerson(value);
        break;
      case 'contact_person_phone':
        error = validatePhone(value);
        break;
      case 'contact_person_email':
        error = validateEmail(value);
        break;
    }

    setErrors(prev => ({
      ...prev,
      [name]: error
    }));
  };

  const handleFieldChange = (name: keyof ValidationErrors, value: string) => {
    // Auto-uppercase for specific fields
    if (name === 'warehouse_code' || name === 'wh_bin_code') {
      value = value.toUpperCase();
    }
    validateField(name, value);
  };

  const validateForm = (formData: FormData): boolean => {
    const newErrors: ValidationErrors = {};
    
    // Required field validations
    newErrors.warehouse_name = validateWarehouseName(formData.get('warehouse_name') as string || '');
    newErrors.warehouse_code = validateWarehouseCode(formData.get('warehouse_code') as string || '');
    newErrors.wh_bin_code = validateBinCode(formData.get('wh_bin_code') as string || '');
    newErrors.bin_name = validateBinName(formData.get('bin_name') as string || '');
    newErrors.address_line1 = validateAddressLine1(formData.get('address_line1') as string || '');
    newErrors.city = validateCity(formData.get('city') as string || '');
    newErrors.state = validateState(formData.get('state') as string || '');
    newErrors.postal_code = validatePinCode(formData.get('postal_code') as string || '');
    newErrors.country = validateCountry(formData.get('country') as string || 'IN');
    newErrors.contact_person_name = validateContactPerson(formData.get('contact_person_name') as string || '');
    newErrors.contact_person_phone = validatePhone(formData.get('contact_person_phone') as string || '');
    newErrors.contact_person_email = validateEmail(formData.get('contact_person_email') as string || '');

    // Remove undefined errors
    Object.keys(newErrors).forEach(key => {
      if (!newErrors[key as keyof ValidationErrors]) {
        delete newErrors[key as keyof ValidationErrors];
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

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
    
    const formData = new FormData(e.currentTarget);
    
    if (!validateForm(formData)) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors in the form",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);

    // Normalize phone number to E.164 format
    let phone = formData.get('contact_person_phone') as string || '';
    if (phone) {
      const cleaned = phone.replace(/\D/g, '');
      if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
        phone = `+91${cleaned}`;
      } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
        phone = `+${cleaned}`;
      } else if (cleaned.length === 13 && cleaned.startsWith('091')) {
        phone = `+${cleaned.substring(1)}`;
      }
    }

    const binData = {
      wh_bin_code: (formData.get('wh_bin_code') as string).toUpperCase(),
      bin_name: (formData.get('bin_name') as string).trim(),
      warehouse_name: (formData.get('warehouse_name') as string)?.trim() || null,
      warehouse_code: (formData.get('warehouse_code') as string)?.trim().toUpperCase() || null,
      address_line1: (formData.get('address_line1') as string)?.trim() || null,
      address_line2: (formData.get('address_line2') as string)?.trim() || null,
      city: (formData.get('city') as string)?.trim() || null,
      state: (formData.get('state') as string)?.trim() || null,
      country: 'IN', // Always India
      postal_code: (formData.get('postal_code') as string)?.trim() || null,
      contact_person_name: (formData.get('contact_person_name') as string)?.trim() || null,
      contact_person_phone: phone || null,
      contact_person_email: (formData.get('contact_person_email') as string)?.trim() || null,
      is_active: isActive,
      is_default: isDefault,
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
      setErrors({});
      setIsActive(true);
      setIsDefault(false);
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
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Warehouse & BIN Information */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Building2 className="h-4 w-4 text-primary" />
              <h3 className="font-medium">Warehouse & BIN Information</h3>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="warehouse_name" className="text-sm">
                  Warehouse Name <span className="text-red-500">*</span>
                </Label>
                <Input 
                  id="warehouse_name" 
                  name="warehouse_name" 
                  placeholder="Main Distribution Center"
                  defaultValue={editingBin?.warehouse_name || ''}
                  onChange={(e) => handleFieldChange('warehouse_name', e.target.value)}
                  className={`h-9 ${errors.warehouse_name ? 'border-red-500' : ''}`}
                  required
                />
                {errors.warehouse_name && <p className="text-sm text-red-500 mt-1">{errors.warehouse_name}</p>}
              </div>
              
              <div>
                <Label htmlFor="warehouse_code" className="text-sm">Warehouse Code</Label>
                <Input 
                  id="warehouse_code" 
                  name="warehouse_code" 
                  placeholder="WH001"
                  defaultValue={editingBin?.warehouse_code || ''}
                  onChange={(e) => handleFieldChange('warehouse_code', e.target.value)}
                  className={`h-9 uppercase ${errors.warehouse_code ? 'border-red-500' : ''}`}
                  style={{ textTransform: 'uppercase' }}
                />
                {errors.warehouse_code && <p className="text-sm text-red-500 mt-1">{errors.warehouse_code}</p>}
              </div>
              
              <div>
                <Label htmlFor="wh_bin_code" className="text-sm">
                  BIN Code <span className="text-red-500">*</span>
                </Label>
                <Input 
                  id="wh_bin_code" 
                  name="wh_bin_code" 
                  required 
                  placeholder="A001"
                  defaultValue={editingBin?.wh_bin_code || ''}
                  onChange={(e) => handleFieldChange('wh_bin_code', e.target.value)}
                  className={`h-9 uppercase ${errors.wh_bin_code ? 'border-red-500' : ''}`}
                  style={{ textTransform: 'uppercase' }}
                />
                {errors.wh_bin_code && <p className="text-sm text-red-500 mt-1">{errors.wh_bin_code}</p>}
              </div>
              
              <div>
                <Label htmlFor="bin_name" className="text-sm">
                  BIN Name <span className="text-red-500">*</span>
                </Label>
                <Input 
                  id="bin_name" 
                  name="bin_name" 
                  required 
                  placeholder="Electronics Section A"
                  defaultValue={editingBin?.bin_name || ''}
                  onChange={(e) => handleFieldChange('bin_name', e.target.value)}
                  className={`h-9 ${errors.bin_name ? 'border-red-500' : ''}`}
                />
                {errors.bin_name && <p className="text-sm text-red-500 mt-1">{errors.bin_name}</p>}
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b">
              <MapPin className="h-4 w-4 text-primary" />
              <h3 className="font-medium">Warehouse Address</h3>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="address_line1" className="text-sm">
                  Address Line 1 <span className="text-red-500">*</span>
                </Label>
                <Input 
                  id="address_line1" 
                  name="address_line1" 
                  placeholder="123 Industrial Street"
                  defaultValue={editingBin?.address_line1 || ''}
                  onChange={(e) => handleFieldChange('address_line1', e.target.value)}
                  className={`h-9 ${errors.address_line1 ? 'border-red-500' : ''}`}
                  required
                />
                {errors.address_line1 && <p className="text-sm text-red-500 mt-1">{errors.address_line1}</p>}
              </div>
              
              <div>
                <Label htmlFor="address_line2" className="text-sm">Address Line 2</Label>
                <Input 
                  id="address_line2" 
                  name="address_line2" 
                  placeholder="Building B, Floor 2"
                  defaultValue={editingBin?.address_line2 || ''}
                  className="h-9"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="city" className="text-sm">
                  City <span className="text-red-500">*</span>
                </Label>
                <Input 
                  id="city" 
                  name="city" 
                  placeholder="Mumbai"
                  defaultValue={editingBin?.city || ''}
                  onChange={(e) => handleFieldChange('city', e.target.value)}
                  className={`h-9 ${errors.city ? 'border-red-500' : ''}`}
                  required
                />
                {errors.city && <p className="text-sm text-red-500 mt-1">{errors.city}</p>}
              </div>
              
              <div>
                <Label htmlFor="state" className="text-sm">
                  State <span className="text-red-500">*</span>
                </Label>
                <Select name="state" defaultValue={editingBin?.state || ''} onValueChange={(value) => handleFieldChange('state', value)} required>
                  <SelectTrigger className={`h-9 ${errors.state ? 'border-red-500' : ''}`}>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {INDIAN_STATES.map((state) => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.state && <p className="text-sm text-red-500 mt-1">{errors.state}</p>}
              </div>
              
              <div>
                <Label htmlFor="postal_code" className="text-sm">
                  PIN Code <span className="text-red-500">*</span>
                </Label>
                <Input 
                  id="postal_code" 
                  name="postal_code" 
                  placeholder="400001"
                  defaultValue={editingBin?.postal_code || ''}
                  onChange={(e) => handleFieldChange('postal_code', e.target.value)}
                  className={`h-9 ${errors.postal_code ? 'border-red-500' : ''}`}
                  required
                />
                {errors.postal_code && <p className="text-sm text-red-500 mt-1">{errors.postal_code}</p>}
              </div>
              
              <div>
                <Label htmlFor="country" className="text-sm">
                  Country <span className="text-red-500">*</span>
                </Label>
                <Input 
                  id="country" 
                  name="country" 
                  value="India"
                  readOnly
                  className="h-9 bg-muted"
                />
                <input type="hidden" name="country" value="IN" />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b">
              <User className="h-4 w-4 text-primary" />
              <h3 className="font-medium">Contact Information</h3>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="contact_person_name" className="text-sm">Contact Person</Label>
                <Input 
                  id="contact_person_name" 
                  name="contact_person_name" 
                  placeholder="John Smith"
                  defaultValue={editingBin?.contact_person_name || ''}
                  onChange={(e) => handleFieldChange('contact_person_name', e.target.value)}
                  className={`h-9 ${errors.contact_person_name ? 'border-red-500' : ''}`}
                />
                {errors.contact_person_name && <p className="text-sm text-red-500 mt-1">{errors.contact_person_name}</p>}
              </div>
              
              <div>
                <Label htmlFor="contact_person_phone" className="text-sm">
                  <Phone className="h-4 w-4 inline mr-1" />
                  Phone Number
                </Label>
                <Input 
                  id="contact_person_phone" 
                  name="contact_person_phone" 
                  type="tel"
                  placeholder="+91 98765 43210"
                  defaultValue={editingBin?.contact_person_phone || ''}
                  onChange={(e) => handleFieldChange('contact_person_phone', e.target.value)}
                  className={`h-9 ${errors.contact_person_phone ? 'border-red-500' : ''}`}
                />
                {errors.contact_person_phone && <p className="text-sm text-red-500 mt-1">{errors.contact_person_phone}</p>}
              </div>
              
              <div>
                <Label htmlFor="contact_person_email" className="text-sm">
                  <Mail className="h-4 w-4 inline mr-1" />
                  Email Address
                </Label>
                <Input 
                  id="contact_person_email" 
                  name="contact_person_email" 
                  type="email"
                  placeholder="contact@warehouse.com"
                  defaultValue={editingBin?.contact_person_email || ''}
                  onChange={(e) => handleFieldChange('contact_person_email', e.target.value)}
                  className={`h-9 ${errors.contact_person_email ? 'border-red-500' : ''}`}
                />
                {errors.contact_person_email && <p className="text-sm text-red-500 mt-1">{errors.contact_person_email}</p>}
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Settings className="h-4 w-4 text-primary" />
              <h3 className="font-medium">Settings</h3>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label htmlFor="is_active" className="text-sm font-medium">Active</Label>
                  <p className="text-xs text-muted-foreground">Enable this warehouse location</p>
                </div>
                <Switch 
                  id="is_active"
                  checked={isActive} 
                  onCheckedChange={setIsActive}
                />
              </div>
              
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label htmlFor="is_default" className="text-sm font-medium">Default</Label>
                  <p className="text-xs text-muted-foreground">Set as default warehouse location</p>
                </div>
                <Switch 
                  id="is_default"
                  checked={isDefault} 
                  onCheckedChange={setIsDefault}
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