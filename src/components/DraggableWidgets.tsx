import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Package, 
  ShoppingCart, 
  FileText, 
  RotateCcw, 
  CreditCard, 
  TrendingUp, 
  MapPin, 
  Bot, 
  Users, 
  Building2, 
  Settings,
  BarChart3,
  Calendar,
  Mail,
  Database,
  Truck,
  Calculator,
  Archive,
  Bell,
  Clock,
  Menu
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface StockData {
  warehouse_name?: string;
  bin_name?: string;
  total_qty: number;
  total_value: number;
}

interface LowStockItem {
  name: string;
  stock_quantity: number;
}

interface TopValueItem {
  name: string;
  value: number;
}

interface SalesTrendItem {
  month: string;
  qty: number;
  value: number;
}

interface BackorderData {
  warehouse_name: string;
  total_qty: number;
  total_value: number;
}

interface Widget {
  id: string;
  title: string;
  icon: React.ElementType;
  color: string;
  onClick: () => void;
}

interface DraggableWidgetsProps {
  onNavigate: (view: string) => void;
}

export const DraggableWidgets: React.FC<DraggableWidgetsProps> = ({ onNavigate }) => {
  const { user, profile } = useAuth();
  const [goodStockData, setGoodStockData] = useState<StockData[]>([]);
  const [damageStockData, setDamageStockData] = useState<StockData[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [topValueItems, setTopValueItems] = useState<TopValueItem[]>([]);
  const [salesTrendData, setSalesTrendData] = useState<SalesTrendItem[]>([]);
  const [backorderData, setBackorderData] = useState<BackorderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [topVendorsPendingPO, setTopVendorsPendingPO] = useState<Array<{vendor: string, value: number}>>([]);
  const [totalOpenPOData, setTotalOpenPOData] = useState<{qty: number, value: number}>({qty: 0, value: 0});
  const [topPendingItems, setTopPendingItems] = useState<Array<{item: string, qty: number}>>([]);
  const [openDebitNoteData, setOpenDebitNoteData] = useState<{qty: number, value: number}>({qty: 0, value: 0});
  const [topDebitNoteVendors, setTopDebitNoteVendors] = useState<Array<{vendor: string, value: number}>>([]);
  const [openSalesOrderData, setOpenSalesOrderData] = useState<{count: number, value: number}>({count: 0, value: 0});
  const [topSalesOrderCustomers, setTopSalesOrderCustomers] = useState<Array<{customer: string, value: number}>>([]);
  const [openRSOData, setOpenRSOData] = useState<{count: number, value: number}>({count: 0, value: 0});
  const [topRSOCustomers, setTopRSOCustomers] = useState<Array<{customer: string, value: number}>>([]);
  const [apAgingData, setAPAgingData] = useState<Array<{bucket: string, value: number}>>([]);
  const [arAgingData, setARAgingData] = useState<Array<{bucket: string, value: number}>>([]);
  const [topARCustomers, setTopARCustomers] = useState<Array<{customer: string, value: number}>>([]);
  const [topAPVendors, setTopAPVendors] = useState<Array<{vendor: string, value: number}>>([]);
  const [shipmentCounts, setShipmentCounts] = useState<{in_transit: number, pending: number, dispatched: number}>({in_transit: 0, pending: 0, dispatched: 0});

  // Fetch warehouse and bin wise good stock data
  const fetchGoodStockData = async () => {
    if (!profile?.company_id) return;
    
    try {
      const { data, error } = await supabase
        .from('current_stock_levels')
        .select(`
          current_stock,
          product_id,
          warehouse_id,
          bin_id,
          products!inner(name, cost_price, company_id),
          warehouse_bins!current_stock_levels_warehouse_id_fkey(warehouse_name, bin_name)
        `)
        .eq('products.company_id', profile.company_id)
        .gt('current_stock', 0);

      if (error) {
        console.error('Error fetching good stock data:', error);
        return;
      }

      console.log('Good Stock Data fetched:', data);

      if (data && data.length > 0) {
        const aggregatedData: { [key: string]: StockData } = {};
        
        data.forEach((item: any) => {
          const key = `${item.warehouse_id || 'unknown'}-${item.bin_id || 'unknown'}`;
          if (!aggregatedData[key]) {
            aggregatedData[key] = {
              warehouse_name: item.warehouse_bins?.warehouse_name || 'Unknown Warehouse',
              bin_name: item.warehouse_bins?.bin_name || 'Unknown Bin',
              total_qty: 0,
              total_value: 0
            };
          }
          
          aggregatedData[key].total_qty += item.current_stock || 0;
          aggregatedData[key].total_value += (item.current_stock || 0) * (item.products?.cost_price || 0);
        });
        
        const result = Object.values(aggregatedData).slice(0, 3);
        console.log('Aggregated Good Stock Data:', result);
        setGoodStockData(result);
      } else {
        console.log('No good stock data found');
        setGoodStockData([]);
      }
    } catch (error) {
      console.error('Exception fetching good stock data:', error);
      setGoodStockData([]);
    }
  };

  // Fetch damage stock data (assuming we have a way to identify damaged stock)
  const fetchDamageStockData = async () => {
    if (!profile?.company_id) return;
    
    try {
      // Simulate damage stock data with warehouse names
      setDamageStockData([
        { warehouse_name: 'WH-Main', bin_name: 'DMG-01', total_qty: 25, total_value: 12500 },
        { warehouse_name: 'WH-Storage', bin_name: 'DMG-02', total_qty: 18, total_value: 8900 }
      ]);
    } catch (error) {
      console.error('Error fetching damage stock data:', error);
    }
  };

  // Fetch top 5 low stock items
  const fetchLowStockItems = async () => {
    if (!profile?.company_id) return;
    
    try {
      const { data } = await supabase
        .from('products')
        .select('name, stock_quantity')
        .eq('company_id', profile.company_id)
        .gt('stock_quantity', 0)
        .lte('stock_quantity', 50)
        .order('stock_quantity', { ascending: true })
        .limit(5);

      if (data) {
        setLowStockItems(data);
      }
    } catch (error) {
      console.error('Error fetching low stock items:', error);
    }
  };

  // Fetch top 5 items by value
  const fetchTopValueItems = async () => {
    if (!profile?.company_id) return;
    
    try {
      const { data } = await supabase
        .from('products')
        .select('name, stock_quantity, cost_price')
        .eq('company_id', profile.company_id)
        .gt('stock_quantity', 0)
        .order('cost_price', { ascending: false })
        .limit(5);

      if (data) {
        const topItems = data.map(item => ({
          name: item.name,
          value: item.stock_quantity * item.cost_price
        }));
        setTopValueItems(topItems);
      }
    } catch (error) {
      console.error('Error fetching top value items:', error);
    }
  };

  // Fetch sales trend data for last 12 months
  const fetchSalesTrendData = async () => {
    if (!profile?.company_id) return;
    
    try {
      const { data } = await supabase
        .from('sales_invoices')
        .select(`
          invoice_date,
          total_amount,
          sales_invoice_items!inner(quantity_invoiced)
        `)
        .eq('company_id', profile.company_id)
        .eq('status', 'finalized')
        .gte('invoice_date', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('invoice_date', { ascending: false });

      if (data) {
        const monthlyData: { [key: string]: { qty: number; value: number } } = {};
        
        data.forEach((invoice: any) => {
          const monthKey = new Date(invoice.invoice_date).toLocaleDateString('en-US', { 
            month: 'short', 
            year: '2-digit' 
          });
          
          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { qty: 0, value: 0 };
          }
          
          const totalQty = invoice.sales_invoice_items?.reduce((sum: number, item: any) => 
            sum + (item.quantity_invoiced || 0), 0) || 0;
          
          monthlyData[monthKey].qty += totalQty;
          monthlyData[monthKey].value += invoice.total_amount || 0;
        });
        
        const trendArray = Object.entries(monthlyData)
          .map(([month, data]) => ({
            month,
            qty: data.qty,
            value: data.value
          }))
          .slice(0, 6); // Show last 6 months for space
        
        setSalesTrendData(trendArray);
      }
    } catch (error) {
      console.error('Error fetching sales trend data:', error);
    }
  };

  // Fetch backorder data by warehouse
  const fetchBackorderData = async () => {
    if (!profile?.company_id) return;
    
    try {
      // Fetch top 3 vendors with pending POs
      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .select('supplier_id, total_amount, supplier:suppliers(name)')
        .eq('company_id', profile.company_id)
        .in('status', ['draft', 'open', 'partially_received'])
        .order('total_amount', { ascending: false });

      if (poError) throw poError;

      if (poData) {
        // Group by supplier and sum values
        const vendorMap = new Map<string, number>();
        poData.forEach(po => {
          const supplierName = po.supplier?.name || 'Unknown';
          const current = vendorMap.get(supplierName) || 0;
          vendorMap.set(supplierName, current + Number(po.total_amount));
        });

        const topVendors = Array.from(vendorMap.entries())
          .map(([vendor, value]) => ({ vendor, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 3);

        setTopVendorsPendingPO(topVendors);
      }

      // Keep original backorder data for backward compatibility
      const { data } = await supabase
        .from('backorder_items')
        .select(`
          quantity_backordered,
          unit_price,
          warehouse_id
        `)
        .eq('company_id', profile.company_id)
        .eq('status', 'pending');

      if (data) {
        const warehouseData: { [key: string]: BackorderData } = {};
        
        data.forEach((item: any) => {
          const warehouseName = `WH-${item.warehouse_id?.toString().slice(-3) || '001'}`;
          
          if (!warehouseData[warehouseName]) {
            warehouseData[warehouseName] = {
              warehouse_name: warehouseName,
              total_qty: 0,
              total_value: 0
            };
          }
          
          warehouseData[warehouseName].total_qty += item.quantity_backordered || 0;
          warehouseData[warehouseName].total_value += (item.quantity_backordered || 0) * (item.unit_price || 0);
        });
        
        setBackorderData(Object.values(warehouseData).slice(0, 3));
      }
    } catch (error) {
      console.error('Error fetching backorder data:', error);
      setTopVendorsPendingPO([]);
    }
  };

  // Fetch total open PO qty and value
  const fetchTotalOpenPOData = async () => {
    if (!profile?.company_id) return;
    
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          total_amount,
          purchase_order_items(pending_quantity)
        `)
        .eq('company_id', profile.company_id)
        .in('status', ['draft', 'open', 'partially_received']);

      if (error) throw error;

      if (data) {
        let totalQty = 0;
        let totalValue = 0;
        
        data.forEach(po => {
          totalValue += Number(po.total_amount) || 0;
          if (po.purchase_order_items) {
            po.purchase_order_items.forEach((item: any) => {
              totalQty += item.pending_quantity || 0;
            });
          }
        });

        setTotalOpenPOData({ qty: totalQty, value: totalValue });
      }
    } catch (error) {
      console.error('Error fetching open PO data:', error);
      setTotalOpenPOData({ qty: 0, value: 0 });
    }
  };

  // Fetch top 3 items pending to receive
  const fetchTopPendingItems = async () => {
    if (!profile?.company_id) return;
    
    try {
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select(`
          product:products(name),
          pending_quantity,
          purchase_order:purchase_orders!inner(company_id, status)
        `)
        .eq('purchase_order.company_id', profile.company_id)
        .in('purchase_order.status', ['draft', 'open', 'partially_received'])
        .gt('pending_quantity', 0)
        .order('pending_quantity', { ascending: false })
        .limit(3);

      if (error) throw error;

      if (data) {
        const items = data.map(item => ({
          item: item.product?.name || 'Unknown',
          qty: item.pending_quantity
        }));
        setTopPendingItems(items);
      }
    } catch (error) {
      console.error('Error fetching top pending items:', error);
      setTopPendingItems([]);
    }
  };

  // Fetch total open debit note qty and value
  const fetchOpenDebitNoteData = async () => {
    if (!profile?.company_id) return;
    
    try {
      // Fetch debit notes
      const { data: dnData, error: dnError } = await supabase
        .from('debit_notes')
        .select('id, total_amount')
        .eq('company_id', profile.company_id)
        .eq('status', 'draft');

      if (dnError) throw dnError;

      let totalQty = 0;
      let totalValue = 0;

      if (dnData && dnData.length > 0) {
        // Fetch items for these debit notes
        const dnIds = dnData.map(dn => dn.id);
        const { data: itemsData, error: itemsError } = await supabase
          .from('debit_note_items')
          .select('pending_quantity')
          .in('debit_note_id', dnIds);

        if (itemsError) throw itemsError;

        // Calculate totals
        totalValue = dnData.reduce((sum, dn) => sum + Number(dn.total_amount || 0), 0);
        totalQty = itemsData?.reduce((sum, item) => sum + (item.pending_quantity || 0), 0) || 0;
      }

      setOpenDebitNoteData({ qty: totalQty, value: totalValue });
    } catch (error) {
      console.error('Error fetching open debit note data:', error);
      setOpenDebitNoteData({ qty: 0, value: 0 });
    }
  };

  // Fetch top 3 debit note vendors
  const fetchTopDebitNoteVendors = async () => {
    if (!profile?.company_id) return;
    
    try {
      const { data, error } = await supabase
        .from('debit_notes')
        .select('supplier_id, total_amount, supplier_name')
        .eq('company_id', profile.company_id)
        .eq('status', 'draft')
        .order('total_amount', { ascending: false });

      if (error) throw error;

      if (data) {
        // Group by supplier and sum values
        const vendorMap = new Map<string, number>();
        data.forEach(dn => {
          const supplierName = dn.supplier_name || 'Unknown';
          const current = vendorMap.get(supplierName) || 0;
          vendorMap.set(supplierName, current + Number(dn.total_amount));
        });

        const topVendors = Array.from(vendorMap.entries())
          .map(([vendor, value]) => ({ vendor, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 3);

        setTopDebitNoteVendors(topVendors);
      }
    } catch (error) {
      console.error('Error fetching top debit note vendors:', error);
      setTopDebitNoteVendors([]);
    }
  };

  // Fetch open sales orders count and value
  const fetchOpenSalesOrderData = async () => {
    if (!profile?.company_id) return;
    
    try {
      // Fetch sales orders
      const { data: soData, error: soError } = await supabase
        .from('sales_orders')
        .select('id, total_amount')
        .eq('company_id', profile.company_id)
        .in('status', ['draft', 'confirmed', 'partially_delivered']);

      if (soError) throw soError;

      let totalQty = 0;
      let totalValue = 0;

      if (soData && soData.length > 0) {
        // Fetch items for these sales orders
        const soIds = soData.map(so => so.id);
        const { data: itemsData, error: itemsError } = await supabase
          .from('sales_order_items')
          .select('quantity')
          .in('sales_order_id', soIds);

        if (itemsError) throw itemsError;

        // Calculate totals
        totalValue = soData.reduce((sum, so) => sum + Number(so.total_amount || 0), 0);
        totalQty = itemsData?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
      }

      setOpenSalesOrderData({ count: totalQty, value: totalValue });
    } catch (error) {
      console.error('Error fetching open sales order data:', error);
      setOpenSalesOrderData({ count: 0, value: 0 });
    }
  };

  // Fetch top 3 sales order customers
  const fetchTopSalesOrderCustomers = async () => {
    if (!profile?.company_id) return;
    
    try {
      const { data, error } = await supabase
        .from('sales_orders')
        .select('customer_id, total_amount, customer:customers(name)')
        .eq('company_id', profile.company_id)
        .in('status', ['draft', 'confirmed', 'partially_delivered'])
        .order('total_amount', { ascending: false });

      if (error) throw error;

      if (data) {
        // Group by customer and sum values
        const customerMap = new Map<string, number>();
        data.forEach(so => {
          const customerName = so.customer?.name || 'Unknown';
          const current = customerMap.get(customerName) || 0;
          customerMap.set(customerName, current + Number(so.total_amount));
        });

        const topCustomers = Array.from(customerMap.entries())
          .map(([customer, value]) => ({ customer, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 3);

        setTopSalesOrderCustomers(topCustomers);
      }
    } catch (error) {
      console.error('Error fetching top sales order customers:', error);
      setTopSalesOrderCustomers([]);
    }
  };

  // Fetch top 5 customers with highest AR
  const fetchTopARCustomers = async () => {
    if (!profile?.company_id) return;
    
    try {
      const { data, error } = await supabase
        .from('sales_orders')
        .select('customer_id, total_amount, customer:customers(name)')
        .eq('company_id', profile.company_id)
        .in('status', ['confirmed', 'partially_delivered'])
        .order('total_amount', { ascending: false });

      if (error) throw error;

      if (data) {
        // Group by customer and sum values
        const customerMap = new Map<string, number>();
        data.forEach(so => {
          const customerName = so.customer?.name || 'Unknown';
          const current = customerMap.get(customerName) || 0;
          customerMap.set(customerName, current + Number(so.total_amount));
        });

        const topCustomers = Array.from(customerMap.entries())
          .map(([customer, value]) => ({ customer, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5);

        setTopARCustomers(topCustomers);
      }
    } catch (error) {
      console.error('Error fetching top AR customers:', error);
      setTopARCustomers([]);
    }
  };

  // Fetch top 5 vendors with highest AP
  const fetchTopAPVendors = async () => {
    if (!profile?.company_id) return;
    
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('supplier_id, total_amount, supplier:suppliers(name)')
        .eq('company_id', profile.company_id)
        .in('status', ['open', 'partially_received'])
        .order('total_amount', { ascending: false });

      if (error) throw error;

      if (data) {
        // Group by supplier and sum values
        const vendorMap = new Map<string, number>();
        data.forEach(po => {
          const vendorName = po.supplier?.name || 'Unknown';
          const current = vendorMap.get(vendorName) || 0;
          vendorMap.set(vendorName, current + Number(po.total_amount));
        });

        const topVendors = Array.from(vendorMap.entries())
          .map(([vendor, value]) => ({ vendor, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5);

        setTopAPVendors(topVendors);
      }
    } catch (error) {
      console.error('Error fetching top AP vendors:', error);
      setTopAPVendors([]);
    }
  };

  // Fetch shipment counts by category
  const fetchShipmentCounts = async () => {
    if (!profile?.company_id) return;
    
    try {
      const { data, error } = await supabase
        .from('debit_notes')
        .select('tracking_status')
        .eq('company_id', profile.company_id)
        .not('tracking_status', 'is', null);

      if (error) throw error;

      if (data) {
        const counts = {
          in_transit: 0,
          pending: 0,
          dispatched: 0
        };

        data.forEach(item => {
          const status = item.tracking_status?.toLowerCase() || '';
          if (status.includes('transit') || status.includes('in_transit')) {
            counts.in_transit++;
          } else if (status.includes('pending')) {
            counts.pending++;
          } else if (status.includes('dispatch')) {
            counts.dispatched++;
          }
        });

        setShipmentCounts(counts);
      }
    } catch (error) {
      console.error('Error fetching shipment counts:', error);
      setShipmentCounts({in_transit: 0, pending: 0, dispatched: 0});
    }
  };

  // Fetch all data on component mount
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      await Promise.all([
        fetchGoodStockData(),
        fetchDamageStockData(),
        fetchLowStockItems(),
        fetchTopValueItems(),
        fetchSalesTrendData(),
        fetchBackorderData(),
        fetchTotalOpenPOData(),
        fetchTopPendingItems(),
        fetchOpenDebitNoteData(),
        fetchTopDebitNoteVendors(),
        fetchOpenSalesOrderData(),
        fetchTopSalesOrderCustomers(),
        fetchOpenRSOData(),
        fetchTopRSOCustomers(),
        fetchAPAgingData(),
        fetchARAgingData(),
        fetchTopARCustomers(),
        fetchTopAPVendors(),
        fetchShipmentCounts()
      ]);
      setLoading(false);
  };

  // Fetch open RSO count and value
  const fetchOpenRSOData = async () => {
    if (!profile?.company_id) return;
    
    try {
      const { data, error } = await supabase
        .from('credit_notes')
        .select('id, total_amount')
        .eq('company_id', profile.company_id)
        .eq('status', 'Draft');

      if (error) throw error;

      if (data) {
        const totalValue = data.reduce((sum, cn) => sum + Number(cn.total_amount || 0), 0);
        setOpenRSOData({ count: data.length, value: totalValue });
      }
    } catch (error) {
      console.error('Error fetching open RSO data:', error);
      setOpenRSOData({ count: 0, value: 0 });
    }
  };

  // Fetch top 3 RSO customers
  const fetchTopRSOCustomers = async () => {
    if (!profile?.company_id) return;
    
    try {
      const { data, error } = await supabase
        .from('credit_notes')
        .select('customer_id, total_amount, customer_name')
        .eq('company_id', profile.company_id)
        .eq('status', 'Draft')
        .order('total_amount', { ascending: false });

      if (error) throw error;

      if (data) {
        // Group by customer and sum values
        const customerMap = new Map<string, number>();
        data.forEach(cn => {
          const customerName = cn.customer_name || 'Unknown';
          const current = customerMap.get(customerName) || 0;
          customerMap.set(customerName, current + Number(cn.total_amount));
        });

        const topCustomers = Array.from(customerMap.entries())
          .map(([customer, value]) => ({ customer, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 3);

        setTopRSOCustomers(topCustomers);
      }
    } catch (error) {
      console.error('Error fetching top RSO customers:', error);
      setTopRSOCustomers([]);
    }
  };

  // Fetch AP aging data
  const fetchAPAgingData = async () => {
    if (!profile?.company_id) return;
    
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('order_date, total_amount, status')
        .eq('company_id', profile.company_id)
        .in('status', ['open', 'partially_received']);

      if (error) throw error;

      if (data) {
        const today = new Date();
        const buckets = {
          '0-30': 0,
          '31-60': 0,
          '61-90': 0,
          '90+': 0
        };

        data.forEach(po => {
          const orderDate = new Date(po.order_date);
          const daysDiff = Math.floor((today.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
          const amount = Number(po.total_amount || 0);

          if (daysDiff <= 30) buckets['0-30'] += amount;
          else if (daysDiff <= 60) buckets['31-60'] += amount;
          else if (daysDiff <= 90) buckets['61-90'] += amount;
          else buckets['90+'] += amount;
        });

        const agingArray = Object.entries(buckets).map(([bucket, value]) => ({ bucket, value }));
        setAPAgingData(agingArray);
      }
    } catch (error) {
      console.error('Error fetching AP aging data:', error);
      setAPAgingData([]);
    }
  };

  // Fetch AR aging data
  const fetchARAgingData = async () => {
    if (!profile?.company_id) return;
    
    try {
      const { data, error } = await supabase
        .from('sales_orders')
        .select('order_date, total_amount, status')
        .eq('company_id', profile.company_id)
        .in('status', ['confirmed', 'partially_delivered']);

      if (error) throw error;

      if (data) {
        const today = new Date();
        const buckets = {
          '0-30': 0,
          '31-60': 0,
          '61-90': 0,
          '90+': 0
        };

        data.forEach(so => {
          const orderDate = new Date(so.order_date);
          const daysDiff = Math.floor((today.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
          const amount = Number(so.total_amount || 0);

          if (daysDiff <= 30) buckets['0-30'] += amount;
          else if (daysDiff <= 60) buckets['31-60'] += amount;
          else if (daysDiff <= 90) buckets['61-90'] += amount;
          else buckets['90+'] += amount;
        });

        const agingArray = Object.entries(buckets).map(([bucket, value]) => ({ bucket, value }));
        setARAgingData(agingArray);
      }
    } catch (error) {
      console.error('Error fetching AR aging data:', error);
      setARAgingData([]);
    }
  };

    if (profile?.company_id) {
      fetchAllData();
    }
  }, [profile]);

  // Render widget content based on widget ID
  const renderWidgetContent = (widget: Widget) => {
    const Icon = widget.icon;
    
    // For data widgets, show content instead of just icons
    switch (widget.id) {
      case 'database':
        return (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <div className={cn("p-1.5 rounded-md shadow-sm", widget.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold truncate">{widget.title}</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center flex-1">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
              </div>
            ) : goodStockData.length === 0 ? (
              <div className="flex items-center justify-center flex-1">
                <p className="text-xs text-muted-foreground text-center">No stock data available</p>
              </div>
            ) : (
              <div className="space-y-2 text-xs flex-1 overflow-hidden">
                {goodStockData.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="space-y-1">
                      <div className="font-semibold text-xs truncate">{item.warehouse_name}</div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs">{item.bin_name}</span>
                        <span className="font-bold text-primary text-xs whitespace-nowrap">₹{item.total_value.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'logistics':
        return (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <div className={cn("p-1.5 rounded-md shadow-sm", widget.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold truncate">{widget.title}</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center flex-1">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
              </div>
            ) : damageStockData.length === 0 ? (
              <div className="flex items-center justify-center flex-1">
                <p className="text-xs text-muted-foreground text-center">No damage stock data</p>
              </div>
            ) : (
              <div className="space-y-2 text-xs flex-1 overflow-hidden">
                {damageStockData.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="p-2 rounded-md bg-destructive/10 hover:bg-destructive/20 transition-colors">
                    <div className="space-y-1">
                      <div className="font-semibold text-xs truncate">{item.warehouse_name}</div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs">{item.bin_name}</span>
                        <span className="font-bold text-destructive text-xs whitespace-nowrap">₹{item.total_value.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'archive':
        return (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("p-1 rounded", widget.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium">{widget.title}</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center flex-1">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
              </div>
            ) : (
              <div className="space-y-1.5 text-xs overflow-hidden">
                {lowStockItems.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 p-1.5 rounded bg-muted/30 hover:bg-muted/50 transition-colors">
                    <span className="text-xs font-medium truncate flex-1 min-w-0">{item.name}</span>
                    <span className="text-xs font-bold whitespace-nowrap">{item.stock_quantity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'calculator':
        return (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("p-1 rounded", widget.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium">{widget.title}</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center flex-1">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
              </div>
            ) : (
              <div className="space-y-1.5 text-xs overflow-hidden">
                {topValueItems.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 p-1.5 rounded bg-muted/30 hover:bg-muted/50 transition-colors">
                    <span className="text-xs font-medium truncate flex-1 min-w-0">{item.name}</span>
                    <span className="text-xs font-bold whitespace-nowrap">₹{item.value.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'sales':
        return (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("p-1 rounded", widget.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium">{widget.title}</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center flex-1">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
              </div>
            ) : salesTrendData.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-2">
                No sales data
              </div>
            ) : (
              <div className="space-y-1.5 text-xs overflow-hidden">
                {salesTrendData.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="p-1.5 rounded bg-muted/30 hover:bg-muted/50 transition-colors space-y-0.5">
                    <div className="font-medium text-xs">{item.month}</div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Qty: {item.qty}</span>
                      <span className="font-bold">₹{item.value.toFixed(0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'dashboard':
        return (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <div className={cn("p-1.5 rounded-md shadow-sm", widget.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold leading-tight">Top 3 Vendors - Pending PO</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center flex-1">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
              </div>
            ) : topVendorsPendingPO.length === 0 ? (
              <div className="flex items-center justify-center flex-1">
                <p className="text-xs text-muted-foreground text-center">No pending POs</p>
              </div>
            ) : (
              <div className="space-y-1.5 flex-1 overflow-hidden">
                {topVendorsPendingPO.map((vendor, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 p-1.5 rounded bg-muted/30 hover:bg-muted/50 transition-colors">
                    <span className="text-xs font-semibold truncate flex-1 min-w-0">{vendor.vendor}</span>
                    <span className="text-xs font-bold text-primary whitespace-nowrap">₹{vendor.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'mail':
        return (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <div className={cn("p-1.5 rounded-md shadow-sm", widget.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold">Total Open PO</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center flex-1">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
              </div>
            ) : (
              <div className="space-y-3 flex-1 flex flex-col justify-center">
                <div className="p-2 rounded-md bg-primary/10 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Quantity:</span>
                    <span className="text-sm font-bold">{totalOpenPOData.qty.toLocaleString()}</span>
                  </div>
                </div>
                <div className="p-2 rounded-md bg-primary/10 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Value:</span>
                    <span className="text-sm font-bold text-primary">₹{totalOpenPOData.value.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'payments':
        return (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <div className={cn("p-1.5 rounded-md shadow-sm", widget.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold leading-tight">Top 3 Items - Pending</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center flex-1">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
              </div>
            ) : topPendingItems.length === 0 ? (
              <div className="flex items-center justify-center flex-1">
                <p className="text-xs text-muted-foreground text-center">No pending items</p>
              </div>
            ) : (
              <div className="space-y-1 flex-1 overflow-hidden">
                {topPendingItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-1.5 rounded bg-muted/30 hover:bg-muted/50 transition-colors">
                    <span className="text-xs truncate flex-1 font-medium">{item.item}</span>
                    <span className="text-xs font-bold ml-2 whitespace-nowrap">{item.qty}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'purchase':
        return (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("p-1 rounded", widget.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium">Open Debit Notes</span>
            </div>
            {loading ? (
              <div className="text-xs text-muted-foreground">Loading...</div>
            ) : (
              <div className="space-y-2 text-xs">
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Quantity:</span>
                    <span className="font-semibold">{openDebitNoteData.qty.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Value:</span>
                    <span className="font-semibold">₹{openDebitNoteData.value.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'inventory':
        return (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("p-1 rounded", widget.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium">Top 3 Debit Note Vendors</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center flex-1">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
              </div>
            ) : topDebitNoteVendors.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-2">
                No open debit notes
              </div>
            ) : (
              <div className="space-y-1.5 text-xs overflow-hidden">
                {topDebitNoteVendors.map((vendor, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 p-1.5 rounded bg-muted/30 hover:bg-muted/50 transition-colors">
                    <span className="text-xs font-medium truncate flex-1 min-w-0">{vendor.vendor}</span>
                    <span className="text-xs font-bold whitespace-nowrap">₹{vendor.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'returns':
        return (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("p-1 rounded", widget.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium">Open Sales Orders</span>
            </div>
            {loading ? (
              <div className="text-xs text-muted-foreground">Loading...</div>
            ) : (
              <div className="space-y-2 text-xs">
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Quantity:</span>
                    <span className="font-semibold">{openSalesOrderData.count.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Value:</span>
                    <span className="font-semibold">₹{openSalesOrderData.value.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'reports':
        return (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("p-1 rounded", widget.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium">Top 3 Sales Order Customers</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center flex-1">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
              </div>
            ) : topSalesOrderCustomers.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-2">
                No open sales orders
              </div>
            ) : (
              <div className="space-y-1.5 text-xs overflow-hidden">
                {topSalesOrderCustomers.map((customer, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 p-1.5 rounded bg-muted/30 hover:bg-muted/50 transition-colors">
                    <span className="text-xs font-medium truncate flex-1 min-w-0">{customer.customer}</span>
                    <span className="text-xs font-bold whitespace-nowrap">₹{customer.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'users':
        return (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("p-1 rounded", widget.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium">Open RSO</span>
            </div>
            {loading ? (
              <div className="text-xs text-muted-foreground">Loading...</div>
            ) : (
              <div className="space-y-2 text-xs">
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Count:</span>
                    <span className="font-semibold">{openRSOData.count.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Value:</span>
                    <span className="font-semibold">₹{openRSOData.value.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'profile':
        return (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("p-1 rounded", widget.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium">Top 3 RSO Customers</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center flex-1">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
              </div>
            ) : topRSOCustomers.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-2">
                No open RSOs
              </div>
            ) : (
              <div className="space-y-1.5 text-xs overflow-hidden">
                {topRSOCustomers.map((customer, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 p-1.5 rounded bg-muted/30 hover:bg-muted/50 transition-colors">
                    <span className="text-xs font-medium truncate flex-1 min-w-0">{customer.customer}</span>
                    <span className="text-xs font-bold whitespace-nowrap">₹{customer.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'settings':
        return (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("p-1 rounded", widget.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium">AP Aging</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center flex-1">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
              </div>
            ) : apAgingData.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-2">
                No AP data
              </div>
            ) : (
              <div className="space-y-1.5 text-xs overflow-hidden">
                {apAgingData.map((bucket, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 p-1.5 rounded bg-muted/30 hover:bg-muted/50 transition-colors">
                    <span className="text-xs font-medium truncate">{bucket.bucket} days</span>
                    <span className="text-xs font-bold whitespace-nowrap">₹{bucket.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'calendar':
        return (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("p-1 rounded", widget.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium">AR Aging</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center flex-1">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
              </div>
            ) : arAgingData.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-2">
                No AR data
              </div>
            ) : (
              <div className="space-y-1.5 text-xs overflow-hidden">
                {arAgingData.map((bucket, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 p-1.5 rounded bg-muted/30 hover:bg-muted/50 transition-colors">
                    <span className="text-xs font-medium truncate">{bucket.bucket} days</span>
                    <span className="text-xs font-bold whitespace-nowrap">₹{bucket.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'notifications':
        return (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("p-1 rounded", widget.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium">Top 5 AR Customers</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center flex-1">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
              </div>
            ) : topARCustomers.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-2">
                No AR data
              </div>
            ) : (
              <div className="space-y-1 text-xs overflow-hidden">
                {topARCustomers.map((customer, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 p-1.5 rounded bg-muted/30 hover:bg-muted/50 transition-colors">
                    <span className="text-xs font-medium truncate flex-1 min-w-0">{customer.customer}</span>
                    <span className="text-xs font-bold whitespace-nowrap">₹{customer.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'timesheet':
        return (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("p-1 rounded", widget.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium">Top 5 AP Vendors</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center flex-1">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
              </div>
            ) : topAPVendors.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-2">
                No AP data
              </div>
            ) : (
              <div className="space-y-1 text-xs overflow-hidden">
                {topAPVendors.map((vendor, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 p-1.5 rounded bg-muted/30 hover:bg-muted/50 transition-colors">
                    <span className="text-xs font-medium truncate flex-1 min-w-0">{vendor.vendor}</span>
                    <span className="text-xs font-bold whitespace-nowrap">₹{vendor.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'tracking':
        return (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("p-1 rounded", widget.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium">Shipment Status</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center flex-1">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
              </div>
            ) : (
              <div className="space-y-1.5 text-xs overflow-hidden">
                <div className="flex items-center justify-between gap-2 p-1.5 rounded bg-muted/30 hover:bg-muted/50 transition-colors">
                  <span className="text-xs font-medium">In Transit</span>
                  <span className="text-xs font-bold whitespace-nowrap">{shipmentCounts.in_transit}</span>
                </div>
                <div className="flex items-center justify-between gap-2 p-1.5 rounded bg-muted/30 hover:bg-muted/50 transition-colors">
                  <span className="text-xs font-medium">Pending</span>
                  <span className="text-xs font-bold whitespace-nowrap">{shipmentCounts.pending}</span>
                </div>
                <div className="flex items-center justify-between gap-2 p-1.5 rounded bg-muted/30 hover:bg-muted/50 transition-colors">
                  <span className="text-xs font-medium">Dispatched</span>
                  <span className="text-xs font-bold whitespace-nowrap">{shipmentCounts.dispatched}</span>
                </div>
              </div>
            )}
          </div>
        );

      default:
        return (
          <CardContent className="flex flex-col items-center justify-center h-full p-2">
            <div className={cn("p-2 rounded-lg mb-1 transition-colors", widget.color)}>
              <Icon className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium text-center leading-tight">
              {widget.title}
            </span>
          </CardContent>
        );
    }
  };
  const createWidgets = (): Widget[] => [
    // Purchase & Procurement (Purple shades)
    { id: 'dashboard', title: 'Dashboard', icon: BarChart3, color: 'bg-purple-500/10 text-purple-600', onClick: () => {} },
    { id: 'purchase', title: 'Purchase', icon: ShoppingCart, color: 'bg-purple-600/10 text-purple-700', onClick: () => {} },
    { id: 'mail', title: 'Mail', icon: Mail, color: 'bg-purple-400/10 text-purple-500', onClick: () => {} },
    { id: 'payments', title: 'Payments', icon: CreditCard, color: 'bg-purple-700/10 text-purple-800', onClick: () => {} },
    
    // Inventory & Warehouse (Teal/Cyan shades)
    { id: 'inventory', title: 'Inventory', icon: Package, color: 'bg-teal-500/10 text-teal-600', onClick: () => {} },
    { id: 'database', title: 'Good Stock Overview', icon: Database, color: 'bg-teal-600/10 text-teal-700', onClick: () => {} },
    { id: 'logistics', title: 'Damage Stock Report', icon: Truck, color: 'bg-teal-400/10 text-teal-500', onClick: () => {} },
    { id: 'calculator', title: 'Top Value Items', icon: Calculator, color: 'bg-cyan-500/10 text-cyan-600', onClick: () => {} },
    { id: 'archive', title: 'Low Stock Alert', icon: Archive, color: 'bg-cyan-600/10 text-cyan-700', onClick: () => {} },
    
    // Sales & Customer (Orange/Amber shades)
    { id: 'sales', title: 'Sales', icon: FileText, color: 'bg-orange-500/10 text-orange-600', onClick: () => {} },
    { id: 'reports', title: 'Reports', icon: TrendingUp, color: 'bg-orange-600/10 text-orange-700', onClick: () => {} },
    { id: 'profile', title: 'Company Profile', icon: Building2, color: 'bg-amber-500/10 text-amber-600', onClick: () => {} },
    { id: 'returns', title: 'Returns', icon: RotateCcw, color: 'bg-orange-400/10 text-orange-500', onClick: () => {} },
    
    // Operations & Tracking (Blue shades)
    { id: 'tracking', title: 'Track & Trace', icon: MapPin, color: 'bg-blue-500/10 text-blue-600', onClick: () => {} },
    { id: 'notifications', title: 'Notifications', icon: Bell, color: 'bg-blue-600/10 text-blue-700', onClick: () => {} },
    { id: 'timesheet', title: 'Timesheet', icon: Clock, color: 'bg-blue-400/10 text-blue-500', onClick: () => {} },
    
    // Management & Settings (Slate/Gray shades)
    { id: 'users', title: 'Team Management', icon: Users, color: 'bg-slate-500/10 text-slate-600', onClick: () => {} },
    { id: 'settings', title: 'Settings', icon: Settings, color: 'bg-slate-600/10 text-slate-700', onClick: () => {} },
    { id: 'calendar', title: 'Calendar', icon: Calendar, color: 'bg-slate-400/10 text-slate-500', onClick: () => {} },
    
    // AI Assistant (Distinct Pink/Rose)
    { id: 'ai', title: 'AI Assistant', icon: Bot, color: 'bg-pink-500/10 text-pink-600', onClick: () => onNavigate('ai') },
  ];

  const [widgets, setWidgets] = useState<Widget[]>(createWidgets());
  const [isDragDisabled, setIsDragDisabled] = useState(false);

  // Load saved order from localStorage on mount
  useEffect(() => {
    const savedOrder = localStorage.getItem('dashboard-widget-order');
    if (savedOrder) {
      try {
        const orderIds = JSON.parse(savedOrder);
        const allWidgets = createWidgets();
        const reorderedWidgets = orderIds.map((id: string) => 
          allWidgets.find(widget => widget.id === id)
        ).filter(Boolean);
        
        // Add any new widgets that weren't in the saved order
        const existingIds = new Set(orderIds);
        const newWidgets = allWidgets.filter(widget => !existingIds.has(widget.id));
        
        setWidgets([...reorderedWidgets, ...newWidgets]);
      } catch (error) {
        console.error('Error loading widget order:', error);
      }
    }
  }, []);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(widgets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setWidgets(items);
    
    // Save order to localStorage
    const widgetIds = items.map(widget => widget.id);
    localStorage.setItem('dashboard-widget-order', JSON.stringify(widgetIds));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Quick Access</h2>
          <p className="text-sm text-muted-foreground">Widgets are color-coded by function: <span className="text-purple-600 font-medium">Purchase</span>, <span className="text-teal-600 font-medium">Inventory</span>, <span className="text-orange-600 font-medium">Sales</span>, <span className="text-blue-600 font-medium">Operations</span>, <span className="text-slate-600 font-medium">Management</span></p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50">
            <Menu className="h-3.5 w-3.5" />
            <span>Drag to rearrange</span>
          </div>
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="widgets">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4"
            >
              {widgets.map((widget, index) => {
                const Icon = widget.icon;
                return (
                  <Draggable key={widget.id} draggableId={widget.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={cn(
                          "transform transition-all duration-200",
                          snapshot.isDragging && "scale-105 rotate-2 z-50"
                        )}
                      >
                        <Card 
                          className={cn(
                            "h-36 cursor-pointer transition-all duration-300 group relative overflow-hidden",
                            "border-2 hover:border-primary/30 bg-gradient-to-br from-card to-card/50",
                            "hover:shadow-xl hover:scale-[1.02]",
                            snapshot.isDragging && "shadow-2xl border-primary/50 scale-105"
                          )}
                          onClick={(e) => {
                            e.preventDefault();
                            if (!snapshot.isDragging) {
                              widget.onClick();
                            }
                          }}
                        >
                          {/* Gradient overlay on hover */}
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                          
                          <CardContent className="p-3 h-full relative z-10">
                            {renderWidgetContent(widget)}
                          </CardContent>

                          {/* Drag indicator */}
                          {snapshot.isDragging && (
                            <div className="absolute top-2 right-2">
                              <Menu className="h-4 w-4 text-primary animate-pulse" />
                            </div>
                          )}
                        </Card>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
};