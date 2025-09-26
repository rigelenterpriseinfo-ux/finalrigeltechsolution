import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, Edit, Trash2, Users, Shield, Eye, ArrowLeft, Clock, CheckCircle, User, Settings, Database, FileText, CreditCard, MapPin, Bot, Package, RotateCcw, ChevronRight, ChevronLeft, UserPlus, Lock, Globe, BarChart3, ShoppingCart, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AuditLogViewer } from '@/components/AuditLogViewer';
import { PermissionErrorBoundary } from '@/components/ui/PermissionErrorBoundary';
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface BusinessUser {
  id: string;
  user_id?: string; // Reference to auth.users.id
  user_ref: string;
  name: string;
  full_name?: string;
  email: string;
  designation?: string;
  access_type: 'OWNER' | 'ADMIN' | 'USER';
  access_sections: Record<string, 'read' | 'edit' | 'none'>;
  is_active: boolean;
  password_hash?: string;
  created_by?: string;
  last_login?: string;
  created_at: string;
}

const UserManagement = () => {
  const { company, profile, user } = useAuth();
  const { businessUser, canManageCompany, hasEditAccess, isOwnerOrAdmin, updateSectionPermissions, getEffectiveRole } = useBusinessAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<BusinessUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<BusinessUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('users');
  const [wizardStep, setWizardStep] = useState(1);
  const [bulkPermission, setBulkPermission] = useState<'none' | 'read' | 'edit' | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    designation: '',
    password: '',
    confirmPassword: '',
    access_sections: {} as Record<string, 'read' | 'edit' | 'none'>,
    is_active: true
  });

  const availableSections = [
    { key: 'dashboard', label: 'Dashboard', icon: BarChart3, description: 'View business overview and key metrics' },
    { key: 'inventory', label: 'Inventory Management', icon: Package, description: 'Manage products, stock levels, and warehouse operations' },
    { key: 'purchase', label: 'Purchase Management', icon: ShoppingCart, description: 'Handle purchase orders, supplier invoices, and procurement' },
    { key: 'sales', label: 'Sales Orders', icon: FileText, description: 'Create and manage sales orders and customer invoices' },
    { key: 'returns', label: 'Returns & Credit Notes', icon: RotateCcw, description: 'Manage product returns and customer credit notes' },
    { key: 'payments', label: 'Payment Processing', icon: CreditCard, description: 'Process payments and manage financial transactions' },
    { key: 'reports', label: 'Reports & Analytics', icon: TrendingUp, description: 'View business reports and analytics dashboards' },
    { key: 'tracking', label: 'Track & Trace', icon: MapPin, description: 'Track order status and delivery management' },
    { key: 'ai', label: 'AI Assistant', icon: Bot, description: 'Access AI-powered business insights and automation' },
    { key: 'users', label: 'Team Management', icon: Users, description: 'Manage team members and user permissions' },
    { key: 'settings', label: 'Settings', icon: Settings, description: 'Configure system settings and preferences' }
  ];

  // Enhanced permission checker that provides fallback access
  const hasTabAccess = (tab: string): boolean => {
    const role = getEffectiveRole();
    
    switch (tab) {
      case 'users':
        return isOwnerOrAdmin();
      case 'audit':
        return isOwnerOrAdmin();
      default:
        return false;
    }
  };

  // Auto-switch to accessible tab if current tab is not accessible
  useEffect(() => {
    if (!hasTabAccess(activeTab)) {
      // Find first accessible tab
      const accessibleTabs = ['users', 'audit'].filter(hasTabAccess);
      if (accessibleTabs.length > 0) {
        setActiveTab(accessibleTabs[0]);
      }
    }
  }, [activeTab, businessUser, profile]);

  // Debug current permissions (remove in production)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.debug('UserManagement Debug:', {
        activeTab,
        role: getEffectiveRole(),
        canAccessUsers: hasTabAccess('users'),
        canAccessAudit: hasTabAccess('audit'),
        isOwnerOrAdmin: isOwnerOrAdmin()
      });
    }
  }, [activeTab, businessUser, profile]);


  useEffect(() => {
    if (company?.id) {
      fetchUsers();
    }
  }, [company?.id]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('company_users')
        .select('*')
        .eq('company_id', company?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch section permissions for all users
      const { data: permissions, error: permError } = await supabase
        .from('company_user_section_permissions')
        .select('*')
        .eq('company_id', company?.id);

      if (permError) {
        console.error('Error fetching permissions:', permError);
      }

      // Create a map of email to permissions
      const permissionsMap = (permissions || []).reduce((map, perm) => {
        map[perm.user_email] = perm.access_sections || {};
        return map;
      }, {} as Record<string, any>);

      setUsers((data || []).map((user: any) => ({
        ...user,
        user_ref: user.username, // Use username as user_ref for display
        name: user.full_name || user.username, // Use full_name if available
        designation: user.designation || '',
        access_type: user.access_type || 'USER',
        access_sections: permissionsMap[user.email] || {},
        is_active: user.status === 'ACTIVE' // Map status to is_active boolean
      } as BusinessUser)));
    } catch (error: any) {
      toast({
        title: "Error loading users",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      designation: '',
      password: '',
      confirmPassword: '',
      access_sections: {},
      is_active: true
    });
    setEditingUser(null);
    setWizardStep(1);
    setBulkPermission(null);
  };

  const handleOpenDialog = (user?: BusinessUser) => {
    console.log('Opening dialog for user:', user);
    
    // Reset all state first to prevent any conflicts
    setIsSubmitting(false);
    setBulkPermission(null);
    setWizardStep(1);
    
    if (user) {
      setEditingUser(user);
      
      // Ensure we have proper data with better fallbacks
      const userName = user.full_name || user.name || '';
      const userEmail = user.email || '';
      const userSections = user.access_sections || {};
      
      console.log('User data for edit:', {
        originalUser: user,
        userName,
        userEmail,
        userSections
      });
      
      // Set form data immediately without delay to prevent race conditions
      const initialFormData = {
        name: userName,
        email: userEmail,
        designation: user.designation || '',
        password: '',
        confirmPassword: '',
        access_sections: userSections,
        is_active: user.is_active ?? true
      };
      
      console.log('Setting initial form data for edit:', initialFormData);
      setFormData(initialFormData);
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const hashPassword = async (password: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Form submit triggered, isSubmitting:', isSubmitting);
    
    if (isSubmitting) {
      console.log('Already submitting, ignoring');
      return;
    }
    
    setIsSubmitting(true);

    try {
      console.log('Starting form submission with data:', {
        name: formData.name,
        email: formData.email,
        hasPassword: !!formData.password,
        isEditing: !!editingUser,
        accessSectionsCount: Object.keys(formData.access_sections).length
      });

      // Validation
      if (!editingUser && (!formData.password || formData.password.length < 8)) {
        throw new Error('Password must be at least 8 characters long');
      }

      if (!editingUser && formData.password !== formData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

        // For new users, create in Supabase Auth first, then sync to company_users
        if (!editingUser) {
          console.log('Creating new user...');
          // Create Auth user and company_user via Edge Function
          const { data: inviteData, error: inviteError } = await supabase.functions.invoke('invite-business-user', {
            body: {
              email: formData.email,
              password: formData.password,
              name: formData.name,
              designation: formData.designation,
              company_id: company?.id,
              created_by: user?.id
            }
          });

        if (inviteError) {
          console.error('Error creating user:', inviteError);
          
          // Handle specific error cases with user-friendly messages
          let errorMessage = inviteError.message || 'Failed to create user';
          
          if (errorMessage.includes('email address has already been registered') || 
              errorMessage.includes('already registered')) {
            errorMessage = 'A user with this email address already exists. Please use a different email address or contact your administrator if you believe this is an error.';
          }
          
          throw new Error(errorMessage);
        }

        if (!inviteData?.success) {
          throw new Error(inviteData?.error || 'Failed to create user');
        }

        if (Object.keys(formData.access_sections).length > 0) {
          // Filter out 'none' permissions since they mean no access
          const validPermissions = Object.fromEntries(
            Object.entries(formData.access_sections).filter(([_, permission]) => permission !== 'none')
          ) as Record<string, 'read' | 'edit'>;
          
          if (Object.keys(validPermissions).length > 0) {
            await updateSectionPermissions(formData.email, validPermissions);
          }
        }

        toast({
          title: "User created successfully",
          description: `${formData.name} has been added to your team and can now log in with their email and password.`
        });
      } else {
        console.log('Updating existing user...');
        // For existing users, update company_users and optionally Auth user
        const userData: any = {
          username: formData.email,
          email: formData.email,
          full_name: formData.name,
          designation: formData.designation,
          status: formData.is_active ? 'ACTIVE' : 'INACTIVE' // Map is_active to status
        };

        // Hash password for existing users if password is being updated
        if (formData.password) {
          userData.password_hash = await hashPassword(formData.password);
        }

        const { error } = await supabase
          .from('company_users')
          .update(userData)
          .eq('id', editingUser.id);

        if (error) throw error;

        // Update section permissions for this user
        if (Object.keys(formData.access_sections).length > 0) {
          // Filter out 'none' permissions since they mean no access
          const validPermissions = Object.fromEntries(
            Object.entries(formData.access_sections).filter(([_, permission]) => permission !== 'none')
          ) as Record<string, 'read' | 'edit'>;
          
          if (Object.keys(validPermissions).length > 0) {
            await updateSectionPermissions(formData.email, validPermissions);
          }
        }

        // Update the Auth user via Edge Function if password changed
        if (formData.password) {
          try {
            const { error: inviteError } = await supabase.functions.invoke('invite-business-user', {
              body: {
                email: formData.email,
                password: formData.password,
                name: formData.name,
                company_id: company?.id,
              }
            });
            if (inviteError) {
              console.error('Auth user update error:', inviteError);
            }
          } catch (e) {
            console.error('Auth user update exception:', e);
          }
        }

        toast({
          title: "User updated successfully",
          description: `${formData.name} has been updated.`
        });
      }

      console.log('Form submission completed successfully');
      handleCloseDialog();
      fetchUsers();
    } catch (error: any) {
      console.error('Form submission error:', error);
      toast({
        title: editingUser ? "Error updating user" : "Error creating user",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete ${userName}?`)) return;

    try {
      const { error } = await supabase
        .from('company_users')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: "User deleted",
        description: `${userName} has been removed from your team.`
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error deleting user",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleSectionPermission = (sectionKey: string, permission: 'read' | 'edit' | 'none') => {
    setFormData(prev => ({
      ...prev,
      access_sections: {
        ...prev.access_sections,
        [sectionKey]: permission
      }
    }));
  };

  const applyBulkPermissions = (e: React.MouseEvent, permission: 'none' | 'read' | 'edit') => {
    e.preventDefault();
    e.stopPropagation();
    
    const newPermissions = {} as Record<string, 'read' | 'edit' | 'none'>;
    availableSections.forEach(section => {
      newPermissions[section.key] = permission;
    });
    setFormData(prev => ({
      ...prev,
      access_sections: newPermissions
    }));
    setBulkPermission(permission);
  };

  const nextStep = () => {
    console.log('nextStep called, current step:', wizardStep, 'canProceed:', canProceedToNextStep());
    if (wizardStep < 2 && canProceedToNextStep()) {
      setWizardStep(wizardStep + 1);
      console.log('Advanced to step:', wizardStep + 1);
    }
  };

  const prevStep = () => {
    console.log('prevStep called, current step:', wizardStep);
    if (wizardStep > 1) {
      setWizardStep(wizardStep - 1);
      console.log('Went back to step:', wizardStep - 1);
    }
  };

  const canProceedToNextStep = () => {
    switch (wizardStep) {
      case 1:
        // Basic validation: name and email are required and non-empty (fix empty string issue)
        const hasName = formData.name && formData.name.trim() !== '';
        const hasEmail = formData.email && formData.email.trim() !== '' && formData.email.includes('@');
        const basicInfoValid = hasName && hasEmail;
        
        // Debug logging for troubleshooting
        console.log('Step 1 validation:', {
          name: formData.name,
          email: formData.email,
          hasName,
          hasEmail,
          basicInfoValid,
          editingUser: !!editingUser,
          password: formData.password ? '[SET]' : '[NOT SET]',
          confirmPassword: formData.confirmPassword ? '[SET]' : '[NOT SET]',
          passwordsMatch: formData.password === formData.confirmPassword
        });
        
        // Password validation
        if (editingUser) {
          // For editing: password is optional, but if provided, must match confirmation and be valid
          const hasPassword = formData.password && formData.password.trim() !== '';
          const hasConfirmPassword = formData.confirmPassword && formData.confirmPassword.trim() !== '';
          
          let passwordValid = true;
          if (hasPassword || hasConfirmPassword) {
            // If either password field has content, both must match and be valid
            passwordValid = hasPassword && hasConfirmPassword && 
              formData.password === formData.confirmPassword && 
              formData.password.length >= 8;
          }
          // If no password fields have content, that's valid (keeping existing password)
          
          const result = basicInfoValid && passwordValid;
          console.log('Edit user validation result:', result, { basicInfoValid, passwordValid, hasPassword, hasConfirmPassword });
          return result;
        } else {
          // For new users: password is required and must match confirmation
          const hasPassword = formData.password && formData.password.trim().length >= 8;
          const hasConfirmPassword = formData.confirmPassword && formData.confirmPassword.trim().length > 0;
          const passwordValid = hasPassword && hasConfirmPassword && formData.password === formData.confirmPassword;
          
          const result = basicInfoValid && passwordValid;
          console.log('New user validation result:', result, { basicInfoValid, passwordValid, hasPassword, hasConfirmPassword });
          return result;
        }
      case 2:
        return true; // Can always proceed from permissions
      default:
        return false;
    }
  };

  if (!isOwnerOrAdmin()) {
    return (
      <DashboardLayout title="User Management" subtitle="Access Denied">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to access user management.
            </CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title="Team Management" 
      subtitle="Manage your team members and their access permissions"
      activeView="users"
      onNavigate={(view) => {
        // Handle navigation to different sections
        switch (view) {
          case 'dashboard':
            navigate('/dashboard');
            break;
          case 'users':
            // Already on user management page, no action needed
            break;
          case 'inventory':
          case 'purchase':
          case 'sales':
          case 'returns':
          case 'payments':
          case 'reports':
          case 'tracking':
          case 'ai':
          case 'profile':
            // Navigate to dashboard with the specific module as URL parameter
            navigate(`/dashboard?module=${view}`);
            break;
          default:
            navigate('/dashboard');
        }
      }}
      headerActions={
        <Button onClick={() => navigate('/dashboard')} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      }
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-background border rounded-lg p-1">
            <TabsTrigger 
              value="users" 
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200"
              disabled={!isOwnerOrAdmin()}
            >
              <Users className="h-4 w-4" />
              Team Members
            </TabsTrigger>
            <TabsTrigger 
              value="audit" 
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200"
              disabled={!isOwnerOrAdmin()}
            >
              <Clock className="h-4 w-4" />
              Audit Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Team Members</h2>
                <p className="text-muted-foreground">
                  Manage users and their access to different sections
                </p>
              </div>
              <Button 
                onClick={() => handleOpenDialog()} 
                className="btn-gradient"
                disabled={!hasEditAccess('user_management')}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <Card className="p-8 text-center">
                <div className="space-y-3">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground" />
                  <h3 className="text-lg font-medium">No team members yet</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Get started by adding your first team member to collaborate on your projects.
                  </p>
                  <Button 
                    onClick={() => handleOpenDialog()} 
                    className="btn-gradient mt-4"
                    disabled={!hasEditAccess('user_management')}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add First User
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  {users.length} team member{users.length !== 1 ? 's' : ''}
                </div>
                
                <div className="grid gap-4">
                  {users.map((user) => (
                    <Card key={user.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                              <User className="w-6 h-6 text-primary" />
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <h3 className="font-semibold text-base">{user.name}</h3>
                                <Badge 
                                  variant={user.is_active ? 'default' : 'secondary'}
                                  className={user.is_active ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' : ''}
                                >
                                  {user.is_active ? 'Active' : 'Inactive'}
                                </Badge>
                                {['OWNER','ADMIN'].includes(user.access_type) && (
                                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                    <Shield className="w-3 h-3 mr-1" />
                                    {user.access_type}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                              {user.designation && (
                                <p className="text-sm text-muted-foreground font-medium">{user.designation}</p>
                              )}
                              <p className="text-xs text-muted-foreground font-mono">ID: {user.user_ref}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenDialog(user)}
                              disabled={!hasEditAccess('user_management')}
                              className="hover:bg-primary/5"
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteUser(user.id, user.name)}
                              disabled={!hasEditAccess('user_management')}
                              className="hover:bg-destructive/5 hover:text-destructive hover:border-destructive/20"
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </div>
                        
                        <Separator className="my-4" />
                        
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-muted-foreground">Access Permissions</h4>
                            <div className="text-xs text-muted-foreground">
                              {['OWNER','ADMIN'].includes(user.access_type) ? 'Full Access' : 
                               `${Object.values(user.access_sections || {}).filter(p => p !== 'none').length} sections`}
                            </div>
                          </div>
                          
                          {['OWNER','ADMIN'].includes(user.access_type) ? (
                            <div className="flex items-center space-x-2 p-3 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20">
                              <Shield className="w-5 h-5 text-primary" />
                              <div className="flex-1">
                                <p className="font-medium text-sm">Full System Access</p>
                                <p className="text-xs text-muted-foreground">Complete access to all sections and features</p>
                              </div>
                            </div>
                          ) : Object.keys(user.access_sections || {}).length === 0 ? (
                            <div className="text-sm text-muted-foreground italic bg-muted/50 rounded-lg p-3 text-center">
                              No specific permissions assigned
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {Object.entries(user.access_sections || {}).map(([section, permission]) => {
                                if (permission === 'none') return null;
                                const sectionInfo = availableSections.find(s => s.key === section);
                                const Icon = sectionInfo?.icon || Settings;
                                
                                return (
                                  <div
                                    key={section}
                                    className={`flex items-center space-x-2 p-3 rounded-lg border ${
                                      permission === 'edit' 
                                        ? 'bg-primary/5 border-primary/20' 
                                        : 'bg-muted/50 border-border'
                                    }`}
                                  >
                                    <Icon className="w-4 h-4 text-muted-foreground" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium truncate">
                                        {sectionInfo?.label || section}
                                      </p>
                                    </div>
                                    <Badge 
                                      variant={permission === 'edit' ? 'default' : 'secondary'}
                                      className="text-xs px-2 py-0"
                                    >
                                      {permission === 'edit' ? (
                                        <><Edit className="w-3 h-3 mr-1" />Edit</>
                                      ) : (
                                        <><Eye className="w-3 h-3 mr-1" />Read</>
                                      )}
                                    </Badge>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="audit" className="space-y-6">
              <PermissionErrorBoundary>
                {!isOwnerOrAdmin() ? (
                  <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                      <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h2 className="text-2xl font-bold text-muted-foreground mb-2">Access Denied</h2>
                      <p className="text-muted-foreground">You don't have permission to view audit logs.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center">
                      <div>
                        <h2 className="text-2xl font-bold">Transaction Audit Log</h2>
                        <p className="text-muted-foreground">
                          Track all user actions and system changes with timestamps
                        </p>
                      </div>
                    </div>
                    <AuditLogViewer />
                  </>
                )}
              </PermissionErrorBoundary>
            </TabsContent>
        </Tabs>

        <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader className="border-b border-border pb-4 flex-shrink-0">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <UserPlus className="h-5 w-5 text-primary" />
                {editingUser ? 'Edit Team Member' : 'Add New Team Member'}
              </DialogTitle>
              <DialogDescription>
                {editingUser 
                  ? 'Update user information and access permissions'
                  : 'Create a new team member with appropriate role and access permissions'
                }
              </DialogDescription>
              
              {/* Progress Steps */}
              <div className="flex items-center justify-center mt-4">
                {[1, 2].map((step) => (
                  <div key={step} className="flex items-center">
                    <div className={`
                      flex items-center justify-center w-7 h-7 rounded-full border-2 text-sm font-medium
                      ${wizardStep >= step 
                        ? 'bg-primary text-primary-foreground border-primary' 
                        : 'bg-background text-muted-foreground border-muted-foreground'
                      }
                    `}>
                      {step}
                    </div>
                    {step < 2 && (
                      <div className={`
                        w-16 h-0.5 mx-2
                        ${wizardStep > step ? 'bg-primary' : 'bg-muted-foreground'}
                      `} />
                    )}
                  </div>
                ))}
              </div>
              
              {/* Step Labels */}
              <div className="flex justify-between text-xs text-muted-foreground mt-2 px-8">
                <span className={wizardStep === 1 ? 'text-primary font-medium' : ''}>Basic Info & Security</span>
                <span className={wizardStep === 2 ? 'text-primary font-medium' : ''}>Permissions</span>
              </div>
            </DialogHeader>

            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Step 1: Basic Information & Security */}
                {wizardStep === 1 && (
                  <div className="space-y-4 animate-in slide-in-from-right-5">
                    <div className="text-center mb-4">
                      <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="text-base font-semibold">Basic Information & Security</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Enter the essential details and security credentials for the team member
                      </p>
                    </div>
                    
                    {/* Basic Information */}
                    <Card className="border-dashed">
                      <CardContent className="p-4">
                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Personal Details
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="name" className="text-sm font-medium">
                              Full Name <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              id="name"
                              value={formData.name}
                              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  if (canProceedToNextStep()) {
                                    nextStep();
                                  }
                                }
                              }}
                              placeholder="Enter full name"
                              className="h-9"
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-medium">
                              Email Address (Login ID) <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              id="email"
                              type="email"
                              value={formData.email}
                              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  if (canProceedToNextStep()) {
                                    nextStep();
                                  }
                                }
                              }}
                              placeholder="user@company.com"
                              className="h-9"
                              disabled={!!editingUser}
                              required
                            />
                            {editingUser && (
                              <p className="text-xs text-muted-foreground">Email cannot be changed after creation</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="designation" className="text-sm font-medium">
                            Designation
                          </Label>
                          <Input
                            id="designation"
                            value={formData.designation}
                            onChange={(e) => setFormData(prev => ({ ...prev, designation: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (canProceedToNextStep()) {
                                  nextStep();
                                }
                              }
                            }}
                            placeholder="e.g., Manager, Developer, Analyst"
                            className="h-9"
                          />
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Security Settings */}
                    <Card className="border-dashed">
                      <CardContent className="p-4">
                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                          <Lock className="h-4 w-4" />
                          Security Settings
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="password" className="text-sm font-medium">
                              Password {!editingUser && <span className="text-destructive">*</span>}
                            </Label>
                            <Input
                              id="password"
                              type="password"
                              value={formData.password}
                              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                              placeholder={editingUser ? "Leave blank to keep current" : "Enter password"}
                              className="h-9"
                              required={!editingUser}
                              minLength={8}
                            />
                            {!editingUser && (
                              <p className="text-xs text-muted-foreground">Must be at least 8 characters long</p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="confirmPassword" className="text-sm font-medium">
                              Confirm Password {!editingUser && <span className="text-destructive">*</span>}
                            </Label>
                            <Input
                              id="confirmPassword"
                              type="password"
                              value={formData.confirmPassword}
                              onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                              placeholder={editingUser ? "Confirm new password" : "Confirm password"}
                              className="h-9"
                              required={!editingUser || (editingUser && !!formData.password)}
                            />
                          </div>
                        </div>

                        {formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword && (
                          <div className="mt-3 p-2 bg-destructive/10 border border-destructive/20 rounded-lg">
                            <p className="text-xs text-destructive">Passwords do not match</p>
                          </div>
                        )}

                        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Switch
                              id="is_active"
                              checked={formData.is_active}
                              onCheckedChange={(checked) => 
                                setFormData(prev => ({ ...prev, is_active: checked }))
                              }
                            />
                            <div>
                              <Label htmlFor="is_active" className="text-sm font-medium">
                                Account Status
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                {formData.is_active ? 'User can log in and access assigned sections' : 'User cannot log in or access the system'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Step 2: Permissions */}
                {wizardStep === 2 && (
                  <div className="space-y-4 animate-in slide-in-from-right-5">
                    <div className="text-center mb-4">
                      <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
                        <Globe className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="text-base font-semibold">Access Permissions</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Configure which sections this user can access and their permission level
                      </p>
                    </div>

                    {/* Bulk Permission Controls */}
                    <Card className="bg-gradient-to-r from-primary/5 via-primary/3 to-primary/5 border-primary/20">
                      <CardContent className="p-3">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div>
                            <h4 className="font-medium text-xs">Quick Setup</h4>
                            <p className="text-xs text-muted-foreground">Apply the same permission to all sections, then customize individually</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant={bulkPermission === 'none' ? 'default' : 'outline'}
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                applyBulkPermissions(e, 'none');
                              }}
                            >
                              No Access
                            </Button>
                            <Button
                              type="button"
                              variant={bulkPermission === 'read' ? 'default' : 'outline'}
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                applyBulkPermissions(e, 'read');
                              }}
                            >
                              Read Only
                            </Button>
                            <Button
                              type="button"
                              variant={bulkPermission === 'edit' ? 'default' : 'outline'}
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                applyBulkPermissions(e, 'edit');
                              }}
                            >
                              Full Access
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Individual Permissions */}
                    <div className="grid gap-2">
                      {availableSections.map((section, index) => {
                        const accessLevel = formData.access_sections[section.key] || 'none';
                        const SectionIcon = section.icon;
                        
                        return (
                          <Card key={section.key} className={`transition-all duration-200 hover:shadow-md ${
                            accessLevel !== 'none' ? 'ring-1 ring-primary/30 bg-primary/5' : 'hover:bg-muted/30'
                          }`}>
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1">
                                  <div className={`
                                    flex items-center justify-center w-8 h-8 rounded-lg
                                    ${accessLevel !== 'none' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
                                  `}>
                                    <SectionIcon className="h-4 w-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-xs truncate">{section.label}</h4>
                                    <p className="text-xs text-muted-foreground truncate">{section.description}</p>
                                  </div>
                                </div>
                                
                                <Select
                                  value={accessLevel}
                                  onValueChange={(value: 'none' | 'read' | 'edit') => {
                                    console.log('Permission change:', section.key, value);
                                    handleSectionPermission(section.key, value);
                                  }}
                                >
                                  <SelectTrigger className="w-28 h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">No Access</SelectItem>
                                    <SelectItem value="read">Read Only</SelectItem>
                                    <SelectItem value="edit">Full Access</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>

                    {/* Permission Legend */}
                    <Card className="bg-muted/30">
                      <CardContent className="p-3">
                        <h4 className="text-xs font-medium mb-2">Permission Levels:</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-muted-foreground"></div>
                            <div>
                              <div className="font-medium">No Access</div>
                              <div className="text-muted-foreground">Cannot see this section</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            <div>
                              <div className="font-medium">Read Only</div>
                              <div className="text-muted-foreground">View data only</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <div>
                              <div className="font-medium">Full Access</div>
                              <div className="text-muted-foreground">Create, edit, delete</div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>

              {/* Navigation Footer */}
              <div className="border-t border-border p-6 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {wizardStep > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={prevStep}
                        className="gap-2"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                    )}
                  </div>

                  <div className="text-sm text-muted-foreground">
                    Step {wizardStep} of 2
                  </div>

                  <div className="flex items-center gap-2">
                    <Button type="button" variant="ghost" onClick={handleCloseDialog}>
                      Cancel
                    </Button>
                    
                    {wizardStep < 2 ? (
                      <Button
                        type="button"
                        onClick={nextStep}
                        disabled={!canProceedToNextStep()}
                        className="gap-2"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    ) : (
                       <Button 
                         type="button" 
                         onClick={handleSubmit}
                         disabled={isSubmitting || !canProceedToNextStep()} 
                         className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                       >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {editingUser ? 'Updating...' : 'Creating...'}
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4" />
                            {editingUser ? 'Update User' : 'Create User'}
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    );
};

export default UserManagement;