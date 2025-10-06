import { supabase } from "@/integrations/supabase/client";

// GSTIN state code to state name mapping
const GSTIN_STATE_CODES: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh", 
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "25": "Daman and Diu",
  "26": "Dadra and Nagar Haveli",
  "27": "Maharashtra",
  "28": "Andhra Pradesh",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh"
};

export interface GSTINOption {
  gstin: string;
  stateName: string;
  stateCode: string;
  displayText: string;
}

/**
 * Validates GSTIN format
 */
export function isValidGSTIN(gstin: string): boolean {
  if (!gstin || gstin.length !== 15) return false;
  
  // Basic GSTIN format: 2 digits (state) + 10 alphanumeric + 1 check digit + 1 alpha + 1 alphanumeric
  const gstinRegex = /^[0-9]{2}[A-Z0-9]{10}[0-9][A-Z][0-9A-Z]$/;
  return gstinRegex.test(gstin);
}

/**
 * Extracts state information from GSTIN
 */
export function getStateFromGSTIN(gstin: string): { code: string; name: string } | null {
  if (!isValidGSTIN(gstin)) return null;
  
  const stateCode = gstin.substring(0, 2);
  const stateName = GSTIN_STATE_CODES[stateCode];
  
  if (!stateName) return null;
  
  return { code: stateCode, name: stateName };
}

/**
 * Formats GSTIN for display with state information
 */
export function formatGSTINDisplay(gstin: string): string {
  const stateInfo = getStateFromGSTIN(gstin);
  if (!stateInfo) return gstin;
  
  return `${gstin} (${stateInfo.code}-${stateInfo.name})`;
}

/**
 * Fetches all unique GSTIN values from companies and customers tables
 */
export async function fetchGSTINOptions(): Promise<GSTINOption[]> {
  try {
    // Fetch from companies table (column: gstn)
    const { data: companyGSTINs, error: companyError } = await supabase
      .from('companies')
      .select('gstn')
      .not('gstn', 'is', null)
      .neq('gstn', '');

    if (companyError) {
      console.error('Error fetching company GSTINs:', companyError);
    }

    // Fetch from customers_safe view (secure)
    const { data: customerGSTINs, error: customerError } = await supabase
      .from('customers_safe')
      .select('gstin')
      .not('gstin', 'is', null)
      .neq('gstin', '');

    if (customerError) {
      console.error('Error fetching customer GSTINs:', customerError);
    }

    // Combine and deduplicate GSTINs
    const allGSTINs = new Set<string>();
    
    if (companyGSTINs) {
      companyGSTINs.forEach(item => {
        if (item.gstn) allGSTINs.add(item.gstn);
      });
    }
    
    if (customerGSTINs) {
      customerGSTINs.forEach(item => {
        if (item.gstin) allGSTINs.add(item.gstin);
      });
    }

    // Convert to GSTINOption format
    const gstinOptions: GSTINOption[] = Array.from(allGSTINs)
      .filter(gstin => isValidGSTIN(gstin))
      .map(gstin => {
        const stateInfo = getStateFromGSTIN(gstin);
        return {
          gstin,
          stateCode: stateInfo?.code || '',
          stateName: stateInfo?.name || 'Unknown State',
          displayText: formatGSTINDisplay(gstin)
        };
      })
      .sort((a, b) => a.displayText.localeCompare(b.displayText));

    return gstinOptions;
  } catch (error) {
    console.error('Error fetching GSTIN options:', error);
    return [];
  }
}

/**
 * Gets the primary company's state for place of supply
 */
export async function getCompanyPlaceOfSupply(): Promise<string> {
  try {
    const { data: company, error } = await supabase
      .from('companies')
      .select('gstn, state')
      .limit(1)
      .single();

    if (error || !company) {
      console.error('Error fetching company data:', error);
      return '29-Karnataka'; // Fallback
    }

    // Try to get state from GSTIN first
    if (company.gstn && isValidGSTIN(company.gstn)) {
      const stateInfo = getStateFromGSTIN(company.gstn);
      if (stateInfo) {
        return `${stateInfo.code}-${stateInfo.name}`;
      }
    }

    // Fallback to state field if available
    if (company.state) {
      // Find state code by name
      const stateEntry = Object.entries(GSTIN_STATE_CODES).find(
        ([code, name]) => name.toLowerCase() === company.state.toLowerCase()
      );
      if (stateEntry) {
        return `${stateEntry[0]}-${stateEntry[1]}`;
      }
    }

    return '29-Karnataka'; // Final fallback
  } catch (error) {
    console.error('Error getting company place of supply:', error);
    return '29-Karnataka'; // Fallback
  }
}