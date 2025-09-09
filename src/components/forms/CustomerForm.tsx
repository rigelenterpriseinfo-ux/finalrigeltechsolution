import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';

interface Customer {
  id?: string;
  customer_ref?: string;
  name: string;
  customer_type?: string;
  is_active?: boolean;
  contact_person?: string;
  phone?: string;
  email?: string;
  website?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pin_code?: string;
  country?: string;
  same_as_registered_address?: boolean;
  shipping_address_line1?: string;
  shipping_address_line2?: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_pin_code?: string;
  shipping_country?: string;
  gstin?: string;
  gst_tax_location?: string;
  pan_number?: string;
  msme_registration_no?: string;
  business_registration_no?: string;
  payment_terms?: string;
  credit_limit_days?: number;
  preferred_payment_method?: string;
  preferred_currency?: string;
  billing_cycle?: string;
  bank_name?: string;
  branch_name?: string;
  account_number?: string;
  account_type?: string;
  ifsc_code?: string;
  swift_code?: string;
  upi_id?: string;
  credit_limit?: number;
}

interface CustomerFormProps {
  customer?: Customer;
  onSubmit: (data: Customer) => Promise<void>;
  onCancel: () => void;
  readOnly?: boolean;
}

export const CustomerForm: React.FC<CustomerFormProps> = ({
  customer,
  onSubmit,
  onCancel,
  readOnly = false,
}) => {
  const { hasEditAccess } = useBusinessAuth();
  const [loading, setLoading] = useState(false);
  const [sameAsRegistered, setSameAsRegistered] = useState(customer?.same_as_registered_address || false);
  const [isAddressOpen, setIsAddressOpen] = useState(false);
  const [isFinancialOpen, setIsFinancialOpen] = useState(false);
  const canEdit = hasEditAccess('sales') && !readOnly;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Customer>({
    defaultValues: customer || {
      name: '',
      preferred_currency: 'INR',
      customer_type: 'business',
      is_active: true,
      same_as_registered_address: false,
      credit_limit_days: 30,
      preferred_payment_method: 'Bank Transfer',
    },
  });

  const watchedFields = watch(['address_line1', 'address_line2', 'city', 'state', 'country', 'pin_code']);

  useEffect(() => {
    if (sameAsRegistered) {
      setValue('shipping_address_line1', watchedFields[0] || '');
      setValue('shipping_address_line2', watchedFields[1] || '');
      setValue('shipping_city', watchedFields[2] || '');
      setValue('shipping_state', watchedFields[3] || '');
      setValue('shipping_country', watchedFields[4] || '');
      setValue('shipping_pin_code', watchedFields[5] || '');
    }
  }, [sameAsRegistered, watchedFields, setValue]);

  const onFormSubmit = async (data: Customer) => {
    setLoading(true);
    try {
      data.same_as_registered_address = sameAsRegistered;
      await onSubmit(data);
    } catch (error) {
      console.error('Error submitting customer:', error);
      toast.error('Failed to save customer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[95vw] mx-auto">
      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-2 md:space-y-4 max-h-[80vh] overflow-y-auto">
        {/* Basic Information */}
        <Card>
          <CardHeader className="pb-2 md:pb-4">
            <CardTitle className="text-base md:text-lg">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label htmlFor="customer_ref" className="text-sm">Customer ID</Label>
                <Input
                  id="customer_ref"
                  {...register('customer_ref')}
                  placeholder="Auto-generated"
                  disabled={true}
                  className="bg-muted h-9 text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Format: First 4 letters + number
                </p>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="name" className="text-sm">Customer Name / Company Name *</Label>
                <Input
                  id="name"
                  {...register('name', { required: 'Customer name is required' })}
                  className={`h-9 text-sm ${errors.name ? 'border-destructive' : ''}`}
                  disabled={!canEdit}
                />
                {errors.name && (
                  <p className="text-xs text-destructive mt-1">{errors.name.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="customer_type" className="text-sm">Customer Type</Label>
                <Select
                  defaultValue={customer?.customer_type || 'business'}
                  onValueChange={(value) => setValue('customer_type', value)}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="is_active" className="text-sm">Status</Label>
                <Select
                  defaultValue={customer?.is_active ? 'Active' : 'Inactive'}
                  onValueChange={(value) => setValue('is_active', value === 'Active')}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
        </CardContent>
      </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader className="pb-2 md:pb-4">
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <span className="text-green-600">✓</span> Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label htmlFor="contact_person" className="text-sm">Primary Contact Person Name</Label>
                <Input
                  id="contact_person"
                  {...register('contact_person')}
                  disabled={!canEdit}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="phone" className="text-sm">Phone / Mobile</Label>
                <Input
                  id="phone"
                  type="tel"
                  {...register('phone')}
                  disabled={!canEdit}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="email" className="text-sm">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  {...register('email')}
                  disabled={!canEdit}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address Details - Collapsible */}
        <Collapsible open={isAddressOpen} onOpenChange={setIsAddressOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0">
                <CardHeader className="pb-2 md:pb-4 flex-1">
                  <CardTitle className="text-base md:text-lg flex items-center gap-2">
                    <span className="text-green-600">✓</span> Address Details
                    {isAddressOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4 pt-0">
                {/* Billing Address */}
                <div>
                  <h4 className="font-medium mb-2 text-sm">Billing Address</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <Label htmlFor="address_line1" className="text-sm">Address Line 1</Label>
                      <Input
                        id="address_line1"
                        {...register('address_line1')}
                        disabled={!canEdit}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="address_line2" className="text-sm">Address Line 2</Label>
                      <Input
                        id="address_line2"
                        {...register('address_line2')}
                        disabled={!canEdit}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="city" className="text-sm">City</Label>
                      <Input
                        id="city"
                        {...register('city')}
                        disabled={!canEdit}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="state" className="text-sm">State</Label>
                      <Input
                        id="state"
                        {...register('state')}
                        disabled={!canEdit}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="pin_code" className="text-sm">Postal Code</Label>
                      <Input
                        id="pin_code"
                        {...register('pin_code')}
                        disabled={!canEdit}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="country" className="text-sm">Country</Label>
                      <Input
                        id="country"
                        {...register('country')}
                        defaultValue="India"
                        disabled={!canEdit}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Shipping Address */}
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Switch
                      id="same_as_registered"
                      checked={sameAsRegistered}
                      onCheckedChange={setSameAsRegistered}
                      disabled={!canEdit}
                      className="data-[state=checked]:bg-primary"
                    />
                    <Label htmlFor="same_as_registered" className="text-sm cursor-pointer">Same as billing address</Label>
                  </div>
                  
                  {!sameAsRegistered && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <Label htmlFor="shipping_address_line1" className="text-sm">Shipping Address Line 1</Label>
                        <Input
                          id="shipping_address_line1"
                          {...register('shipping_address_line1')}
                          disabled={!canEdit}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="shipping_city" className="text-sm">City</Label>
                        <Input
                          id="shipping_city"
                          {...register('shipping_city')}
                          disabled={!canEdit}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="shipping_state" className="text-sm">State</Label>
                        <Input
                          id="shipping_state"
                          {...register('shipping_state')}
                          disabled={!canEdit}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Financial & Tax Details - Collapsible */}
        <Collapsible open={isFinancialOpen} onOpenChange={setIsFinancialOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0">
                <CardHeader className="pb-2 md:pb-4 flex-1">
                  <CardTitle className="text-base md:text-lg flex items-center gap-2">
                    <span className="text-green-600">✓</span> Financial & Tax Details
                    {isFinancialOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4 pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="gstin" className="text-sm">GSTIN</Label>
                    <Input
                      id="gstin"
                      {...register('gstin')}
                      disabled={!canEdit}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pan_number" className="text-sm">PAN Number</Label>
                    <Input
                      id="pan_number"
                      {...register('pan_number')}
                      disabled={!canEdit}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="payment_terms" className="text-sm">Payment Terms</Label>
                    <Select
                      defaultValue={customer?.payment_terms || ''}
                      onValueChange={(value) => setValue('payment_terms', value)}
                      disabled={!canEdit}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select terms" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Net 30">Net 30</SelectItem>
                        <SelectItem value="Net 15">Net 15</SelectItem>
                        <SelectItem value="Advance">Advance</SelectItem>
                        <SelectItem value="COD">COD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="credit_limit_days" className="text-sm">Credit Days</Label>
                    <Input
                      id="credit_limit_days"
                      type="number"
                      {...register('credit_limit_days', { valueAsNumber: true })}
                      placeholder="30"
                      disabled={!canEdit}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="preferred_payment_method" className="text-sm">Payment Method</Label>
                    <Select
                      defaultValue={customer?.preferred_payment_method || 'Bank Transfer'}
                      onValueChange={(value) => setValue('preferred_payment_method', value)}
                      disabled={!canEdit}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                        <SelectItem value="UPI">UPI</SelectItem>
                        <SelectItem value="Cash">Cash</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="credit_limit" className="text-sm">Credit Limit</Label>
                    <Input
                      id="credit_limit"
                      type="number"
                      step="0.01"
                      {...register('credit_limit', { valueAsNumber: true })}
                      disabled={!canEdit}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                {/* Bank Details */}
                <div className="mt-4">
                  <h4 className="font-medium mb-2 text-sm">Bank Details (optional)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="bank_name" className="text-sm">Bank Name</Label>
                      <Input
                        id="bank_name"
                        {...register('bank_name')}
                        disabled={!canEdit}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="account_number" className="text-sm">Account No</Label>
                      <Input
                        id="account_number"
                        {...register('account_number')}
                        disabled={!canEdit}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="ifsc_code" className="text-sm">IFSC Code</Label>
                      <Input
                        id="ifsc_code"
                        {...register('ifsc_code')}
                        disabled={!canEdit}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="upi_id" className="text-sm">UPI ID</Label>
                      <Input
                        id="upi_id"
                        {...register('upi_id')}
                        placeholder="example@upi"
                        disabled={!canEdit}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Form Actions */}
        <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4 border-t sticky bottom-0 bg-background">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            className="w-full sm:w-auto h-9 text-sm"
          >
            Cancel
          </Button>
          {canEdit && (
            <Button 
              type="submit" 
              disabled={loading}
              className="w-full sm:w-auto h-9 text-sm font-medium"
            >
              {loading ? 'Saving...' : (customer ? 'Update' : 'Create')}
            </Button>
          )}
        </div>
    </form>
  </div>
  );
};