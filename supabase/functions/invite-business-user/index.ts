// Edge Function: invite-business-user
// Creates a Supabase Auth user for a business user and links profile to company
// Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY secrets

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitePayload {
  email: string;
  password?: string; // optional; if missing, we'll generate one
  name?: string;
  role: 'Admin' | 'Editor' | 'Viewer';
  company_id: string;
  created_by?: string; // Track who created this user
}

function mapRoleToProfile(role: 'Admin' | 'Editor' | 'Viewer'): 'owner' | 'admin' | 'manager' | 'staff' {
  switch (role) {
    case 'Admin': return 'admin';
    case 'Editor': return 'staff';
    case 'Viewer': return 'staff';
    default: return 'staff';
  }
}

function splitName(name?: string) {
  if (!name) return { first_name: null as string | null, last_name: null as string | null };
  const parts = name.trim().split(/\s+/);
  const first_name = parts.shift() || null;
  const last_name = parts.length ? parts.join(' ') : null;
  return { first_name, last_name };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const payload: InvitePayload = await req.json();
    const { email, password, name, role, company_id, created_by } = payload;

    if (!email || !role || !company_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    // Verify requester is authenticated and is admin/owner of the same company
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const { data: requesterData, error: requesterErr } = await admin.auth.getUser(token);
    if (requesterErr || !requesterData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const requesterId = requesterData.user.id;
    const { data: requesterProfile } = await admin
      .from('profiles')
      .select('role, company_id')
      .eq('user_id', requesterId)
      .maybeSingle();

    if (!requesterProfile || !['owner', 'admin'].includes(requesterProfile.role) || requesterProfile.company_id !== company_id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // Try to create auth user first, then handle existing user case
    let authUserId: string | null = null;
    let existingUser: any = null;

    const tempPassword = password || crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    
    // Try creating the user first
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true, // Force email confirmation to true
      user_metadata: {
        name,
        invited_via: 'invite-business-user',
        company_id,
        app_role: mapRoleToProfile(role),
      },
    });

    if (created?.user) {
      // User created successfully
      authUserId = created.user.id;
      console.log(`Created new auth user: ${authUserId} for email: ${email}`);
      
      // No email sending - user is ready to log in immediately
    } else if (createErr?.message?.includes('already registered') || createErr?.message?.includes('User already registered')) {
      // User already exists, find them by listing users and matching email
      console.log(`User already exists for email: ${email}, searching for existing user`);
      
      const { data: users, error: listErr } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000 // Adjust if you have more users
      });
      
      if (listErr) {
        console.error('Error listing users:', listErr);
        return new Response(JSON.stringify({ error: `Failed to find existing user: ${listErr.message}` }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
      
      // Find user by email
      existingUser = users?.users?.find(u => u.email === email);
      
      if (!existingUser) {
        return new Response(JSON.stringify({ error: 'User exists but could not be found' }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
      
      authUserId = existingUser.id;
      console.log(`Found existing auth user: ${authUserId} for email: ${email}`);
      
      // Handle existing user: force-confirm email and set password
      const updateData: any = { email_confirm: true };
      if (password) {
        updateData.password = password;
      }
      
      const { error: updateErr } = await admin.auth.admin.updateUserById(authUserId, updateData);
      if (updateErr) {
        console.error('Error updating existing user:', updateErr);
        return new Response(JSON.stringify({ error: `Failed to update existing user: ${updateErr.message}` }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
      
      // No email sending - user can log in immediately
    } else {
      // Unexpected error during user creation
      console.error('Error creating user:', createErr);
      return new Response(JSON.stringify({ error: createErr?.message || 'Failed to create user' }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    if (!authUserId) {
      return new Response(JSON.stringify({ error: 'Failed to create or find user' }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // Check if user already exists in company_users
    const { data: existingCompanyUser } = await admin
      .from('company_users')
      .select('*')
      .eq('email', email)
      .eq('company_id', company_id)
      .maybeSingle();

    // Map role to database values
    const dbRole = role === 'Admin' ? 'admin' : role === 'Editor' ? 'editor' : 'viewer';
    const accessType = role === 'Admin' ? 'ADMIN' : 'USER';

    if (existingCompanyUser) {
      // Update existing company_user record with auth user_id
      const { error: updateError } = await admin
        .from('company_users')
        .update({
          user_id: authUserId,
          full_name: name || existingCompanyUser.username,
          role: dbRole,
          access_type: accessType,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingCompanyUser.id);

      if (updateError) {
        console.error('Error updating company user:', updateError);
      }
    } else {
      // Create new company_user record linked to auth.users
      const { error: insertError } = await admin
        .from('company_users')
        .insert({
          user_id: authUserId,
          company_id: company_id,
          email: email,
          username: email, // Keep for backward compatibility
          full_name: name,
          role: dbRole,
          access_type: accessType,
          status: 'ACTIVE',
          password_hash: 'MANAGED_BY_AUTH', // Indicate this is managed by Supabase Auth
          created_by: created_by || requesterId // Track who created this user
        });

      if (insertError) {
        console.error('Error creating company user:', insertError);
      }
    }

    // Ensure profile exists and is linked to company
    const { first_name, last_name } = splitName(name);
    await admin.from('profiles').upsert({
      user_id: authUserId,
      company_id,
      first_name,
      last_name,
      role: mapRoleToProfile(role),
      is_active: true,
    }, { onConflict: 'user_id' });

    return new Response(JSON.stringify({ 
      success: true, 
      auth_user_id: authUserId,
      message: 'User created successfully and can now log in with email and password'
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err: any) {
    console.error('invite-business-user error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});