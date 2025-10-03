
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Eye, Edit, Trash2, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, FileSpreadsheet, FileText, Download } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useIsMobile } from '@/hooks/use-mobile';
import { SalesOrderTableMobile } from './SalesOrderTableMobile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface SalesOrder {
  id: string;
  order_number: string;
  order_date: string;
  customer_id: string;
  customer_name?: string;
  customer_ref?: string;
  customer_po_number?: string;
  status: string;
  total_amount: number;
  currency: string;
  created_at: string;
  total_ordered_qty: number;
  total_invoiced_qty: number;
  total_backorder_qty: number;
  total_ready_to_deliver_qty?: number;
  ready_to_deliver_value?: number;
  delivery_status: string;
}

interface SalesOrderTableProps {
  salesOrders: SalesOrder[];
  onView: (salesOrder: SalesOrder) => void;
  onEdit: (salesOrder: SalesOrder) => void;
  onDelete: (salesOrder: SalesOrder) => void;
  onDownloadExcel?: (salesOrder: SalesOrder) => void;
  onDownloadPDF?: (salesOrder: SalesOrder) => void;
  loading?: boolean;
}

type SortField = 'order_number' | 'customer_name' | 'order_date' | 'total_amount' | 'status' | 'delivery_status' | 'total_ordered_qty' | 'total_invoiced_qty' | 'total_ready_to_deliver_qty' | 'total_backorder_qty';
type SortDirection = 'asc' | 'desc';

export const SalesOrderTable: React.FC<SalesOrderTableProps> = ({
  salesOrders,
  onView,
  onEdit,
  onDelete,
  onDownloadExcel,
  onDownloadPDF,
  loading = false
}) => {
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('order_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<string>('all');
  const [ordersWithTransactions, setOrdersWithTransactions] = useState<Set<string>>(new Set());
  const [companyData, setCompanyData] = useState<any>(null);
  const itemsPerPage = 5;

  // Fetch company data for exports
  useEffect(() => {
    const fetchCompanyData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (profile?.company_id) {
        const { data: company } = await supabase
          .from('companies')
          .select('*')
          .eq('id', profile.company_id)
          .single();
        
        setCompanyData(company);
      }
    };
    fetchCompanyData();
  }, []);

  // Check which sales orders have related transactions
  useEffect(() => {
    const checkTransactions = async () => {
      if (!salesOrders || salesOrders.length === 0) return;

      const orderIds = salesOrders.map(order => order.id);
      const ordersWithTrans = new Set<string>();

      // Check sales_invoices
      const { data: invoices } = await supabase
        .from('sales_invoices')
        .select('sales_order_id')
        .in('sales_order_id', orderIds);

      invoices?.forEach(inv => {
        if (inv.sales_order_id) ordersWithTrans.add(inv.sales_order_id);
      });

      // Check payments
      const { data: payments } = await supabase
        .from('payments')
        .select('sales_order_id')
        .in('sales_order_id', orderIds);

      payments?.forEach(pay => {
        if (pay.sales_order_id) ordersWithTrans.add(pay.sales_order_id);
      });

      // Check inventory_transactions
      const { data: transactions } = await supabase
        .from('inventory_transactions')
        .select('reference_id')
        .in('reference_id', orderIds)
        .eq('transaction_type', 'sales_issue');

      transactions?.forEach(trans => {
        if (trans.reference_id) ordersWithTrans.add(trans.reference_id);
      });

      setOrdersWithTransactions(ordersWithTrans);
    };

    checkTransactions();
  }, [salesOrders]);

  // Mobile view
  if (isMobile) {
    return (
      <SalesOrderTableMobile
        salesOrders={salesOrders}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
        loading={loading}
      />
    );
  }

  // Filter sales orders based on search term and status filters
  const filteredOrders = salesOrders.filter(order => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      order.order_number.toLowerCase().includes(searchLower) ||
      (order.customer_name && order.customer_name.toLowerCase().includes(searchLower)) ||
      (order.customer_po_number && order.customer_po_number.toLowerCase().includes(searchLower)) ||
      order.status.toLowerCase().includes(searchLower) ||
      order.delivery_status.toLowerCase().includes(searchLower)
    );

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesDeliveryStatus = deliveryStatusFilter === 'all' || order.delivery_status === deliveryStatusFilter;

    return matchesSearch && matchesStatus && matchesDeliveryStatus;
  });

  // Sort filtered orders
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    let aValue: any, bValue: any;

    switch (sortField) {
      case 'order_number':
        aValue = a.order_number;
        bValue = b.order_number;
        break;
      case 'customer_name':
        aValue = a.customer_name || '';
        bValue = b.customer_name || '';
        break;
      case 'order_date':
        aValue = new Date(a.order_date);
        bValue = new Date(b.order_date);
        break;
      case 'total_amount':
        aValue = a.total_amount;
        bValue = b.total_amount;
        break;
      case 'status':
        aValue = a.status;
        bValue = b.status;
        break;
      case 'delivery_status':
        aValue = a.delivery_status;
        bValue = b.delivery_status;
        break;
      case 'total_ordered_qty':
        aValue = a.total_ordered_qty;
        bValue = b.total_ordered_qty;
        break;
      case 'total_invoiced_qty':
        aValue = a.total_invoiced_qty;
        bValue = b.total_invoiced_qty;
        break;
      case 'total_ready_to_deliver_qty': {
        const aReady = (a.total_ready_to_deliver_qty ?? (typeof a.total_backorder_qty === 'number' ? (a.total_ordered_qty - a.total_backorder_qty) : (a.total_ordered_qty - a.total_invoiced_qty)));
        const bReady = (b.total_ready_to_deliver_qty ?? (typeof b.total_backorder_qty === 'number' ? (b.total_ordered_qty - b.total_backorder_qty) : (b.total_ordered_qty - b.total_invoiced_qty)));
        aValue = aReady;
        bValue = bReady;
        break;
      }
      case 'total_backorder_qty':
        aValue = a.total_backorder_qty;
        bValue = b.total_backorder_qty;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Paginate sorted orders
  const totalPages = Math.ceil(sortedOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedOrders = sortedOrders.slice(startIndex, startIndex + itemsPerPage);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      draft: 'outline',
      confirmed: 'default',
      in_progress: 'secondary',
      completed: 'default',
      cancelled: 'destructive'
    };

    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const getDeliveryStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      not_started: 'outline',
      partially_delivered: 'secondary',
      closed: 'default'
    };

    const labels: Record<string, string> = {
      not_started: 'Not Started',
      partially_delivered: 'Partially Delivered',
      closed: 'Closed'
    };

    return (
      <Badge variant={variants[status] || 'outline'}>
        {labels[status] || status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  // Export all sales orders to Excel
  const exportAllToExcel = async () => {
    try {
      if (!companyData) {
        toast({
          title: "Error",
          description: "Company data not loaded",
          variant: "destructive",
        });
        return;
      }

      const ws_data = [];

      // Company Header
      ws_data.push(['SALES ORDERS REPORT']);
      ws_data.push(['']);
      ws_data.push([`Company: ${companyData.name || 'Your Company Name'}`]);
      ws_data.push([companyData.address_line1 || 'Address Line 1']);
      ws_data.push([`${companyData.city || 'City'}, ${companyData.state || 'State'} - ${companyData.postal_code || 'PIN'}`]);
      ws_data.push([`GSTIN: ${companyData.gstn || 'N/A'} | Phone: ${companyData.phone || 'N/A'}`]);
      ws_data.push([`Email: ${companyData.email || 'company@example.com'}`]);
      ws_data.push(['']);
      ws_data.push([`Generated on: ${new Date().toLocaleString('en-IN')}`]);
      ws_data.push(['']);

      // Table Header
      ws_data.push([
        'S.No',
        'SO Number',
        'Order Date',
        'Customer Name',
        'Customer PO',
        'Ordered Qty',
        'Invoiced Qty',
        'Ready to Deliver',
        'Backorder Qty',
        'SO Status',
        'Delivery Status',
        'Total Amount',
        'Currency'
      ]);

      // Data rows
      sortedOrders.forEach((order, index) => {
        const readyQty = order.total_ready_to_deliver_qty ?? 
          (typeof order.total_backorder_qty === 'number' 
            ? (order.total_ordered_qty - order.total_backorder_qty) 
            : (order.total_ordered_qty - order.total_invoiced_qty));
        
        const backorderQty = typeof order.total_backorder_qty === 'number' 
          ? order.total_backorder_qty 
          : Math.max(0, order.total_ordered_qty - readyQty);

        ws_data.push([
          index + 1,
          order.order_number,
          format(new Date(order.order_date), 'dd/MM/yyyy'),
          order.customer_name || '',
          order.customer_po_number || '-',
          order.total_ordered_qty,
          order.total_invoiced_qty,
          readyQty,
          backorderQty,
          order.status.toUpperCase(),
          order.delivery_status.replace('_', ' ').toUpperCase(),
          Math.round(order.total_amount),
          order.currency
        ]);
      });

      // Summary
      ws_data.push(['']);
      ws_data.push(['SUMMARY']);
      ws_data.push(['Total Sales Orders:', sortedOrders.length]);
      ws_data.push(['Total Value:', `${sortedOrders[0]?.currency || 'INR'} ${sortedOrders.reduce((sum, o) => sum + o.total_amount, 0).toLocaleString('en-IN')}`]);

      const ws = XLSX.utils.aoa_to_sheet(ws_data);
      ws['!cols'] = [
        { wch: 6 },  // S.No
        { wch: 15 }, // SO Number
        { wch: 12 }, // Order Date
        { wch: 25 }, // Customer
        { wch: 15 }, // PO
        { wch: 12 }, // Ordered
        { wch: 12 }, // Invoiced
        { wch: 15 }, // Ready
        { wch: 13 }, // Backorder
        { wch: 12 }, // Status
        { wch: 18 }, // Delivery
        { wch: 15 }, // Amount
        { wch: 10 }  // Currency
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sales Orders');
      XLSX.writeFile(wb, `Sales_Orders_${new Date().toISOString().split('T')[0]}.xlsx`);

      toast({
        title: "Export Successful",
        description: `${sortedOrders.length} sales orders exported to Excel`,
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export sales orders",
        variant: "destructive",
      });
    }
  };

  const handleDownloadExcel = async (order: SalesOrder) => {
    if (onDownloadExcel) return onDownloadExcel(order);
    
    try {
      // Fetch complete sales order details
      const { data: fullSO, error: soError } = await supabase
        .from('sales_orders')
        .select(`
          *,
          customers!inner(*)
        `)
        .eq('id', order.id)
        .single();

      if (soError || !fullSO) {
        console.error('Error fetching SO details:', soError);
        toast({
          title: "Error",
          description: "Failed to fetch complete sales order details",
          variant: "destructive",
        });
        return;
      }

      // Fetch sales order items
      const { data: soItems, error: itemsError } = await supabase
        .from('sales_order_items')
        .select('*')
        .eq('sales_order_id', order.id)
        .order('created_at', { ascending: true });

      if (itemsError) {
        console.error('Error fetching SO items:', itemsError);
        return;
      }

      // Company Header
      const companyInfo = [
        ['SALES ORDER'],
        [''],
        [`Company: ${companyData?.name || 'Your Company Name'}`],
        [companyData?.address_line1 || 'Address Line 1'],
        [`${companyData?.city || 'City'}, ${companyData?.state || 'State'} - ${companyData?.postal_code || 'PIN'}`],
        [`GSTIN: ${companyData?.gstn || 'N/A'} | Phone: ${companyData?.phone || 'N/A'}`],
        [`Email: ${companyData?.email || 'company@example.com'}`],
        ['']
      ];

      // SO Header Details
      const soHeader = [
        ['SO Number:', fullSO.order_number, '', 'Date:', new Date(fullSO.order_date).toLocaleDateString('en-IN')],
        [''],
      ];

      // Customer Details Section
      const customerDetails = [
        ['CUSTOMER DETAILS', '', '', 'DELIVERY ADDRESS'],
        [`${fullSO.customers?.name || 'Customer Name'}`, '', '', `${fullSO.delivery_address_line1 || companyData?.name || 'Company Name'}`],
        [fullSO.billing_address_line1 || 'Customer Address', '', '', fullSO.delivery_address_line2 || ''],
        [`Contact: ${fullSO.customers?.contact_person || 'N/A'}`, '', '', `${fullSO.delivery_city || ''}, ${fullSO.delivery_state || ''}`],
        [`Phone: ${fullSO.customers?.phone || 'N/A'}`, '', '', `PIN: ${fullSO.delivery_pin_code || 'N/A'}`],
        [`Email: ${fullSO.customers?.email || 'N/A'}`, '', '', `Place of Supply: ${fullSO.place_of_supply || companyData?.state || 'N/A'}`],
        [`GSTIN: ${fullSO.customers?.gstin || 'N/A'}`],
        ['']
      ];

      // Order Details
      const orderDetails = [
        ['ORDER DETAILS'],
        ['SO Date:', new Date(fullSO.order_date).toLocaleDateString('en-IN'), '', 'Customer PO:', fullSO.customer_po_number || '-'],
        ['Expected Delivery:', fullSO.expected_delivery_date ? new Date(fullSO.expected_delivery_date).toLocaleDateString('en-IN') : 'TBD', '', 'Currency:', fullSO.currency || 'INR'],
        ['Payment Terms:', fullSO.payment_terms || 'Net 30 Days', '', 'Status:', fullSO.status.toUpperCase()],
        ['']
      ];

      // Line Items Header
      const lineItemsHeader = [
        ['LINE ITEMS'],
        ['S.No', 'Item Code', 'Description', 'HSN', 'Qty', 'Rate', 'Disc%', 'Disc Amt', 'Tax%', 'Tax Amt', 'Amount']
      ];

      // Map sales order items
      const lineItems = (soItems || []).map((item: any, index: number) => {
        const qty = item.ordered_quantity || item.quantity || 0;
        const subtotal = qty * (item.unit_price || 0);
        const discountAmount = (subtotal * (item.discount_percentage || 0)) / 100;
        const taxAmount = (item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0);
        const totalTaxRate = (item.cgst_rate || 0) + (item.sgst_rate || 0) + (item.igst_rate || 0);
        const lineTotal = item.line_total || (subtotal - discountAmount + taxAmount);
        
        return [
          index + 1,
          item.item_code || item.product_sku || 'N/A',
          item.item_description || item.product_name || 'Item',
          item.hsn_sac_code || '-',
          qty,
          Math.round(item.unit_price || 0),
          item.discount_percentage || 0,
          Math.round(discountAmount),
          totalTaxRate,
          Math.round(taxAmount),
          Math.round(lineTotal)
        ];
      });

      // Totals Section
      const subtotal = fullSO.subtotal_amount || (fullSO.total_amount / 1.18);
      const cgst = ((subtotal * 9) / 100);
      const sgst = ((subtotal * 9) / 100);
      
      const totalsSection = [
        [''],
        ['', '', '', '', '', '', '', '', 'Subtotal:', `${fullSO.currency} ${Math.round(subtotal).toLocaleString('en-IN')}`],
        ['', '', '', '', '', '', '', '', 'CGST (9%):', `${fullSO.currency} ${Math.round(cgst).toLocaleString('en-IN')}`],
        ['', '', '', '', '', '', '', '', 'SGST (9%):', `${fullSO.currency} ${Math.round(sgst).toLocaleString('en-IN')}`],
        ['', '', '', '', '', '', '', '', 'Total:', `${fullSO.currency} ${Math.round(fullSO.total_amount).toLocaleString('en-IN')}`],
      ];

      const amountInWords = convertNumberToWords(fullSO.total_amount);
      totalsSection.push(['', '', '', '', '', '', '', '', 'Amount in words:', amountInWords]);

      // Terms and Conditions
      const termsSection = [
        [''],
        ['TERMS & CONDITIONS'],
        ['1. Payment Terms: Payment to be made as per agreed payment terms.'],
        ['2. Delivery: Goods shall be delivered as per the agreed delivery schedule.'],
        ['3. Quality Standards: All goods conform to agreed specifications and quality standards.'],
        ['4. Warranty: Standard warranty applies unless otherwise specified.'],
        ['5. Returns: Returns accepted only with prior authorization.'],
        ['']
      ];

      if (fullSO.notes) {
        termsSection.push(['Special Instructions:', fullSO.notes]);
        termsSection.push(['']);
      }

      // Authorization
      const authSection = [
        ['AUTHORIZATION'],
        ['Prepared By:', '', '', 'Approved By:'],
        ['Name & Signature:', '', '', 'Name & Signature:'],
        [`Date: ${new Date().toLocaleDateString('en-IN')}`, '', '', `Date: ${new Date().toLocaleDateString('en-IN')}`],
        [''],
        [`Generated on: ${new Date().toLocaleString('en-IN')}`, '', '', 'This is a computer-generated document']
      ];

      // Combine all sections
      const fullData = [
        ...companyInfo,
        ...soHeader,
        ...customerDetails,
        ...orderDetails,
        ...lineItemsHeader,
        ...lineItems,
        ...totalsSection,
        ...termsSection,
        ...authSection
      ];

      const ws = XLSX.utils.aoa_to_sheet(fullData);
      const wb = XLSX.utils.book_new();

      ws['!cols'] = [
        { wch: 6 },   // S.No
        { wch: 12 },  // Item Code
        { wch: 30 },  // Description
        { wch: 12 },  // HSN
        { wch: 8 },   // Qty
        { wch: 12 },  // Rate
        { wch: 8 },   // Disc%
        { wch: 12 },  // Disc Amt
        { wch: 8 },   // Tax%
        { wch: 12 },  // Tax Amt
        { wch: 15 }   // Amount
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Sales Order');
      XLSX.writeFile(wb, `SO_${fullSO.order_number}_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      toast({
        title: "Excel Export Successful",
        description: `Sales Order ${fullSO.order_number} has been exported`,
      });
    } catch (error) {
      console.error('Export to Excel failed:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export to Excel",
        variant: "destructive",
      });
    }
  };

  // Helper function to convert number to words (Indian format)
  const convertNumberToWords = (num: number): string => {
    if (num === 0) return 'Zero Rupees Only';
    
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    
    const convertLessThanThousand = (n: number): string => {
      if (n === 0) return '';
      if (n < 10) return ones[n];
      if (n < 20) return teens[n - 10];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
      return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertLessThanThousand(n % 100) : '');
    };
    
    const [integerPart, decimalPart] = num.toFixed(2).split('.');
    const intNum = parseInt(integerPart);
    const decNum = parseInt(decimalPart);
    
    if (intNum === 0 && decNum === 0) return 'Zero Rupees Only';
    
    let words = 'Rupees ';
    
    const crore = Math.floor(intNum / 10000000);
    const lakh = Math.floor((intNum % 10000000) / 100000);
    const thousand = Math.floor((intNum % 100000) / 1000);
    const hundred = intNum % 1000;
    
    if (crore > 0) words += convertLessThanThousand(crore) + ' Crore ';
    if (lakh > 0) words += convertLessThanThousand(lakh) + ' Lakh ';
    if (thousand > 0) words += convertLessThanThousand(thousand) + ' Thousand ';
    if (hundred > 0) words += convertLessThanThousand(hundred) + ' ';
    
    if (decNum > 0) {
      words += 'and ' + convertLessThanThousand(decNum) + ' Paise ';
    }
    
    return words.trim() + ' Only';
  };

  const handleDownloadPDF = async (order: SalesOrder) => {
    if (onDownloadPDF) return onDownloadPDF(order);
    
    try {
      // Fetch complete sales order details
      const { data: fullSO, error: soError } = await supabase
        .from('sales_orders')
        .select(`
          *,
          customers!inner(*)
        `)
        .eq('id', order.id)
        .single();

      if (soError || !fullSO) {
        console.error('Error fetching SO details:', soError);
        toast({
          title: "Error",
          description: "Failed to fetch complete sales order details",
          variant: "destructive",
        });
        return;
      }

      // Fetch sales order items
      const { data: soItems, error: itemsError } = await supabase
        .from('sales_order_items')
        .select('*')
        .eq('sales_order_id', order.id)
        .order('created_at', { ascending: true });

      if (itemsError) {
        console.error('Error fetching SO items:', itemsError);
        return;
      }

      const doc = new jsPDF();
      let yPos = 15;
      
      // ========== MODERN HEADER SECTION ==========
      doc.setFillColor(41, 128, 185);
      doc.rect(0, 0, 210, 50, 'F');
      
      // Company name and details
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(companyData?.name || 'YOUR COMPANY NAME', 45, 16);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(255, 255, 255);
      
      const companyDetails = [
        companyData?.address_line1 || 'Address Line 1',
        `${companyData?.city || 'City'}, ${companyData?.state || 'State'} - ${companyData?.postal_code || 'PIN'}`,
        `GSTIN: ${companyData?.gstn || 'N/A'} | Phone: ${companyData?.phone || 'N/A'}`,
        `Email: ${companyData?.email || 'company@example.com'}`
      ];
      
      let detailY = 22;
      companyDetails.forEach(detail => {
        doc.text(detail, 45, detailY);
        detailY += 4;
      });
      
      // Document title and info
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('SALES ORDER', 195, 18, { align: 'right' });
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`SO #: ${fullSO.order_number}`, 195, 28, { align: 'right' });
      doc.text(`Date: ${new Date(fullSO.order_date).toLocaleDateString('en-IN')}`, 195, 34, { align: 'right' });
      
      yPos = 58;
      
      // ========== CUSTOMER & DELIVERY INFORMATION ==========
      doc.setFillColor(245, 245, 245);
      doc.rect(15, yPos, 87, 45, 'F');
      doc.rect(108, yPos, 87, 45, 'F');
      
      // Customer Details
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 128, 185);
      doc.text('CUSTOMER DETAILS', 17, yPos + 7);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(fullSO.customers?.name || 'Customer Name', 17, yPos + 14);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      const custAddress = fullSO.billing_address_line1 || fullSO.customers?.address || 'Customer Address';
      const custLines = doc.splitTextToSize(custAddress, 80);
      doc.text(custLines, 17, yPos + 19);
      
      const custDetailsY = yPos + 19 + (custLines.length * 4);
      doc.text(`Contact: ${fullSO.customers?.contact_person || 'N/A'}`, 17, custDetailsY);
      doc.text(`Phone: ${fullSO.customers?.phone || 'N/A'}`, 17, custDetailsY + 4);
      doc.text(`Email: ${fullSO.customers?.email || 'N/A'}`, 17, custDetailsY + 8);
      doc.text(`GSTIN: ${fullSO.customers?.gstin || 'N/A'}`, 17, custDetailsY + 12);
      
      // Delivery Details
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 128, 185);
      doc.text('DELIVERY ADDRESS', 110, yPos + 7);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      const shipAddress = fullSO.delivery_address_line1 || companyData?.address_line1 || 'Delivery Address';
      const shipLines = doc.splitTextToSize(shipAddress, 80);
      doc.text(shipLines, 110, yPos + 14);
      
      const shipDetailsY = yPos + 14 + (shipLines.length * 4);
      doc.text(`${fullSO.delivery_city || companyData?.city || 'City'}, ${fullSO.delivery_state || companyData?.state || 'State'}`, 110, shipDetailsY);
      doc.text(`PIN: ${fullSO.delivery_pin_code || companyData?.postal_code || 'N/A'}`, 110, shipDetailsY + 4);
      doc.text(`Place of Supply: ${fullSO.place_of_supply || companyData?.state || 'N/A'}`, 110, shipDetailsY + 8);
      
      yPos += 50;
      
      // ========== ORDER DETAILS ==========
      doc.setFillColor(240, 240, 240);
      doc.rect(15, yPos, 180, 20, 'F');
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('SO Date:', 17, yPos + 6);
      doc.text('Expected Delivery:', 17, yPos + 12);
      doc.text('Payment Terms:', 17, yPos + 18);
      
      doc.setFont('helvetica', 'normal');
      doc.text(new Date(fullSO.order_date).toLocaleDateString('en-IN'), 50, yPos + 6);
      doc.text(fullSO.expected_delivery_date ? new Date(fullSO.expected_delivery_date).toLocaleDateString('en-IN') : 'TBD', 50, yPos + 12);
      doc.text(fullSO.payment_terms || 'Net 30 Days', 50, yPos + 18);
      
      doc.setFont('helvetica', 'bold');
      doc.text('Customer PO:', 110, yPos + 6);
      doc.text('Currency:', 110, yPos + 12);
      doc.text('Status:', 110, yPos + 18);
      
      doc.setFont('helvetica', 'normal');
      doc.text(fullSO.customer_po_number || '-', 140, yPos + 6);
      doc.text(fullSO.currency || 'INR', 140, yPos + 12);
      doc.text(fullSO.status.toUpperCase(), 140, yPos + 18);
      
      yPos += 28;
      
      // ========== LINE ITEMS TABLE ==========
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 128, 185);
      doc.text('LINE ITEMS', 15, yPos);
      
      yPos += 6;
      
      // Table Header
      doc.setFillColor(41, 128, 185);
      doc.rect(15, yPos, 180, 10, 'F');
      
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      
      const colPositions = {
        sno: 17,
        itemCode: 25,
        description: 45,
        hsn: 75,
        qty: 88,
        rate: 104,
        discPct: 115,
        discAmt: 136,
        taxPct: 155,
        taxAmt: 174,
        amount: 193
      };
      
      doc.text('S.No', colPositions.sno, yPos + 6.5);
      doc.text('Item Code', colPositions.itemCode, yPos + 6.5);
      doc.text('Description', colPositions.description, yPos + 6.5);
      doc.text('HSN', colPositions.hsn, yPos + 6.5);
      doc.text('Qty', colPositions.qty, yPos + 6.5, { align: 'center' });
      doc.text('Rate', colPositions.rate, yPos + 6.5, { align: 'right' });
      doc.text('Disc%', colPositions.discPct, yPos + 6.5, { align: 'center' });
      doc.text('Disc Amt', colPositions.discAmt, yPos + 6.5, { align: 'right' });
      doc.text('Tax%', colPositions.taxPct, yPos + 6.5, { align: 'center' });
      doc.text('Tax Amt', colPositions.taxAmt, yPos + 6.5, { align: 'right' });
      doc.text('Amount', colPositions.amount, yPos + 6.5, { align: 'right' });
      
      yPos += 12;
      
      // Map sales order items
      const lineItems = (soItems || []).map((item: any, index: number) => {
        const qty = item.ordered_quantity || item.quantity || 0;
        const subtotal = qty * (item.unit_price || 0);
        const discountAmount = (subtotal * (item.discount_percentage || 0)) / 100;
        const taxAmount = (item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0);
        const totalTaxRate = (item.cgst_rate || 0) + (item.sgst_rate || 0) + (item.igst_rate || 0);
        
        return {
          sno: index + 1,
          code: item.item_code || item.product_sku || 'N/A',
          desc: item.item_description || item.product_name || 'Item',
          hsn: item.hsn_sac_code || '-',
          qty: qty,
          rate: item.unit_price || 0,
          disc: item.discount_percentage || 0,
          discAmt: discountAmount,
          tax: totalTaxRate,
          taxAmt: taxAmount,
          amount: item.line_total || (subtotal - discountAmount + taxAmount)
        };
      });
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(7.5);
      
      lineItems.forEach((item, index) => {
        if (index % 2 === 0) {
          doc.setFillColor(248, 249, 250);
          doc.rect(15, yPos - 2, 180, 9, 'F');
        }
        
        doc.setDrawColor(220, 220, 220);
        doc.line(15, yPos + 7, 195, yPos + 7);
        
        doc.text(item.sno.toString(), colPositions.sno, yPos + 4);
        
        const itemCode = item.code.length > 7 ? item.code.substring(0, 7) : item.code;
        doc.text(itemCode, colPositions.itemCode, yPos + 4);
        
        const descText = item.desc.length > 25 ? item.desc.substring(0, 25) + '...' : item.desc;
        doc.text(descText, colPositions.description, yPos + 4);
        
        const hsnText = item.hsn.length > 10 ? item.hsn.substring(0, 10) : item.hsn;
        doc.text(hsnText, colPositions.hsn, yPos + 4);
        
        doc.text(item.qty.toString(), colPositions.qty, yPos + 4, { align: 'center' });
        doc.text(Math.round(item.rate).toString(), colPositions.rate, yPos + 4, { align: 'right' });
        doc.text(item.disc.toString(), colPositions.discPct, yPos + 4, { align: 'center' });
        doc.text(Math.round(item.discAmt).toString(), colPositions.discAmt, yPos + 4, { align: 'right' });
        doc.text(item.tax.toString(), colPositions.taxPct, yPos + 4, { align: 'center' });
        doc.text(Math.round(item.taxAmt).toString(), colPositions.taxAmt, yPos + 4, { align: 'right' });
        
        doc.setFont('helvetica', 'bold');
        doc.text(Math.round(item.amount).toString(), colPositions.amount, yPos + 4, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        
        yPos += 9;
      });
      
      doc.setDrawColor(41, 128, 185);
      doc.setLineWidth(0.5);
      doc.line(15, yPos, 195, yPos);
      doc.setLineWidth(0.2);
      
      yPos += 8;
      
      // ========== TOTALS SECTION ==========
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      
      const subtotal = fullSO.subtotal_amount || (fullSO.total_amount / 1.18);
      const taxAmount = fullSO.tax_amount || (fullSO.total_amount - subtotal);
      
      doc.text('Subtotal:', 150, yPos);
      doc.text(`${fullSO.currency} ${Math.round(subtotal).toLocaleString('en-IN')}`, 195, yPos, { align: 'right' });
      
      yPos += 6;
      doc.text('CGST (9%):', 150, yPos);
      doc.text(`${fullSO.currency} ${Math.round(taxAmount / 2).toLocaleString('en-IN')}`, 195, yPos, { align: 'right' });
      
      yPos += 6;
      doc.text('SGST (9%):', 150, yPos);
      doc.text(`${fullSO.currency} ${Math.round(taxAmount / 2).toLocaleString('en-IN')}`, 195, yPos, { align: 'right' });
      
      if (fullSO.discount_amount && fullSO.discount_amount > 0) {
        yPos += 6;
        doc.text('Discount:', 150, yPos);
        doc.text(`${fullSO.currency} ${Math.round(fullSO.discount_amount).toLocaleString('en-IN')}`, 195, yPos, { align: 'right' });
      }
      
      yPos += 6;
      doc.setFillColor(41, 128, 185);
      doc.rect(145, yPos - 4, 50, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.text('Total:', 150, yPos);
      doc.text(`${fullSO.currency} ${Math.round(fullSO.total_amount).toLocaleString('en-IN')}`, 195, yPos, { align: 'right' });
      
      yPos += 8;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      const amountWords = convertNumberToWords(fullSO.total_amount);
      doc.text(`Amount in words: ${amountWords}`, 15, yPos);
      
      yPos += 10;
      
      // ========== TERMS & CONDITIONS ==========
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 128, 185);
      doc.text('TERMS & CONDITIONS', 15, yPos);
      
      yPos += 6;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      
      const terms = [
        '1. Payment Terms: Payment to be made as per agreed payment terms.',
        '2. Delivery: Goods shall be delivered as per the agreed delivery schedule.',
        '3. Quality: All goods conform to agreed specifications and quality standards.',
        '4. Warranty: Standard warranty applies unless otherwise specified.',
        '5. Returns: Returns accepted only with prior authorization.'
      ];
      
      terms.forEach(term => {
        doc.text(term, 15, yPos);
        yPos += 5;
      });
      
      if (fullSO.notes) {
        yPos += 3;
        doc.setFont('helvetica', 'bold');
        doc.text('Special Instructions:', 15, yPos);
        yPos += 5;
        doc.setFont('helvetica', 'normal');
        const notesLines = doc.splitTextToSize(fullSO.notes, 180);
        notesLines.forEach((line: string) => {
          doc.text(line, 15, yPos);
          yPos += 5;
        });
      }
      
      yPos += 10;
      
      // ========== AUTHORIZATION ==========
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Prepared By:', 20, yPos);
      doc.text('Approved By:', 130, yPos);
      
      yPos += 15;
      doc.setFont('helvetica', 'normal');
      doc.line(20, yPos, 80, yPos);
      doc.line(130, yPos, 190, yPos);
      
      yPos += 5;
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.text('Name & Signature', 20, yPos);
      doc.text('Name & Signature', 130, yPos);
      
      // Footer
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, 15, 285);
      doc.text('This is a computer-generated document', 195, 285, { align: 'right' });
      
      doc.save(`SO_${fullSO.order_number}_${new Date().toISOString().split('T')[0]}.pdf`);
      
      toast({
        title: "PDF Export Successful",
        description: `Sales Order ${fullSO.order_number} has been exported`,
      });
    } catch (error) {
      console.error('PDF export failed:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export to PDF",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="border-b border-border animate-in fade-in-0 slide-in-from-top-2 duration-300 bg-primary/5">
        <div className="flex justify-between items-center gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by order no, customer, PO number..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="SO Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={deliveryStatusFilter} onValueChange={(value) => { setDeliveryStatusFilter(value); setCurrentPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Delivery Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Delivery Status</SelectItem>
                <SelectItem value="not_started">Not Started</SelectItem>
                <SelectItem value="partially_delivered">Partially Delivered</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={exportAllToExcel} variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Export All to Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-muted-foreground">Loading sales orders...</div>
          </div>
        ) : paginatedOrders.length === 0 ? (
          <div className="text-center p-8">
            <div className="text-muted-foreground">
              {searchTerm ? 'No sales orders found matching your search.' : 'No sales orders yet.'}
            </div>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200 hover:from-slate-50 hover:to-slate-100">
                  <TableHead 
                    className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4"
                    onClick={() => handleSort('order_number')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Order No.</span>
                      {getSortIcon('order_number')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4"
                    onClick={() => handleSort('order_date')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Order Date</span>
                      {getSortIcon('order_date')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4"
                    onClick={() => handleSort('customer_name')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Customer</span>
                      {getSortIcon('customer_name')}
                    </div>
                  </TableHead>
                  <TableHead className="font-bold text-slate-800 py-4">PO Number</TableHead>
                  <TableHead 
                    className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4 text-center"
                    onClick={() => handleSort('total_ordered_qty')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Ordered Qty</span>
                      {getSortIcon('total_ordered_qty')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4 text-center"
                    onClick={() => handleSort('total_invoiced_qty')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Invoiced Qty</span>
                      {getSortIcon('total_invoiced_qty')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4 text-center"
                    onClick={() => handleSort('total_ready_to_deliver_qty')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Ready to Deliver</span>
                      {getSortIcon('total_ready_to_deliver_qty')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4 text-center"
                    onClick={() => handleSort('total_backorder_qty')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Backorder Qty</span>
                      {getSortIcon('total_backorder_qty')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Status</span>
                      {getSortIcon('status')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4"
                    onClick={() => handleSort('delivery_status')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Delivery Status</span>
                      {getSortIcon('delivery_status')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4 text-right"
                    onClick={() => handleSort('total_amount')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Total Amount</span>
                      {getSortIcon('total_amount')}
                    </div>
                  </TableHead>
                  <TableHead className="font-bold text-slate-800 text-right py-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedOrders.map((order) => (
                  <TableRow key={order.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      {order.order_number}
                    </TableCell>
                    <TableCell>
                      {format(new Date(order.order_date), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{order.customer_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {order.customer_ref}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {order.customer_po_number || '-'}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {order.total_ordered_qty}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {order.total_invoiced_qty}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="bg-success/10 text-success border border-success/20 rounded-lg px-3 py-2 text-sm">
                        <div className="font-semibold">
                          {(order.total_ready_to_deliver_qty ?? (typeof order.total_backorder_qty === 'number' ? (order.total_ordered_qty - order.total_backorder_qty) : (order.total_ordered_qty - order.total_invoiced_qty)))} units
                        </div>
                        {order.ready_to_deliver_value && (
                          <div className="text-xs mt-1">
                            {order.currency} {order.ready_to_deliver_value.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {typeof order.total_backorder_qty === 'number' ? 
                        order.total_backorder_qty : 
                        Math.max(0, order.total_ordered_qty - (order.total_ready_to_deliver_qty ?? (order.total_ordered_qty - order.total_invoiced_qty)))}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(order.status)}
                    </TableCell>
                    <TableCell>
                      {getDeliveryStatusBadge(order.delivery_status)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {order.currency} {order.total_amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        {/* Primary Actions Group */}
                        <div className="flex items-center rounded-lg border border-slate-200 bg-white shadow-sm">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onView(order)}
                            className="h-9 px-3 rounded-l-lg rounded-r-none border-r border-slate-200 hover:bg-blue-50 hover:text-blue-700 transition-all duration-200"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(order)}
                            className="h-9 px-3 rounded-none border-r border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 transition-all duration-200"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(order)}
                            disabled={ordersWithTransactions.has(order.id)}
                            className="h-9 px-3 rounded-r-lg rounded-l-none hover:bg-red-50 hover:text-red-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={ordersWithTransactions.has(order.id) ? "Cannot delete - has related transactions" : "Delete Order"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        {/* Export Actions Group */}
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadExcel(order)}
                            className="h-9 px-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-all duration-200 shadow-sm"
                            title="Download Excel"
                          >
                            <FileSpreadsheet className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadPDF(order)}
                            className="h-9 px-3 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300 transition-all duration-200 shadow-sm"
                            title="Download PDF"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, sortedOrders.length)} of {sortedOrders.length} entries
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => prev - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
