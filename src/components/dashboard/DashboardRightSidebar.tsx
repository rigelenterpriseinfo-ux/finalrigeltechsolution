import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UrgentActionsPanel } from './UrgentActionsPanel';
import { RecentActivitiesWidget } from './RecentActivitiesWidget';
import { QuickActionsWidget } from './QuickActionsWidget';
import { UrgentAction } from '@/hooks/useDashboardData';
import { cn } from '@/lib/utils';

interface DashboardRightSidebarProps {
  urgentActions: UrgentAction[];
  actionsLoading: boolean;
  companyId?: string;
  className?: string;
}

export const DashboardRightSidebar = ({
  urgentActions,
  actionsLoading,
  companyId,
  className,
}: DashboardRightSidebarProps) => {
  return (
    <aside 
      className={cn(
        'w-full lg:w-[380px] space-y-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto',
        'scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent',
        className
      )}
      aria-label="Dashboard sidebar"
    >
      {/* Urgent Actions - Compact Version */}
      <div className="lg:block">
        <UrgentActionsPanel
          actions={urgentActions}
          loading={actionsLoading}
          compact
        />
      </div>

      {/* Recent Activities Timeline */}
      <RecentActivitiesWidget companyId={companyId} />

      {/* Quick Actions */}
      <QuickActionsWidget />
    </aside>
  );
};
