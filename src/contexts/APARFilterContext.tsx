import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface APARFilters {
  searchTerm: string;
  statusFilter: string;
  supplierFilter?: string;
  customerFilter?: string;
  dateRange?: { start: Date; end: Date };
}

interface APARFilterContextType {
  apFilters: APARFilters;
  arFilters: APARFilters;
  setAPFilters: (filters: Partial<APARFilters>) => void;
  setARFilters: (filters: Partial<APARFilters>) => void;
  clearAPFilters: () => void;
  clearARFilters: () => void;
}

const APARFilterContext = createContext<APARFilterContextType | undefined>(undefined);

const defaultFilters: APARFilters = {
  searchTerm: '',
  statusFilter: 'all'
};

export function APARFilterProvider({ children }: { children: ReactNode }) {
  const [apFilters, setAPFiltersState] = useState<APARFilters>(defaultFilters);
  const [arFilters, setARFiltersState] = useState<APARFilters>(defaultFilters);

  const setAPFilters = (filters: Partial<APARFilters>) => {
    setAPFiltersState(prev => ({ ...prev, ...filters }));
  };

  const setARFilters = (filters: Partial<APARFilters>) => {
    setARFiltersState(prev => ({ ...prev, ...filters }));
  };

  const clearAPFilters = () => {
    setAPFiltersState(defaultFilters);
  };

  const clearARFilters = () => {
    setARFiltersState(defaultFilters);
  };

  return (
    <APARFilterContext.Provider value={{
      apFilters,
      arFilters,
      setAPFilters,
      setARFilters,
      clearAPFilters,
      clearARFilters
    }}>
      {children}
    </APARFilterContext.Provider>
  );
}

export function useAPARFilters() {
  const context = useContext(APARFilterContext);
  if (context === undefined) {
    throw new Error('useAPARFilters must be used within an APARFilterProvider');
  }
  return context;
}