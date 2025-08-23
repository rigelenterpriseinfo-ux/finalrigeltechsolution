import DOMPurify from 'dompurify';
import { z } from 'zod';

// Input validation schemas
export const emailSchema = z.string().email("Invalid email address").max(254);
export const passwordSchema = z.string().min(8, "Password must be at least 8 characters");
export const nameSchema = z.string().min(1, "Name is required").max(100, "Name too long");
export const phoneSchema = z.string().regex(/^[\+]?[1-9][\d]{0,15}$/, "Invalid phone number").optional();
export const otpSchema = z.string().length(6, "OTP must be 6 digits").regex(/^\d+$/, "OTP must contain only numbers");

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

// Rate limiting helper
export const checkRateLimit = async (
  supabase: any,
  identifier: string,
  maxAttempts: number = 5,
  windowMinutes: number = 15
): Promise<{ allowed: boolean; resetTime?: Date }> => {
  try {
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
    
    const { data, error } = await supabase
      .from('auth_rate_limits')
      .select('*')
      .eq('ip_address', identifier)
      .gte('last_attempt', windowStart.toISOString())
      .single();

    if (error && error.code !== 'PGRST116') { // Not found is ok
      return { allowed: true };
    }

    if (!data) {
      // First attempt, record it
      await supabase
        .from('auth_rate_limits')
        .insert({
          ip_address: identifier,
          attempt_count: 1,
          last_attempt: new Date().toISOString()
        });
      return { allowed: true };
    }

    if (data.attempt_count >= maxAttempts) {
      return { 
        allowed: false, 
        resetTime: new Date(new Date(data.last_attempt).getTime() + windowMinutes * 60 * 1000)
      };
    }

    // Increment attempt count
    await supabase
      .from('auth_rate_limits')
      .update({
        attempt_count: data.attempt_count + 1,
        last_attempt: new Date().toISOString()
      })
      .eq('id', data.id);

    return { allowed: true };
  } catch (error) {
    // On error, allow the request (fail open)
    return { allowed: true };
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