import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Plus, 
  Package, 
  FileText, 
  CreditCard,
  Inbox,
  RotateCcw,
  BarChart3,
  X,
  Menu
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface QuickActionsSidebarProps {
  className?: string;
}

const quickActions = [
  {
    id: 'create-po',
    label: 'Create Purchase Order',
    icon: Plus,
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10 hover:bg-blue-500/20',
    module: 'purchase',
  },
  {
    id: 'create-so',
    label: 'Create Sales Order',
    icon: FileText,
    color: 'text-green-600',
    bgColor: 'bg-green-500/10 hover:bg-green-500/20',
    module: 'sales',
  },
  {
    id: 'receive-stock',
    label: 'Receive Stock (GRN)',
    icon: Inbox,
    color: 'text-purple-600',
    bgColor: 'bg-purple-500/10 hover:bg-purple-500/20',
    module: 'purchase',
  },
  {
    id: 'record-payment',
    label: 'Record Payment',
    icon: CreditCard,
    color: 'text-amber-600',
    bgColor: 'bg-amber-500/10 hover:bg-amber-500/20',
    module: 'payments',
  },
  {
    id: 'process-return',
    label: 'Process Return',
    icon: RotateCcw,
    color: 'text-red-600',
    bgColor: 'bg-red-500/10 hover:bg-red-500/20',
    module: 'returns',
  },
  {
    id: 'view-reports',
    label: 'View Reports',
    icon: BarChart3,
    color: 'text-teal-600',
    bgColor: 'bg-teal-500/10 hover:bg-teal-500/20',
    module: 'reports',
  },
];

export const QuickActionsSidebar: React.FC<QuickActionsSidebarProps> = ({
  className,
}) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const handleAction = (module: string) => {
    navigate(`/dashboard?module=${module}`);
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile FAB */}
      <Button
        size="icon"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg md:hidden z-50"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        'fixed right-0 top-20 bottom-0 w-64 transition-transform duration-300 z-40',
        'md:sticky md:top-6 md:h-fit md:translate-x-0',
        isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0',
        className
      )}>
        <Card className="shadow-lg border">
          <CardContent className="p-4">
            <div className="space-y-2">
              <h3 className="font-semibold text-sm mb-3 text-muted-foreground">
                QUICK ACTIONS
              </h3>
              
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={action.id}
                    variant="ghost"
                    className={cn(
                      'w-full justify-start gap-3 h-auto py-3 px-3',
                      action.bgColor,
                      action.color
                    )}
                    onClick={() => handleAction(action.module)}
                  >
                    <div className={cn(
                      'p-2 rounded-lg',
                      action.bgColor
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium text-left flex-1">
                      {action.label}
                    </span>
                  </Button>
                );
              })}
            </div>

            {/* Keyboard Shortcut Hint */}
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground text-center">
                Tip: Press <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted rounded">Cmd+K</kbd> for quick access
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};
