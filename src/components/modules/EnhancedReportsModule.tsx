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
      { id: 'purchase_orders', name: 'Purchase Orders', description: 'Purchase orders analysis', category: 'sales', requiresFilters: ['dateRange'], dataFields: ['orderNumber', 'vendor', 'amount', 'status'] },
      { id: 'vendor_purchases', name: 'Vendor Purchases', description: 'Vendor-wise purchase analysis', category: 'sales', requiresFilters: ['dateRange'], dataFields: ['vendor', 'totalPurchases', 'orderCount'] },
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
  },
  {
    id: 'analytics',
    name: 'Analytics & AI Insights',
    icon: Activity,
    reports: [
      { id: 'sales_forecast', name: 'Sales Forecast', description: 'AI-powered sales forecasting', category: 'analytics', requiresFilters: ['dateRange'] },
      { id: 'price_variance', name: 'Purchase Price Variance', description: 'Price variance analysis', category: 'analytics', requiresFilters: ['dateRange'] },
      { id: 'cashflow_risk', name: 'Cash Flow Risk', description: 'Cash flow risk assessment', category: 'analytics' },
      { id: 'profitability', name: 'Profitability Analysis', description: 'Product and customer profitability', category: 'analytics', requiresFilters: ['dateRange'] },
      { id: 'exception_reports', name: 'Exception Reports', description: 'Anomaly and exception detection', category: 'analytics' }
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
    }
  });
  const [reportData, setReportData] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Get current report
  const currentReport = reportCategories
    .flatMap(cat => cat.reports)
    .find(report => report.id === selectedReport);

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

    // Group by customer
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

    return { tableData, chartData };
  };

  const fetchAPAgingData = async (filters: FilterState) => {
    const { data: orders, error } = await supabase
      .from('purchase_orders')
      .select(`
        id, po_number, total_amount, 
        order_date, status, supplier_id,
        payments(amount, payment_date)
      `)
      .in('status', ['confirmed', 'partially_received', 'closed'])
      .gte('order_date', format(filters.dateRange.from, 'yyyy-MM-dd'))
      .lte('order_date', format(filters.dateRange.to, 'yyyy-MM-dd'));

    if (error) throw error;

    const agingData = orders?.map(order => {
      const totalPaid = order.payments?.reduce((sum: number, payment: any) => sum + payment.amount, 0) || 0;
      const outstandingAmount = order.total_amount - totalPaid;
      const daysOutstanding = differenceInDays(new Date(), new Date(order.order_date));
      
      return {
        vendor: `Supplier ${order.supplier_id?.slice(0, 8)}`,
        orderNumber: order.po_number,
        amount: outstandingAmount,
        daysOutstanding,
        orderDate: order.order_date,
        current: daysOutstanding <= 0 ? outstandingAmount : 0,
        days30: daysOutstanding > 0 && daysOutstanding <= 30 ? outstandingAmount : 0,
        days60: daysOutstanding > 30 && daysOutstanding <= 60 ? outstandingAmount : 0,
        days90: daysOutstanding > 60 && daysOutstanding <= 90 ? outstandingAmount : 0,
        over90: daysOutstanding > 90 ? outstandingAmount : 0
      };
    }).filter(item => item.amount > 0) || [];

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

    return { tableData, chartData };
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
    const { data: invoices, error } = await supabase
      .from('sales_invoices')
      .select(`
        *, 
        sales_invoice_items(*)
      `)
      .eq('status', 'finalized')
      .gte('invoice_date', format(filters.dateRange.from, 'yyyy-MM-dd'))
      .lte('invoice_date', format(filters.dateRange.to, 'yyyy-MM-dd'));

    if (error) throw error;

    const gstrData = invoices?.map(invoice => ({
      invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date,
      customerName: invoice.customer_name,
      gstin: 'Unregistered', // This field doesn't exist in the schema
      invoiceValue: invoice.total_amount,
      taxableValue: invoice.subtotal_amount,
      cgst: invoice.sales_invoice_items?.reduce((sum: number, item: any) => sum + (item.cgst_amount || 0), 0) || 0,
      sgst: invoice.sales_invoice_items?.reduce((sum: number, item: any) => sum + (item.sgst_amount || 0), 0) || 0,
      igst: invoice.sales_invoice_items?.reduce((sum: number, item: any) => sum + (item.igst_amount || 0), 0) || 0,
      totalTax: invoice.tax_amount
    })) || [];

    // HSN-wise summary for chart
    const hsnSummary = invoices?.flatMap(invoice => 
      invoice.sales_invoice_items?.map((item: any) => ({
        hsn: item.hsn_sac_code || 'Not Specified',
        taxableValue: item.unit_price * item.quantity_invoiced - (item.discount_amount || 0),
        tax: (item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0)
      })) || []
    ).reduce((acc: Record<string, any>, item) => {
      if (!acc[item.hsn]) {
        acc[item.hsn] = { name: item.hsn, taxableValue: 0, tax: 0 };
      }
      acc[item.hsn].taxableValue += item.taxableValue;
      acc[item.hsn].tax += item.tax;
      return acc;
    }, {}) || {};

    const chartData = Object.values(hsnSummary);

    return { tableData: gstrData, chartData };
  };

  const generateReportData = async (reportId: string, filters: FilterState) => {
    try {
      switch (reportId) {
        case 'ar_aging':
          return await fetchARAgingData(filters);
        case 'ap_aging':
          return await fetchAPAgingData(filters);
        case 'sales_orders':
          return await fetchSalesOrdersData(filters);
        case 'current_stock':
          return await fetchCurrentStockData();
        case 'customer_sales':
          return await fetchCustomerSalesData(filters);
        case 'gstr1':
          return await fetchGSTR1Data(filters);
        default:
          return { tableData: [], chartData: [] };
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
      toast.error('Failed to fetch report data');
      return { tableData: [], chartData: [] };
    }
  };

  // Update state when query data changes
  useEffect(() => {
    if (reportResult) {
      setReportData(reportResult.tableData);
      setChartData(reportResult.chartData);
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
    setSelectedReport(reportId);
    setSelectedCategory(categoryId);
  };

  const exportReport = (format: 'excel' | 'pdf' | 'json') => {
    // Implementation for export functionality
    console.log(`Exporting ${currentReport?.name} as ${format}`);
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
                <Select value={filters.gstin} onValueChange={(value) => setFilters(prev => ({ ...prev, gstin: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select GSTIN..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    <SelectItem value="29ABCDE1234F1Z5">29ABCDE1234F1Z5 (Karnataka)</SelectItem>
                    <SelectItem value="27ABCDE1234F1Z5">27ABCDE1234F1Z5 (Maharashtra)</SelectItem>
                  </SelectContent>
                </Select>
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
          ) : (
            <div className="space-y-6">
              {/* Charts */}
              {chartData.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Visual Analysis</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        {selectedReport.includes('aging') ? (
                          <PieChart>
                            <Pie
                              data={chartData}
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              dataKey="value"
                              label={({ name, percentage }) => `${name} (${percentage}%)`}
                            >
                              {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => [`$${value.toLocaleString()}`, 'Amount']} />
                          </PieChart>
                        ) : selectedReport.includes('sales') || selectedReport.includes('purchase') ? (
                          <AreaChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip formatter={(value, name) => [
                              name === 'revenue' ? `$${value.toLocaleString()}` : value,
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
                      <CardTitle>Key Metrics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg bg-muted">
                          <div className="text-2xl font-bold text-primary">
                            {selectedReport.includes('aging') ? '$' + chartData.reduce((sum, item) => sum + item.value, 0).toLocaleString() : reportData.length}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {selectedReport.includes('aging') ? 'Total Outstanding' : 'Total Records'}
                          </div>
                        </div>
                        <div className="p-4 rounded-lg bg-muted">
                          <div className="text-2xl font-bold text-green-600">
                            {selectedReport.includes('aging') ? chartData[0]?.percentage + '%' : '✓'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {selectedReport.includes('aging') ? 'Current' : 'Up to Date'}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Report Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Report Data</CardTitle>
                  <CardDescription>
                    Detailed breakdown for {currentReport?.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          {reportData.length > 0 && Object.keys(reportData[0]).map((key) => (
                            <th key={key} className="text-left p-3 font-medium capitalize">
                              {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.map((row, index) => (
                          <tr key={index} className="border-b hover:bg-muted/50">
                            {Object.entries(row).map(([key, value]) => (
                              <td key={key} className="p-3">
                                {typeof value === 'number' && key.toLowerCase().includes('amount') || key.toLowerCase().includes('total') || key.toLowerCase().includes('value') ? 
                                  `$${value.toLocaleString()}` : 
                                  key === 'status' ? (
                                    <Badge variant={
                                      value === 'Delivered' ? 'default' :
                                      value === 'Shipped' ? 'secondary' :
                                      value === 'Low' ? 'destructive' :
                                      'outline'
                                    }>
                                      {String(value)}
                                    </Badge>
                                  ) : String(value)
                                }
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}