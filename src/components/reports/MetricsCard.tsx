import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
    isPositive?: boolean;
  };
  subtitle?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  loading?: boolean;
}

const variantStyles = {
  default: {
    card: 'border-border/50 hover:border-primary/50 bg-gradient-to-br from-card to-card/50',
    icon: 'bg-primary/10 text-primary',
    badge: 'bg-primary/10 text-primary'
  },
  success: {
    card: 'border-success/30 hover:border-success/50 bg-gradient-to-br from-success/5 to-card',
    icon: 'bg-success/10 text-success',
    badge: 'bg-success/10 text-success'
  },
  warning: {
    card: 'border-warning/30 hover:border-warning/50 bg-gradient-to-br from-warning/5 to-card',
    icon: 'bg-warning/10 text-warning',
    badge: 'bg-warning/10 text-warning'
  },
  danger: {
    card: 'border-destructive/30 hover:border-destructive/50 bg-gradient-to-br from-destructive/5 to-card',
    icon: 'bg-destructive/10 text-destructive',
    badge: 'bg-destructive/10 text-destructive'
  },
  info: {
    card: 'border-accent/30 hover:border-accent/50 bg-gradient-to-br from-accent/5 to-card',
    icon: 'bg-accent/10 text-accent',
    badge: 'bg-accent/10 text-accent'
  }
};

export function MetricsCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  subtitle, 
  variant = 'default',
  loading = false 
}: MetricsCardProps) {
  const styles = variantStyles[variant];

  if (loading) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <div className="space-y-4 animate-pulse">
            <div className="flex items-start justify-between">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-10 w-10 bg-muted rounded-lg" />
            </div>
            <div className="space-y-2">
              <div className="h-8 w-32 bg-muted rounded" />
              <div className="h-3 w-20 bg-muted rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      'overflow-hidden transition-all duration-300 hover:shadow-lg group',
      styles.card
    )}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              {title}
            </p>
            {trend && (
              <Badge 
                variant="secondary" 
                className={cn(
                  'gap-1 font-medium border-0',
                  trend.isPositive !== false ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                )}
              >
                {trend.isPositive !== false ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {trend.value}% {trend.label}
              </Badge>
            )}
          </div>
          
          <div className={cn(
            'p-3 rounded-lg transition-transform duration-300 group-hover:scale-110',
            styles.icon
          )}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        
        <div>
          <div className="text-3xl font-bold tracking-tight mb-1 tabular-nums">
            {value}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
