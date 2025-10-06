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
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'manager' | 'staff' | null>(null);

  useEffect(() => {
    const fetchAllData = async () => {
      if (!user?.email || !user?.id || !company?.id) {
        console.log('[BusinessAuth] Missing required data:', { 
          userEmail: user?.email, 
          userId: user?.id, 
          companyId: company?.id 
        });
        setLoading(false);
        return;
      }

      console.log('[BusinessAuth] Starting data fetch for:', { 
        email: user.email, 
        userId: user.id, 
        companyId: company.id 
      });
      
      try {
        // Fetch business user
        const { data: businessUserData, error: businessUserError } = await supabase
          .from('company_users_safe')
          .select('*')
          .eq('email', user.email)
          .eq('company_id', company.id)
          .maybeSingle();

        if (businessUserError) {
          console.error('[BusinessAuth] Error fetching business user:', businessUserError);
        }

        // Fetch section permissions
        const { data: permData, error: permError } = await supabase
          .from('company_user_section_permissions')
          .select('access_sections')
          .eq('company_id', company.id)
          .eq('user_email', user.email)
          .maybeSingle();

        if (permError) {
          console.error('[BusinessAuth] Error fetching section permissions:', permError);
        }

        // Fetch user role
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (roleError) {
          console.error('[BusinessAuth] Error fetching user role:', roleError);
        }

        // Update all state at once
        console.log('[BusinessAuth] Fetched data:', {
          businessUser: businessUserData,
          permissions: permData?.access_sections,
          role: roleData?.role
        });

        setBusinessUser(businessUserData as BusinessUser);
        setSectionPermissions((permData?.access_sections as SectionPermissions) || {});
        setUserRole(roleData?.role || null);
        
      } catch (error) {
        console.error('[BusinessAuth] Error fetching data:', error);
      } finally {
        console.log('[BusinessAuth] Setting loading to false');
        setLoading(false);
      }
    };
    
    fetchAllData();
  }, [user?.email, user?.id, company?.id]);

  const fetchBusinessUser = async () => {
    try {
      console.log('[BusinessAuth] Fetching business user for refetch');
      const { data, error } = await supabase
        .from('company_users_safe')
        .select('*')
        .eq('email', user?.email)
        .eq('company_id', company?.id)
        .maybeSingle();

      console.log('[BusinessAuth] Business user refetch result:', { data, error });

      if (error) {
        console.error('[BusinessAuth] Error refetching business user:', error);
      } else {
        setBusinessUser(data as BusinessUser);
      }
    } catch (error) {
      console.error('[BusinessAuth] Business user refetch error:', error);
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
        .maybeSingle();

      if (error) {
        console.error('Error fetching section permissions:', error);
      } else if (data && data.access_sections) {
        setSectionPermissions(data.access_sections as SectionPermissions);
      }
    } catch (error) {
      console.error('Section permissions fetch error:', error);
    }
  };

  const fetchUserRole = async () => {
    if (!user?.id) {
      console.log('[BusinessAuth] fetchUserRole: No user ID, skipping');
      return;
    }
    
    try {
      console.log('[BusinessAuth] Fetching user role for user ID:', user.id);
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) {
        console.error('[BusinessAuth] Error fetching user role:', error);
      } else {
        console.log('[BusinessAuth] User role fetched:', data?.role);
        setUserRole(data?.role || null);
      }
    } catch (error) {
      console.error('[BusinessAuth] User role fetch error:', error);
    }
  };

  const getEffectiveRole = (): 'OWNER' | 'ADMIN' | 'MANAGER' | 'STAFF' | 'USER' => {
    // CRITICAL: Only use userRole from user_roles table (single source of truth)
    // This prevents privilege escalation attacks and ensures consistency
    const role = userRole === 'owner' ? 'OWNER' :
                 userRole === 'admin' ? 'ADMIN' :
                 userRole === 'manager' ? 'MANAGER' :
                 userRole === 'staff' ? 'STAFF' :
                 'USER';
    
    console.log('[BusinessAuth] getEffectiveRole called:', {
      userRole,
      effectiveRole: role,
      loading
    });
    
    return role;
  };

  const hasAccess = (section: string): boolean => {
    const effectiveRole = getEffectiveRole();
    
    console.log(`[BusinessAuth] hasAccess('${section}') called:`, {
      effectiveRole,
      userRole,
      businessUserAccessType: businessUser?.access_type,
      sectionPermissions,
      loading
    });
    
    // Owners and Admins always have access
    if (effectiveRole === 'OWNER' || effectiveRole === 'ADMIN') {
      console.log(`[BusinessAuth] Access granted to '${section}' - User is ${effectiveRole}`);
      return true;
    }
    
    // Managers have access but may be restricted in some sections
    if (effectiveRole === 'MANAGER') {
      console.log(`[BusinessAuth] Access granted to '${section}' - User is MANAGER`);
      return true;
    }
    
    // Special case for company_profile - allow broader access
    if (section === 'company_profile') {
      const hasAccess = ['OWNER', 'ADMIN', 'MANAGER'].includes(effectiveRole);
      console.log(`[BusinessAuth] Company profile access check: ${hasAccess}`);
      return hasAccess;
    }
    
    // Regular users need explicit section permissions
    const hasPermission = sectionPermissions[section] === 'read' || sectionPermissions[section] === 'edit';
    console.log(`[BusinessAuth] Access check for '${section}' - Permission: ${hasPermission}`);
    return hasPermission;
  };

  const hasEditAccess = (section: string): boolean => {
    const effectiveRole = getEffectiveRole();
    
    // Owners and Admins always have edit access
    if (effectiveRole === 'OWNER' || effectiveRole === 'ADMIN') return true;
    
    // Managers may have edit access depending on section
    if (effectiveRole === 'MANAGER') {
      // Define manager restrictions for sensitive sections
      const restrictedSections = ['user-management', 'company-settings', 'billing'];
      if (restrictedSections.includes(section)) {
        return false; // Managers cannot edit these sections
      }
      return true;
    }
    
    // Special case for company_profile - allow broader edit access for managers
    if (section === 'company_profile') {
      return ['OWNER', 'ADMIN', 'MANAGER'].includes(effectiveRole);
    }
    
    // Regular users need explicit edit permissions
    return sectionPermissions[section] === 'edit';
  };

  const canPerformAction = (section: string, action: 'read' | 'edit'): boolean => {
    if (action === 'read') {
      return hasAccess(section);
    }
    return hasEditAccess(section);
  };

  const isOwnerOrAdmin = (): boolean => {
    const effectiveRole = getEffectiveRole();
    return effectiveRole === 'OWNER' || effectiveRole === 'ADMIN';
  };

  const canManageUsers = (): boolean => {
    const effectiveRole = getEffectiveRole();
    return effectiveRole === 'OWNER' || effectiveRole === 'ADMIN';
  };

  const canManageRoles = (targetRole: 'owner' | 'admin' | 'manager' | 'staff'): boolean => {
    const effectiveRole = getEffectiveRole();
    
    // Only owners can create other owners
    if (targetRole === 'owner') {
      return effectiveRole === 'OWNER';
    }
    
    // Owners and admins can manage other roles below them
    if (targetRole === 'admin') {
      return effectiveRole === 'OWNER';
    }
    
    if (targetRole === 'manager' || targetRole === 'staff') {
      return effectiveRole === 'OWNER' || effectiveRole === 'ADMIN';
    }
    
    return false;
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
    canManageUsers,
    canManageRoles,
    getEffectiveRole,
    updateSectionPermissions,
    refetch: fetchBusinessUser
  };
};