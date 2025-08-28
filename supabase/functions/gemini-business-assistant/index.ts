import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, companyId } = await req.json();

    if (!GEMINI_API_KEY) {
      throw new Error('Google Gemini API key not configured');
    }

    // Initialize Supabase client with service role for database queries
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('Processing business query:', message);
    console.log('Company ID:', companyId);

    // Determine the type of query and generate appropriate SQL
    const queryAnalysis = await analyzeBusinessQuery(message);
    console.log('Query analysis:', queryAnalysis);

    let data = null;
    let queryResult = null;

    // Execute the appropriate database query based on the analysis
    if (queryAnalysis.queryType === 'sales_orders') {
      queryResult = await executeQuery(supabase, companyId, queryAnalysis, 'sales_orders');
    } else if (queryAnalysis.queryType === 'purchase_invoices') {
      queryResult = await executeQuery(supabase, companyId, queryAnalysis, 'purchase_invoices');
    } else if (queryAnalysis.queryType === 'customers') {
      queryResult = await executeQuery(supabase, companyId, queryAnalysis, 'customers');
    } else if (queryAnalysis.queryType === 'suppliers') {
      queryResult = await executeQuery(supabase, companyId, queryAnalysis, 'suppliers');
    } else if (queryAnalysis.queryType === 'products') {
      queryResult = await executeQuery(supabase, companyId, queryAnalysis, 'products');
    } else if (queryAnalysis.queryType === 'inventory') {
      queryResult = await executeInventoryQuery(supabase, companyId, queryAnalysis);
    } else {
      // General business insights
      queryResult = await getGeneralBusinessInsights(supabase, companyId);
    }

    if (queryResult.error) {
      throw new Error(`Database query failed: ${queryResult.error.message}`);
    }

    data = queryResult.data;

    // Generate AI response using Gemini
    const aiResponse = await generateGeminiResponse(message, data, queryAnalysis);

    return new Response(JSON.stringify({
      response: aiResponse,
      data: data,
      queryType: queryAnalysis.queryType,
      tableData: formatTableData(data, queryAnalysis.queryType)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in gemini-business-assistant:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      response: "I'm sorry, I encountered an error while processing your request. Please try again."
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function analyzeBusinessQuery(message: string) {
  const lowerMessage = message.toLowerCase();
  
  // Simple query classification
  if (lowerMessage.includes('sales order') || lowerMessage.includes('order')) {
    return {
      queryType: 'sales_orders',
      timeframe: extractTimeframe(lowerMessage),
      status: extractStatus(lowerMessage),
      limit: extractLimit(lowerMessage)
    };
  } else if (lowerMessage.includes('purchase') || lowerMessage.includes('invoice')) {
    return {
      queryType: 'purchase_invoices',
      timeframe: extractTimeframe(lowerMessage),
      status: extractStatus(lowerMessage),
      limit: extractLimit(lowerMessage)
    };
  } else if (lowerMessage.includes('customer')) {
    return {
      queryType: 'customers',
      limit: extractLimit(lowerMessage)
    };
  } else if (lowerMessage.includes('supplier') || lowerMessage.includes('vendor')) {
    return {
      queryType: 'suppliers',
      limit: extractLimit(lowerMessage)
    };
  } else if (lowerMessage.includes('product') || lowerMessage.includes('inventory') || lowerMessage.includes('stock')) {
    return {
      queryType: 'inventory',
      stockLevel: lowerMessage.includes('low stock') ? 'low' : null,
      limit: extractLimit(lowerMessage)
    };
  } else {
    return {
      queryType: 'general',
      limit: 10
    };
  }
}

function extractTimeframe(message: string) {
  if (message.includes('today')) return 1;
  if (message.includes('yesterday')) return 1;
  if (message.includes('last week') || message.includes('7 days')) return 7;
  if (message.includes('last month') || message.includes('30 days')) return 30;
  if (message.includes('last 15 days') || message.includes('15 days')) return 15;
  if (message.includes('last 3 months') || message.includes('90 days')) return 90;
  return null;
}

function extractStatus(message: string) {
  if (message.includes('pending')) return 'pending';
  if (message.includes('completed')) return 'completed';
  if (message.includes('draft')) return 'draft';
  if (message.includes('invoiced')) return 'invoiced';
  return null;
}

function extractLimit(message: string) {
  const match = message.match(/(\d+)/);
  return match ? Math.min(parseInt(match[1]), 50) : 10; // Max 50 results
}

async function executeQuery(supabase: any, companyId: string, analysis: any, table: string) {
  let query = supabase.from(table).select('*').eq('company_id', companyId);

  // Apply timeframe filter
  if (analysis.timeframe) {
    const dateField = table === 'sales_orders' ? 'order_date' : 
                     table === 'purchase_invoices' ? 'purchase_invoice_date' : 'created_at';
    const date = new Date();
    date.setDate(date.getDate() - analysis.timeframe);
    query = query.gte(dateField, date.toISOString().split('T')[0]);
  }

  // Apply status filter
  if (analysis.status) {
    query = query.eq('status', analysis.status);
  }

  // Apply limit and order
  query = query.order('created_at', { ascending: false }).limit(analysis.limit || 10);

  return await query;
}

async function executeInventoryQuery(supabase: any, companyId: string, analysis: any) {
  let query = supabase.from('products').select('*').eq('company_id', companyId);

  if (analysis.stockLevel === 'low') {
    // Products where stock_quantity <= min_stock_level
    query = query.filter('stock_quantity', 'lte', 'min_stock_level');
  }

  query = query.order('stock_quantity', { ascending: true }).limit(analysis.limit || 10);

  return await query;
}

async function getGeneralBusinessInsights(supabase: any, companyId: string) {
  // Get a summary of business data
  const [salesResult, purchaseResult, customerResult, productResult] = await Promise.all([
    supabase.from('sales_orders').select('id, total_amount, status').eq('company_id', companyId).limit(5),
    supabase.from('purchase_invoices').select('id, total_amount, status').eq('company_id', companyId).limit(5),
    supabase.from('customers').select('id, name').eq('company_id', companyId).limit(5),
    supabase.from('products').select('id, name, stock_quantity').eq('company_id', companyId).limit(5)
  ]);

  return {
    data: {
      sales_orders: salesResult.data || [],
      purchase_invoices: purchaseResult.data || [],
      customers: customerResult.data || [],
      products: productResult.data || []
    },
    error: null
  };
}

async function generateGeminiResponse(message: string, data: any, analysis: any) {
  const prompt = `You are a helpful business intelligence assistant. 
  
  User question: "${message}"
  
  Query results: ${JSON.stringify(data, null, 2)}
  
  Please provide a clear, concise response about the business data. Include:
  1. A direct answer to the user's question
  2. Key insights from the data
  3. Any notable patterns or recommendations
  
  Keep the response conversational and business-focused. If there's no data, mention that politely.`;

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + GEMINI_API_KEY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0.7
      }
    }),
  });

  const result = await response.json();
  console.log('Gemini API response:', result);
  
  if (result.candidates && result.candidates[0] && result.candidates[0].content) {
    return result.candidates[0].content.parts[0].text;
  } else {
    throw new Error('Invalid response from Gemini API');
  }
}

function formatTableData(data: any, queryType: string) {
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return null;
  }

  // Handle general insights data
  if (queryType === 'general' && data.sales_orders) {
    return {
      columns: ['Type', 'Count', 'Total Amount', 'Status'],
      rows: [
        ['Sales Orders', data.sales_orders.length, 
         data.sales_orders.reduce((sum: number, item: any) => sum + (item.total_amount || 0), 0).toLocaleString(), 
         'Various'],
        ['Purchase Invoices', data.purchase_invoices.length,
         data.purchase_invoices.reduce((sum: number, item: any) => sum + (item.total_amount || 0), 0).toLocaleString(),
         'Various'],
        ['Customers', data.customers.length, '-', 'Active'],
        ['Products', data.products.length, '-', 'In Stock']
      ]
    };
  }

  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  // Format based on query type
  switch (queryType) {
    case 'sales_orders':
      return {
        columns: ['Order #', 'Customer', 'Date', 'Amount', 'Status'],
        rows: data.map((item: any) => [
          item.order_number || 'N/A',
          item.customer_name || 'N/A',
          new Date(item.order_date).toLocaleDateString(),
          `₹${item.total_amount?.toLocaleString() || '0'}`,
          item.status || 'N/A'
        ])
      };

    case 'purchase_invoices':
      return {
        columns: ['Invoice #', 'Supplier', 'Date', 'Amount', 'Status'],
        rows: data.map((item: any) => [
          item.purchase_invoice_number || 'N/A',
          item.supplier_id || 'N/A',
          new Date(item.purchase_invoice_date).toLocaleDateString(),
          `₹${item.total_amount?.toLocaleString() || '0'}`,
          item.status || 'N/A'
        ])
      };

    case 'customers':
      return {
        columns: ['Name', 'Email', 'Phone', 'City', 'Status'],
        rows: data.map((item: any) => [
          item.name || 'N/A',
          item.email || 'N/A',
          item.phone || 'N/A',
          item.city || 'N/A',
          item.is_active ? 'Active' : 'Inactive'
        ])
      };

    case 'suppliers':
      return {
        columns: ['Name', 'Contact Person', 'Email', 'Phone', 'City'],
        rows: data.map((item: any) => [
          item.name || 'N/A',
          item.contact_person || 'N/A',
          item.email || 'N/A',
          item.phone || 'N/A',
          item.city || 'N/A'
        ])
      };

    case 'inventory':
      return {
        columns: ['Product Name', 'SKU', 'Stock Qty', 'Min Level', 'Unit Price'],
        rows: data.map((item: any) => [
          item.name || 'N/A',
          item.sku || 'N/A',
          item.stock_quantity?.toString() || '0',
          item.min_stock_level?.toString() || '0',
          `₹${item.unit_price?.toLocaleString() || '0'}`
        ])
      };

    default:
      return null;
  }
}