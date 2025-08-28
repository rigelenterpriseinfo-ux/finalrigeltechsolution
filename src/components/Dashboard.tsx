import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
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
} from 'lucide-react';
import { InventoryModule } from '@/components/modules/InventoryModule';
import { PurchaseModule } from '@/components/modules/PurchaseModule';
import SalesModule from '@/components/modules/SalesModule';
import { PaymentsModule } from '@/components/modules/PaymentsModule';
import { ReportsModule } from '@/components/modules/ReportsModule';
import { TrackingModule } from '@/components/modules/TrackingModule';
import { AIAssistant } from '@/components/modules/AIAssistant';
import { CompanyProfile } from '@/components/CompanyProfile';

const menuItems: Array<{ id: ActiveModule; icon: any; label: string; description: string; restricted?: boolean }> = [
  { id: 'dashboard', icon: BarChart3, label: 'Dashboard', description: 'Overview & Analytics' },
  { id: 'inventory', icon: Package, label: 'Inventory', description: 'Manage Products & Stock' },
  { id: 'purchase', icon: ShoppingCart, label: 'Purchase', description: 'Purchase Orders & Suppliers' },
  { id: 'sales', icon: FileText, label: 'Sales', description: 'Sales Orders & Customers' },
  { id: 'payments', icon: CreditCard, label: 'Payments', description: 'Payment Tracking' },
  { id: 'reports', icon: BarChart3, label: 'Reports', description: 'Analytics & Reports' },
  { id: 'tracking', icon: MapPin, label: 'Track & Trace', description: 'Order Tracking' },
  { id: 'ai', icon: Bot, label: 'AI Assistant', description: 'Business Insights' },
  { id: 'users', icon: Users, label: 'Team Management', description: 'Manage Users & Access', restricted: true },
  { id: 'profile', icon: Building2, label: 'Company Profile', description: 'Edit Company Details' },
];

type ActiveModule = 'dashboard' | 'inventory' | 'purchase' | 'sales' | 'payments' | 'reports' | 'tracking' | 'ai' | 'users' | 'profile';

export default function Dashboard() {
  const { user, profile, company, signOut, loading } = useAuth();
  const [activeModule, setActiveModule] = useState<ActiveModule>('dashboard');
  const [inventoryStats, setInventoryStats] = useState({
    totalSKUs: 0,
    totalUnits: 0,
    totalCost: 0
  });

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
        return (
          <DashboardLayout
            title="Inventory Management"
            subtitle="Manage your products and stock levels"
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
            headerActions={
              <Button onClick={() => setActiveModule('dashboard')} variant="outline">
                Back to Dashboard
              </Button>
            }
          >
            <SalesModule />
          </DashboardLayout>
        );
      case 'payments':
        return (
          <DashboardLayout
            title="Payment Management"
            subtitle="Track payments and financial transactions"
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
            headerActions={
              <Button onClick={() => setActiveModule('dashboard')} variant="outline">
                Back to Dashboard
              </Button>
            }
          >
            <ReportsModule />
          </DashboardLayout>
        );
      case 'tracking':
        return (
          <DashboardLayout
            title="Track & Trace"
            subtitle="Monitor order status and shipments"
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
        // Navigate to User Management page instead of rendering inline
        window.location.href = '/user-management';
        return null;
      case 'profile':
        return (
          <DashboardLayout
            title="Company Profile"
            subtitle="Manage your company information and settings"
            headerActions={
              <Button onClick={() => setActiveModule('dashboard')} variant="outline">
                Back to Dashboard
              </Button>
            }
          >
            <CompanyProfile />
          </DashboardLayout>
        );
      default:
        return (
          <div className="space-y-6">
            {/* Welcome & Company Info Card - Full Width at Top */}
            <Card className="card-interactive shadow-card hover:shadow-elevated transition-all duration-300 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <CardContent className="p-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-4 rounded-2xl bg-primary/10 text-primary">
                      <SidebarTrigger className="p-0">
                        <Menu className="h-8 w-8" />
                      </SidebarTrigger>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Dashboard Overview</p>
                      <h1 className="text-3xl font-bold tracking-tight text-foreground">
                        Welcome back, {profile?.first_name || 'User'}!
                      </h1>
                      <p className="text-base text-muted-foreground">
                        Here's what's happening with your business today
                      </p>
                    </div>
                  </div>
                  
                  {/* Company ID - Right Side */}
                  {company?.business_ref_no && (
                    <div className="text-right">
                      <p className="text-sm font-medium text-muted-foreground mb-1">Company ID</p>
                      <div className="inline-flex items-center px-4 py-2 rounded-lg bg-primary/10 border border-primary/20">
                        <span className="font-mono text-lg font-semibold text-primary">{company.business_ref_no}</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Key Metrics Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 stagger-animation">
              <StatsCard
                title="Total Revenue"
                value="$0"
                subtitle="Start selling to see revenue"
                icon={DollarSign}
                variant="primary"
                trend={{ value: 0, label: "from last month" }}
              />
              
              <StatsCard
                title="Active Products"
                value="0"
                subtitle="No products added yet"
                icon={Package}
                variant="secondary"
              />
              
              <StatsCard
                title="Orders Today"
                value="0"
                subtitle="No orders yet"
                icon={ShoppingCart}
                variant="accent"
              />
              
              <StatsCard
                title="Inventory"
                value={`${inventoryStats.totalSKUs} SKUs`}
                subtitle={`Total Units: ${inventoryStats.totalUnits} | Total Cost: ₹${inventoryStats.totalCost.toFixed(2)}`}
                icon={Package}
                variant="default"
              />
            </div>

            {/* Quick Actions Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Inventory Card */}
              <Card className="card-interactive card-elevated">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-primary/10 text-primary">
                      <Package className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle>Inventory Management</CardTitle>
                      <CardDescription>Manage products and stock levels</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={() => setActiveModule('inventory')}
                    className="w-full btn-gradient"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Products
                  </Button>
                </CardContent>
              </Card>

              {/* Purchase Card */}
              <Card className="card-interactive card-elevated">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-secondary/10 text-secondary">
                      <ShoppingCart className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle>Purchase Orders</CardTitle>
                      <CardDescription>Create and manage purchase orders</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={() => setActiveModule('purchase')}
                    variant="outline"
                    className="w-full"
                  >
                    Create Order
                  </Button>
                </CardContent>
              </Card>

              {/* Sales Card */}
              <Card className="card-interactive card-elevated">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-accent/10 text-accent">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle>Sales Orders</CardTitle>
                      <CardDescription>Process sales and invoicing</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={() => setActiveModule('sales')}
                    variant="outline"
                    className="w-full"
                  >
                    New Sale
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Business Insights */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No recent activity</p>
                    <p className="text-sm">Your business activities will appear here</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    AI Assistant
                  </CardTitle>
                  <CardDescription>Get insights and assistance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Ask me anything about your business operations, analytics, or how to use this system.
                    </p>
                    <Button 
                      onClick={() => setActiveModule('ai')}
                      className="w-full"
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

  // For dashboard view, use full layout with sidebar
  if (activeModule === 'dashboard') {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <Sidebar className="w-64">
            <SidebarContent className="p-4">
              {/* Brand Header */}
              <div className="flex items-center gap-3 p-4 mb-6 bg-gradient-primary text-white rounded-lg">
                <Building2 className="h-6 w-6" />
                <div>
                  <h2 className="font-semibold">PrismERP</h2>
                  <p className="text-xs text-white/80">{company?.name || 'Business Suite'}</p>
                </div>
              </div>

              {/* Navigation Menu */}
              <SidebarMenu className="space-y-2">
                {menuItems
                  .filter(item => {
                    if (item.restricted) {
                      return profile?.role === 'owner' || profile?.role === 'admin';
                    }
                    return true;
                  })
                  .map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        onClick={() => setActiveModule(item.id)}
                        isActive={activeModule === item.id}
                        className={`w-full justify-start p-3 rounded-lg transition-colors ${
                          activeModule === item.id 
                            ? 'bg-primary text-primary-foreground' 
                            : 'hover:bg-muted'
                        }`}
                      >
                        <item.icon className="h-5 w-5 mr-3" />
                        <span className="font-medium">{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
              </SidebarMenu>

              {/* User Section */}
              <div className="mt-auto pt-6 space-y-2">
                <SidebarMenuButton 
                  onClick={() => setActiveModule('profile')}
                  className="w-full justify-start p-3 rounded-lg hover:bg-muted"
                >
                  <User className="h-5 w-5 mr-3" />
                  <span>{profile?.first_name} {profile?.last_name}</span>
                </SidebarMenuButton>
                
                <SidebarMenuButton 
                  onClick={signOut}
                  className="w-full justify-start p-4 rounded-lg text-white bg-destructive hover:bg-destructive/90 font-medium shadow-md"
                >
                  <LogOut className="h-5 w-5 mr-3" />
                  <span>Sign Out</span>
                </SidebarMenuButton>
              </div>
            </SidebarContent>
          </Sidebar>

          <main className="flex-1 flex flex-col">
            <div className="flex-1 p-4 overflow-auto">
              {renderActiveModule()}
            </div>
          </main>
        </div>
      </SidebarProvider>
    );
  }

  // For other modules, render them directly (they handle their own layout)
  return renderActiveModule();
}