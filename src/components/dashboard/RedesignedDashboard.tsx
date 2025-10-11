import React, { memo, useState } from 'react';
import { HeroKPISection } from './HeroKPISection';
import { UrgentActionsPanel } from './UrgentActionsPanel';
import { SupplyChainSection } from './SupplyChainSection';
import { OperationalEfficiencySection } from './OperationalEfficiencySection';
import { SalesSection } from './SalesSection';
import { FinanceSection } from './FinanceSection';

import { DashboardSectionWrapper } from './DashboardSectionWrapper';
import { DashboardLoadingState } from './DashboardLoadingState';
import { DashboardRefreshButton } from './DashboardRefreshButton';
import { KeyboardShortcutsDialog } from './KeyboardShortcutsDialog';
import { DashboardCustomizationDialog } from './DashboardCustomizationDialog';
import { EnhancedDateRangeFilter } from './EnhancedDateRangeFilter';
import { QuickFilters, DashboardFilters } from './QuickFilters';
import { DashboardExportButton } from './DashboardExportButton';
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
import { useAuth } from '@/hooks/useAuth';
import { MobileNavigation } from '@/components/mobile/MobileNavigation';
import { PullToRefreshContainer } from '@/components/mobile/PullToRefreshContainer';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { SmartNotificationManager } from '@/components/notifications/SmartNotificationManager';
import { CommandPalette } from '@/components/command/CommandPalette';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Keyboard, Settings2 } from 'lucide-react';
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
  const { company } = useAuth();
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
  const [filters, setFilters] = useState<DashboardFilters>({ warehouses: [], categories: [] });
  
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
              'flex items-center justify-between mb-6',
              isMobile && 'flex-wrap gap-3'
            )}
            role="banner"
          >
            <Badge variant="outline" className="text-xs" aria-label="Real-time updates enabled">
              Live Updates
            </Badge>
            <div className="flex items-center gap-2" role="toolbar" aria-label="Dashboard actions">
              <NotificationCenter />
              <QuickFilters 
                companyId={companyId}
                filters={filters}
                onFiltersChange={setFilters}
              />
              <EnhancedDateRangeFilter />
              <DashboardExportButton
                data={{
                  kpis: kpiData,
                  purchases: purchaseData,
                  inventory: inventoryData,
                  sales: salesData,
                  finance: financeData,
                }}
                companyName={company?.name}
              />
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
              <DashboardRefreshButton onRefresh={handleRefreshAll} />
            </div>
          </header>

          {/* Dashboard Widgets */}
          <div className={spacing}>
            {/* Hero KPI Section */}
            {customization.widgets.kpi?.visible && (
              <section aria-labelledby="kpi-section-title">
                <h2 id="kpi-section-title" className="sr-only">Key Performance Indicators</h2>
                <DashboardSectionWrapper>
                  <HeroKPISection
                    data={kpiData}
                    loading={kpiLoading}
                    companyId={companyId}
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

            {/* Supply Chain Overview (Combined Purchase + Inventory) */}
            {(customization.widgets.purchase?.visible || customization.widgets.inventory?.visible) && (
              <section aria-labelledby="supply-chain-section-title">
                <h2 id="supply-chain-section-title" className="sr-only">Supply Chain Overview</h2>
                <DashboardSectionWrapper>
                  <SupplyChainSection companyId={companyId} />
                </DashboardSectionWrapper>
              </section>
            )}

            {/* Operational Efficiency */}
            <section aria-labelledby="operational-efficiency-title">
              <h2 id="operational-efficiency-title" className="sr-only">Operational Efficiency</h2>
              <DashboardSectionWrapper>
                <OperationalEfficiencySection companyId={companyId} />
              </DashboardSectionWrapper>
            </section>
            
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

          </div>
        </div>
      </div>

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
