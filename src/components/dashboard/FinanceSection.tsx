import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingDown, TrendingUp } from 'lucide-react';
import { useFinanceData } from '@/hooks/useFinanceData';
import { useNavigate } from 'react-router-dom';
import { CHART_COLORS, customTooltipStyle } from '@/lib/chartConfig';

interface FinanceSectionProps {
  companyId?: string;
}

export const FinanceSection: React.FC<FinanceSectionProps> = ({ companyId }) => {
  const { data, isLoading } = useFinanceData(companyId);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Accounts & Finance</h3>
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
      <h3 className="text-xl font-semibold">Accounts & Finance</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* AP/AR Reconciliation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              AP/AR Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* AP Card */}
            <div className="p-3 border rounded-lg border-red-500/30 bg-red-500/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Accounts Payable</span>
                <TrendingDown className="h-4 w-4 text-red-600" />
              </div>
              <p className="text-2xl font-bold text-red-600 mb-2">
                ₹{(data?.totalAPOutstanding || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Settlement Rate</span>
                  <span className="font-semibold">{data?.apSettlementRate || 0}%</span>
                </div>
                <Progress value={data?.apSettlementRate || 0} className="h-2" />
              </div>
            </div>

            {/* AR Card */}
            <div className="p-3 border rounded-lg border-green-500/30 bg-green-500/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Accounts Receivable</span>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-green-600 mb-2">
                ₹{(data?.totalAROutstanding || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Processing Rate</span>
                  <span className="font-semibold">{data?.arProcessingRate || 0}%</span>
                </div>
                <Progress value={data?.arProcessingRate || 0} className="h-2" />
              </div>
            </div>

            <Button 
              size="sm" 
              variant="outline" 
              className="w-full"
              onClick={() => navigate('/dashboard?module=payments')}
            >
              View Details
            </Button>
          </CardContent>
        </Card>

        {/* Aging Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aging Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.apAging && data.arAging ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart 
                  data={data.apAging.map((ap, idx) => ({
                    bucket: ap.label,
                    AP: ap.amount,
                    AR: data.arAging[idx].amount,
                  }))}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                  <YAxis 
                    dataKey="bucket" 
                    type="category" 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                    width={70}
                  />
                  <Tooltip 
                    contentStyle={customTooltipStyle.contentStyle}
                    labelStyle={customTooltipStyle.labelStyle}
                    itemStyle={customTooltipStyle.itemStyle}
                    formatter={(value: number) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                  />
                  <Bar dataKey="AP" fill={CHART_COLORS.danger} radius={[0, 4, 4, 0]} />
                  <Bar dataKey="AR" fill={CHART_COLORS.success} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-60 flex items-center justify-center text-muted-foreground">
                No aging data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top AR/AP */}
        <div className="space-y-4">
          {/* Top AR Customers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top AR Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data?.topARCustomers && data.topARCustomers.length > 0 ? (
                  data.topARCustomers.slice(0, 3).map((customer) => (
                    <div key={customer.customerId} className="p-2 border rounded hover:bg-muted/50">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm truncate flex-1">{customer.customerName}</p>
                        <span className="text-sm font-semibold text-green-600 ml-2">
                          ₹{customer.outstandingAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {customer.daysOverdue}d overdue
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No outstanding AR
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Top AP Vendors */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top AP Vendors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data?.topAPVendors && data.topAPVendors.length > 0 ? (
                  data.topAPVendors.slice(0, 3).map((vendor) => (
                    <div key={vendor.vendorId} className="p-2 border rounded hover:bg-muted/50">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm truncate flex-1">{vendor.vendorName}</p>
                        <span className="text-sm font-semibold text-red-600 ml-2">
                          ₹{vendor.outstandingAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {vendor.daysOverdue}d old
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No outstanding AP
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
