import React from 'react';
import { AnimatedSection } from './AnimatedSection';
import { AnimatedList } from './AnimatedList';
import { AnimatedKPICard } from './AnimatedKPICard';
import { KPICard } from '@/components/ui/kpi-card';
import { DollarSign, Package, AlertTriangle, TrendingUp } from 'lucide-react';
import { DashboardKPIs } from '@/hooks/useDashboardData';

interface HeroKPISectionProps {
  data?: DashboardKPIs;
  loading?: boolean;
  onViewOrders?: () => void;
  onReorderStock?: () => void;
}

export const HeroKPISection: React.FC<HeroKPISectionProps> = ({
  data,
  loading = false,
  onViewOrders,
  onReorderStock,
}) => {
  // Mock sparkline data (last 7 days)
  const revenueSparkline = [45000, 52000, 48000, 61000, 58000, 65000, data?.totalRevenue || 70000];
  const ordersSparkline = [12, 15, 13, 18, 16, 20, data?.activeOrders || 22];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Total Revenue */}
      <KPICard
        title="Total Revenue"
        value={data?.totalRevenue || 0}
        prefix="₹"
        icon={DollarSign}
        variant="success"
        trend={{
          value: data?.revenueChange || 0,
          isPositive: (data?.revenueChange || 0) >= 0,
          label: 'vs last week',
        }}
        sparklineData={revenueSparkline}
        loading={loading}
      />

      {/* Active Orders */}
      <KPICard
        title="Active Orders"
        value={data?.activeOrders || 0}
        suffix=" orders"
        icon={Package}
        variant="info"
        trend={{
          value: data?.ordersChange || 0,
          isPositive: (data?.ordersChange || 0) >= 0,
          label: 'vs last week',
        }}
        sparklineData={ordersSparkline}
        action={{
          label: 'View Orders',
          onClick: onViewOrders || (() => {}),
        }}
        loading={loading}
      />

      {/* Low Stock Alerts */}
      <KPICard
        title="Low Stock Alerts"
        value={data?.lowStockCount || 0}
        suffix=" items"
        icon={AlertTriangle}
        variant={
          (data?.lowStockCount || 0) > 10 ? 'danger' :
          (data?.lowStockCount || 0) > 5 ? 'warning' : 'default'
        }
        action={{
          label: 'Reorder Now',
          onClick: onReorderStock || (() => {}),
        }}
        loading={loading}
      />

      {/* Cash Flow Status */}
      <KPICard
        title="Cash Flow"
        value={data?.cashFlow || 0}
        prefix="₹"
        icon={TrendingUp}
        variant={
          (data?.cashFlow || 0) > 0 ? 'success' :
          (data?.cashFlow || 0) < -50000 ? 'danger' : 'warning'
        }
        trend={{
          value: data?.cashFlowChange || 0,
          isPositive: (data?.cashFlowChange || 0) >= 0,
          label: 'vs last week',
        }}
        loading={loading}
      />
    </div>
  );
};
