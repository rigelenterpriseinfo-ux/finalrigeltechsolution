import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Building2, Phone, CreditCard, Landmark, User, X } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState('basic');
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
      country: 'India',
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

  const getProgressValue = () => {
    switch (activeTab) {
      case 'basic': return 25;
      case 'contact': return 50;
      case 'business': return 75;
      case 'banking': return 100;
      default: return 25;
    }
  };

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
    <div className="w-full max-w-4xl mx-auto">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                <User className="h-5 w-5" />
                {customer ? 'Edit Customer' : 'New Customer'}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {customer ? 'Update customer information' : 'Add a new customer to your database'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-3 mt-4">
            <span className="text-sm font-medium">Progress</span>
            <Progress value={getProgressValue()} className="flex-1" />
            <span className="text-sm text-muted-foreground">{getProgressValue()}%</span>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onFormSubmit)}>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Basic
                </TabsTrigger>
                <TabsTrigger value="contact" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Contact
                </TabsTrigger>
                <TabsTrigger value="business" className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Business
                </TabsTrigger>
                <TabsTrigger value="banking" className="flex items-center gap-2">
                  <Landmark className="h-4 w-4" />
                  Banking
                </TabsTrigger>
              </TabsList>

              {/* Basic Information Tab */}
              <TabsContent value="basic" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <Label htmlFor="name" className="text-sm font-medium">
                      Customer Name / Company Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      {...register('name', { required: 'Customer name is required' })}
                      placeholder="Enter legal/trade name"
                      className={`mt-1 ${errors.name ? 'border-destructive' : ''}`}
                      disabled={!canEdit}
                    />
                    {errors.name && (
                      <p className="text-xs text-destructive mt-1">{errors.name.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">Legal or trade name as registered</p>
                  </div>

                  <div>
                    <Label htmlFor="customer_type" className="text-sm font-medium">Customer Type</Label>
                    <Select
                      defaultValue={customer?.customer_type || 'business'}
                      onValueChange={(value) => setValue('customer_type', value)}
                      disabled={!canEdit}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">Individual</SelectItem>
                        <SelectItem value="business">Business</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="customer_ref" className="text-sm font-medium">Customer ID</Label>
                    <Input
                      id="customer_ref"
                      {...register('customer_ref')}
                      placeholder="Auto-generated"
                      disabled={true}
                      className="mt-1 bg-muted"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Auto-generated: First 4 letters + DDMMYYYY
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Active Status</Label>
                      <Switch
                        checked={watch('is_active') ?? true}
                        onCheckedChange={(checked) => setValue('is_active', checked)}
                        disabled={!canEdit}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Enable to allow transactions with this customer
                    </p>
                  </div>
                </div>
              </TabsContent>

              {/* Contact Information Tab */}
              <TabsContent value="contact" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <Label htmlFor="contact_person" className="text-sm font-medium">Contact Person</Label>
                    <Input
                      id="contact_person"
                      {...register('contact_person')}
                      placeholder="Primary contact name"
                      className="mt-1"
                      disabled={!canEdit}
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone" className="text-sm font-medium">Phone / Mobile</Label>
                    <Input
                      id="phone"
                      type="tel"
                      {...register('phone')}
                      placeholder="Enter phone number"
                      className="mt-1"
                      disabled={!canEdit}
                    />
                  </div>

                  <div>
                    <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      {...register('email')}
                      placeholder="Enter email address"
                      className="mt-1"
                      disabled={!canEdit}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="website" className="text-sm font-medium">Website</Label>
                    <Input
                      id="website"
                      {...register('website')}
                      placeholder="https://example.com"
                      className="mt-1"
                      disabled={!canEdit}
                    />
                  </div>

                  {/* Address Section */}
                  <div className="md:col-span-2 space-y-4">
                    <h4 className="font-medium text-sm">Billing Address</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <Label htmlFor="address_line1" className="text-sm">Address Line 1</Label>
                        <Input
                          id="address_line1"
                          {...register('address_line1')}
                          placeholder="Enter address"
                          className="mt-1"
                          disabled={!canEdit}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="address_line2" className="text-sm">Address Line 2</Label>
                        <Input
                          id="address_line2"
                          {...register('address_line2')}
                          placeholder="Apartment, suite, etc."
                          className="mt-1"
                          disabled={!canEdit}
                        />
                      </div>
                      <div>
                        <Label htmlFor="city" className="text-sm">City</Label>
                        <Input
                          id="city"
                          {...register('city')}
                          placeholder="Enter city"
                          className="mt-1"
                          disabled={!canEdit}
                        />
                      </div>
                      <div>
                        <Label htmlFor="state" className="text-sm">State</Label>
                        <Input
                          id="state"
                          {...register('state')}
                          placeholder="Enter state"
                          className="mt-1"
                          disabled={!canEdit}
                        />
                      </div>
                      <div>
                        <Label htmlFor="pin_code" className="text-sm">Postal Code</Label>
                        <Input
                          id="pin_code"
                          {...register('pin_code')}
                          placeholder="Enter postal code"
                          className="mt-1"
                          disabled={!canEdit}
                        />
                      </div>
                      <div>
                        <Label htmlFor="country" className="text-sm">Country</Label>
                        <Input
                          id="country"
                          {...register('country')}
                          defaultValue="India"
                          className="mt-1"
                          disabled={!canEdit}
                        />
                      </div>
                    </div>

                    {/* Same as billing address toggle */}
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="same_as_registered"
                        checked={sameAsRegistered}
                        onCheckedChange={setSameAsRegistered}
                        disabled={!canEdit}
                      />
                      <Label htmlFor="same_as_registered" className="text-sm">
                        Same as billing address
                      </Label>
                    </div>

                    {/* Shipping Address */}
                    {!sameAsRegistered && (
                      <div className="space-y-4">
                        <h4 className="font-medium text-sm">Shipping Address</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="md:col-span-2">
                            <Label htmlFor="shipping_address_line1" className="text-sm">Shipping Address Line 1</Label>
                            <Input
                              id="shipping_address_line1"
                              {...register('shipping_address_line1')}
                              placeholder="Enter shipping address"
                              className="mt-1"
                              disabled={!canEdit}
                            />
                          </div>
                          <div>
                            <Label htmlFor="shipping_city" className="text-sm">City</Label>
                            <Input
                              id="shipping_city"
                              {...register('shipping_city')}
                              placeholder="Enter city"
                              className="mt-1"
                              disabled={!canEdit}
                            />
                          </div>
                          <div>
                            <Label htmlFor="shipping_state" className="text-sm">State</Label>
                            <Input
                              id="shipping_state"
                              {...register('shipping_state')}
                              placeholder="Enter state"
                              className="mt-1"
                              disabled={!canEdit}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Business Information Tab */}
              <TabsContent value="business" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="gstin" className="text-sm font-medium">GSTIN</Label>
                    <Input
                      id="gstin"
                      {...register('gstin')}
                      placeholder="Enter GSTIN"
                      className="mt-1"
                      disabled={!canEdit}
                    />
                  </div>

                  <div>
                    <Label htmlFor="pan_number" className="text-sm font-medium">PAN Number</Label>
                    <Input
                      id="pan_number"
                      {...register('pan_number')}
                      placeholder="Enter PAN number"
                      className="mt-1"
                      disabled={!canEdit}
                    />
                  </div>

                  <div>
                    <Label htmlFor="payment_terms" className="text-sm font-medium">Payment Terms</Label>
                    <Select
                      defaultValue={customer?.payment_terms || ''}
                      onValueChange={(value) => setValue('payment_terms', value)}
                      disabled={!canEdit}
                    >
                      <SelectTrigger className="mt-1">
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
                    <Label htmlFor="credit_limit_days" className="text-sm font-medium">Credit Days</Label>
                    <Input
                      id="credit_limit_days"
                      type="number"
                      {...register('credit_limit_days', { valueAsNumber: true })}
                      placeholder="30"
                      className="mt-1"
                      disabled={!canEdit}
                    />
                  </div>

                  <div>
                    <Label htmlFor="preferred_payment_method" className="text-sm font-medium">Payment Method</Label>
                    <Select
                      defaultValue={customer?.preferred_payment_method || 'Bank Transfer'}
                      onValueChange={(value) => setValue('preferred_payment_method', value)}
                      disabled={!canEdit}
                    >
                      <SelectTrigger className="mt-1">
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
                    <Label htmlFor="credit_limit" className="text-sm font-medium">Credit Limit</Label>
                    <Input
                      id="credit_limit"
                      type="number"
                      step="0.01"
                      {...register('credit_limit', { valueAsNumber: true })}
                      placeholder="0.00"
                      className="mt-1"
                      disabled={!canEdit}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Banking Information Tab */}
              <TabsContent value="banking" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="bank_name" className="text-sm font-medium">Bank Name</Label>
                    <Input
                      id="bank_name"
                      {...register('bank_name')}
                      placeholder="Enter bank name"
                      className="mt-1"
                      disabled={!canEdit}
                    />
                  </div>

                  <div>
                    <Label htmlFor="branch_name" className="text-sm font-medium">Branch Name</Label>
                    <Input
                      id="branch_name"
                      {...register('branch_name')}
                      placeholder="Enter branch name"
                      className="mt-1"
                      disabled={!canEdit}
                    />
                  </div>

                  <div>
                    <Label htmlFor="account_number" className="text-sm font-medium">Account Number</Label>
                    <Input
                      id="account_number"
                      {...register('account_number')}
                      placeholder="Enter account number"
                      className="mt-1"
                      disabled={!canEdit}
                    />
                  </div>

                  <div>
                    <Label htmlFor="account_type" className="text-sm font-medium">Account Type</Label>
                    <Select
                      defaultValue={customer?.account_type || ''}
                      onValueChange={(value) => setValue('account_type', value)}
                      disabled={!canEdit}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select account type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Savings">Savings</SelectItem>
                        <SelectItem value="Current">Current</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="ifsc_code" className="text-sm font-medium">IFSC Code</Label>
                    <Input
                      id="ifsc_code"
                      {...register('ifsc_code')}
                      placeholder="Enter IFSC code"
                      className="mt-1"
                      disabled={!canEdit}
                    />
                  </div>

                  <div>
                    <Label htmlFor="upi_id" className="text-sm font-medium">UPI ID</Label>
                    <Input
                      id="upi_id"
                      {...register('upi_id')}
                      placeholder="example@upi"
                      className="mt-1"
                      disabled={!canEdit}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Form Actions */}
            <div className="flex justify-end space-x-3 pt-6 border-t mt-8">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading}
              >
                Cancel
              </Button>
              {canEdit && (
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="min-w-[120px]"
                >
                  {loading ? 'Saving...' : (customer ? 'Update Customer' : 'Create Customer')}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};