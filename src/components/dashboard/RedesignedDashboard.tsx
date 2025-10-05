import React, { memo } from 'react';
import { HeroKPISection } from './HeroKPISection';
import { UrgentActionsPanel } from './UrgentActionsPanel';
import { PurchaseSection } from './PurchaseSection';
import { InventorySection } from './InventorySection';
import { SalesSection } from './SalesSection';
import { FinanceSection } from './FinanceSection';
import { ShipmentStatusBoard } from './ShipmentStatusBoard';
import { RecentActivitiesTimeline } from './RecentActivitiesTimeline';
import { QuickActionsSidebar } from './QuickActionsSidebar';
import { DashboardSectionWrapper } from './DashboardSectionWrapper';
import { DashboardLoadingState } from './DashboardLoadingState';
import { DashboardRefreshButton } from './DashboardRefreshButton';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useOperationsData } from '@/hooks/useOperationsData';
import { useRealtimeDashboard } from '@/hooks/useRealtimeDashboard';
import { useMobileOptimizations } from '@/hooks/useMobileOptimizations';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface RedesignedDashboardProps {
  companyId?: string;
}

const RedesignedDashboardComponent: React.FC<RedesignedDashboardProps> = ({ companyId }) => {
  const navigate = useNavigate();
  const { kpiData, kpiLoading, urgentActions, actionsLoading } = useDashboardData(companyId);
  const { data: operationsData, isLoading: operationsLoading, refetch: refetchOperations } = useOperationsData(companyId);
  const { isMobile, cardSpacing } = useMobileOptimizations();
  
  // Enable real-time updates
  useRealtimeDashboard(companyId);

  // Handle refresh all data
  const handleRefreshAll = async () => {
    await refetchOperations();
    // Other queries will be refetched via real-time subscriptions
  };

  // Show loading state on initial load
  if (kpiLoading && actionsLoading && operationsLoading) {
    return <DashboardLoadingState />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className={cn(
        'flex gap-6',
        isMobile ? 'flex-col p-4' : 'p-6'
      )}>
        {/* Main Content */}
        <div className={cn('flex-1', cardSpacing)}>
          {/* Page Header with Refresh Button */}
          <div className={cn(
            'flex items-start justify-between',
            isMobile && 'flex-col gap-3'
          )}>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className={cn(
                  'font-bold tracking-tight',
                  isMobile ? 'text-2xl' : 'text-3xl'
                )}>
                  Dashboard
                </h1>
                <Badge variant="outline" className="text-xs">
                  Live Updates
                </Badge>
              </div>
              <p className={cn(
                'text-muted-foreground',
                isMobile ? 'text-sm' : 'text-base'
              )}>
                Monitor your business performance
              </p>
            </div>
            <DashboardRefreshButton onRefresh={handleRefreshAll} />
          </div>

          {/* Hero KPI Section */}
          <DashboardSectionWrapper>
            <HeroKPISection
              data={kpiData}
              loading={kpiLoading}
              onViewOrders={() => navigate('/dashboard?module=sales')}
              onReorderStock={() => navigate('/dashboard?module=purchase')}
            />
          </DashboardSectionWrapper>

          {/* Urgent Actions Panel */}
          <DashboardSectionWrapper>
            <UrgentActionsPanel
              actions={urgentActions}
              loading={actionsLoading}
            />
          </DashboardSectionWrapper>

          {/* Business Performance Sections */}
          <div className={cardSpacing}>
            {/* Purchase & Procurement */}
            <DashboardSectionWrapper>
              <PurchaseSection companyId={companyId} />
            </DashboardSectionWrapper>
            
            {/* Inventory & Warehouse */}
            <DashboardSectionWrapper>
              <InventorySection companyId={companyId} />
            </DashboardSectionWrapper>
            
            {/* Sales & Customer */}
            <DashboardSectionWrapper>
              <SalesSection companyId={companyId} />
            </DashboardSectionWrapper>
            
            {/* Accounts & Finance */}
            <DashboardSectionWrapper>
              <FinanceSection companyId={companyId} />
            </DashboardSectionWrapper>
          </div>

          {/* Operations & Tracking Section */}
          <div className={cardSpacing}>
            {/* Shipment Status Board */}
            <DashboardSectionWrapper>
              <ShipmentStatusBoard 
                statuses={operationsData?.shipmentStatuses || []}
                loading={operationsLoading}
              />
            </DashboardSectionWrapper>
            
            {/* Recent Activities Timeline */}
            <DashboardSectionWrapper>
              <RecentActivitiesTimeline 
                activities={operationsData?.recentActivities || []}
                loading={operationsLoading}
              />
            </DashboardSectionWrapper>
          </div>
        </div>

        {/* Quick Actions Sidebar - Sticky on desktop, FAB on mobile */}
        {!isMobile && (
          <div className="hidden md:block sticky top-6 h-fit">
            <QuickActionsSidebar />
          </div>
        )}
      </div>

      {/* Mobile FAB */}
      {isMobile && <QuickActionsSidebar />}
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const RedesignedDashboard = memo(RedesignedDashboardComponent);
