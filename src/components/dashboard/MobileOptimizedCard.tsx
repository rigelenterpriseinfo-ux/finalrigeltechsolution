import React, { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileOptimizedCardProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  compact?: boolean;
}

export const MobileOptimizedCard: React.FC<MobileOptimizedCardProps> = ({
  title,
  icon,
  children,
  action,
  className,
  compact = false,
}) => {
  return (
    <Card className={cn('touch-manipulation', className)}>
      <CardHeader className={cn(compact ? 'p-4 pb-2' : 'p-4')}>
        <div className="flex items-center justify-between">
          <CardTitle className={cn(
            'flex items-center gap-2',
            compact ? 'text-base' : 'text-lg'
          )}>
            {icon}
            <span className="truncate">{title}</span>
          </CardTitle>
          {action && (
            <Button
              variant="ghost"
              size="sm"
              onClick={action.onClick}
              className="h-8 px-2 text-xs"
            >
              {action.label}
              <ChevronRight className="ml-1 h-3 w-3" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className={cn(compact ? 'p-4 pt-2' : 'p-4')}>
        {children}
      </CardContent>
    </Card>
  );
};
