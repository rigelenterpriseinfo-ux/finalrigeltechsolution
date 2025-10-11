import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { 
  ShoppingCart, 
  Package, 
  Users, 
  FileText,
  DollarSign,
  BarChart3,
  Plus
} from 'lucide-react';

interface QuickAction {
  id: string;
  label: string;
  icon: typeof ShoppingCart;
  module: string;
  color: string;
}

const quickActions: QuickAction[] = [
  {
    id: 'new-sale',
    label: 'New Sale',
    icon: ShoppingCart,
    module: 'sales',
    color: 'text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30',
  },
  {
    id: 'new-purchase',
    label: 'New Purchase',
    icon: Package,
    module: 'purchase',
    color: 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30',
  },
  {
    id: 'add-customer',
    label: 'Add Customer',
    icon: Users,
    module: 'sales',
    color: 'text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30',
  },
  {
    id: 'record-payment',
    label: 'Payment',
    icon: DollarSign,
    module: 'payments',
    color: 'text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30',
  },
  {
    id: 'new-invoice',
    label: 'Invoice',
    icon: FileText,
    module: 'sales',
    color: 'text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-950/30',
  },
  {
    id: 'view-reports',
    label: 'Reports',
    icon: BarChart3,
    module: 'reports',
    color: 'text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950/30',
  },
];

export const QuickActionsWidget = () => {
  const navigate = useNavigate();

  const handleAction = (module: string) => {
    navigate(`/dashboard?module=${module}`);
  };

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 px-4 pb-4">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.id}
              variant="outline"
              className={`h-auto flex flex-col items-center justify-center gap-2 py-3 transition-colors ${action.color}`}
              onClick={() => handleAction(action.module)}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{action.label}</span>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
};
