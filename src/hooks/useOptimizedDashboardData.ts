import { useMemo } from 'react';
import { useDashboardData } from './useDashboardData';
import { usePurchaseData } from './usePurchaseData';
import { useInventoryData } from './useInventoryData';
import { useSalesData } from './useSalesData';
import { useFinanceData } from './useFinanceData';
import { useOperationsData } from './useOperationsData';

/**
 * Optimized hook that batches all dashboard data queries
 * and provides memoized results to prevent unnecessary re-renders
 */
export const useOptimizedDashboardData = (companyId: string | undefined) => {
  // Fetch all data in parallel
  const dashboardQuery = useDashboardData(companyId);
  const purchaseQuery = usePurchaseData(companyId);
  const inventoryQuery = useInventoryData(companyId);
  const salesQuery = useSalesData(companyId);
  const financeQuery = useFinanceData(companyId);
  const operationsQuery = useOperationsData(companyId);

  // Memoize loading state
  const isLoading = useMemo(
    () =>
      dashboardQuery.kpiLoading ||
      dashboardQuery.actionsLoading ||
      purchaseQuery.isLoading ||
      inventoryQuery.isLoading ||
      salesQuery.isLoading ||
      financeQuery.isLoading ||
      operationsQuery.isLoading,
    [
      dashboardQuery.kpiLoading,
      dashboardQuery.actionsLoading,
      purchaseQuery.isLoading,
      inventoryQuery.isLoading,
      salesQuery.isLoading,
      financeQuery.isLoading,
      operationsQuery.isLoading,
    ]
  );

  // Memoize error state
  const hasError = useMemo(
    () =>
      purchaseQuery.isError ||
      inventoryQuery.isError ||
      salesQuery.isError ||
      financeQuery.isError ||
      operationsQuery.isError,
    [
      purchaseQuery.isError,
      inventoryQuery.isError,
      salesQuery.isError,
      financeQuery.isError,
      operationsQuery.isError,
    ]
  );

  // Memoize all data
  const data = useMemo(
    () => ({
      kpi: dashboardQuery.kpiData,
      urgentActions: dashboardQuery.urgentActions,
      purchase: purchaseQuery.data,
      inventory: inventoryQuery.data,
      sales: salesQuery.data,
      finance: financeQuery.data,
      operations: operationsQuery.data,
    }),
    [
      dashboardQuery.kpiData,
      dashboardQuery.urgentActions,
      purchaseQuery.data,
      inventoryQuery.data,
      salesQuery.data,
      financeQuery.data,
      operationsQuery.data,
    ]
  );

  // Memoize refetch functions
  const refetch = useMemo(
    () => ({
      all: async () => {
        await Promise.all([
          purchaseQuery.refetch(),
          inventoryQuery.refetch(),
          salesQuery.refetch(),
          financeQuery.refetch(),
          operationsQuery.refetch(),
        ]);
      },
      kpi: dashboardQuery.kpiLoading,
      purchase: purchaseQuery.refetch,
      inventory: inventoryQuery.refetch,
      sales: salesQuery.refetch,
      finance: financeQuery.refetch,
      operations: operationsQuery.refetch,
    }),
    [
      purchaseQuery.refetch,
      inventoryQuery.refetch,
      salesQuery.refetch,
      financeQuery.refetch,
      operationsQuery.refetch,
      dashboardQuery.kpiLoading,
    ]
  );

  return {
    data,
    isLoading,
    hasError,
    refetch,
  };
};
