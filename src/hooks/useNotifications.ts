import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  category?: string;
  metadata?: Record<string, any>;
}

interface NotificationPreferences {
  enabled: boolean;
  sound: boolean;
  vibration: boolean;
  desktop: boolean;
  categories: Record<string, boolean>;
  quietHours: {
    enabled: boolean;
    start: string; // HH:mm format
    end: string;
  };
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  sound: true,
  vibration: true,
  desktop: false,
  categories: {
    orders: true,
    inventory: true,
    payments: true,
    system: true,
  },
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '08:00',
  },
};

const STORAGE_KEY = 'notifications';
const PREFERENCES_KEY = 'notification-preferences';
const MAX_NOTIFICATIONS = 100;

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return parsed.map((n: any) => ({
          ...n,
          timestamp: new Date(n.timestamp),
        }));
      } catch {
        return [];
      }
    }
    return [];
  });

  const [preferences, setPreferences] = useState<NotificationPreferences>(() => {
    const stored = localStorage.getItem(PREFERENCES_KEY);
    if (stored) {
      try {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
      } catch {
        return DEFAULT_PREFERENCES;
      }
    }
    return DEFAULT_PREFERENCES;
  });

  // Persist notifications
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  }, [notifications]);

  // Persist preferences
  useEffect(() => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  }, [preferences]);

  // Request desktop notification permission
  useEffect(() => {
    if (preferences.desktop && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, [preferences.desktop]);

  const isQuietHours = useCallback(() => {
    if (!preferences.quietHours.enabled) return false;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const { start, end } = preferences.quietHours;
    
    if (start < end) {
      return currentTime >= start && currentTime <= end;
    } else {
      // Handle overnight quiet hours (e.g., 22:00 to 08:00)
      return currentTime >= start || currentTime <= end;
    }
  }, [preferences.quietHours]);

  const playSound = useCallback(() => {
    if (!preferences.sound || isQuietHours()) return;
    
    // Create a simple notification sound
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.1;

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  }, [preferences.sound, isQuietHours]);

  const vibrate = useCallback(() => {
    if (!preferences.vibration || isQuietHours()) return;
    if ('vibrate' in navigator) {
      navigator.vibrate(200);
    }
  }, [preferences.vibration, isQuietHours]);

  const showDesktopNotification = useCallback((notification: Notification) => {
    if (!preferences.desktop || isQuietHours()) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const desktopNotif = new Notification(notification.title, {
      body: notification.message,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: notification.id,
    });

    desktopNotif.onclick = () => {
      window.focus();
      notification.action?.onClick();
      desktopNotif.close();
    };
  }, [preferences.desktop, isQuietHours]);

  const addNotification = useCallback((
    notif: Omit<Notification, 'id' | 'timestamp' | 'read'>
  ) => {
    if (!preferences.enabled) return;
    
    // Check if category is enabled
    if (notif.category && preferences.categories[notif.category] === false) {
      return;
    }

    const newNotification: Notification = {
      ...notif,
      id: `notif-${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      read: false,
    };

    setNotifications((prev) => {
      const updated = [newNotification, ...prev];
      return updated.slice(0, MAX_NOTIFICATIONS);
    });

    // Show toast
    const toastOptions = {
      duration: notif.priority === 'urgent' ? 10000 : 4000,
      action: notif.action ? {
        label: notif.action.label,
        onClick: notif.action.onClick,
      } : undefined,
    };

    switch (notif.type) {
      case 'success':
        toast.success(notif.title, { description: notif.message, ...toastOptions });
        break;
      case 'error':
        toast.error(notif.title, { description: notif.message, ...toastOptions });
        break;
      case 'warning':
        toast.warning(notif.title, { description: notif.message, ...toastOptions });
        break;
      default:
        toast.info(notif.title, { description: notif.message, ...toastOptions });
    }

    // Play sound and vibrate for high priority
    if (notif.priority === 'high' || notif.priority === 'urgent') {
      playSound();
      vibrate();
    }

    // Show desktop notification for urgent
    if (notif.priority === 'urgent') {
      showDesktopNotification(newNotification);
    }

    return newNotification.id;
  }, [preferences, playSound, vibrate, showDesktopNotification]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const deleteNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const updatePreferences = useCallback((updates: Partial<NotificationPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...updates }));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const urgentCount = notifications.filter((n) => !n.read && n.priority === 'urgent').length;

  return {
    notifications,
    unreadCount,
    urgentCount,
    preferences,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    updatePreferences,
  };
};
