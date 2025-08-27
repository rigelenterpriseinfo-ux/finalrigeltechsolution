import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Dashboard from "@/components/Dashboard";
import Auth from "@/pages/Auth";
import EnhancedAuth from "@/pages/EnhancedAuth";
import Index from "@/pages/Index";
import Subscribe from "@/pages/Subscribe";
import BusinessRegistration from "@/pages/BusinessRegistration";
import Checkout from "@/pages/Checkout";
import GatedBusinessRegistration from "@/pages/GatedBusinessRegistration";
import GatedSignin from "@/pages/GatedSignin";
import GatedForgotPassword from "@/pages/GatedForgotPassword";
import GatedResetPassword from "@/pages/GatedResetPassword";
import Signin from "@/pages/Signin";
import UserManagement from "@/pages/UserManagement";
import EmailVerification from "@/pages/EmailVerification";
import PasswordReset from "@/pages/PasswordReset";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/auth" element={<EnhancedAuth />} />
            <Route path="/subscribe/:planType" element={<Subscribe />} />
            <Route path="/business-registration" element={<BusinessRegistration />} />
            <Route path="/user-management" element={<UserManagement />} />
            <Route path="/email-verification" element={<EmailVerification />} />
            <Route path="/password-reset" element={<PasswordReset />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/register/business" element={<GatedBusinessRegistration />} />
        <Route path="/signin" element={<Signin />} />
        <Route path="/gated-signin" element={<GatedSignin />} />
        <Route path="/forgot-password" element={<GatedForgotPassword />} />
        <Route path="/gated-forgot-password" element={<GatedForgotPassword />} />
        <Route path="/reset-password" element={<GatedResetPassword />} />
        <Route path="/gated-reset-password" element={<GatedResetPassword />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
