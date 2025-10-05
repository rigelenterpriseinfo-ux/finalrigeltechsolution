import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, TrendingUp, TrendingDown } from 'lucide-react';
import { useOperationalMetrics } from '@/hooks/useOperationalMetrics';
import { cn } from '@/lib/utils';

interface OperationalEfficiencySectionProps {
  companyId?: string;
}

export const OperationalEfficiencySection: React.FC<OperationalEfficiencySectionProps> = ({
  companyId,
}) => {
  const { data: metrics, isLoading } = useOperationalMetrics(companyId);

  const getVariantColor = (value: number, threshold: { good: number; acceptable: number }) => {
    if (value >= threshold.good) return 'text-green-600';
    if (value >= threshold.acceptable) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProgressVariant = (value: number, threshold: { good: number; acceptable: number }) => {
    if (value >= threshold.good) return 'bg-green-600';
    if (value >= threshold.acceptable) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Operational Efficiency</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Operational Efficiency</h2>
        <p className="text-sm text-muted-foreground">Key performance indicators for operations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Order Fulfillment Rate */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Order Fulfillment</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', getVariantColor(metrics?.orderFulfillmentRate || 0, { good: 90, acceptable: 75 }))}>
              {metrics?.orderFulfillmentRate || 0}%
            </div>
            <div className="mt-2 w-full bg-secondary rounded-full h-2 overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all',
                  getProgressVariant(metrics?.orderFulfillmentRate || 0, { good: 90, acceptable: 75 })
                )}
                style={{ width: `${metrics?.orderFulfillmentRate || 0}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Target: ≥90%
            </p>
          </CardContent>
        </Card>

        {/* Stock Accuracy Rate */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Accuracy</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', getVariantColor(metrics?.stockAccuracyRate || 0, { good: 95, acceptable: 90 }))}>
              {metrics?.stockAccuracyRate || 0}%
            </div>
            <div className="mt-2 w-full bg-secondary rounded-full h-2 overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all',
                  getProgressVariant(metrics?.stockAccuracyRate || 0, { good: 95, acceptable: 90 })
                )}
                style={{ width: `${metrics?.stockAccuracyRate || 0}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Target: ≥95%
            </p>
          </CardContent>
        </Card>

        {/* Supplier Delivery Performance */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On-Time Delivery</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', getVariantColor(metrics?.supplierDeliveryPerformance || 0, { good: 85, acceptable: 70 }))}>
              {metrics?.supplierDeliveryPerformance || 0}%
            </div>
            <div className="mt-2 w-full bg-secondary rounded-full h-2 overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all',
                  getProgressVariant(metrics?.supplierDeliveryPerformance || 0, { good: 85, acceptable: 70 })
                )}
                style={{ width: `${metrics?.supplierDeliveryPerformance || 0}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Supplier performance
            </p>
          </CardContent>
        </Card>

        {/* Return Rate */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Return Rate</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn(
              'text-2xl font-bold',
              (metrics?.returnRate || 0) <= 3 ? 'text-green-600' :
              (metrics?.returnRate || 0) <= 5 ? 'text-yellow-600' : 'text-red-600'
            )}>
              {metrics?.returnRate || 0}%
            </div>
            <div className="mt-2 w-full bg-secondary rounded-full h-2 overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all',
                  (metrics?.returnRate || 0) <= 3 ? 'bg-green-600' : 
                  (metrics?.returnRate || 0) <= 5 ? 'bg-yellow-600' : 'bg-red-600'
                )}
                style={{ width: `${Math.min((metrics?.returnRate || 0) * 10, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Target: ≤3% (Lower is better)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
