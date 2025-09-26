import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeHtml } from '@/lib/security';
import { Separator } from '@/components/ui/separator';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { Loader2, Building2, Save, Phone, Mail, Globe, MapPin, IdCard, Settings, FileText } from 'lucide-react';

interface CompanyProfileProps {
  readonly?: boolean;
}

export function CompanyProfile({ readonly = false }: CompanyProfileProps) {
  const { company, profile, user, loading } = useAuth();
  const { hasEditAccess } = useBusinessAuth();
  const { toast } = useToast();
  
  // Check if user has edit access for company profile
  const canEdit = !readonly && hasEditAccess('company_profile');

  // Show loading state while auth is initializing
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-muted-foreground">Loading your profile...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('company-info');
  const [formData, setFormData] = useState({
    name: company?.name || '',
    email: company?.email || '',
    phone: company?.phone || '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
    website: company?.website || '',
    status: company?.status || 'active',
    gstn: '',
  });

  // Generate Business ID based on company name and current date
  const generateBusinessId = (companyName: string) => {
    if (!companyName) return '';
    const firstFourLetters = companyName.replace(/[^A-Za-z]/g, '').substring(0, 4).toUpperCase();
    const currentDate = new Date();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const year = currentDate.getFullYear();
    return `PRISM-${firstFourLetters}-${month}-${year}`;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate phone number if provided
      if (formData.phone) {
        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(formData.phone.replace(/\D/g, ''))) {
          toast({
            title: "Invalid phone number",
            description: "Phone number must be exactly 10 digits",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
      }

      // Sanitize form inputs before submission
      const sanitizedData = {
        name: sanitizeHtml(formData.name),
        email: formData.email,
        phone: formData.phone,
        address: [
          formData.addressLine1,
          formData.addressLine2,
          formData.city,
          formData.state,
          formData.country,
          formData.postalCode
        ].filter(Boolean).join(', '),
        address_line1: sanitizeHtml(formData.addressLine1),
        address_line2: sanitizeHtml(formData.addressLine2),
        city: sanitizeHtml(formData.city),
        state: sanitizeHtml(formData.state),
        country: sanitizeHtml(formData.country),
        postal_code: formData.postalCode,
        website: formData.website,
        status: formData.status,
        gstn: formData.gstn,
        business_ref_no: generateBusinessId(formData.name),
        updated_at: new Date().toISOString(),
      };

      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to continue.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // If profile is missing, create it automatically
      if (!profile) {
        try {
          const userData = user.user_metadata || {};
          
          // Create a minimal company record first if none exists
          let targetCompanyId = company?.id;
          if (!targetCompanyId) {
            const { data: newCompany, error: companyError } = await supabase
              .from('companies')
              .insert({
                name: formData.name || userData.company_name || 'My Company',
                email: formData.email || userData.email || user.email,
                phone: formData.phone || userData.phone,
                city: formData.city || userData.city,
                state: formData.state || userData.state,
                country: formData.country || userData.country,
              })
              .select()
              .single();

            if (companyError) throw companyError;
            targetCompanyId = newCompany.id;
          }

          // Create the missing profile
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              user_id: user.id,
              company_id: targetCompanyId,
              first_name: userData.first_name,
              last_name: userData.last_name,
              phone: userData.phone,
              city: userData.city,
              state: userData.state,
              country: userData.country,
              role: 'owner'
            });

          if (profileError) throw profileError;

          toast({
            title: "Profile created",
            description: "Your profile has been set up. Please reload the page.",
          });
          
          setTimeout(() => window.location.reload(), 1000);
          setIsLoading(false);
          return;
        } catch (error: any) {
          toast({
            title: "Setup failed",
            description: "Could not create your profile. Please try again.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
      }

      let targetCompanyId = company?.id;

      // If no company exists yet, create one and link it to the profile
      if (!targetCompanyId) {
        const { data: created, error: insertErr } = await supabase
          .from('companies')
          .insert([{ ...sanitizedData }])
          .select('*')
          .single();

        if (insertErr) {
          toast({ title: 'Create failed', description: insertErr.message, variant: 'destructive' });
          setIsLoading(false);
          return;
        }

        targetCompanyId = created.id;

        // Link to user profile
        await supabase
          .from('profiles')
          .update({ company_id: targetCompanyId })
          .eq('user_id', user.id);
        } else {
          const { error } = await supabase
            .from('companies')
            .update(sanitizedData)
            .eq('id', targetCompanyId);

          if (error) {
            toast({
              title: "Update failed",
              description: error.message,
              variant: "destructive",
            });
            setIsLoading(false);
            return;
          }
        }


      toast({
        title: "Company saved",
        description: "Your company details have been saved successfully.",
      });

      // Refresh the page to reload context
      setTimeout(() => window.location.reload(), 800);
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Update form data when company data changes
  React.useEffect(() => {
    if (company) {
      setFormData(prev => ({
        ...prev,
        name: company.name || '',
        email: company.email || '',
        phone: company.phone || '',
        addressLine1: (company as any).address_line1 || '',
        addressLine2: (company as any).address_line2 || '',
        city: (company as any).city || '',
        state: (company as any).state || '',
        country: (company as any).country || '',
        postalCode: (company as any).postal_code || '',
        website: company.website || '',
        status: company.status || 'active',
        gstn: (company as any).gstn || '',
      }));
    }
  }, [company]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Company Profile</h1>
            <p className="text-muted-foreground">
              Manage your company information and business settings
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Card className="border-0 shadow-card">
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="border-b border-border bg-muted/50">
              <TabsList className="grid w-full grid-cols-3 bg-transparent h-14 p-1">
                <TabsTrigger 
                  value="company-info" 
                  className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Company Info</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="contact-address"
                  className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <Mail className="h-4 w-4" />
                  <span className="hidden sm:inline">Contact & Address</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="business-config"
                  className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Business Config</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <form onSubmit={handleSubmit}>
              <TabsContent value="company-info" className="section-padding space-y-6">
                <div className="space-y-6">
                  {/* Business ID - Auto-generated */}
                  <div className="space-y-2">
                    <Label htmlFor="business-id" className="flex items-center gap-2 text-base font-medium">
                      <IdCard className="h-4 w-4 text-primary" />
                      Business ID
                    </Label>
                    <Input
                      id="business-id"
                      value={company ? ((company as any).business_ref_no || generateBusinessId(formData.name)) : generateBusinessId(formData.name)}
                      placeholder="Auto-generated based on company name"
                      disabled
                      className="bg-muted/50 border-muted font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Format: PRISM-(First 4 letters)-(MM)-(YYYY)
                    </p>
                  </div>

                  <Separator />

                  {/* Company Name */}
                  <div className="space-y-2">
                    <Label htmlFor="company-name" className="text-base font-medium">
                      Company Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="company-name"
                      value={formData.name}
                      onChange={canEdit ? (e) => handleInputChange('name', e.target.value) : undefined}
                      placeholder="Your Company Ltd."
                      required
                      disabled={!canEdit}
                      className={!canEdit ? "bg-muted/50" : ""}
                    />
                  </div>

                  {/* Company Description */}
                  <div className="space-y-2">
                    <Label htmlFor="company-website" className="flex items-center gap-2 text-base font-medium">
                      <Globe className="h-4 w-4 text-primary" />
                      Website
                    </Label>
                    <Input
                      id="company-website"
                      type="url"
                      value={formData.website}
                      onChange={canEdit ? (e) => handleInputChange('website', e.target.value) : undefined}
                      placeholder="https://www.yourcompany.com"
                      disabled={!canEdit}
                      className={!canEdit ? "bg-muted/50" : ""}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="contact-address" className="section-padding space-y-6">
                <div className="space-y-6">
                  {/* Contact Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                      <Phone className="h-5 w-5 text-primary" />
                      Contact Information
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="company-email" className="text-base font-medium">
                          Email Address
                        </Label>
                        <Input
                          id="company-email"
                          type="email"
                          value={formData.email}
                          onChange={canEdit ? (e) => handleInputChange('email', e.target.value) : undefined}
                          placeholder="contact@yourcompany.com"
                          disabled={!canEdit}
                          className={!canEdit ? "bg-muted/50" : ""}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="company-phone" className="text-base font-medium">
                          Phone Number <span className="text-xs text-muted-foreground">(10 digits)</span>
                        </Label>
                        <Input
                          id="company-phone"
                          type="tel"
                          value={formData.phone}
                          onChange={canEdit ? (e) => handleInputChange('phone', e.target.value) : undefined}
                          placeholder="1234567890"
                          pattern="\d{10}"
                          maxLength={10}
                          disabled={!canEdit}
                          className={!canEdit ? "bg-muted/50" : ""}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Address Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      Address Information
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="address-line1" className="text-base font-medium">
                          Address Line 1 <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="address-line1"
                          value={formData.addressLine1}
                          onChange={canEdit ? (e) => handleInputChange('addressLine1', e.target.value) : undefined}
                          placeholder="Street address, building number"
                          required={canEdit}
                          disabled={!canEdit}
                          className={!canEdit ? "bg-muted/50" : ""}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="address-line2" className="text-base font-medium">
                          Address Line 2 <span className="text-xs text-muted-foreground">(Optional)</span>
                        </Label>
                        <Input
                          id="address-line2"
                          value={formData.addressLine2}
                          onChange={canEdit ? (e) => handleInputChange('addressLine2', e.target.value) : undefined}
                          placeholder="Apartment, suite, floor"
                          disabled={!canEdit}
                          className={!canEdit ? "bg-muted/50" : ""}
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="city" className="text-base font-medium">
                            City <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="city"
                            value={formData.city}
                            onChange={canEdit ? (e) => handleInputChange('city', e.target.value) : undefined}
                            placeholder="City"
                            required={canEdit}
                            disabled={!canEdit}
                            className={!canEdit ? "bg-muted/50" : ""}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="state" className="text-base font-medium">
                            State <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="state"
                            value={formData.state}
                            onChange={canEdit ? (e) => handleInputChange('state', e.target.value) : undefined}
                            placeholder="State/Province"
                            required={canEdit}
                            disabled={!canEdit}
                            className={!canEdit ? "bg-muted/50" : ""}
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="country" className="text-base font-medium">
                            Country <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="country"
                            value={formData.country}
                            onChange={canEdit ? (e) => handleInputChange('country', e.target.value) : undefined}
                            placeholder="Country"
                            required={canEdit}
                            disabled={!canEdit}
                            className={!canEdit ? "bg-muted/50" : ""}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="postal-code" className="text-base font-medium">
                            Postal Code <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="postal-code"
                            value={formData.postalCode}
                            onChange={canEdit ? (e) => handleInputChange('postalCode', e.target.value) : undefined}
                            placeholder="Postal/ZIP code"
                            required={canEdit}
                            disabled={!canEdit}
                            className={!canEdit ? "bg-muted/50" : ""}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="business-config" className="section-padding space-y-6">
                <div className="space-y-6">
                  {/* Business Configuration */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      Business Configuration
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="gstn" className="text-base font-medium">
                          GSTN <span className="text-xs text-muted-foreground">(Goods and Services Tax Number)</span>
                        </Label>
                        <Input
                          id="gstn"
                          value={formData.gstn}
                          onChange={canEdit ? (e) => handleInputChange('gstn', e.target.value) : undefined}
                          placeholder="22AAAAA0000A1Z5"
                          maxLength={15}
                          disabled={!canEdit}
                          className={!canEdit ? "bg-muted/50" : ""}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="company-status" className="text-base font-medium">
                          Company Status
                        </Label>
                        <select
                          id="company-status"
                          value={formData.status}
                          onChange={canEdit ? (e) => handleInputChange('status', e.target.value) : undefined}
                          disabled={!canEdit}
                          className={`flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${!canEdit ? "bg-muted/50" : ""}`}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Action Buttons */}
              <div className="border-t border-border bg-muted/30 px-6 py-4">
                <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-between sm:items-center">
                  <div className="text-xs text-muted-foreground">
                    {!canEdit ? "You don't have permission to edit company details" : "All changes will be saved immediately"}
                  </div>
                  
                  {canEdit && (
                    <Button type="submit" disabled={isLoading} className="btn-gradient">
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving Changes...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}