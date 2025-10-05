import { useEffect, useCallback } from 'react';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { useQueryClient } from '@tanstack/react-query';

/**
 * SmartNotificationManager
 * 
 * Automatically monitors data changes and triggers smart notifications
 * based on business logic and user preferences.
 */

export const SmartNotificationManager: React.FC = () => {
  const { addNotification } = useNotificationContext();
  const queryClient = useQueryClient();

  // Monitor for low stock items
  const checkLowStock = useCallback((inventoryData: any) => {
    if (!inventoryData) return;

    const lowStockItems = inventoryData.filter((item: any) => {
      const stockLevel = item.quantity || 0;
      const reorderPoint = item.reorder_point || 10;
      return stockLevel <= reorderPoint && stockLevel > 0;
    });

    if (lowStockItems.length > 0) {
      addNotification({
        type: 'warning',
        priority: 'high',
        title: 'Low Stock Alert',
        message: `${lowStockItems.length} items are running low on stock`,
        category: 'inventory',
        action: {
          label: 'View Items',
          onClick: () => {
            window.location.href = '/dashboard?module=inventory';
          },
        },
      });
    }
  }, [addNotification]);

  // Monitor for pending orders
  const checkPendingOrders = useCallback((ordersData: any) => {
    if (!ordersData) return;

    const pendingOrders = ordersData.filter((order: any) => order.status === 'pending');

    if (pendingOrders.length > 5) {
      addNotification({
        type: 'info',
        priority: 'medium',
        title: 'Pending Orders',
        message: `You have ${pendingOrders.length} orders waiting to be processed`,
        category: 'orders',
        action: {
          label: 'View Orders',
          onClick: () => {
            window.location.href = '/dashboard?module=sales';
          },
        },
      });
    }
  }, [addNotification]);

  // Monitor for overdue payments
  const checkOverduePayments = useCallback((paymentsData: any) => {
    if (!paymentsData) return;

    const overduePayments = paymentsData.filter((payment: any) => {
      const dueDate = new Date(payment.due_date);
      return dueDate < new Date() && payment.status !== 'paid';
    });

    if (overduePayments.length > 0) {
      addNotification({
        type: 'error',
        priority: 'urgent',
        title: 'Overdue Payments',
        message: `${overduePayments.length} payments are overdue`,
        category: 'payments',
        action: {
          label: 'View Payments',
          onClick: () => {
            window.location.href = '/dashboard?module=finance';
          },
        },
      });
    }
  }, [addNotification]);

  // Subscribe to query changes
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.query.state.data) {
        const queryKey = event.query.queryKey[0] as string;

        switch (queryKey) {
          case 'inventory':
            checkLowStock(event.query.state.data);
            break;
          case 'orders':
            checkPendingOrders(event.query.state.data);
            break;
          case 'payments':
            checkOverduePayments(event.query.state.data);
            break;
        }
      }
    });

    return unsubscribe;
  }, [queryClient, checkLowStock, checkPendingOrders, checkOverduePayments]);

  return null; // This is a logical component, no UI
};
