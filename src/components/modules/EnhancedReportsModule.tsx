import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileBarChart, TrendingUp, Package, Users, Download, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { toast } from 'sonner';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

// Chart colors
const CHART_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];

interface FilterState {
  dateRange: {
    from: Date;
    to: Date;
  };
  customer?: string;
  vendor?: string;
  product?: string;
  gstin?: string;
}

// Report categories and their reports
const reportCategories = [
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
  }
];

export default function EnhancedReportsModule() {
  const { businessUser } = useBusinessAuth();
  const [selectedReport, setSelectedReport] = useState<string>('ar_aging');
  const [selectedCategory, setSelectedCategory] = useState<string>('finance');
  const [openCategories, setOpenCategories] = useState<string[]>(['finance']);
  const [reportData, setReportData] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [filters, setFilters] = useState<FilterState>({
    dateRange: {
      from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      to: new Date()
    }
  });

  // Generate report data based on selected report
  const generateReportData = async (reportId: string, filters: FilterState) => {
    console.log('Generating report data for:', reportId, filters);
    
    try {
      switch (reportId) {
        case 'gstr3b':
          // Simple GSTR-3B implementation to prevent crashes
          return {
            tableData: [
              {
                section: '3.1',
                description: 'Outward Taxable Supplies',
                taxableValue: 0,
                cgst: 0,
                sgst: 0,
                igst: 0,
                totalTax: 0
              }
            ],
            chartData: [
              { name: 'Outward Supplies', value: 0 },
              { name: 'Inward Supplies', value: 0 }
            ]
          };
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

  const fetchGSTR3BData = async (filters: FilterState) => {
    console.log('Fetching GSTR-3B data');
    
    // Mock data for now to test the structure
    const gstr3bData = [
      {
        section: '3.1',
        description: 'Outward Taxable Supplies (other than zero rated, nil rated and exempted)',
        taxableValue: 100000,
        cgst: 9000,
        sgst: 9000,
        igst: 0,
        totalTax: 18000
      },
      {
        section: '4.1', 
        description: 'Inward Supplies liable to reverse charge',
        taxableValue: 50000,
        cgst: 4500,
        sgst: 4500,
        igst: 0,
        totalTax: 9000
      }
    ];

    const chartData = [
      { name: 'Outward Supplies', value: 100000 },
      { name: 'Inward Supplies', value: 50000 }
    ];

    return { 
      tableData: gstr3bData, 
      chartData,
      summary: {
        totalOutwardSupplies: 100000,
        totalInwardSupplies: 50000,
        totalOutwardTax: 18000,
        totalInwardTax: 9000,
        netTaxLiability: 9000
      }
    };
  };

  const fetchGSTR1Data = async (filters: FilterState) => {
    console.log('Fetching GSTR-1 data');
    
    // Mock data for now to test the structure
    const gstr1Data = [
      {
        invoiceNumber: 'INV001',
        invoiceDate: '2024-01-15',
        customerName: 'ABC Corp',
        gstin: '09ABCDE1234F1Z5',
        invoiceValue: 118000,
        taxableValue: 100000,
        cgst: 9000,
        sgst: 9000,
        igst: 0,
        totalTax: 18000
      }
    ];

    const chartData = [
      { name: 'B2B', value: 100000 },
      { name: 'B2C', value: 50000 }
    ];

    return { 
      tableData: gstr1Data, 
      chartData,
      gstr1Sections: {
        b2bSupplies: gstr1Data,
        b2cLargeSupplies: [],
        b2cSmallSupplies: [],
        hsnSummary: []
      },
      summary: {
        totalInvoices: 1,
        totalTaxableValue: 100000,
        totalTaxAmount: 18000,
        totalHSNs: 1
      }
    };
  };

  // Query for report data
  const { data: reportResult, isLoading } = useQuery({
    queryKey: ['report', selectedReport, filters],
    queryFn: () => generateReportData(selectedReport, filters),
    enabled: !!selectedReport && !!businessUser
  });

  // Update state when query data changes
  useEffect(() => {
    console.log('Report result:', reportResult);
    if (reportResult) {
      // Always ensure reportData is an array for table rendering
      setReportData(Array.isArray(reportResult.tableData) ? reportResult.tableData : []);
      setChartData(Array.isArray(reportResult.chartData) ? reportResult.chartData : []);
      
      // Store complex data structures for special reports
      if (selectedReport === 'gstr1' && (reportResult as any).gstr1Sections) {
        (window as any).gstr1Data = reportResult;
      }
      if (selectedReport === 'gstr3b' && (reportResult as any).summary) {
        (window as any).gstr3bData = reportResult;
      }
    }
  }, [reportResult, selectedReport]);

  const currentReport = reportCategories
    .flatMap(cat => cat.reports)
    .find(report => report.id === selectedReport);

  const toggleCategory = (categoryId: string) => {
    setOpenCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleReportSelect = (reportId: string, categoryId: string) => {
    console.log('Selecting report:', reportId);
    setSelectedReport(reportId);
    setSelectedCategory(categoryId);
  };

  if (!businessUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Access denied. Admin privileges required.</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reports & Analytics</h1>
            <p className="text-muted-foreground">View business insights and reports</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Excel
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 border-r bg-card overflow-y-auto">
          <div className="p-4">
            <h2 className="font-semibold text-foreground mb-4">Reports Menu</h2>
            
            {reportCategories.map((category) => (
              <div key={category.id} className="mb-4">
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted text-left"
                >
                  <div className="flex items-center">
                    <category.icon className="h-4 w-4 mr-2" />
                    <span className="font-medium">{category.name}</span>
                  </div>
                </button>
                
                {openCategories.includes(category.id) && (
                  <div className="ml-6 mt-2 space-y-1">
                    {category.reports.map((report) => (
                      <button
                        key={report.id}
                        onClick={() => handleReportSelect(report.id, category.id)}
                        className={`w-full text-left p-2 rounded-lg text-sm hover:bg-muted transition-colors ${
                          selectedReport === report.id ? 'bg-primary text-primary-foreground' : ''
                        }`}
                      >
                        <div className="font-medium">{report.name}</div>
                        <div className="text-xs opacity-75">{report.description}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Report Controls */}
          <div className="border-b bg-card p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Date Range</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left">
                      {format(filters.dateRange.from, 'MMM dd, yyyy')} - {format(filters.dateRange.to, 'MMM dd, yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      selected={filters.dateRange}
                      onSelect={(range) => {
                        if (range?.from && range?.to) {
                          setFilters(prev => ({ 
                            ...prev, 
                            dateRange: { from: range.from!, to: range.to! }
                          }));
                        }
                      }}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </div>

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
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-3 text-muted-foreground">Loading report data...</span>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Special handling for GSTR-3B */}
                {selectedReport === 'gstr3b' && (window as any).gstr3bData && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <Card className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
                      <CardContent className="p-4">
                        <div className="text-sm font-medium text-blue-700 dark:text-blue-300">Outward Supplies</div>
                        <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                          ₹{Number(((window as any).gstr3bData?.summary?.totalOutwardSupplies) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800">
                      <CardContent className="p-4">
                        <div className="text-sm font-medium text-green-700 dark:text-green-300">Net Tax Liability</div>
                        <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                          ₹{Number(((window as any).gstr3bData?.summary?.netTaxLiability) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Charts */}
                {chartData.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold">Visual Analysis</CardTitle>
                      <CardDescription>Chart representation of data</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip formatter={(value) => `₹${Number(value).toLocaleString('en-IN')}`} />
                          <Bar dataKey="value" fill="#0ea5e9" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Report Table */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold">Report Data</CardTitle>
                    <CardDescription>
                      Detailed breakdown for {currentReport?.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
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
                                  {typeof value === 'number' && (key.toLowerCase().includes('amount') || key.toLowerCase().includes('total') || key.toLowerCase().includes('value')) ? 
                                    <span className="font-medium tabular-nums">
                                      ₹{Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                    </span> : 
                                    <span className="break-words">{String(value)}</span>
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
    </div>
  );
}