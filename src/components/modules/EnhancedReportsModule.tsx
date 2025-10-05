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
  AlertCircle,
  CheckCircle,
  Clock,
  Target,
  RefreshCw,
  X
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, Legend } from 'recharts';
import { toast } from "sonner";

import { fetchGSTINOptions, getCompanyPlaceOfSupply, type GSTINOption } from '@/lib/gstinUtils';
import { MetricsCard } from '@/components/reports/MetricsCard';
import { ChartWrapper } from '@/components/reports/ChartWrapper';
import { EnhancedTable, formatCurrency, formatDate, formatStatus } from '@/components/reports/EnhancedTable';
import { CHART_COLOR_ARRAY, customTooltipStyle, formatCurrencyTooltip, chartAnimationConfig, gridStyle, axisStyle } from '@/lib/chartConfig';

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

const CHART_COLORS = CHART_COLOR_ARRAY;

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
      { id: 'rcm_report', name: 'RCM Report', description: 'Reverse Charge Mechanism report', category: 'finance', requiresFilters: ['dateRange'] },
      { id: 'credit_debit_notes', name: 'Credit/Debit Notes', description: 'Credit and debit notes summary', category: 'finance', requiresFilters: ['dateRange'] },
      { id: 'hsn_tax_summary', name: 'HSN / Tax Summary', description: 'HSN-wise tax summary', category: 'finance', requiresFilters: ['dateRange'] },
      { id: 'gstr9', name: 'GSTR-9 (Annual Return)', description: 'Annual GST return', category: 'finance', requiresFilters: ['dateRange'] }
    ]
  },
  {
    id: 'sales',
    name: 'Sales & Procurement',
    icon: ShoppingCart,
    reports: [
      { id: 'customer_sales', name: 'Customer Sales', description: 'Customer-wise sales analysis', category: 'sales', requiresFilters: ['dateRange'], dataFields: ['customer', 'totalSales', 'orderCount'] },
      { id: 'purchase_orders', name: 'Purchase Orders', description: 'Purchase orders analysis', category: 'sales', requiresFilters: ['dateRange'], dataFields: ['orderNumber', 'vendor', 'amount', 'status'] },
      { id: 'quotation_comparison', name: 'Quotation Comparison', description: 'Vendor quotation comparison', category: 'sales', requiresFilters: ['dateRange'] }
    ]
  },
  {
    id: 'inventory',
    name: 'Inventory & Production',
    icon: Package,
    reports: [
      { id: 'current_stock', name: 'Current Stock', description: 'Current stock levels', category: 'inventory', dataFields: ['product', 'currentStock', 'minStock', 'maxStock'] },
      { id: 'low_stock_items', name: 'Low Stock Items', description: 'Items with stock below minimum threshold across all warehouses', category: 'inventory', dataFields: ['product', 'warehouse', 'currentStock', 'minStock', 'maxStock', 'shortage', 'severity'] },
      { id: 'stock_movement', name: 'Stock Movement / Ledger', description: 'Stock movement transactions', category: 'inventory', requiresFilters: ['dateRange'], dataFields: ['product', 'transaction', 'quantity', 'balance'] },
      { id: 'stock_aging', name: 'Stock Aging', description: 'Stock aging analysis', category: 'inventory', dataFields: ['product', 'age', 'quantity', 'value'] },
      { id: 'backorder_report', name: 'Backorder Report', description: 'Customer backorders pending fulfillment', category: 'inventory', requiresFilters: ['dateRange'], dataFields: ['customer', 'product', 'quantity', 'status'] },
      { id: 'bom_consumption', name: 'BOM Consumption', description: 'Bill of materials consumption', category: 'inventory', requiresFilters: ['dateRange'], dataFields: ['product', 'consumed', 'cost'] }
    ]
  }
];

export function EnhancedReportsModule() {
  const { hasAccess, loading: authLoading } = useBusinessAuth();
  const { company } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>('finance');
  const [selectedReport, setSelectedReport] = useState<string>('ar_aging');
  const [openCategories, setOpenCategories] = useState<string[]>(['finance']);
  const [filters, setFilters] = useState<FilterState>({
    dateRange: {
      from: new Date('2025-09-01'),
      to: new Date('2025-09-30')
    }
  });
  const [reportData, setReportData] = useState<any[] | any>([]);
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

  const fetchStockAgingData = async () => {
    if (!company?.id) {
      return { tableData: [], chartData: [] };
    }

    // Fetch stock aging data with products
    const { data: agingData, error: agingError } = await supabase
      .from('current_stock_with_aging')
      .select(`
        *,
        products!inner(
          name,
          sku,
          product_category,
          product_type,
          weight_kg,
          volume_cubic_cm,
          hsn_code,
          gst_percentage,
          mrp,
          unit_price,
          cost_price,
          category_id,
          company_id
        )
      `)
      .eq('products.company_id', company.id)
      .gt('current_stock', 0);

    if (agingError) throw agingError;

    // Fetch all warehouse bins for this company
    const { data: warehouseBins } = await supabase
      .from('warehouse_bins')
      .select('*')
      .eq('company_id', company.id);

    const warehouseBinMap = new Map(warehouseBins?.map(wb => [wb.id, wb]) || []);

    // Fetch product categories
    const { data: categories } = await supabase
      .from('product_categories')
      .select('id, name')
      .eq('company_id', company.id);

    const categoryMap = new Map(categories?.map(cat => [cat.id, cat.name]) || []);

    // Process aging data
    const tableData = agingData?.map((stock: any) => {
      const product = stock.products;
      if (!product) return null;

      // Get warehouse and bin info
      const warehouseBin = warehouseBinMap.get(stock.warehouse_id);
      const binInfo = stock.bin_id ? warehouseBinMap.get(stock.bin_id) : null;
      
      const warehouseDisplay = warehouseBin?.warehouse_name 
        ? `${warehouseBin.warehouse_name}${warehouseBin.warehouse_code ? ` (${warehouseBin.warehouse_code})` : ''}`
        : 'N/A';
      
      const binDisplay = binInfo?.bin_name
        ? `${binInfo.bin_name}${binInfo.wh_bin_code ? ` (${binInfo.wh_bin_code})` : ''}`
        : (warehouseBin?.bin_name 
          ? `${warehouseBin.bin_name}${warehouseBin.wh_bin_code ? ` (${warehouseBin.wh_bin_code})` : ''}`
          : 'N/A');

      const categoryName = product.category_id ? (categoryMap.get(product.category_id) || 'N/A') : 'N/A';

      // Calculate total value
      const totalValue = (stock.aging_0_30_value || 0) + 
                        (stock.aging_31_90_value || 0) + 
                        (stock.aging_91_180_value || 0) + 
                        (stock.aging_181_365_value || 0) + 
                        (stock.aging_365_plus_value || 0);

      return {
        productName: product.name,
        sku: product.sku,
        productType: product.product_type || 'N/A',
        category: categoryName,
        weightKg: product.weight_kg || 0,
        volumeWeight: product.volume_cubic_cm || 0,
        hsnSacCode: product.hsn_code || 'N/A',
        gstRatePercent: product.gst_percentage || 0,
        costPrice: product.cost_price || 0,
        mrp: product.mrp || 0,
        sellingPrice: product.unit_price || 0,
        warehouseNameAndCode: warehouseDisplay,
        binLocationAndCode: binDisplay,
        currentStock: stock.current_stock || 0,
        // Fresh (0-30 days)
        freshQty: stock.aging_0_30_qty || 0,
        freshValue: stock.aging_0_30_value || 0,
        // Good (31-90 days)
        goodQty: stock.aging_31_90_qty || 0,
        goodValue: stock.aging_31_90_value || 0,
        // Aging (91-180 days)
        agingQty: stock.aging_91_180_qty || 0,
        agingValue: stock.aging_91_180_value || 0,
        // Slow (181-365 days)
        slowQty: stock.aging_181_365_qty || 0,
        slowValue: stock.aging_181_365_value || 0,
        // Dead Stock (365+ days)
        deadStockQty: stock.aging_365_plus_qty || 0,
        deadStockValue: stock.aging_365_plus_value || 0,
        // Summary
        weightedAvgAgeDays: stock.weighted_avg_age_days || 0,
        agingStatus: stock.aging_status || 'N/A',
        totalValue: totalValue
      };
    }).filter(Boolean) || [];

    // Chart data by aging buckets
    const agingBuckets = tableData.reduce((acc: any, item: any) => {
      acc.fresh = (acc.fresh || 0) + (item.freshValue || 0);
      acc.good = (acc.good || 0) + (item.goodValue || 0);
      acc.aging = (acc.aging || 0) + (item.agingValue || 0);
      acc.slow = (acc.slow || 0) + (item.slowValue || 0);
      acc.deadStock = (acc.deadStock || 0) + (item.deadStockValue || 0);
      return acc;
    }, {});

    const total = agingBuckets.fresh + agingBuckets.good + agingBuckets.aging + agingBuckets.slow + agingBuckets.deadStock;
    
    const chartData = [
      { 
        name: 'Fresh (0-30 days)', 
        value: agingBuckets.fresh, 
        percentage: total ? Math.round((agingBuckets.fresh / total) * 100) : 0 
      },
      { 
        name: 'Good (31-90 days)', 
        value: agingBuckets.good, 
        percentage: total ? Math.round((agingBuckets.good / total) * 100) : 0 
      },
      { 
        name: 'Aging (91-180 days)', 
        value: agingBuckets.aging, 
        percentage: total ? Math.round((agingBuckets.aging / total) * 100) : 0 
      },
      { 
        name: 'Slow (181-365 days)', 
        value: agingBuckets.slow, 
        percentage: total ? Math.round((agingBuckets.slow / total) * 100) : 0 
      },
      { 
        name: 'Dead Stock (365+ days)', 
        value: agingBuckets.deadStock, 
        percentage: total ? Math.round((agingBuckets.deadStock / total) * 100) : 0 
      }
    ];

    return { tableData, chartData };
  };

  const fetchBackorderReportData = async (filters: FilterState) => {
    if (!company?.id) {
      return { tableData: [], chartData: [] };
    }

    // Fetch sales order items with pending/backorder quantities
    const { data: orderItems, error: itemsError } = await supabase
      .from('sales_order_items')
      .select(`
        *,
        sales_orders!inner(
          id,
          order_number,
          order_date,
          customer_id,
          status,
          total_amount
        ),
        products!inner(
          name,
          sku,
          unit,
          hsn_code
        )
      `)
      .eq('sales_orders.company_id', company.id)
      .gt('back_order_quantity', 0)
      .gte('sales_orders.order_date', format(filters.dateRange.from, 'yyyy-MM-dd'))
      .lte('sales_orders.order_date', format(filters.dateRange.to, 'yyyy-MM-dd'))
      .order('order_date', { ascending: false, foreignTable: 'sales_orders' });

    if (itemsError) throw itemsError;

    // Get unique customer IDs to fetch customer details
    const customerIds = [...new Set(orderItems?.map(item => item.sales_orders.customer_id).filter(Boolean))];
    
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name, customer_ref')
      .in('id', customerIds);

    const customerMap = new Map(customers?.map(c => [c.id, c]) || []);

    // Fetch delivered quantities from sales invoices
    const orderItemIds = orderItems?.map(item => item.id) || [];
    const { data: invoiceItems } = await supabase
      .from('sales_invoice_items')
      .select(`
        product_id,
        quantity_invoiced,
        sales_invoices!inner(
          sales_order_id,
          status
        )
      `)
      .in('sales_invoices.sales_order_id', [...new Set(orderItems?.map(item => item.sales_orders.id))])
      .eq('sales_invoices.status', 'finalized');

    // Calculate delivered quantities by order and product
    const deliveredQtyMap = new Map<string, number>();
    invoiceItems?.forEach((invoiceItem: any) => {
      const key = `${invoiceItem.sales_invoices.sales_order_id}_${invoiceItem.product_id}`;
      deliveredQtyMap.set(key, (deliveredQtyMap.get(key) || 0) + (invoiceItem.quantity_invoiced || 0));
    });

    // Process data
    const tableData = orderItems?.map((item: any) => {
      const order = item.sales_orders;
      const product = item.products;
      const customer = customerMap.get(order.customer_id);
      
      // Calculate quantities
      const orderedQty = item.quantity || item.ordered_quantity || 0;
      const deliveredKey = `${order.id}_${item.product_id}`;
      const deliveredQty = deliveredQtyMap.get(deliveredKey) || 0;
      const pendingQty = item.back_order_quantity || (orderedQty - deliveredQty);
      
      // Calculate financial details
      const unitPrice = item.unit_price || 0;
      const discountPercentage = item.discount_percentage || 0;
      const gstRate = (item.cgst_rate || 0) + (item.sgst_rate || 0) + (item.igst_rate || 0);
      
      // Calculate taxable amount (after discount, before tax)
      const lineSubtotal = orderedQty * unitPrice;
      const discountAmount = (lineSubtotal * discountPercentage) / 100;
      const taxableAmount = lineSubtotal - discountAmount;
      
      // Total order line amount (with tax)
      const totalLineAmount = item.total_price || taxableAmount * (1 + gstRate / 100);
      
      // Pending order amount
      const pendingAmount = (pendingQty * unitPrice * (1 - discountPercentage / 100)) * (1 + gstRate / 100);
      
      // Calculate days pending
      const orderDate = new Date(order.order_date);
      const daysPending = Math.floor((new Date().getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));

      return {
        customerName: customer?.name || 'Unknown',
        customerRef: customer?.customer_ref || 'N/A',
        salesOrderNo: order.order_number || 'N/A',
        salesOrderDate: format(new Date(order.order_date), 'dd-MMM-yyyy'),
        productName: product?.name || 'Unknown',
        productSku: product?.sku || 'N/A',
        hsnCode: product?.hsn_code || 'N/A',
        unit: product?.unit || 'pcs',
        orderedQty: orderedQty,
        deliveredQty: deliveredQty,
        pendingQty: pendingQty,
        unitPrice: unitPrice,
        gstPercentage: gstRate,
        discountPercentage: discountPercentage,
        taxableAmount: Math.round(taxableAmount * 100) / 100,
        totalSalesOrderAmount: Math.round(totalLineAmount * 100) / 100,
        pendingOrderAmount: Math.round(pendingAmount * 100) / 100,
        orderStatus: order.status || 'confirmed',
        daysPending: daysPending,
        priority: daysPending > 30 ? 'High' : daysPending > 15 ? 'Medium' : 'Low'
      };
    }) || [];

    // Chart data - Pending amount by customer (Top 5)
    const customerPendingMap = new Map<string, { name: string; amount: number; count: number }>();
    tableData.forEach(item => {
      const existing = customerPendingMap.get(item.customerName) || { name: item.customerName, amount: 0, count: 0 };
      existing.amount += item.pendingOrderAmount;
      existing.count += 1;
      customerPendingMap.set(item.customerName, existing);
    });

    const customerChartData = Array.from(customerPendingMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map(item => ({
        name: item.name,
        value: Math.round(item.amount * 100) / 100,
        count: item.count
      }));

    // Product pending quantity chart (Top 10)
    const productPendingMap = new Map<string, { name: string; quantity: number; amount: number }>();
    tableData.forEach(item => {
      const existing = productPendingMap.get(item.productName) || { name: item.productName, quantity: 0, amount: 0 };
      existing.quantity += item.pendingQty;
      existing.amount += item.pendingOrderAmount;
      productPendingMap.set(item.productName, existing);
    });

    const productChartData = Array.from(productPendingMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)
      .map(item => ({
        name: item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name,
        quantity: item.quantity,
        value: Math.round(item.amount * 100) / 100
      }));

    const chartData = [
      { type: 'customer', data: customerChartData },
      { type: 'product', data: productChartData }
    ];

    return { tableData, chartData };
  };

  const fetchBOMConsumptionData = async (filters: FilterState) => {
    if (!company?.id) {
      return { tableData: [], chartData: [] };
    }

    // Fetch production runs with BOM details
    const { data: productionRuns, error: productionError } = await supabase
      .from('production_runs')
      .select(`
        *,
        bom_headers!inner(
          bom_name,
          version,
          finished_product_id,
          products!bom_headers_finished_product_id_fkey(
            name,
            sku
          )
        )
      `)
      .eq('company_id', company.id)
      .gte('created_at', format(filters.dateRange.from, 'yyyy-MM-dd'))
      .lte('created_at', format(filters.dateRange.to, 'yyyy-MM-dd'))
      .order('created_at', { ascending: false });

    if (productionError) throw productionError;

    // Fetch BOM components for each BOM
    const bomIds = [...new Set(productionRuns?.map(pr => pr.bom_id) || [])];
    let bomComponents: any[] = [];

    if (bomIds.length > 0) {
      const { data: components } = await supabase
        .from('bom_components')
        .select(`
          *,
          products!bom_components_component_product_id_fkey(
            name,
            sku,
            unit
          )
        `)
        .in('bom_id', bomIds);
      
      bomComponents = components || [];
    }

    // Fetch warehouse bins
    const { data: warehouseBins } = await supabase
      .from('warehouse_bins')
      .select('*')
      .eq('company_id', company.id);

    const warehouseBinMap = new Map(warehouseBins?.map(wb => [wb.id, wb]) || []);

    // Process production run data
    const tableData: any[] = [];
    
    productionRuns?.forEach((run: any) => {
      const bomHeader = run.bom_headers;
      const finishedProduct = bomHeader?.products;
      
      // Get warehouse and bin info
      const warehouseBin = run.warehouse_id ? warehouseBinMap.get(run.warehouse_id) : null;
      const binInfo = run.bin_id ? warehouseBinMap.get(run.bin_id) : null;
      
      const warehouseDisplay = warehouseBin?.warehouse_name 
        ? `${warehouseBin.warehouse_name}${warehouseBin.warehouse_code ? ` (${warehouseBin.warehouse_code})` : ''}`
        : 'Not Assigned';
      
      const binDisplay = binInfo?.bin_name
        ? `${binInfo.bin_name}${binInfo.wh_bin_code ? ` (${binInfo.wh_bin_code})` : ''}`
        : 'Not Assigned';

      // Get components for this BOM
      const components = bomComponents.filter(c => c.bom_id === run.bom_id);
      
      components.forEach((component: any) => {
        const componentProduct = component.products;
        const consumedQty = Math.ceil(component.quantity_per_unit * (run.quantity_produced || 0));
        const consumedValue = consumedQty * (component.unit_cost || 0);

        tableData.push({
          productionDate: format(new Date(run.created_at), 'dd-MMM-yyyy'),
          bomName: bomHeader?.bom_name || 'N/A',
          bomVersion: bomHeader?.version || 'N/A',
          finishedProduct: finishedProduct?.name || 'Unknown',
          finishedProductSku: finishedProduct?.sku || 'N/A',
          quantityProduced: run.quantity_produced || 0,
          componentName: componentProduct?.name || 'Unknown Component',
          componentSku: componentProduct?.sku || 'N/A',
          componentUnit: componentProduct?.unit || 'pcs',
          qtyPerUnit: component.quantity_per_unit || 0,
          totalConsumed: consumedQty,
          unitCost: component.unit_cost || 0,
          totalCost: consumedValue,
          warehouseNameAndCode: warehouseDisplay,
          binLocationAndCode: binDisplay,
          materialCost: run.material_cost_total || 0,
          laborCost: run.labor_cost_total || 0,
          overheadCost: run.overhead_cost_total || 0,
          totalProductionCost: run.total_cost || 0
        });
      });
    });

    // Chart data by finished product
    const productionByProduct = tableData.reduce((acc: any, item: any) => {
      const key = item.finishedProduct;
      if (!acc[key]) {
        acc[key] = {
          name: key,
          totalCost: 0,
          quantityProduced: 0,
          productionRuns: 0
        };
      }
      acc[key].totalCost += item.totalCost || 0;
      return acc;
    }, {});

    // Add quantity produced
    productionRuns?.forEach((run: any) => {
      const finishedProduct = run.bom_headers?.products?.name || 'Unknown';
      if (productionByProduct[finishedProduct]) {
        productionByProduct[finishedProduct].quantityProduced = 
          (productionByProduct[finishedProduct].quantityProduced || 0) + (run.quantity_produced || 0);
        productionByProduct[finishedProduct].productionRuns += 1;
      }
    });

    const chartData = Object.values(productionByProduct)
      .sort((a: any, b: any) => b.totalCost - a.totalCost)
      .slice(0, 10);

    return { tableData, chartData };
  };

  const fetchCurrentStockData = async () => {
    if (!company?.id) {
      return { tableData: [], chartData: [] };
    }

    // Fetch current stock with products
    const { data: stockData, error: stockError } = await supabase
      .from('current_stock_levels')
      .select(`
        *,
        products!inner(
          name,
          sku,
          product_category,
          product_type,
          weight_kg,
          volume_cubic_cm,
          hsn_code,
          gst_percentage,
          mrp,
          unit_price,
          cost_price,
          min_stock_level,
          max_stock_level,
          category_id,
          company_id
        )
      `)
      .eq('products.company_id', company.id);

    if (stockError) throw stockError;

    // Fetch all warehouse bins for this company
    const { data: warehouseBins } = await supabase
      .from('warehouse_bins')
      .select('*')
      .eq('company_id', company.id);

    const warehouseBinMap = new Map(warehouseBins?.map(wb => [wb.id, wb]) || []);

    // Fetch product categories
    const { data: categories } = await supabase
      .from('product_categories')
      .select('id, name')
      .eq('company_id', company.id);

    const categoryMap = new Map(categories?.map(cat => [cat.id, cat.name]) || []);

    // Fetch average purchase costs from GRN line items (non-blocking)
    const avgPurchaseCosts = new Map<string, number>();
    try {
      const { data: grnData } = await supabase
        .from('grn_line_items')
        .select(`
          product_id,
          accepted_quantity,
          unit_price,
          grn_header!inner(company_id, status)
        `)
        .eq('grn_header.company_id', company.id)
        .in('grn_header.status', ['accepted', 'received', 'partially_received']);

      if (grnData) {
        const productPurchaseData = new Map<string, { totalCost: number; totalQty: number }>();
        
        grnData.forEach((item: any) => {
          const existing = productPurchaseData.get(item.product_id) || { totalCost: 0, totalQty: 0 };
          existing.totalCost += (item.accepted_quantity || 0) * (item.unit_price || 0);
          existing.totalQty += (item.accepted_quantity || 0);
          productPurchaseData.set(item.product_id, existing);
        });

        productPurchaseData.forEach((data, productId) => {
          if (data.totalQty > 0) {
            avgPurchaseCosts.set(productId, data.totalCost / data.totalQty);
          }
        });
      }
    } catch (error) {
      console.warn('Could not fetch average purchase costs:', error);
      // Continue without average costs
    }

    // Process stock data
    const tableData = stockData?.map((stock: any) => {
      const product = stock.products;
      if (!product) return null;

      const currentStock = stock.current_stock || 0;
      const stockStatus = currentStock <= (product.min_stock_level || 0) ? 'Low' :
                         currentStock >= (product.max_stock_level || product.min_stock_level * 10) ? 'Overstock' : 'Good';
      
      // Get warehouse and bin info
      const warehouseBin = warehouseBinMap.get(stock.warehouse_id);
      const binInfo = stock.bin_id ? warehouseBinMap.get(stock.bin_id) : null;
      
      const warehouseDisplay = warehouseBin?.warehouse_name 
        ? `${warehouseBin.warehouse_name}${warehouseBin.warehouse_code ? ` (${warehouseBin.warehouse_code})` : ''}`
        : 'N/A';
      
      const binDisplay = binInfo?.bin_name
        ? `${binInfo.bin_name}${binInfo.wh_bin_code ? ` (${binInfo.wh_bin_code})` : ''}`
        : (warehouseBin?.bin_name 
          ? `${warehouseBin.bin_name}${warehouseBin.wh_bin_code ? ` (${warehouseBin.wh_bin_code})` : ''}`
          : 'N/A');

      const categoryName = product.category_id ? (categoryMap.get(product.category_id) || 'N/A') : 'N/A';
      const avgPurchaseCost = avgPurchaseCosts.get(stock.product_id) || 0;

      return {
        product: product.name,
        sku: product.sku,
        warehouseNameWithCode: warehouseDisplay,
        binLocationWithCode: binDisplay,
        productType: product.product_type || 'N/A',
        weightKg: product.weight_kg || 0,
        volumeWeight: product.volume_cubic_cm || 0,
        hsnSacCode: product.hsn_code || 'N/A',
        gstRatePercent: product.gst_percentage || 0,
        category: categoryName,
        mrp: product.mrp || 0,
        sellingPrice: product.unit_price || 0,
        averageCostPerUnit: avgPurchaseCost,
        currentStock: currentStock,
        minStock: product.min_stock_level || 0,
        maxStock: product.max_stock_level || (product.min_stock_level || 0) * 10,
        value: currentStock * (product.cost_price || 0),
        costPrice: product.cost_price || 0,
        status: stockStatus
      };
    }).filter(Boolean) || [];

    // Chart data by status
    const statusCounts = tableData.reduce((acc: Record<string, number>, item: any) => {
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

  // Fetch Low Stock Items Data
  const fetchLowStockItemsData = async () => {
    try {
      const { data: stockData, error } = await supabase
        .from('current_stock_with_aging')
        .select(`
          product_id,
          current_stock,
          warehouse_id,
          bin_id,
          last_transaction_date,
          products!inner(
            name, sku, min_stock_level, max_stock_level,
            cost_price, company_id
          )
        `)
        .eq('products.company_id', company.id);

      if (error) throw error;

      // Filter items where current stock < min stock level
      const lowStockItems = stockData?.filter(item => 
        item.products.min_stock_level && 
        item.current_stock < item.products.min_stock_level
      ) || [];

      // Fetch warehouse bin information using bin_id
      const binIds = [...new Set(lowStockItems.map(item => item.bin_id).filter(Boolean))];
      const { data: warehouseBins } = await supabase
        .from('warehouse_bins')
        .select('id, warehouse_name, bin_name, wh_bin_code')
        .in('id', binIds);

      const binMap = new Map(warehouseBins?.map(w => [w.id, w]) || []);

      // Calculate severity for each item
      const calculateSeverity = (current: number, min: number) => {
        if (!min || min === 0) return { level: 'Warning', color: 'warning', bgColor: 'bg-yellow-50' };
        const ratio = current / min;
        if (ratio < 0.25) return { level: 'Critical', color: 'destructive', bgColor: 'bg-red-50' };
        if (ratio < 0.50) return { level: 'Low', color: 'warning', bgColor: 'bg-orange-50' };
        return { level: 'Warning', color: 'secondary', bgColor: 'bg-yellow-50' };
      };

      const tableData = lowStockItems.map(item => {
        const bin = binMap.get(item.bin_id);
        const severity = calculateSeverity(item.current_stock, item.products.min_stock_level || 0);
        const shortageQty = (item.products.min_stock_level || 0) - item.current_stock;
        const shortageValue = shortageQty * (item.products.cost_price || 0);

        return {
          productId: item.product_id,
          productName: item.products.name,
          sku: item.products.sku,
          warehouseId: item.warehouse_id,
          warehouseName: bin?.warehouse_name || 'Unknown Warehouse',
          binCode: bin?.wh_bin_code || bin?.bin_name || 'N/A',
          currentStock: item.current_stock,
          minStock: item.products.min_stock_level || 0,
          maxStock: item.products.max_stock_level || 0,
          shortageQty,
          shortageValue,
          severity: severity.level,
          severityColor: severity.color,
          severityBgColor: severity.bgColor,
          lastTransactionDate: item.last_transaction_date,
          stockRatio: item.products.min_stock_level ? (item.current_stock / item.products.min_stock_level) * 100 : 0
        };
      });

      // Sort: Zero stock first, then by shortage quantity
      tableData.sort((a, b) => {
        if (a.currentStock === 0 && b.currentStock !== 0) return -1;
        if (a.currentStock !== 0 && b.currentStock === 0) return 1;
        return b.shortageQty - a.shortageQty;
      });

      // Calculate summary metrics
      const criticalCount = tableData.filter(item => item.severity === 'Critical').length;
      const totalShortageValue = tableData.reduce((sum, item) => sum + item.shortageValue, 0);
      const warehousesAffected = new Set(tableData.map(item => item.warehouseId)).size;

      // Chart data for severity distribution
      const criticalItems = tableData.filter(item => item.severity === 'Critical').length;
      const lowItems = tableData.filter(item => item.severity === 'Low').length;
      const warningItems = tableData.filter(item => item.severity === 'Warning').length;

      const chartData = [
        { name: 'Critical', value: criticalItems, color: '#ef4444' },
        { name: 'Low', value: lowItems, color: '#f97316' },
        { name: 'Warning', value: warningItems, color: '#eab308' }
      ].filter(item => item.value > 0);

      return {
        tableData,
        chartData,
        summary: {
          totalLowStockItems: tableData.length,
          criticalItems: criticalCount,
          totalShortageValue,
          warehousesAffected
        }
      };
    } catch (error) {
      console.error('Error fetching low stock items:', error);
      return { tableData: [], chartData: [], summary: {} };
    }
  };

  const fetchCustomerSalesData = async (filters: FilterState) => {
    console.log('=== fetchCustomerSalesData START ===');
    console.log('Filters received:', filters);

    if (!authLoading && !hasAccess('reports')) {    
      throw new Error('Access denied');
    }

    // First, fetch sales invoices with customer information
    const { data: salesInvoices, error: invoicesError } = await supabase
      .from('sales_invoices')
      .select(`
        id,
        invoice_number,
        invoice_date,
        customer_name,
        customer_id,
        status,
        total_amount,
        customers(
          name,
          state,
          gstin
        )
      `)
      .eq('status', 'finalized')
      .gte('invoice_date', format(filters.dateRange.from, 'yyyy-MM-dd'))
      .lte('invoice_date', format(filters.dateRange.to, 'yyyy-MM-dd'));

    if (invoicesError) {
      console.error('Error fetching sales invoices:', invoicesError);
      throw invoicesError;
    }

    if (!salesInvoices || salesInvoices.length === 0) {
      return { 
        tableData: [], 
        chartData: [],
        summary: {
          totalRecords: 0,
          totalInvoiceValue: 0,
          totalTaxableAmount: 0,
          totalTaxAmount: 0
        }
      };
    }

    // Get invoice IDs for fetching line items
    const invoiceIds = salesInvoices.map(inv => inv.id);

    // Fetch sales invoice items separately
    const { data: salesItems, error: itemsError } = await supabase
      .from('sales_invoice_items')
      .select('*')
      .in('sales_invoice_id', invoiceIds);

    if (itemsError) {
      console.error('Error fetching sales items:', itemsError);
      throw itemsError;
    }

    // Fetch products separately to get additional product info
    const productIds = [...new Set(salesItems?.map(item => item.product_id).filter(Boolean))];
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, sku, gst_percentage')
      .in('id', productIds);

    if (productsError) {
      console.error('Error fetching products:', productsError);
      // Don't throw error for products, continue with available data
    }

    // Get company information for place of supply comparison
    const { data: companyData } = await supabase
      .from('companies')
      .select('state')
      .limit(1)
      .single();

    const companyState = companyData?.state || '';

    // Create lookup maps for better performance
    const invoiceMap = new Map(salesInvoices.map(inv => [inv.id, inv]));
    const productMap = new Map(products?.map(prod => [prod.id, prod]) || []);

    console.log('Raw sales items count:', salesItems?.length || 0);
    console.log('Invoices count:', salesInvoices?.length || 0);
    console.log('Products count:', products?.length || 0);

    // Transform data for detailed customer sales report
    const tableData = (salesItems || [])
      .map((item: any, index: number) => {
        const invoice = invoiceMap.get(item.sales_invoice_id);
        const product = productMap.get(item.product_id);
        
        if (!invoice) return null; // Skip items without invoice data
        
        const customer = invoice.customers;
        
        // Determine place of supply and tax type
        const customerState = customer?.state || '';
        const isInterState = companyState && customerState && companyState !== customerState;
        
        // Calculate tax amounts based on rates from the item
        const taxableAmount = item.line_subtotal || 0;
        const cgstAmount = item.cgst_amount || 0;
        const sgstAmount = item.sgst_amount || 0;
        const igstAmount = item.igst_amount || 0;
        const totalTaxAmount = cgstAmount + sgstAmount + igstAmount;
        
        return {
          itemNo: index + 1,
          customerName: invoice.customer_name || 'Unknown Customer',
          invoiceNumber: invoice.invoice_number || 'N/A',
          invoiceDate: format(new Date(invoice.invoice_date), 'dd-MMM-yyyy'),
          product: product?.name || item.product_name || 'Unknown Product',
          sku: product?.sku || 'N/A',
          gstPercent: item.cgst_rate && item.sgst_rate ? (item.cgst_rate + item.sgst_rate) : (item.igst_rate || 0),
          qtyInvoiced: item.quantity_invoiced || 0,
          invoiceValue: item.line_total || 0,
          taxableAmount: taxableAmount,
          cgst: cgstAmount,
          sgst: sgstAmount,
          igst: igstAmount,
          placeOfSupply: customerState || 'Not Specified'
        };
      })
      .filter(Boolean) // Remove null entries
      .sort((a: any, b: any) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());

    // Calculate summary statistics
    const summary = {
      totalRecords: tableData.length,
      totalInvoiceValue: tableData.reduce((sum, item) => sum + (item.invoiceValue || 0), 0),
      totalTaxableAmount: tableData.reduce((sum, item) => sum + (item.taxableAmount || 0), 0),
      totalTaxAmount: tableData.reduce((sum, item) => sum + (item.cgst || 0) + (item.sgst || 0) + (item.igst || 0), 0)
    };

    // Create month-on-month chart data based on invoice values
    const monthlyData = tableData.reduce((acc: Record<string, number>, item) => {
      const invoiceDate = item.invoiceDate.replace(/(\d{2})-(\w{3})-(\d{4})/, '$2 $3'); // Convert "25-Sep-2025" to "Sep 2025"
      acc[invoiceDate] = (acc[invoiceDate] || 0) + (item.invoiceValue || 0);
      return acc;
    }, {});

    const chartData = Object.entries(monthlyData)
      .map(([month, value]) => ({
        name: month,
        value: value
      }))
      .sort((a, b) => {
        const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const [monthA, yearA] = a.name.split(' ');
        const [monthB, yearB] = b.name.split(' ');
        const yearDiff = parseInt(yearA) - parseInt(yearB);
        if (yearDiff !== 0) return yearDiff;
        return monthOrder.indexOf(monthA) - monthOrder.indexOf(monthB);
      });

    console.log('Final result - Table data count:', tableData.length);
    console.log('Final result - Chart data count:', chartData.length);
    console.log('Monthly sales data:', chartData);
    console.log('=== fetchCustomerSalesData END ===');

    return { tableData, chartData, summary };
  };

  const fetchGSTR3BData = async (filters: FilterState) => {
    console.log('=== fetchGSTR3BData START ===');
    console.log('Filters received:', filters);

    if (!authLoading && !hasAccess('reports')) {
      throw new Error('Access denied');
    }

    // Get company information for GSTIN and place of supply  
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .select('name, gstn, state')
      .limit(1)
      .single();

    if (companyError) {
      console.error('Error fetching company data:', companyError);
      throw companyError;
    }

    const companyGSTIN = companyData?.gstn || '';
    const companyState = companyData?.state || '';

    // Fetch Sales Invoices for outward supplies
    const { data: salesInvoices, error: salesError } = await supabase
      .from('sales_invoices')
      .select(`
        *,
        sales_invoice_items(
          *
        ),
        customers(name, customer_type, gstin, state)
      `)
      .eq('status', 'finalized')
      .gte('invoice_date', format(filters.dateRange.from, 'yyyy-MM-dd'))
      .lte('invoice_date', format(filters.dateRange.to, 'yyyy-MM-dd'));

    if (salesError) {
      console.error('Error fetching sales invoices:', salesError);
      throw salesError;
    }

    // Fetch Purchase Orders (for input tax credit approximation)
    const { data: purchaseOrders, error: purchaseError } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        purchase_order_items(*),
        suppliers(name, gst_number, state)
      `)
      .gte('order_date', format(filters.dateRange.from, 'yyyy-MM-dd'))
      .lte('order_date', format(filters.dateRange.to, 'yyyy-MM-dd'));

    if (purchaseError) {
      console.error('Error fetching purchase orders:', purchaseError);
      throw purchaseError;
    }

    // Initialize GSTR-3B sections
    let table3_1_taxableSupplies = 0;
    let table3_1_integratedTax = 0;
    let table3_1_centralTax = 0;
    let table3_1_stateTax = 0;
    let table3_1_cessAmount = 0;

    let table3_2_reverseChargeSupplies = 0;
    let table3_2_integratedTax = 0;
    let table3_2_centralTax = 0;
    let table3_2_stateTax = 0;

    let table4A_itcAvailed_igst = 0;
    let table4A_itcAvailed_cgst = 0;
    let table4A_itcAvailed_sgst = 0;
    let table4A_itcAvailed_cess = 0;

    let table5_nilRatedSupplies = 0;
    let table5_exemptSupplies = 0;
    let table5_nonGSTSupplies = 0;

    // Process Sales Invoices (Outward Supplies)
    salesInvoices?.forEach(invoice => {
      // Calculate invoice totals from line items
      let invoiceTaxableValue = 0;
      let invoiceCGST = 0;
      let invoiceSGST = 0;
      let invoiceIGST = 0;
      let invoiceCESS = 0;
      let hasAnyTax = false;

      invoice.sales_invoice_items?.forEach((item: any) => {
        const itemTaxableValue = (item.unit_price * item.quantity_invoiced) - (item.discount_amount || 0);
        invoiceTaxableValue += itemTaxableValue;
        invoiceCGST += item.cgst_amount || 0;
        invoiceSGST += item.sgst_amount || 0;
        invoiceIGST += item.igst_amount || 0;
        
        if ((item.cgst_amount || 0) > 0 || (item.sgst_amount || 0) > 0 || (item.igst_amount || 0) > 0) {
          hasAnyTax = true;
        }
      });

      // Check if it's inter-state or intra-state
      const customerState = invoice.customers?.state || '';
      const isInterState = customerState !== companyState;

      if (hasAnyTax) {
        // Regular taxable supplies (Table 3.1)
        table3_1_taxableSupplies += invoiceTaxableValue;
        
        if (isInterState) {
          table3_1_integratedTax += invoiceIGST;
        } else {
          table3_1_centralTax += invoiceCGST;
          table3_1_stateTax += invoiceSGST;
        }
        table3_1_cessAmount += invoiceCESS;
      } else {
        // No tax - classify as exempt/nil/non-GST
        const invoiceValue = invoice.total_amount || 0;
        
        // Simple classification - you may want to enhance this logic
        if (invoice.customers?.customer_type === 'Business') {
          table5_exemptSupplies += invoiceValue;
        } else {
          table5_nilRatedSupplies += invoiceValue;
        }
      }
    });

    // Process Purchase Orders (Approximate ITC - in real scenario use purchase invoices/bills)
    purchaseOrders?.forEach(order => {
      // Note: This is an approximation since we don't have actual purchase bills
      // In practice, you would calculate ITC from actual purchase invoices received
      
      const estimatedTaxRate = 0.18; // 18% GST assumption
      const taxableValue = order.subtotal_amount || 0;
      const estimatedTax = taxableValue * estimatedTaxRate;

        // For simplification, assume 50-50 split between CGST/SGST for intra-state
        const supplierState = order.suppliers?.state || '';
        const isInterState = supplierState !== companyState;

      if (isInterState) {
        table4A_itcAvailed_igst += estimatedTax;
      } else {
        table4A_itcAvailed_cgst += estimatedTax / 2;
        table4A_itcAvailed_sgst += estimatedTax / 2;
      }
    });

    // Calculate net tax liability (Table 6)
    const netIGST = table3_1_integratedTax + table3_2_integratedTax - table4A_itcAvailed_igst;
    const netCGST = table3_1_centralTax + table3_2_centralTax - table4A_itcAvailed_cgst;
    const netSGST = table3_1_stateTax + table3_2_stateTax - table4A_itcAvailed_sgst;
    const netCess = table3_1_cessAmount - table4A_itcAvailed_cess;

    // Prepare GSTR-3B table data
    const tableData = [
      // Table 3.1 - Outward taxable supplies
      {
        section: '3.1',
        description: 'Outward taxable supplies (other than zero rated, nil rated and exempted)',
        natureOfSupplies: 'Taxable',
        totalTaxableValue: table3_1_taxableSupplies,
        integratedTax: table3_1_integratedTax,
        centralTax: table3_1_centralTax,
        stateTax: table3_1_stateTax,
        cess: table3_1_cessAmount
      },
      // Table 3.2 - Inward supplies liable to reverse charge
      {
        section: '3.2',
        description: 'Inward supplies liable to reverse charge (other than 1, 2, 3 & 4 above)',
        natureOfSupplies: 'Reverse Charge',
        totalTaxableValue: table3_2_reverseChargeSupplies,
        integratedTax: table3_2_integratedTax,
        centralTax: table3_2_centralTax,
        stateTax: table3_2_stateTax,
        cess: 0
      },
      // Table 4A - ITC Availed
      {
        section: '4A',
        description: 'ITC availed - All other ITC',
        natureOfSupplies: 'ITC Availed',
        totalTaxableValue: 0,
        integratedTax: table4A_itcAvailed_igst,
        centralTax: table4A_itcAvailed_cgst,
        stateTax: table4A_itcAvailed_sgst,
        cess: table4A_itcAvailed_cess
      },
      // Table 5 - Exempt supplies
      {
        section: '5A',
        description: 'From a supplier under composition scheme, Exempt and Nil rated supply',
        natureOfSupplies: 'Nil/Exempt',
        totalTaxableValue: table5_nilRatedSupplies + table5_exemptSupplies,
        integratedTax: 0,
        centralTax: 0,
        stateTax: 0,
        cess: 0
      },
      {
        section: '5B',
        description: 'Non GST supply',
        natureOfSupplies: 'Non-GST',
        totalTaxableValue: table5_nonGSTSupplies,
        integratedTax: 0,
        centralTax: 0,
        stateTax: 0,
        cess: 0
      },
      // Table 6 - Net Tax Liability
      {
        section: '6.1',
        description: 'Net tax liability',
        natureOfSupplies: 'Net Tax Payable',
        totalTaxableValue: 0,
        integratedTax: Math.max(0, netIGST),
        centralTax: Math.max(0, netCGST),
        stateTax: Math.max(0, netSGST),
        cess: Math.max(0, netCess)
      }
    ];

    // Create summary chart data
    const chartData = [
      { name: 'Outward Supplies', value: table3_1_taxableSupplies, type: 'Taxable' },
      { name: 'Reverse Charge', value: table3_2_reverseChargeSupplies, type: 'Liability' },
      { name: 'ITC Availed', value: table4A_itcAvailed_igst + table4A_itcAvailed_cgst + table4A_itcAvailed_sgst, type: 'Credit' },
      { name: 'Exempt/Nil Rated', value: table5_nilRatedSupplies + table5_exemptSupplies, type: 'Exempt' },
      { name: 'Non-GST', value: table5_nonGSTSupplies, type: 'Non-GST' }
    ];

    console.log('GSTR-3B data processed:', { tableData, chartData });

    return { 
      tableData,
      chartData,
      gstr3bSections: {
        outwardSupplies: {
          taxableValue: table3_1_taxableSupplies,
          igst: table3_1_integratedTax,
          cgst: table3_1_centralTax,
          sgst: table3_1_stateTax,
          cess: table3_1_cessAmount
        },
        reverseChargeSupplies: {
          taxableValue: table3_2_reverseChargeSupplies,
          igst: table3_2_integratedTax,
          cgst: table3_2_centralTax,
          sgst: table3_2_stateTax
        },
        itcAvailed: {
          igst: table4A_itcAvailed_igst,
          cgst: table4A_itcAvailed_cgst,
          sgst: table4A_itcAvailed_sgst,
          cess: table4A_itcAvailed_cess
        },
        exemptSupplies: {
          nilRated: table5_nilRatedSupplies,
          exempt: table5_exemptSupplies,
          nonGST: table5_nonGSTSupplies
        },
        netTaxLiability: {
          igst: Math.max(0, netIGST),
          cgst: Math.max(0, netCGST),
          sgst: Math.max(0, netSGST),
          cess: Math.max(0, netCess)
        }
      },
      summary: {
        totalOutwardSupplies: salesInvoices?.length || 0,
        totalInwardSupplies: purchaseOrders?.length || 0,
        totalTaxableValue: table3_1_taxableSupplies,
        totalTaxLiability: Math.max(0, netIGST) + Math.max(0, netCGST) + Math.max(0, netSGST),
        totalITCAvailed: table4A_itcAvailed_igst + table4A_itcAvailed_cgst + table4A_itcAvailed_sgst,
        gstin: companyGSTIN,
        filingPeriod: `${format(filters.dateRange.from, 'MMM yyyy')} to ${format(filters.dateRange.to, 'MMM yyyy')}`
      }
    };
  };

  const fetchGSTR9Data = async (filters: FilterState) => {
    console.log('=== fetchGSTR9Data START ===');
    console.log('Filters received:', filters);

    if (!authLoading && !hasAccess('reports')) {
      throw new Error('Access denied');
    }

    // Get company information
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .select('name, gstn, state')
      .limit(1)
      .single();

    if (companyError) {
      console.error('Error fetching company data:', companyError);
      throw companyError;
    }

    const companyGSTIN = companyData?.gstn || '';

    // Fetch Annual Sales Data (Outward Supplies) - Table 4
    const { data: salesInvoices, error: salesError } = await supabase
      .from('sales_invoices')
      .select(`
        *,
        sales_invoice_items(
          *
        ),
        customers(name, customer_type, gstin, state)
      `)
      .eq('status', 'finalized')
      .gte('invoice_date', format(filters.dateRange.from, 'yyyy-MM-dd'))
      .lte('invoice_date', format(filters.dateRange.to, 'yyyy-MM-dd'));

    if (salesError) {
      console.error('Error fetching sales invoices:', salesError);
      throw salesError;
    }

    // Fetch Annual Purchase Data (Inward Supplies) - Table 5
    const { data: purchaseOrders, error: purchaseError } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        purchase_order_items(*),
        suppliers(name, gst_number, state)
      `)
      .gte('order_date', format(filters.dateRange.from, 'yyyy-MM-dd'))
      .lte('order_date', format(filters.dateRange.to, 'yyyy-MM-dd'));

    if (purchaseError) {
      console.error('Error fetching purchase orders:', purchaseError);
      throw purchaseError;
    }

    // Initialize GSTR-9 Annual Return sections
    let table4_outwardSupplies = 0;
    let table4_outward_igst = 0;
    let table4_outward_cgst = 0;
    let table4_outward_sgst = 0;
    let table4_outward_cess = 0;

    let table5_inwardSupplies = 0;
    let table5_inward_igst = 0;
    let table5_inward_cgst = 0;
    let table5_inward_sgst = 0;

    let table6_itcAvailed_igst = 0;
    let table6_itcAvailed_cgst = 0;
    let table6_itcAvailed_sgst = 0;

    let table7_exemptSupplies = 0;
    let table8_zeroRatedSupplies = 0;

    // Process Sales Invoices (Annual Outward Supplies - Table 4)
    salesInvoices?.forEach(invoice => {
      let invoiceTaxableValue = 0;
      let invoiceCGST = 0;
      let invoiceSGST = 0;
      let invoiceIGST = 0;

      invoice.sales_invoice_items?.forEach((item: any) => {
        const itemTaxableValue = (item.unit_price * item.quantity_invoiced) - (item.discount_amount || 0);
        invoiceTaxableValue += itemTaxableValue;
        invoiceCGST += item.cgst_amount || 0;
        invoiceSGST += item.sgst_amount || 0;
        invoiceIGST += item.igst_amount || 0;
      });

      // Classify supplies
      const hasAnyTax = invoiceCGST > 0 || invoiceSGST > 0 || invoiceIGST > 0;
      
      if (hasAnyTax) {
        table4_outwardSupplies += invoiceTaxableValue;
        table4_outward_cgst += invoiceCGST;
        table4_outward_sgst += invoiceSGST;
        table4_outward_igst += invoiceIGST;
      } else if (invoice.customers?.customer_type === 'Export') {
        table8_zeroRatedSupplies += invoice.total_amount || 0;
      } else {
        table7_exemptSupplies += invoice.total_amount || 0;
      }
    });

    // Process Purchase Orders (Annual Inward Supplies - Table 5)
    purchaseOrders?.forEach(order => {
      const estimatedTaxRate = 0.18; // 18% GST assumption
      const taxableValue = order.subtotal_amount || 0;
      const estimatedTax = taxableValue * estimatedTaxRate;

      table5_inwardSupplies += taxableValue;

      // Estimate ITC (Table 6)
      const supplierState = order.suppliers?.state || '';
      const companyState = companyData?.state || '';
      const isInterState = supplierState !== companyState;

      if (isInterState) {
        table5_inward_igst += estimatedTax;
        table6_itcAvailed_igst += estimatedTax;
      } else {
        table5_inward_cgst += estimatedTax / 2;
        table5_inward_sgst += estimatedTax / 2;
        table6_itcAvailed_cgst += estimatedTax / 2;
        table6_itcAvailed_sgst += estimatedTax / 2;
      }
    });

    // Calculate net tax liability for annual return
    const netAnnualIGST = table4_outward_igst - table6_itcAvailed_igst;
    const netAnnualCGST = table4_outward_cgst - table6_itcAvailed_cgst;
    const netAnnualSGST = table4_outward_sgst - table6_itcAvailed_sgst;

    // Prepare GSTR-9 Annual Return table data
    const tableData = [
      // Table 4 - Annual Outward Supplies
      {
        section: 'Table 4A',
        description: 'Outward supplies made to registered persons (B2B)',
        particulars: 'Taxable supplies (including zero rated)',
        taxableValue: table4_outwardSupplies,
        integratedTax: table4_outward_igst,
        centralTax: table4_outward_cgst,
        stateTax: table4_outward_sgst,
        cess: table4_outward_cess
      },
      {
        section: 'Table 4B',
        description: 'Outward supplies made to unregistered persons (B2C)',
        particulars: 'Taxable supplies',
        taxableValue: table4_outwardSupplies * 0.3, // Approximate B2C portion
        integratedTax: table4_outward_igst * 0.3,
        centralTax: table4_outward_cgst * 0.3,
        stateTax: table4_outward_sgst * 0.3,
        cess: 0
      },
      {
        section: 'Table 4C',
        description: 'Other outward supplies (Deemed exports, SEZ etc.)',
        particulars: 'Zero rated supplies',
        taxableValue: table8_zeroRatedSupplies,
        integratedTax: 0,
        centralTax: 0,
        stateTax: 0,
        cess: 0
      },
      // Table 5 - Annual Inward Supplies
      {
        section: 'Table 5A',
        description: 'Inward supplies from registered persons (including reverse charge)',
        particulars: 'Taxable supplies',
        taxableValue: table5_inwardSupplies,
        integratedTax: table5_inward_igst,
        centralTax: table5_inward_cgst,
        stateTax: table5_inward_sgst,
        cess: 0
      },
      // Table 6 - ITC Available and Utilized
      {
        section: 'Table 6A',
        description: 'ITC available (Annual)',
        particulars: 'Total ITC available',
        taxableValue: 0,
        integratedTax: table6_itcAvailed_igst,
        centralTax: table6_itcAvailed_cgst,
        stateTax: table6_itcAvailed_sgst,
        cess: 0
      },
      // Table 7 - Exempt Supplies
      {
        section: 'Table 7A',
        description: 'Exempt supplies',
        particulars: 'Nil rated/Exempt supplies',
        taxableValue: table7_exemptSupplies,
        integratedTax: 0,
        centralTax: 0,
        stateTax: 0,
        cess: 0
      },
      // Table 8 - Tax Liability and Payment
      {
        section: 'Table 8A',
        description: 'Net tax liability (Annual)',
        particulars: 'Tax payable',
        taxableValue: 0,
        integratedTax: Math.max(0, netAnnualIGST),
        centralTax: Math.max(0, netAnnualCGST),
        stateTax: Math.max(0, netAnnualSGST),
        cess: 0
      }
    ];

    // Chart data for annual overview
    const chartData = [
      { name: 'Outward Supplies', value: table4_outwardSupplies, type: 'Revenue' },
      { name: 'Inward Supplies', value: table5_inwardSupplies, type: 'Purchases' },
      { name: 'ITC Availed', value: table6_itcAvailed_igst + table6_itcAvailed_cgst + table6_itcAvailed_sgst, type: 'Credits' },
      { name: 'Net Tax Payable', value: Math.max(0, netAnnualIGST) + Math.max(0, netAnnualCGST) + Math.max(0, netAnnualSGST), type: 'Liability' }
    ];

    console.log('GSTR-9 Annual Return data processed:', { tableData, chartData });

    return {
      tableData,
      chartData,
      gstr9Sections: {
        outwardSupplies: {
          b2bTaxableValue: table4_outwardSupplies,
          b2cTaxableValue: table4_outwardSupplies * 0.3,
          zeroRatedValue: table8_zeroRatedSupplies,
          exemptValue: table7_exemptSupplies,
          totalIGST: table4_outward_igst,
          totalCGST: table4_outward_cgst,
          totalSGST: table4_outward_sgst
        },
        inwardSupplies: {
          taxableValue: table5_inwardSupplies,
          igst: table5_inward_igst,
          cgst: table5_inward_cgst,
          sgst: table5_inward_sgst
        },
        itcDetails: {
          availableIGST: table6_itcAvailed_igst,
          availableCGST: table6_itcAvailed_cgst,
          availableSGST: table6_itcAvailed_sgst,
          totalITCAvailed: table6_itcAvailed_igst + table6_itcAvailed_cgst + table6_itcAvailed_sgst
        },
        netTaxLiability: {
          igst: Math.max(0, netAnnualIGST),
          cgst: Math.max(0, netAnnualCGST),
          sgst: Math.max(0, netAnnualSGST),
          totalNetTax: Math.max(0, netAnnualIGST) + Math.max(0, netAnnualCGST) + Math.max(0, netAnnualSGST)
        }
      },
      summary: {
        gstin: companyGSTIN,
        financialYear: `FY ${format(filters.dateRange.from, 'yyyy')}-${format(filters.dateRange.to, 'yy')}`,
        totalOutwardSupplies: salesInvoices?.length || 0,
        totalInwardSupplies: purchaseOrders?.length || 0,
        totalTurnover: table4_outwardSupplies,
        totalITCAvailed: table6_itcAvailed_igst + table6_itcAvailed_cgst + table6_itcAvailed_sgst,
        netTaxPayable: Math.max(0, netAnnualIGST) + Math.max(0, netAnnualCGST) + Math.max(0, netAnnualSGST)
      }
    };
  };

  const fetchHSNTaxSummaryData = async (filters: FilterState) => {
    console.log('=== fetchHSNTaxSummaryData START ===');
    console.log('Filters received:', filters);

    if (!authLoading && !hasAccess('reports')) {
      throw new Error('Access denied');
    }

    // Fetch Sales Invoice Items for HSN analysis
    const { data: salesItems, error: salesError } = await supabase
      .from('sales_invoice_items')
      .select(`
        *,
        sales_invoices!inner(
          invoice_date,
          status,
          customer_name,
          customers(customer_type, gstin, state)
        )
      `)
      .eq('sales_invoices.status', 'finalized')
      .gte('sales_invoices.invoice_date', format(filters.dateRange.from, 'yyyy-MM-dd'))
      .lte('sales_invoices.invoice_date', format(filters.dateRange.to, 'yyyy-MM-dd'));

    if (salesError) {
      console.error('Error fetching sales items:', salesError);
      throw salesError;
    }

    // Group by HSN Code and Tax Rate
    const hsnSummary: Record<string, any> = {};

    salesItems?.forEach(item => {
      const hsnCode = item.hsn_sac_code || 'Not Classified';
      const cgstRate = item.cgst_rate || 0;
      const sgstRate = item.sgst_rate || 0;
      const igstRate = item.igst_rate || 0;
      
      // Determine effective tax rate
      let effectiveTaxRate = 0;
      let taxType = 'Exempt';
      
      if (igstRate > 0) {
        effectiveTaxRate = igstRate;
        taxType = 'IGST';
      } else if (cgstRate > 0 || sgstRate > 0) {
        effectiveTaxRate = cgstRate + sgstRate;
        taxType = 'CGST+SGST';
      }

      const key = `${hsnCode}-${effectiveTaxRate}`;
      
      if (!hsnSummary[key]) {
        hsnSummary[key] = {
          hsnSacCode: hsnCode,
          description: item.item_description || 'Not Specified',
          uom: item.unit_of_measure || 'PCS',
          taxRate: effectiveTaxRate,
          taxType: taxType,
          totalQuantity: 0,
          totalTaxableValue: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 0,
          totalTaxAmount: 0,
          invoiceCount: 0
        };
      }

      // Calculate item values
      const itemTaxableValue = (item.unit_price * item.quantity_invoiced) - (item.discount_amount || 0);
      const cgstAmount = item.cgst_amount || 0;
      const sgstAmount = item.sgst_amount || 0;
      const igstAmount = item.igst_amount || 0;
      const totalTaxAmount = cgstAmount + sgstAmount + igstAmount;

      // Aggregate values
      hsnSummary[key].totalQuantity += item.quantity_invoiced;
      hsnSummary[key].totalTaxableValue += itemTaxableValue;
      hsnSummary[key].cgstAmount += cgstAmount;
      hsnSummary[key].sgstAmount += sgstAmount;
      hsnSummary[key].igstAmount += igstAmount;
      hsnSummary[key].totalTaxAmount += totalTaxAmount;
      hsnSummary[key].invoiceCount += 1;
    });

    // Convert to array and sort by HSN code
    const tableData = Object.values(hsnSummary).sort((a: any, b: any) => {
      if (a.hsnSacCode === 'Not Classified') return 1;
      if (b.hsnSacCode === 'Not Classified') return -1;
      return a.hsnSacCode.localeCompare(b.hsnSacCode);
    });

    // Tax rate wise summary for chart
    const taxRateSummary: Record<string, any> = {};
    
    tableData.forEach((item: any) => {
      const rateKey = `${item.taxRate}%`;
      if (!taxRateSummary[rateKey]) {
        taxRateSummary[rateKey] = {
          taxRate: item.taxRate,
          totalTaxableValue: 0,
          totalTaxAmount: 0,
          hsnCount: 0
        };
      }
      
      taxRateSummary[rateKey].totalTaxableValue += item.totalTaxableValue;
      taxRateSummary[rateKey].totalTaxAmount += item.totalTaxAmount;
      taxRateSummary[rateKey].hsnCount += 1;
    });

    const chartData = Object.values(taxRateSummary).map((item: any) => ({
      name: `${item.taxRate}% GST`,
      taxableValue: item.totalTaxableValue,
      taxAmount: item.totalTaxAmount,
      hsnCount: item.hsnCount,
      effectiveRate: item.totalTaxableValue > 0 ? ((item.totalTaxAmount / item.totalTaxableValue) * 100).toFixed(2) : 0
    }));

    // Calculate totals
    const totals = tableData.reduce((acc: any, item: any) => {
      acc.totalQuantity += item.totalQuantity;
      acc.totalTaxableValue += item.totalTaxableValue;
      acc.totalCGST += item.cgstAmount;
      acc.totalSGST += item.sgstAmount;
      acc.totalIGST += item.igstAmount;
      acc.totalTaxAmount += item.totalTaxAmount;
      return acc;
    }, {
      totalQuantity: 0,
      totalTaxableValue: 0,
      totalCGST: 0,
      totalSGST: 0,
      totalIGST: 0,
      totalTaxAmount: 0
    });

    console.log('HSN/Tax Summary data processed:', { tableData, chartData });

    return {
      tableData,
      chartData,
      hsnSections: {
        hsnWiseDetails: tableData,
        taxRateWiseSummary: chartData,
        totals: totals
      },
      summary: {
        totalHSNCodes: tableData.length,
        uniqueTaxRates: Object.keys(taxRateSummary).length,
        totalTaxableValue: totals.totalTaxableValue,
        totalTaxAmount: totals.totalTaxAmount,
        averageTaxRate: totals.totalTaxableValue > 0 ? ((totals.totalTaxAmount / totals.totalTaxableValue) * 100).toFixed(2) : 0,
        period: `${format(filters.dateRange.from, 'dd MMM yyyy')} to ${format(filters.dateRange.to, 'dd MMM yyyy')}`
      }
    };
  };

  const fetchGSTR1Data = async (filters: FilterState) => {
    if (!company?.id) {
      return { 
        tableData: [], 
        chartData: [],
        itemWiseData: [],
        gstr1Sections: { b2bSupplies: [], b2cLargeSupplies: [], b2cSmallSupplies: [], hsnSummary: [] },
        summary: { totalInvoices: 0, totalTaxableValue: 0, totalTaxAmount: 0, b2bCount: 0, b2cLargeCount: 0, b2cSmallStates: 0, totalHSNs: 0 }
      };
    }
    
    // Build query with proper company and GSTIN filtering
    let query = supabase
      .from('sales_invoices')
      .select(`
        *, 
        sales_invoice_items(*),
        customers(gstin, customer_type)
      `)
      .eq('status', 'finalized')
      .eq('company_id', company?.id)
      .gte('invoice_date', format(filters.dateRange.from, 'yyyy-MM-dd'))
      .lte('invoice_date', format(filters.dateRange.to, 'yyyy-MM-dd'));

    const { data: invoices, error } = await query;

    if (error) {
      throw error;
    }

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

    const result = { 
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
    
    return result;
  };

  const fetchPurchaseOrdersData = async (filters: FilterState) => {
    // Get company place of supply
    const { data: companyData } = await supabase
      .from('companies')
      .select('state')
      .eq('id', company?.id)
      .single();
    
    const companyState = companyData?.state || '';

    // Comprehensive query with all joins
    const { data: poData, error } = await supabase
      .from('purchase_orders')
      .select(`
        id,
        po_number,
        order_date,
        status,
        supplier_id,
        suppliers!inner (
          id,
          name,
          state
        ),
        purchase_order_items!inner (
          id,
          product_id,
          item_code,
          item_description,
          quantity,
          unit_price,
          discount_percentage,
          discount_amount,
          cgst_rate,
          cgst_amount,
          sgst_rate,
          sgst_amount,
          igst_rate,
          igst_amount,
          total_price,
          received_quantity,
          products!inner (
            sku,
            hsn_code
          )
        ),
        grn_header (
          grn_number,
          grn_date,
          supplier_invoice_number,
          supplier_invoice_date
        )
      `)
      .eq('company_id', company?.id)
      .gte('order_date', format(filters.dateRange.from, 'yyyy-MM-dd'))
      .lte('order_date', format(filters.dateRange.to, 'yyyy-MM-dd'))
      .order('order_date', { ascending: false });

    if (error) throw error;

    // Flatten data to one row per line item
    const tableData: any[] = [];
    
    poData?.forEach(po => {
      const vendor = po.suppliers as any;
      const grnData = Array.isArray(po.grn_header) ? po.grn_header[0] : po.grn_header;
      
      (po.purchase_order_items as any[]).forEach(item => {
        const product = item.products as any;
        
        // Calculate total GST
        const totalGST = (item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0);
        
        // Calculate taxable amount (before GST)
        const taxableAmount = item.total_price - totalGST;
        
        // Determine GST percentage
        const gstPercentage = item.cgst_rate 
          ? (item.cgst_rate + item.sgst_rate) 
          : item.igst_rate || 0;
        
        tableData.push({
          'Vendor Name': vendor?.name || 'N/A',
          'Vendor Invoice No': grnData?.supplier_invoice_number || '-',
          'Invoice Date': grnData?.supplier_invoice_date 
            ? format(new Date(grnData.supplier_invoice_date), 'dd-MMM-yyyy') 
            : '-',
          'Purchase Order No': po.po_number,
          'PO Date': format(new Date(po.order_date), 'dd-MMM-yyyy'),
          'Product': item.item_description || '-',
          'SKU': product?.sku || item.item_code || '-',
          'GST%': gstPercentage,
          'Qty Received': item.received_quantity || 0,
          'Price': item.unit_price || 0,
          'Discount': item.discount_amount || 0,
          'Invoice Value': item.total_price || 0,
          'Taxable Amount': taxableAmount,
          'Discount Amount': item.discount_amount || 0,
          'CGST': item.cgst_amount || 0,
          'SGST': item.sgst_amount || 0,
          'IGST': item.igst_amount || 0,
          'Total GST Amount': totalGST,
          'Place of Supply': vendor?.state || companyState,
          'PO Receipt Date': grnData?.grn_date 
            ? format(new Date(grnData.grn_date), 'dd-MMM-yyyy') 
            : '-'
        });
      });
    });

    // Monthly aggregation for chart
    const monthlyData = poData?.reduce((acc: Record<string, any>, po) => {
      const month = format(new Date(po.order_date), 'MMM yyyy');
      if (!acc[month]) {
        acc[month] = { month, orders: 0, spending: 0 };
      }
      acc[month].orders += 1;
      
      // Sum up all items in this PO
      const poTotal = (po.purchase_order_items as any[]).reduce(
        (sum, item) => sum + (item.total_price || 0), 
        0
      );
      acc[month].spending += poTotal;
      return acc;
    }, {}) || {};

    const chartData = Object.values(monthlyData);

    return { tableData, chartData };
  };

  const fetchStockMovementData = async (filters: FilterState) => {
    if (!company?.id) {
      return { tableData: [], chartData: [] };
    }

    const { data: transactions, error } = await supabase
      .from('inventory_transactions')
      .select(`
        *, 
        products(name, sku)
      `)
      .eq('company_id', company.id)
      .gte('transaction_date', format(filters.dateRange.from, 'yyyy-MM-dd'))
      .lte('transaction_date', format(filters.dateRange.to, 'yyyy-MM-dd'))
      .order('transaction_date', { ascending: false })
      .limit(1000);

    if (error) throw error;

    // Fetch warehouse bins to get warehouse/bin names and codes
    const { data: warehouseBins } = await supabase
      .from('warehouse_bins')
      .select('*')
      .eq('company_id', company.id);

    const warehouseBinMap = new Map(warehouseBins?.map(wb => [wb.id, wb]) || []);

    const tableData = transactions?.map(transaction => {
      // Get warehouse info
      const warehouse = warehouseBinMap.get(transaction.warehouse_id);
      const warehouseDisplay = warehouse?.warehouse_name 
        ? `${warehouse.warehouse_name}${warehouse.warehouse_code ? ` (${warehouse.warehouse_code})` : ''}`
        : 'N/A';
      
      // Get bin info
      const bin = transaction.bin_id ? warehouseBinMap.get(transaction.bin_id) : null;
      const binDisplay = bin?.bin_name
        ? `${bin.bin_name}${bin.wh_bin_code ? ` (${bin.wh_bin_code})` : ''}`
        : 'N/A';

      return {
        product: transaction.products?.name || 'Unknown Product',
        sku: transaction.products?.sku || 'N/A',
        transactionType: transaction.transaction_type,
        fromWarehouseNameAndCode: warehouseDisplay,
        toBinLocationAndCode: binDisplay,
        quantity: transaction.quantity_change,
        unitCost: transaction.unit_cost,
        totalValue: transaction.total_value,
        date: transaction.transaction_date,
        reference: transaction.reference_number || 'N/A'
      };
    }) || [];

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
        case 'current_stock':
          return await fetchCurrentStockData();
        case 'low_stock_items':
          return await fetchLowStockItemsData();
        case 'stock_aging':
          return await fetchStockAgingData();
        case 'backorder_report':
          return await fetchBackorderReportData(filters);
        case 'bom_consumption':
          return await fetchBOMConsumptionData(filters);
        case 'customer_sales':
          return await fetchCustomerSalesData(filters);
        case 'gstr1':
          return await fetchGSTR1Data(filters);
        case 'gstr3b':
          return await fetchGSTR3BData(filters);
        case 'gstr9':
          return await fetchGSTR9Data(filters);
        case 'hsn_tax_summary':
          return await fetchHSNTaxSummaryData(filters);
        case 'purchase_orders':
          return await fetchPurchaseOrdersData(filters);
        case 'stock_movement':
          return await fetchStockMovementData(filters);
        case 'credit_debit_notes':
          return await fetchCreditDebitNotesData(filters);
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
      // Ensure we always have an array for reportData
      if (Array.isArray(reportResult)) {
        // Direct array response
        setReportData(reportResult);
        setChartData([]);
        setInvoiceWiseData([]);
      } else if (reportResult && typeof reportResult === 'object') {
        // Object response with tableData
        setReportData(Array.isArray(reportResult.tableData) ? reportResult.tableData : []);
        setChartData(Array.isArray(reportResult.chartData) ? reportResult.chartData : []);
        
        // Handle optional invoiceWiseData for aging reports and itemWiseData for GSTR-1
        if ('invoiceWiseData' in reportResult && Array.isArray(reportResult.invoiceWiseData)) {
          setInvoiceWiseData(reportResult.invoiceWiseData);
        } else if ('itemWiseData' in reportResult && Array.isArray(reportResult.itemWiseData)) {
          setInvoiceWiseData(reportResult.itemWiseData);
        } else {
          setInvoiceWiseData([]);
        }
      } else {
        // Fallback - ensure arrays
        setReportData([]);
        setChartData([]);
        setInvoiceWiseData([]);
      }
    }
  }, [reportResult, selectedReport]);

  const toggleCategory = (categoryId: string) => {
    setOpenCategories(prev => 
      prev.includes(categoryId) 
        ? [] // Close if already open
        : [categoryId] // Open only this category, closing others
    );
  };

  const handleReportSelect = (reportId: string, categoryId: string) => {
    console.log('Report selected:', reportId, 'Category:', categoryId);
    setSelectedReport(reportId);
    setSelectedCategory(categoryId);
    
    // Reset filters when changing reports - clear product filter for all reports
    setFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters.product;
      return newFilters;
    });
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
        // Helper function to convert camelCase to Title Case
        const toTitleCase = (str: string) => {
          // Special cases for common abbreviations
          const specialCases: Record<string, string> = {
            'gst': 'GST',
            'gstin': 'GSTIN',
            'cgst': 'CGST',
            'sgst': 'SGST',
            'igst': 'IGST',
            'hsn': 'HSN',
            'sac': 'SAC',
            'po': 'PO',
            'qty': 'Qty',
            'sku': 'SKU',
            'uom': 'UOM',
            'id': 'ID',
            'no': 'No',
            'grn': 'GRN',
            'ar': 'AR',
            'ap': 'AP'
          };

          // First, convert camelCase to spaces
          let result = str.replace(/([A-Z])/g, ' $1').trim();
          
          // Split into words
          const words = result.split(/\s+/);
          
          // Process each word
          return words.map(word => {
            const lowerWord = word.toLowerCase();
            // Check if it's a special case
            if (specialCases[lowerWord]) {
              return specialCases[lowerWord];
            }
            // Otherwise capitalize first letter
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
          }).join(' ');
        };

        const columns = Object.keys(dataToExport[0]).map(key => ({
          key,
          label: toTitleCase(key),
          format: (value: any) => {
            // Handle GST percentage
            if (key.includes('GST%') || key.toLowerCase().includes('gstpercent')) {
              return typeof value === 'number' ? `${value}%` : value;
            }
            // Handle all amount/price/value/discount fields
            if (typeof value === 'number' && (
              key.toLowerCase().includes('amount') || 
              key.toLowerCase().includes('price') || 
              key.toLowerCase().includes('value') || 
              key.toLowerCase().includes('discount') ||
              key.toLowerCase().includes('cgst') ||
              key.toLowerCase().includes('sgst') ||
              key.toLowerCase().includes('igst')
            )) {
              return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
            // Handle quantity fields
            if (typeof value === 'number' && key.toLowerCase().includes('qty')) {
              return value.toLocaleString('en-IN');
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
        {/* Enhanced Header */}
        <div className="sticky top-0 z-10 border-b bg-gradient-to-r from-card to-card/95 backdrop-blur-sm shadow-sm">
          <div className="p-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent">
                    {currentReport?.name}
                  </h1>
                  {isLoading && (
                    <Badge variant="secondary" className="gap-1.5 animate-pulse">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <span className="text-xs">Updating</span>
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground max-w-2xl">
                  {currentReport?.description}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-xs font-normal gap-1.5">
                    <Clock className="h-3 w-3" />
                    Updated: {format(new Date(), 'HH:mm:ss')}
                  </Badge>
                  {reportData && Array.isArray(reportData) && reportData.length > 0 && (
                    <Badge variant="secondary" className="text-xs font-normal">
                      {reportData.length} records
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleRefresh} 
                  disabled={isLoading}
                  className="gap-2 hover:border-primary/50 transition-all"
                >
                  <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                  Refresh
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => exportReport('excel')}
                  className="gap-2 hover:border-primary/50 transition-all"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                </Button>
                {selectedReport?.startsWith('gstr') && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => exportReport('json')}
                    className="gap-2 hover:border-primary/50 transition-all"
                  >
                    <Download className="h-4 w-4" />
                    JSON
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Filters */}
        <div className="border-b bg-gradient-to-br from-muted/30 to-background">
          <Card className="border-0 shadow-none rounded-none">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">Filters</h3>
                </div>
                {(filters.customer || filters.gstin) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilters(prev => ({
                      ...prev,
                      customer: undefined,
                      gstin: undefined
                    }))}
                    className="h-7 text-xs gap-1"
                  >
                    <X className="h-3 w-3" />
                    Clear Filters
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-w-[400px]">
                  {/* Start Date Picker */}
                  <div>
                    <label className="text-sm font-semibold mb-2 block flex items-center gap-1.5">
                      <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                      Start Date
                    </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.dateRange.from ? (
                        format(filters.dateRange.from, 'MMM dd, yyyy')
                      ) : (
                        <span className="text-muted-foreground">Select start date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.dateRange.from}
                      onSelect={(date) => {
                        if (date) {
                          setFilters(prev => ({
                            ...prev,
                            dateRange: { 
                              from: date, 
                              to: date > prev.dateRange.to ? date : prev.dateRange.to 
                            }
                          }));
                        }
                      }}
                      disabled={(date) =>
                        date > new Date() || date < new Date("1900-01-01")
                      }
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* End Date Picker */}
              <div>
                <label className="text-sm font-medium mb-2 block">End Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.dateRange.to ? (
                        format(filters.dateRange.to, 'MMM dd, yyyy')
                      ) : (
                        <span className="text-muted-foreground">Select end date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.dateRange.to}
                      onSelect={(date) => {
                        if (date) {
                          setFilters(prev => ({
                            ...prev,
                            dateRange: { 
                              from: date < prev.dateRange.from ? date : prev.dateRange.from, 
                              to: date 
                            }
                          }));
                        }
                      }}
                      disabled={(date) =>
                        date > new Date() || 
                        date < new Date("1900-01-01") ||
                        (filters.dateRange.from && date < filters.dateRange.from)
                      }
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
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
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {loading || isLoading ? (
            <div className="space-y-6 animate-pulse">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="overflow-hidden">
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="h-4 w-24 bg-muted rounded" />
                          <div className="h-10 w-10 bg-muted rounded-lg" />
                        </div>
                        <div className="space-y-2">
                          <div className="h-8 w-32 bg-muted rounded" />
                          <div className="h-3 w-20 bg-muted rounded" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[...Array(2)].map((_, i) => (
                  <Card key={i}>
                    <CardHeader>
                      <div className="h-6 w-48 bg-muted rounded" />
                      <div className="h-4 w-64 bg-muted rounded mt-2" />
                    </CardHeader>
                    <CardContent>
                      <div className="h-80 bg-muted rounded" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : selectedReport === 'gstr1' ? (
            // GSTR-1 Specific Layout
            <div className="space-y-6">
              {/* GSTR-1 Summary Cards - Enhanced */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
                <MetricsCard
                  title="Total Invoices"
                  value={(reportData as any)?.summary?.totalInvoices || 0}
                  icon={FileText}
                  variant="info"
                  loading={isLoading}
                />
                <MetricsCard
                  title="Taxable Value"
                  value={`₹${Number((reportData as any)?.summary?.totalTaxableValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                  icon={DollarSign}
                  variant="success"
                  loading={isLoading}
                />
                <MetricsCard
                  title="Total Tax"
                  value={`₹${Number((reportData as any)?.summary?.totalTaxAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                  icon={Target}
                  variant="warning"
                  loading={isLoading}
                />
                <MetricsCard
                  title="HSN Codes"
                  value={(reportData as any)?.summary?.totalHSNs || 0}
                  icon={Package}
                  variant="default"
                  loading={isLoading}
                />
              </div>

              {/* HSN Summary Chart - Enhanced */}
              {chartData.length > 0 && (
                <ChartWrapper
                  title="HSN-wise Taxable Value Distribution"
                  description="Visual breakdown of taxable value by HSN codes"
                  loading={isLoading}
                  className="animate-fade-in"
                >
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={chartData.slice(0, 10)}>
                      <CartesianGrid {...gridStyle} />
                      <XAxis dataKey="name" {...axisStyle} angle={-45} textAnchor="end" height={80} />
                      <YAxis {...axisStyle} />
                      <Tooltip 
                        {...customTooltipStyle}
                        formatter={(value, name) => [
                          formatCurrencyTooltip(Number(value)),
                          name === 'value' ? 'Taxable Value' : 'Tax Amount'
                        ]}
                      />
                      <Legend />
                      <Bar 
                        dataKey="value" 
                        fill={CHART_COLORS[0]} 
                        name="Taxable Value"
                        radius={[8, 8, 0, 0]}
                        {...chartAnimationConfig}
                      />
                      <Bar 
                        dataKey="tax" 
                        fill={CHART_COLORS[1]} 
                        name="Tax Amount"
                        radius={[8, 8, 0, 0]}
                        {...chartAnimationConfig}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartWrapper>
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
          ) : selectedReport === 'hsn_tax_summary' ? (
            // HSN/Tax Summary Specific Layout
            <div className="space-y-6">
              {/* HSN Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
                  <CardContent className="p-4">
                    <div className="text-sm font-medium text-blue-700 dark:text-blue-300">Total HSN Codes</div>
                    <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {(reportData as any)?.summary?.totalHSNCodes || 0}
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
                    <div className="text-sm font-medium text-purple-700 dark:text-purple-300">Avg Tax Rate</div>
                    <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                      {(reportData as any)?.summary?.averageTaxRate || 0}%
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Tax Rate Distribution Chart */}
              {chartData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Tax Rate Distribution</CardTitle>
                    <CardDescription>GST rate-wise breakdown of taxable value and tax amount</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip 
                          formatter={(value, name) => [
                            `₹${Number(value).toLocaleString('en-IN')}`,
                            name === 'taxableValue' ? 'Taxable Value' : 'Tax Amount'
                          ]}
                        />
                        <Bar dataKey="taxableValue" fill="#0ea5e9" name="Taxable Value" />
                        <Bar dataKey="taxAmount" fill="#10b981" name="Tax Amount" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* HSN-wise Details Table */}
              <Card>
                <CardHeader>
                  <CardTitle>HSN/SAC Code-wise Summary</CardTitle>
                  <CardDescription>Detailed breakdown by HSN/SAC codes with tax calculations</CardDescription>
                </CardHeader>
                <CardContent>
                  {!Array.isArray(reportData) || reportData.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No HSN/Tax data available for the selected period</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left p-3 font-semibold">HSN/SAC Code</th>
                            <th className="text-left p-3 font-semibold">Description</th>
                            <th className="text-right p-3 font-semibold">UOM</th>
                            <th className="text-right p-3 font-semibold">Quantity</th>
                            <th className="text-right p-3 font-semibold">Tax Rate</th>
                            <th className="text-right p-3 font-semibold">Taxable Value</th>
                            <th className="text-right p-3 font-semibold">CGST</th>
                            <th className="text-right p-3 font-semibold">SGST</th>
                            <th className="text-right p-3 font-semibold">IGST</th>
                            <th className="text-right p-3 font-semibold">Total Tax</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.map((row: any, index: number) => (
                            <tr key={index} className="border-b hover:bg-muted/30 transition-colors">
                              <td className="p-3 font-medium">{row.hsnSacCode}</td>
                              <td className="p-3 max-w-[200px] truncate">{row.description}</td>
                              <td className="p-3 text-right">{row.uom}</td>
                              <td className="p-3 text-right font-medium tabular-nums">
                                {Number(row.totalQuantity).toLocaleString('en-IN')}
                              </td>
                              <td className="p-3 text-right">
                                <Badge variant={row.taxRate === 0 ? 'secondary' : 'default'}>
                                  {row.taxRate}% {row.taxType}
                                </Badge>
                              </td>
                              <td className="p-3 text-right font-medium tabular-nums">
                                ₹{Number(row.totalTaxableValue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </td>
                              <td className="p-3 text-right tabular-nums">
                                ₹{Number(row.cgstAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </td>
                              <td className="p-3 text-right tabular-nums">
                                ₹{Number(row.sgstAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </td>
                              <td className="p-3 text-right tabular-nums">
                                ₹{Number(row.igstAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </td>
                              <td className="p-3 text-right font-semibold tabular-nums text-green-600 dark:text-green-400">
                                ₹{Number(row.totalTaxAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 bg-muted/50 font-semibold">
                            <td className="p-3" colSpan={5}>TOTAL</td>
                            <td className="p-3 text-right">
                              ₹{Number((reportData as any)?.reduce((sum: number, row: any) => sum + (row.totalTaxableValue || 0), 0) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </td>
                            <td className="p-3 text-right">
                              ₹{Number((reportData as any)?.reduce((sum: number, row: any) => sum + (row.cgstAmount || 0), 0) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </td>
                            <td className="p-3 text-right">
                              ₹{Number((reportData as any)?.reduce((sum: number, row: any) => sum + (row.sgstAmount || 0), 0) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </td>
                            <td className="p-3 text-right">
                              ₹{Number((reportData as any)?.reduce((sum: number, row: any) => sum + (row.igstAmount || 0), 0) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </td>
                            <td className="p-3 text-right text-green-600 dark:text-green-400">
                              ₹{Number((reportData as any)?.reduce((sum: number, row: any) => sum + (row.totalTaxAmount || 0), 0) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Export Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Export Information</CardTitle>
                  <CardDescription>HSN/Tax summary ready for GST compliance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">✓ GST Compliance Ready</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                      This HSN/Tax summary includes all required information for GST returns:
                    </p>
                    <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                      <li>• HSN/SAC code-wise classification</li>
                      <li>• Quantity and UOM details</li>
                      <li>• Taxable value calculations</li>
                      <li>• CGST, SGST, IGST breakup</li>
                      <li>• Tax rate distribution</li>
                    </ul>
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-3 p-2 bg-blue-100 dark:bg-blue-800/30 rounded">
                      <strong>Period:</strong> {(reportData as any)?.summary?.period || 'Selected date range'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : selectedReport === 'low_stock_items' ? (
            // Low Stock Items Specific Layout
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-muted-foreground mb-1">Total Low Stock Items</div>
                        <div className="text-2xl font-bold">{(reportResult as any)?.summary?.totalLowStockItems || 0}</div>
                      </div>
                      <AlertTriangle className="h-8 w-8 text-orange-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-muted-foreground mb-1">Critical Items</div>
                        <div className="text-2xl font-bold text-red-600">{(reportResult as any)?.summary?.criticalItems || 0}</div>
                      </div>
                      <AlertCircle className="h-8 w-8 text-red-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-muted-foreground mb-1">Total Shortage Value</div>
                        <div className="text-2xl font-bold">₹{Number((reportResult as any)?.summary?.totalShortageValue || 0).toLocaleString('en-IN')}</div>
                      </div>
                      <DollarSign className="h-8 w-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-muted-foreground mb-1">Warehouses Affected</div>
                        <div className="text-2xl font-bold">{(reportResult as any)?.summary?.warehousesAffected || 0}</div>
                      </div>
                      <Package className="h-8 w-8 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Severity Distribution Chart */}
              {chartData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Severity Distribution</CardTitle>
                    <CardDescription>Stock level severity breakdown</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {chartData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value, name) => [`${value} items`, name]}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Low Stock Items Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Low Stock Items Details</CardTitle>
                  <CardDescription>Items requiring immediate attention</CardDescription>
                </CardHeader>
                <CardContent>
                  {!Array.isArray(reportData) || reportData.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
                      <p className="text-lg font-semibold mb-2">All Stock Levels Healthy</p>
                      <p className="text-muted-foreground">No items found below minimum stock levels</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left p-3 font-semibold">Product</th>
                            <th className="text-left p-3 font-semibold">Warehouse</th>
                            <th className="text-right p-3 font-semibold">Current</th>
                            <th className="text-right p-3 font-semibold">Min</th>
                            <th className="text-right p-3 font-semibold">Max</th>
                            <th className="text-right p-3 font-semibold">Shortage</th>
                            <th className="text-center p-3 font-semibold">Stock Level</th>
                            <th className="text-center p-3 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.map((item: any, index: number) => (
                            <tr key={index} className="border-b hover:bg-muted/30 transition-colors">
                              <td className="p-3">
                                <div>
                                  <div className="font-medium">{item.productName}</div>
                                  <div className="text-xs text-muted-foreground">{item.sku}</div>
                                </div>
                              </td>
                              <td className="p-3">
                                <div>
                                  <div className="font-medium">{item.warehouseName}</div>
                                  <div className="text-xs text-muted-foreground">{item.binCode}</div>
                                </div>
                              </td>
                              <td className="p-3 text-right">
                                <div className={cn("inline-block px-2 py-1 rounded", item.severityBgColor)}>
                                  <span className="font-semibold">{item.currentStock}</span>
                                </div>
                              </td>
                              <td className="p-3 text-right">{item.minStock}</td>
                              <td className="p-3 text-right">{item.maxStock}</td>
                              <td className="p-3 text-right">
                                <Badge variant="outline" className="font-semibold">
                                  {item.shortageQty}
                                </Badge>
                              </td>
                              <td className="p-3">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                      <div 
                                        className={cn(
                                          "h-full",
                                          item.severity === 'Critical' && 'bg-red-500',
                                          item.severity === 'Low' && 'bg-orange-500',
                                          item.severity === 'Warning' && 'bg-yellow-500'
                                        )}
                                        style={{ width: `${Math.min(item.stockRatio, 100)}%` }}
                                      />
                                    </div>
                                  </div>
                                  <div className="text-xs text-muted-foreground text-center">
                                    {Math.round(item.stockRatio)}%
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                <Badge variant={item.severityColor as any}>
                                  {item.severity}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Backorder Report Specific Charts */}
              {selectedReport === 'backorder_report' && chartData.length > 0 && (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-sm font-medium text-muted-foreground mb-1">Total Pending Orders</div>
                        <div className="text-2xl font-bold">{Array.isArray(reportData) ? reportData.length : 0}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Across {Array.isArray(reportData) ? new Set(reportData.map((r: any) => r.customerName)).size : 0} customers
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-sm font-medium text-muted-foreground mb-1">Total Pending Value</div>
                        <div className="text-2xl font-bold">
                          ₹{Array.isArray(reportData) ? Number(reportData.reduce((sum: number, item: any) => sum + (item.pendingOrderAmount || 0), 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : 0}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {reportData.reduce((sum: number, item: any) => sum + (item.pendingQty || 0), 0)} units pending
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-sm font-medium text-muted-foreground mb-1">Average Days Pending</div>
                        <div className="text-2xl font-bold">
                          {Math.round(reportData.reduce((sum: number, item: any) => sum + (item.daysPending || 0), 0) / reportData.length)} days
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {reportData.filter((r: any) => r.priority === 'High').length} high priority orders
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Charts Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg font-semibold">Top 5 Customers by Pending Value</CardTitle>
                        <CardDescription>Customers with highest pending order amounts</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={350}>
                          <PieChart>
                            <Pie
                              data={(chartData as any)[0]?.data || []}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={120}
                              dataKey="value"
                              label={({ name, value }) => `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                              labelLine={true}
                            >
                              {((chartData as any)[0]?.data || []).map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              formatter={(value, name, props) => [
                                `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
                                `${props.payload.count} orders`
                              ]}
                              labelFormatter={(label) => label}
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '6px',
                                fontSize: '14px'
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg font-semibold">Top 10 Products by Pending Quantity</CardTitle>
                        <CardDescription>Products with highest pending order quantities</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={350}>
                          <BarChart data={(chartData as any)[1]?.data || []} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis type="category" dataKey="name" width={100} />
                            <Tooltip 
                              formatter={(value, name) => [
                                name === 'quantity' ? `${value} units` : `₹${Number(value).toLocaleString('en-IN')}`,
                                name === 'quantity' ? 'Pending Quantity' : 'Pending Value'
                              ]}
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '6px',
                                fontSize: '14px'
                              }}
                            />
                            <Bar dataKey="quantity" fill="#0ea5e9" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}

              {/* Charts */}
              {chartData.length > 0 && selectedReport !== 'backorder_report' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold">
                        {selectedReport === 'customer_sales'
                          ? 'Month-on-Month Sales by Invoice Value'
                          : 'Visual Analysis'
                        }
                      </CardTitle>
                      <CardDescription>
                        {selectedReport === 'customer_sales'
                          ? 'Monthly sales trends based on invoice values'
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
                              innerRadius={70}
                              outerRadius={130}
                              dataKey="value"
                              label={({ name, percentage }) => percentage > 5 ? `${percentage}%` : ''}
                              labelLine={true}
                              {...chartAnimationConfig}
                            >
                              {chartData.map((entry, index) => (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                                  className="hover:opacity-80 transition-opacity cursor-pointer"
                                />
                              ))}
                            </Pie>
                            <Tooltip 
                              {...customTooltipStyle}
                              formatter={(value) => [formatCurrencyTooltip(Number(value)), 'Amount']}
                            />
                            <Legend 
                              verticalAlign="bottom" 
                              height={36}
                              iconType="circle"
                            />
                          </PieChart>
                         ) : selectedReport.includes('sales') || selectedReport.includes('purchase') ? (
                           <AreaChart data={chartData}>
                             <defs>
                               <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                 <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.8}/>
                                 <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0.1}/>
                               </linearGradient>
                             </defs>
                             <CartesianGrid {...gridStyle} />
                             <XAxis dataKey="month" {...axisStyle} />
                             <YAxis {...axisStyle} />
                             <Tooltip 
                               {...customTooltipStyle}
                               formatter={(value, name) => [
                                 name === 'revenue' ? formatCurrencyTooltip(Number(value)) : value,
                                 name === 'revenue' ? 'Revenue' : 'Orders'
                               ]}
                             />
                             <Area 
                               type="monotone" 
                               dataKey="revenue" 
                               stroke={CHART_COLORS[0]} 
                               fill="url(#colorRevenue)" 
                               strokeWidth={2}
                               {...chartAnimationConfig}
                             />
                           </AreaChart>
                         ) : (
                           <BarChart data={chartData}>
                             <CartesianGrid {...gridStyle} />
                             <XAxis dataKey="name" {...axisStyle} />
                             <YAxis {...axisStyle} />
                             <Tooltip {...customTooltipStyle} />
                             <Bar 
                               dataKey="value" 
                               fill={CHART_COLORS[0]} 
                               radius={[8, 8, 0, 0]}
                               {...chartAnimationConfig}
                             />
                           </BarChart>
                         )}
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold">Key Metrics</CardTitle>
                      <CardDescription>
                        Summary of outstanding amounts
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {selectedReport === 'net_arap' ? (
                          // Net AR/AP Position Key Metrics
                          <>
                            <div className="p-4 rounded-lg bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border border-green-200 dark:border-green-800">
                              <div className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">
                                Accounts Receivable (AR)
                              </div>
                              <div className="text-xl font-bold text-green-900 dark:text-green-100">
                                ₹{Number((reportResult as any)?.summary?.totalAR || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </div>
                            </div>

                            <div className="p-4 rounded-lg bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border border-red-200 dark:border-red-800">
                              <div className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">
                                Accounts Payable (AP)
                              </div>
                              <div className="text-xl font-bold text-red-900 dark:text-red-100">
                                ₹{Number((reportResult as any)?.summary?.totalAP || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </div>
                            </div>

                            <div className="p-4 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-800">
                              <div className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                                Net AR/AP Position
                              </div>
                              <div className={`text-xl font-bold ${((reportResult as any)?.summary?.netPosition || 0) >= 0 ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'}`}>
                                {((reportResult as any)?.summary?.netPosition || 0) >= 0 ? '+' : ''}₹{Number((reportResult as any)?.summary?.netPosition || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </div>
                              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                {((reportResult as any)?.summary?.netPosition || 0) >= 0 ? 'Positive (More receivables)' : 'Negative (More payables)'}
                              </div>
                            </div>

                            <div className="p-3 rounded-lg bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900/20 dark:to-gray-800/20 border border-gray-200 dark:border-gray-800">
                              <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Total Records</div>
                              <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                {reportData.length - 1} {/* Subtract 1 to exclude the summary row */}
                              </div>
                            </div>
                          </>
                        ) : (
                          // Default Key Metrics for other reports
                          <>
                            <div className="p-4 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-800">
                              <div className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                                {selectedReport.includes('aging') ? 'Total Outstanding' : 'Total Records'}
                              </div>
                              <div className="text-xl font-bold text-blue-900 dark:text-blue-100 break-all">
                                {selectedReport.includes('aging') ? 
                                  `₹${Number(chartData.reduce((sum, item) => sum + item.value, 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : 
                                  selectedReport === 'customer_sales' && (reportResult as any)?.summary ? 
                                    (reportResult as any).summary.totalRecords :
                                    reportData.length
                                }
                              </div>
                            </div>
                            
                            {/* Additional metrics for Customer Sales */}
                            {selectedReport === 'customer_sales' && (reportResult as any)?.summary && (
                              <div className="p-4 rounded-lg bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border border-green-200 dark:border-green-800">
                                <div className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">
                                  Total Invoice Value
                                </div>
                                <div className="text-xl font-bold text-green-900 dark:text-green-100 break-all">
                                  ₹{Number((reportResult as any).summary.totalInvoiceValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </div>
                              </div>
                            )}
                            
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
                          </>
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

              {/* Report Table - Hidden for purchase_orders, customer_sales, current_stock, stock_movement, stock_aging, backorder_report, and bom_consumption */}
              {!['purchase_orders', 'customer_sales', 'current_stock', 'low_stock_items', 'stock_movement', 'stock_aging', 'backorder_report', 'bom_consumption'].includes(selectedReport) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold">Report Data</CardTitle>
                    <CardDescription>
                      Detailed breakdown for {currentReport?.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!Array.isArray(reportData) || reportData.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">
                          No data available for the selected criteria
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              {Object.keys(reportData[0]).map((key) => (
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
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}