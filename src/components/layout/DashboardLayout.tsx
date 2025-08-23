import React from 'react';
import { Header } from '@/components/ui/header';
import { cn } from '@/lib/utils';

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
    </div>
  );
};