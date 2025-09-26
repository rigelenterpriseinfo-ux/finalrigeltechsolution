import { useState, useEffect } from 'react';
import { Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { StatsCard } from '@/components/ui/stats-card';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  Package,
  ShoppingCart,
  FileText,
  CreditCard,
  BarChart3,
  MapPin,
  Bot,
  LogOut,
  User,
  Building2,
  Menu,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Activity,
  Plus,
  RotateCcw,
  Settings,
} from 'lucide-react';
import InventoryModule from '@/components/modules/InventoryModule';
import { PurchaseModule } from '@/components/modules/PurchaseModule';
import SalesModule from '@/components/modules/SalesModule';
import { PaymentsModule } from '@/components/modules/PaymentsModule';
import { EnhancedReportsModule } from '@/components/modules/EnhancedReportsModule';
import { TrackingModule } from '@/components/modules/TrackingModule';
import { AIAssistant } from '@/components/modules/AIAssistant';
import { CompanyProfile } from '@/components/CompanyProfile';
import { ReturnsModule } from '@/components/modules/ReturnsModule';
import { SettingsModule } from '@/components/modules/SettingsModule';
import { AuthTestButton } from '@/components/AuthTestButton';
import { DraggableWidgets } from '@/components/DraggableWidgets';

const menuItems: Array<{ id: ActiveModule; icon: any; label: string; description: string; restricted?: boolean; section?: string }> = [
  { id: 'dashboard', icon: BarChart3, label: 'Welcome back, Girish!', description: "Here's what's happening with your business today" },
  { id: 'inventory', icon: Package, label: 'Inventory', description: 'Manage Products & Stock', section: 'inventory' },
  { id: 'purchase', icon: ShoppingCart, label: 'Purchase', description: 'Purchase Orders & Suppliers', section: 'purchases' },
  { id: 'sales', icon: FileText, label: 'Sales', description: 'Sales Orders & Customers', section: 'sales' },
  { id: 'returns', icon: RotateCcw, label: 'Returns', description: 'Return Orders & Credit Notes', section: 'returns' },
  { id: 'payments', icon: CreditCard, label: 'Payments', description: 'Payment Tracking', section: 'payments' },
  { id: 'reports', icon: BarChart3, label: 'Reports', description: 'Analytics & Reports', section: 'reports' },
  { id: 'tracking', icon: MapPin, label: 'Track & Trace', description: 'Order Tracking', section: 'tracking' },
  { id: 'ai', icon: Bot, label: 'AI Assistant', description: 'Business Insights', section: 'ai' },
  { id: 'users', icon: Users, label: 'Team Management', description: 'Manage Users & Access', restricted: true },
  { id: 'profile', icon: Building2, label: 'Company Profile', description: 'Edit Company Details', section: 'company_profile' },
  { id: 'settings', icon: Settings, label: 'Settings', description: 'System Configuration', section: 'settings' },
];

type ActiveModule = 'dashboard' | 'inventory' | 'purchase' | 'sales' | 'returns' | 'payments' | 'reports' | 'tracking' | 'ai' | 'users' | 'profile' | 'settings';

export default function Dashboard() {
  const { user, profile, company, signOut, loading } = useAuth();
  // Call all hooks unconditionally at the top to preserve hook order
  const { hasAccess, isOwnerOrAdmin } = useBusinessAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState<ActiveModule>('dashboard');
  const [inventoryStats, setInventoryStats] = useState({
    totalSKUs: 0,
    totalUnits: 0,
    totalCost: 0
  });

  // Check for module parameter on component mount and when URL changes
  useEffect(() => {
    const moduleParam = searchParams.get('module');
    if (moduleParam && (moduleParam === 'dashboard' || moduleParam === 'inventory' || moduleParam === 'purchase' || 
        moduleParam === 'sales' || moduleParam === 'returns' || moduleParam === 'payments' || 
        moduleParam === 'reports' || moduleParam === 'tracking' || moduleParam === 'ai' || 
        moduleParam === 'users' || moduleParam === 'profile' || moduleParam === 'settings')) {
      setActiveModule(moduleParam as ActiveModule);
      // Clear the URL parameter after setting the module
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  // Navigation handler to convert string to ActiveModule
  const handleNavigation = (view: string) => {
    if (view === 'users') {
      // Navigate to user management page for users module
      navigate('/user-management');
      return;
    }
    
    if (view === 'dashboard' || view === 'inventory' || view === 'purchase' || view === 'sales' || 
        view === 'returns' || view === 'payments' || view === 'reports' || view === 'tracking' || 
        view === 'ai' || view === 'profile' || view === 'settings') {
      // Update URL parameters first to ensure state persistence
      setSearchParams({ module: view });
      setActiveModule(view as ActiveModule);
    }
  };

  // moved early returns below hooks

  useEffect(() => {
    if (activeModule === 'dashboard' && user) {
      fetchInventoryStats();
    }
  }, [activeModule, user]);

  const fetchInventoryStats = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('stock_quantity, cost_price, is_active');

      if (error) {
        console.error('Error fetching inventory stats:', error);
        return;
      }

      const activeProducts = data?.filter(product => product.is_active) || [];
      const totalSKUs = activeProducts.length;
      const totalUnits = activeProducts.reduce((sum, product) => sum + (product.stock_quantity || 0), 0);
      const totalCost = activeProducts.reduce((sum, product) => sum + ((product.stock_quantity || 0) * (product.cost_price || 0)), 0);

      setInventoryStats({
        totalSKUs,
        totalUnits,
        totalCost
      });
    } catch (error) {
      console.error('Error fetching inventory stats:', error);
    }
  };

  console.log('Dashboard render:', { user: !!user, profile: !!profile, company: !!company, loading, activeModule });

  // Early returns AFTER hooks are declared to preserve hook order
  if (loading) {
    console.log('Dashboard loading...');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    console.log('No user, redirecting to auth');
    return <Navigate to="/auth" replace />;
  }

  const renderActiveModule = () => {
    console.log('Rendering active module:', activeModule);
    
    switch (activeModule) {
      case 'inventory':
        if (!hasAccess('inventory')) {
          return (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-muted-foreground mb-2">Access Denied</h2>
                <p className="text-muted-foreground">You don't have permission to access Inventory.</p>
                <Button onClick={() => setActiveModule('dashboard')} className="mt-4">Back to Dashboard</Button>
              </div>
            </div>
          );
        }
        return (
          <DashboardLayout
            title="Inventory Management"
            subtitle="Manage your products and stock levels"
            showWelcome={false}
            activeView="inventory"
            onNavigate={handleNavigation}
            headerActions={
              <Button onClick={() => setActiveModule('dashboard')} variant="outline">
                Back to Dashboard
              </Button>
            }
          >
            <InventoryModule />
          </DashboardLayout>
        );
      case 'purchase':
        return (
          <DashboardLayout
            title="Purchase Orders"
            subtitle="Create and manage purchase orders"
            activeView="purchase"
            onNavigate={handleNavigation}
            headerActions={
              <Button onClick={() => setActiveModule('dashboard')} variant="outline">
                Back to Dashboard
              </Button>
            }
          >
            <PurchaseModule />
          </DashboardLayout>
        );
      case 'sales':
        return (
          <DashboardLayout
            title="Sales Orders"
            subtitle="Process sales and manage customers"
            activeView="sales"
            onNavigate={handleNavigation}
            headerActions={
              <Button onClick={() => setActiveModule('dashboard')} variant="outline">
                Back to Dashboard
              </Button>
            }
          >
            <SalesModule />
          </DashboardLayout>
        );
      case 'returns':
        return (
          <DashboardLayout
            title="Returns Management"
            subtitle="Handle return orders and credit notes"
            activeView="returns"
            onNavigate={handleNavigation}
            headerActions={
              <Button onClick={() => setActiveModule('dashboard')} variant="outline">
                Back to Dashboard
              </Button>
            }
          >
            <ReturnsModule />
          </DashboardLayout>
        );
      case 'payments':
        return (
          <DashboardLayout
            title="Payment Management"
            subtitle="Track payments and financial transactions"
            activeView="payments"
            onNavigate={handleNavigation}
            headerActions={
              <Button onClick={() => setActiveModule('dashboard')} variant="outline">
                Back to Dashboard
              </Button>
            }
          >
            <PaymentsModule />
          </DashboardLayout>
        );
      case 'reports':
        return (
          <DashboardLayout
            title="Reports & Analytics"
            subtitle="View business insights and reports"
            activeView="reports"
            onNavigate={handleNavigation}
            headerActions={
              <Button onClick={() => setActiveModule('dashboard')} variant="outline">
                Back to Dashboard
              </Button>
            }
          >
            <EnhancedReportsModule />
          </DashboardLayout>
        );
      case 'tracking':
        return (
          <DashboardLayout
            title="Track & Trace"
            subtitle="Monitor order status and shipments"
            activeView="tracking"
            onNavigate={handleNavigation}
            headerActions={
              <Button onClick={() => setActiveModule('dashboard')} variant="outline">
                Back to Dashboard
              </Button>
            }
          >
            <TrackingModule />
          </DashboardLayout>
        );
      case 'ai':
        return (
          <DashboardLayout
            title="AI Assistant"
            subtitle="Get intelligent business insights and assistance"
            activeView="ai"
            onNavigate={handleNavigation}
            headerActions={
              <Button onClick={() => setActiveModule('dashboard')} variant="outline">
                Back to Dashboard
              </Button>
            }
          >
            <AIAssistant />
          </DashboardLayout>
        );
      case 'users':
        // Navigate to User Management page instead of forcing a full reload
        return <Navigate to="/user-management" replace />;
      case 'profile':
        return (
          <DashboardLayout
            title="Company Profile"
            subtitle="Manage your company information and settings"
            activeView="profile"
            onNavigate={handleNavigation}
            headerActions={
              <Button onClick={() => setActiveModule('dashboard')} variant="outline">
                Back to Dashboard
              </Button>
            }
          >
            <CompanyProfile />
          </DashboardLayout>
        );
      case 'settings':
        return (
          <DashboardLayout
            title="Settings"
            subtitle="Configure system settings and preferences"
            activeView="settings"
            onNavigate={handleNavigation}
            headerActions={
              <Button onClick={() => setActiveModule('dashboard')} variant="outline">
                Back to Dashboard
              </Button>
            }
          >
            <SettingsModule />
          </DashboardLayout>
        );
      default:
        return (
          <div className="space-y-6">

            {/* Draggable Widgets Grid */}
            <DraggableWidgets onNavigate={handleNavigation} />

            {/* Business Insights - Mobile Optimized */}
            <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-2">
              <Card className="card-elevated">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-6 sm:py-8 text-muted-foreground">
                    <Activity className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                    <p className="text-sm sm:text-base">No recent activity</p>
                    <p className="text-xs sm:text-sm">Your business activities will appear here</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-elevated">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Bot className="h-4 w-4 sm:h-5 sm:w-5" />
                    AI Assistant
                  </CardTitle>
                  <CardDescription className="text-sm">Get insights and assistance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 sm:space-y-4">
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Ask me anything about your business operations, analytics, or how to use this system.
                    </p>
                    <Button 
                      onClick={() => setActiveModule('ai')}
                      className="w-full min-h-[48px] text-sm sm:text-base"
                      variant="outline"
                    >
                      <Bot className="h-4 w-4 mr-2" />
                      Start Conversation
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );
    }
  };

  console.log('About to render main dashboard layout');

  // For dashboard view, use DashboardLayout with navigation sidebar
  if (activeModule === 'dashboard') {
    return (
      <DashboardLayout
        title="Dashboard"
        subtitle="Overview & Analytics"
        activeView="dashboard"
        onNavigate={handleNavigation}
        showWelcome={false}
        headerActions={<AuthTestButton />}
      >
        {renderActiveModule()}
      </DashboardLayout>
    );
  }

  // For other modules, render them directly (they handle their own layout)
  return renderActiveModule();
}