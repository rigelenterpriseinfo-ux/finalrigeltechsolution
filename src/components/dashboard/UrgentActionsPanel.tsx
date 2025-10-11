import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PackageX, Clock, FileText, RotateCcw, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import { UrgentAction } from '@/hooks/useDashboardData';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface UrgentActionsPanelProps {
  actions: UrgentAction[];
  loading?: boolean;
  compact?: boolean;
}

export const UrgentActionsPanel: React.FC<UrgentActionsPanelProps> = ({
  actions,
  loading = false,
  compact = false,
}) => {
  const navigate = useNavigate();

  const getActionIcon = (type: UrgentAction['type']) => {
    switch (type) {
      case 'low_stock':
        return PackageX;
      case 'overdue_po':
        return Clock;
      case 'unpaid_invoice':
        return FileText;
      case 'backorder':
        return RotateCcw;
      default:
        return PackageX;
    }
  };

  const handleAction = (type: UrgentAction['type']) => {
    switch (type) {
      case 'low_stock':
        navigate('/dashboard?module=purchase');
        break;
      case 'overdue_po':
        navigate('/dashboard?module=purchase');
        break;
      case 'unpaid_invoice':
        navigate('/dashboard?module=sales');
        break;
      case 'backorder':
        navigate('/dashboard?module=backorders');
        break;
    }
  };

  if (loading) {
    return (
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className={cn("border-b border-border", compact && "pb-3")}>
          <CardTitle className={cn("flex items-center gap-2 font-medium", compact ? "text-sm" : "text-base")}>
            <AlertTriangle className={cn(compact ? "h-4 w-4" : "h-5 w-5", "text-muted-foreground")} />
            Urgent Actions Required
          </CardTitle>
        </CardHeader>
        <CardContent className={cn(compact ? "pt-4 px-4 pb-4" : "pt-6")}>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className={cn("flex gap-3 rounded-md bg-muted/30 animate-pulse", compact ? "p-3" : "p-4")}>
                <div className={cn("bg-muted rounded", compact ? "w-8 h-8" : "w-10 h-10")} />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-2/3" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (actions.length === 0) {
    return (
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className={cn("border-b border-border", compact && "pb-3")}>
          <CardTitle className={cn("flex items-center gap-2 font-medium", compact ? "text-sm" : "text-base")}>
            <AlertTriangle className={cn(compact ? "h-4 w-4" : "h-5 w-5", "text-muted-foreground")} />
            Urgent Actions Required
          </CardTitle>
        </CardHeader>
        <CardContent className={cn(compact ? "pt-4 px-4 pb-4" : "pt-6")}>
          <div className={cn("text-center text-muted-foreground", compact ? "py-6" : "py-8")}>
            <CheckCircle2 className={cn("mx-auto mb-2 text-[#107C41]", compact ? "h-8 w-8" : "h-12 w-12")} />
            <p className={compact ? "text-xs" : "text-sm"}>All caught up! No urgent actions at this time.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Limit to top actions based on mode
  const topActions = actions.slice(0, compact ? 4 : 5);

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className={cn("border-b border-border", compact && "pb-3")}>
        <CardTitle className={cn("flex items-center gap-2 font-medium", compact ? "text-sm" : "text-base")}>
          <AlertTriangle className={cn(compact ? "h-4 w-4" : "h-5 w-5", "text-muted-foreground")} />
          Urgent Actions Required
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {topActions.length} {topActions.length === 1 ? 'action' : 'actions'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className={cn(compact ? "pt-4 px-4 pb-4" : "pt-6")}>
        <div className="space-y-3">
          {topActions.map((action) => (
            <div
              key={action.id}
              className={cn(
                "flex gap-3 rounded-md border border-border bg-card hover:shadow-sm transition-shadow",
                compact ? "p-3" : "p-4"
              )}
            >
              <div className={cn("rounded-md h-fit bg-muted", compact ? "p-1.5" : "p-2")}>
                {React.createElement(getActionIcon(action.type), {
                  className: cn(compact ? 'h-4 w-4' : 'h-5 w-5', 'text-muted-foreground'),
                })}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full',
                        action.priority === 'critical'
                          ? 'bg-[#D83B01]'
                          : action.priority === 'high'
                          ? 'bg-[#FFC000]'
                          : 'bg-[#2B88D8]'
                      )}
                    />
                    <p className={cn("font-medium", compact ? "text-xs" : "text-sm")}>{action.title}</p>
                  </div>
                  {!compact && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {action.priority.toUpperCase()}
                    </span>
                  )}
                </div>
                {!compact && (
                  <p className="text-sm text-muted-foreground mb-2">{action.description}</p>
                )}
                {action.value && (
                  <p className="text-xs text-muted-foreground mb-2">{action.value}</p>
                )}
                {action.details && (
                  <p className={cn("text-xs text-muted-foreground font-medium line-clamp-2", compact ? "mb-2" : "mb-3")}>
                    {action.details}
                  </p>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction(action.type)}
                  className={cn("text-xs", compact ? "h-7" : "h-8")}
                >
                  {compact ? 'View' : 'Take Action'}
                  <ChevronRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
