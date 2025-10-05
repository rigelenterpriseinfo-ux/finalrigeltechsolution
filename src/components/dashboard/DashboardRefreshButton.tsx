import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardRefreshButtonProps {
  onRefresh: () => Promise<void>;
  className?: string;
}

export const DashboardRefreshButton: React.FC<DashboardRefreshButtonProps> = ({
  onRefresh,
  className,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleRefresh}
      disabled={isRefreshing}
      className={cn('gap-2', className)}
    >
      <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
      {isRefreshing ? 'Refreshing...' : 'Refresh'}
    </Button>
  );
};
