/**
 * Utility functions for exporting dashboard data
 */

export interface DashboardExportData {
  kpiData?: any;
  purchaseData?: any;
  inventoryData?: any;
  salesData?: any;
  financeData?: any;
  operationsData?: any;
  exportDate: string;
  companyId: string;
}

export const exportDashboardToJSON = (data: DashboardExportData) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dashboard-export-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const exportDashboardToCSV = (data: DashboardExportData) => {
  // Convert data to CSV format
  const rows: string[] = [];
  
  // Add header
  rows.push('Section,Metric,Value');
  
  // KPI Data
  if (data.kpiData) {
    rows.push(`KPI,Total Revenue,${data.kpiData.totalRevenue || 0}`);
    rows.push(`KPI,Active Orders,${data.kpiData.activeOrders || 0}`);
    rows.push(`KPI,Low Stock Alerts,${data.kpiData.lowStockAlerts || 0}`);
    rows.push(`KPI,Cash Flow,${data.kpiData.cashFlow || 0}`);
  }
  
  // Purchase Data
  if (data.purchaseData) {
    rows.push(`Purchase,Open PO Count,${data.purchaseData.openPOCount || 0}`);
    rows.push(`Purchase,Total Open PO Value,${data.purchaseData.totalOpenPOValue || 0}`);
  }
  
  // Inventory Data
  if (data.inventoryData) {
    rows.push(`Inventory,Damaged Value,${data.inventoryData.damagedValue || 0}`);
  }
  
  // Add export metadata
  rows.push(`Metadata,Export Date,${data.exportDate}`);
  rows.push(`Metadata,Company ID,${data.companyId}`);
  
  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dashboard-export-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const printDashboard = () => {
  window.print();
};
