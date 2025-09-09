import React, { useState, useEffect, useMemo } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  Landmark,
  AlertTriangle,
  ChevronDown,
  X
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
  const [showErrorSummary, setShowErrorSummary] = useState(false);
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

  // Field labels mapping for error display
  const fieldLabels: Record<string, string> = {
    name: 'Supplier Name',
    supplier_type: 'Supplier Type',
    contact_person: 'Contact Person',
    phone: 'Phone Number',
    email: 'Email Address',
    website: 'Website',
    address_line1: 'Address Line 1',
    address_line2: 'Address Line 2',
    city: 'City',
    state: 'State/Province',
    country: 'Country',
    pin_code: 'PIN Code',
    gst_number: 'GST Number',
    pan_number: 'PAN Number',
    business_registration_no: 'Business Registration Number',
    preferred_currency: 'Preferred Currency',
    payment_terms: 'Payment Terms',
    bank_name: 'Bank Name',
    branch_name: 'Branch Name',
    account_number: 'Account Number',
    ifsc_code: 'IFSC Code',
    swift_code: 'SWIFT Code'
  };

  // Required fields definition
  const requiredFields = ['name'];
  
  // Tab error checking
  const getTabErrors = useMemo(() => {
    const basicFields = ['name', 'supplier_type', 'contact_person'];
    const contactFields = ['phone', 'email', 'website', 'address_line1', 'address_line2', 'city', 'state', 'country', 'pin_code'];
    const businessFields = ['gst_number', 'pan_number', 'business_registration_no', 'preferred_currency', 'payment_terms'];
    const bankingFields = ['bank_name', 'branch_name', 'account_number', 'ifsc_code', 'swift_code'];

    return {
      basic: basicFields.some(field => errors[field as keyof SupplierFormData]),
      contact: contactFields.some(field => errors[field as keyof SupplierFormData]),
      business: businessFields.some(field => errors[field as keyof SupplierFormData]),
      banking: bankingFields.some(field => errors[field as keyof SupplierFormData])
    };
  }, [errors]);

  // Auto-show error summary when errors exist
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      setShowErrorSummary(true);
    } else {
      setShowErrorSummary(false);
    }
  }, [errors]);

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
    <div className="w-full max-w-[95vw] md:max-w-4xl lg:max-w-6xl mx-auto p-3 md:p-4 space-y-3 md:space-y-4">
      {/* Header with Progress */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div>
          <h1 className="text-lg md:text-xl font-bold flex items-center gap-2">
            <Building2 className="h-4 w-4 md:h-5 md:w-5" />
            {supplier ? 'Edit Supplier' : 'New Supplier'}
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            {supplier ? 'Update supplier information' : 'Add a new supplier to your database'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Progress</span>
            <Progress value={completionProgress} className="w-16 h-2" />
            <span className="text-xs font-medium">{completionProgress}%</span>
          </div>
          {supplier?.is_active && (
            <Badge variant="default" className="flex items-center gap-1 text-xs">
              <CheckCircle2 className="h-3 w-3" />
              Active
            </Badge>
          )}
        </div>
      </div>

      {/* Error Summary Panel */}
      {Object.keys(errors).length > 0 && (
        <Collapsible open={showErrorSummary} onOpenChange={setShowErrorSummary}>
          <Alert variant="destructive" className="border-destructive/50">
            <AlertTriangle className="h-4 w-4" />
            <div className="flex items-center justify-between w-full">
              <div className="flex-1">
                <AlertDescription className="font-medium">
                  {Object.keys(errors).length} field{Object.keys(errors).length > 1 ? 's' : ''} need{Object.keys(errors).length === 1 ? 's' : ''} attention
                </AlertDescription>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-auto p-1">
                  <ChevronDown className={`h-4 w-4 transition-transform ${showErrorSummary ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="mt-3">
              <div className="space-y-2">
                {Object.entries(errors).map(([field, error]) => (
                  <div key={field} className="flex items-start gap-2 text-sm">
                    <X className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>
                      <span className="font-medium">{fieldLabels[field] || field}:</span>{' '}
                      {error?.message}
                    </span>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Alert>
        </Collapsible>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-4">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4 h-auto p-1 bg-muted">
              <TabsTrigger 
                value="basic" 
                className={`flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 px-2 sm:px-3 min-h-[44px] text-xs ${getTabErrors.basic ? 'text-destructive border-destructive' : ''}`}
              >
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {getTabErrors.basic && <AlertCircle className="h-3 w-3" />}
                </div>
                <span className="hidden sm:inline">Basic</span>
                <span className="sm:hidden text-[10px]">Basic</span>
              </TabsTrigger>
              <TabsTrigger 
                value="contact" 
                className={`flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 px-2 sm:px-3 min-h-[44px] text-xs ${getTabErrors.contact ? 'text-destructive border-destructive' : ''}`}
              >
                <div className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {getTabErrors.contact && <AlertCircle className="h-3 w-3" />}
                </div>
                <span className="hidden sm:inline">Contact</span>
                <span className="sm:hidden text-[10px]">Contact</span>
              </TabsTrigger>
              <TabsTrigger 
                value="business" 
                className={`flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 px-2 sm:px-3 min-h-[44px] text-xs ${getTabErrors.business ? 'text-destructive border-destructive' : ''}`}
              >
                <div className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {getTabErrors.business && <AlertCircle className="h-3 w-3" />}
                </div>
                <span className="hidden sm:inline">Business</span>
                <span className="sm:hidden text-[10px]">Business</span>
              </TabsTrigger>
              <TabsTrigger 
                value="banking" 
                className={`flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 px-2 sm:px-3 min-h-[44px] text-xs ${getTabErrors.banking ? 'text-destructive border-destructive' : ''}`}
              >
                <div className="flex items-center gap-1">
                  <Landmark className="h-3 w-3" />
                  {getTabErrors.banking && <AlertCircle className="h-3 w-3" />}
                </div>
                <span className="hidden sm:inline">Banking</span>
                <span className="sm:hidden text-[10px]">Banking</span>
              </TabsTrigger>
            </TabsList>

            {/* Basic Information Tab */}
            <TabsContent value="basic" className="space-y-3 md:space-y-4">
              <Card className="border-border/50">
                <CardHeader className="pb-3 md:pb-4">
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <Building2 className="h-4 w-4" />
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 md:space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2 text-sm font-medium">
                            <Building2 className="h-3 w-3" />
                            Supplier Name
                            <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Enter legal/trade name"
                              className="h-11 md:h-10 text-base md:text-sm"
                              disabled={!canEdit}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
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
                          <FormLabel className="text-sm font-medium">Supplier Type</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                            disabled={!canEdit}
                          >
                            <FormControl>
                              <SelectTrigger className="h-11 md:h-10 text-base md:text-sm">
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
                          <FormLabel className="flex items-center gap-2 text-sm font-medium">
                            <User className="h-3 w-3" />
                            Contact Person
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Primary contact name"
                              className="h-11 md:h-10 text-base md:text-sm"
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
                          <FormLabel className="text-sm font-medium">Supplier ID</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Auto-generated"
                              className="h-10 bg-muted"
                              disabled={true}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
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
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 md:col-span-2">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm font-medium">Active Status</FormLabel>
                          <FormDescription className="text-xs">
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
            <TabsContent value="contact" className="space-y-4">
              <Card className="border-border/50">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Phone className="h-4 w-4" />
                    Contact Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2 text-sm font-medium">
                            <Phone className="h-3 w-3" />
                            Phone Number
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="9876543210"
                              className="h-10"
                              disabled={!canEdit}
                              onChange={(e) => {
                                field.onChange(e);
                                handlePhoneFormat(e.target.value);
                              }}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
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
                          <FormLabel className="flex items-center gap-2 text-sm font-medium">
                            <Mail className="h-3 w-3" />
                            Email Address
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="email"
                              placeholder="contact@supplier.com"
                              className="h-10"
                              disabled={!canEdit}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
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
                          <FormLabel className="flex items-center gap-2 text-sm font-medium">
                            <Globe className="h-3 w-3" />
                            Website <span className="text-xs text-muted-foreground">(Optional)</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="https://www.supplier.com"
                              className="h-10"
                              disabled={!canEdit}
                              onChange={(e) => {
                                let value = e.target.value;
                                if (value && !value.startsWith('http://') && !value.startsWith('https://')) {
                                  value = 'https://' + value;
                                }
                                field.onChange(value);
                              }}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Company website URL (automatically adds https://)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MapPin className="h-4 w-4" />
                    Address Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="address_line1"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel className="text-sm font-medium">Address Line 1</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Street address, building number"
                              className="h-10"
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
                          <FormLabel className="text-sm font-medium">
                            Address Line 2 <span className="text-xs text-muted-foreground">(Optional)</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Apartment, suite, landmark"
                              className="h-10"
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
                          <FormLabel className="text-sm font-medium">City</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="City name"
                              className="h-10"
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
                          <FormLabel className="text-sm font-medium">State/Province</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="State or province"
                              className="h-10"
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
                          <FormLabel className="text-sm font-medium">PIN Code</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="123456"
                              className="h-10"
                              disabled={!canEdit}
                              onChange={(e) => {
                                field.onChange(e);
                                handlePincodeFormat(e.target.value);
                              }}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
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
                          <FormLabel className="text-sm font-medium">Country</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="India"
                              className="h-10"
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
            <TabsContent value="business" className="space-y-4">
              <Card className="border-border/50">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="h-4 w-4" />
                    Business & Tax Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="gst_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2 text-sm font-medium">
                            <FileText className="h-3 w-3" />
                            GSTIN / Tax ID
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="22AAAAA0000A1Z5"
                              className="h-10"
                              disabled={!canEdit}
                              onChange={(e) => {
                                field.onChange(e);
                                handleGSTINFormat(e.target.value);
                              }}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
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
                          <FormLabel className="text-sm font-medium">PAN Number</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="ABCDE1234F"
                              className="h-10"
                              disabled={!canEdit}
                              onChange={(e) => {
                                field.onChange(e);
                                handlePANFormat(e.target.value);
                              }}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
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
                          <FormLabel className="text-sm font-medium">
                            Business Registration Number <span className="text-xs text-muted-foreground">(Optional)</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Registration number"
                              className="h-10"
                              disabled={!canEdit}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
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
                          <FormLabel className="text-sm font-medium">Preferred Currency</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                            disabled={!canEdit}
                          >
                            <FormControl>
                              <SelectTrigger className="h-10">
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
                          <FormLabel className="text-sm font-medium">Payment Terms</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                            disabled={!canEdit}
                          >
                            <FormControl>
                              <SelectTrigger className="h-10">
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
            <TabsContent value="banking" className="space-y-4">
              <Card className="border-border/50">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CreditCard className="h-4 w-4" />
                    Banking Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="bank_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2 text-sm font-medium">
                            <Landmark className="h-3 w-3" />
                            Bank Name
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="State Bank of India"
                              className="h-10"
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
                          <FormLabel className="text-sm font-medium">
                            Branch Name <span className="text-xs text-muted-foreground">(Optional)</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Main Branch"
                              className="h-10"
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
                          <FormLabel className="text-sm font-medium">Account Number</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Account number"
                              className="h-10"
                              disabled={!canEdit}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
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
                          <FormLabel className="text-sm font-medium">IFSC Code</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="SBIN0001234"
                              className="h-10"
                              disabled={!canEdit}
                              onChange={(e) => {
                                field.onChange(e);
                                handleIFSCFormat(e.target.value);
                              }}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
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
                          <FormLabel className="text-sm font-medium">
                            SWIFT Code <span className="text-xs text-muted-foreground">(Optional - International)</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="SBININBB123"
                              className="h-10"
                              disabled={!canEdit}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
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
          <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-4 pt-4 border-t border-border/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {Object.keys(errors).length > 0 && (
                <>
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="text-xs">
                    {Object.keys(errors).length} error{Object.keys(errors).length > 1 ? 's' : ''} to fix
                  </span>
                </>
              )}
              {Object.keys(errors).length === 0 && completionProgress === 100 && (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-xs">Form complete and ready to submit</span>
                </>
              )}
            </div>
            
            <div className="flex gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onCancel}
                className="min-w-[80px] h-10 text-sm"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={loading || !canEdit}
                className="min-w-[100px] h-10 text-sm"
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