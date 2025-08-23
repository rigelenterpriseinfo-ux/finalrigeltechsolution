import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  user_id: string;
  company_id: string;
  first_name: string | null;
  last_name: string | null;
  role: 'owner' | 'admin' | 'manager' | 'staff';
  phone: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  phone_verified: boolean;
  avatar_url: string | null;
  is_active: boolean;
}

interface Company {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  status: 'active' | 'inactive' | 'suspended';
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  company: Company | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (
    email: string, 
    password: string, 
    companyName: string, 
    firstName: string, 
    lastName: string,
    phone: string,
    city: string,
    state: string,
    country: string
  ) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: any }>;
  sendOTP: (phone: string) => Promise<{ error: any }>;
  verifyOTP: (phone: string, otp: string) => Promise<{ error: any }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    console.log('Auth effect started');
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', { event, session: !!session, user: !!session?.user });
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          console.log('User found, fetching profile...');
          // Fetch user profile and company data
          setTimeout(async () => {
            try {
              const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', session.user.id)
                .single();

              if (profileError) {
                console.error('Error fetching profile:', profileError);
                setLoading(false);
                return;
              }

              console.log('Profile fetched:', profileData);
              setProfile(profileData);

              if (profileData?.company_id) {
                console.log('Fetching company data...');
                const { data: companyData, error: companyError } = await supabase
                  .from('companies')
                  .select('*')
                  .eq('id', profileData.company_id)
                  .single();

                if (companyError) {
                  console.error('Error fetching company:', companyError);
                  setLoading(false);
                  return;
                }

                console.log('Company fetched:', companyData);
                setCompany(companyData);
              }
            } catch (error) {
              console.error('Error in auth state change:', error);
            } finally {
              setLoading(false);
            }
          }, 0);
        } else {
          console.log('No user, clearing profile and company');
          setProfile(null);
          setCompany(null);
          setLoading(false);
        }
      }
    );

    // Check for existing session
    console.log('Checking for existing session...');
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', { session: !!session, user: !!session?.user });
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        console.log('No initial session found');
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        toast({
          title: "Sign in failed",
          description: error.message,
          variant: "destructive",
        });
      }
      
      return { error };
    } catch (error: any) {
      toast({
        title: "Sign in failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      return { error };
    }
  };

  const signUp = async (
    email: string, 
    password: string, 
    companyName: string, 
    firstName: string, 
    lastName: string,
    phone: string,
    city: string,
    state: string,
    country: string
  ) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            first_name: firstName,
            last_name: lastName,
            company_name: companyName,
            phone: phone,
            city: city,
            state: state,
            country: country,
          }
        }
      });

      if (error) {
        toast({
          title: "Sign up failed",
          description: error.message,
          variant: "destructive",
        });
        return { error };
      }

      if (data.user && !data.session) {
        toast({
          title: "Check your email",
          description: "We've sent you a confirmation link.",
        });
      }

      return { error: null };
    } catch (error: any) {
      toast({
        title: "Sign up failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      return { error };
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Sign out failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setUser(null);
      setSession(null);
      setProfile(null);
      setCompany(null);
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!profile) return { error: new Error('No profile found') };

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id);

      if (error) {
        toast({
          title: "Update failed",
          description: error.message,
          variant: "destructive",
        });
        return { error };
      }

      setProfile({ ...profile, ...updates });
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });

      return { error: null };
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      return { error };
    }
  };

  const sendOTP = async (phone: string) => {
    try {
      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store OTP in profile (in real app, use SMS service)
      const { error } = await supabase
        .from('profiles')
        .update({ 
          otp_code: otp, 
          otp_expires_at: expiresAt.toISOString() 
        })
        .eq('phone', phone);

      if (error) {
        toast({
          title: "OTP send failed",
          description: error.message,
          variant: "destructive",
        });
        return { error };
      }

      // For demo purposes, show OTP in toast (use SMS service in production)
      toast({
        title: "OTP Sent",
        description: `Your OTP is: ${otp} (Demo mode)`,
      });

      return { error: null };
    } catch (error: any) {
      toast({
        title: "OTP send failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      return { error };
    }
  };

  const verifyOTP = async (phone: string, otp: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('otp_code, otp_expires_at')
        .eq('phone', phone)
        .single();

      if (error || !data) {
        toast({
          title: "Verification failed",
          description: "Invalid phone number",
          variant: "destructive",
        });
        return { error: error || new Error('Phone not found') };
      }

      if (data.otp_code !== otp) {
        toast({
          title: "Verification failed",
          description: "Invalid OTP code",
          variant: "destructive",
        });
        return { error: new Error('Invalid OTP') };
      }

      if (new Date() > new Date(data.otp_expires_at)) {
        toast({
          title: "Verification failed",
          description: "OTP has expired",
          variant: "destructive",
        });
        return { error: new Error('OTP expired') };
      }

      // Mark phone as verified
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          phone_verified: true,
          otp_code: null,
          otp_expires_at: null 
        })
        .eq('phone', phone);

      if (updateError) {
        toast({
          title: "Verification failed",
          description: updateError.message,
          variant: "destructive",
        });
        return { error: updateError };
      }

      toast({
        title: "Phone verified",
        description: "Your phone number has been verified successfully",
      });

      return { error: null };
    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      return { error };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const redirectUrl = `${window.location.origin}/auth?tab=reset`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        toast({
          title: "Reset failed",
          description: error.message,
          variant: "destructive",
        });
        return { error };
      }

      toast({
        title: "Reset link sent",
        description: "Check your email for password reset instructions",
      });

      return { error: null };
    } catch (error: any) {
      toast({
        title: "Reset failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      return { error };
    }
  };

  const value = {
    user,
    session,
    profile,
    company,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
    sendOTP,
    verifyOTP,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};