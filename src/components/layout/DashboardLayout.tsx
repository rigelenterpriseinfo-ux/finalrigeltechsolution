import React from 'react';
import { Header } from '@/components/ui/header';
import { NavigationSidebar } from '@/components/ui/navigation-sidebar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  headerActions?: React.ReactNode;
  showSearch?: boolean;
  showWelcome?: boolean;
  showHeader?: boolean;
  activeView?: string;
  onNavigate?: (view: string) => void;
  className?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  title,
  subtitle,
  headerActions,
  showSearch = true,
  showWelcome = false,
  showHeader = false,
  activeView = 'dashboard',
  onNavigate = () => {},
  className,
}) => {
  const { user, profile } = useAuth();
  const { businessUser } = useBusinessAuth();
  const emailToShow = user?.email || businessUser?.email || '';
  const roleLabel = (businessUser?.access_type === 'ADMIN' || businessUser?.access_type === 'OWNER' || profile?.role === 'admin' || profile?.role === 'owner') ? 'Admin' : 'User';
  
  return (
    <div className="flex flex-col min-h-screen">
      {showHeader && (
        <Header 
          title={title} 
          subtitle={subtitle} 
          actions={headerActions}
          showSearch={showSearch}
          showWelcome={showWelcome}
        />
      )}
      <div className="flex flex-1">
        <NavigationSidebar 
          activeView={activeView} 
          onNavigate={onNavigate}
          className="flex-shrink-0"
        />
        <main className={cn('flex-1 bg-gradient-subtle', className)}>
          <div className="section-padding content-container">
            <div className="animate-fade-up">
              {children}
            </div>
          </div>
        </main>
      </div>
      <aside aria-label="current-user" className="fixed left-4 bottom-4 text-xs text-muted-foreground bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border border-border rounded-md px-3 py-2 shadow z-50">
        <span>{emailToShow || 'Signed out'}</span>
        <span className="mx-2">•</span>
        <span>{roleLabel}</span>
      </aside>
    </div>
  );
};