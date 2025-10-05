/**
 * Testing utilities for Dashboard components
 * 
 * Provides mock data and helper functions for testing dashboard functionality
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ReactNode } from 'react';

// Create a test query client with no retries
export const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

// Wrapper for testing components that use React Query and Router
export const TestWrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

// Mock dashboard KPI data
export const mockKPIData = {
  totalRevenue: 1250000,
  activeOrders: 45,
  lowStockAlerts: 12,
  cashFlow: 85000,
  revenueTrend: { value: 12.5, label: 'vs last month' },
  ordersTrend: { value: 8.3, label: 'vs last month' },
};

// Mock urgent actions
export const mockUrgentActions = [
  {
    id: '1',
    title: 'Process pending invoices',
    description: '15 invoices awaiting approval',
    priority: 'high' as const,
    count: 15,
    action: () => {},
  },
  {
    id: '2',
    title: 'Low stock items',
    description: '12 items below minimum',
    priority: 'medium' as const,
    count: 12,
    action: () => {},
  },
];

// Mock purchase data
export const mockPurchaseData = {
  pendingReceipts: [
    {
      id: '1',
      productName: 'Widget A',
      productSku: 'WDG-001',
      quantity: 100,
      receivedQty: 50,
      supplierName: 'ABC Suppliers',
      daysPending: 3,
    },
  ],
  openPOCount: 25,
  totalOpenPOValue: 450000,
  topVendors: [
    {
      supplierId: '1',
      supplierName: 'ABC Suppliers',
      openPOCount: 8,
      totalValue: 150000,
    },
  ],
};

// Mock inventory data
export const mockInventoryData = {
  warehouseStocks: [
    {
      warehouseId: '1',
      warehouseName: 'Main Warehouse',
      totalQuantity: 5000,
      totalValue: 2500000,
    },
  ],
  topValueItems: [
    {
      productId: '1',
      productName: 'Widget A',
      quantity: 500,
      price: 1000,
      totalValue: 500000,
      movementHistory: [],
    },
  ],
  damagedValue: 25000,
  damagedLocations: 3,
};

// Mock sales data
export const mockSalesData = {
  salesTrend: [
    { week: 'Week 1', revenue: 300000, quantity: 150 },
    { week: 'Week 2', revenue: 350000, quantity: 175 },
  ],
  openOrderCount: 35,
  totalOpenOrderValue: 875000,
  topCustomers: [
    {
      customerId: '1',
      customerName: 'XYZ Corp',
      totalOrderValue: 250000,
      orderCount: 5,
    },
  ],
  topRSOCustomers: [],
};

// Mock finance data
export const mockFinanceData = {
  apReconciliation: {
    totalOutstanding: 450000,
    settledAmount: 300000,
    processingAmount: 150000,
    settledRate: 66.7,
    processingRate: 33.3,
  },
  arReconciliation: {
    totalOutstanding: 875000,
    settledAmount: 650000,
    processingAmount: 225000,
    settledRate: 74.3,
    processingRate: 25.7,
  },
  apAging: [
    { range: '0-30', amount: 100000 },
    { range: '31-60', amount: 50000 },
  ],
  arAging: [
    { range: '0-30', amount: 200000 },
    { range: '31-60', amount: 100000 },
  ],
  topARCustomers: [],
  topAPVendors: [],
};

// Mock operations data
export const mockOperationsData = {
  shipmentStatuses: [
    {
      status: 'pending' as const,
      count: 5,
      orders: [],
    },
  ],
  recentActivities: [
    {
      id: '1',
      type: 'purchase_order' as const,
      title: 'PO-12345 created',
      timestamp: new Date().toISOString(),
      user: 'John Doe',
      metadata: {},
    },
  ],
};

// Helper to wait for async updates
export const waitForLoadingToFinish = () =>
  new Promise((resolve) => setTimeout(resolve, 100));
