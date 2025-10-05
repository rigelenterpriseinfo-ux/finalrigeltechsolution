import { useState, useRef, useCallback } from 'react';

interface PullToRefreshConfig {
  threshold?: number;
  maxPullDistance?: number;
  onRefresh: () => Promise<void>;
  disabled?: boolean;
}

export const usePullToRefresh = ({
  threshold = 80,
  maxPullDistance = 120,
  onRefresh,
  disabled = false,
}: PullToRefreshConfig) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || isRefreshing) return;
      
      const container = containerRef.current;
      if (!container) return;
      
      // Only trigger if scrolled to top
      if (container.scrollTop === 0) {
        startY.current = e.touches[0].clientY;
      }
    },
    [disabled, isRefreshing]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || isRefreshing || startY.current === null) return;

      const container = containerRef.current;
      if (!container || container.scrollTop > 0) {
        startY.current = null;
        setPullDistance(0);
        return;
      }

      const currentY = e.touches[0].clientY;
      const distance = currentY - startY.current;

      if (distance > 0) {
        e.preventDefault();
        // Apply resistance
        const resistedDistance = Math.min(
          distance * 0.5,
          maxPullDistance
        );
        setPullDistance(resistedDistance);
      }
    },
    [disabled, isRefreshing, maxPullDistance]
  );

  const handleTouchEnd = useCallback(async () => {
    if (disabled || isRefreshing || startY.current === null) return;

    startY.current = null;

    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } catch (error) {
        console.error('Refresh failed:', error);
      } finally {
        setIsRefreshing(false);
      }
    }

    setPullDistance(0);
  }, [disabled, isRefreshing, pullDistance, threshold, onRefresh]);

  const pullProgress = Math.min(pullDistance / threshold, 1);
  const shouldRefresh = pullDistance >= threshold;

  return {
    containerRef,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    pullDistance,
    pullProgress,
    isRefreshing,
    shouldRefresh,
  };
};
