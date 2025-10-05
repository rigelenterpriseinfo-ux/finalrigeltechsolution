import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

export const DashboardLoadingState: React.FC = () => {
  return (
    <div className="min-h-screen bg-background p-6 space-y-8 animate-fade-in">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <div className="h-8 bg-muted rounded w-1/4 animate-pulse" />
        <div className="h-4 bg-muted rounded w-1/3 animate-pulse" />
      </div>

      {/* Hero KPI Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="space-y-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-12 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/3" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Urgent Actions Skeleton */}
      <div className="space-y-4">
        <div className="h-6 bg-muted rounded w-1/4 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="space-y-3 animate-pulse">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                  <div className="flex gap-2">
                    <div className="h-8 bg-muted rounded w-24" />
                    <div className="h-8 bg-muted rounded w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Business Performance Sections Skeleton */}
      <div className="space-y-8">
        {[1, 2, 3, 4].map((section) => (
          <div key={section} className="space-y-4">
            <div className="h-6 bg-muted rounded w-1/4 animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="space-y-4 animate-pulse">
                      <div className="h-4 bg-muted rounded w-1/2" />
                      <div className="h-32 bg-muted rounded" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
