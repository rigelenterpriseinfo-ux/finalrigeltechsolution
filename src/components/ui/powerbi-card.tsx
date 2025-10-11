import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { POWER_BI_THEME } from '@/lib/powerBiTheme';

interface PowerBICardProps {
  title?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const PowerBICard = ({ 
  title, 
  children, 
  icon, 
  actions,
  className 
}: PowerBICardProps) => {
  return (
    <Card className={cn(
      'bg-card border-border',
      POWER_BI_THEME.effects.cardShadow,
      className
    )}>
      {title && (
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            {icon && <span className="text-muted-foreground">{icon}</span>}
            <CardTitle className={POWER_BI_THEME.typography.cardTitle}>
              {title}
            </CardTitle>
          </div>
          {actions}
        </CardHeader>
      )}
      <CardContent className={cn('pt-6', !title && 'pt-6')}>
        {children}
      </CardContent>
    </Card>
  );
};
