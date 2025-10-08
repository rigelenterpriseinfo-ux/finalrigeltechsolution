import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useReturnsModuleData = (companyId: string | undefined) => {
  // Parallel fetch all returns data
  const returnsQuery = useQuery({
    queryKey: ['return-orders', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from('return_order_header')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(order => ({
        id: order.id,
        rso_number: order.rso_number || 'Pending',
        rso_date: order.rso_date,
        customer_id: order.customer_id,
        customer_name: order.customer_name,
        invoice_number: order.invoice_number,
        status: order.status as 'Draft' | 'Confirmed',
        reason_for_credit: order.reason_for_credit,
        total_amount: order.total_amount
      }));
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const creditNotesQuery = useQuery({
    queryKey: ['credit-notes', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from('credit_notes')
        .select(`
          *,
          return_order_header!rso_id (
            rso_number
          )
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(cn => ({
        id: cn.id,
        cn_number: cn.cn_number || 'Pending',
        cn_date: cn.cn_date,
        customer_name: cn.customer_name,
        rso_id: cn.rso_id,
        rso_number: cn.return_order_header?.rso_number || 'Unknown',
        status: cn.status as 'Draft' | 'Confirmed',
        total_amount: cn.total_amount
      }));
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const warehousesQuery = useQuery({
    queryKey: ['warehouses-bins', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from('warehouse_bins')
        .select('id, bin_name, warehouse_name, warehouse_code, wh_bin_code')
        .eq('company_id', companyId)
        .order('warehouse_name, bin_name');
      
      if (error) throw error;
      
      return (data || []).map(item => ({
        id: item.id,
        name: `${item.warehouse_name || 'Unknown'} - ${item.warehouse_code || 'N/A'}`,
        location: `${item.wh_bin_code || 'N/A'} - ${item.bin_name || 'Unknown'}`,
        warehouse_code: item.warehouse_code
      }));
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const statsQuery = useQuery({
    queryKey: ['returns-stats', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      
      // Parallel fetch both stats
      const [returnData, creditData] = await Promise.all([
        supabase
          .from('return_order_header')
          .select('status, total_amount')
          .eq('company_id', companyId),
        supabase
          .from('credit_notes')
          .select('status, total_amount')
          .eq('company_id', companyId)
      ]);

      if (returnData.error) throw returnData.error;
      if (creditData.error) throw creditData.error;

      const returnStats = {
        draft_count: returnData.data?.filter(r => r.status === 'Draft').length || 0,
        draft_amount: returnData.data?.filter(r => r.status === 'Draft').reduce((sum, r) => sum + (r.total_amount || 0), 0) || 0,
        confirmed_count: returnData.data?.filter(r => r.status === 'Confirmed').length || 0,
        confirmed_amount: returnData.data?.filter(r => r.status === 'Confirmed').reduce((sum, r) => sum + (r.total_amount || 0), 0) || 0
      };

      const creditNoteStats = {
        draft_count: creditData.data?.filter(cn => cn.status === 'Draft').length || 0,
        draft_amount: creditData.data?.filter(cn => cn.status === 'Draft').reduce((sum, cn) => sum + (cn.total_amount || 0), 0) || 0,
        confirmed_count: creditData.data?.filter(cn => cn.status === 'Confirmed').length || 0,
        confirmed_amount: creditData.data?.filter(cn => cn.status === 'Confirmed').reduce((sum, cn) => sum + (cn.total_amount || 0), 0) || 0
      };

      return { returnStats, creditNoteStats };
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    returnOrders: returnsQuery.data || [],
    creditNotes: creditNotesQuery.data || [],
    warehouses: warehousesQuery.data || [],
    stats: statsQuery.data,
    isLoading: returnsQuery.isLoading || creditNotesQuery.isLoading || warehousesQuery.isLoading || statsQuery.isLoading,
    isError: returnsQuery.isError || creditNotesQuery.isError || warehousesQuery.isError || statsQuery.isError,
    refetchAll: () => {
      returnsQuery.refetch();
      creditNotesQuery.refetch();
      warehousesQuery.refetch();
      statsQuery.refetch();
    }
  };
};
