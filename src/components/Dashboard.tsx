import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { SalesModule } from '@/components/modules/SalesModule';
import { PaymentsModule } from '@/components/modules/PaymentsModule';
import { ReportsModule } from '@/components/modules/ReportsModule';
import { TrackingModule } from '@/components/modules/TrackingModule';
import { AIAssistant } from '@/components/modules/AIAssistant';
import { CompanyProfile } from '@/components/CompanyProfile';

const menuItems: Array<{ id: ActiveModule; icon: any; label: string; description: string }> = [
  { id: 'dashboard', icon: BarChart3, label: 'Dashboard', description: 'Overview & Analytics' },
  { id: 'inventory', icon: Package, label: 'Inventory', description: 'Manage Products & Stock' },
  { id: 'purchase', icon: ShoppingCart, label: 'Purchase', description: 'Purchase Orders & Suppliers' },
  { id: 'sales', icon: FileText, label: 'Sales', description: 'Sales Orders & Customers' },
  { id: 'payments', icon: CreditCard, label: 'Payments', description: 'Payment Tracking' },
  { id: 'reports', icon: BarChart3, label: 'Reports', description: 'Analytics & Reports' },
  { id: 'tracking', icon: MapPin, label: 'Track & Trace', description: 'Order Tracking' },
  { id: 'ai', icon: Bot, label: 'AI Assistant', description: 'Business Insights' },
  { id: 'profile', icon: Building2, label: 'Company Profile', description: 'Edit Company Details' },
];

type ActiveModule = 'dashboard' | 'inventory' | 'purchase' | 'sales' | 'payments' | 'reports' | 'tracking' | 'ai' | 'profile';

export default function Dashboard() {
  const { user, profile, company, signOut, loading } = useAuth();
  const [activeModule, setActiveModule] = useState<ActiveModule>('dashboard');

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
          <div className="space-y-8">
            {/* Welcome Section */}
            <div className="bg-gradient-primary rounded-2xl p-8 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold mb-2">
                    Welcome back, {profile?.first_name}!
                  </h1>
                  <p className="text-white/80 text-lg">
                    Here's what's happening with your business today
                  </p>
                </div>
                <div className="hidden md:flex items-center gap-4">
                  <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                    {company?.name || 'Your Company'}
                  </Badge>
                  <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                    <Building2 className="h-8 w-8" />
                  </div>
                </div>
              </div>
            </div>

            {/* Key Metrics */}
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
                title="Customers"
                value="0"
                subtitle="Grow your customer base"
                icon={Users}
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
        <div className="min-h-screen flex w-full bg-gradient-subtle">
          <Sidebar className="border-0 shadow-elevated">
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel className="flex items-center gap-3 px-4 py-3 bg-gradient-primary text-white rounded-xl mx-2 my-2">
                  <Building2 className="h-5 w-5" />
                  <div className="flex-1 text-left">
                    <div className="font-medium text-sm">PrismERP</div>
                    <div className="text-white/70 text-xs">Business Management</div>
                  </div>
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {menuItems.map((item) => (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          onClick={() => {
                            console.log('Menu item clicked:', item.id);
                            setActiveModule(item.id);
                          }}
                          isActive={activeModule === item.id}
                          className={`w-full justify-start p-3 rounded-xl mx-2 my-1 transition-all duration-200 hover:shadow-md ${
                            activeModule === item.id 
                              ? 'bg-primary text-primary-foreground shadow-md' 
                              : 'hover:bg-muted'
                          }`}
                        >
                          <item.icon className="h-5 w-5" />
                          <div className="flex-1 text-left">
                            <div className="font-medium">{item.label}</div>
                            <div className="text-xs opacity-70">{item.description}</div>
                          </div>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>

              <SidebarGroup className="mt-auto">
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton 
                        onClick={() => setActiveModule('profile')}
                        className="w-full justify-start p-3 rounded-xl mx-2 my-1 hover:bg-muted transition-colors"
                      >
                        <User className="h-5 w-5" />
                        <div className="flex-1 text-left">
                          <div className="font-medium">{profile?.first_name} {profile?.last_name}</div>
                          <div className="text-xs opacity-70">Click to edit profile</div>
                        </div>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton 
                        onClick={signOut}
                        className="w-full justify-start p-3 rounded-xl mx-2 my-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <LogOut className="h-5 w-5" />
                        <span>Sign Out</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>

          <main className="flex-1 flex flex-col">
            <header className="bg-card border-b border-border/50 shadow-sm">
              <div className="px-6 py-4">
                <div className="flex items-center gap-4 mb-4">
                  <SidebarTrigger className="p-2 rounded-lg hover:bg-muted transition-colors">
                    <Menu className="h-5 w-5" />
                  </SidebarTrigger>
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold text-primary">PrismERP</h1>
                    <p className="text-sm text-muted-foreground">Enterprise Resource Planning</p>
                  </div>
                  
                  {/* Quick access to Company Profile */}
                  <Button 
                    onClick={() => setActiveModule('profile')}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <Building2 className="h-4 w-4" />
                    Company Profile
                  </Button>
                </div>
                
                {/* Company Info Card */}
                <div className="bg-gradient-primary rounded-xl p-4 text-white shadow-elevated">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/20">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h2 className="font-semibold text-lg">{company?.name || 'Your Company'}</h2>
                      <p className="text-white/80 text-sm">Welcome back, {profile?.first_name}!</p>
                    </div>
                    <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                      Active
                    </Badge>
                  </div>
                </div>
              </div>
            </header>

            <div className="flex-1 p-6 overflow-auto">
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