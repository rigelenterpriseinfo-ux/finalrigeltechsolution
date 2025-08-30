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
  role: 'Admin' | 'User';
  company_id: string;
}

function mapRoleToProfile(role: 'Admin' | 'User'): 'owner' | 'admin' | 'manager' | 'staff' {
  return role === 'Admin' ? 'admin' : 'staff';
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
    const { email, password, name, role, company_id } = payload;

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

    // Check if auth user already exists
    const { data: existingUser } = await admin.auth.admin.getUserByEmail(email);

    let authUserId: string | null = existingUser?.user?.id ?? null;

    if (!authUserId) {
      // Create auth user, mark as confirmed to avoid any email verification issues
      const tempPassword = password || crypto.randomUUID().replace(/-/g, '').slice(0, 16);
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
      if (createErr) {
        return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
      authUserId = created.user?.id ?? null;
      if (!authUserId) {
        return new Response(JSON.stringify({ error: 'Failed to create user' }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }

      // Optionally send invite to set their own password
      await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${new URL(req.url).origin}/auth?tab=reset` });
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

    return new Response(JSON.stringify({ success: true, auth_user_id: authUserId }), {
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