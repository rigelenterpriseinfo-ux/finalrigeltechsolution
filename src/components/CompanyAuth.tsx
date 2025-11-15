import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CompanyAuthProps {
  onSuccess: (data: any) => void;
}

export const CompanyAuth = ({ onSuccess }: CompanyAuthProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    businessRefNo: "",
    username: "",
    password: ""
  });

  // Add fetch interceptor for debugging
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const [url, options] = args;
      console.log('🌐 FETCH INTERCEPTOR - Request:', url, options?.method || 'GET');
      
      try {
        const response = await originalFetch(...args);
        console.log('🌐 FETCH INTERCEPTOR - Response:', url, response.status, response.statusText);
        return response;
      } catch (error) {
        console.error('🌐 FETCH INTERCEPTOR - Error:', url, error);
        throw error;
      }
    };
    
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.businessRefNo || !formData.username || !formData.password) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsLoading(true);

    try {
      console.log('=== NETWORK DIAGNOSTICS ===');
      console.log('Supabase URL:', 'https://rkqgxrwnvyccxumiwfip.supabase.co');
      console.log('Expected edge function URL:', 'https://rkqgxrwnvyccxumiwfip.supabase.co/functions/v1/signin');
      console.log('Online status:', navigator.onLine);

      const { data, error } = await supabase.functions.invoke('signin', {
        body: {
          businessRefNo: formData.businessRefNo,
          username: formData.username,
          password: formData.password
        }
      });

      if (error) {
        console.error('Signin error:', error);
        
        // Try direct fetch fallback if Supabase client fails
        if (error.message?.includes('Failed to send a request')) {
          console.log('⚠️ Attempting direct fetch fallback...');
          
          try {
            const response = await fetch('https://rkqgxrwnvyccxumiwfip.supabase.co/functions/v1/signin', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrcWd4cndudnljY3h1bWl3ZmlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5Mzg5NTQsImV4cCI6MjA3MTUxNDk1NH0.SEhJgtkYlZ5HilQOKi3rJ2nAO1pcPBhH8WbmNyKT0Zw',
              },
              body: JSON.stringify({
                businessRefNo: formData.businessRefNo,
                username: formData.username,
                password: formData.password
              })
            });
            
            const directData = await response.json();
            console.log('✅ Direct fetch result:', directData);
            
            if (directData.success) {
              const { error: authError } = await supabase.auth.signInWithPassword({
                email: directData.user.email,
                password: formData.password
              });

              if (authError) {
                toast.error("Authentication failed: " + authError.message);
                return;
              }

              toast.success("Sign in successful!");
              onSuccess(directData);
              return;
            }
          } catch (directError) {
            console.error('❌ Direct fetch failed:', directError);
          }
        }
        
        toast.error("Sign in failed. Please try again.");
        return;
      }

      if (!data.success) {
        toast.error(data.error || "Invalid credentials");
        return;
      }

      // Now actually sign in with Supabase Auth to create a proper session
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: data.user.email,
        password: formData.password
      });

      if (authError) {
        console.error('Auth error:', authError);
        toast.error("Authentication failed: " + authError.message);
        return;
      }

      toast.success("Sign in successful!");
      onSuccess(data);
      
    } catch (error) {
      console.error('Signin error:', error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">Company Sign In</CardTitle>
          <CardDescription className="text-center">
            Sign in to your company account using your business credentials
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="businessRefNo">Business Reference Number</Label>
              <Input
                id="businessRefNo"
                name="businessRefNo"
                type="text"
                placeholder="Enter your business reference number"
                value={formData.businessRefNo}
                onChange={handleInputChange}
                required
                disabled={isLoading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="Enter your username"
                value={formData.username}
                onChange={handleInputChange}
                required
                disabled={isLoading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleInputChange}
                required
                disabled={isLoading}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};