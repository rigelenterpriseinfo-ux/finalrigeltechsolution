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
  const { user, company } = useAuth();
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
    if (!businessUser) return false;
    if (businessUser.access_type === 'OWNER' || businessUser.access_type === 'ADMIN') {
      return true;
    }
    // For regular users, check if they have any access to the section
    // This would require extending the company_users table with access_sections
    // For now, return false for non-admin users
    return false;
  };

  const hasEditAccess = (section: string): boolean => {
    if (!businessUser) return false;
    if (businessUser.access_type === 'OWNER' || businessUser.access_type === 'ADMIN') {
      return true;
    }
    // For regular users, check if they have edit access to the section
    return false;
  };

  const canPerformAction = (section: string, action: 'read' | 'edit'): boolean => {
    if (action === 'read') {
      return hasAccess(section);
    }
    return hasEditAccess(section);
  };

  const isOwnerOrAdmin = (): boolean => {
    return businessUser?.access_type === 'OWNER' || businessUser?.access_type === 'ADMIN';
  };

  const canManageCompany = (): boolean => {
    return businessUser?.access_type === 'OWNER' || businessUser?.access_type === 'ADMIN';
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