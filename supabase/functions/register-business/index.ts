import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RegisterBusinessRequest {
  businessDetails: {
    name: string;
    email: string;
    phone: string;
    addrLine1: string;
    addrLine2?: string;
    state: string;
    pinCode: string;
    country: string;
    businessType: string;
    industryType: string;
    gstin?: string;
  };
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

// Validation functions
function validateUsername(username: string): boolean {
  const regex = /^[A-Za-z][A-Za-z0-9._]{3,19}$/;
  return regex.test(username);
}

function validatePassword(password: string): boolean {
  // At least 8 characters, includes uppercase, lowercase, number, symbol
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return regex.test(password);
}

function validateEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function validatePhone(phone: string): boolean {
  // E.164 format validation (simplified)
  const regex = /^\+[1-9]\d{1,14}$/;
  return regex.test(phone);
}

function validateGSTIN(gstin: string): boolean {
  if (!gstin) return true; // Optional field
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/;
  return regex.test(gstin) && gstin.length === 15;
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
    const { businessDetails, username, password }: RegisterBusinessRequest = await req.json();

    // Validate required fields
    if (!businessDetails || !username || !password) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate business details
    const {
      name, email, phone, addrLine1, state, pinCode, country,
      businessType, industryType, gstin, addrLine2
    } = businessDetails;

    if (!name || !email || !phone || !addrLine1 || !state || !pinCode || 
        !country || !businessType || !industryType) {
      return new Response(
        JSON.stringify({ error: "Missing required business details" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate formats
    if (!validateUsername(username)) {
      return new Response(
        JSON.stringify({ error: "Invalid username format. Must be 4-20 characters, start with letter, contain only letters, numbers, dots, and underscores." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!validatePassword(password)) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 8 characters with uppercase, lowercase, number, and special character." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!validateEmail(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!validatePhone(phone)) {
      return new Response(
        JSON.stringify({ error: "Invalid phone format. Use E.164 format (e.g., +1234567890)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!validateGSTIN(gstin || "")) {
      return new Response(
        JSON.stringify({ error: "Invalid GSTIN format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Check if registration request already exists for this email
    const { data: existingRequest, error: checkError } = await supabase
      .from("business_registration_requests")
      .select("id, status")
      .eq("business_email", email)
      .limit(1);

    if (checkError) {
      console.error("Registration check error:", checkError);
      return new Response(
        JSON.stringify({ error: "Registration validation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (existingRequest && existingRequest.length > 0) {
      const status = existingRequest[0].status;
      if (status === 'pending') {
        return new Response(
          JSON.stringify({ error: "A registration request with this email is already pending approval" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (status === 'approved') {
        return new Response(
          JSON.stringify({ error: "This business is already registered. Please use the sign-in page." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create registration request (pending super admin approval)
    const { data: requestData, error: requestError } = await supabase
      .from("business_registration_requests")
      .insert({
        business_name: name,
        business_email: email,
        business_phone: phone,
        address_line1: addrLine1,
        address_line2: addrLine2 || null,
        state,
        postal_code: pinCode,
        country,
        gstin: gstin || null,
        business_type: businessType,
        industry_type: industryType,
        admin_username: username,
        admin_password_hash: passwordHash,
        status: 'pending'
      })
      .select()
      .single();

    if (requestError) {
      console.error("Registration request creation error:", requestError);
      return new Response(
        JSON.stringify({ error: "Failed to submit registration request" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        requestId: requestData.id,
        message: "Registration request submitted successfully. Your request is pending approval."
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Register business error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});