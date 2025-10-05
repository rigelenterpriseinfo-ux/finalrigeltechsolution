import React from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

interface PullToRefreshContainerProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export const PullToRefreshContainer: React.FC<PullToRefreshContainerProps> = ({
  children,
  onRefresh,
  disabled = false,
  className,
}) => {
  const {
    containerRef,
    handlers,
    pullDistance,
    pullProgress,
    isRefreshing,
    shouldRefresh,
  } = usePullToRefresh({
    onRefresh,
    disabled,
  });

  return (
    <div
      ref={containerRef}
      {...handlers}
      className={cn('relative overflow-auto h-full', className)}
    >
      {/* Pull to Refresh Indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-center z-10"
        style={{
          height: pullDistance,
          opacity: pullProgress,
          transition: isRefreshing ? 'height 0.3s ease-out' : 'none',
        }}
      >
        <div
          className={cn(
            'flex items-center gap-2 text-sm font-medium text-muted-foreground',
            'transition-colors duration-200',
            shouldRefresh && 'text-primary'
          )}
        >
          <RefreshCw
            className={cn(
              'h-5 w-5 transition-transform duration-200',
              isRefreshing && 'animate-spin',
              !isRefreshing && shouldRefresh && 'rotate-180'
            )}
            style={{
              transform: !isRefreshing && !shouldRefresh 
                ? `rotate(${pullProgress * 180}deg)` 
                : undefined,
            }}
          />
          <span>
            {isRefreshing
              ? 'Refreshing...'
              : shouldRefresh
              ? 'Release to refresh'
              : 'Pull to refresh'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          transform: `translateY(${isRefreshing ? 60 : pullDistance}px)`,
          transition: isRefreshing || !pullDistance ? 'transform 0.3s ease-out' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
};
