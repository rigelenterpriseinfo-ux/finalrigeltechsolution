import { NotificationType, NotificationPriority } from '@/hooks/useNotifications';

/**
 * Common notification helpers and templates
 */

export interface NotificationTemplate {
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  category?: string;
}

/**
 * Pre-defined notification templates for common scenarios
 */
export const NotificationTemplates = {
  // Order notifications
  orderCreated: (orderNumber: string): NotificationTemplate => ({
    type: 'success',
    priority: 'medium',
    title: 'Order Created',
    message: `Order ${orderNumber} has been created successfully`,
    category: 'orders',
  }),

  orderConfirmed: (orderNumber: string): NotificationTemplate => ({
    type: 'success',
    priority: 'high',
    title: 'Order Confirmed',
    message: `Order ${orderNumber} has been confirmed`,
    category: 'orders',
  }),

  orderShipped: (orderNumber: string): NotificationTemplate => ({
    type: 'info',
    priority: 'medium',
    title: 'Order Shipped',
    message: `Order ${orderNumber} has been shipped`,
    category: 'orders',
  }),

  orderDelivered: (orderNumber: string): NotificationTemplate => ({
    type: 'success',
    priority: 'low',
    title: 'Order Delivered',
    message: `Order ${orderNumber} has been delivered`,
    category: 'orders',
  }),

  orderCancelled: (orderNumber: string): NotificationTemplate => ({
    type: 'warning',
    priority: 'medium',
    title: 'Order Cancelled',
    message: `Order ${orderNumber} has been cancelled`,
    category: 'orders',
  }),

  // Inventory notifications
  lowStock: (itemName: string, quantity: number): NotificationTemplate => ({
    type: 'warning',
    priority: 'high',
    title: 'Low Stock Alert',
    message: `${itemName} is running low (${quantity} remaining)`,
    category: 'inventory',
  }),

  outOfStock: (itemName: string): NotificationTemplate => ({
    type: 'error',
    priority: 'urgent',
    title: 'Out of Stock',
    message: `${itemName} is out of stock`,
    category: 'inventory',
  }),

  stockReplenished: (itemName: string): NotificationTemplate => ({
    type: 'success',
    priority: 'low',
    title: 'Stock Replenished',
    message: `${itemName} has been restocked`,
    category: 'inventory',
  }),

  // Payment notifications
  paymentReceived: (amount: number): NotificationTemplate => ({
    type: 'success',
    priority: 'high',
    title: 'Payment Received',
    message: `Payment of $${amount.toLocaleString()} has been received`,
    category: 'payments',
  }),

  paymentFailed: (amount: number): NotificationTemplate => ({
    type: 'error',
    priority: 'urgent',
    title: 'Payment Failed',
    message: `Payment of $${amount.toLocaleString()} has failed`,
    category: 'payments',
  }),

  paymentOverdue: (invoiceNumber: string, days: number): NotificationTemplate => ({
    type: 'error',
    priority: 'urgent',
    title: 'Payment Overdue',
    message: `Invoice ${invoiceNumber} is ${days} days overdue`,
    category: 'payments',
  }),

  // System notifications
  systemUpdate: (version: string): NotificationTemplate => ({
    type: 'info',
    priority: 'low',
    title: 'System Updated',
    message: `System has been updated to version ${version}`,
    category: 'system',
  }),

  systemMaintenance: (duration: string): NotificationTemplate => ({
    type: 'warning',
    priority: 'urgent',
    title: 'System Maintenance',
    message: `Scheduled maintenance will begin in ${duration}`,
    category: 'system',
  }),

  systemError: (error: string): NotificationTemplate => ({
    type: 'error',
    priority: 'high',
    title: 'System Error',
    message: error,
    category: 'system',
  }),

  // Success messages
  saveSuccess: (entity: string): NotificationTemplate => ({
    type: 'success',
    priority: 'low',
    title: 'Changes Saved',
    message: `${entity} has been saved successfully`,
  }),

  deleteSuccess: (entity: string): NotificationTemplate => ({
    type: 'success',
    priority: 'low',
    title: 'Deleted',
    message: `${entity} has been deleted successfully`,
  }),

  // Error messages
  saveError: (entity: string): NotificationTemplate => ({
    type: 'error',
    priority: 'medium',
    title: 'Save Failed',
    message: `Failed to save ${entity}. Please try again.`,
  }),

  deleteError: (entity: string): NotificationTemplate => ({
    type: 'error',
    priority: 'medium',
    title: 'Delete Failed',
    message: `Failed to delete ${entity}. Please try again.`,
  }),

  networkError: (): NotificationTemplate => ({
    type: 'error',
    priority: 'high',
    title: 'Network Error',
    message: 'Unable to connect to server. Please check your connection.',
  }),
};

/**
 * Batch notification helper
 * Groups similar notifications to avoid spam
 */
export class NotificationBatcher {
  private queue: Map<string, { count: number; firstSeen: Date }> = new Map();
  private batchDelay = 5000; // 5 seconds

  add(key: string) {
    const existing = this.queue.get(key);
    if (existing) {
      existing.count++;
    } else {
      this.queue.set(key, { count: 1, firstSeen: new Date() });
      setTimeout(() => this.flush(key), this.batchDelay);
    }
  }

  private flush(key: string) {
    this.queue.delete(key);
  }

  getCount(key: string): number {
    return this.queue.get(key)?.count || 0;
  }
}

/**
 * Notification rate limiter
 * Prevents notification spam
 */
export class NotificationRateLimiter {
  private lastShown: Map<string, Date> = new Map();
  private minInterval = 60000; // 1 minute between similar notifications

  canShow(key: string): boolean {
    const last = this.lastShown.get(key);
    if (!last) {
      this.lastShown.set(key, new Date());
      return true;
    }

    const elapsed = Date.now() - last.getTime();
    if (elapsed >= this.minInterval) {
      this.lastShown.set(key, new Date());
      return true;
    }

    return false;
  }

  reset(key: string) {
    this.lastShown.delete(key);
  }

  clear() {
    this.lastShown.clear();
  }
}

/**
 * Global rate limiter instance
 */
export const notificationRateLimiter = new NotificationRateLimiter();

/**
 * Global batcher instance
 */
export const notificationBatcher = new NotificationBatcher();
