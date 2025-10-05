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
import { DashboardCustomizationDialog } from './DashboardCustomizationDialog';
import { DateRangeFilter } from './DateRangeFilter';
import { DraggableWidgets } from '../DraggableWidgets';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useOperationsData } from '@/hooks/useOperationsData';
import { useRealtimeDashboard } from '@/hooks/useRealtimeDashboard';
import { useMobileOptimizations } from '@/hooks/useMobileOptimizations';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePurchaseData } from '@/hooks/usePurchaseData';
import { useInventoryData } from '@/hooks/useInventoryData';
import { useSalesData } from '@/hooks/useSalesData';
import { useFinanceData } from '@/hooks/useFinanceData';
import { useDashboardCustomization } from '@/hooks/useDashboardCustomization';
import { useDashboardAnalytics } from '@/hooks/useDashboardAnalytics';
import { useNavigate } from 'react-router-dom';
import { MobileNavigation } from '@/components/mobile/MobileNavigation';
import { PullToRefreshContainer } from '@/components/mobile/PullToRefreshContainer';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { SmartNotificationManager } from '@/components/notifications/SmartNotificationManager';
import { CommandPalette } from '@/components/command/CommandPalette';
import { CommandPaletteTrigger } from '@/components/command/CommandPaletteTrigger';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Keyboard, Settings2, Maximize2, Minimize2 } from 'lucide-react';
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
  const { customization, toggleCompactView, reorderWidgets } = useDashboardCustomization();
  const { trackWidgetInteraction, trackEvent } = useDashboardAnalytics();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showCustomization, setShowCustomization] = useState(false);
  const [dragEnabled, setDragEnabled] = useState(false);
  
  // Enable real-time updates
  useRealtimeDashboard(companyId);
  
  // Enable keyboard shortcuts
  useKeyboardShortcuts((module) => {
    if (module === 'dashboard') return;
    navigate(`/dashboard?module=${module}`);
  });

  // Use compact spacing if enabled
  const spacing = customization.compactView ? 'space-y-4' : cardSpacing;

  // Handle refresh all data
  const handleRefreshAll = async () => {
    trackEvent('dashboard_refresh');
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
    <PullToRefreshContainer onRefresh={handleRefreshAll} disabled={!isMobile}>
      <SmartNotificationManager />
      <CommandPalette />
      <div className="min-h-screen bg-background pb-20 md:pb-0" role="main" aria-label="Dashboard">
        <div className={cn(
          'flex gap-6',
          isMobile ? 'flex-col p-4' : 'p-6'
        )}>
          {/* Main Content */}
          <div className={cn('flex-1', spacing)} role="region" aria-label="Dashboard content">
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
              <CommandPaletteTrigger variant="button" />
              <NotificationCenter />
              <DateRangeFilter />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDragEnabled(!dragEnabled);
                  trackEvent('toggle_drag_mode', { enabled: !dragEnabled });
                }}
                className="gap-2"
                aria-label="Toggle widget reordering"
                title="Toggle widget reordering"
              >
                <Settings2 className="h-4 w-4" />
                {dragEnabled ? 'Done' : 'Reorder'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  toggleCompactView();
                  trackEvent('toggle_compact_view', { compact: !customization.compactView });
                }}
                className="gap-2"
                aria-label="Toggle compact view"
                title="Toggle compact view"
              >
                {customization.compactView ? (
                  <Maximize2 className="h-4 w-4" />
                ) : (
                  <Minimize2 className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowCustomization(true);
                  trackEvent('open_customization');
                }}
                className="gap-2"
                aria-label="Customize dashboard"
              >
                <Settings2 className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Customize</span>
              </Button>
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

          {/* Dashboard Widgets with Drag & Drop */}
          <DraggableWidgets
            widgets={customization.widgets}
            onReorder={(widgets) => {
              reorderWidgets(widgets);
              trackEvent('widgets_reordered');
            }}
            enabled={dragEnabled}
          >
            {/* Hero KPI Section */}
            {customization.widgets.kpi?.visible && (
              <section aria-labelledby="kpi-section-title">
                <h2 id="kpi-section-title" className="sr-only">Key Performance Indicators</h2>
                <DashboardSectionWrapper>
                  <HeroKPISection
                    data={kpiData}
                    loading={kpiLoading}
                    onViewOrders={() => {
                      trackWidgetInteraction('kpi', 'view_orders');
                      navigate('/dashboard?module=sales');
                    }}
                    onReorderStock={() => {
                      trackWidgetInteraction('kpi', 'reorder_stock');
                      navigate('/dashboard?module=purchase');
                    }}
                  />
                </DashboardSectionWrapper>
              </section>
            )}

            {/* Urgent Actions Panel */}
            {customization.widgets.urgentActions?.visible && (
              <section aria-labelledby="urgent-actions-title">
                <h2 id="urgent-actions-title" className="sr-only">Urgent Actions</h2>
                <DashboardSectionWrapper>
                  <UrgentActionsPanel
                    actions={urgentActions}
                    loading={actionsLoading}
                  />
                </DashboardSectionWrapper>
              </section>
            )}

            {/* Purchase & Procurement */}
            {customization.widgets.purchase?.visible && (
              <section aria-labelledby="purchase-section-title">
                <h2 id="purchase-section-title" className="sr-only">Purchase & Procurement</h2>
                <DashboardSectionWrapper>
                  <PurchaseSection companyId={companyId} />
                </DashboardSectionWrapper>
              </section>
            )}
            
            {/* Inventory & Warehouse */}
            {customization.widgets.inventory?.visible && (
              <section aria-labelledby="inventory-section-title">
                <h2 id="inventory-section-title" className="sr-only">Inventory & Warehouse</h2>
                <DashboardSectionWrapper>
                  <InventorySection companyId={companyId} />
                </DashboardSectionWrapper>
              </section>
            )}
            
            {/* Sales & Customer */}
            {customization.widgets.sales?.visible && (
              <section aria-labelledby="sales-section-title">
                <h2 id="sales-section-title" className="sr-only">Sales & Customer</h2>
                <DashboardSectionWrapper>
                  <SalesSection companyId={companyId} />
                </DashboardSectionWrapper>
              </section>
            )}
            
            {/* Accounts & Finance */}
            {customization.widgets.finance?.visible && (
              <section aria-labelledby="finance-section-title">
                <h2 id="finance-section-title" className="sr-only">Accounts & Finance</h2>
                <DashboardSectionWrapper>
                  <FinanceSection companyId={companyId} />
                </DashboardSectionWrapper>
              </section>
            )}

            {/* Shipment Status Board */}
            {customization.widgets.shipments?.visible && (
              <section aria-labelledby="shipments-section-title">
                <h2 id="shipments-section-title" className="sr-only">Shipment Status</h2>
                <DashboardSectionWrapper>
                  <ShipmentStatusBoard 
                    statuses={operationsData?.shipmentStatuses || []}
                    loading={operationsLoading}
                  />
                </DashboardSectionWrapper>
              </section>
            )}
            
            {/* Recent Activities Timeline */}
            {customization.widgets.activities?.visible && (
              <section aria-labelledby="activities-section-title">
                <h2 id="activities-section-title" className="sr-only">Recent Activities</h2>
                <DashboardSectionWrapper>
                  <RecentActivitiesTimeline 
                    activities={operationsData?.recentActivities || []}
                    loading={operationsLoading}
                  />
                </DashboardSectionWrapper>
              </section>
            )}
          </DraggableWidgets>
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

      {/* Dashboard Customization Dialog */}
      <DashboardCustomizationDialog
        open={showCustomization}
        onOpenChange={setShowCustomization}
      />

      {/* Mobile Navigation */}
      {isMobile && <MobileNavigation />}
    </div>
    </PullToRefreshContainer>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const RedesignedDashboard = memo(RedesignedDashboardComponent);
