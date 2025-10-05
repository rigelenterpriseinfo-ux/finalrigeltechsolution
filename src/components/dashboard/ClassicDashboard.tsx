import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsCard } from '@/components/ui/stats-card';
import { Button } from '@/components/ui/button';
import { Package, ShoppingCart, FileText, TrendingUp } from 'lucide-react';

interface ClassicDashboardProps {
  inventoryStats: {
    totalSKUs: number;
    totalUnits: number;
    totalCost: number;
  };
  onNavigate: (module: string) => void;
}

export const ClassicDashboard: React.FC<ClassicDashboardProps> = ({ 
  inventoryStats,
  onNavigate 
}) => {
  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total SKUs"
          value={inventoryStats.totalSKUs.toString()}
          subtitle="Active products"
          icon={Package}
        />
        <StatsCard
          title="Total Units"
          value={inventoryStats.totalUnits.toLocaleString()}
          subtitle="In stock"
          icon={TrendingUp}
        />
        <StatsCard
          title="Inventory Value"
          value={`₹${inventoryStats.totalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          subtitle="Total cost"
          icon={FileText}
        />
        <StatsCard
          title="Quick Actions"
          value="4"
          subtitle="Available"
          icon={ShoppingCart}
        />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button 
              variant="outline" 
              className="h-24 flex flex-col gap-2"
              onClick={() => onNavigate('inventory')}
            >
              <Package className="h-6 w-6" />
              <span>Manage Inventory</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-24 flex flex-col gap-2"
              onClick={() => onNavigate('purchase')}
            >
              <ShoppingCart className="h-6 w-6" />
              <span>Create PO</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-24 flex flex-col gap-2"
              onClick={() => onNavigate('sales')}
            >
              <FileText className="h-6 w-6" />
              <span>New Sales Order</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-24 flex flex-col gap-2"
              onClick={() => onNavigate('reports')}
            >
              <TrendingUp className="h-6 w-6" />
              <span>View Reports</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Welcome Message */}
      <Card>
        <CardHeader>
          <CardTitle>Welcome to Your Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Monitor your business operations and access key features from here. 
            Use the navigation menu to explore different modules.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
