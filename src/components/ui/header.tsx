import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Search, Settings, User, LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  showSearch?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ 
  title, 
  subtitle, 
  actions, 
  showSearch = true 
}) => {
  const { signOut, profile, company } = useAuth();

  const handleSignOut = () => {
    signOut();
  };

  return (
    <header className="bg-card border-b border-border">
      <div className="section-padding">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
                {subtitle && (
                  <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Company Badge */}
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
              {company?.name || 'Your Company'}
            </Badge>

            {showSearch && (
              <div className="relative w-80 hidden md:block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  className="pl-10 bg-muted/50 border-0 focus:bg-background"
                />
              </div>
            )}

            {actions}

            {/* Company ID and Sign Out */}
            <div className="flex flex-col items-end gap-2">
              <Button 
                onClick={handleSignOut}
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10 border-destructive/20"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
              
              {/* Company Business ID */}
              {company?.business_ref_no && (
                <div className="text-xs text-muted-foreground">
                  Company ID: <span className="font-mono text-primary">{company.business_ref_no}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};