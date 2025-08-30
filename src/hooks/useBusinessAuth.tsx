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

interface SectionPermissions {
  [sectionKey: string]: 'read' | 'edit';
}

export const useBusinessAuth = () => {
  const { user, company, profile } = useAuth();
  const [businessUser, setBusinessUser] = useState<BusinessUser | null>(null);
  const [sectionPermissions, setSectionPermissions] = useState<SectionPermissions>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.email && company?.id) {
      fetchBusinessUser();
      fetchSectionPermissions();
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

  const fetchSectionPermissions = async () => {
    if (!user?.email || !company?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('company_user_section_permissions')
        .select('access_sections')
        .eq('company_id', company.id)
        .eq('user_email', user.email)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found error
        console.error('Error fetching section permissions:', error);
      } else if (data && data.access_sections) {
        setSectionPermissions(data.access_sections as SectionPermissions);
      }
    } catch (error) {
      console.error('Section permissions fetch error:', error);
    }
  };

  const hasAccess = (section: string): boolean => {
    // Owners/Admins always have access
    if (businessUser?.access_type === 'OWNER' || businessUser?.access_type === 'ADMIN') return true;
    if (profile?.role === 'owner' || profile?.role === 'admin') return true;
    // For regular users, check section permissions
    return sectionPermissions[section] === 'read' || sectionPermissions[section] === 'edit';
  };

  const hasEditAccess = (section: string): boolean => {
    // Owners/Admins always have edit access
    if (businessUser?.access_type === 'OWNER' || businessUser?.access_type === 'ADMIN') return true;
    if (profile?.role === 'owner' || profile?.role === 'admin') return true;
    // For regular users, must have explicit edit access
    return sectionPermissions[section] === 'edit';
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

  const updateSectionPermissions = async (userEmail: string, permissions: SectionPermissions) => {
    if (!company?.id) return;

    try {
      const { error } = await supabase
        .from('company_user_section_permissions')
        .upsert({
          company_id: company.id,
          user_email: userEmail,
          access_sections: permissions
        }, {
          onConflict: 'company_id,user_email'
        });

      if (error) throw error;
      
      // Refresh permissions if updating current user
      if (userEmail === user?.email) {
        setSectionPermissions(permissions);
      }
    } catch (error) {
      console.error('Error updating section permissions:', error);
      throw error;
    }
  };

  return {
    businessUser,
    sectionPermissions,
    loading,
    hasAccess,
    hasEditAccess,
    canPerformAction,
    isOwnerOrAdmin,
    canManageCompany,
    updateSectionPermissions,
    refetch: fetchBusinessUser
  };
};