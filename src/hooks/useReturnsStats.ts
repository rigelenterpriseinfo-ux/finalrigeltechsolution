import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface OpenRSOStats {
  count: number;
  totalValue: number;
}

interface TopCustomer {
  customerName: string;
  totalValue: number;
}

interface Last30DaysCNStats {
  count: number;
  totalValue: number;
}

interface ReturnsStats {
  openRSOStats: OpenRSOStats;
  topRSOCustomers: TopCustomer[];
  last30DaysCNStats: Last30DaysCNStats;
  topCNCustomers: TopCustomer[];
}

export const useReturnsStats = (companyId: string | undefined) => {
  return useQuery({
    queryKey: ['returns-stats', companyId],
    queryFn: async (): Promise<ReturnsStats> => {
      if (!companyId) throw new Error('Company ID is required');

      // Query 1: Total Open RSO Stats
      const { data: openRSOData, error: rsoError } = await supabase
        .from('return_order_header')
        .select('total_amount')
        .eq('company_id', companyId)
        .eq('status', 'Draft');

      if (rsoError) throw rsoError;

      const openRSOStats = {
        count: openRSOData?.length || 0,
        totalValue: openRSOData?.reduce((sum, row) => sum + (row.total_amount || 0), 0) || 0,
      };

      // Query 2: Top 5 RSO Customers
      const { data: rsoCustomersData, error: rsoCustomersError } = await supabase
        .from('return_order_header')
        .select('customer_name, total_amount')
        .eq('company_id', companyId);

      if (rsoCustomersError) throw rsoCustomersError;

      const customerMap = new Map<string, number>();
      rsoCustomersData?.forEach(row => {
        const current = customerMap.get(row.customer_name) || 0;
        customerMap.set(row.customer_name, current + (row.total_amount || 0));
      });

      const topRSOCustomers = Array.from(customerMap.entries())
        .map(([customerName, totalValue]) => ({ customerName, totalValue }))
        .sort((a, b) => b.totalValue - a.totalValue)
        .slice(0, 5);

      // Query 3: Last 30 Days CN Stats
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

      const { data: last30DaysCNData, error: cnError } = await supabase
        .from('credit_notes')
        .select('total_amount')
        .eq('company_id', companyId)
        .gte('cn_date', thirtyDaysAgoStr);

      if (cnError) throw cnError;

      const last30DaysCNStats = {
        count: last30DaysCNData?.length || 0,
        totalValue: last30DaysCNData?.reduce((sum, row) => sum + (row.total_amount || 0), 0) || 0,
      };

      // Query 4: Top 5 CN Customers
      const { data: cnCustomersData, error: cnCustomersError } = await supabase
        .from('credit_notes')
        .select('customer_name, total_amount')
        .eq('company_id', companyId);

      if (cnCustomersError) throw cnCustomersError;

      const cnCustomerMap = new Map<string, number>();
      cnCustomersData?.forEach(row => {
        const current = cnCustomerMap.get(row.customer_name) || 0;
        cnCustomerMap.set(row.customer_name, current + (row.total_amount || 0));
      });

      const topCNCustomers = Array.from(cnCustomerMap.entries())
        .map(([customerName, totalValue]) => ({ customerName, totalValue }))
        .sort((a, b) => b.totalValue - a.totalValue)
        .slice(0, 5);

      return {
        openRSOStats,
        topRSOCustomers,
        last30DaysCNStats,
        topCNCustomers,
      };
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
