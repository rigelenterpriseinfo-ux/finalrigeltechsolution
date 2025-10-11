import React, { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, FileText, RotateCcw } from 'lucide-react';
import { useSalesData } from '@/hooks/useSalesData';
import { useNavigate } from 'react-router-dom';
import { CHART_COLORS, customTooltipStyle } from '@/lib/chartConfig';

interface SalesSectionProps {
  companyId?: string;
}

const SalesSectionComponent: React.FC<SalesSectionProps> = ({ companyId }) => {
  const { data, isLoading } = useSalesData(companyId);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Sales & Customer</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Sales & Customer</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Sales Trend Chart */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              4-Week Sales Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.salesTrend && data.salesTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={data.salesTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="week" 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <YAxis 
                    yAxisId="left"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    label={{ value: 'Value (₹)', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' } }}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    label={{ value: 'Quantity', angle: 90, position: 'insideRight', style: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' } }}
                  />
                  <Tooltip 
                    contentStyle={customTooltipStyle.contentStyle}
                    labelStyle={customTooltipStyle.labelStyle}
                    itemStyle={customTooltipStyle.itemStyle}
                    formatter={(value: number, name: string) => [
                      name === 'revenue' 
                        ? `₹${value.toLocaleString('en-IN')}` 
                        : value.toLocaleString('en-IN'),
                      name === 'revenue' ? 'Sales Value' : 'Sales Quantity'
                    ]}
                  />
                  <Legend 
                    verticalAlign="top"
                    height={40}
                    iconType="rect"
                    formatter={(value: string) => {
                      return value === 'revenue' ? 'Sales Value (₹)' : 'Sales Quantity';
                    }}
                    wrapperStyle={{
                      paddingBottom: '12px',
                      fontSize: '12px',
                      fontWeight: 500,
                    }}
                  />
                  <Bar 
                    yAxisId="left"
                    dataKey="revenue" 
                    fill="#2B88D8"
                    radius={[4, 4, 0, 0]}
                    barSize={40}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="quantity" 
                    stroke="#107C41"
                    strokeWidth={2.5}
                    dot={{ fill: '#107C41', r: 5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-60 flex items-center justify-center text-muted-foreground">
                No sales data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Open Orders & RSO Customers */}
        <div className="space-y-4">
          {/* Open Sales Orders */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Open Sales Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{data?.openOrderCount || 0}</span>
                  <span className="text-sm text-muted-foreground">orders</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Value: ₹{(data?.totalOpenOrderValue || 0).toLocaleString('en-IN')}
                </p>
                {data?.topCustomers && data.topCustomers.length > 0 && (
                  <div className="space-y-1 pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Top Customers:</p>
                    {data.topCustomers.map((customer) => (
                      <div key={customer.id} className="flex items-center justify-between text-xs">
                        <span className="truncate flex-1">{customer.name}</span>
                        <span className="font-semibold ml-2">
                          ₹{customer.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full"
                  onClick={() => navigate('/dashboard?module=sales')}
                >
                  View All
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Top RSO Customers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <RotateCcw className="h-4 w-4" />
                Top Return Customers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data?.topRSOCustomers && data.topRSOCustomers.length > 0 ? (
                  data.topRSOCustomers.map((customer) => (
                    <div key={customer.customerId} className="p-2 border rounded hover:bg-muted/50">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm truncate flex-1">
                          {customer.customerName}
                        </p>
                        <span className="text-sm font-semibold ml-2">
                          ₹{customer.returnValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {customer.returnCount} returns • {customer.reason.substring(0, 20)}
                        {customer.reason.length > 20 ? '...' : ''}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No returns recorded
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

// Memoize to prevent unnecessary re-renders
export const SalesSection = memo(SalesSectionComponent);
