import { z } from 'zod';

// Industry-standard validation patterns
const phoneRegex = /^(\+91[\s-]?)?[6-9]\d{9}$/;
const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const pincodeRegex = /^[1-9][0-9]{5}$/;
const urlRegex = /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&=]*)$/;
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Custom validation messages
const messages = {
  phone: 'Enter a valid 10-digit Indian mobile number (e.g., 9876543210 or +91-9876543210)',
  email: 'Enter a valid business email address',
  gstin: 'Enter a valid 15-character GSTIN (e.g., 22AAAAA0000A1Z5)',
  pan: 'Enter a valid PAN number (e.g., ABCDE1234F)',
  ifsc: 'Enter a valid IFSC code (e.g., SBIN0001234)',
  pincode: 'Enter a valid 6-digit PIN code',
  website: 'Enter a valid website URL (e.g., https://example.com)',
  required: 'This field is required',
  bankAccount: 'Account number must be 9-18 digits'
};

export const supplierValidationSchema = z.object({
  // Basic Information
  supplier_ref: z.string().optional(),
  name: z.string()
    .min(2, 'Supplier name must be at least 2 characters')
    .max(100, 'Supplier name cannot exceed 100 characters')
    .trim(),
  supplier_type: z.string().optional(),
  contact_person: z.string()
    .max(50, 'Contact person name cannot exceed 50 characters')
    .optional(),

  // Contact Details
  phone: z.string()
    .optional()
    .refine((val) => !val || phoneRegex.test(val.replace(/[\s-]/g, '')), {
      message: messages.phone
    }),
  email: z.string()
    .optional()
    .refine((val) => !val || emailRegex.test(val), {
      message: messages.email
    }),
  website: z.string()
    .optional()
    .refine((val) => !val || urlRegex.test(val), {
      message: messages.website
    }),

  // Address Details
  address_line1: z.string().max(100).optional(),
  address_line2: z.string().max(100).optional(),
  city: z.string().max(50).optional(),
  state: z.string().max(50).optional(),
  country: z.string().max(50).optional(),
  pin_code: z.string()
    .optional()
    .refine((val) => !val || pincodeRegex.test(val), {
      message: messages.pincode
    }),

  // Business & Tax Details
  gst_number: z.string()
    .optional()
    .refine((val) => !val || gstinRegex.test(val.toUpperCase()), {
      message: messages.gstin
    }),
  tax_id: z.string().optional(),
  pan_number: z.string()
    .optional()
    .refine((val) => !val || panRegex.test(val.toUpperCase()), {
      message: messages.pan
    }),
  business_registration_no: z.string().max(50).optional(),
  preferred_currency: z.string().optional(),
  payment_terms: z.string().optional(),

  // Banking Details
  bank_name: z.string().max(100).optional(),
  branch_name: z.string().max(100).optional(),
  account_number: z.string()
    .optional()
    .refine((val) => !val || (val.length >= 9 && val.length <= 18 && /^\d+$/.test(val)), {
      message: messages.bankAccount
    }),
  ifsc_code: z.string()
    .optional()
    .refine((val) => !val || ifscRegex.test(val.toUpperCase()), {
      message: messages.ifsc
    }),
  swift_code: z.string()
    .max(11)
    .optional()
    .refine((val) => !val || /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(val.toUpperCase()), {
      message: 'Enter a valid SWIFT code (8 or 11 characters)'
    }),

  // Status
  is_active: z.boolean().optional(),
});

export type SupplierFormData = z.infer<typeof supplierValidationSchema>;

// Formatting helpers
export const formatPhone = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{5})(\d{5})/, '$1-$2');
  }
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+91-${cleaned.slice(2).replace(/(\d{5})(\d{5})/, '$1-$2')}`;
  }
  return value;
};

export const formatGSTIN = (value: string): string => {
  return value.toUpperCase().replace(/(.{2})(.{5})(.{4})(.{1})(.{1})(.{1})(.{1})/, '$1$2$3$4$5$6$7');
};

export const formatPAN = (value: string): string => {
  return value.toUpperCase();
};

export const formatIFSC = (value: string): string => {
  return value.toUpperCase();
};

export const formatPincode = (value: string): string => {
  return value.replace(/\D/g, '').slice(0, 6);
};