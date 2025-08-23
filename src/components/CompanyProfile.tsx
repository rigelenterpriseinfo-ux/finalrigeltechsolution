import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Building2, Save } from 'lucide-react';

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

      const { error } = await supabase
        .from('companies')
        .update({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          website: formData.website,
          updated_at: new Date().toISOString(),
        })
        .eq('id', company?.id);

      if (error) {
        toast({
          title: "Update failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Company updated",
        description: "Your company details have been updated successfully.",
      });

      // Refresh the page to see updated data
      window.location.reload();
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
            <Label htmlFor="company-email">Company Email</Label>
            <Input
              id="company-email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="contact@yourcompany.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company-phone">Company Phone (10 digits)</Label>
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
            <Label htmlFor="company-address">Company Address</Label>
            <Textarea
              id="company-address"
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              placeholder="123 Business Street, City, State, ZIP"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company-website">Website</Label>
            <Input
              id="company-website"
              type="url"
              value={formData.website}
              onChange={(e) => handleInputChange('website', e.target.value)}
              placeholder="https://www.yourcompany.com"
            />
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