import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, TrendingUp, AlertTriangle, Clock, MapPin, DollarSign, CheckCircle, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface SummaryData {
  totalLocations: number;
  totalProducts: number;
  totalStock: number;
  totalValue: number;
  availableToPick: number;
  allocatedStock: number;
  inTransitQty: number;
  returnPendingQty: number;
  lowStockItems: number;
  deadStockItems: number;
}

interface StockSummaryCardsProps {
  data: SummaryData;
  loading: boolean;
}

export const StockSummaryCards = ({ data, loading }: StockSummaryCardsProps) => {
  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
    return `₹${value.toFixed(0)}`;
  };

  const formatNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="card-elevated">
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-16" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20 mb-2" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: 'Stock Overview',
      icon: Package,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      stats: [
        { label: 'Total Stock', value: formatNumber(data.totalStock), suffix: 'units' },
        { label: 'Total Value', value: formatCurrency(data.totalValue), suffix: '' },
      ]
    },
    {
      title: 'Available Stock',
      icon: CheckCircle,
      color: 'text-success',
      bgColor: 'bg-success/10',
      stats: [
        { label: 'Available to Pick', value: formatNumber(data.availableToPick), suffix: 'units' },
        { label: 'Pick Rate', value: `${((data.availableToPick / Math.max(data.totalStock, 1)) * 100).toFixed(1)}`, suffix: '%' },
      ]
    },
    {
      title: 'Allocated Stock',
      icon: Clock,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      stats: [
        { label: 'Allocated', value: formatNumber(data.allocatedStock), suffix: 'units' },
        { label: 'Allocation Rate', value: `${((data.allocatedStock / Math.max(data.totalStock, 1)) * 100).toFixed(1)}`, suffix: '%' },
      ]
    },
    {
      title: 'Locations',
      icon: MapPin,
      color: 'text-secondary',
      bgColor: 'bg-secondary/10',
      stats: [
        { label: 'Total Locations', value: data.totalLocations.toString(), suffix: 'bins' },
        { label: 'Products', value: data.totalProducts.toString(), suffix: 'SKUs' },
      ]
    },
    {
      title: 'Procurement',
      icon: TrendingUp,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
      stats: [
        { label: 'In Transit', value: formatNumber(data.inTransitQty), suffix: 'units' },
        { label: 'PO Pipeline', value: data.inTransitQty > 0 ? 'Active' : 'None', suffix: '' },
      ]
    },
    {
      title: 'Returns',
      icon: XCircle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      stats: [
        { label: 'Return Pending', value: formatNumber(data.returnPendingQty), suffix: 'units' },
        { label: 'Return Rate', value: `${((data.returnPendingQty / Math.max(data.totalStock, 1)) * 100).toFixed(2)}`, suffix: '%' },
      ]
    },
    {
      title: 'Stock Alerts',
      icon: AlertTriangle,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      stats: [
        { label: 'Low Stock', value: data.lowStockItems.toString(), suffix: 'items' },
        { label: 'Critical', value: data.lowStockItems > 5 ? 'High' : 'Low', suffix: '' },
      ]
    },
    {
      title: 'Dead Stock',
      icon: XCircle,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted/20',
      stats: [
        { label: 'Dead Stock', value: data.deadStockItems.toString(), suffix: 'items' },
        { label: 'Impact', value: data.deadStockItems > 0 ? 'Review' : 'None', suffix: '' },
      ]
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 stagger-animation">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <Card key={index} className="card-elevated card-interactive group">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-md ${card.bgColor} group-hover:scale-110 transition-transform`}>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {card.stats.map((stat, statIndex) => (
                  <div key={statIndex} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="text-2xl font-bold tracking-tight">
                        {stat.value}
                        {stat.suffix && <span className="text-sm font-normal text-muted-foreground ml-1">{stat.suffix}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {stat.label}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};