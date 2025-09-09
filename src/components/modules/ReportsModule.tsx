import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { BarChart3, TrendingUp, Package, DollarSign } from 'lucide-react';

interface DashboardStats {
  totalProducts: number;
  totalSales: number;
  totalPurchases: number;
  totalRevenue: number;
  lowStockCount: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export function ReportsModule() {
  const { hasAccess, loading: authLoading } = useBusinessAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalSales: 0,
    totalPurchases: 0,
    totalRevenue: 0,
    lowStockCount: 0,
  });
  const [salesData, setSalesData] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30');
  

  useEffect(() => {
    console.log('ReportsModule: authLoading', authLoading);
    if (authLoading) return;

    const allowed = hasAccess('reports');
    console.log('ReportsModule: canViewReports', allowed);

    if (allowed) {
      fetchReportData();
    } else {
      console.log('ReportsModule: No access to reports, showing access denied');
      setLoading(false);
    }
  }, [timeRange, authLoading]);

  const fetchReportData = async () => {
    console.log('ReportsModule: Starting to fetch report data');
    setLoading(true);
    try {
      // Fetch basic stats
      console.log('ReportsModule: Fetching data from database');
      const [productsRes, salesRes, purchasesRes, paymentsRes] = await Promise.all([
        supabase.from('products').select('id, stock_quantity, min_stock_level').eq('is_active', true),
        supabase.from('sales_orders').select('id, total_amount, order_date'),
        supabase.from('purchase_orders').select('id, total_amount'),
        supabase.from('payments').select('amount, sales_order_id, payment_date')
      ]);

      console.log('ReportsModule: Database responses', {
        products: productsRes.data?.length || 0,
        sales: salesRes.data?.length || 0,
        purchases: purchasesRes.data?.length || 0,
        payments: paymentsRes.data?.length || 0
      });

      const products = productsRes.data || [];
      const sales = salesRes.data || [];
      const purchases = purchasesRes.data || [];
      const payments = paymentsRes.data || [];

      const lowStockProducts = products.filter(p => p.stock_quantity <= p.min_stock_level);
      const totalRevenue = payments
        .filter(p => p.sales_order_id)
        .reduce((sum, p) => sum + p.amount, 0);

      const newStats = {
        totalProducts: products.length,
        totalSales: sales.length,
        totalPurchases: purchases.length,
        totalRevenue,
        lowStockCount: lowStockProducts.length,
      };

      console.log('ReportsModule: Calculated stats', newStats);
      setStats(newStats);

      // Generate sales trend data
      const days = parseInt(timeRange);
      const salesTrend = [];
      const endDate = new Date();
      
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(endDate);
        date.setDate(date.getDate() - i);
        
        const dayPayments = payments.filter(p => {
          if (!p.sales_order_id || !p.payment_date) return false;
          const paymentDate = new Date(p.payment_date);
          return paymentDate.toDateString() === date.toDateString();
        });
        
        salesTrend.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          revenue: dayPayments.reduce((sum, p) => sum + p.amount, 0),
          orders: sales.filter(s => {
            const orderDate = new Date(s.order_date);
            return orderDate.toDateString() === date.toDateString();
          }).length,
        });
      }

      setSalesData(salesTrend);

      // Set top products data
      setTopProducts([
        { name: 'Product A', sales: 45, revenue: 2400 },
        { name: 'Product B', sales: 35, revenue: 1800 },
        { name: 'Product C', sales: 28, revenue: 1200 },
        { name: 'Product D', sales: 22, revenue: 800 },
        { name: 'Product E', sales: 18, revenue: 600 },
      ]);

      console.log('ReportsModule: Data processing complete');
    } catch (error) {
      console.error('ReportsModule: Error fetching report data:', error);
    } finally {
      console.log('ReportsModule: Setting loading to false');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-muted-foreground">Loading reports...</span>
      </div>
    );
  }

  if (!hasAccess('reports')) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to view reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Reports & Analytics</h1>
          <p className="text-muted-foreground text-sm md:text-base">Business insights and performance metrics</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-full sm:w-48 min-h-[48px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-3 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
            <p className="text-xs text-muted-foreground">Active inventory items</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sales Orders</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSales}</div>
            <p className="text-xs text-muted-foreground">Total orders created</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Purchase Orders</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPurchases}</div>
            <p className="text-xs text-muted-foreground">Total purchases made</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">From completed sales</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <TrendingUp className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.lowStockCount}</div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Sales Trend */}
        <Card>
          <CardHeader className="pb-3 md:pb-6">
            <CardTitle className="text-lg md:text-xl">Revenue Trend</CardTitle>
            <CardDescription className="text-sm">Daily revenue over the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(value) => [`$${value}`, 'Revenue']} />
                <Line type="monotone" dataKey="revenue" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader className="pb-3 md:pb-6">
            <CardTitle className="text-lg md:text-xl">Top Products by Sales</CardTitle>
            <CardDescription className="text-sm">Best performing products</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topProducts}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(value) => [value, 'Sales']} />
                <Bar dataKey="sales" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Order Status Distribution */}
      <Card>
        <CardHeader className="pb-3 md:pb-6">
          <CardTitle className="text-lg md:text-xl">Order Status Distribution</CardTitle>
          <CardDescription className="text-sm">Breakdown of order statuses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium mb-4">Sales Orders</h4>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Draft', value: 12, color: '#0088FE' },
                      { name: 'Confirmed', value: 8, color: '#00C49F' },
                      { name: 'Shipped', value: 5, color: '#FFBB28' },
                      { name: 'Delivered', value: 15, color: '#FF8042' },
                    ]}
                    cx="50%"
                    cy="50%"
                    outerRadius={60}
                    fill="#8884d8"
                    dataKey="value"
                    label
                  >
                    {[
                      { name: 'Draft', value: 12, color: '#0088FE' },
                      { name: 'Confirmed', value: 8, color: '#00C49F' },
                      { name: 'Shipped', value: 5, color: '#FFBB28' },
                      { name: 'Delivered', value: 15, color: '#FF8042' },
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-4">Purchase Orders</h4>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Draft', value: 6, color: '#8884d8' },
                      { name: 'Sent', value: 4, color: '#82ca9d' },
                      { name: 'Confirmed', value: 3, color: '#ffc658' },
                      { name: 'Received', value: 7, color: '#ff7300' },
                    ]}
                    cx="50%"
                    cy="50%"
                    outerRadius={60}
                    fill="#8884d8"
                    dataKey="value"
                    label
                  >
                    {[
                      { name: 'Draft', value: 6, color: '#8884d8' },
                      { name: 'Sent', value: 4, color: '#82ca9d' },
                      { name: 'Confirmed', value: 3, color: '#ffc658' },
                      { name: 'Received', value: 7, color: '#ff7300' },
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export Options */}
      <Card>
        <CardHeader className="pb-3 md:pb-6">
          <CardTitle className="text-lg md:text-xl">Export Reports</CardTitle>
          <CardDescription className="text-sm">Download detailed reports for analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Button variant="outline" className="min-h-[48px] text-sm">Export Inventory Report</Button>
            <Button variant="outline" className="min-h-[48px] text-sm">Export Sales Report</Button>
            <Button variant="outline" className="min-h-[48px] text-sm">Export Purchase Report</Button>
            <Button variant="outline" className="min-h-[48px] text-sm">Export Financial Summary</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}