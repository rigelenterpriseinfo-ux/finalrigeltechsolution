import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, Check, CreditCard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const Subscribe = () => {
  const { planType } = useParams<{ planType: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const planDetails = {
    monthly: {
      name: "Monthly Plan",
      price: "₹2,500",
      period: "/month",
      amount: 2500,
      description: "Perfect for getting started"
    },
    yearly: {
      name: "Yearly Plan", 
      price: "₹24,000",
      period: "/year",
      amount: 24000,
      description: "Best value - Save ₹6,000 annually"
    }
  };

  const currentPlan = planDetails[planType as keyof typeof planDetails];

  if (!currentPlan) {
    navigate('/');
    return null;
  }

  const handlePayment = async () => {
    setIsLoading(true);
    try {
      // For demo purposes, we'll simulate a successful payment
      // In production, integrate with Stripe/Razorpay here
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create subscription record
      const { error } = await supabase
        .from('subscriptions')
        .insert({
          plan_type: planType as 'monthly' | 'yearly',
          amount: currentPlan.amount,
          payment_status: 'paid' as const,
          start_date: new Date().toISOString().split('T')[0],
          end_date: planType === 'yearly' 
            ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        });

      if (error) throw error;

      toast({
        title: "Payment Successful!",
        description: "Redirecting to business registration...",
      });

      // Redirect to business registration
      setTimeout(() => {
        navigate('/business-registration', { 
          state: { 
            planType,
            subscriptionData: {
              plan: currentPlan.name,
              amount: currentPlan.amount
            }
          }
        });
      }, 1500);

    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: "Payment Failed",
        description: "Please try again or contact support.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="content-container section-padding py-20">
        <div className="max-w-2xl mx-auto">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="mb-8"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Plans
          </Button>

          <Card className="shadow-elevated">
            <CardHeader className="text-center">
              <Badge variant="secondary" className="w-fit mx-auto mb-4">
                Selected Plan
              </Badge>
              <CardTitle className="text-3xl">{currentPlan.name}</CardTitle>
              <div className="mt-4">
                <span className="text-5xl font-bold text-primary">{currentPlan.price}</span>
                <span className="text-muted-foreground text-lg">{currentPlan.period}</span>
              </div>
              <CardDescription className="text-lg mt-4">
                {currentPlan.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="bg-muted/50 p-6 rounded-lg">
                <h3 className="font-semibold mb-4">What's Included:</h3>
                <div className="space-y-3">
                  {[
                    "Unlimited products & inventory tracking",
                    "Multi-business support",
                    "Role-based access control", 
                    "Advanced reporting & analytics",
                    "Email support",
                    "Cloud backup & security",
                    ...(planType === 'yearly' ? [
                      "Priority support",
                      "Custom integrations",
                      "Dedicated account manager"
                    ] : [])
                  ].map((feature, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <Check className="h-5 w-5 text-success flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-6">
                <div className="flex justify-between items-center text-lg font-semibold mb-6">
                  <span>Total Amount:</span>
                  <span className="text-primary">{currentPlan.price}</span>
                </div>

                <Button 
                  className="w-full btn-gradient text-lg py-6"
                  size="lg"
                  onClick={handlePayment}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Processing Payment...
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-5 w-5" />
                      Pay Securely
                    </>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center mt-4">
                  Secure payment processing. Your card information is encrypted and protected.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Subscribe;