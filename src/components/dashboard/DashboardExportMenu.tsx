import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileJson, FileSpreadsheet, Printer } from 'lucide-react';
import { exportDashboardToJSON, exportDashboardToCSV, printDashboard } from '@/utils/dashboardExport';
import { useToast } from '@/hooks/use-toast';

interface DashboardExportMenuProps {
  data: any;
  companyId?: string;
}

export const DashboardExportMenu: React.FC<DashboardExportMenuProps> = ({ 
  data, 
  companyId 
}) => {
  const { toast } = useToast();

  const handleExportJSON = () => {
    try {
      exportDashboardToJSON({
        ...data,
        exportDate: new Date().toISOString(),
        companyId: companyId || 'unknown',
      });
      toast({
        title: 'Export Successful',
        description: 'Dashboard data exported as JSON',
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Failed to export dashboard data',
        variant: 'destructive',
      });
    }
  };

  const handleExportCSV = () => {
    try {
      exportDashboardToCSV({
        ...data,
        exportDate: new Date().toISOString(),
        companyId: companyId || 'unknown',
      });
      toast({
        title: 'Export Successful',
        description: 'Dashboard data exported as CSV',
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Failed to export dashboard data',
        variant: 'destructive',
      });
    }
  };

  const handlePrint = () => {
    try {
      printDashboard();
    } catch (error) {
      toast({
        title: 'Print Failed',
        description: 'Failed to print dashboard',
        variant: 'destructive',
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Export</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Export Dashboard</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleExportJSON} className="gap-2">
          <FileJson className="h-4 w-4" />
          Export as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportCSV} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" />
          Print Dashboard
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
