import DOMPurify from 'dompurify';
import { z } from 'zod';

// Enhanced input validation schemas with security hardening
export const emailSchema = z.string()
  .email("Invalid email address")
  .max(254)
  .refine(email => {
    // Additional security checks
    const normalizedEmail = email.toLowerCase().trim();
    // Prevent common injection patterns
    const dangerousPatterns = [
      /[<>'"&]/,  // HTML/XML injection
      /javascript:/i,  // JavaScript injection
      /script/i,  // Script injection
      /eval\(/i,  // Code execution
      /on\w+=/i,  // Event handlers
    ];
    return !dangerousPatterns.some(pattern => pattern.test(normalizedEmail));
  }, "Invalid email format");

export const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password too long") // Prevent DoS via extremely long passwords
  .refine(password => {
    // Check for minimum complexity
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    return hasLower && hasUpper && hasNumber && hasSpecial;
  }, "Password must contain lowercase, uppercase, number, and special character");

export const nameSchema = z.string()
  .min(1, "Name is required")
  .max(100, "Name too long")
  .refine(name => {
    // Prevent injection and malicious patterns
    const trimmedName = name.trim();
    const dangerousPatterns = [
      /[<>'"&]/,  // HTML/XML injection
      /javascript:/i,  // JavaScript injection
      /script/i,  // Script injection
      /\0/,  // Null bytes
    ];
    return trimmedName.length > 0 && !dangerousPatterns.some(pattern => pattern.test(trimmedName));
  }, "Invalid name format");

export const phoneSchema = z.string()
  .regex(/^[\+]?[1-9][\d]{0,15}$/, "Invalid phone number")
  .optional();

export const otpSchema = z.string()
  .length(6, "OTP must be 6 digits")
  .regex(/^\d+$/, "OTP must contain only numbers");

// Sanitize HTML content to prevent XSS
export const sanitizeHtml = (content: string): string => {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href'],
    ALLOWED_URI_REGEXP: /^https?:\/\//,
  });
};

// Sanitize CSS to prevent CSS injection
export const sanitizeCss = (css: string): string => {
  // Remove dangerous CSS properties and functions
  const dangerous = [
    'expression',
    'javascript:',
    'data:',
    'vbscript:',
    'behavior:',
    'import',
    'url(',
    '@import',
    '-moz-binding',
    '-webkit-',
    'position:fixed',
    'position:absolute'
  ];
  
  let sanitized = css;
  dangerous.forEach(danger => {
    const regex = new RegExp(danger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    sanitized = sanitized.replace(regex, '');
  });
  
  return sanitized;
};

// Enhanced rate limiting helper with better security
export const checkRateLimit = async (
  supabase: any,
  identifier: string,
  maxAttempts: number = 5,
  windowMinutes: number = 15
): Promise<{ allowed: boolean; resetTime?: Date }> => {
  try {
    // Normalize and validate identifier
    const normalizedIdentifier = identifier.trim().toLowerCase();
    if (!emailSchema.safeParse(normalizedIdentifier).success) {
      console.warn('Invalid identifier for rate limiting:', identifier);
      return { allowed: false }; // Fail closed for invalid input
    }

    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
    
    const { data, error } = await supabase
      .from('auth_rate_limits')
      .select('*')
      .eq('email', normalizedIdentifier)
      .gte('last_attempt', windowStart.toISOString())
      .single();

    if (error && error.code !== 'PGRST116') { // Not found is ok
      console.warn('Rate limit check failed, failing closed:', error);
      return { allowed: false }; // Fail closed on error for security
    }

    if (!data) {
      // First attempt, record it
      try {
        await supabase
          .from('auth_rate_limits')
          .insert({
            email: normalizedIdentifier,
            attempt_count: 1,
            last_attempt: new Date().toISOString(),
            ip_address: '127.0.0.1' // In production, get real IP
          });
      } catch (insertError) {
        console.warn('Failed to record rate limit attempt:', insertError);
        // Still allow the request on first attempt even if logging fails
      }
      return { allowed: true };
    }

    if (data.attempt_count >= maxAttempts) {
      // Log the blocked attempt
      await logSecurityEvent(supabase, 'rate_limit_exceeded', { 
        email: normalizedIdentifier, 
        attempts: data.attempt_count,
        maxAttempts 
      });
      
      return { 
        allowed: false, 
        resetTime: new Date(new Date(data.last_attempt).getTime() + windowMinutes * 60 * 1000)
      };
    }

    // Increment attempt count
    try {
      await supabase
        .from('auth_rate_limits')
        .update({
          attempt_count: data.attempt_count + 1,
          last_attempt: new Date().toISOString()
        })
        .eq('id', data.id);
    } catch (updateError) {
      console.warn('Failed to update rate limit counter:', updateError);
      // Still allow the request even if counter update fails
    }

    return { allowed: true };
  } catch (error) {
    // On error, fail closed for security
    console.error('Rate limiting error, failing closed:', error);
    return { allowed: false };
  }
};

// Security audit logging
export const logSecurityEvent = async (
  supabase: any,
  action: string,
  details: Record<string, any> = {},
  userId?: string
) => {
  try {
    await supabase
      .from('security_audit_log')
      .insert({
        user_id: userId,
        action,
        details,
        ip_address: '127.0.0.1', // In production, get real IP
        user_agent: navigator.userAgent
      });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
};

// Validate numeric inputs to prevent SQL injection
export const sanitizeNumericInput = (value: any): number | null => {
  if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
    return value;
  }
  
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && isFinite(parsed)) {
      return parsed;
    }
  }
  
  return null;
};

// Generate secure random strings
export const generateSecureToken = (length: number = 32): string => {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};