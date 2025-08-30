import React from 'react';
import { Header } from '@/components/ui/header';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  headerActions?: React.ReactNode;
  showSearch?: boolean;
  className?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  title,
  subtitle,
  headerActions,
  showSearch = true,
  className,
}) => {
  const { user, profile } = useAuth();
  const { businessUser } = useBusinessAuth();
  const emailToShow = user?.email || businessUser?.email || '';
  const roleLabel = (businessUser?.access_type === 'ADMIN' || businessUser?.access_type === 'OWNER' || profile?.role === 'admin' || profile?.role === 'owner') ? 'Admin' : 'User';
  return (
    <div className="flex flex-col min-h-screen">
      <Header 
        title={title} 
        subtitle={subtitle} 
        actions={headerActions}
        showSearch={showSearch}
      />
      <main className={cn('flex-1 bg-gradient-subtle', className)}>
        <div className="section-padding content-container">
          <div className="animate-fade-up">
            {children}
          </div>
        </div>
      </main>
      <aside aria-label="current-user" className="fixed left-4 bottom-4 text-xs text-muted-foreground bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border border-border rounded-md px-3 py-2 shadow">
        <span>{emailToShow || 'Signed out'}</span>
        <span className="mx-2">•</span>
        <span>{roleLabel}</span>
      </aside>
    </div>
  );
};