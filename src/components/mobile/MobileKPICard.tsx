import React from 'react';
import { Card } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCountUp } from '@/hooks/useAnimations';

interface MobileKPICardProps {
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  onClick?: () => void;
  className?: string;
}

export const MobileKPICard: React.FC<MobileKPICardProps> = ({
  title,
  value,
  prefix = '',
  suffix = '',
  icon: Icon,
  trend,
  onClick,
  className,
}) => {
  const animatedValue = useCountUp(value, 1000);

  return (
    <Card
      onClick={onClick}
      className={cn(
        'p-4 cursor-pointer active:scale-95 transition-transform',
        'border-l-4 border-l-primary',
        className
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          {title}
        </span>
        <div className="p-1.5 bg-primary/10 rounded-md">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>

      <div className="flex items-end justify-between">
        <div className="text-2xl font-bold">
          {prefix}
          {animatedValue.toLocaleString()}
          {suffix}
        </div>

        {trend && (
          <div
            className={cn(
              'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full',
              trend.isPositive
                ? 'bg-success/10 text-success'
                : 'bg-destructive/10 text-destructive'
            )}
          >
            <span>{trend.isPositive ? '↑' : '↓'}</span>
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>
    </Card>
  );
};
