import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Package, Users, ShoppingCart, CreditCard, TruckIcon, FileText, Bot } from 'lucide-react';
import { SalesModule } from '@/components/modules/SalesModule';
import { InventoryModule } from '@/components/modules/InventoryModule';
import { PurchaseModule } from '@/components/modules/PurchaseModule';
import { PaymentsModule } from '@/components/modules/PaymentsModule';
import { TrackingModule } from '@/components/modules/TrackingModule';
import { ReportsModule } from '@/components/modules/ReportsModule';
import { AIAssistant } from '@/components/modules/AIAssistant';

interface DashboardCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  description?: string;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ title, value, icon, description }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </CardContent>
  </Card>
);

const Dashboard: React.FC = () => {
  const { profile } = useAuth();

  // Placeholder data - replace with actual data fetching
  const totalSales = "₹250,000";
  const newCustomers = "20";
  const productsInStock = "150";
  const openOrders = "15";

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-semibold mb-6">
        Dashboard
        {profile && (
          <span className="ml-2 text-sm text-gray-500">
            ({profile.first_name} {profile.last_name})
          </span>
        )}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <DashboardCard
          title="Total Sales"
          value={totalSales}
          icon={<ShoppingCart className="h-4 w-4 text-gray-500" />}
        />
        <DashboardCard
          title="New Customers"
          value={newCustomers}
          icon={<Users className="h-4 w-4 text-gray-500" />}
          description="Last 30 days"
        />
        <DashboardCard
          title="Products in Stock"
          value={productsInStock}
          icon={<Package className="h-4 w-4 text-gray-500" />}
        />
        <DashboardCard
          title="Open Orders"
          value={openOrders}
          icon={<FileText className="h-4 w-4 text-gray-500" />}
        />
      </div>

      <Tabs defaultValue="sales" className="w-full space-y-4">
        <TabsList>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="purchase">Purchase</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="tracking">Tracking</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="ai">AI Assistant</TabsTrigger>
        </TabsList>
        <TabsContent value="sales" className="space-y-2">
          <SalesModule />
        </TabsContent>
        <TabsContent value="inventory">
          <InventoryModule />
        </TabsContent>
        <TabsContent value="purchase">
          <PurchaseModule />
        </TabsContent>
        <TabsContent value="payments">
          <PaymentsModule />
        </TabsContent>
        <TabsContent value="tracking">
          <TrackingModule />
        </TabsContent>
        <TabsContent value="reports">
          <ReportsModule />
        </TabsContent>
        <TabsContent value="ai">
          <AIAssistant />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Dashboard;
