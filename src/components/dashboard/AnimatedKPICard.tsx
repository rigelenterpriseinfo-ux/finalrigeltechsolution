import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCountUp, useIntersectionAnimation, useHoverScale } from '@/hooks/useAnimations';

interface AnimatedKPICardProps {
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon: LucideIcon;
  onClick?: () => void;
  className?: string;
  delay?: number;
}

export const AnimatedKPICard: React.FC<AnimatedKPICardProps> = ({
  title,
  value,
  prefix = '',
  suffix = '',
  trend,
  icon: Icon,
  onClick,
  className,
  delay = 0,
}) => {
  const animatedValue = useCountUp(value, 1500);
  const { ref, isVisible } = useIntersectionAnimation();
  const { hoverProps } = useHoverScale(1.02);

  return (
    <div
      ref={ref}
      className={cn(
        'transition-all duration-500',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <Card
        {...hoverProps}
        onClick={onClick}
        className={cn(
          'cursor-pointer hover:shadow-lg transition-shadow duration-300',
          'border-l-4 border-l-primary',
          className
        )}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <div className="p-2 bg-primary/10 rounded-lg">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-bold">
              {prefix}
              {isVisible ? animatedValue.toLocaleString() : 0}
              {suffix}
            </div>
            {trend && (
              <div
                className={cn(
                  'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full',
                  'animate-fade-in',
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
        </CardContent>
      </Card>
    </div>
  );
};
