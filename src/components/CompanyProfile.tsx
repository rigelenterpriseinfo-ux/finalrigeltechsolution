import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeHtml } from '@/lib/security';
import { Loader2, Building2, Save, Phone, Mail, Globe, MapPin } from 'lucide-react';

export function CompanyProfile() {
  const { company, profile, user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: company?.name || '',
    email: company?.email || '',
    phone: company?.phone || '',
    address: company?.address || '',
    website: company?.website || '',
    status: company?.status || 'active',
  });

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
        address: sanitizeHtml(formData.address),
        website: formData.website,
        status: formData.status,
        updated_at: new Date().toISOString(),
      };

      if (!profile || !user) {
        toast({
          title: "Not ready",
          description: "Please sign in again.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
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
      setFormData({
        name: company.name || '',
        email: company.email || '',
        phone: company.phone || '',
        address: company.address || '',
        website: company.website || '',
        status: company.status || 'active',
      });
    }
  }, [company]);

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <CardTitle>Company Profile</CardTitle>
            <CardDescription>
              Update your company information and business details
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="company-name">Company Name *</Label>
            <Input
              id="company-name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Your Company Ltd."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company-email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Company Email
            </Label>
            <Input
              id="company-email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="contact@yourcompany.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company-phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Company Phone (10 digits)
            </Label>
            <Input
              id="company-phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              placeholder="1234567890"
              pattern="\d{10}"
              maxLength={10}
              title="Please enter exactly 10 digits"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company-address" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Company Address
            </Label>
            <Textarea
              id="company-address"
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              placeholder="123 Business Street, City, State, Country, ZIP"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company-website" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Website
            </Label>
            <Input
              id="company-website"
              type="url"
              value={formData.website}
              onChange={(e) => handleInputChange('website', e.target.value)}
              placeholder="https://www.yourcompany.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company-status">Company Status</Label>
            <select
              id="company-status"
              value={formData.status}
              onChange={(e) => handleInputChange('status', e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Update Company Profile
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}