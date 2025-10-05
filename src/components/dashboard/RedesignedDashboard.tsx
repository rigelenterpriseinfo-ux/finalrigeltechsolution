import React from 'react';
import { HeroKPISection } from './HeroKPISection';
import { UrgentActionsPanel } from './UrgentActionsPanel';
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

      {/* Placeholder for future sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-card border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Purchase & Procurement</h3>
          <p className="text-sm text-muted-foreground">Coming soon...</p>
        </div>
        
        <div className="bg-card border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Inventory & Warehouse</h3>
          <p className="text-sm text-muted-foreground">Coming soon...</p>
        </div>
        
        <div className="bg-card border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Sales & Customer</h3>
          <p className="text-sm text-muted-foreground">Coming soon...</p>
        </div>
        
        <div className="bg-card border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Accounts & Finance</h3>
          <p className="text-sm text-muted-foreground">Coming soon...</p>
        </div>
      </div>
    </div>
  );
};
