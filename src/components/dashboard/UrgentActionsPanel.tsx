import React from 'react';
import { AlertCard } from '@/components/ui/alert-card';
import { PackageX, Clock, FileText, RotateCcw } from 'lucide-react';
import { UrgentAction } from '@/hooks/useDashboardData';
import { useNavigate } from 'react-router-dom';

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

  const getActionButtons = (action: UrgentAction) => {
    switch (action.type) {
      case 'low_stock':
        return [
          {
            label: 'Reorder Now',
            onClick: () => navigate('/dashboard?module=purchase'),
          },
          {
            label: 'View Details',
            onClick: () => navigate('/dashboard?module=inventory'),
            variant: 'outline' as const,
          },
        ];
      case 'overdue_po':
        return [
          {
            label: 'Follow Up',
            onClick: () => navigate('/dashboard?module=purchase'),
          },
          {
            label: 'View POs',
            onClick: () => navigate('/dashboard?module=purchase'),
            variant: 'outline' as const,
          },
        ];
      case 'unpaid_invoice':
        return [
          {
            label: 'Send Reminder',
            onClick: () => navigate('/dashboard?module=sales'),
          },
          {
            label: 'View Invoices',
            onClick: () => navigate('/dashboard?module=sales'),
            variant: 'outline' as const,
          },
        ];
      case 'backorder':
        return [
          {
            label: 'Process',
            onClick: () => navigate('/dashboard?module=backorders'),
          },
          {
            label: 'View All',
            onClick: () => navigate('/dashboard?module=backorders'),
            variant: 'outline' as const,
          },
        ];
      default:
        return [];
    }
  };

  if (loading) {
    return (
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Urgent Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Urgent Actions</h2>
        <div className="bg-green-500/5 border border-green-500/30 rounded-lg p-6 text-center">
          <p className="text-green-600 font-medium">✓ All caught up! No urgent actions needed.</p>
        </div>
      </div>
    );
  }

  // Limit to top 5 high-priority actions only
  const topActions = actions.slice(0, 5);
  const hasMore = actions.length > 5;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Urgent Actions</h2>
        <span className="text-sm text-muted-foreground">
          {topActions.length} {topActions.length === 1 ? 'action' : 'actions'} require attention
          {hasMore && ` (+${actions.length - 5} more)`}
        </span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {topActions.map((action) => (
          <AlertCard
            key={action.id}
            title={action.title}
            description={action.description}
            priority={action.priority}
            count={action.count}
            value={action.value}
            icon={getActionIcon(action.type)}
            actions={getActionButtons(action)}
            timestamp={action.timestamp}
          />
        ))}
      </div>
    </div>
  );
};
