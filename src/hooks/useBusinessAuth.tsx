import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface BusinessUser {
  id: string;
  username: string;
  email: string;
  access_type: 'OWNER' | 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'INACTIVE';
  company_id: string;
}

export const useBusinessAuth = () => {
  const { user, company, profile } = useAuth();
  const [businessUser, setBusinessUser] = useState<BusinessUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.email && company?.id) {
      fetchBusinessUser();
    } else {
      setLoading(false);
    }
  }, [user?.email, company?.id]);

  const fetchBusinessUser = async () => {
    try {
      const { data, error } = await supabase
        .from('company_users')
        .select('*')
        .eq('email', user?.email)
        .eq('company_id', company?.id)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found error
        console.error('Error fetching business user:', error);
      } else {
        setBusinessUser(data as BusinessUser);
      }
    } catch (error) {
      console.error('Business user fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasAccess = (section: string): boolean => {
    // Owners/Admins always have access
    if (businessUser?.access_type === 'OWNER' || businessUser?.access_type === 'ADMIN') return true;
    if (profile?.role === 'owner' || profile?.role === 'admin') return true;
    // For regular users, allow read by default (RLS enforces write restrictions)
    return true;
  };

  const hasEditAccess = (section: string): boolean => {
    if (businessUser?.access_type === 'OWNER' || businessUser?.access_type === 'ADMIN') return true;
    if (profile?.role === 'owner' || profile?.role === 'admin') return true;
    return false;
  };

  const canPerformAction = (section: string, action: 'read' | 'edit'): boolean => {
    if (action === 'read') {
      return hasAccess(section);
    }
    return hasEditAccess(section);
  };

  const isOwnerOrAdmin = (): boolean => {
    return (
      businessUser?.access_type === 'OWNER' ||
      businessUser?.access_type === 'ADMIN' ||
      profile?.role === 'owner' ||
      profile?.role === 'admin'
    );
  };

  const canManageCompany = (): boolean => {
    return isOwnerOrAdmin();
  };

  return {
    businessUser,
    loading,
    hasAccess,
    hasEditAccess,
    canPerformAction,
    isOwnerOrAdmin,
    canManageCompany,
    refetch: fetchBusinessUser
  };
};