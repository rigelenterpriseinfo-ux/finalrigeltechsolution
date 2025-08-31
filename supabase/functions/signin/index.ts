import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SigninRequest {
  businessRefNo?: string;
  username: string;
  password: string;
}

// Helper function to hash password
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper to check if stored value is SHA-256 hex (length 64, hex chars)
function isHashedPassword(value: string): boolean {
  return value.length === 64 && /^[a-fA-F0-9]+$/.test(value);
}

// Verify password with legacy compatibility
async function verifyPassword(providedPassword: string, storedPasswordHash: string): Promise<boolean> {
  if (isHashedPassword(storedPasswordHash)) {
    // Modern hashed password - compare hashes
    const providedHash = await hashPassword(providedPassword);
    return providedHash === storedPasswordHash;
  } else {
    // Legacy plaintext password - direct comparison
    return providedPassword === storedPasswordHash;
  }
}

// Helper function to generate session token (kept for compatibility, unused now)
function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { businessRefNo, username, password }: SigninRequest = await req.json();

    if (!username || !password) {
      console.log("Missing username or password");
      return new Response(
        JSON.stringify({ error: "Username and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize inputs
    const normalizedUsername = username.trim().toLowerCase();
    const trimmedPassword = password.trim();
    
    console.log(`Login attempt for: ${normalizedUsername}, business: ${businessRefNo || 'none'}`);

    // Initialize Supabase client with service role key
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Query company_users with case-insensitive matching on both username and email
    // Include password_hash in selection for verification
    let query = supabase
      .from("company_users")
      .select(`
        id,
        username,
        email,
        password_hash,
        access_type,
        status,
        company_id,
        companies!inner (
          id,
          business_ref_no,
          name,
          email,
          phone,
          address_line1,
          address_line2,
          state,
          postal_code,
          country,
          gstn,
          status
        )
       `)
      .or(`username.ilike.${normalizedUsername},email.ilike.${normalizedUsername}`);

    if (businessRefNo) {
      // @ts-ignore - postgrest filter on related table
      query = query.eq("companies.business_ref_no", businessRefNo);
    }

    const { data: userData, error: userError } = await query.single();

    if (userError || !userData) {
      console.log(`User not found - Business: ${businessRefNo}, Username: ${normalizedUsername}, Error: ${userError?.message}`);
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user account is active (using status field)
    if (userData.status !== 'ACTIVE') {
      console.log(`User account blocked - User: ${userData.email}, Status: ${userData.status}`);
      return new Response(
        JSON.stringify({ error: "User account is blocked. Please contact your administrator." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`User found: ${userData.email}, verifying password...`);

    // Verify password with legacy compatibility
    const passwordMatches = await verifyPassword(trimmedPassword, userData.password_hash);
    if (!passwordMatches) {
      console.log(`Password mismatch for user: ${userData.email}`);
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Password verified for user: ${userData.email}`);

    // If password was stored as plaintext, upgrade it to hashed
    if (!isHashedPassword(userData.password_hash)) {
      console.log(`Upgrading legacy password for user: ${userData.email}`);
      const newHash = await hashPassword(trimmedPassword);
      await supabase
        .from("company_users")
        .update({ password_hash: newHash })
        .eq("id", userData.id);
      console.log(`Password upgraded to SHA-256 for user: ${userData.email}`);
    }

    // Check if company status is valid
    const company = userData.companies;
    if (company.status !== 'active') {
      console.log(`Company inactive for user: ${userData.email}, status: ${company.status}`);
      return new Response(
        JSON.stringify({ error: "Company account suspended. Please contact support." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Company active for user: ${userData.email}, provisioning auth user...`);

    // Ensure an auth user exists with this email and can sign in immediately
    const mapRoleToProfile = (accessType: string) => (accessType === 'ADMIN' || accessType === 'OWNER' ? 'admin' : 'staff');

    let authUserId: string | null = null;

    // Try creating the user first
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: trimmedPassword,
      email_confirm: true,
      user_metadata: {
        invited_via: 'business-signin',
        company_id: userData.company_id,
        app_role: mapRoleToProfile(userData.access_type),
      },
    });

    if (created?.user) {
      authUserId = created.user.id;
      console.log(`Auth user created for: ${userData.email}`);
    } else if (createErr?.message?.includes('already been registered') || createErr?.message?.includes('already registered')) {
      // Find existing user by listing and matching email
      console.log(`User already exists, finding and updating: ${userData.email}`);
      const { data: users, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listErr) {
        console.error('Error listing users:', listErr);
        return new Response(JSON.stringify({ error: 'Failed to access auth users' }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const existing = users?.users?.find((u: any) => u.email === userData.email);
      if (!existing) {
        console.error(`Auth user not found for: ${userData.email}`);
        return new Response(JSON.stringify({ error: 'Auth user not found and cannot be created' }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      authUserId = existing.id;
      const { error: updateErr } = await supabase.auth.admin.updateUserById(authUserId, { 
        email_confirm: true, 
        password: trimmedPassword 
      });
      if (updateErr) {
        console.error('Error updating existing auth user:', updateErr);
        return new Response(JSON.stringify({ error: 'Failed to update auth user' }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      console.log(`Auth user updated for: ${userData.email}`);
    } else if (createErr) {
      console.error('Unexpected error creating auth user:', createErr);
      return new Response(JSON.stringify({ error: createErr.message || 'Failed to create auth user' }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Ensure profile is linked
    console.log(`Upserting profile for user: ${userData.email}`);
    await supabase.from('profiles').upsert({
      user_id: authUserId!,
      company_id: userData.company_id,
      role: mapRoleToProfile(userData.access_type),
      is_active: true,
    }, { onConflict: 'user_id' });

    console.log(`Signin successful for: ${userData.email}`);

    // Return success; frontend should now sign in via auth API
    const responseData = {
      success: true,
      user: { id: userData.id, email: userData.email },
      company: { id: company.id, businessRefNo: company.business_ref_no, status: company.status }
    };

    return new Response(
      JSON.stringify(responseData),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Signin error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});