import React, { memo, useState } from 'react';
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
import { DashboardExportMenu } from './DashboardExportMenu';
import { KeyboardShortcutsDialog } from './KeyboardShortcutsDialog';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useOperationsData } from '@/hooks/useOperationsData';
import { useRealtimeDashboard } from '@/hooks/useRealtimeDashboard';
import { useMobileOptimizations } from '@/hooks/useMobileOptimizations';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePurchaseData } from '@/hooks/usePurchaseData';
import { useInventoryData } from '@/hooks/useInventoryData';
import { useSalesData } from '@/hooks/useSalesData';
import { useFinanceData } from '@/hooks/useFinanceData';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Keyboard } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RedesignedDashboardProps {
  companyId?: string;
}

const RedesignedDashboardComponent: React.FC<RedesignedDashboardProps> = ({ companyId }) => {
  const navigate = useNavigate();
  const { kpiData, kpiLoading, urgentActions, actionsLoading } = useDashboardData(companyId);
  const { data: operationsData, isLoading: operationsLoading, refetch: refetchOperations } = useOperationsData(companyId);
  const { data: purchaseData } = usePurchaseData(companyId);
  const { data: inventoryData } = useInventoryData(companyId);
  const { data: salesData } = useSalesData(companyId);
  const { data: financeData } = useFinanceData(companyId);
  const { isMobile, cardSpacing } = useMobileOptimizations();
  const [showShortcuts, setShowShortcuts] = useState(false);
  
  // Enable real-time updates
  useRealtimeDashboard(companyId);
  
  // Enable keyboard shortcuts
  useKeyboardShortcuts((module) => {
    if (module === 'dashboard') return;
    navigate(`/dashboard?module=${module}`);
  });

  // Handle refresh all data
  const handleRefreshAll = async () => {
    await refetchOperations();
    // Other queries will be refetched via real-time subscriptions
  };

  // Prepare export data
  const exportData = {
    kpiData,
    purchaseData,
    inventoryData,
    salesData,
    financeData,
    operationsData,
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
          {/* Page Header with Action Buttons */}
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
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowShortcuts(true)}
                className="gap-2"
              >
                <Keyboard className="h-4 w-4" />
                <span className="hidden sm:inline">Shortcuts</span>
              </Button>
              <DashboardExportMenu data={exportData} companyId={companyId} />
              <DashboardRefreshButton onRefresh={handleRefreshAll} />
            </div>
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

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog 
        open={showShortcuts} 
        onOpenChange={setShowShortcuts} 
      />
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const RedesignedDashboard = memo(RedesignedDashboardComponent);
