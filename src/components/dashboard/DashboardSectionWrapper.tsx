import React, { Suspense, lazy, ComponentType } from 'react';
import { DashboardErrorBoundary } from './DashboardErrorBoundary';
import { Card, CardContent } from '@/components/ui/card';

interface DashboardSectionWrapperProps {
  children: React.ReactNode;
  loadingFallback?: React.ReactNode;
  onError?: () => void;
}

const DefaultLoadingFallback = () => (
  <Card>
    <CardContent className="p-6">
      <div className="space-y-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/4" />
        <div className="h-32 bg-muted rounded" />
      </div>
    </CardContent>
  </Card>
);

export const DashboardSectionWrapper: React.FC<DashboardSectionWrapperProps> = ({
  children,
  loadingFallback = <DefaultLoadingFallback />,
  onError,
}) => {
  return (
    <DashboardErrorBoundary onReset={onError}>
      <Suspense fallback={loadingFallback}>
        {children}
      </Suspense>
    </DashboardErrorBoundary>
  );
};

// Helper function to create lazy-loaded dashboard sections
export const createLazyDashboardSection = <P extends object>(
  importFunc: () => Promise<{ default: ComponentType<P> }>
) => {
  return lazy(importFunc);
};
