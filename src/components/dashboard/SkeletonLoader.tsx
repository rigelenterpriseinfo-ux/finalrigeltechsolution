import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SkeletonLoaderProps {
  variant?: 'kpi' | 'list' | 'chart' | 'table';
  count?: number;
  className?: string;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  variant = 'kpi',
  count = 1,
  className,
}) => {
  const renderSkeleton = () => {
    switch (variant) {
      case 'kpi':
        return (
          <Card className={cn('animate-pulse', className)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-8 w-8 bg-muted rounded-lg" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="h-8 w-32 bg-muted rounded" />
                <div className="h-3 w-20 bg-muted rounded" />
              </div>
            </CardContent>
          </Card>
        );

      case 'list':
        return (
          <Card className={cn('animate-pulse', className)}>
            <CardHeader>
              <div className="h-6 w-40 bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-muted rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-3/4 bg-muted rounded" />
                      <div className="h-3 w-1/2 bg-muted rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );

      case 'chart':
        return (
          <Card className={cn('animate-pulse', className)}>
            <CardHeader>
              <div className="h-6 w-48 bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-muted rounded flex items-end gap-2 p-4">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-muted-foreground/20 rounded-t"
                    style={{ height: `${Math.random() * 80 + 20}%` }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        );

      case 'table':
        return (
          <Card className={cn('animate-pulse', className)}>
            <CardHeader>
              <div className="h-6 w-40 bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {/* Header */}
                <div className="flex gap-4 pb-2 border-b">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-4 flex-1 bg-muted rounded" />
                  ))}
                </div>
                {/* Rows */}
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-4 py-3">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <div key={j} className="h-4 flex-1 bg-muted rounded" />
                    ))}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ animationDelay: `${i * 100}ms` }}>
          {renderSkeleton()}
        </div>
      ))}
    </>
  );
};
