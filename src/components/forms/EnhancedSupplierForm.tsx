import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { 
  Building2, 
  Phone, 
  Mail, 
  Globe, 
  MapPin, 
  FileText, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  User,
  Landmark
} from 'lucide-react';
import { 
  supplierValidationSchema, 
  SupplierFormData,
  formatPhone,
  formatGSTIN,
  formatPAN,
  formatIFSC,
  formatPincode
} from '@/lib/validation/supplier';

interface Supplier {
  id?: string;
  supplier_ref?: string;
  name: string;
  supplier_type?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  website?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  country?: string;
  pin_code?: string;
  gst_number?: string;
  tax_id?: string;
  pan_number?: string;
  business_registration_no?: string;
  preferred_currency?: string;
  payment_terms?: string;
  bank_name?: string;
  branch_name?: string;
  account_number?: string;
  ifsc_code?: string;  
  swift_code?: string;
  is_active?: boolean;
}

interface EnhancedSupplierFormProps {
  supplier?: Supplier;
  onSubmit: (data: Supplier) => Promise<void>;
  onCancel: () => void;
  readOnly?: boolean;
}

export const EnhancedSupplierForm: React.FC<EnhancedSupplierFormProps> = ({
  supplier,
  onSubmit,
  onCancel,
  readOnly = false,
}) => {
  const { hasEditAccess } = useBusinessAuth();
  const [loading, setLoading] = useState(false);
  const [completionProgress, setCompletionProgress] = useState(0);
  const canEdit = hasEditAccess('purchase') && !readOnly;

  const form = useForm<SupplierFormData>({
    resolver: zodResolver(supplierValidationSchema),
    defaultValues: supplier || {
      name: '',
      supplier_type: 'Manufacturer',
      preferred_currency: 'INR',
      payment_terms: 'Net 30',
      country: 'India',
      is_active: true,
    },
  });

  const { watch, setValue, formState: { errors } } = form;
  const watchedValues = watch();

  // Calculate form completion progress
  useEffect(() => {
    const requiredFields = ['name'];
    const optionalFields = [
      'contact_person', 'phone', 'email', 'address_line1', 'city', 
      'state', 'pin_code', 'gst_number', 'bank_name', 'account_number', 'ifsc_code'
    ];
    
    const completedRequired = requiredFields.filter(field => 
      watchedValues[field as keyof SupplierFormData]
    ).length;
    
    const completedOptional = optionalFields.filter(field => 
      watchedValues[field as keyof SupplierFormData]
    ).length;
    
    const progress = Math.round(
      ((completedRequired / requiredFields.length) * 50) + 
      ((completedOptional / optionalFields.length) * 50)
    );
    
    setCompletionProgress(progress);
  }, [watchedValues]);

  const onFormSubmit = async (data: SupplierFormData) => {
    setLoading(true);
    try {
      await onSubmit(data as Supplier);
      toast.success(supplier ? 'Supplier updated successfully' : 'Supplier created successfully');
    } catch (error) {
      console.error('Error submitting supplier:', error);
      toast.error('Failed to save supplier. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-format functions
  const handlePhoneFormat = (value: string) => {
    const formatted = formatPhone(value);
    setValue('phone', formatted);
  };

  const handleGSTINFormat = (value: string) => {
    const formatted = formatGSTIN(value);
    setValue('gst_number', formatted);
  };

  const handlePANFormat = (value: string) => {
    const formatted = formatPAN(value);
    setValue('pan_number', formatted);
  };

  const handleIFSCFormat = (value: string) => {
    const formatted = formatIFSC(value);
    setValue('ifsc_code', formatted);
  };

  const handlePincodeFormat = (value: string) => {
    const formatted = formatPincode(value);
    setValue('pin_code', formatted);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header with Progress */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            {supplier ? 'Edit Supplier' : 'New Supplier'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {supplier ? 'Update supplier information' : 'Add a new supplier to your database'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Completion</span>
            <Progress value={completionProgress} className="w-20" />
            <span className="text-sm font-medium">{completionProgress}%</span>
          </div>
          {supplier?.is_active && (
            <Badge variant="default" className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Active
            </Badge>
          )}
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Basic Info</span>
              </TabsTrigger>
              <TabsTrigger value="contact" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <span className="hidden sm:inline">Contact</span>
              </TabsTrigger>
              <TabsTrigger value="business" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Business</span>
              </TabsTrigger>
              <TabsTrigger value="banking" className="flex items-center gap-2">
                <Landmark className="h-4 w-4" />
                <span className="hidden sm:inline">Banking</span>
              </TabsTrigger>
            </TabsList>

            {/* Basic Information Tab */}
            <TabsContent value="basic" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            Supplier Name *
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Enter legal/trade name"
                              className="h-11"
                              disabled={!canEdit}
                            />
                          </FormControl>
                          <FormDescription>
                            Legal or trade name as registered
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="supplier_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Supplier Type</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                            disabled={!canEdit}
                          >
                            <FormControl>
                              <SelectTrigger className="h-11">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Manufacturer">Manufacturer</SelectItem>
                              <SelectItem value="Distributor">Distributor</SelectItem>
                              <SelectItem value="Service Provider">Service Provider</SelectItem>
                              <SelectItem value="Trader">Trader</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="contact_person"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Contact Person
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Primary contact name"
                              className="h-11"
                              disabled={!canEdit}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="supplier_ref"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Supplier ID</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Auto-generated"
                              className="h-11 bg-muted"
                              disabled={true}
                            />
                          </FormControl>
                          <FormDescription>
                            Auto-generated: First 4 letters + DDMMYYYY
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Active Status</FormLabel>
                          <FormDescription>
                            Enable to allow transactions with this supplier
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={!canEdit}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Contact & Address Tab */}
            <TabsContent value="contact" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Contact Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            Phone Number
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="9876543210"
                              className="h-11"
                              disabled={!canEdit}
                              onChange={(e) => {
                                field.onChange(e);
                                handlePhoneFormat(e.target.value);
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            Indian mobile number (10 digits)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            Email Address
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="email"
                              placeholder="contact@supplier.com"
                              className="h-11"
                              disabled={!canEdit}
                            />
                          </FormControl>
                          <FormDescription>
                            Business email for official communication
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="website"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel className="flex items-center gap-2">
                            <Globe className="h-4 w-4" />
                            Website
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="https://www.supplier.com"
                              className="h-11"
                              disabled={!canEdit}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Address Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="address_line1"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Address Line 1</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Street address, building number"
                              className="h-11"
                              disabled={!canEdit}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address_line2"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Address Line 2 (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Apartment, suite, landmark"
                              className="h-11"
                              disabled={!canEdit}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="City name"
                              className="h-11"
                              disabled={!canEdit}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State/Province</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="State or province"
                              className="h-11"
                              disabled={!canEdit}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="pin_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>PIN Code</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="123456"
                              className="h-11"
                              disabled={!canEdit}
                              onChange={(e) => {
                                field.onChange(e);
                                handlePincodeFormat(e.target.value);
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            6-digit postal code
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="India"
                              className="h-11"
                              disabled={!canEdit}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Business & Tax Tab */}
            <TabsContent value="business" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Business & Tax Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="gst_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            GSTIN / Tax ID
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="22AAAAA0000A1Z5"
                              className="h-11"
                              disabled={!canEdit}
                              onChange={(e) => {
                                field.onChange(e);
                                handleGSTINFormat(e.target.value);
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            15-character GSTIN for tax compliance
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="pan_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>PAN Number</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="ABCDE1234F"
                              className="h-11"
                              disabled={!canEdit}
                              onChange={(e) => {
                                field.onChange(e);
                                handlePANFormat(e.target.value);
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            10-character PAN number
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="business_registration_no"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Business Registration Number</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Registration number"
                              className="h-11"
                              disabled={!canEdit}
                            />
                          </FormControl>
                          <FormDescription>
                            Company registration or incorporation number
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="preferred_currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preferred Currency</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                            disabled={!canEdit}
                          >
                            <FormControl>
                              <SelectTrigger className="h-11">
                                <SelectValue placeholder="Select currency" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                              <SelectItem value="USD">USD - US Dollar</SelectItem>
                              <SelectItem value="EUR">EUR - Euro</SelectItem>
                              <SelectItem value="GBP">GBP - British Pound</SelectItem>
                              <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="payment_terms"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Terms</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                            disabled={!canEdit}
                          >
                            <FormControl>
                              <SelectTrigger className="h-11">
                                <SelectValue placeholder="Select terms" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Advance">Advance Payment</SelectItem>
                              <SelectItem value="COD">Cash on Delivery</SelectItem>
                              <SelectItem value="Net 15">Net 15 Days</SelectItem>
                              <SelectItem value="Net 30">Net 30 Days</SelectItem>
                              <SelectItem value="Net 45">Net 45 Days</SelectItem>
                              <SelectItem value="Net 60">Net 60 Days</SelectItem>
                              <SelectItem value="Net 90">Net 90 Days</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Banking Information Tab */}
            <TabsContent value="banking" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Banking Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="bank_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Landmark className="h-4 w-4" />
                            Bank Name
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="State Bank of India"
                              className="h-11"
                              disabled={!canEdit}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="branch_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Branch Name</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Main Branch"
                              className="h-11"
                              disabled={!canEdit}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="account_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Number</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Account number"
                              className="h-11"
                              disabled={!canEdit}
                            />
                          </FormControl>
                          <FormDescription>
                            9-18 digit bank account number
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="ifsc_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>IFSC Code</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="SBIN0001234"
                              className="h-11"
                              disabled={!canEdit}
                              onChange={(e) => {
                                field.onChange(e);
                                handleIFSCFormat(e.target.value);
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            11-character IFSC code for Indian banks
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="swift_code"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>SWIFT Code (International)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="SBININBB123"
                              className="h-11"
                              disabled={!canEdit}
                            />
                          </FormControl>
                          <FormDescription>
                            8 or 11 character SWIFT code for international transfers
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-4 pt-6 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {Object.keys(errors).length > 0 && (
                <>
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span>Please fix {Object.keys(errors).length} error(s) above</span>
                </>
              )}
              {Object.keys(errors).length === 0 && completionProgress === 100 && (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span>Form is complete and ready to submit</span>
                </>
              )}
            </div>
            
            <div className="flex gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onCancel}
                className="min-w-[100px]"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={loading || !canEdit}
                className="min-w-[120px]"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Saving...
                  </>
                ) : (
                  supplier ? 'Update Supplier' : 'Create Supplier'
                )}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
};