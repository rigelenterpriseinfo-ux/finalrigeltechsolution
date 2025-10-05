import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, BarChart3, Package, ShoppingCart, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: number;
}

const navItems: NavItem[] = [
  { icon: Home, label: 'Dashboard', path: '/dashboard' },
  { icon: Package, label: 'Inventory', path: '/dashboard?module=inventory' },
  { icon: ShoppingCart, label: 'Sales', path: '/dashboard?module=sales' },
  { icon: BarChart3, label: 'Reports', path: '/dashboard?module=reports' },
  { icon: Settings, label: 'Settings', path: '/dashboard?module=settings' },
];

export const MobileNavigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' && !location.search;
    }
    return location.pathname + location.search === path;
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
      role="navigation"
      aria-label="Mobile navigation"
    >
      <div className="bg-background border-t border-border shadow-lg">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 h-full',
                  'transition-colors duration-200 relative',
                  'active:bg-muted/50',
                  active && 'text-primary'
                )}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
              >
                {/* Active Indicator */}
                {active && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-primary rounded-b-full" />
                )}

                <div className="relative">
                  <Icon className={cn('h-5 w-5', active && 'scale-110')} />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-2 -right-2 h-4 w-4 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>

                <span
                  className={cn(
                    'text-xs mt-1 transition-all duration-200',
                    active ? 'font-medium scale-95' : 'text-muted-foreground'
                  )}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
