import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const allowedOrigins = [
  'https://63be031f-eceb-4ef8-a148-241fcdfde80c.lovableproject.com',
  'http://localhost:3000',
  'http://localhost:5173',
];

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    ...securityHeaders,
  };
}

interface SendOtpRequest {
  email: string;
  purpose: string;
}

// Helper function to generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper function to hash OTP
async function hashOTP(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { email, purpose }: SendOtpRequest = await req.json();

    if (!email || !purpose) {
      return new Response(
        JSON.stringify({ error: "Email and purpose are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Check rate limiting - max 3 OTPs per hour per email
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentOtps, error: countError } = await supabase
      .from("email_otps")
      .select("id")
      .eq("email", email)
      .gte("created_at", oneHourAgo);

    if (countError) {
      console.error("Rate limit check error:", countError);
      return new Response(
        JSON.stringify({ error: "Failed to check rate limits" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (recentOtps && recentOtps.length >= 3) {
      // Log security event for rate limit hit
      await supabase.from('security_audit_log').insert({
        action: 'otp_rate_limit_exceeded',
        details: { email, attempt_count: recentOtps.length },
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        severity: 'medium'
      });
      
      return new Response(
        JSON.stringify({ error: "Too many OTP requests. Please try again in an hour." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate OTP and hash it
    const otp = generateOTP();
    const otpHash = await hashOTP(otp);

    // Store OTP in database (expires in 3 minutes)
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();
    const { error: insertError } = await supabase
      .from("email_otps")
      .insert({
        email,
        otp_hash: otpHash,
        expires_at: expiresAt,
        attempt_count: 0
      });

    if (insertError) {
      console.error("OTP storage error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to generate OTP" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send OTP via Supabase Auth email
    try {
      const { data: emailData, error: emailError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: email,
        options: {
          data: {
            otp_code: otp,
            purpose: purpose,
            expires_in: '3 minutes'
          }
        }
      });

      if (emailError) {
        console.error("Supabase email error:", emailError);
        throw emailError;
      }

      console.log("Email sent successfully via Supabase");
      
      // Log successful OTP generation
      await supabase.from('security_audit_log').insert({
        action: 'otp_sent',
        details: { email, purpose },
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        severity: 'low'
      });
    } catch (emailError) {
      console.error("Email sending error:", emailError);
      return new Response(
        JSON.stringify({ error: "Failed to send email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "OTP sent successfully. Please check your email.",
        expiresIn: 180 // 3 minutes in seconds
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Send OTP error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});