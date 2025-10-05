import { useEffect, useCallback } from 'react';

interface AnalyticsEvent {
  event: string;
  properties?: Record<string, any>;
  timestamp: string;
}

interface DashboardAnalytics {
  pageView: (page: string) => void;
  trackEvent: (event: string, properties?: Record<string, any>) => void;
  trackWidgetInteraction: (widgetId: string, action: string) => void;
  trackExport: (format: 'json' | 'csv' | 'print') => void;
  trackError: (error: string, context?: Record<string, any>) => void;
  trackPerformance: (metric: string, value: number) => void;
}

const ANALYTICS_STORAGE_KEY = 'dashboard-analytics-events';
const MAX_STORED_EVENTS = 100;

// Simple in-memory analytics (can be replaced with actual analytics service)
class AnalyticsService {
  private events: AnalyticsEvent[] = [];

  constructor() {
    this.loadEvents();
  }

  private loadEvents() {
    try {
      const stored = localStorage.getItem(ANALYTICS_STORAGE_KEY);
      if (stored) {
        this.events = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load analytics events:', error);
    }
  }

  private saveEvents() {
    try {
      // Keep only the last MAX_STORED_EVENTS
      const recentEvents = this.events.slice(-MAX_STORED_EVENTS);
      localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(recentEvents));
    } catch (error) {
      console.error('Failed to save analytics events:', error);
    }
  }

  track(event: string, properties?: Record<string, any>) {
    const analyticsEvent: AnalyticsEvent = {
      event,
      properties,
      timestamp: new Date().toISOString(),
    };

    this.events.push(analyticsEvent);
    this.saveEvents();

    // Log in development
    if (import.meta.env.DEV) {
      console.log('[Analytics]', analyticsEvent);
    }

    // Here you would send to your analytics service
    // Example: sendToAnalyticsService(analyticsEvent);
  }

  getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }

  clearEvents() {
    this.events = [];
    localStorage.removeItem(ANALYTICS_STORAGE_KEY);
  }

  getEventsSummary() {
    const summary: Record<string, number> = {};
    this.events.forEach((event) => {
      summary[event.event] = (summary[event.event] || 0) + 1;
    });
    return summary;
  }
}

const analyticsService = new AnalyticsService();

export const useDashboardAnalytics = (): DashboardAnalytics => {
  // Track page view on mount
  useEffect(() => {
    analyticsService.track('dashboard_view', {
      path: window.location.pathname,
      referrer: document.referrer,
    });
  }, []);

  const pageView = useCallback((page: string) => {
    analyticsService.track('page_view', { page });
  }, []);

  const trackEvent = useCallback((event: string, properties?: Record<string, any>) => {
    analyticsService.track(event, properties);
  }, []);

  const trackWidgetInteraction = useCallback((widgetId: string, action: string) => {
    analyticsService.track('widget_interaction', { widgetId, action });
  }, []);

  const trackExport = useCallback((format: 'json' | 'csv' | 'print') => {
    analyticsService.track('dashboard_export', { format });
  }, []);

  const trackError = useCallback((error: string, context?: Record<string, any>) => {
    analyticsService.track('dashboard_error', { error, ...context });
  }, []);

  const trackPerformance = useCallback((metric: string, value: number) => {
    analyticsService.track('performance_metric', { metric, value });
  }, []);

  return {
    pageView,
    trackEvent,
    trackWidgetInteraction,
    trackExport,
    trackError,
    trackPerformance,
  };
};

// Export service for direct access if needed
export { analyticsService };
