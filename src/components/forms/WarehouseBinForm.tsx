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
  address_line2?: string;
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
    if (!trimmed) return "Enter warehouse name (min 3 characters).";
    if (trimmed.length < 3 || trimmed.length > 30) return "Enter warehouse name (min 3 characters).";
    if (!/^[A-Za-z0-9 \-_&]+$/.test(trimmed)) return "Enter warehouse name (min 3 characters).";
    return undefined;
  };

  // Warehouse Code: validation removed as requested
  const validateWarehouseCode = async (_value: string): Promise<string | undefined> => {
    return undefined;
  };

  const validateBinCode = (value: string): string | undefined => {
    if (!value) return "Enter valid BIN code (1–10 uppercase letters/numbers).";
    if (!/^[A-Z0-9]{1,10}$/.test(value)) return "Enter valid BIN code (1–10 uppercase letters/numbers).";
    return undefined;
  };

  const validateBinName = (value: string): string | undefined => {
    const trimmed = value.trim();
    if (!trimmed) return "Enter BIN/section name.";
    if (trimmed.length < 2 || trimmed.length > 30) return "Enter BIN/section name.";
    return undefined;
  };

  const validateAddressLine1 = (value: string): string | undefined => {
    const trimmed = value.trim();
    if (!trimmed) return "Enter address line 1 (min 5 characters).";
    if (trimmed.length < 5 || trimmed.length > 80) return "Enter address line 1 (min 5 characters).";
    return undefined;
  };

  const validateAddressLine2 = (value: string): string | undefined => {
    if (value && value.trim().length > 80) return "Address line 2 max 80 characters.";
    return undefined;
  };

  const validateCity = (value: string): string | undefined => {
    const trimmed = value.trim();
    if (!trimmed) return "Enter valid city name.";
    if (!/^[A-Za-z ]{2,100}$/.test(trimmed)) return "Enter valid city name.";
    return undefined;
  };

  const validateState = (value: string): string | undefined => {
    if (!value) return "Select state.";
    if (!INDIAN_STATES.includes(value)) return "Select state.";
    return undefined;
  };

  const validatePinCode = (value: string): string | undefined => {
    if (!value) return "Enter valid 6-digit PIN code.";
    if (!/^\d{6}$/.test(value)) return "Enter valid 6-digit PIN code.";
    return undefined;
  };

  const validateCountry = (value: string): string | undefined => {
    if (value !== "IN") return "Select country (India).";
    return undefined;
  };

  const validateContactPerson = (value: string, phone: string = '', email: string = ''): string | undefined => {
    const trimmed = value.trim();
    
    // Required if both phone and email are missing
    if (!trimmed && !phone.trim() && !email.trim()) {
      return "Enter valid contact name.";
    }
    
    if (trimmed) {
      if (trimmed.length < 2 || trimmed.length > 30) return "Enter valid contact name.";
      if (!/^[A-Za-z ]+$/.test(trimmed)) return "Enter valid contact name.";
    }
    
    return undefined;
  };

  const validatePhone = (value: string): string | undefined => {
    if (!value) return undefined; // Optional but recommended
    // Only allow numbers, validate 10 digits only
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length !== 10) return "Enter valid 10-digit Indian mobile number.";
    if (!/^[6-9]/.test(cleaned)) return "Enter valid 10-digit Indian mobile number.";
    return undefined;
  };

  const validateEmail = (value: string): string | undefined => {
    if (!value) return undefined; // Optional
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(value)) return "Enter valid email address.";
    return undefined;
  };

  const validateField = async (name: keyof ValidationErrors, value: string, formData?: FormData) => {
    let error: string | undefined;
    
    switch (name) {
      case 'warehouse_name':
        error = validateWarehouseName(value);
        break;
      case 'warehouse_code':
        error = await validateWarehouseCode(value.toUpperCase());
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
      case 'address_line2':
        error = validateAddressLine2(value);
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
        if (formData) {
          const phone = formData.get('contact_person_phone') as string || '';
          const email = formData.get('contact_person_email') as string || '';
          error = validateContactPerson(value, phone, email);
        } else {
          error = validateContactPerson(value);
        }
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

  const handleFieldChange = async (name: keyof ValidationErrors, value: string) => {
    // Auto-uppercase for specific fields
    if (name === 'warehouse_code' || name === 'wh_bin_code') {
      value = value.toUpperCase();
    }
    await validateField(name, value);
  };

  const validateForm = async (formData: FormData): Promise<boolean> => {
    console.log('Starting form validation...');
    const newErrors: ValidationErrors = {};
    
    const phone = formData.get('contact_person_phone') as string || '';
    const email = formData.get('contact_person_email') as string || '';
    const contactName = formData.get('contact_person_name') as string || '';
    
    console.log('Form data extracted:', {
      warehouse_name: formData.get('warehouse_name'),
      warehouse_code: formData.get('warehouse_code'),
      wh_bin_code: formData.get('wh_bin_code'),
      bin_name: formData.get('bin_name'),
      phone,
      email,
      contactName
    });
    
    // Required field validations
    const warehouseNameError = validateWarehouseName(formData.get('warehouse_name') as string || '');
    if (warehouseNameError) {
      newErrors.warehouse_name = warehouseNameError;
      console.log('Warehouse name error:', warehouseNameError);
    }
    
    const warehouseCodeError = await validateWarehouseCode(formData.get('warehouse_code') as string || '');
    if (warehouseCodeError) {
      newErrors.warehouse_code = warehouseCodeError;
      console.log('Warehouse code error:', warehouseCodeError);
    }
    
    const binCodeError = validateBinCode(formData.get('wh_bin_code') as string || '');
    if (binCodeError) {
      newErrors.wh_bin_code = binCodeError;
      console.log('BIN code error:', binCodeError);
    }
    
    const binNameError = validateBinName(formData.get('bin_name') as string || '');
    if (binNameError) {
      newErrors.bin_name = binNameError;
      console.log('BIN name error:', binNameError);
    }
    
    const addressLine1Error = validateAddressLine1(formData.get('address_line1') as string || '');
    if (addressLine1Error) {
      newErrors.address_line1 = addressLine1Error;
      console.log('Address line 1 error:', addressLine1Error);
    }
    
    const addressLine2Error = validateAddressLine2(formData.get('address_line2') as string || '');
    if (addressLine2Error) {
      newErrors.address_line2 = addressLine2Error;
      console.log('Address line 2 error:', addressLine2Error);
    }
    
    const cityError = validateCity(formData.get('city') as string || '');
    if (cityError) {
      newErrors.city = cityError;
      console.log('City error:', cityError);
    }
    
    const stateError = validateState(formData.get('state') as string || '');
    if (stateError) {
      newErrors.state = stateError;
      console.log('State error:', stateError);
    }
    
    const pinCodeError = validatePinCode(formData.get('postal_code') as string || '');
    if (pinCodeError) {
      newErrors.postal_code = pinCodeError;
      console.log('PIN code error:', pinCodeError);
    }
    
    const countryError = validateCountry(formData.get('country') as string || 'IN');
    if (countryError) {
      newErrors.country = countryError;
      console.log('Country error:', countryError);
    }
    
    const contactPersonError = validateContactPerson(contactName, phone, email);
    if (contactPersonError) {
      newErrors.contact_person_name = contactPersonError;
      console.log('Contact person error:', contactPersonError);
    }
    
    const phoneError = validatePhone(phone);
    if (phoneError) {
      newErrors.contact_person_phone = phoneError;
      console.log('Phone error:', phoneError);
    }
    
    const emailError = validateEmail(email);
    if (emailError) {
      newErrors.contact_person_email = emailError;
      console.log('Email error:', emailError);
    }

    // Remove undefined errors
    Object.keys(newErrors).forEach(key => {
      if (!newErrors[key as keyof ValidationErrors]) {
        delete newErrors[key as keyof ValidationErrors];
      }
    });

    console.log('Final validation errors:', newErrors);
    console.log('Form is valid:', Object.keys(newErrors).length === 0);
    
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
    
    if (!await validateForm(formData)) {
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
                  onChange={(e) => handleFieldChange('address_line2', e.target.value)}
                  className={`h-9 ${errors.address_line2 ? 'border-red-500' : ''}`}
                />
                {errors.address_line2 && <p className="text-sm text-red-500 mt-1">{errors.address_line2}</p>}
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
                  Phone Number (+91)
                </Label>
                <Input 
                  id="contact_person_phone" 
                  name="contact_person_phone" 
                  type="tel"
                  placeholder="9876543210"
                  defaultValue={editingBin?.contact_person_phone?.replace('+91', '') || ''}
                  onChange={(e) => {
                    // Only allow numbers
                    const numericValue = e.target.value.replace(/\D/g, '');
                    e.target.value = numericValue;
                    handleFieldChange('contact_person_phone', numericValue);
                  }}
                  className={`h-9 ${errors.contact_person_phone ? 'border-red-500' : ''}`}
                  maxLength={10}
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