import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
} from 'lucide-react';
import { InventoryModule } from '@/components/modules/InventoryModule';
import { PurchaseModule } from '@/components/modules/PurchaseModule';
import { SalesModule } from '@/components/modules/SalesModule';
import { PaymentsModule } from '@/components/modules/PaymentsModule';
import { ReportsModule } from '@/components/modules/ReportsModule';
import { TrackingModule } from '@/components/modules/TrackingModule';
import { AIAssistant } from '@/components/modules/AIAssistant';

const menuItems = [
  { id: 'dashboard', icon: BarChart3, label: 'Dashboard', description: 'Overview & Analytics' },
  { id: 'inventory', icon: Package, label: 'Inventory', description: 'Manage Products & Stock' },
  { id: 'purchase', icon: ShoppingCart, label: 'Purchase', description: 'Purchase Orders & Suppliers' },
  { id: 'sales', icon: FileText, label: 'Sales', description: 'Sales Orders & Customers' },
  { id: 'payments', icon: CreditCard, label: 'Payments', description: 'Payment Tracking' },
  { id: 'reports', icon: BarChart3, label: 'Reports', description: 'Analytics & Reports' },
  { id: 'tracking', icon: MapPin, label: 'Track & Trace', description: 'Order Tracking' },
  { id: 'ai', icon: Bot, label: 'AI Assistant', description: 'Business Insights' },
];

export default function Dashboard() {
  const { user, profile, company, signOut, loading } = useAuth();
  const [activeModule, setActiveModule] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'inventory':
        return <InventoryModule />;
      case 'purchase':
        return <PurchaseModule />;
      case 'sales':
        return <SalesModule />;
      case 'payments':
        return <PaymentsModule />;
      case 'reports':
        return <ReportsModule />;
      case 'tracking':
        return <TrackingModule />;
      case 'ai':
        return <AIAssistant />;
      default:
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Welcome to PRISM ERP</h1>
              <p className="text-muted-foreground mt-2">
                Hello {profile?.first_name}, manage your business operations efficiently
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground">No products added yet</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Purchase Orders</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground">No orders created</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Sales Orders</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground">No sales recorded</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">$0</div>
                  <p className="text-xs text-muted-foreground">Start selling to see revenue</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Get started with common tasks</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Button 
                  variant="outline" 
                  className="h-20 flex-col"
                  onClick={() => setActiveModule('inventory')}
                >
                  <Package className="h-6 w-6 mb-2" />
                  Add Products
                </Button>
                <Button 
                  variant="outline" 
                  className="h-20 flex-col"
                  onClick={() => setActiveModule('purchase')}
                >
                  <ShoppingCart className="h-6 w-6 mb-2" />
                  Create Purchase Order
                </Button>
                <Button 
                  variant="outline" 
                  className="h-20 flex-col"
                  onClick={() => setActiveModule('sales')}
                >
                  <FileText className="h-6 w-6 mb-2" />
                  Create Sales Order
                </Button>
                <Button 
                  variant="outline" 
                  className="h-20 flex-col"
                  onClick={() => setActiveModule('ai')}
                >
                  <Bot className="h-6 w-6 mb-2" />
                  Ask AI Assistant
                </Button>
              </CardContent>
            </Card>
          </div>
        );
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="flex items-center gap-2 px-2 py-2">
                <Building2 className="h-5 w-5" />
                {company?.name || 'Your Company'}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        onClick={() => setActiveModule(item.id)}
                        isActive={activeModule === item.id}
                        className="w-full justify-start"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
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
                    <SidebarMenuButton className="w-full justify-start">
                      <User className="h-4 w-4" />
                      <span>{profile?.first_name} {profile?.last_name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      onClick={signOut}
                      className="w-full justify-start text-destructive hover:text-destructive"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Sign Out</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="border-b bg-background px-6 py-3 flex items-center gap-4">
            <SidebarTrigger>
              <Menu className="h-5 w-5" />
            </SidebarTrigger>
            <h2 className="font-semibold">
              {menuItems.find(item => item.id === activeModule)?.label || 'Dashboard'}
            </h2>
          </header>

          <div className="flex-1 p-6 overflow-auto">
            {renderActiveModule()}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}