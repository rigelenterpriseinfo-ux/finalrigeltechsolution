import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  FileSpreadsheet, 
  FileText, 
  Download, 
  ChevronDown, 
  ChevronRight,
  Calendar as CalendarIcon,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Package,
  ShoppingCart,
  FileBarChart,
  PieChart as LucidePieChart,
  BarChart3,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  RefreshCw
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { toast } from "sonner";
import { ProductSelector } from '@/components/ui/product-selector';
import { fetchGSTINOptions, getCompanyPlaceOfSupply, type GSTINOption } from '@/lib/gstinUtils';

interface ReportCategory {
  id: string;
  name: string;
  icon: React.ElementType;
  reports: Report[];
}

interface Report {
  id: string;
  name: string;
  description: string;
  category: string;
  requiresFilters?: string[];
  dataFields?: string[];
}

interface FilterState {
  dateRange: {
    from: Date;
    to: Date;
  };
  customer?: string;
  vendor?: string;
  gstin?: string;
  state?: string;
  status?: string;
  product?: string;
}

const CHART_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];

const reportCategories: ReportCategory[] = [
  {
    id: 'finance',
    name: 'Finance & Compliance',
    icon: FileBarChart,
    reports: [
      { id: 'ar_aging', name: 'AR Aging', description: 'Accounts Receivable aging analysis', category: 'finance', requiresFilters: ['dateRange'], dataFields: ['customer', 'amount', 'daysOutstanding'] },
      { id: 'ap_aging', name: 'AP Aging', description: 'Accounts Payable aging analysis', category: 'finance', requiresFilters: ['dateRange'], dataFields: ['vendor', 'amount', 'daysOutstanding'] },
      { id: 'net_arap', name: 'Net AR/AP Position', description: 'Net position of receivables vs payables', category: 'finance', requiresFilters: ['dateRange'] },
      { id: 'gstr1', name: 'GSTR-1', description: 'Outward supplies report', category: 'finance', requiresFilters: ['dateRange', 'gstin'] },
      { id: 'gstr3b', name: 'GSTR-3B', description: 'Monthly return filing', category: 'finance', requiresFilters: ['dateRange', 'gstin'] },
      { id: 'gstr2b', name: 'GSTR-2B Reconciliation', description: 'Auto-drafted ITC reconciliation', category: 'finance', requiresFilters: ['dateRange', 'gstin'] },
      { id: 'rcm_report', name: 'RCM Report', description: 'Reverse Charge Mechanism report', category: 'finance', requiresFilters: ['dateRange'] },
      { id: 'credit_debit_notes', name: 'Credit/Debit Notes', description: 'Credit and debit notes summary', category: 'finance', requiresFilters: ['dateRange'] },
      { id: 'hsn_tax_summary', name: 'HSN / Tax Summary', description: 'HSN-wise tax summary', category: 'finance', requiresFilters: ['dateRange'] },
      { id: 'eway_reconciliation', name: 'E-Way Bill Reconciliation', description: 'E-way bill vs invoice reconciliation', category: 'finance', requiresFilters: ['dateRange'] },
      { id: 'gstr9', name: 'GSTR-9 (Annual Return)', description: 'Annual GST return', category: 'finance', requiresFilters: ['dateRange'] }
    ]
  },
  {
    id: 'sales',
    name: 'Sales & Procurement',
    icon: ShoppingCart,
    reports: [
      { id: 'sales_orders', name: 'Sales Orders', description: 'Sales orders analysis', category: 'sales', requiresFilters: ['dateRange'], dataFields: ['orderNumber', 'customer', 'amount', 'status'] },
      { id: 'customer_sales', name: 'Customer Sales', description: 'Customer-wise sales analysis', category: 'sales', requiresFilters: ['dateRange'], dataFields: ['customer', 'totalSales', 'orderCount'] },
      { id: 'item_wise_sales', name: 'Item wise Sales Report', description: 'Product-wise sales analysis with quantities and revenue', category: 'sales', requiresFilters: ['dateRange', 'product'], dataFields: ['product', 'quantitySold', 'totalRevenue', 'avgPrice'] },
      { id: 'purchase_orders', name: 'Purchase Orders', description: 'Purchase orders analysis', category: 'sales', requiresFilters: ['dateRange'], dataFields: ['orderNumber', 'vendor', 'amount', 'status'] },
      { id: 'vendor_purchases', name: 'Vendor Purchases', description: 'Vendor-wise purchase analysis', category: 'sales', requiresFilters: ['dateRange'], dataFields: ['vendor', 'totalPurchases', 'orderCount'] },
      { id: 'item_wise_purchase', name: 'Item wise Purchase Report', description: 'Product-wise purchase analysis with quantities and costs', category: 'sales', requiresFilters: ['dateRange'], dataFields: ['product', 'quantityPurchased', 'totalCost', 'avgPrice'] },
      { id: 'quotation_comparison', name: 'Quotation Comparison', description: 'Vendor quotation comparison', category: 'sales', requiresFilters: ['dateRange'] }
    ]
  },
  {
    id: 'inventory',
    name: 'Inventory & Production',
    icon: Package,
    reports: [
      { id: 'current_stock', name: 'Current Stock', description: 'Current stock levels', category: 'inventory', dataFields: ['product', 'currentStock', 'minStock', 'maxStock'] },
      { id: 'stock_movement', name: 'Stock Movement / Ledger', description: 'Stock movement transactions', category: 'inventory', requiresFilters: ['dateRange'], dataFields: ['product', 'transaction', 'quantity', 'balance'] },
      { id: 'stock_aging', name: 'Stock Aging', description: 'Stock aging analysis', category: 'inventory', dataFields: ['product', 'age', 'quantity', 'value'] },
      { id: 'reorder_report', name: 'Reorder Report', description: 'Items requiring reorder', category: 'inventory', dataFields: ['product', 'currentStock', 'reorderLevel', 'suggestedOrder'] },
      { id: 'bom_consumption', name: 'BOM Consumption', description: 'Bill of materials consumption', category: 'inventory', requiresFilters: ['dateRange'], dataFields: ['product', 'consumed', 'cost'] },
      { id: 'yield_report', name: 'Yield Report', description: 'Production yield analysis', category: 'inventory', requiresFilters: ['dateRange'], dataFields: ['product', 'produced', 'yield'] }
    ]
  }
];

export function EnhancedReportsModule() {
  const { hasAccess, loading: authLoading } = useBusinessAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>('finance');
  const [selectedReport, setSelectedReport] = useState<string>('ar_aging');
  const [openCategories, setOpenCategories] = useState<string[]>(['finance']);
  const [filters, setFilters] = useState<FilterState>({
    dateRange: {
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date())
    },
    product: 'all'
  });
  const [reportData, setReportData] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [invoiceWiseData, setInvoiceWiseData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [gstinOptions, setGstinOptions] = useState<GSTINOption[]>([]);
  const [isLoadingGSTIN, setIsLoadingGSTIN] = useState(false);
  const [companyPlaceOfSupply, setCompanyPlaceOfSupply] = useState<string>('29-Karnataka');

  // Load GSTIN data when needed
  const loadGSTINData = async () => {
    setIsLoadingGSTIN(true);
    try {
      const [gstins, placeOfSupply] = await Promise.all([
        fetchGSTINOptions(),
        getCompanyPlaceOfSupply()
      ]);
      setGstinOptions(gstins);
      setCompanyPlaceOfSupply(placeOfSupply);
    } catch (error) {
      console.error('Error loading GSTIN data:', error);
      toast.error("Failed to load GSTIN data. Please try again.");
    } finally {
      setIsLoadingGSTIN(false);
    }
  };

  // Get current report
  const currentReport = reportCategories
    .flatMap(cat => cat.reports)
    .find(report => report.id === selectedReport);

  // Load GSTIN data when reports requiring GSTIN are selected
  useEffect(() => {
    if (currentReport && ['gstr1', 'gstr3b', 'hsnSummary'].includes(currentReport.id)) {
      loadGSTINData();
    }
  }, [currentReport]);

  // Use React Query for real-time data fetching
  const { data: reportResult, isLoading, error, refetch } = useQuery({
    queryKey: ['report', selectedReport, filters],
    queryFn: () => generateReportData(selectedReport, filters),
    enabled: !authLoading && hasAccess('reports'),
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
    staleTime: 10000, // Consider data stale after 10 seconds
  });

  const queryClient = useQueryClient();

  // Manual refresh function
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['report'] });
    toast.success('Report data refreshed');
  };

  // Real-time data fetching functions
  const fetchARAgingData = async (filters: FilterState) => {
    const { data: invoices, error } = await supabase
      .from('sales_invoices')
      .select(`
        id, invoice_number, customer_name, total_amount, 
        invoice_date, status, customer_id,
        payments(amount, payment_date)
      `)
      .eq('status', 'finalized')
      .gte('invoice_date', format(filters.dateRange.from, 'yyyy-MM-dd'))
      .lte('invoice_date', format(filters.dateRange.to, 'yyyy-MM-dd'));

    if (error) throw error;

    const agingData = invoices?.map(invoice => {
      const totalPaid = invoice.payments?.reduce((sum: number, payment: any) => sum + payment.amount, 0) || 0;
      const outstandingAmount = invoice.total_amount - totalPaid;
      const daysOutstanding = differenceInDays(new Date(), new Date(invoice.invoice_date));
      
      return {
        customer: invoice.customer_name,
        invoiceNumber: invoice.invoice_number,
        amount: outstandingAmount,
        daysOutstanding,
        invoiceDate: invoice.invoice_date,
        current: daysOutstanding <= 0 ? outstandingAmount : 0,
        days30: daysOutstanding > 0 && daysOutstanding <= 30 ? outstandingAmount : 0,
        days60: daysOutstanding > 30 && daysOutstanding <= 60 ? outstandingAmount : 0,
        days90: daysOutstanding > 60 && daysOutstanding <= 90 ? outstandingAmount : 0,
        over90: daysOutstanding > 90 ? outstandingAmount : 0
      };
    }).filter(item => item.amount > 0) || [];

    // Invoice-wise data for export (detailed)
    const invoiceWiseData = agingData.map(item => ({
      'Customer/Vendor Name': item.customer,
      'Invoice No': item.invoiceNumber,
      'Invoice Date': format(new Date(item.invoiceDate), 'MMM dd, yyyy'),
      'Invoice Status': 'Outstanding',
      'Total Amount': item.amount + (invoices?.find(inv => inv.invoice_number === item.invoiceNumber)?.payments?.reduce((sum: number, payment: any) => sum + payment.amount, 0) || 0),
      'Pending Amount': item.amount,
      'Days30': item.days30,
      'Days60': item.days60,
      'Days90': item.days90,
      'Over90': item.over90
    }));

    // Group by customer for UI display (aggregated)
    const customerAging = agingData.reduce((acc: Record<string, any>, item) => {
      if (!acc[item.customer]) {
        acc[item.customer] = {
          customer: item.customer,
          current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0
        };
      }
      acc[item.customer].current += item.current;
      acc[item.customer].days30 += item.days30;
      acc[item.customer].days60 += item.days60;
      acc[item.customer].days90 += item.days90;
      acc[item.customer].over90 += item.over90;
      acc[item.customer].total += item.amount;
      return acc;
    }, {});

    const tableData = Object.values(customerAging);
    
    // Chart data
    const totals = tableData.reduce((acc: any, item: any) => ({
      current: acc.current + item.current,
      days30: acc.days30 + item.days30,
      days60: acc.days60 + item.days60,
      days90: acc.days90 + item.days90,
      over90: acc.over90 + item.over90
    }), { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 });

    const total = totals.current + totals.days30 + totals.days60 + totals.days90 + totals.over90;
    
    const chartData = [
      { name: 'Current', value: totals.current, percentage: total ? Math.round((totals.current / total) * 100) : 0 },
      { name: '1-30 Days', value: totals.days30, percentage: total ? Math.round((totals.days30 / total) * 100) : 0 },
      { name: '31-60 Days', value: totals.days60, percentage: total ? Math.round((totals.days60 / total) * 100) : 0 },
      { name: '61-90 Days', value: totals.days90, percentage: total ? Math.round((totals.days90 / total) * 100) : 0 },
      { name: '90+ Days', value: totals.over90, percentage: total ? Math.round((totals.over90 / total) * 100) : 0 }
    ];

    return { tableData, chartData, invoiceWiseData };
  };

  const fetchAPAgingData = async (filters: FilterState) => {
    // Get GRN data (actual goods received that need payment) instead of purchase orders
    const { data: grnData, error } = await supabase
      .from('grn_header')
      .select(`
        id, grn_number, total_amount, 
        grn_date, status, supplier_name, supplier_id,
        purchase_order_id
      `)
      .in('status', ['received', 'partially_received'])
      .gte('grn_date', format(filters.dateRange.from, 'yyyy-MM-dd'))
      .lte('grn_date', format(filters.dateRange.to, 'yyyy-MM-dd'));

    if (error) throw error;

    // Get payment data for GRNs and related purchase orders
    const grnIds = grnData?.map(grn => grn.id) || [];
    const purchaseOrderIds = grnData?.map(grn => grn.purchase_order_id).filter(Boolean) || [];
    let paymentsData: any[] = [];
    
    if (grnIds.length > 0 || purchaseOrderIds.length > 0) {
      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .or(`grn_id.in.(${grnIds.join(',')}),purchase_order_id.in.(${purchaseOrderIds.join(',')})`);
      
      paymentsData = payments || [];
    }

    const agingData = grnData?.map(grn => {
      // Calculate payments related to this GRN or its purchase order
      const relatedPayments = paymentsData.filter(payment => 
        payment.grn_id === grn.id || payment.purchase_order_id === grn.purchase_order_id
      );
      const advancePayments = relatedPayments.filter(p => p.payment_type === 'advance');
      const regularPayments = relatedPayments.filter(p => p.payment_type !== 'advance');
      
      const totalAdvancePayment = advancePayments.reduce((sum, payment) => sum + payment.amount, 0);
      const totalAmountReceived = regularPayments.reduce((sum, payment) => sum + payment.amount, 0);
      const totalPaid = totalAdvancePayment + totalAmountReceived;
      const outstandingAmount = grn.total_amount - totalPaid;
      const daysOutstanding = differenceInDays(new Date(), new Date(grn.grn_date));
      
      return {
        vendor: grn.supplier_name,
        orderNumber: grn.grn_number,
        amount: Math.max(0, outstandingAmount),
        totalAmount: grn.total_amount,
        daysOutstanding,
        orderDate: grn.grn_date,
        current: daysOutstanding <= 0 ? Math.max(0, outstandingAmount) : 0,
        days30: daysOutstanding > 0 && daysOutstanding <= 30 ? Math.max(0, outstandingAmount) : 0,
        days60: daysOutstanding > 30 && daysOutstanding <= 60 ? Math.max(0, outstandingAmount) : 0,
        days90: daysOutstanding > 60 && daysOutstanding <= 90 ? Math.max(0, outstandingAmount) : 0,
        over90: daysOutstanding > 90 ? Math.max(0, outstandingAmount) : 0
      };
    }).filter(item => item.amount > 0) || [];

    // Invoice-wise data for export (detailed)
    const invoiceWiseData = agingData.map(item => ({
      'Customer/Vendor Name': item.vendor,
      'Invoice No': item.orderNumber,
      'Invoice Date': format(new Date(item.orderDate), 'MMM dd, yyyy'),
      'Invoice Status': 'Outstanding',
      'Total Amount': item.totalAmount,
      'Pending Amount': item.amount,
      'Days30': item.days30,
      'Days60': item.days60,
      'Days90': item.days90,
      'Over90': item.over90
    }));

    // Group by vendor for UI display (aggregated)
    const vendorAging = agingData.reduce((acc: Record<string, any>, item) => {
      if (!acc[item.vendor]) {
        acc[item.vendor] = {
          vendor: item.vendor,
          current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0
        };
      }
      acc[item.vendor].current += item.current;
      acc[item.vendor].days30 += item.days30;
      acc[item.vendor].days60 += item.days60;
      acc[item.vendor].days90 += item.days90;
      acc[item.vendor].over90 += item.over90;
      acc[item.vendor].total += item.amount;
      return acc;
    }, {});

    const tableData = Object.values(vendorAging);
    
    const totals = tableData.reduce((acc: any, item: any) => ({
      current: acc.current + item.current,
      days30: acc.days30 + item.days30,
      days60: acc.days60 + item.days60,
      days90: acc.days90 + item.days90,
      over90: acc.over90 + item.over90
    }), { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 });

    const total = totals.current + totals.days30 + totals.days60 + totals.days90 + totals.over90;
    
    const chartData = [
      { name: 'Current', value: totals.current, percentage: total ? Math.round((totals.current / total) * 100) : 0 },
      { name: '1-30 Days', value: totals.days30, percentage: total ? Math.round((totals.days30 / total) * 100) : 0 },
      { name: '31-60 Days', value: totals.days60, percentage: total ? Math.round((totals.days60 / total) * 100) : 0 },
      { name: '61-90 Days', value: totals.days90, percentage: total ? Math.round((totals.days90 / total) * 100) : 0 },
      { name: '90+ Days', value: totals.over90, percentage: total ? Math.round((totals.over90 / total) * 100) : 0 }
    ];

    return { tableData, chartData, invoiceWiseData };
  };

  const fetchSalesOrdersData = async (filters: FilterState) => {
    const { data: orders, error } = await supabase
      .from('sales_orders')
      .select('*')
      .gte('order_date', format(filters.dateRange.from, 'yyyy-MM-dd'))
      .lte('order_date', format(filters.dateRange.to, 'yyyy-MM-dd'))
      .order('order_date', { ascending: false });

    if (error) throw error;

    const tableData = orders?.map(order => ({
      orderNumber: order.order_number,
      customer: order.account_manager || 'N/A',
      date: order.order_date,
      amount: order.total_amount,
      status: order.status
    })) || [];

    // Monthly aggregation for chart
    const monthlyData = orders?.reduce((acc: Record<string, any>, order) => {
      const month = format(new Date(order.order_date), 'MMM yyyy');
      if (!acc[month]) {
        acc[month] = { month, orders: 0, revenue: 0 };
      }
      acc[month].orders += 1;
      acc[month].revenue += order.total_amount || 0;
      return acc;
    }, {}) || {};

    const chartData = Object.values(monthlyData);

    return { tableData, chartData };
  };

  const fetchCurrentStockData = async () => {
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true);

    if (error) throw error;

    const tableData = products?.map(product => {
      const stockStatus = product.stock_quantity <= product.min_stock_level ? 'Low' :
                         product.stock_quantity >= (product.max_stock_level || product.min_stock_level * 10) ? 'Overstock' : 'Good';
      
      return {
        product: product.name,
        sku: product.sku,
        currentStock: product.stock_quantity,
        minStock: product.min_stock_level,
        maxStock: product.max_stock_level || product.min_stock_level * 10,
        value: product.stock_quantity * product.cost_price,
        costPrice: product.cost_price,
        status: stockStatus
      };
    }) || [];

    // Chart data by status
    const statusCounts = tableData.reduce((acc: Record<string, number>, item) => {
      acc[item.status] = (acc[item.status] || 0) + item.currentStock;
      return acc;
    }, {});

    const total = Object.values(statusCounts).reduce((sum: number, val: number) => sum + val, 0);
    
    const chartData = Object.entries(statusCounts).map(([status, value]: [string, number]) => ({
      name: status + ' Stock',
      value,
      percentage: total ? Math.round((value / total) * 100) : 0
    }));

    return { tableData, chartData };
  };

  const fetchCustomerSalesData = async (filters: FilterState) => {
    const { data: invoices, error } = await supabase
      .from('sales_invoices')
      .select('customer_name, total_amount, invoice_date, customer_id')
      .eq('status', 'finalized')
      .gte('invoice_date', format(filters.dateRange.from, 'yyyy-MM-dd'))
      .lte('invoice_date', format(filters.dateRange.to, 'yyyy-MM-dd'));

    if (error) throw error;

    const customerSales = invoices?.reduce((acc: Record<string, any>, invoice) => {
      if (!acc[invoice.customer_name]) {
        acc[invoice.customer_name] = {
          customer: invoice.customer_name,
          totalSales: 0,
          orderCount: 0,
          customerId: invoice.customer_id
        };
      }
      acc[invoice.customer_name].totalSales += invoice.total_amount;
      acc[invoice.customer_name].orderCount += 1;
      return acc;
    }, {}) || {};

    const tableData = Object.values(customerSales).sort((a: any, b: any) => b.totalSales - a.totalSales);
    
    const chartData = tableData.slice(0, 10).map((item: any) => ({
      name: item.customer,
      value: item.totalSales,
      orders: item.orderCount
    }));

    return { tableData, chartData };
  };

  const fetchGSTR1Data = async (filters: FilterState) => {
    // Build query with proper GSTIN filtering
    let query = supabase
      .from('sales_invoices')
      .select(`
        *, 
        sales_invoice_items(*),
        customers(gstin, customer_type)
      `)
      .eq('status', 'finalized')
      .gte('invoice_date', format(filters.dateRange.from, 'yyyy-MM-dd'))
      .lte('invoice_date', format(filters.dateRange.to, 'yyyy-MM-dd'));

    const { data: invoices, error } = await query;

    if (error) throw error;

    // Filter invoices based on selected GSTIN after fetching
    let filteredInvoices = invoices;
    if (filters.gstin && filters.gstin !== 'all') {
      // Check if selected GSTIN belongs to company
      const { data: company } = await supabase
        .from('companies')
        .select('gstn')
        .eq('gstn', filters.gstin)
        .maybeSingle();

      if (!company) {
        // If selected GSTIN is not company GSTIN, filter by customer GSTIN
        filteredInvoices = invoices?.filter(invoice => 
          invoice.customers?.gstin === filters.gstin
        ) || [];
      }
      // If it is company GSTIN, show all invoices (no additional filtering needed)
    }

    const b2bSupplies: any[] = [];
    const b2cLargeSupplies: any[] = [];
    const b2cSmallSupplies: any[] = [];
    const hsnSummary: Record<string, any> = {};
    const itemWiseData: any[] = []; // New: Item-level details for export
    let totalTaxableValue = 0;
    let totalTaxAmount = 0;

    filteredInvoices?.forEach(invoice => {
      const customerGSTIN = invoice.customers?.gstin;
      const customerType = invoice.customers?.customer_type;
      const invoiceValue = invoice.total_amount;
      const taxableValue = invoice.subtotal_amount;
      
      totalTaxableValue += taxableValue;
      totalTaxAmount += invoice.tax_amount;

      // Determine B2B/B2C classification
      // Business customer OR customer with GSTIN = B2B
      // Individual customer without GSTIN = B2C
      const isB2B = (customerType === 'Business' || (customerGSTIN && customerGSTIN.trim() !== ''));
      
      // Process each line item for detailed export
      invoice.sales_invoice_items?.forEach((item: any) => {
        const itemTaxableValue = (item.unit_price * item.quantity_invoiced) - (item.discount_amount || 0);
        const cgstAmount = item.cgst_amount || 0;
        const sgstAmount = item.sgst_amount || 0;
        const igstAmount = item.igst_amount || 0;
        const totalItemTax = cgstAmount + sgstAmount + igstAmount;
        const taxRate = itemTaxableValue > 0 ? ((totalItemTax / itemTaxableValue) * 100).toFixed(1) : '0';

        itemWiseData.push({
          customerName: invoice.customer_name,
          customerGSTIN: customerGSTIN || 'N/A',
          customerType: customerType || (isB2B ? 'Business' : 'Individual'),
          invoiceNumber: invoice.invoice_number,
          invoiceDate: format(new Date(invoice.invoice_date), 'dd-MMM-yyyy'),
          invoiceValue: invoiceValue,
          placeOfSupply: companyPlaceOfSupply,
          reverseCharge: 'N',
          invoiceType: 'Regular',
          ecommerceGSTIN: '',
          // Item-level details
          itemDescription: item.item_description || item.product_name || 'N/A',
          hsnSacCode: item.hsn_sac_code || 'Not Specified',
          quantity: item.quantity_invoiced,
          unitOfMeasure: item.unit_of_measure || 'PCS',
          unitPrice: item.unit_price,
          discountAmount: item.discount_amount || 0,
          itemTaxableValue: itemTaxableValue,
          cgstRate: item.cgst_rate || 0,
          cgstAmount: cgstAmount,
          sgstRate: item.sgst_rate || 0,
          sgstAmount: sgstAmount,
          igstRate: item.igst_rate || 0,
          igstAmount: igstAmount,
          totalTaxRate: taxRate,
          totalItemTax: totalItemTax,
          itemTotalValue: itemTaxableValue + totalItemTax
        });
      });
      
      if (isB2B) {
        // B2B Supply - Business customer or customer with GSTIN
        b2bSupplies.push({
          gstin: customerGSTIN || 'N/A',
          customerName: invoice.customer_name,
          invoiceNumber: invoice.invoice_number,
          invoiceDate: format(new Date(invoice.invoice_date), 'dd-MMM-yyyy'),
          invoiceValue: invoiceValue,
          placeOfSupply: companyPlaceOfSupply,
          reverseCharge: 'N',
          invoiceType: 'Regular',
          ecommerceGSTIN: '',
          taxableValue: taxableValue,
          cgstAmount: invoice.sales_invoice_items?.reduce((sum: number, item: any) => sum + (item.cgst_amount || 0), 0) || 0,
          sgstAmount: invoice.sales_invoice_items?.reduce((sum: number, item: any) => sum + (item.sgst_amount || 0), 0) || 0,
          igstAmount: invoice.sales_invoice_items?.reduce((sum: number, item: any) => sum + (item.igst_amount || 0), 0) || 0,
          totalTax: invoice.tax_amount,
          customerType: customerType || 'Business'
        });
      } else if (invoiceValue > 250000) {
        // B2C Large - Individual customer above 2.5L
        b2cLargeSupplies.push({
          invoiceNumber: invoice.invoice_number,
          invoiceDate: format(new Date(invoice.invoice_date), 'dd-MMM-yyyy'),
          invoiceValue: invoiceValue,
          placeOfSupply: companyPlaceOfSupply,
          taxableValue: taxableValue,
          cgstAmount: invoice.sales_invoice_items?.reduce((sum: number, item: any) => sum + (item.cgst_amount || 0), 0) || 0,
          sgstAmount: invoice.sales_invoice_items?.reduce((sum: number, item: any) => sum + (item.sgst_amount || 0), 0) || 0,
          igstAmount: invoice.sales_invoice_items?.reduce((sum: number, item: any) => sum + (item.igst_amount || 0), 0) || 0,
          ecommerceGSTIN: '',
          customerType: customerType || 'Individual'
        });
      } else {
        // B2C Small - Individual customer below 2.5L
        const placeOfSupply = companyPlaceOfSupply;
        if (!b2cSmallSupplies[placeOfSupply]) {
          b2cSmallSupplies[placeOfSupply] = {
            placeOfSupply,
            taxableValue: 0,
            cgstAmount: 0,
            sgstAmount: 0,
            igstAmount: 0,
            customerType: 'Individual'
          };
        }
        b2cSmallSupplies[placeOfSupply].taxableValue += taxableValue;
        b2cSmallSupplies[placeOfSupply].cgstAmount += invoice.sales_invoice_items?.reduce((sum: number, item: any) => sum + (item.cgst_amount || 0), 0) || 0;
        b2cSmallSupplies[placeOfSupply].sgstAmount += invoice.sales_invoice_items?.reduce((sum: number, item: any) => sum + (item.sgst_amount || 0), 0) || 0;
        b2cSmallSupplies[placeOfSupply].igstAmount += invoice.sales_invoice_items?.reduce((sum: number, item: any) => sum + (item.igst_amount || 0), 0) || 0;
      }

      // HSN Summary
      invoice.sales_invoice_items?.forEach((item: any) => {
        const hsn = item.hsn_sac_code || 'Not Specified';
        const itemTaxableValue = (item.unit_price * item.quantity_invoiced) - (item.discount_amount || 0);
        const totalTax = (item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0);
        const taxRate = itemTaxableValue > 0 ? ((totalTax / itemTaxableValue) * 100).toFixed(1) : '0';

        if (!hsnSummary[hsn]) {
          hsnSummary[hsn] = {
            hsn,
            description: item.item_description || item.product_name || 'N/A',
            uom: item.unit_of_measure || 'PCS',
            totalQuantity: 0,
            totalValue: 0,
            taxableValue: 0,
            cgstAmount: 0,
            sgstAmount: 0,
            igstAmount: 0,
            totalTax: 0,
            taxRate
          };
        }
        
        hsnSummary[hsn].totalQuantity += item.quantity_invoiced;
        hsnSummary[hsn].totalValue += item.unit_price * item.quantity_invoiced;
        hsnSummary[hsn].taxableValue += itemTaxableValue;
        hsnSummary[hsn].cgstAmount += item.cgst_amount || 0;
        hsnSummary[hsn].sgstAmount += item.sgst_amount || 0;
        hsnSummary[hsn].igstAmount += item.igst_amount || 0;
        hsnSummary[hsn].totalTax += totalTax;
      });
    });

    const chartData = Object.values(hsnSummary).map((hsn: any) => ({
      name: hsn.hsn,
      value: hsn.taxableValue,
      tax: hsn.totalTax
    }));

    return { 
      tableData: b2bSupplies, 
      chartData,
      itemWiseData, // New: Item-level data for export
      gstr1Sections: {
        b2bSupplies,
        b2cLargeSupplies,
        b2cSmallSupplies: Object.values(b2cSmallSupplies),
        hsnSummary: Object.values(hsnSummary)
      },
      summary: {
        totalInvoices: filteredInvoices?.length || 0,
        totalTaxableValue,
        totalTaxAmount,
        b2bCount: b2bSupplies.length,
        b2cLargeCount: b2cLargeSupplies.length,
        b2cSmallStates: Object.keys(b2cSmallSupplies).length,
        totalHSNs: Object.keys(hsnSummary).length
      }
    };
  };

  const fetchPurchaseOrdersData = async (filters: FilterState) => {
    const { data: orders, error } = await supabase
      .from('purchase_orders')
      .select('*')
      .gte('order_date', format(filters.dateRange.from, 'yyyy-MM-dd'))
      .lte('order_date', format(filters.dateRange.to, 'yyyy-MM-dd'))
      .order('order_date', { ascending: false });

    if (error) throw error;

    const tableData = orders?.map(order => ({
      orderNumber: order.po_number,
      vendor: order.supplier_id ? `Supplier ${order.supplier_id.slice(0, 8)}` : 'N/A',
      date: order.order_date,
      amount: order.total_amount,
      status: order.status
    })) || [];

    // Monthly aggregation for chart
    const monthlyData = orders?.reduce((acc: Record<string, any>, order) => {
      const month = format(new Date(order.order_date), 'MMM yyyy');
      if (!acc[month]) {
        acc[month] = { month, orders: 0, spending: 0 };
      }
      acc[month].orders += 1;
      acc[month].spending += order.total_amount || 0;
      return acc;
    }, {}) || {};

    const chartData = Object.values(monthlyData);

    return { tableData, chartData };
  };

  const fetchVendorPurchasesData = async (filters: FilterState) => {
    const { data: orders, error } = await supabase
      .from('purchase_orders')
      .select('supplier_id, total_amount, order_date')
      .in('status', ['confirmed', 'partially_received', 'closed'])
      .gte('order_date', format(filters.dateRange.from, 'yyyy-MM-dd'))
      .lte('order_date', format(filters.dateRange.to, 'yyyy-MM-dd'));

    if (error) throw error;

    const vendorPurchases = orders?.reduce((acc: Record<string, any>, order) => {
      const vendorKey = order.supplier_id || 'Unknown';
      if (!acc[vendorKey]) {
        acc[vendorKey] = {
          vendor: `Supplier ${vendorKey.slice(0, 8)}`,
          totalPurchases: 0,
          orderCount: 0,
          supplierId: order.supplier_id
        };
      }
      acc[vendorKey].totalPurchases += order.total_amount || 0;
      acc[vendorKey].orderCount += 1;
      return acc;
    }, {}) || {};

    const tableData = Object.values(vendorPurchases).sort((a: any, b: any) => b.totalPurchases - a.totalPurchases);
    
    const chartData = tableData.slice(0, 10).map((item: any) => ({
      name: item.vendor,
      value: item.totalPurchases,
      orders: item.orderCount
    }));

    return { tableData, chartData };
  };

  const fetchStockMovementData = async (filters: FilterState) => {
    const { data: transactions, error } = await supabase
      .from('inventory_transactions')
      .select(`
        *, 
        products(name, sku)
      `)
      .gte('transaction_date', format(filters.dateRange.from, 'yyyy-MM-dd'))
      .lte('transaction_date', format(filters.dateRange.to, 'yyyy-MM-dd'))
      .order('transaction_date', { ascending: false })
      .limit(1000);

    if (error) throw error;

    const tableData = transactions?.map(transaction => ({
      product: transaction.products?.name || 'Unknown Product',
      sku: transaction.products?.sku || 'N/A',
      transaction: transaction.transaction_type,
      quantity: transaction.quantity_change,
      unitCost: transaction.unit_cost,
      totalValue: transaction.total_value,
      date: transaction.transaction_date,
      reference: transaction.reference_number
    })) || [];

    // Daily movement chart
    const dailyMovement = transactions?.reduce((acc: Record<string, any>, transaction) => {
      const date = format(new Date(transaction.transaction_date), 'yyyy-MM-dd');
      if (!acc[date]) {
        acc[date] = { date, inward: 0, outward: 0, net: 0 };
      }
      if (transaction.quantity_change > 0) {
        acc[date].inward += transaction.quantity_change;
      } else {
        acc[date].outward += Math.abs(transaction.quantity_change);
      }
      acc[date].net += transaction.quantity_change;
      return acc;
    }, {}) || {};

    const chartData = Object.values(dailyMovement);

    return { tableData, chartData };
  };

  const fetchItemWiseSalesData = async (filters: FilterState) => {
    console.log('=== fetchItemWiseSalesData START ===');
    console.log('Filters received:', filters);
    
    // If no product selected, show product selection summary
    if (!filters.product || filters.product === 'all') {
      console.log('Fetching ALL products summary');
      
      // First, get all active products
      const { data: allProducts, error: productsError } = await supabase
        .from('products')
        .select('id, name, sku')
        .eq('is_active', true)
        .order('name');

      if (productsError) {
        console.error('Error fetching products:', productsError);
        throw productsError;
      }

      console.log('All active products count:', allProducts?.length || 0);

      // Then get sales data
      const { data: salesItems, error } = await supabase
        .from('sales_invoice_items')
        .select(`
          *,
          sales_invoices!inner(
            invoice_date,
            status,
            customer_name
          )
        `)
        .eq('sales_invoices.status', 'finalized')
        .gte('sales_invoices.invoice_date', format(filters.dateRange.from, 'yyyy-MM-dd'))
        .lte('sales_invoices.invoice_date', format(filters.dateRange.to, 'yyyy-MM-dd'));

      if (error) {
        console.error('Error fetching sales items:', error);
        throw error;
      }

      console.log('Raw sales items count:', salesItems?.length || 0);

      // Create product lookup map
      const productMap = (allProducts || []).reduce((acc: Record<string, any>, product) => {
        acc[product.id] = product;
        return acc;
      }, {});

      // Initialize all products with zero sales
      const productSales = (allProducts || []).reduce((acc: Record<string, any>, product) => {
        acc[product.id] = {
          product: product.name,
          sku: product.sku,
          quantitySold: 0,
          totalRevenue: 0,
          avgPrice: 0,
          invoiceCount: new Set()
        };
        return acc;
      }, {});

      // Add sales data to products that have sales
      salesItems?.forEach(item => {
        const productId = item.product_id;
        if (productSales[productId]) {
          productSales[productId].quantitySold += item.quantity_invoiced || 0;
          productSales[productId].totalRevenue += item.line_total || 0;
          productSales[productId].invoiceCount.add(item.sales_invoice_id);
        }
      });

      console.log('Product sales aggregated:', Object.keys(productSales).length, 'products');

      // Calculate averages and convert Set to count
      const tableData = Object.values(productSales).map((item: any) => ({
        ...item,
        avgPrice: item.quantitySold > 0 ? item.totalRevenue / item.quantitySold : 0,
        invoiceCount: item.invoiceCount.size
      })).sort((a: any, b: any) => b.totalRevenue - a.totalRevenue);

      // Chart data - products with sales only, top 10
      const productsWithSales = tableData.filter((item: any) => item.totalRevenue > 0);
      const chartData = productsWithSales.slice(0, 10).map((item: any) => ({
        name: item.product.length > 20 ? item.product.substring(0, 20) + '...' : item.product,
        value: item.totalRevenue,
        quantity: item.quantitySold
      }));

      console.log('Final result - Table data count:', tableData.length);
      console.log('Final result - Chart data count:', chartData.length);
      console.log('Products with sales:', productsWithSales.length);
      console.log('=== fetchItemWiseSalesData END (ALL) ===');
      
      return { tableData, chartData };
    } else {
      // Show customer breakdown for selected product with month-on-month trends
      console.log('Fetching data for specific product:', filters.product);
      const { data: salesItems, error } = await supabase
        .from('sales_invoice_items')
        .select(`
          *,
          sales_invoices!inner(
            invoice_date,
            status,
            customer_name,
            customer_id
          )
        `)
        .eq('sales_invoices.status', 'finalized')
        .eq('product_id', filters.product)
        .gte('sales_invoices.invoice_date', format(filters.dateRange.from, 'yyyy-MM-dd'))
        .lte('sales_invoices.invoice_date', format(filters.dateRange.to, 'yyyy-MM-dd'));

      if (error) {
        console.error('Error fetching specific product data:', error);
        throw error;
      }

      console.log('Sales items for specific product:', salesItems?.length || 0, 'items');

    if (!salesItems || salesItems.length === 0) {
      console.log('No sales data for selected product');
      // Instead of returning empty arrays, return a message indicating no sales for this product
      return { 
        tableData: [{
          customer: 'No sales data available',
          quantitySold: 0,
          totalRevenue: 0,
          avgPrice: 0,
          invoiceCount: 0,
          lastPurchaseDate: 'N/A'
        }], 
        chartData: [] 
      };
    }

      // Group by customer
      const customerSales = salesItems?.reduce((acc: Record<string, any>, item) => {
        const customerKey = item.sales_invoices.customer_id || item.sales_invoices.customer_name || 'unknown';
        const customerName = item.sales_invoices.customer_name || 'Unknown Customer';
        
        if (!acc[customerKey]) {
          acc[customerKey] = {
            customer: customerName,
            quantitySold: 0,
            totalRevenue: 0,
            avgPrice: 0,
            invoiceCount: new Set(),
            lastPurchaseDate: null
          };
        }
        
        acc[customerKey].quantitySold += item.quantity_invoiced || 0;
        acc[customerKey].totalRevenue += item.line_total || 0;
        acc[customerKey].invoiceCount.add(item.sales_invoice_id);
        
        const invoiceDate = new Date(item.sales_invoices.invoice_date);
        if (!acc[customerKey].lastPurchaseDate || invoiceDate > acc[customerKey].lastPurchaseDate) {
          acc[customerKey].lastPurchaseDate = invoiceDate;
        }
        
        return acc;
      }, {}) || {};

      // Calculate averages and format dates
      const tableData = Object.values(customerSales).map((item: any) => ({
        ...item,
        avgPrice: item.quantitySold > 0 ? item.totalRevenue / item.quantitySold : 0,
        invoiceCount: item.invoiceCount.size,
        lastPurchaseDate: item.lastPurchaseDate ? format(item.lastPurchaseDate, 'MMM dd, yyyy') : 'N/A'
      })).sort((a: any, b: any) => b.totalRevenue - a.totalRevenue);

      // Month-on-month chart data
      const monthlyData = salesItems?.reduce((acc: Record<string, any>, item) => {
        const month = format(new Date(item.sales_invoices.invoice_date), 'MMM yyyy');
        if (!acc[month]) {
          acc[month] = { month, quantity: 0, revenue: 0 };
        }
        acc[month].quantity += item.quantity_invoiced || 0;
        acc[month].revenue += item.line_total || 0;
        return acc;
      }, {}) || {};

      const chartData = Object.values(monthlyData).sort((a: any, b: any) => 
        new Date(a.month + ' 01').getTime() - new Date(b.month + ' 01').getTime()
      );

      console.log('Specific product result - Table data count:', tableData.length);
      console.log('Specific product result - Chart data count:', chartData.length);
      console.log('=== fetchItemWiseSalesData END (SPECIFIC) ===');
      
      return { tableData, chartData };
    }
  };

  const fetchItemWisePurchaseData = async (filters: FilterState) => {
    const { data: purchaseItems, error } = await supabase
      .from('grn_line_items')
      .select(`
        *,
        grn_header!inner(
          grn_date,
          status,
          supplier_name
        )
      `)
      .in('grn_header.status', ['accepted', 'received', 'partially_received'])
      .gte('grn_header.grn_date', format(filters.dateRange.from, 'yyyy-MM-dd'))
      .lte('grn_header.grn_date', format(filters.dateRange.to, 'yyyy-MM-dd'));

    if (error) throw error;

    // Get product information separately
    const productIds = [...new Set(purchaseItems?.map(item => item.product_id).filter(Boolean))] as string[];
    let productsData: any[] = [];
    
    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('id, name, sku')
        .in('id', productIds);
      productsData = products || [];
    }

    // Create product lookup map
    const productMap = productsData.reduce((acc: Record<string, any>, product) => {
      acc[product.id] = product;
      return acc;
    }, {});

    // Group by product
    const productPurchases = purchaseItems?.reduce((acc: Record<string, any>, item) => {
      const productKey = item.product_id || 'unknown';
      const productInfo = productMap[item.product_id];
      const productName = productInfo?.name || item.product_name || 'Unknown Product';
      const sku = productInfo?.sku || item.product_sku || 'N/A';
      
      if (!acc[productKey]) {
        acc[productKey] = {
          product: productName,
          sku: sku,
          quantityPurchased: 0,
          totalCost: 0,
          avgPrice: 0,
          grnCount: new Set()
        };
      }
      
      acc[productKey].quantityPurchased += item.accepted_quantity || 0;
      acc[productKey].totalCost += item.line_total || 0;
      acc[productKey].grnCount.add(item.grn_header_id);
      
      return acc;
    }, {}) || {};

    // Calculate averages and convert Set to count
    const tableData = Object.values(productPurchases).map((item: any) => ({
      ...item,
      avgPrice: item.quantityPurchased > 0 ? item.totalCost / item.quantityPurchased : 0,
      grnCount: item.grnCount.size
    })).sort((a: any, b: any) => b.totalCost - a.totalCost);

    // Chart data - top 10 products by cost
    const chartData = tableData.slice(0, 10).map((item: any) => ({
      name: item.product.length > 20 ? item.product.substring(0, 20) + '...' : item.product,
      value: item.totalCost,
      quantity: item.quantityPurchased
    }));

    return { tableData, chartData };
  };

  const fetchCreditDebitNotesData = async (filters: FilterState) => {
    const { data: creditNotes, error: creditError } = await supabase
      .from('credit_notes')
      .select('*')
      .gte('cn_date', format(filters.dateRange.from, 'yyyy-MM-dd'))
      .lte('cn_date', format(filters.dateRange.to, 'yyyy-MM-dd'));

    const { data: debitNotes, error: debitError } = await supabase
      .from('debit_notes')
      .select('*')
      .gte('debit_note_date', format(filters.dateRange.from, 'yyyy-MM-dd'))
      .lte('debit_note_date', format(filters.dateRange.to, 'yyyy-MM-dd'));

    if (creditError || debitError) throw creditError || debitError;

    const tableData = [
      ...(creditNotes?.map(note => ({
        type: 'Credit Note',
        number: note.cn_number,
        customer: note.customer_name,
        date: note.cn_date,
        amount: note.total_amount,
        status: note.status
      })) || []),
      ...(debitNotes?.map(note => ({
        type: 'Debit Note',
        number: note.debit_note_number,
        supplier: note.supplier_name,
        date: note.debit_note_date,
        amount: note.total_amount,
        status: note.status
      })) || [])
    ];

    const chartData = [
      { 
        name: 'Credit Notes', 
        value: creditNotes?.reduce((sum, note) => sum + note.total_amount, 0) || 0,
        count: creditNotes?.length || 0 
      },
      { 
        name: 'Debit Notes', 
        value: debitNotes?.reduce((sum, note) => sum + note.total_amount, 0) || 0,
        count: debitNotes?.length || 0 
      }
    ];

    return { tableData, chartData };
  };

  const fetchNetARAPData = async (filters: FilterState) => {
    // Fetch AR data from sales invoices
    const { data: arData, error: arError } = await supabase
      .from('sales_invoices')
      .select(`
        id, invoice_number, customer_name, total_amount, 
        invoice_date, status, customer_id,
        payments(amount, payment_date)
      `)
      .eq('status', 'finalized')
      .gte('invoice_date', format(filters.dateRange.from, 'yyyy-MM-dd'))
      .lte('invoice_date', format(filters.dateRange.to, 'yyyy-MM-dd'));

    if (arError) throw arError;

    // Fetch AP data from GRNs (actual goods received that need payment)
    const { data: apData, error: apError } = await supabase
      .from('grn_header')
      .select(`
        id, grn_number, total_amount, 
        grn_date, status, supplier_name, supplier_id,
        purchase_order_id
      `)
      .in('status', ['received', 'partially_received'])
      .gte('grn_date', format(filters.dateRange.from, 'yyyy-MM-dd'))
      .lte('grn_date', format(filters.dateRange.to, 'yyyy-MM-dd'));

    if (apError) throw apError;

    // Get payment data for both AR and AP
    const invoiceIds = arData?.map(inv => inv.id) || [];
    const grnIds = apData?.map(grn => grn.id) || [];
    const purchaseOrderIds = apData?.map(grn => grn.purchase_order_id).filter(Boolean) || [];
    
    let arPayments: any[] = [];
    let apPayments: any[] = [];
    
    if (invoiceIds.length > 0) {
      const { data: arPaymentData } = await supabase
        .from('payments')
        .select('*')
        .in('sales_invoice_id', invoiceIds);
      arPayments = arPaymentData || [];
    }
    
    if (grnIds.length > 0 || purchaseOrderIds.length > 0) {
      const { data: apPaymentData } = await supabase
        .from('payments')
        .select('*')
        .or(`grn_id.in.(${grnIds.join(',')}),purchase_order_id.in.(${purchaseOrderIds.join(',')})`);
      apPayments = apPaymentData || [];
    }

    // Calculate AR outstanding
    const arOutstanding = arData?.map(invoice => {
      const relatedPayments = arPayments.filter(p => p.sales_invoice_id === invoice.id);
      const totalPaid = relatedPayments.reduce((sum, payment) => sum + payment.amount, 0);
      return {
        type: 'Accounts Receivable',
        customer: invoice.customer_name,
        reference: invoice.invoice_number,
        date: invoice.invoice_date,
        totalAmount: invoice.total_amount,
        paidAmount: totalPaid,
        outstandingAmount: invoice.total_amount - totalPaid
      };
    }).filter(item => item.outstandingAmount > 0) || [];

    // Calculate AP outstanding
    const apOutstanding = apData?.map(grn => {
      const relatedPayments = apPayments.filter(p => 
        p.grn_id === grn.id || p.purchase_order_id === grn.purchase_order_id
      );
      const totalPaid = relatedPayments.reduce((sum, payment) => sum + payment.amount, 0);
      return {
        type: 'Accounts Payable',
        vendor: grn.supplier_name,
        reference: grn.grn_number,
        date: grn.grn_date,
        totalAmount: grn.total_amount,
        paidAmount: totalPaid,
        outstandingAmount: grn.total_amount - totalPaid
      };
    }).filter(item => item.outstandingAmount > 0) || [];

    // Combine and calculate net position
    const tableData = [
      ...arOutstanding,
      ...apOutstanding
    ];

    const totalAR = arOutstanding.reduce((sum, item) => sum + item.outstandingAmount, 0);
    const totalAP = apOutstanding.reduce((sum, item) => sum + item.outstandingAmount, 0);
    const netPosition = totalAR - totalAP;

    // Chart data for visualization
    const chartData = [
      { name: 'Accounts Receivable', value: totalAR, type: 'AR' },
      { name: 'Accounts Payable', value: totalAP, type: 'AP' },
      { name: 'Net Position', value: Math.abs(netPosition), type: netPosition >= 0 ? 'Positive' : 'Negative' }
    ];

    return { 
      tableData: [
        ...tableData,
        // Add summary row
        {
          type: 'Summary',
          customer: '',
          vendor: '',
          reference: 'Net AR/AP Position',
          date: '',
          totalAmount: 0,
          paidAmount: 0,
          outstandingAmount: netPosition
        }
      ], 
      chartData,
      summary: {
        totalAR,
        totalAP,
        netPosition
      }
    };
  };

  const fetchQuotationComparisonData = async (filters: FilterState) => {
    // Get purchase order line items with supplier and product information
    const { data: purchaseItems, error } = await supabase
      .from('purchase_order_items')
      .select(`
        *,
        purchase_orders!inner(
          supplier_id,
          order_date,
          status,
          po_number
        ),
        products(
          name,
          sku
        )
      `)
      .in('purchase_orders.status', ['confirmed', 'partially_received', 'closed'])
      .gte('purchase_orders.order_date', format(filters.dateRange.from, 'yyyy-MM-dd'))
      .lte('purchase_orders.order_date', format(filters.dateRange.to, 'yyyy-MM-dd'));

    if (error) throw error;

    // Get supplier information
    const supplierIds = [...new Set(purchaseItems?.map(item => item.purchase_orders.supplier_id).filter(Boolean))];
    let suppliers: any[] = [];
    
    if (supplierIds.length > 0) {
      const { data: supplierData } = await supabase
        .from('suppliers')
        .select('id, name, supplier_ref')
        .in('id', supplierIds);
      
      suppliers = supplierData || [];
    }

    const supplierMap = suppliers.reduce((acc: Record<string, any>, supplier) => {
      acc[supplier.id] = supplier;
      return acc;
    }, {});

    // Group by product and show vendor pricing
    const productComparisons: Record<string, any> = {};

    purchaseItems?.forEach(item => {
      const productKey = item.product_id;
      const productName = item.products?.name || item.item_description || 'Unknown Product';
      const productSku = item.products?.sku || 'N/A';
      const supplierId = item.purchase_orders.supplier_id;
      const supplierName = supplierMap[supplierId]?.name || `Supplier ${supplierId?.slice(0, 8)}`;

      if (!productComparisons[productKey]) {
        productComparisons[productKey] = {
          productId: productKey,
          productName,
          productSku,
          vendors: {},
          minPrice: Infinity,
          maxPrice: 0,
          avgPrice: 0,
          vendorCount: 0,
          bestVendor: '',
          worstVendor: '',
          priceVariance: 0
        };
      }

      const vendorKey = `${supplierId}-${supplierName}`;
      if (!productComparisons[productKey].vendors[vendorKey]) {
        productComparisons[productKey].vendors[vendorKey] = {
          supplierId,
          supplierName,
          prices: [],
          avgPrice: 0,
          totalQuantity: 0,
          orderCount: 0,
          lastOrderDate: item.purchase_orders.order_date
        };
      }

      // Add this price point
      productComparisons[productKey].vendors[vendorKey].prices.push(item.unit_price);
      productComparisons[productKey].vendors[vendorKey].totalQuantity += item.quantity;
      productComparisons[productKey].vendors[vendorKey].orderCount += 1;
      
      // Update last order date if more recent
      if (new Date(item.purchase_orders.order_date) > new Date(productComparisons[productKey].vendors[vendorKey].lastOrderDate)) {
        productComparisons[productKey].vendors[vendorKey].lastOrderDate = item.purchase_orders.order_date;
      }
    });

    // Calculate averages and comparisons
    Object.values(productComparisons).forEach((product: any) => {
      const vendorPrices: number[] = [];
      let totalSpending = 0;
      let totalQuantity = 0;

      Object.values(product.vendors).forEach((vendor: any) => {
        // Calculate weighted average price for this vendor
        const totalValue = vendor.prices.reduce((sum: number, price: number, index: number) => sum + price, 0);
        vendor.avgPrice = vendor.prices.length > 0 ? totalValue / vendor.prices.length : 0;
        vendorPrices.push(vendor.avgPrice);
        
        totalSpending += totalValue;
        totalQuantity += vendor.totalQuantity;
      });

      product.minPrice = Math.min(...vendorPrices);
      product.maxPrice = Math.max(...vendorPrices);
      product.avgPrice = vendorPrices.length > 0 ? vendorPrices.reduce((a, b) => a + b, 0) / vendorPrices.length : 0;
      product.vendorCount = Object.keys(product.vendors).length;
      product.priceVariance = product.maxPrice - product.minPrice;
      product.savingsPotential = totalQuantity * product.priceVariance;

      // Find best and worst vendors
      const sortedVendors = Object.values(product.vendors).sort((a: any, b: any) => a.avgPrice - b.avgPrice);
      if (sortedVendors.length > 0) {
        product.bestVendor = (sortedVendors[0] as any).supplierName;
        product.worstVendor = (sortedVendors[sortedVendors.length - 1] as any).supplierName;
      }
    });

    // Filter products that have multiple vendors for comparison
    const comparableProducts = Object.values(productComparisons).filter((product: any) => product.vendorCount > 1);
    
    // Convert to table format showing vendor breakdown
    const tableData: any[] = [];
    comparableProducts.forEach((product: any) => {
      Object.values(product.vendors).forEach((vendor: any, index: number) => {
        tableData.push({
          productName: index === 0 ? product.productName : '', // Only show product name for first vendor
          productSku: index === 0 ? product.productSku : '',
          supplierName: vendor.supplierName,
          avgPrice: vendor.avgPrice,
          orderCount: vendor.orderCount,
          totalQuantity: vendor.totalQuantity,
          lastOrderDate: vendor.lastOrderDate,
          priceRank: index === 0 ? 'Best' : index === Object.keys(product.vendors).length - 1 ? 'Highest' : 'Mid',
          savingsVsBest: vendor.avgPrice - product.minPrice,
          priceVariance: product.priceVariance,
          totalVendors: product.vendorCount
        });
      });
      
      // Add separator row between products
      if (comparableProducts.indexOf(product) < comparableProducts.length - 1) {
        tableData.push({
          productName: '---',
          productSku: '---',
          supplierName: '---',
          avgPrice: 0,
          orderCount: 0,
          totalQuantity: 0,
          lastOrderDate: '',
          priceRank: '---',
          savingsVsBest: 0,
          priceVariance: 0,
          totalVendors: 0
        });
      }
    });

    // Chart data - top products with highest savings potential
    const chartData = comparableProducts
      .sort((a: any, b: any) => b.savingsPotential - a.savingsPotential)
      .slice(0, 10)
      .map((product: any) => ({
        name: product.productName.length > 25 ? product.productName.substring(0, 25) + '...' : product.productName,
        potentialSavings: product.savingsPotential,
        priceVariance: product.priceVariance,
        vendorCount: product.vendorCount,
        bestPrice: product.minPrice,
        worstPrice: product.maxPrice
      }));

    return { 
      tableData, 
      chartData,
      summary: {
        totalProducts: comparableProducts.length,
        totalVendors: suppliers.length,
        avgPriceVariance: comparableProducts.reduce((sum: number, p: any) => sum + p.priceVariance, 0) / Math.max(1, comparableProducts.length),
        totalSavingsPotential: comparableProducts.reduce((sum: number, p: any) => sum + p.savingsPotential, 0)
      }
    };
  };

  const generateReportData = async (reportId: string, filters: FilterState) => {
    try {
      switch (reportId) {
        case 'ar_aging':
          return await fetchARAgingData(filters);
        case 'ap_aging':
          return await fetchAPAgingData(filters);
        case 'net_arap':
          return await fetchNetARAPData(filters);
        case 'sales_orders':
          return await fetchSalesOrdersData(filters);
        case 'current_stock':
          return await fetchCurrentStockData();
        case 'customer_sales':
          return await fetchCustomerSalesData(filters);
        case 'gstr1':
          return await fetchGSTR1Data(filters);
        case 'purchase_orders':
          return await fetchPurchaseOrdersData(filters);
        case 'vendor_purchases':
          return await fetchVendorPurchasesData(filters);
        case 'stock_movement':
          return await fetchStockMovementData(filters);
        case 'credit_debit_notes':
          return await fetchCreditDebitNotesData(filters);
        case 'item_wise_sales':
          return await fetchItemWiseSalesData(filters);
        case 'item_wise_purchase':
          return await fetchItemWisePurchaseData(filters);
        case 'quotation_comparison':
          return await fetchQuotationComparisonData(filters);
        default:
          return { tableData: [], chartData: [], invoiceWiseData: [] };
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
      toast.error('Failed to fetch report data');
      return { tableData: [], chartData: [], invoiceWiseData: [] };
    }
  };

  // Update state when query data changes
  useEffect(() => {
    if (reportResult) {
      setReportData(reportResult.tableData);
      setChartData(reportResult.chartData);
      // Handle optional invoiceWiseData for aging reports and itemWiseData for GSTR-1
      if ('invoiceWiseData' in reportResult && Array.isArray(reportResult.invoiceWiseData)) {
        setInvoiceWiseData(reportResult.invoiceWiseData);
      } else if ('itemWiseData' in reportResult && Array.isArray(reportResult.itemWiseData)) {
        setInvoiceWiseData(reportResult.itemWiseData); // Store item-wise data in same state
      } else {
        setInvoiceWiseData([]);
      }
    }
  }, [reportResult]);

  const toggleCategory = (categoryId: string) => {
    setOpenCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleReportSelect = (reportId: string, categoryId: string) => {
    console.log('Report selected:', reportId, 'Category:', categoryId);
    setSelectedReport(reportId);
    setSelectedCategory(categoryId);
    
    // Reset filters when changing reports
    if (reportId === 'item_wise_sales') {
      console.log('Setting product filter to "all" for item wise sales report');
      setFilters(prev => ({
        ...prev,
        product: 'all'
      }));
    } else {
      // Clear product filter for other reports
      setFilters(prev => {
        const newFilters = { ...prev };
        delete newFilters.product;
        return newFilters;
      });
    }
  };

  const exportReport = (exportFormat: 'excel' | 'pdf' | 'json') => {
    // Use item-wise data for GSTR-1, invoice-wise data for AR/AP aging reports, regular reportData for others
    let dataToExport = reportData;
    
    if (selectedReport === 'gstr1' && invoiceWiseData.length > 0) {
      dataToExport = invoiceWiseData; // Use detailed item-level data for GSTR-1
    } else if ((selectedReport === 'ar_aging' || selectedReport === 'ap_aging') && invoiceWiseData.length > 0) {
      dataToExport = invoiceWiseData; // Use invoice-wise data for aging reports
    }
      
    if (!dataToExport.length) {
      toast.error('No data to export');
      return;
    }

    const fileName = `${currentReport?.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}`;
    
    if (exportFormat === 'json') {
      const jsonData = JSON.stringify({ 
        reportName: currentReport?.name,
        dateRange: filters.dateRange,
        data: dataToExport,
        chartData: chartData
      }, null, 2);
      
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('JSON file downloaded successfully');
    } else if (exportFormat === 'excel') {
      // Use the existing exportToExcel utility from utils
      import('@/utils/excelExport').then(({ exportToExcel }) => {
        const columns = Object.keys(dataToExport[0]).map(key => ({
          key,
          label: key,
          format: (value: any) => {
            if (typeof value === 'number' && (key.toLowerCase().includes('amount') || key.toLowerCase().includes('days'))) {
              return key.toLowerCase().includes('amount') ? `₹${value.toLocaleString()}` : value;
            }
            return value;
          }
        }));
        
        exportToExcel({
          filename: fileName,
          sheetName: currentReport?.name || 'Report',
          columns,
          data: dataToExport,
          includeMetadata: true,
          companyName: 'Company Report'
        });
      });
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-muted-foreground">Loading reports...</span>
      </div>
    );
  }

  if (!hasAccess('reports')) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to view reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-[600px] bg-background">
      {/* Sidebar */}
      <div className="w-full lg:w-80 border-r border-border bg-card p-4 overflow-y-auto">
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Reports Menu</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-2">
          {reportCategories.map((category) => {
            const Icon = category.icon;
            const isOpen = openCategories.includes(category.id);
            
            return (
              <Collapsible
                key={category.id}
                open={isOpen}
                onOpenChange={() => toggleCategory(category.id)}
              >
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 text-left rounded-lg hover:bg-accent transition-colors">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-primary" />
                    <span className="font-medium">{category.name}</span>
                  </div>
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-4 mt-1 space-y-1">
                  {category.reports
                    .filter(report => 
                      searchTerm === '' || 
                      report.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      report.description.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map((report) => (
                    <Button
                      key={report.id}
                      variant={selectedReport === report.id ? "default" : "ghost"}
                      size="sm"
                      className={cn(
                        "w-full justify-start text-sm h-auto py-2 px-3",
                        selectedReport === report.id && "bg-primary text-primary-foreground"
                      )}
                      onClick={() => handleReportSelect(report.id, category.id)}
                    >
                      <div className="text-left">
                        <div className="font-medium">{report.name}</div>
                        <div className="text-xs opacity-70 mt-1">{report.description}</div>
                      </div>
                    </Button>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-border p-6 bg-card">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold">{currentReport?.name}</h1>
              <p className="text-muted-foreground">{currentReport?.description}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
                <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportReport('excel')}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportReport('pdf')}>
                <FileText className="h-4 w-4 mr-2" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportReport('json')}>
                <Download className="h-4 w-4 mr-2" />
                JSON
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="border-b border-border p-6 bg-card">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Date Range</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(filters.dateRange.from, 'MMM dd, yyyy')} - {format(filters.dateRange.to, 'MMM dd, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={filters.dateRange.from}
                    selected={filters.dateRange}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setFilters(prev => ({
                          ...prev,
                          dateRange: { from: range.from, to: range.to }
                        }));
                      }
                    }}
                    numberOfMonths={2}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {currentReport?.requiresFilters?.includes('customer') && (
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-2 block">Customer/Vendor</label>
                <Select value={filters.customer} onValueChange={(value) => setFilters(prev => ({ ...prev, customer: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Customers</SelectItem>
                    <SelectItem value="abc-corp">ABC Corp</SelectItem>
                    <SelectItem value="xyz-ltd">XYZ Ltd</SelectItem>
                    <SelectItem value="tech-solutions">Tech Solutions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {currentReport?.requiresFilters?.includes('gstin') && (
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-2 block">GSTIN / State</label>
                <Select 
                  value={filters.gstin} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, gstin: value }))}
                  disabled={isLoadingGSTIN}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingGSTIN ? "Loading GSTINs..." : "Select GSTIN..."} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    {gstinOptions.map((option) => (
                      <SelectItem key={option.gstin} value={option.gstin}>
                        {option.displayText}
                      </SelectItem>
                    ))}
                    {gstinOptions.length === 0 && !isLoadingGSTIN && (
                      <SelectItem value="" disabled>
                        No GSTINs found in database
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {currentReport?.requiresFilters?.includes('product') && (
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-2 block">Product</label>
                <ProductSelector
                  value={filters.product}
                  onChange={(value) => setFilters(prev => ({ ...prev, product: value }))}
                />
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3 text-muted-foreground">Loading report data...</span>
            </div>
          ) : selectedReport === 'gstr1' ? (
            // GSTR-1 Specific Layout
            <div className="space-y-6">
              {/* GSTR-1 Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
                  <CardContent className="p-4">
                    <div className="text-sm font-medium text-blue-700 dark:text-blue-300">Total Invoices</div>
                    <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {(reportData as any)?.summary?.totalInvoices || 0}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800">
                  <CardContent className="p-4">
                    <div className="text-sm font-medium text-green-700 dark:text-green-300">Taxable Value</div>
                    <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                      ₹{Number((reportData as any)?.summary?.totalTaxableValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-800">
                  <CardContent className="p-4">
                    <div className="text-sm font-medium text-orange-700 dark:text-orange-300">Total Tax</div>
                    <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                      ₹{Number((reportData as any)?.summary?.totalTaxAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800">
                  <CardContent className="p-4">
                    <div className="text-sm font-medium text-purple-700 dark:text-purple-300">HSN Codes</div>
                    <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                      {(reportData as any)?.summary?.totalHSNs || 0}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* HSN Summary Chart */}
              {chartData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>HSN-wise Taxable Value Distribution</CardTitle>
                    <CardDescription>Visual breakdown of taxable value by HSN codes</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={chartData.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip 
                          formatter={(value, name) => [
                            name === 'value' ? `₹${Number(value).toLocaleString('en-IN')}` : `₹${Number(value).toLocaleString('en-IN')}`,
                            name === 'value' ? 'Taxable Value' : 'Tax Amount'
                          ]}
                        />
                        <Bar dataKey="value" fill="#0ea5e9" name="Taxable Value" />
                        <Bar dataKey="tax" fill="#10b981" name="Tax Amount" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* GSTR-1 Sections */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* B2B Supplies */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>B2B Supplies</span>
                      <Badge variant="secondary">{(reportData as any)?.gstr1Sections?.b2bSupplies?.length || 0} records</Badge>
                    </CardTitle>
                    <CardDescription>Sales to registered businesses</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {(reportData as any)?.gstr1Sections?.b2bSupplies?.slice(0, 5).map((item: any, index: number) => (
                        <div key={index} className="p-3 border rounded-lg bg-card/50">
                          <div className="flex justify-between items-start">
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm truncate">{item.customerName}</div>
                              <div className="text-xs text-muted-foreground">{item.gstin}</div>
                              <div className="text-xs text-muted-foreground">{item.invoiceNumber} - {item.invoiceDate}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium text-sm">₹{Number(item.invoiceValue).toLocaleString('en-IN')}</div>
                              <div className="text-xs text-muted-foreground">Tax: ₹{Number(item.totalTax).toLocaleString('en-IN')}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {(reportData as any)?.gstr1Sections?.b2bSupplies?.length > 5 && (
                        <div className="text-center text-sm text-muted-foreground py-2">
                          +{(reportData as any)?.gstr1Sections?.b2bSupplies?.length - 5} more records
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* B2C Large Supplies */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>B2C Large Supplies</span>
                      <Badge variant="secondary">{(reportData as any)?.gstr1Sections?.b2cLargeSupplies?.length || 0} records</Badge>
                    </CardTitle>
                    <CardDescription>B2C sales above ₹2.5 Lakhs</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {(reportData as any)?.gstr1Sections?.b2cLargeSupplies?.slice(0, 5).map((item: any, index: number) => (
                        <div key={index} className="p-3 border rounded-lg bg-card/50">
                          <div className="flex justify-between items-start">
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm">{item.invoiceNumber}</div>
                              <div className="text-xs text-muted-foreground">{item.invoiceDate}</div>
                              <div className="text-xs text-muted-foreground">POS: {item.placeOfSupply}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium text-sm">₹{Number(item.invoiceValue).toLocaleString('en-IN')}</div>
                              <div className="text-xs text-muted-foreground">
                                Tax: ₹{Number(item.cgstAmount + item.sgstAmount + item.igstAmount).toLocaleString('en-IN')}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {(reportData as any)?.gstr1Sections?.b2cLargeSupplies?.length > 5 && (
                        <div className="text-center text-sm text-muted-foreground py-2">
                          +{(reportData as any)?.gstr1Sections?.b2cLargeSupplies?.length - 5} more records
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* HSN Summary Table */}
              <Card>
                <CardHeader>
                  <CardTitle>HSN/SAC Summary</CardTitle>
                  <CardDescription>HSN-wise summary of outward supplies (Required for GSTR-1)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-3 font-semibold">HSN/SAC</th>
                          <th className="text-left p-3 font-semibold">Description</th>
                          <th className="text-left p-3 font-semibold">UOM</th>
                          <th className="text-right p-3 font-semibold">Total Qty</th>
                          <th className="text-right p-3 font-semibold">Taxable Value</th>
                          <th className="text-right p-3 font-semibold">CGST</th>
                          <th className="text-right p-3 font-semibold">SGST</th>
                          <th className="text-right p-3 font-semibold">IGST</th>
                          <th className="text-right p-3 font-semibold">Total Tax</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(reportData as any)?.gstr1Sections?.hsnSummary?.map((hsn: any, index: number) => (
                          <tr key={index} className="border-b hover:bg-muted/30 transition-colors">
                            <td className="p-3 font-medium">{hsn.hsn}</td>
                            <td className="p-3 max-w-[200px] truncate" title={hsn.description}>{hsn.description}</td>
                            <td className="p-3">{hsn.uom}</td>
                            <td className="p-3 text-right tabular-nums">{hsn.totalQuantity}</td>
                            <td className="p-3 text-right tabular-nums font-medium">
                              ₹{Number(hsn.taxableValue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </td>
                            <td className="p-3 text-right tabular-nums">
                              ₹{Number(hsn.cgstAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </td>
                            <td className="p-3 text-right tabular-nums">
                              ₹{Number(hsn.sgstAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </td>
                            <td className="p-3 text-right tabular-nums">
                              ₹{Number(hsn.igstAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </td>
                            <td className="p-3 text-right tabular-nums font-medium">
                              ₹{Number(hsn.totalTax).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* B2C Small Supplies & Export Note */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>B2C Small Supplies</CardTitle>
                    <CardDescription>State-wise summary of B2C sales below ₹2.5 Lakhs</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(reportData as any)?.gstr1Sections?.b2cSmallSupplies?.map((item: any, index: number) => (
                        <div key={index} className="flex justify-between items-center p-3 border rounded-lg bg-card/50">
                          <span className="font-medium">{item.placeOfSupply}</span>
                          <div className="text-right">
                            <div className="font-medium">₹{Number(item.taxableValue).toLocaleString('en-IN')}</div>
                            <div className="text-xs text-muted-foreground">
                              Tax: ₹{Number(item.cgstAmount + item.sgstAmount + item.igstAmount).toLocaleString('en-IN')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Export Information</CardTitle>
                    <CardDescription>Ready for CA filing and GST return</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">✓ GSTR-1 Ready</h4>
                        <p className="text-sm text-green-700 dark:text-green-300">
                          This report contains all required sections for GSTR-1 filing:
                        </p>
                        <ul className="text-sm text-green-700 dark:text-green-300 mt-2 space-y-1">
                          <li>• B2B Supplies with GSTIN</li>
                          <li>• B2C Large supplies (&gt;₹2.5L)</li>
                          <li>• B2C Small supplies (State-wise)</li>
                          <li>• HSN/SAC Summary</li>
                          <li>• Tax breakup (CGST/SGST/IGST)</li>
                        </ul>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <p><strong>Note:</strong> Export this data to Excel/PDF and share with your CA for GSTR-1 filing. 
                        Ensure customer GSTIN data is updated for accurate B2B classification.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Charts */}
              {chartData.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold">
                        {selectedReport === 'item_wise_sales' && filters.product && filters.product !== 'all' 
                          ? 'Month-on-Month Sales Trend' 
                          : 'Visual Analysis'
                        }
                      </CardTitle>
                      <CardDescription>
                        {selectedReport === 'item_wise_sales' && filters.product && filters.product !== 'all' 
                          ? 'Volume and revenue trends for selected item' 
                          : selectedReport.includes('aging') ? 'Outstanding amounts by aging period' : 'Data visualization'
                        }
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={350}>
                        {selectedReport.includes('aging') ? (
                          <PieChart>
                            <Pie
                              data={chartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={120}
                              dataKey="value"
                              label={({ name, percentage }) => percentage > 5 ? `${percentage}%` : ''}
                              labelLine={false}
                            >
                              {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              formatter={(value) => [`₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 'Amount']}
                              labelFormatter={(label) => `${label}`}
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '6px',
                                fontSize: '14px'
                              }}
                            />
                          </PieChart>
                         ) : selectedReport === 'item_wise_sales' && filters.product && filters.product !== 'all' ? (
                           <AreaChart data={chartData}>
                             <CartesianGrid strokeDasharray="3 3" />
                             <XAxis dataKey="month" />
                             <YAxis yAxisId="left" />
                             <YAxis yAxisId="right" orientation="right" />
                             <Tooltip formatter={(value, name) => [
                               name === 'revenue' ? `₹${Number(value).toLocaleString('en-IN')}` : `${value} units`,
                               name === 'revenue' ? 'Revenue' : 'Quantity'
                             ]} />
                             <Area yAxisId="left" type="monotone" dataKey="revenue" stackId="1" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.6} />
                             <Area yAxisId="right" type="monotone" dataKey="quantity" stackId="2" stroke="#10b981" fill="#10b981" fillOpacity={0.4} />
                           </AreaChart>
                         ) : selectedReport.includes('sales') || selectedReport.includes('purchase') ? (
                           <AreaChart data={chartData}>
                             <CartesianGrid strokeDasharray="3 3" />
                             <XAxis dataKey="month" />
                             <YAxis />
                             <Tooltip formatter={(value, name) => [
                               name === 'revenue' ? `₹${Number(value).toLocaleString('en-IN')}` : value,
                               name === 'revenue' ? 'Revenue' : 'Orders'
                             ]} />
                             <Area type="monotone" dataKey="revenue" stackId="1" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.6} />
                           </AreaChart>
                        ) : (
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="value" fill="#0ea5e9" />
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold">Key Metrics</CardTitle>
                      <CardDescription>
                        {selectedReport === 'item_wise_sales' && filters.product && filters.product !== 'all' 
                          ? 'Customer breakdown for selected item' 
                          : 'Summary of outstanding amounts'
                        }
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="p-4 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-800">
                          <div className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                            {selectedReport.includes('aging') ? 'Total Outstanding' : 'Total Records'}
                          </div>
                          <div className="text-xl font-bold text-blue-900 dark:text-blue-100 break-all">
                            {selectedReport.includes('aging') ? 
                              `₹${Number(chartData.reduce((sum, item) => sum + item.value, 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : 
                              reportData.length
                            }
                          </div>
                        </div>
                        
                        {selectedReport.includes('aging') && chartData.length > 0 && (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-lg bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border border-green-200 dark:border-green-800">
                              <div className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">Current (0 days)</div>
                              <div className="text-lg font-bold text-green-900 dark:text-green-100">
                                {chartData[0]?.percentage || 0}%
                              </div>
                            </div>
                            <div className="p-3 rounded-lg bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border border-orange-200 dark:border-orange-800">
                              <div className="text-xs font-medium text-orange-700 dark:text-orange-300 mb-1">Overdue (90+ days)</div>
                              <div className="text-lg font-bold text-orange-900 dark:text-orange-100">
                                {chartData[4]?.percentage || 0}%
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Legend for Aging Reports */}
              {selectedReport.includes('aging') && chartData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold">Aging Categories</CardTitle>
                    <CardDescription>Color-coded breakdown of aging periods</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {chartData.map((entry, index) => (
                        <div key={entry.name} className="flex items-center p-3 rounded-lg border bg-card/50">
                          <div 
                            className="w-4 h-4 rounded mr-3 flex-shrink-0" 
                            style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                          ></div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium text-muted-foreground">{entry.name}</div>
                            <div className="text-sm font-semibold">₹{Number(entry.value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                            <div className="text-xs text-muted-foreground">{entry.percentage}%</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Report Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Report Data</CardTitle>
                  <CardDescription>
                    {selectedReport === 'item_wise_sales' && filters.product && filters.product !== 'all' 
                      ? `Customer breakdown for selected product` 
                      : `Detailed breakdown for ${currentReport?.name}`
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {reportData.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">
                        {selectedReport === 'item_wise_sales' && filters.product && filters.product !== 'all' 
                          ? 'No sales data available for the selected product. Try selecting "All Products" to see the complete sales summary.' 
                          : selectedReport === 'item_wise_sales' && (!filters.product || filters.product === 'all')
                          ? 'Loading product sales data...'
                          : 'No data available for the selected criteria'
                        }
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            {reportData.length > 0 && Object.keys(reportData[0]).map((key) => (
                              <th key={key} className="text-left p-3 font-semibold text-foreground">
                                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.map((row, index) => (
                            <tr key={index} className="border-b hover:bg-muted/30 transition-colors">
                              {Object.entries(row).map(([key, value]) => (
                                <td key={key} className="p-3 max-w-[200px]">
                                  {typeof value === 'number' && (key.toLowerCase().includes('amount') || key.toLowerCase().includes('total') || key.toLowerCase().includes('revenue') || key.toLowerCase().includes('value')) ? 
                                    <span className="font-medium tabular-nums">
                                      ₹{Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                    </span> : 
                                    typeof value === 'number' && (key.toLowerCase().includes('quantity') || key.toLowerCase().includes('sold') || key.toLowerCase().includes('count')) ? 
                                      <span className="font-medium tabular-nums">
                                        {Number(value).toLocaleString('en-IN')}
                                      </span> :
                                    key === 'status' ? (
                                      <Badge variant={
                                        value === 'Delivered' ? 'default' :
                                        value === 'Shipped' ? 'secondary' :
                                        value === 'Low' ? 'destructive' :
                                        'outline'
                                      }>
                                        {String(value)}
                                      </Badge>
                                    ) : (
                                      <span className="break-words">{String(value)}</span>
                                    )
                                  }
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}