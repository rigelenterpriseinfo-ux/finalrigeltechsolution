import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Search, Settings, User, LogOut, LogIn } from 'lucide-react';
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
import { useNavigate } from 'react-router-dom';

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
  const { user, signOut, profile, company } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
    signOut();
  };

  const handleSignIn = () => {
    navigate('/auth');
  };

  return (
    <header className="bg-gradient-primary border-b border-border">
      <div className="section-padding">
        <div className="flex items-center justify-between">
          {/* Left Section - Welcome Message */}
          <div className="flex-1">
            <div className="flex flex-col">
              <h1 className="text-2xl font-semibold text-white">Welcome back, {profile?.first_name || 'User'}!</h1>
              {subtitle ? (
                <p className="text-sm text-white/80 mt-1">{subtitle}</p>
              ) : (
                <p className="text-sm text-white/80 mt-1">Track payments and financial transactions</p>
              )}
            </div>
          </div>

          {/* Center Section - Company Name Highlight */}
          <div className="flex-1 flex justify-center">
            <div className="bg-white/15 backdrop-blur-sm rounded-full px-6 py-3 border border-white/20">
              <div className="text-center">
                <div className="text-lg font-bold text-white tracking-wide">
                  {company?.name || 'Your Company'}
                </div>
                {company?.business_ref_no && (
                  <div className="text-xs text-white/90 font-mono mt-1">
                    ID: {company.business_ref_no}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Section - Actions */}
          <div className="flex-1 flex justify-end items-center gap-4">
            {actions}

            {/* Sign In Button - Only visible when signed out */}
            {!user && (
              <Button 
                onClick={handleSignIn}
                variant="secondary"
                size="default"
                className="bg-white/20 text-white border-white/30 hover:bg-white/30 hover:text-white font-medium shadow-lg backdrop-blur-sm"
              >
                <LogIn className="h-4 w-4 mr-2" />
                Sign In
              </Button>
            )}

            {/* Sign Out Button - Only visible when signed in */}
            {user && (
              <Button 
                onClick={handleSignOut}
                variant="secondary"
                size="default"
                className="bg-white/20 text-white border-white/30 hover:bg-white/30 hover:text-white font-medium shadow-lg backdrop-blur-sm"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};