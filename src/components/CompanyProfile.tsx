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
import { Loader2, Building2, Save, Phone, Mail, Globe, MapPin, IdCard, Settings, FileText, Upload, X, Image as ImageIcon, Edit, XCircle } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface CompanyProfileProps {
  readonly?: boolean;
}

export function CompanyProfile({ readonly = false }: CompanyProfileProps) {
  const { company, profile, user, loading } = useAuth();
  const { hasEditAccess } = useBusinessAuth();
  const { toast } = useToast();
  
  // Initialize all state before any conditional returns (React hooks rule)
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('company-info');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
    website: '',
    status: 'active',
    gstn: '',
    logoUrl: '',
    tagline: '',
    bankName: '',
    branchName: '',
    accountNumber: '',
    accountType: 'current',
    ifscCode: '',
    swiftCode: '',
    accountHolderName: '',
    upiId: '',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  
  console.log('[CompanyProfile] Render - company:', company, 'profile:', profile, 'loading:', loading);
  
  // Check if user has edit access for company profile
  const canEdit = !readonly && hasEditAccess('company_profile') && isEditing;

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

  // Generate Business ID based on company name and current date
  const generateBusinessId = (companyName: string) => {
    if (!companyName) return '';
    const firstFourLetters = companyName.replace(/[^A-Za-z]/g, '').substring(0, 4).toUpperCase();
    const currentDate = new Date();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const year = currentDate.getFullYear();
    return `Rigel-${firstFourLetters}-${month}-${year}`;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file (PNG, JPG, etc.)",
          variant: "destructive",
        });
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image under 5MB",
          variant: "destructive",
        });
        return;
      }

      setLogoFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setFormData(prev => ({ ...prev, logoUrl: '' }));
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile || !company?.id) return null;

    try {
      // Delete old logo if exists to prevent storage buildup
      if (formData.logoUrl) {
        try {
          const oldPath = formData.logoUrl.split('/company-logos/')[1]?.split('?')[0];
          if (oldPath) {
            await supabase.storage.from('company-logos').remove([oldPath]);
          }
        } catch (e) {
          console.log('Could not delete old logo, continuing with upload');
        }
      }

      const fileName = `${company.id}/logo-${Date.now()}.${logoFile.name.split('.').pop()}`;
      
      const { data, error } = await supabase.storage
        .from('company-logos')
        .upload(fileName, logoFile, {
          cacheControl: '3600',
          upsert: false // Changed to false since we're using timestamp in filename
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(data.path);

      // Add cache-busting parameter to force browser to reload the image
      const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;

      return cacheBustedUrl;
    } catch (error: any) {
      toast({
        title: "Logo upload failed",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }
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

      // Upload logo if a new file was selected
      let logoUrl = formData.logoUrl; // Keep existing logo URL
      if (logoFile) {
        console.log('[CompanyProfile] Uploading new logo file...');
        const uploadedLogoUrl = await uploadLogo();
        if (uploadedLogoUrl) {
          logoUrl = uploadedLogoUrl;
          console.log('[CompanyProfile] Logo uploaded successfully:', logoUrl);
          // Update form data immediately to ensure it's included in the database update
          setFormData(prev => ({ ...prev, logoUrl: uploadedLogoUrl }));
        } else {
          console.error('[CompanyProfile] Logo upload returned null');
        }
      }

      // Validate IFSC code format if provided
      if (formData.ifscCode) {
        const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
        if (!ifscRegex.test(formData.ifscCode)) {
          toast({
            title: "Invalid IFSC Code",
            description: "IFSC code must be 11 characters (e.g., SBIN0001234)",
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
        status: formData.status as "active" | "inactive" | "suspended",
        gstn: formData.gstn,
        business_ref_no: generateBusinessId(formData.name),
        logo_url: logoUrl,
        tagline: sanitizeHtml(formData.tagline),
        bank_name: sanitizeHtml(formData.bankName),
        branch_name: sanitizeHtml(formData.branchName),
        account_number: formData.accountNumber,
        account_type: formData.accountType,
        ifsc_code: formData.ifscCode.toUpperCase(),
        swift_code: formData.swiftCode ? formData.swiftCode.toUpperCase() : null,
        account_holder_name: sanitizeHtml(formData.accountHolderName),
        upi_id: formData.upiId || null,
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
          console.log('[CompanyProfile] Updating company with logo_url:', sanitizedData.logo_url);
          
          const { data: updatedData, error } = await supabase
            .from('companies')
            .update(sanitizedData)
            .eq('id', targetCompanyId)
            .select('logo_url')
            .single();

          if (error) {
            console.error('[CompanyProfile] Database update failed:', error);
            toast({
              title: "Update failed",
              description: error.message,
              variant: "destructive",
            });
            setIsLoading(false);
            return;
          }
          
          console.log('[CompanyProfile] Database updated successfully, logo_url:', updatedData?.logo_url);
          
          // Update local state immediately with the saved logo URL
          if (updatedData?.logo_url) {
            setFormData(prev => ({ ...prev, logoUrl: updatedData.logo_url }));
            const cacheBustedUrl = updatedData.logo_url.includes('?') 
              ? `${updatedData.logo_url}&refresh=${Date.now()}` 
              : `${updatedData.logo_url}?refresh=${Date.now()}`;
            setLogoPreview(cacheBustedUrl);
          }
        }


      toast({
        title: "Company saved",
        description: "Your company details have been saved successfully.",
      });

      // Exit edit mode and refresh
      setIsEditing(false);
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

  const handleCancelEdit = () => {
    setIsEditing(false);
    // Reset form to original company data
    if (company) {
      setFormData({
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
        logoUrl: (company as any).logo_url || '',
        tagline: (company as any).tagline || '',
        bankName: (company as any).bank_name || '',
        branchName: (company as any).branch_name || '',
        accountNumber: (company as any).account_number || '',
        accountType: (company as any).account_type || 'current',
        ifscCode: (company as any).ifsc_code || '',
        swiftCode: (company as any).swift_code || '',
        accountHolderName: (company as any).account_holder_name || '',
        upiId: (company as any).upi_id || '',
      });
      setLogoFile(null);
      setLogoPreview((company as any).logo_url || null);
    }
  };

  // Update form data when company data changes
  React.useEffect(() => {
    console.log('[CompanyProfile] useEffect triggered - company:', company);
    if (company) {
      console.log('[CompanyProfile] Setting form data with company:', {
        name: company.name,
        email: company.email,
        hasAddressLine1: !!(company as any).address_line1
      });
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
        logoUrl: (company as any).logo_url || '',
        tagline: (company as any).tagline || '',
        bankName: (company as any).bank_name || '',
        branchName: (company as any).branch_name || '',
        accountNumber: (company as any).account_number || '',
        accountType: (company as any).account_type || 'current',
        ifscCode: (company as any).ifsc_code || '',
        swiftCode: (company as any).swift_code || '',
        accountHolderName: (company as any).account_holder_name || '',
        upiId: (company as any).upi_id || '',
      }));
      
      // Set logo preview if URL exists with cache-busting
      if ((company as any).logo_url) {
        const logoUrl = (company as any).logo_url;
        // Add cache-busting parameter if not already present
        const cacheBustedUrl = logoUrl.includes('?') 
          ? `${logoUrl}&t=${Date.now()}` 
          : `${logoUrl}?t=${Date.now()}`;
        setLogoPreview(cacheBustedUrl);
      }
    } else {
      console.log('[CompanyProfile] No company data in useEffect');
    }
  }, [company]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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
          
          {/* Edit/Cancel Toggle Button */}
          {!readonly && hasEditAccess('company_profile') ? (
            !isEditing ? (
              <Button 
                onClick={() => setIsEditing(true)}
                variant="default"
                size="lg"
                className="flex items-center gap-2 bg-primary hover:bg-primary/90 shadow-md"
              >
                <Edit className="h-5 w-5" />
                <span className="font-semibold">Edit Profile</span>
              </Button>
            ) : (
              <Button 
                onClick={handleCancelEdit}
                variant="outline"
                size="lg"
                className="flex items-center gap-2 border-2"
              >
                <XCircle className="h-5 w-5" />
                <span className="font-semibold">Cancel</span>
              </Button>
            )
          ) : !readonly && (
            <div className="text-sm text-muted-foreground bg-muted/50 px-4 py-2 rounded-lg border">
              ℹ️ You need admin/owner permissions to edit
            </div>
          )}
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
                      Format: Rigel-(First 4 letters)-(MM)-(YYYY)
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

                  {/* Company Logo */}
                  <div className="space-y-4">
                    <Label className="flex items-center gap-2 text-base font-medium">
                      <ImageIcon className="h-4 w-4 text-primary" />
                      Company Logo
                    </Label>
                    
                    <div className="flex items-start gap-6">
                      {/* Logo Preview */}
                      <div className="flex-shrink-0">
                        {logoPreview || formData.logoUrl ? (
                          <div className="relative group">
                            <div className="w-24 h-24 rounded-lg border-2 border-dashed border-border overflow-hidden bg-muted/50">
                              <img
                                src={logoPreview || (formData.logoUrl ? `${formData.logoUrl}${formData.logoUrl.includes('?') ? '&' : '?'}v=${Date.now()}` : '')}
                                alt="Company logo"
                                className="w-full h-full object-contain"
                                key={`logo-${Date.now()}`}
                                onError={(e) => {
                                  console.error('[CompanyProfile] Logo load error:', e);
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            </div>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={handleRemoveLogo}
                                className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="w-24 h-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/50">
                            <ImageIcon className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      {/* Upload Controls */}
                      <div className="flex-1 space-y-2">
                        {canEdit && (
                          <>
                            <div className="flex items-center gap-3">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => document.getElementById('logo-upload')?.click()}
                                className="flex items-center gap-2"
                              >
                                <Upload className="h-4 w-4" />
                                Upload Logo
                              </Button>
                              {(logoPreview || formData.logoUrl) && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleRemoveLogo}
                                  className="text-muted-foreground hover:text-destructive"
                                >
                                  Remove
                                </Button>
                              )}
                            </div>
                            <input
                              id="logo-upload"
                              type="file"
                              accept="image/*"
                              onChange={handleLogoChange}
                              className="hidden"
                            />
                          </>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Recommended: Square image, max 5MB (PNG, JPG, SVG)
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Company Tagline */}
                  <div className="space-y-2">
                    <Label htmlFor="company-tagline" className="text-base font-medium">
                      Company Tagline
                    </Label>
                    <Textarea
                      id="company-tagline"
                      value={formData.tagline}
                      onChange={canEdit ? (e) => handleInputChange('tagline', e.target.value) : undefined}
                      placeholder="A brief description of your company's mission or vision..."
                      disabled={!canEdit}
                      className={!canEdit ? "bg-muted/50" : ""}
                      rows={3}
                      maxLength={200}
                    />
                    <p className="text-xs text-muted-foreground">
                      {formData.tagline.length}/200 characters
                    </p>
                  </div>

                  <Separator />

                  {/* Company Website */}
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

                  <Separator />

                  {/* Bank Details Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      Bank Details
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="account-holder-name" className="text-base font-medium">
                          Account Holder Name
                        </Label>
                        <Input
                          id="account-holder-name"
                          value={formData.accountHolderName}
                          onChange={canEdit ? (e) => handleInputChange('accountHolderName', e.target.value) : undefined}
                          placeholder="As per bank records"
                          disabled={!canEdit}
                          className={!canEdit ? "bg-muted/50" : ""}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="bank-name" className="text-base font-medium">
                          Bank Name
                        </Label>
                        <Input
                          id="bank-name"
                          value={formData.bankName}
                          onChange={canEdit ? (e) => handleInputChange('bankName', e.target.value) : undefined}
                          placeholder="e.g., State Bank of India"
                          disabled={!canEdit}
                          className={!canEdit ? "bg-muted/50" : ""}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="branch-name" className="text-base font-medium">
                          Branch Name
                        </Label>
                        <Input
                          id="branch-name"
                          value={formData.branchName}
                          onChange={canEdit ? (e) => handleInputChange('branchName', e.target.value) : undefined}
                          placeholder="e.g., Mumbai Main Branch"
                          disabled={!canEdit}
                          className={!canEdit ? "bg-muted/50" : ""}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="account-type" className="text-base font-medium">
                          Account Type
                        </Label>
                        <select
                          id="account-type"
                          value={formData.accountType}
                          onChange={canEdit ? (e) => handleInputChange('accountType', e.target.value) : undefined}
                          disabled={!canEdit}
                          className={`flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${!canEdit ? "bg-muted/50" : ""}`}
                        >
                          <option value="savings">Savings</option>
                          <option value="current">Current</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="account-number" className="text-base font-medium">
                          Account Number
                        </Label>
                        <Input
                          id="account-number"
                          type={canEdit ? "text" : "password"}
                          value={formData.accountNumber}
                          onChange={canEdit ? (e) => handleInputChange('accountNumber', e.target.value) : undefined}
                          placeholder="Enter account number"
                          disabled={!canEdit}
                          className={!canEdit ? "bg-muted/50" : ""}
                        />
                        {!canEdit && formData.accountNumber && (
                          <p className="text-xs text-muted-foreground">Account number is masked for security</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="ifsc-code" className="text-base font-medium">
                          IFSC Code
                        </Label>
                        <Input
                          id="ifsc-code"
                          value={formData.ifscCode}
                          onChange={canEdit ? (e) => handleInputChange('ifscCode', e.target.value.toUpperCase()) : undefined}
                          placeholder="e.g., SBIN0001234"
                          maxLength={11}
                          disabled={!canEdit}
                          className={!canEdit ? "bg-muted/50" : ""}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="swift-code" className="text-base font-medium">
                          SWIFT Code <span className="text-xs text-muted-foreground">(Optional)</span>
                        </Label>
                        <Input
                          id="swift-code"
                          value={formData.swiftCode}
                          onChange={canEdit ? (e) => handleInputChange('swiftCode', e.target.value.toUpperCase()) : undefined}
                          placeholder="e.g., SBININBBXXX"
                          maxLength={11}
                          disabled={!canEdit}
                          className={!canEdit ? "bg-muted/50" : ""}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="upi-id" className="text-base font-medium">
                          UPI ID <span className="text-xs text-muted-foreground">(Optional)</span>
                        </Label>
                        <Input
                          id="upi-id"
                          value={formData.upiId}
                          onChange={canEdit ? (e) => handleInputChange('upiId', e.target.value) : undefined}
                          placeholder="yourcompany@bank"
                          disabled={!canEdit}
                          className={!canEdit ? "bg-muted/50" : ""}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Action Buttons */}
              {isEditing && (
                <div className="border-t-2 border-border bg-gradient-to-r from-primary/5 to-primary/10 px-6 py-5 sticky bottom-0">
                  <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-between sm:items-center">
                    <div className="text-sm text-muted-foreground font-medium flex items-center gap-2">
                      <span className="hidden sm:inline">💾</span>
                      All changes will be saved to the database
                    </div>
                    
                    <div className="flex gap-3">
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="lg"
                        onClick={handleCancelEdit}
                        disabled={isLoading}
                        className="border-2"
                      >
                        <XCircle className="mr-2 h-5 w-5" />
                        <span className="font-semibold">Cancel</span>
                      </Button>
                      
                      <Button 
                        type="submit" 
                        disabled={isLoading} 
                        size="lg"
                        className="bg-primary hover:bg-primary/90 shadow-lg font-semibold min-w-[160px]"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-5 w-5" />
                            Save Changes
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}