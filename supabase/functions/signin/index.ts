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

    // Find the business and user
    const { data: userData, error: userError } = await supabase
      .from("gated_business_users")
      .select(`
        id,
        username,
        email,
        access_type,
        status,
        business_id,
        gated_businesses!inner (
          id,
          business_ref_no,
          name,
          email,
          phone,
          addr_line1,
          addr_line2,
          state,
          pin_code,
          country,
          business_type,
          industry_type,
          gstin,
          payment_status
        )
      `)
      .eq("username", username)
      .eq("password_hash", passwordHash)
      .eq("gated_businesses.business_ref_no", businessRefNo)
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

    // Check if business payment status is valid
    const business = userData.gated_businesses;
    if (business.payment_status !== 'PAID') {
      return new Response(
        JSON.stringify({ error: "Business account suspended. Please contact support." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate session token (in a real app, you'd store this in a sessions table)
    const sessionToken = generateSessionToken();

    // Return user and business data
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
      business: {
        id: business.id,
        businessRefNo: business.business_ref_no,
        name: business.name,
        email: business.email,
        phone: business.phone,
        address: {
          line1: business.addr_line1,
          line2: business.addr_line2,
          state: business.state,
          pin: business.pin_code,
          country: business.country
        },
        businessType: business.business_type,
        industryType: business.industry_type,
        gstin: business.gstin,
        paymentStatus: business.payment_status
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