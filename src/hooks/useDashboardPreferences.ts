import { useState, useEffect } from 'react';

interface DashboardPreferences {
  viewMode: 'new' | 'classic';
  autoRefresh: boolean;
  refreshInterval: number; // in seconds
  compactMode: boolean;
}

const DEFAULT_PREFERENCES: DashboardPreferences = {
  viewMode: 'new',
  autoRefresh: false,
  refreshInterval: 300, // 5 minutes
  compactMode: false,
};

const STORAGE_KEY = 'dashboard-preferences';

export const useDashboardPreferences = () => {
  const [preferences, setPreferences] = useState<DashboardPreferences>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
      } catch {
        return DEFAULT_PREFERENCES;
      }
    }
    return DEFAULT_PREFERENCES;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }, [preferences]);

  const updatePreference = <K extends keyof DashboardPreferences>(
    key: K,
    value: DashboardPreferences[K]
  ) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  const resetPreferences = () => {
    setPreferences(DEFAULT_PREFERENCES);
    localStorage.removeItem(STORAGE_KEY);
  };

  return {
    preferences,
    updatePreference,
    resetPreferences,
  };
};
