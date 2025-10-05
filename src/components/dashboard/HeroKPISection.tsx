import React from 'react';
import { AnimatedSection } from './AnimatedSection';
import { AnimatedList } from './AnimatedList';
import { AnimatedKPICard } from './AnimatedKPICard';
import { KPICard } from '@/components/ui/kpi-card';
import { DollarSign, Package, AlertTriangle, TrendingUp, Percent, Clock, RotateCcw } from 'lucide-react';
import { DashboardKPIs } from '@/hooks/useDashboardData';
import { useOperationalMetrics } from '@/hooks/useOperationalMetrics';

interface HeroKPISectionProps {
  data?: DashboardKPIs;
  loading?: boolean;
  companyId?: string;
  onViewOrders?: () => void;
  onReorderStock?: () => void;
}

export const HeroKPISection: React.FC<HeroKPISectionProps> = ({
  data,
  loading = false,
  companyId,
  onViewOrders,
  onReorderStock,
}) => {
  const { data: operationalMetrics, isLoading: metricsLoading } = useOperationalMetrics(companyId);
  
  // Mock sparkline data (last 7 days)
  const revenueSparkline = [45000, 52000, 48000, 61000, 58000, 65000, data?.totalRevenue || 70000];
  const ordersSparkline = [12, 15, 13, 18, 16, 20, data?.activeOrders || 22];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-4 mb-8">
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

      {/* Gross Profit Margin */}
      <KPICard
        title="Profit Margin"
        value={data?.grossProfitMargin || 0}
        suffix="%"
        icon={Percent}
        variant={
          (data?.grossProfitMargin || 0) > 30 ? 'success' :
          (data?.grossProfitMargin || 0) > 15 ? 'warning' : 'danger'
        }
        trend={{
          value: data?.profitMarginChange || 0,
          isPositive: (data?.profitMarginChange || 0) >= 0,
          label: 'vs last period',
        }}
        loading={loading}
      />

      {/* Days Sales Outstanding (DSO) */}
      <KPICard
        title="DSO"
        value={operationalMetrics?.dso || 0}
        suffix=" days"
        icon={Clock}
        variant={
          (operationalMetrics?.dso || 0) <= 30 ? 'success' :
          (operationalMetrics?.dso || 0) <= 45 ? 'warning' : 'danger'
        }
        trend={{
          value: operationalMetrics?.dsoChange || 0,
          isPositive: (operationalMetrics?.dsoChange || 0) <= 0,
          label: 'vs last period',
        }}
        loading={metricsLoading}
      />

      {/* Inventory Turnover Ratio */}
      <KPICard
        title="Inventory Turnover"
        value={operationalMetrics?.inventoryTurnover || 0}
        suffix="x"
        icon={RotateCcw}
        variant={
          (operationalMetrics?.inventoryTurnover || 0) >= 6 ? 'success' :
          (operationalMetrics?.inventoryTurnover || 0) >= 4 ? 'warning' : 'danger'
        }
        trend={{
          value: operationalMetrics?.inventoryTurnoverChange || 0,
          isPositive: (operationalMetrics?.inventoryTurnoverChange || 0) >= 0,
          label: 'vs last period',
        }}
        loading={metricsLoading}
      />
    </div>
  );
};
