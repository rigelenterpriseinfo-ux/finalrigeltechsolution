import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays, format } from 'date-fns';

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
      <Card>
        <CardHeader>
          <CardTitle>Financial Summary (30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial Summary (30 Days)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" />
            <YAxis />
            <Tooltip
              formatter={(value: number) => `₹${value.toLocaleString()}`}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
            />
            <Legend />
            <Bar dataKey="sales" fill="hsl(var(--primary))" name="Sales" />
            <Bar dataKey="purchases" fill="hsl(142.1 76.2% 36.3%)" name="Purchases" />
            <Bar dataKey="profit" fill="hsl(221.2 83.2% 53.3%)" name="Profit" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
