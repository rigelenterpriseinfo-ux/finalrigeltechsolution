import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Users, Receipt, TrendingUp } from 'lucide-react';
import { useReturnsStats } from '@/hooks/useReturnsStats';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ReturnsDashboardStatsProps {
  companyId: string | undefined;
}

export const ReturnsDashboardStats: React.FC<ReturnsDashboardStatsProps> = ({ companyId }) => {
  const { data: stats, isLoading } = useReturnsStats(companyId);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      {/* Box 1: Total Open RSO */}
      <Card className="card-interactive">
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Total Open RSO
          </CardTitle>
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <FileText className="h-4 w-4 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.openRSOStats.count} RSOs</div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatCurrency(stats.openRSOStats.totalValue)}
          </p>
        </CardContent>
      </Card>

      {/* Box 2: Top 5 Customers by RSO Value */}
      <Card className="card-interactive">
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Top RSO Customers
          </CardTitle>
          <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
            <Users className="h-4 w-4 text-blue-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.topRSOCustomers.length > 0 ? (
              stats.topRSOCustomers.map((customer, index) => (
                <div key={index} className="flex justify-between items-start text-sm">
                  <span className="text-foreground truncate flex-1 mr-2">{customer.customerName}</span>
                  <span className="text-muted-foreground font-medium whitespace-nowrap">
                    {formatCurrency(customer.totalValue)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No data available</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Box 3: CN Raised in Last 30 Days */}
      <Card className="card-interactive">
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            CNs Last 30 Days
          </CardTitle>
          <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
            <Receipt className="h-4 w-4 text-green-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.last30DaysCNStats.count} CNs</div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatCurrency(stats.last30DaysCNStats.totalValue)}
          </p>
        </CardContent>
      </Card>

      {/* Box 4: Top 5 Customers by CN Value */}
      <Card className="card-interactive">
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Top CN Customers
          </CardTitle>
          <div className="h-8 w-8 rounded-full bg-orange-500/10 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.topCNCustomers.length > 0 ? (
              stats.topCNCustomers.map((customer, index) => (
                <div key={index} className="flex justify-between items-start text-sm">
                  <span className="text-foreground truncate flex-1 mr-2">{customer.customerName}</span>
                  <span className="text-muted-foreground font-medium whitespace-nowrap">
                    {formatCurrency(customer.totalValue)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No data available</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
