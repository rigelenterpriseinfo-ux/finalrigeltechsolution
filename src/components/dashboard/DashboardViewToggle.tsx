import React from 'react';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, LayoutGrid } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface DashboardViewToggleProps {
  isNewDashboard: boolean;
  onToggle: () => void;
}

export const DashboardViewToggle: React.FC<DashboardViewToggleProps> = ({ 
  isNewDashboard, 
  onToggle 
}) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isNewDashboard ? "default" : "outline"}
            size="sm"
            onClick={onToggle}
            className="gap-2"
          >
            {isNewDashboard ? (
              <>
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">New Dashboard</span>
              </>
            ) : (
              <>
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Classic View</span>
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Switch to {isNewDashboard ? 'Classic' : 'New'} Dashboard</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
