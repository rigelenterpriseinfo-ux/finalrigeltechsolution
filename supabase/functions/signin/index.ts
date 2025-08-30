import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SigninRequest {
  businessRefNo: string;
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

// Helper function to generate session token
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

    if (!businessRefNo || !username || !password) {
      return new Response(
        JSON.stringify({ error: "Business ID, username, and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Hash the provided password
    const passwordHash = await hashPassword(password);

    // Find the company and user
    const { data: userData, error: userError } = await supabase
      .from("company_users")
      .select(`
        id,
        username,
        email,
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
      .eq("username", username)
      .eq("password_hash", passwordHash)
      .eq("companies.business_ref_no", businessRefNo)
      .eq("status", "ACTIVE")
      .single();

    if (userError || !userData) {
      // Log failed login attempt (you could implement rate limiting here)
      console.log(`Failed login attempt - Business: ${businessRefNo}, Username: ${username}`);
      
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if company status is valid (assuming companies have status instead of payment_status)
    const company = userData.companies;
    if (company.status !== 'active') {
      return new Response(
        JSON.stringify({ error: "Company account suspended. Please contact support." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate session token (in a real app, you'd store this in a sessions table)
    const sessionToken = generateSessionToken();

    // Return user and company data
    const responseData = {
      success: true,
      sessionToken,
      user: {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        accessType: userData.access_type,
        status: userData.status
      },
      company: {
        id: company.id,
        businessRefNo: company.business_ref_no,
        name: company.name,
        email: company.email,
        phone: company.phone,
        address: {
          line1: company.address_line1,
          line2: company.address_line2,
          state: company.state,
          postal: company.postal_code,
          country: company.country
        },
        gstin: company.gstin,
        status: company.status
      }
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