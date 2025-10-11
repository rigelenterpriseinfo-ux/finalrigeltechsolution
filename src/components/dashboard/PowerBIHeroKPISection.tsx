import { PowerBIKPICard } from './PowerBIKPICard';
import { 
  DollarSign, 
  ShoppingCart, 
  AlertTriangle, 
  TrendingUp,
  Percent,
  Calendar,
  Package
} from 'lucide-react';
import { DashboardKPIs } from '@/hooks/useDashboardData';
import { useOperationalMetrics } from '@/hooks/useOperationalMetrics';

interface PowerBIHeroKPISectionProps {
  data: DashboardKPIs;
  loading: boolean;
  companyId: string | undefined;
  onViewOrders?: () => void;
  onReorderStock?: () => void;
}

export const PowerBIHeroKPISection = ({
  data,
  loading,
  companyId,
  onViewOrders,
  onReorderStock,
}: PowerBIHeroKPISectionProps) => {
  const { data: operationalData, isLoading: operationalLoading } = useOperationalMetrics(companyId);

  const kpis = [
    {
      title: 'Total Revenue',
      value: `₹${data?.totalRevenue?.toLocaleString('en-IN') || '0'}`,
      icon: DollarSign,
      trend: data?.revenueChange ? {
        value: data.revenueChange,
        label: 'vs last week',
      } : undefined,
    },
    {
      title: 'Active Orders',
      value: data?.activeOrders || 0,
      icon: ShoppingCart,
      trend: data?.ordersChange ? {
        value: data.ordersChange,
        label: 'vs last week',
      } : undefined,
      onClick: onViewOrders,
    },
    {
      title: 'Low Stock Alerts',
      value: data?.lowStockCount || 0,
      icon: AlertTriangle,
      onClick: onReorderStock,
    },
    {
      title: 'Cash Flow',
      value: `₹${data?.cashFlow?.toLocaleString('en-IN') || '0'}`,
      icon: TrendingUp,
      trend: data?.cashFlowChange ? {
        value: data.cashFlowChange,
        label: 'vs last week',
      } : undefined,
    },
    {
      title: 'Profit Margin',
      value: `${data?.grossProfitMargin?.toFixed(1) || '0'}%`,
      icon: Percent,
      trend: data?.profitMarginChange ? {
        value: data.profitMarginChange,
        label: 'vs last week',
      } : undefined,
    },
    {
      title: 'DSO',
      value: `${operationalData?.dso || 0} days`,
      icon: Calendar,
      loading: operationalLoading,
    },
    {
      title: 'Inventory Turnover',
      value: operationalData?.inventoryTurnover?.toFixed(1) || '0',
      icon: Package,
      loading: operationalLoading,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {kpis.map((kpi, index) => (
        <PowerBIKPICard
          key={index}
          title={kpi.title}
          value={kpi.value}
          icon={kpi.icon}
          trend={kpi.trend}
          onClick={kpi.onClick}
          loading={loading || kpi.loading}
        />
      ))}
    </div>
  );
};
