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
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

interface RedesignedDashboardProps {
  companyId?: string;
}

const RedesignedDashboardComponent: React.FC<RedesignedDashboardProps> = ({ companyId }) => {
  const navigate = useNavigate();
  const { kpiData, kpiLoading, urgentActions, actionsLoading } = useDashboardData(companyId);
  const { data: operationsData, isLoading: operationsLoading, refetch: refetchOperations } = useOperationsData(companyId);
  
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
      <div className="flex gap-6 p-6">
        {/* Main Content */}
        <div className="flex-1 space-y-8">
          {/* Page Header with Refresh Button */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <Badge variant="outline" className="text-xs">
                  Live Updates
                </Badge>
              </div>
              <p className="text-muted-foreground">
                Monitor your business performance and take immediate actions
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
          <div className="space-y-8">
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
          <div className="space-y-8">
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

        {/* Quick Actions Sidebar - Hidden on mobile, sticky on desktop */}
        <div className="hidden md:block">
          <QuickActionsSidebar />
        </div>
      </div>

      {/* Mobile FAB is part of QuickActionsSidebar component */}
      <div className="md:hidden">
        <QuickActionsSidebar />
      </div>
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const RedesignedDashboard = memo(RedesignedDashboardComponent);
