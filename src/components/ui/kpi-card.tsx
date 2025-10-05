import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: number | string;
  prefix?: string;
  suffix?: string;
  trend?: {
    value: number;
    isPositive: boolean;
    label?: string;
  };
  icon: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  action?: {
    label: string;
    onClick: () => void;
  };
  sparklineData?: number[];
  loading?: boolean;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  prefix = '',
  suffix = '',
  trend,
  icon: Icon,
  variant = 'default',
  action,
  sparklineData,
  loading = false,
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const numericValue = typeof value === 'number' ? value : 0;

  // Animated counter effect
  useEffect(() => {
    if (typeof value !== 'number' || loading) return;
    
    const duration = 1000;
    const steps = 60;
    const stepValue = value / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      if (currentStep <= steps) {
        setDisplayValue(Math.floor(stepValue * currentStep));
      } else {
        setDisplayValue(value);
        clearInterval(timer);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value, loading]);

  const variantStyles = {
    default: 'border-border bg-card',
    success: 'border-green-500/30 bg-gradient-to-br from-green-500/5 to-green-500/10',
    warning: 'border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-amber-500/10',
    danger: 'border-red-500/30 bg-gradient-to-br from-red-500/5 to-red-500/10',
    info: 'border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-blue-500/10',
  };

  const iconStyles = {
    default: 'text-muted-foreground bg-muted',
    success: 'text-green-600 bg-green-500/10',
    warning: 'text-amber-600 bg-amber-500/10',
    danger: 'text-red-600 bg-red-500/10',
    info: 'text-blue-600 bg-blue-500/10',
  };

  if (loading) {
    return (
      <Card className="border shadow-sm">
        <CardContent className="p-6">
          <div className="space-y-4 animate-pulse">
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-12 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-1/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      'border transition-all duration-300 hover:shadow-lg hover:scale-[1.02]',
      variantStyles[variant]
    )}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight">
                {prefix}{typeof value === 'number' ? displayValue.toLocaleString('en-IN') : value}{suffix}
              </span>
            </div>
          </div>
          <div className={cn(
            'p-3 rounded-xl',
            iconStyles[variant]
          )}>
            <Icon className="h-6 w-6" />
          </div>
        </div>

        {trend && (
          <div className="flex items-center gap-2 mb-2">
            <div className={cn(
              'flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-md',
              trend.isPositive ? 'text-green-600 bg-green-500/10' : 'text-red-600 bg-red-500/10'
            )}>
              {trend.isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{trend.isPositive ? '+' : ''}{trend.value}%</span>
            </div>
            {trend.label && (
              <span className="text-xs text-muted-foreground">{trend.label}</span>
            )}
          </div>
        )}

        {sparklineData && sparklineData.length > 0 && (
          <div className="h-8 flex items-end gap-0.5">
            {sparklineData.map((value, index) => {
              const maxValue = Math.max(...sparklineData);
              const height = (value / maxValue) * 100;
              return (
                <div
                  key={index}
                  className={cn(
                    'flex-1 rounded-sm transition-all',
                    variant === 'success' ? 'bg-green-500/30' :
                    variant === 'warning' ? 'bg-amber-500/30' :
                    variant === 'danger' ? 'bg-red-500/30' :
                    variant === 'info' ? 'bg-blue-500/30' :
                    'bg-primary/30'
                  )}
                  style={{ height: `${height}%` }}
                />
              );
            })}
          </div>
        )}

        {action && (
          <button
            onClick={action.onClick}
            className="mt-3 text-sm font-medium text-primary hover:underline"
          >
            {action.label} →
          </button>
        )}
      </CardContent>
    </Card>
  );
};
