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
}

export const UrgentActionsPanel: React.FC<UrgentActionsPanelProps> = ({
  actions,
  loading = false,
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
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            Urgent Actions Required
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 p-3 rounded-md bg-muted/30 animate-pulse">
                <div className="w-10 h-10 bg-muted rounded" />
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
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            Urgent Actions Required
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-[#107C41]" />
            <p className="text-sm">All caught up! No urgent actions at this time.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Limit to top 5 high-priority actions only
  const topActions = actions.slice(0, 5);

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="border-b border-border">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          Urgent Actions Required
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {topActions.length} {topActions.length === 1 ? 'action' : 'actions'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-3">
          {topActions.map((action) => (
            <div
              key={action.id}
              className="flex gap-3 p-4 rounded-md border border-border bg-card hover:shadow-sm transition-shadow"
            >
              <div className="p-2 rounded-md h-fit bg-muted">
                {React.createElement(getActionIcon(action.type), {
                  className: 'h-5 w-5 text-muted-foreground',
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
                    <p className="font-medium text-sm">{action.title}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {action.priority.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{action.description}</p>
                {action.value && (
                  <p className="text-xs text-muted-foreground mb-3">{action.value}</p>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction(action.type)}
                  className="text-xs h-8"
                >
                  Take Action
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
