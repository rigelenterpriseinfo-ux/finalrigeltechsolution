import React from 'react';
import { HeroKPISection } from './HeroKPISection';
import { UrgentActionsPanel } from './UrgentActionsPanel';
import { PurchaseSection } from './PurchaseSection';
import { InventorySection } from './InventorySection';
import { SalesSection } from './SalesSection';
import { FinanceSection } from './FinanceSection';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useNavigate } from 'react-router-dom';

interface RedesignedDashboardProps {
  companyId?: string;
}

export const RedesignedDashboard: React.FC<RedesignedDashboardProps> = ({ companyId }) => {
  const navigate = useNavigate();
  const { kpiData, kpiLoading, urgentActions, actionsLoading } = useDashboardData(companyId);

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Page Header */}
      <div className="mb-8">
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
    </div>
  );
};
