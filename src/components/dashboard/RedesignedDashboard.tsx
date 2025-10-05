import React from 'react';
import { HeroKPISection } from './HeroKPISection';
import { UrgentActionsPanel } from './UrgentActionsPanel';
import { PurchaseSection } from './PurchaseSection';
import { InventorySection } from './InventorySection';
import { SalesSection } from './SalesSection';
import { FinanceSection } from './FinanceSection';
import { ShipmentStatusBoard } from './ShipmentStatusBoard';
import { RecentActivitiesTimeline } from './RecentActivitiesTimeline';
import { QuickActionsSidebar } from './QuickActionsSidebar';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useOperationsData } from '@/hooks/useOperationsData';
import { useNavigate } from 'react-router-dom';

interface RedesignedDashboardProps {
  companyId?: string;
}

export const RedesignedDashboard: React.FC<RedesignedDashboardProps> = ({ companyId }) => {
  const navigate = useNavigate();
  const { kpiData, kpiLoading, urgentActions, actionsLoading } = useDashboardData(companyId);
  const { data: operationsData, isLoading: operationsLoading } = useOperationsData(companyId);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex gap-6 p-6">
        {/* Main Content */}
        <div className="flex-1 space-y-8">
          {/* Page Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Dashboard</h1>
            <p className="text-muted-foreground">
              Monitor your business performance and take immediate actions
            </p>
          </div>

          {/* Hero KPI Section */}
          <HeroKPISection
            data={kpiData}
            loading={kpiLoading}
            onViewOrders={() => navigate('/dashboard?module=sales')}
            onReorderStock={() => navigate('/dashboard?module=purchase')}
          />

          {/* Urgent Actions Panel */}
          <UrgentActionsPanel
            actions={urgentActions}
            loading={actionsLoading}
          />

          {/* Business Performance Sections */}
          <div className="space-y-8">
            {/* Purchase & Procurement */}
            <PurchaseSection companyId={companyId} />
            
            {/* Inventory & Warehouse */}
            <InventorySection companyId={companyId} />
            
            {/* Sales & Customer */}
            <SalesSection companyId={companyId} />
            
            {/* Accounts & Finance */}
            <FinanceSection companyId={companyId} />
          </div>

          {/* Operations & Tracking Section */}
          <div className="space-y-8">
            {/* Shipment Status Board */}
            <ShipmentStatusBoard 
              statuses={operationsData?.shipmentStatuses || []}
              loading={operationsLoading}
            />
            
            {/* Recent Activities Timeline */}
            <RecentActivitiesTimeline 
              activities={operationsData?.recentActivities || []}
              loading={operationsLoading}
            />
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
