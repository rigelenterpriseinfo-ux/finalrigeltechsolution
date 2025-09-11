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
  Target
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

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

  useEffect(() => {
    if (!authLoading && hasAccess('reports')) {
      fetchReportData();
    }
  }, [selectedReport, filters, authLoading]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      // Simulate different report data based on selected report
      const data = await generateReportData(selectedReport, filters);
      setReportData(data.tableData);
      setChartData(data.chartData);
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReportData = async (reportId: string, filters: FilterState) => {
    // This would normally fetch from your database
    // For now, generating sample data based on report type
    
    switch (reportId) {
      case 'ar_aging':
        return {
          tableData: [
            { customer: 'ABC Corp', current: 15000, days30: 8000, days60: 3000, days90: 2000, over90: 1000, total: 29000 },
            { customer: 'XYZ Ltd', current: 22000, days30: 5000, days60: 0, days90: 0, over90: 0, total: 27000 },
            { customer: 'Tech Solutions', current: 8000, days30: 12000, days60: 4000, days90: 0, over90: 0, total: 24000 }
          ],
          chartData: [
            { name: 'Current', value: 45000, percentage: 60 },
            { name: '1-30 Days', value: 25000, percentage: 33 },
            { name: '31-60 Days', value: 7000, percentage: 9 },
            { name: '61-90 Days', value: 2000, percentage: 3 },
            { name: '90+ Days', value: 1000, percentage: 1 }
          ]
        };
      
      case 'ap_aging':
        return {
          tableData: [
            { vendor: 'Supplier A', current: 18000, days30: 6000, days60: 2000, days90: 0, over90: 0, total: 26000 },
            { vendor: 'Supplier B', current: 12000, days30: 8000, days60: 3000, days90: 1000, over90: 0, total: 24000 },
            { vendor: 'Supplier C', current: 25000, days30: 4000, days60: 0, days90: 0, over90: 0, total: 29000 }
          ],
          chartData: [
            { name: 'Current', value: 55000, percentage: 70 },
            { name: '1-30 Days', value: 18000, percentage: 23 },
            { name: '31-60 Days', value: 5000, percentage: 6 },
            { name: '61-90 Days', value: 1000, percentage: 1 },
            { name: '90+ Days', value: 0, percentage: 0 }
          ]
        };

      case 'sales_orders':
        return {
          tableData: [
            { orderNumber: 'SO-001', customer: 'ABC Corp', date: '2024-01-15', amount: 15000, status: 'Delivered' },
            { orderNumber: 'SO-002', customer: 'XYZ Ltd', date: '2024-01-16', amount: 22000, status: 'Shipped' },
            { orderNumber: 'SO-003', customer: 'Tech Solutions', date: '2024-01-17', amount: 8000, status: 'Confirmed' }
          ],
          chartData: [
            { month: 'Jan', orders: 45, revenue: 180000 },
            { month: 'Feb', orders: 52, revenue: 210000 },
            { month: 'Mar', orders: 38, revenue: 152000 },
            { month: 'Apr', orders: 61, revenue: 244000 }
          ]
        };

      case 'current_stock':
        return {
          tableData: [
            { product: 'Product A', currentStock: 250, minStock: 50, maxStock: 500, value: 125000, status: 'Good' },
            { product: 'Product B', currentStock: 30, minStock: 50, maxStock: 300, value: 15000, status: 'Low' },
            { product: 'Product C', currentStock: 180, minStock: 25, maxStock: 200, value: 90000, status: 'Good' }
          ],
          chartData: [
            { name: 'Good Stock', value: 430, percentage: 67 },
            { name: 'Low Stock', value: 30, percentage: 5 },
            { name: 'Overstock', value: 180, percentage: 28 }
          ]
        };

      default:
        return {
          tableData: [],
          chartData: []
        };
    }
  };

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