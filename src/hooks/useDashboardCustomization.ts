import { useState, useEffect } from 'react';

export interface DashboardWidgetConfig {
  id: string;
  visible: boolean;
  order: number;
}

export interface DashboardCustomization {
  widgets: Record<string, DashboardWidgetConfig>;
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  refreshInterval: number;
  compactView: boolean;
  theme: 'light' | 'dark' | 'auto';
}

const DEFAULT_WIDGETS: Record<string, DashboardWidgetConfig> = {
  kpi: { id: 'kpi', visible: true, order: 0 },
  urgentActions: { id: 'urgentActions', visible: true, order: 1 },
  purchase: { id: 'purchase', visible: true, order: 2 },
  inventory: { id: 'inventory', visible: true, order: 3 },
  sales: { id: 'sales', visible: true, order: 4 },
  finance: { id: 'finance', visible: true, order: 5 },
  shipments: { id: 'shipments', visible: true, order: 6 },
};

const DEFAULT_CUSTOMIZATION: DashboardCustomization = {
  widgets: DEFAULT_WIDGETS,
  dateRange: {
    start: null,
    end: null,
  },
  refreshInterval: 300000, // 5 minutes
  compactView: false,
  theme: 'auto',
};

const STORAGE_KEY = 'dashboard-customization';

export const useDashboardCustomization = () => {
  const [customization, setCustomization] = useState<DashboardCustomization>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return {
          ...DEFAULT_CUSTOMIZATION,
          ...parsed,
          widgets: { ...DEFAULT_WIDGETS, ...parsed.widgets },
        };
      } catch {
        return DEFAULT_CUSTOMIZATION;
      }
    }
    return DEFAULT_CUSTOMIZATION;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customization));
  }, [customization]);

  const toggleWidget = (widgetId: string) => {
    setCustomization((prev) => ({
      ...prev,
      widgets: {
        ...prev.widgets,
        [widgetId]: {
          ...prev.widgets[widgetId],
          visible: !prev.widgets[widgetId]?.visible,
        },
      },
    }));
  };

  const reorderWidgets = (widgets: Record<string, DashboardWidgetConfig>) => {
    setCustomization((prev) => ({
      ...prev,
      widgets,
    }));
  };

  const setDateRange = (start: Date | null, end: Date | null) => {
    setCustomization((prev) => ({
      ...prev,
      dateRange: { start, end },
    }));
  };

  const setRefreshInterval = (interval: number) => {
    setCustomization((prev) => ({
      ...prev,
      refreshInterval: interval,
    }));
  };

  const toggleCompactView = () => {
    setCustomization((prev) => ({
      ...prev,
      compactView: !prev.compactView,
    }));
  };

  const setTheme = (theme: 'light' | 'dark' | 'auto') => {
    setCustomization((prev) => ({
      ...prev,
      theme,
    }));
  };

  const resetCustomization = () => {
    setCustomization(DEFAULT_CUSTOMIZATION);
    localStorage.removeItem(STORAGE_KEY);
  };

  const getVisibleWidgets = () => {
    return Object.values(customization.widgets)
      .filter((w) => w.visible)
      .sort((a, b) => a.order - b.order);
  };

  return {
    customization,
    toggleWidget,
    reorderWidgets,
    setDateRange,
    setRefreshInterval,
    toggleCompactView,
    setTheme,
    resetCustomization,
    getVisibleWidgets,
  };
};
