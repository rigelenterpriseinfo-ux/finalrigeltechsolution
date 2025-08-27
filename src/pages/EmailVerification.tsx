import { useState, useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Mail, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function EmailVerification() {
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const [isResending, setIsResending] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'verified' | 'error'>('pending');
  const { toast } = useToast();

  // Check if user is already verified
  useEffect(() => {
    if (user && user.email_confirmed_at) {
      setVerificationStatus('verified');
    }
  }, [user]);

  // If user is verified, redirect to dashboard
  if (user && user.email_confirmed_at) {
    return <Navigate to="/dashboard" replace />;
  }

  // If no user and not loading, redirect to auth
  if (!loading && !user) {
    return <Navigate to="/auth" replace />;
  }

  const handleResendEmail = async () => {
    if (!user?.email) return;
    
    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`
        }
      });

      if (error) {
        toast({
          title: "Failed to resend email",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Email sent!",
          description: "Please check your inbox for the verification link.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Failed to resend email",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-elevated">
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              {verificationStatus === 'verified' ? (
                <CheckCircle className="h-8 w-8 text-success" />
              ) : verificationStatus === 'error' ? (
                <XCircle className="h-8 w-8 text-destructive" />
              ) : (
                <Mail className="h-8 w-8 text-primary" />
              )}
            </div>
            <CardTitle className="text-2xl">
              {verificationStatus === 'verified' ? 'Email Verified!' : 'Verify Your Email'}
            </CardTitle>
            <CardDescription className="text-base">
              {verificationStatus === 'verified' 
                ? 'Your email has been successfully verified.'
                : `We've sent a verification link to ${user?.email || 'your email'}`
              }
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {verificationStatus === 'pending' && (
              <>
                <div className="text-center space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Please check your email and click the verification link to activate your account.
                  </p>
                  
                  <div className="bg-muted/50 p-4 rounded-lg text-left">
                    <h4 className="font-medium text-sm mb-2">Didn't receive the email?</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Check your spam/junk folder</li>
                      <li>• Make sure {user?.email} is correct</li>
                      <li>• Wait a few minutes for delivery</li>
                    </ul>
                  </div>
                </div>

                <Button 
                  onClick={handleResendEmail}
                  disabled={isResending}
                  variant="outline"
                  className="w-full"
                >
                  {isResending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Resend Verification Email
                    </>
                  )}
                </Button>
              </>
            )}

            {verificationStatus === 'verified' && (
              <Button 
                onClick={() => window.location.href = '/dashboard'}
                className="w-full btn-gradient"
              >
                Continue to Dashboard
              </Button>
            )}

            <div className="text-center">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => window.location.href = '/auth'}
              >
                Back to Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}