import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Customer {
  id?: string;
  name: string;
  customer_ref?: string;
  email?: string;
  phone?: string;
  contact_person?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  country?: string;
  pin_code?: string;
  shipping_address_line1?: string;
  shipping_address_line2?: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_country?: string;
  shipping_pin_code?: string;
  same_as_registered_address?: boolean;
  gstin?: string;
  pan_number?: string;
  bank_name?: string;
  branch_name?: string;
  account_type?: string;
  account_number?: string;
  ifsc_code?: string;
  payment_terms?: string;
  preferred_currency?: string;
  credit_limit?: number;
  customer_type?: string;
  is_active?: boolean;
}

interface CustomerFormProps {
  customer?: Customer;
  onSubmit: (data: Customer) => Promise<void>;
  onCancel: () => void;
}

export const CustomerForm: React.FC<CustomerFormProps> = ({
  customer,
  onSubmit,
  onCancel,
}) => {
  const [loading, setLoading] = useState(false);
  const [sameAsRegistered, setSameAsRegistered] = useState(customer?.same_as_registered_address || false);

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
      customer_type: 'Business',
      is_active: true,
      same_as_registered_address: false,
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
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Customer Name *</Label>
              <Input
                id="name"
                {...register('name', { required: 'Customer name is required' })}
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="customer_ref">Customer Reference</Label>
              <Input
                id="customer_ref"
                {...register('customer_ref')}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                {...register('phone')}
              />
            </div>
            <div>
              <Label htmlFor="contact_person">Contact Person</Label>
              <Input
                id="contact_person"
                {...register('contact_person')}
              />
            </div>
            <div>
              <Label htmlFor="customer_type">Customer Type</Label>
              <Select
                defaultValue={customer?.customer_type || 'Business'}
                onValueChange={(value) => setValue('customer_type', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Business">Business</SelectItem>
                  <SelectItem value="Individual">Individual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registered Address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="address_line1">Address Line 1</Label>
              <Input
                id="address_line1"
                {...register('address_line1')}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="address_line2">Address Line 2</Label>
              <Input
                id="address_line2"
                {...register('address_line2')}
              />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                {...register('city')}
              />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                {...register('state')}
              />
            </div>
            <div>
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                {...register('country')}
                defaultValue="India"
              />
            </div>
            <div>
              <Label htmlFor="pin_code">PIN Code</Label>
              <Input
                id="pin_code"
                {...register('pin_code')}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shipping Address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="same_as_registered"
              checked={sameAsRegistered}
              onCheckedChange={setSameAsRegistered}
            />
            <Label htmlFor="same_as_registered">Same as registered address</Label>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="shipping_address_line1">Shipping Address Line 1</Label>
              <Input
                id="shipping_address_line1"
                {...register('shipping_address_line1')}
                disabled={sameAsRegistered}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="shipping_address_line2">Shipping Address Line 2</Label>
              <Input
                id="shipping_address_line2"
                {...register('shipping_address_line2')}
                disabled={sameAsRegistered}
              />
            </div>
            <div>
              <Label htmlFor="shipping_city">Shipping City</Label>
              <Input
                id="shipping_city"
                {...register('shipping_city')}
                disabled={sameAsRegistered}
              />
            </div>
            <div>
              <Label htmlFor="shipping_state">Shipping State</Label>
              <Input
                id="shipping_state"
                {...register('shipping_state')}
                disabled={sameAsRegistered}
              />
            </div>
            <div>
              <Label htmlFor="shipping_country">Shipping Country</Label>
              <Input
                id="shipping_country"
                {...register('shipping_country')}
                disabled={sameAsRegistered}
              />
            </div>
            <div>
              <Label htmlFor="shipping_pin_code">Shipping PIN Code</Label>
              <Input
                id="shipping_pin_code"
                {...register('shipping_pin_code')}
                disabled={sameAsRegistered}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tax & Legal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="gstin">GSTIN</Label>
              <Input
                id="gstin"
                {...register('gstin')}
              />
            </div>
            <div>
              <Label htmlFor="pan_number">PAN Number</Label>
              <Input
                id="pan_number"
                {...register('pan_number')}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Banking & Payment Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="bank_name">Bank Name</Label>
              <Input
                id="bank_name"
                {...register('bank_name')}
              />
            </div>
            <div>
              <Label htmlFor="branch_name">Branch Name</Label>
              <Input
                id="branch_name"
                {...register('branch_name')}
              />
            </div>
            <div>
              <Label htmlFor="account_type">Account Type</Label>
              <Select
                defaultValue={customer?.account_type || ''}
                onValueChange={(value) => setValue('account_type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Savings">Savings</SelectItem>
                  <SelectItem value="Current">Current</SelectItem>
                  <SelectItem value="CC">CC</SelectItem>
                  <SelectItem value="OD">OD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="account_number">Account Number</Label>
              <Input
                id="account_number"
                {...register('account_number')}
              />
            </div>
            <div>
              <Label htmlFor="ifsc_code">IFSC Code</Label>
              <Input
                id="ifsc_code"
                {...register('ifsc_code')}
              />
            </div>
            <div>
              <Label htmlFor="payment_terms">Payment Terms</Label>
              <Input
                id="payment_terms"
                {...register('payment_terms')}
                placeholder="e.g., Net 30"
              />
            </div>
            <div>
              <Label htmlFor="preferred_currency">Preferred Currency</Label>
              <Select
                defaultValue={customer?.preferred_currency || 'INR'}
                onValueChange={(value) => setValue('preferred_currency', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INR">INR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="credit_limit">Credit Limit</Label>
              <Input
                id="credit_limit"
                type="number"
                step="0.01"
                {...register('credit_limit', { valueAsNumber: true })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : customer ? 'Update Customer' : 'Create Customer'}
        </Button>
      </div>
    </form>
  );
};