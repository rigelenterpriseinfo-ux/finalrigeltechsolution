import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Loader2, 
  LogIn, 
  Building2,
  User,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';

const Signin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    businessRefNo: '',
    username: '',
    password: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Business ID validation
    if (!formData.businessRefNo.trim()) {
      newErrors.businessRefNo = 'Business ID is required';
    } else if (!formData.businessRefNo.startsWith('BUS-')) {
      newErrors.businessRefNo = 'Business ID must start with BUS-';
    }

    // Username validation
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      console.log('=== NETWORK DIAGNOSTICS ===');
      console.log('Supabase URL:', 'https://rkqgxrwnvyccxumiwfip.supabase.co');
      console.log('Expected edge function URL:', 'https://rkqgxrwnvyccxumiwfip.supabase.co/functions/v1/signin');
      console.log('Online status:', navigator.onLine);
      console.log('User agent:', navigator.userAgent);
      console.log('Username:', formData.username.trim());

      // Test basic connectivity to Supabase
      console.log('Testing Supabase connectivity...');
      try {
        const testResponse = await fetch('https://rkqgxrwnvyccxumiwfip.supabase.co/rest/v1/', {
          method: 'HEAD',
          headers: {
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrcWd4cndudnljY3h1bWl3ZmlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5Mzg5NTQsImV4cCI6MjA3MTUxNDk1NH0.SEhJgtkYlZ5HilQOKi3rJ2nAO1pcPBhH8WbmNyKT0Zw'
          }
        });
        console.log('✅ Supabase connectivity test - Status:', testResponse.status);
        console.log('✅ Supabase connectivity test - Headers:', [...testResponse.headers.entries()]);
      } catch (testError) {
        console.error('❌ Supabase connectivity test FAILED:', testError);
      }

      console.log('Attempting signin with edge function...');
      
      const { data, error } = await supabase.functions.invoke('signin', {
        body: {
          businessRefNo: formData.businessRefNo.trim(),
          username: formData.username.trim(),
          password: formData.password
        }
      });

      console.log('Edge function response:', { data, error });
      
      if (error) {
        console.error('=== DETAILED ERROR INFO ===');
        console.error('Error object:', error);
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Full error JSON:', JSON.stringify(error, null, 2));
        
        // If the error is "Failed to send a request", try direct fetch fallback
        if (error.message?.includes('Failed to send a request')) {
          console.log('⚠️ Supabase client failed, attempting direct fetch fallback...');
          
          try {
            const response = await fetch('https://rkqgxrwnvyccxumiwfip.supabase.co/functions/v1/signin', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrcWd4cndudnljY3h1bWl3ZmlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5Mzg5NTQsImV4cCI6MjA3MTUxNDk1NH0.SEhJgtkYlZ5HilQOKi3rJ2nAO1pcPBhH8WbmNyKT0Zw',
              },
              body: JSON.stringify({
                businessRefNo: formData.businessRefNo.trim(),
                username: formData.username.trim(),
                password: formData.password
              })
            });
            
            console.log('Direct fetch response status:', response.status);
            const directData = await response.json();
            console.log('✅ Direct fetch succeeded:', directData);
            
            if (directData.success) {
              // Now actually sign in with Supabase Auth
              const { error: authError } = await supabase.auth.signInWithPassword({
                email: directData.user.email,
                password: formData.password
              });

              if (authError) {
                throw new Error('Authentication failed: ' + authError.message);
              }

              toast({
                title: "Sign In Successful!",
                description: `Welcome back, ${directData.user.email}!`
              });

              navigate('/dashboard');
              return;
            } else {
              throw new Error(directData.error || 'Sign in failed');
            }
          } catch (directError: any) {
            console.error('❌ Direct fetch also failed:', directError);
            throw new Error('Unable to reach authentication service. Please check your network connection.');
          }
        }
        
        throw error;
      }

      if (data?.success) {
        // Now actually sign in with Supabase Auth to create a proper session
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: data.user.email,
          password: formData.password
        });

        if (authError) {
          throw new Error('Authentication failed: ' + authError.message);
        }

        toast({
          title: "Sign In Successful!",
          description: `Welcome back, ${data.user.email}!`
        });

        // Redirect to main app
        navigate('/dashboard');
      } else {
        throw new Error(data?.error || 'Sign in failed');
      }
    } catch (error: any) {
      const errorMessage = error.message || "Sign in failed";
      
      if (errorMessage.includes('Invalid credentials') || errorMessage.includes('Invalid')) {
        setErrors({ general: 'Invalid Business ID, username, or password.' });
      } else if (errorMessage.includes('suspended') || errorMessage.includes('not active')) {
        setErrors({ general: 'This business is not active. Contact support.' });
      } else if (errorMessage.includes('attempts') || errorMessage.includes('rate')) {
        setErrors({ general: 'Too many attempts. Try again in a few minutes.' });
      } else {
        setErrors({ general: errorMessage });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
      <div className="content-container w-full max-w-md mx-4">
        <Card className="shadow-elevated">
          <CardHeader className="text-center">
            <Building2 className="h-12 w-12 text-primary mx-auto mb-4" />
            <CardTitle className="text-3xl">Business Portal</CardTitle>
            <CardDescription className="text-lg">
              Sign in to access your business dashboard
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSignin} className="space-y-6">
              {/* General Error */}
              {errors.general && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                  {errors.general}
                </div>
              )}

              {/* Business ID */}
              <div className="space-y-2">
                <Label htmlFor="businessRefNo" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Business ID
                </Label>
                <Input
                  id="businessRefNo"
                  value={formData.businessRefNo}
                  onChange={(e) => handleInputChange('businessRefNo', e.target.value)}
                  placeholder="BUS-YYYYMMDD-XXXXX"
                  className={`font-mono ${errors.businessRefNo ? 'border-destructive' : ''}`}
                  required
                />
                {errors.businessRefNo && (
                  <p className="text-xs text-destructive">{errors.businessRefNo}</p>
                )}
              </div>

              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Username
                </Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  placeholder="admin.user"
                  className={errors.username ? 'border-destructive' : ''}
                  required
                />
                {errors.username && (
                  <p className="text-xs text-destructive">{errors.username}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    placeholder="Enter your password"
                    className={`pr-10 ${errors.password ? 'border-destructive' : ''}`}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password}</p>
                )}
              </div>

              {/* Sign In Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full btn-gradient text-lg py-6"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Signing In...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-5 w-5" />
                    Sign In
                  </>
                )}
              </Button>
            </form>

            {/* Forgot Password */}
            <div className="text-center mt-6">
              <Button
                variant="link"
                onClick={() => navigate('/forgot-password')}
                className="text-primary hover:text-primary/80"
              >
                Forgot Password?
              </Button>
            </div>

            {/* Help Text */}
            <div className="text-center mt-6">
              <p className="text-xs text-muted-foreground">
                Only registered, paid businesses can sign in.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Back to Home */}
        <div className="text-center mt-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="text-muted-foreground hover:text-foreground"
          >
            ← Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Signin;