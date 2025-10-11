import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays, format } from 'date-fns';
import { POWER_BI_CHART_CONFIG } from '@/lib/powerBiChartConfig';

interface FinancialSummaryChartProps {
  companyId?: string;
}

export const FinancialSummaryChart: React.FC<FinancialSummaryChartProps> = ({ companyId }) => {
  const { data: chartData, isLoading } = useQuery({
    queryKey: ['financial-summary-chart', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const last30Days = subDays(new Date(), 30);

      // Fetch sales data
      const { data: salesInvoices } = await supabase
        .from('sales_invoices')
        .select('created_at, total_amount')
        .eq('company_id', companyId)
        .gte('created_at', last30Days.toISOString())
        .order('created_at', { ascending: true });

      // Fetch purchase data
      const { data: purchaseOrders } = await supabase
        .from('purchase_orders')
        .select('created_at, total_amount')
        .eq('company_id', companyId)
        .gte('created_at', last30Days.toISOString())
        .order('created_at', { ascending: true });

      // Group by week
      const weeklyData: { [key: string]: { sales: number; purchases: number; profit: number } } = {};

      salesInvoices?.forEach((invoice) => {
        const week = format(new Date(invoice.created_at), 'MMM dd');
        if (!weeklyData[week]) {
          weeklyData[week] = { sales: 0, purchases: 0, profit: 0 };
        }
        weeklyData[week].sales += invoice.total_amount || 0;
      });

      purchaseOrders?.forEach((po) => {
        const week = format(new Date(po.created_at), 'MMM dd');
        if (!weeklyData[week]) {
          weeklyData[week] = { sales: 0, purchases: 0, profit: 0 };
        }
        weeklyData[week].purchases += po.total_amount || 0;
      });

      // Calculate profit
      Object.keys(weeklyData).forEach((week) => {
        weeklyData[week].profit = weeklyData[week].sales - weeklyData[week].purchases;
      });

      return Object.entries(weeklyData)
        .map(([week, data]) => ({
          week,
          sales: Math.round(data.sales),
          purchases: Math.round(data.purchases),
          profit: Math.round(data.profit),
        }))
        .slice(-7); // Last 7 data points
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-base font-medium">Financial Summary (30 Days)</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="h-[300px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2B88D8]"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="border-b border-border">
        <CardTitle className="text-base font-medium">Financial Summary (30 Days)</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart 
            data={chartData}
            margin={POWER_BI_CHART_CONFIG.chartDefaults.margin}
          >
            <CartesianGrid {...POWER_BI_CHART_CONFIG.gridStyle} />
            <XAxis 
              dataKey="week"
              tick={POWER_BI_CHART_CONFIG.axisStyle.tick}
              axisLine={POWER_BI_CHART_CONFIG.axisStyle.axisLine}
            />
            <YAxis
              tick={POWER_BI_CHART_CONFIG.axisStyle.tick}
              axisLine={POWER_BI_CHART_CONFIG.axisStyle.axisLine}
            />
            <Tooltip
              formatter={(value: number) => `₹${value.toLocaleString()}`}
              contentStyle={POWER_BI_CHART_CONFIG.tooltipStyle.contentStyle}
              labelStyle={POWER_BI_CHART_CONFIG.tooltipStyle.labelStyle}
              itemStyle={POWER_BI_CHART_CONFIG.tooltipStyle.itemStyle}
            />
            <Legend />
            <Bar dataKey="sales" fill={POWER_BI_CHART_CONFIG.colors.primary} name="Sales" />
            <Bar dataKey="purchases" fill={POWER_BI_CHART_CONFIG.colors.secondary} name="Purchases" />
            <Bar dataKey="profit" fill={POWER_BI_CHART_CONFIG.colors.success} name="Profit" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
