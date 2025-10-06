import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, Check, CreditCard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';


const Subscribe = () => {
  const { planType } = useParams<{ planType: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const planDetails = {
    trial: {
      name: "Free Trial",
      price: "₹0",
      period: "/month",
      amount: 0,
      description: "Try all features risk-free for 30 days"
    },
    monthly: {
      name: "Monthly Plan",
      price: "₹999",
      period: "/month",
      amount: 999,
      description: "Perfect for getting started"
    },
    yearly: {
      name: "Yearly Plan", 
      price: "₹10,000",
      period: "/year",
      amount: 10000,
      description: "Best value - Save ₹1,988 annually"
    }
  };

  const currentPlan = planDetails[planType as keyof typeof planDetails];

  if (!currentPlan) {
    navigate('/');
    return null;
  }

  const handlePayment = async () => {
    setIsLoading(true);

    // For trial plan, skip payment and go directly to registration
    if (planType === 'trial') {
      toast({
        title: "🎉 Free trial activated!",
        description: "Please complete your Business Registration.",
      });

      setTimeout(() => {
        navigate('/register/business?plan=trial');
      }, 500);
      
      setIsLoading(false);
      return;
    }

    // Simulate payment processing (2 seconds) for paid plans
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Always simulate success
    const paymentStatus = "SUCCESS";

    toast({
      title: "✅ Payment successful!",
      description: "Please complete your Business Registration.",
    });

    // Redirect to business registration
    setTimeout(() => {
      navigate(`/register/business?txn=DEV-SUCCESS&plan=${planType}`);
    }, 1000);

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="content-container section-padding py-8 md:py-20">
        <div className="max-w-2xl mx-auto px-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="mb-6 md:mb-8"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Plans
          </Button>

          <Card className="shadow-elevated">
            <CardHeader className="text-center px-4 md:px-6">
              <Badge variant="secondary" className="w-fit mx-auto mb-4">
                Selected Plan
              </Badge>
              <CardTitle className="text-2xl md:text-3xl">{currentPlan.name}</CardTitle>
              <div className="mt-4">
                <span className="text-4xl md:text-5xl font-bold text-primary">{currentPlan.price}</span>
                <span className="text-muted-foreground text-base md:text-lg">{currentPlan.period}</span>
              </div>
              <CardDescription className="text-base md:text-lg mt-4">
                {currentPlan.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 px-4 md:px-6">
              <div className="bg-muted/50 p-4 md:p-6 rounded-lg">
                <h3 className="font-semibold mb-3 md:mb-4">What's Included:</h3>
                <div className="space-y-3">
                   {[
                    "Unlimited products & inventory tracking",
                    "Multi-business support",
                    "Role-based access control", 
                    "Advanced reporting & analytics",
                    "Email support",
                    "Cloud backup & security",
                    ...(planType === 'trial' ? [
                      "Full access to all features",
                      "No credit card required",
                      "Cancel anytime"
                    ] : planType === 'yearly' ? [
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

              <div className="border-t pt-4 md:pt-6">
                {planType !== 'trial' && (
                  <div className="flex justify-between items-center text-base md:text-lg font-semibold mb-4 md:mb-6">
                    <span>Total Amount:</span>
                    <span className="text-primary">{currentPlan.price}</span>
                  </div>
                )}

                <Button 
                  className="w-full btn-gradient text-base md:text-lg py-5 md:py-6"
                  size="lg"
                  onClick={handlePayment}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 md:h-5 md:w-5 animate-spin" />
                      {planType === 'trial' ? 'Activating Trial...' : 'Processing Payment...'}
                    </>
                  ) : (
                    <>
                      {planType === 'trial' ? (
                        <>
                          <Check className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                          Start Free Trial
                        </>
                      ) : (
                        <>
                          <CreditCard className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                          Pay Securely
                        </>
                      )}
                    </>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center mt-4">
                  {planType === 'trial' 
                    ? 'No credit card required. Start your free 30-day trial now.' 
                    : 'Secure payment processing. Your card information is encrypted and protected.'
                  }
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