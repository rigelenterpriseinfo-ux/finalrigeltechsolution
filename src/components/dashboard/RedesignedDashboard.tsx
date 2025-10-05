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

/**
 * RedesignedDashboard Component
 * 
 * A comprehensive, real-time business dashboard with the following features:
 * - Hero KPI metrics (Revenue, Orders, Stock, Cash Flow)
 * - Urgent actions panel for critical tasks
 * - Business performance sections (Purchase, Inventory, Sales, Finance)
 * - Operations tracking (Shipments, Activities)
 * - Real-time updates via Supabase subscriptions
 * - Mobile-optimized with responsive layouts
 * - Keyboard shortcuts for navigation
 * - Data export (JSON, CSV, Print)
 * 
 * @component
 * @param {string} [companyId] - The company ID to fetch data for
 * 
 * @example
 * ```tsx
 * <RedesignedDashboard companyId={profile?.company_id} />
 * ```
 */
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
    <div className="min-h-screen bg-background" role="main" aria-label="Dashboard">
      <div className={cn(
        'flex gap-6',
        isMobile ? 'flex-col p-4' : 'p-6'
      )}>
        {/* Main Content */}
        <div className={cn('flex-1', cardSpacing)} role="region" aria-label="Dashboard content">
          {/* Page Header with Action Buttons */}
          <header 
            className={cn(
              'flex items-start justify-between',
              isMobile && 'flex-col gap-3'
            )}
            role="banner"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 
                  className={cn(
                    'font-bold tracking-tight',
                    isMobile ? 'text-2xl' : 'text-3xl'
                  )}
                  id="dashboard-title"
                >
                  Dashboard
                </h1>
                <Badge variant="outline" className="text-xs" aria-label="Real-time updates enabled">
                  Live Updates
                </Badge>
              </div>
              <p 
                className={cn(
                  'text-muted-foreground',
                  isMobile ? 'text-sm' : 'text-base'
                )}
                id="dashboard-description"
              >
                Monitor your business performance
              </p>
            </div>
            <div className="flex items-center gap-2" role="toolbar" aria-label="Dashboard actions">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowShortcuts(true)}
                className="gap-2"
                aria-label="Show keyboard shortcuts"
              >
                <Keyboard className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Shortcuts</span>
              </Button>
              <DashboardExportMenu data={exportData} companyId={companyId} />
              <DashboardRefreshButton onRefresh={handleRefreshAll} />
            </div>
          </header>

          {/* Hero KPI Section */}
          <section aria-labelledby="kpi-section-title">
            <h2 id="kpi-section-title" className="sr-only">Key Performance Indicators</h2>
            <DashboardSectionWrapper>
              <HeroKPISection
                data={kpiData}
                loading={kpiLoading}
                onViewOrders={() => navigate('/dashboard?module=sales')}
                onReorderStock={() => navigate('/dashboard?module=purchase')}
              />
            </DashboardSectionWrapper>
          </section>

          {/* Urgent Actions Panel */}
          <section aria-labelledby="urgent-actions-title">
            <h2 id="urgent-actions-title" className="sr-only">Urgent Actions</h2>
            <DashboardSectionWrapper>
              <UrgentActionsPanel
                actions={urgentActions}
                loading={actionsLoading}
              />
            </DashboardSectionWrapper>
          </section>

          {/* Business Performance Sections */}
          <section aria-labelledby="business-performance-title">
            <h2 id="business-performance-title" className="sr-only">Business Performance</h2>
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
          </section>

          {/* Operations & Tracking Section */}
          <section aria-labelledby="operations-title">
            <h2 id="operations-title" className="sr-only">Operations & Tracking</h2>
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
          </section>
        </div>

        {/* Quick Actions Sidebar - Sticky on desktop, FAB on mobile */}
        {!isMobile && (
          <aside 
            className="hidden md:block sticky top-6 h-fit" 
            aria-label="Quick actions"
            role="complementary"
          >
            <QuickActionsSidebar />
          </aside>
        )}
      </div>

      {/* Mobile FAB */}
      {isMobile && (
        <div role="complementary" aria-label="Quick actions">
          <QuickActionsSidebar />
        </div>
      )}

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
