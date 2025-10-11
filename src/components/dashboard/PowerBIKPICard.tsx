import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { POWER_BI_THEME } from '@/lib/powerBiTheme';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { LucideIcon } from 'lucide-react';

interface PowerBIKPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  onClick?: () => void;
  loading?: boolean;
}

export const PowerBIKPICard = ({
  title,
  value,
  icon: Icon,
  trend,
  onClick,
  loading = false,
}: PowerBIKPICardProps) => {
  const getTrendColor = () => {
    if (!trend) return 'text-muted-foreground';
    if (trend.value > 0) return 'text-[#107C41]';
    if (trend.value < 0) return 'text-[#D83B01]';
    return 'text-muted-foreground';
  };

  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend.value > 0) return <TrendingUp className="h-3 w-3" />;
    if (trend.value < 0) return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  if (loading) {
    return (
      <Card className={cn(
        'bg-card border-border',
        POWER_BI_THEME.effects.cardShadow
      )}>
        <CardContent className="p-6">
          <div className="space-y-3 animate-pulse">
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="h-10 w-32 bg-muted rounded" />
            <div className="h-3 w-20 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className={cn(
        'bg-card border-border cursor-pointer',
        POWER_BI_THEME.effects.cardShadow,
        onClick && 'hover:border-[#2B88D8]/30'
      )}
      onClick={onClick}
    >
      <CardContent className="p-6 flex flex-col min-h-[140px]">
        <div className="flex items-start justify-between mb-4">
          <span className={POWER_BI_THEME.typography.kpiLabel}>
            {title}
          </span>
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        
        <div className={cn(POWER_BI_THEME.typography.kpiValue, 'mb-4')}>
          {value}
        </div>
        
        {trend && (
          <div className={cn('flex items-center gap-1 text-xs', getTrendColor())}>
            {getTrendIcon()}
            <span>
              {trend.value > 0 ? '+' : ''}{trend.value}% {trend.label}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
