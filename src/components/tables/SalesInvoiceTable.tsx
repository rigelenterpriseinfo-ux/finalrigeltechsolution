import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Edit, Trash2, Eye, Search, Filter, FileSpreadsheet, FileText, Download, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { toast } from '@/hooks/use-toast';

interface SalesInvoice {
  id: string;
  invoice_number: string | null;
  invoice_date: string;
  customer_name: string;
  sales_order_id: string;
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  created_at: string;
  sales_orders?: {
    order_number: string;
  };
}

interface SalesInvoiceTableProps {
  refreshTrigger?: number;
  onEdit: (invoice: SalesInvoice) => void;
  onView: (invoice: SalesInvoice) => void;
  onDownloadExcel?: (invoice: SalesInvoice) => void;
  onDownloadPDF?: (invoice: SalesInvoice) => void;
}

type SortField = 'invoice_number' | 'invoice_date' | 'customer_name' | 'total_amount';
type SortDirection = 'asc' | 'desc';

export const SalesInvoiceTable: React.FC<SalesInvoiceTableProps> = ({
  refreshTrigger,
  onEdit,
  onView,
  onDownloadExcel,
  onDownloadPDF,
}) => {
  const { company } = useAuth();
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('invoice_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [companyData, setCompanyData] = useState<any>(null);
  const itemsPerPage = 10;

  useEffect(() => {
    if (company?.id) {
      fetchInvoices();
      fetchCompanyData();
    }
  }, [company?.id, refreshTrigger]);

  const fetchCompanyData = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', company.id)
        .single();
      
      if (error) throw error;
      setCompanyData(data);
    } catch (error) {
      console.error('Error fetching company data:', error);
    }
  };

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sales_invoices')
        .select(`
          *,
          sales_orders!left(order_number)
        `)
        .eq('company_id', company.id)
        .order('invoice_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast({
        title: "Error",
        description: "Failed to fetch sales invoices",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (invoiceId: string) => {
    try {
      const { error } = await supabase
        .from('sales_invoices')
        .delete()
        .eq('id', invoiceId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Sales invoice deleted successfully",
      });
      
      fetchInvoices();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast({
        title: "Error",
        description: "Failed to delete sales invoice",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      finalized: { label: 'Finalized', variant: 'default' as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.finalized;
    return <Badge variant={config.variant}>{config.label}</Badge>;
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
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 > 0 ? ' ' + ones[n % 10] : '');
      return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 > 0 ? ' ' + convertLessThanThousand(n % 100) : '');
    };
    
    const roundedNum = Math.round(num);
    if (roundedNum < 1000) return convertLessThanThousand(roundedNum) + ' Rupees Only';
    if (roundedNum < 100000) return convertLessThanThousand(Math.floor(roundedNum / 1000)) + ' Thousand ' + convertLessThanThousand(roundedNum % 1000) + ' Rupees Only';
    if (roundedNum < 10000000) return convertLessThanThousand(Math.floor(roundedNum / 100000)) + ' Lakh ' + convertLessThanThousand(Math.floor((roundedNum % 100000) / 1000)) + ' Thousand ' + convertLessThanThousand(roundedNum % 1000) + ' Rupees Only';
    return convertLessThanThousand(Math.floor(roundedNum / 10000000)) + ' Crore ' + convertLessThanThousand(Math.floor((roundedNum % 10000000) / 100000)) + ' Lakh ' + convertLessThanThousand(Math.floor((roundedNum % 100000) / 1000)) + ' Thousand ' + convertLessThanThousand(roundedNum % 1000) + ' Rupees Only';
  };

  const handleDownloadExcel = async (invoice: SalesInvoice) => {
    if (onDownloadExcel) return onDownloadExcel(invoice);
    
    try {
      // Fetch complete invoice details
      const { data: fullInvoice, error: invoiceError } = await supabase
        .from('sales_invoices')
        .select(`
          *,
          sales_orders!left(order_number, customer_po_number),
          customers!left(*)
        `)
        .eq('id', invoice.id)
        .single();

      if (invoiceError || !fullInvoice) {
        console.error('Error fetching invoice details:', invoiceError);
        toast({
          title: "Error",
          description: "Failed to fetch complete invoice details",
          variant: "destructive",
        });
        return;
      }

      // Fetch invoice items first
      const { data: rawInvoiceItems, error: itemsError } = await supabase
        .from('sales_invoice_items')
        .select('*')
        .eq('sales_invoice_id', invoice.id)
        .order('created_at', { ascending: true });

      if (itemsError || !rawInvoiceItems) {
        console.error('Error fetching invoice items:', itemsError);
        toast({
          title: "Error",
          description: "Failed to fetch invoice items",
          variant: "destructive",
        });
        return;
      }

      // Fetch products separately
      const productIds = [...new Set(rawInvoiceItems.map(item => item.product_id).filter(Boolean))];
      const { data: products } = await supabase
        .from('products')
        .select('id, sku, name')
        .in('id', productIds);

      // Create product lookup map and enrich items
      const productMap = new Map(products?.map(p => [p.id, p]) || []);
      const invoiceItems = rawInvoiceItems.map(item => ({
        ...item,
        products: productMap.get(item.product_id) || null
      }));

      // Company Header
      const companyInfo = [
        ['SALES INVOICE'],
        [''],
        [`Company: ${companyData?.name || 'Your Company Name'}`],
        [companyData?.address_line1 || 'Address Line 1'],
        [`${companyData?.city || 'City'}, ${companyData?.state || 'State'} - ${companyData?.postal_code || 'PIN'}`],
        [`GSTIN: ${companyData?.gstn || 'N/A'} | Phone: ${companyData?.phone || 'N/A'}`],
        [`Email: ${companyData?.email || 'company@example.com'}`],
        ['']
      ];

      // Invoice Header
      const invoiceHeader = [
        ['Invoice Number:', fullInvoice.invoice_number || 'DRAFT', '', 'Date:', format(new Date(fullInvoice.invoice_date), 'dd/MM/yyyy')],
        ['Sales Order:', fullInvoice.sales_orders?.order_number || 'N/A', '', 'Status:', fullInvoice.status.toUpperCase()],
        ['']
      ];

      // Customer Details
      const customerDetails = [
        ['BILL TO', '', '', 'SHIP TO'],
        [fullInvoice.customer_name, '', '', fullInvoice.customer_name],
        [fullInvoice.billing_address_line1 || 'N/A', '', '', fullInvoice.shipping_address_line1 || 'N/A'],
        [`${fullInvoice.billing_city || ''}, ${fullInvoice.billing_state || ''}`, '', '', `${fullInvoice.shipping_city || ''}, ${fullInvoice.shipping_state || ''}`],
        [`PIN: ${fullInvoice.billing_pin_code || 'N/A'}`, '', '', `PIN: ${fullInvoice.shipping_pin_code || 'N/A'}`],
        ['']
      ];

      // Invoice Details
      const invoiceDetails = [
        ['INVOICE DETAILS'],
        ['Invoice Date:', format(new Date(fullInvoice.invoice_date), 'dd/MM/yyyy'), '', 'Due Date:', fullInvoice.due_date ? format(new Date(fullInvoice.due_date), 'dd/MM/yyyy') : 'N/A'],
        ['Payment Terms:', fullInvoice.payment_terms || 'N/A', '', 'Currency:', fullInvoice.currency || 'INR'],
        ['Customer PO:', fullInvoice.customer_po_reference || 'N/A', '', 'Account Manager:', fullInvoice.account_manager || 'N/A'],
        ['Mode of Delivery:', fullInvoice.mode_of_delivery || 'N/A', '', 'Transporter:', fullInvoice.transporter || 'N/A'],
        ['']
      ];

      // Line Items Header
      const lineItemsHeader = [
        ['LINE ITEMS'],
        ['S.No', 'Item Code', 'Description', 'HSN', 'Qty', 'UOM', 'Rate', 'Disc%', 'Disc Amt', 'CGST%', 'CGST Amt', 'SGST%', 'SGST Amt', 'IGST%', 'IGST Amt', 'Amount']
      ];

      // Map invoice items
      const lineItems = (invoiceItems || []).map((item: any, index: number) => {
        const subtotal = item.quantity_invoiced * item.unit_price;
        const discountAmount = item.discount_amount || 0;
        const lineTotal = item.line_total || subtotal - discountAmount + (item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0);
        
        return [
          index + 1,
          item.products?.sku || item.item_code || 'N/A',
          item.products?.name || item.item_description || 'Item',
          item.hsn_sac_code || '-',
          item.quantity_invoiced || 0,
          item.unit_of_measure || 'pcs',
          Math.round(item.unit_price || 0),
          item.discount_percentage || 0,
          Math.round(discountAmount),
          item.cgst_rate || 0,
          Math.round(item.cgst_amount || 0),
          item.sgst_rate || 0,
          Math.round(item.sgst_amount || 0),
          item.igst_rate || 0,
          Math.round(item.igst_amount || 0),
          Math.round(lineTotal)
        ];
      });

      // Totals Section
      const subtotal = fullInvoice.subtotal_amount || 0;
      const totalsSection = [
        [''],
        ['', '', '', '', '', '', '', '', '', '', '', '', '', 'Subtotal:', `${fullInvoice.currency || 'INR'} ${Math.round(subtotal).toLocaleString('en-IN')}`],
        ['', '', '', '', '', '', '', '', '', '', '', '', '', 'Tax:', `${fullInvoice.currency || 'INR'} ${Math.round(fullInvoice.tax_amount || 0).toLocaleString('en-IN')}`],
      ];

      if (fullInvoice.freight_charges && fullInvoice.freight_charges > 0) {
        totalsSection.push(['', '', '', '', '', '', '', '', '', '', '', '', '', 'Freight:', `${fullInvoice.currency || 'INR'} ${Math.round(fullInvoice.freight_charges).toLocaleString('en-IN')}`]);
      }
      if (fullInvoice.packing_charges && fullInvoice.packing_charges > 0) {
        totalsSection.push(['', '', '', '', '', '', '', '', '', '', '', '', '', 'Packing:', `${fullInvoice.currency || 'INR'} ${Math.round(fullInvoice.packing_charges).toLocaleString('en-IN')}`]);
      }
      if (fullInvoice.round_off && fullInvoice.round_off !== 0) {
        totalsSection.push(['', '', '', '', '', '', '', '', '', '', '', '', '', 'Round Off:', `${fullInvoice.currency || 'INR'} ${Math.round(fullInvoice.round_off).toLocaleString('en-IN')}`]);
      }

      totalsSection.push(['', '', '', '', '', '', '', '', '', '', '', '', '', 'Total:', `${fullInvoice.currency || 'INR'} ${Math.round(fullInvoice.total_amount).toLocaleString('en-IN')}`]);
      
      const amountInWords = convertNumberToWords(fullInvoice.total_amount);
      totalsSection.push(['', '', '', '', '', '', '', '', '', '', '', '', '', 'Amount in words:', amountInWords]);

      // Terms Section
      const termsSection = [
        [''],
        ['TERMS & CONDITIONS'],
        ['1. Payment Terms: Payment to be made as per agreed terms.'],
        ['2. Goods once sold will not be taken back.'],
        ['3. All disputes subject to local jurisdiction.'],
        ['']
      ];

      if (fullInvoice.notes) {
        termsSection.push(['Notes:', fullInvoice.notes]);
        termsSection.push(['']);
      }

      // Authorization
      const authSection = [
        ['AUTHORIZATION'],
        ['For ' + (companyData?.name || 'Company Name')],
        [''],
        ['Authorized Signatory'],
        [''],
        [`Generated on: ${new Date().toLocaleString('en-IN')}`]
      ];

      // Combine all sections
      const fullData = [
        ...companyInfo,
        ...invoiceHeader,
        ...customerDetails,
        ...invoiceDetails,
        ...lineItemsHeader,
        ...lineItems,
        ...totalsSection,
        ...termsSection,
        ...authSection
      ];

      const ws = XLSX.utils.aoa_to_sheet(fullData);
      const wb = XLSX.utils.book_new();

      // Set column widths
      ws['!cols'] = [
        { wch: 6 },   // S.No
        { wch: 12 },  // Item Code
        { wch: 30 },  // Description
        { wch: 12 },  // HSN
        { wch: 8 },   // Qty
        { wch: 8 },   // UOM
        { wch: 12 },  // Rate
        { wch: 8 },   // Disc%
        { wch: 12 },  // Disc Amt
        { wch: 8 },   // CGST%
        { wch: 12 },  // CGST Amt
        { wch: 8 },   // SGST%
        { wch: 12 },  // SGST Amt
        { wch: 8 },   // IGST%
        { wch: 12 },  // IGST Amt
        { wch: 15 }   // Amount
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Sales Invoice');
      XLSX.writeFile(wb, `Invoice_${fullInvoice.invoice_number || 'DRAFT'}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      
      toast({
        title: "Excel Export Successful",
        description: `Invoice ${fullInvoice.invoice_number || 'DRAFT'} has been exported`,
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

  const handleDownloadPDF = async (invoice: SalesInvoice) => {
    if (onDownloadPDF) return onDownloadPDF(invoice);
    
    try {
      // Fetch complete invoice details
      const { data: fullInvoice, error: invoiceError } = await supabase
        .from('sales_invoices')
        .select(`
          *,
          sales_orders!left(order_number, customer_po_number),
          customers!left(*)
        `)
        .eq('id', invoice.id)
        .single();

      if (invoiceError || !fullInvoice) {
        console.error('Error fetching invoice details:', invoiceError);
        toast({
          title: "Error",
          description: "Failed to fetch complete invoice details",
          variant: "destructive",
        });
        return;
      }

      // Fetch invoice items first
      const { data: rawInvoiceItems, error: itemsError } = await supabase
        .from('sales_invoice_items')
        .select('*')
        .eq('sales_invoice_id', invoice.id)
        .order('created_at', { ascending: true });

      if (itemsError || !rawInvoiceItems) {
        console.error('Error fetching invoice items:', itemsError);
        toast({
          title: "Error",
          description: "Failed to fetch invoice items",
          variant: "destructive",
        });
        return;
      }

      // Fetch products separately
      const productIds = [...new Set(rawInvoiceItems.map(item => item.product_id).filter(Boolean))];
      const { data: products } = await supabase
        .from('products')
        .select('id, sku, name')
        .in('id', productIds);

      // Create product lookup map and enrich items
      const productMap = new Map(products?.map(p => [p.id, p]) || []);
      const invoiceItems = rawInvoiceItems.map(item => ({
        ...item,
        products: productMap.get(item.product_id) || null
      }));

      const doc = new jsPDF();
      let yPos = 15;
      
      // ========== HEADER SECTION ==========
      doc.setFillColor(41, 128, 185);
      doc.rect(0, 0, 210, 50, 'F');
      
      // Add company logo if available
      if (companyData?.logo_url) {
        try {
          doc.setFillColor(255, 255, 255);
          doc.circle(25, 25, 12, 'F');
          doc.addImage(companyData.logo_url, 'PNG', 16, 16, 18, 18);
        } catch (error) {
          console.error('Error loading logo:', error);
        }
      }
      
      // Company details
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(companyData?.name || 'YOUR COMPANY NAME', 45, 16);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      
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
      
      // Document title
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('SALES INVOICE', 195, 18, { align: 'right' });
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Invoice #: ${fullInvoice.invoice_number || 'DRAFT'}`, 195, 28, { align: 'right' });
      doc.text(`Date: ${format(new Date(fullInvoice.invoice_date), 'dd/MM/yyyy')}`, 195, 34, { align: 'right' });
      
      yPos = 58;
      
      // ========== CUSTOMER & DELIVERY INFORMATION ==========
      doc.setFillColor(245, 245, 245);
      doc.rect(15, yPos, 87, 45, 'F');
      doc.rect(108, yPos, 87, 45, 'F');
      
      // Bill To
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 128, 185);
      doc.text('BILL TO', 17, yPos + 7);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(fullInvoice.customer_name, 17, yPos + 14);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      const billAddress = fullInvoice.billing_address_line1 || 'N/A';
      const billLines = doc.splitTextToSize(billAddress, 80);
      doc.text(billLines, 17, yPos + 19);
      
      const billDetailsY = yPos + 19 + (billLines.length * 4);
      doc.text(`${fullInvoice.billing_city || ''}, ${fullInvoice.billing_state || ''}`, 17, billDetailsY);
      doc.text(`PIN: ${fullInvoice.billing_pin_code || 'N/A'}`, 17, billDetailsY + 4);
      
      // Ship To
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 128, 185);
      doc.text('SHIP TO', 110, yPos + 7);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(fullInvoice.customer_name, 110, yPos + 14);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      const shipAddress = fullInvoice.shipping_address_line1 || 'N/A';
      const shipLines = doc.splitTextToSize(shipAddress, 80);
      doc.text(shipLines, 110, yPos + 19);
      
      const shipDetailsY = yPos + 19 + (shipLines.length * 4);
      doc.text(`${fullInvoice.shipping_city || ''}, ${fullInvoice.shipping_state || ''}`, 110, shipDetailsY);
      doc.text(`PIN: ${fullInvoice.shipping_pin_code || 'N/A'}`, 110, shipDetailsY + 4);
      
      yPos += 50;
      
      // ========== INVOICE DETAILS ==========
      doc.setFillColor(240, 240, 240);
      doc.rect(15, yPos, 180, 24, 'F');
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Invoice Date:', 17, yPos + 6);
      doc.text('Due Date:', 17, yPos + 12);
      doc.text('Payment Terms:', 17, yPos + 18);
      
      doc.setFont('helvetica', 'normal');
      doc.text(format(new Date(fullInvoice.invoice_date), 'dd/MM/yyyy'), 50, yPos + 6);
      doc.text(fullInvoice.due_date ? format(new Date(fullInvoice.due_date), 'dd/MM/yyyy') : 'N/A', 50, yPos + 12);
      doc.text(fullInvoice.payment_terms || 'N/A', 50, yPos + 18);
      
      doc.setFont('helvetica', 'bold');
      doc.text('Sales Order:', 110, yPos + 6);
      doc.text('Currency:', 110, yPos + 12);
      doc.text('Status:', 110, yPos + 18);
      
      doc.setFont('helvetica', 'normal');
      doc.text(fullInvoice.sales_orders?.order_number || 'N/A', 140, yPos + 6);
      doc.text(fullInvoice.currency || 'INR', 140, yPos + 12);
      doc.text(fullInvoice.status.toUpperCase(), 140, yPos + 18);
      
      yPos += 32;
      
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
      
      // Map invoice items
      const lineItems = (invoiceItems || []).map((item: any, index: number) => {
        const subtotal = item.quantity_invoiced * item.unit_price;
        const discountAmount = item.discount_amount || 0;
        const taxAmount = (item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0);
        const totalTaxRate = (item.cgst_rate || 0) + (item.sgst_rate || 0) + (item.igst_rate || 0);
        
        return {
          sno: index + 1,
          code: item.products?.sku || item.item_code || 'N/A',
          desc: item.products?.name || item.item_description || 'Item',
          hsn: item.hsn_sac_code || '-',
          qty: item.quantity_invoiced || 0,
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
      
      yPos += 10;
      
      // ========== TOTALS SECTION ==========
      const totalsX = 140;
      const subtotal = fullInvoice.subtotal_amount || 0;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      
      doc.text('Subtotal:', totalsX, yPos);
      doc.text(`${fullInvoice.currency || 'INR'} ${Math.round(subtotal).toLocaleString('en-IN')}`, 193, yPos, { align: 'right' });
      
      yPos += 5;
      doc.text('Tax:', totalsX, yPos);
      doc.text(`${fullInvoice.currency || 'INR'} ${Math.round(fullInvoice.tax_amount || 0).toLocaleString('en-IN')}`, 193, yPos, { align: 'right' });
      
      yPos += 5;
      if (fullInvoice.freight_charges && fullInvoice.freight_charges > 0) {
        doc.text('Freight:', totalsX, yPos);
        doc.text(`${fullInvoice.currency || 'INR'} ${Math.round(fullInvoice.freight_charges).toLocaleString('en-IN')}`, 193, yPos, { align: 'right' });
        yPos += 5;
      }
      
      if (fullInvoice.packing_charges && fullInvoice.packing_charges > 0) {
        doc.text('Packing:', totalsX, yPos);
        doc.text(`${fullInvoice.currency || 'INR'} ${Math.round(fullInvoice.packing_charges).toLocaleString('en-IN')}`, 193, yPos, { align: 'right' });
        yPos += 5;
      }
      
      if (fullInvoice.round_off && fullInvoice.round_off !== 0) {
        doc.text('Round Off:', totalsX, yPos);
        doc.text(`${fullInvoice.currency || 'INR'} ${Math.round(fullInvoice.round_off).toLocaleString('en-IN')}`, 193, yPos, { align: 'right' });
        yPos += 5;
      }
      
      doc.setDrawColor(100, 100, 100);
      doc.line(totalsX, yPos, 193, yPos);
      
      yPos += 7;
      
      doc.setFillColor(245, 245, 245);
      doc.rect(totalsX - 2, yPos - 5, 55, 8, 'F');
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      
      doc.text('Total:', totalsX, yPos);
      doc.text(`${fullInvoice.currency || 'INR'} ${Math.round(fullInvoice.total_amount).toLocaleString('en-IN')}`, 193, yPos, { align: 'right' });
      
      yPos += 8;
      
      // Amount in words
      const amountInWords = convertNumberToWords(fullInvoice.total_amount);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(60, 60, 60);
      const amountWordsLines = doc.splitTextToSize(`Amount in words: ${amountInWords}`, 180);
      doc.text(amountWordsLines, 17, yPos);
      
      yPos += 8;
      
      // ========== TERMS & CONDITIONS ==========
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 128, 185);
      doc.text('TERMS & CONDITIONS', 15, yPos);
      
      yPos += 6;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      
      const terms = [
        '1. Payment Terms: Payment to be made as per agreed terms.',
        '2. Goods once sold will not be taken back or exchanged.',
        '3. All disputes subject to local jurisdiction only.'
      ];
      
      terms.forEach(term => {
        const termLines = doc.splitTextToSize(term, 180);
        doc.text(termLines, 17, yPos);
        yPos += (termLines.length * 4);
      });
      
      yPos += 5;
      
      if (fullInvoice.notes) {
        doc.setFont('helvetica', 'bold');
        doc.text('Notes:', 17, yPos);
        yPos += 4;
        doc.setFont('helvetica', 'normal');
        const notesLines = doc.splitTextToSize(fullInvoice.notes, 180);
        doc.text(notesLines, 17, yPos);
        yPos += (notesLines.length * 4) + 5;
      }
      
      // ========== FOOTER/AUTHORIZATION ==========
      yPos += 10;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('For ' + (companyData?.name || 'Company Name'), 15, yPos);
      
      yPos += 15;
      doc.setFont('helvetica', 'normal');
      doc.text('Authorized Signatory', 15, yPos);
      
      // Footer
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, 105, 287, { align: 'center' });
      
      doc.save(`Invoice_${fullInvoice.invoice_number || 'DRAFT'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      
      toast({
        title: "PDF Export Successful",
        description: `Invoice ${fullInvoice.invoice_number || 'DRAFT'} has been exported`,
      });
    } catch (error) {
      console.error('Export to PDF failed:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export to PDF",
        variant: "destructive",
      });
    }
  };

  const exportAllToExcel = () => {
    try {
      const data = filteredInvoices.map((invoice) => ({
        'Invoice No.': invoice.invoice_number || 'DRAFT',
        'Date': format(new Date(invoice.invoice_date), 'dd/MM/yyyy'),
        'Customer': invoice.customer_name,
        'Sales Order': invoice.sales_orders?.order_number || 'N/A',
        'Subtotal': Math.round(invoice.subtotal_amount),
        'Tax': Math.round(invoice.tax_amount),
        'Total': Math.round(invoice.total_amount),
        'Status': invoice.status.toUpperCase(),
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      
      ws['!cols'] = [
        { wch: 15 },
        { wch: 12 },
        { wch: 25 },
        { wch: 15 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 }
      ];
      
      XLSX.utils.book_append_sheet(wb, ws, 'Sales Invoices');
      XLSX.writeFile(wb, `Sales_Invoices_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      
      toast({
        title: "Export Successful",
        description: `${filteredInvoices.length} invoices exported to Excel`,
      });
    } catch (error) {
      console.error('Export all failed:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export invoices",
        variant: "destructive",
      });
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      (invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (invoice.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (invoice.sales_orders?.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Sorting
  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    let aValue: any, bValue: any;
    
    switch (sortField) {
      case 'invoice_number':
        aValue = a.invoice_number || '';
        bValue = b.invoice_number || '';
        break;
      case 'invoice_date':
        aValue = new Date(a.invoice_date);
        bValue = new Date(b.invoice_date);
        break;
      case 'customer_name':
        aValue = a.customer_name;
        bValue = b.customer_name;
        break;
      case 'total_amount':
        aValue = a.total_amount;
        bValue = b.total_amount;
        break;
      default:
        return 0;
    }

    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
    } else {
      return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
    }
  });

  // Pagination
  const totalPages = Math.ceil(sortedInvoices.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentInvoices = sortedInvoices.slice(startIndex, endIndex);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const canEdit = (invoice: SalesInvoice) => {
    // All invoices are finalized and cannot be edited
    return false;
  };

  const canDelete = (invoice: SalesInvoice) => {
    // All invoices are finalized and cannot be deleted
    return false;
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading invoices...</div>;
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-end mb-6">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by invoice number, sales order, or customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Button
            onClick={exportAllToExcel}
            variant="outline"
            size="sm"
            className="gap-2 whitespace-nowrap"
          >
            <Download className="h-4 w-4" />
            Export All to Excel
          </Button>
          
          <div className="flex items-center gap-2 sm:ml-auto">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="finalized">Finalized</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        {currentInvoices.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchTerm || statusFilter !== 'all' 
              ? 'No invoices found matching your filters.' 
              : 'No sales invoices found. Create your first invoice!'}
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200 hover:from-slate-50 hover:to-slate-100">
                    <TableHead className="font-bold text-slate-800 py-4 cursor-pointer" onClick={() => handleSort('invoice_number')}>
                      <div className="flex items-center gap-2">
                        Invoice No.
                        {getSortIcon('invoice_number')}
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-slate-800 py-4 cursor-pointer" onClick={() => handleSort('invoice_date')}>
                      <div className="flex items-center gap-2">
                        Date
                        {getSortIcon('invoice_date')}
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-slate-800 py-4 cursor-pointer" onClick={() => handleSort('customer_name')}>
                      <div className="flex items-center gap-2">
                        Customer
                        {getSortIcon('customer_name')}
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-slate-800 py-4">Sales Order</TableHead>
                    <TableHead className="font-bold text-slate-800 py-4 text-right">Subtotal</TableHead>
                    <TableHead className="font-bold text-slate-800 py-4 text-right">Tax</TableHead>
                    <TableHead className="font-bold text-slate-800 py-4 text-right cursor-pointer" onClick={() => handleSort('total_amount')}>
                      <div className="flex items-center gap-2 justify-end">
                        Total
                        {getSortIcon('total_amount')}
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-slate-800 py-4">Status</TableHead>
                    <TableHead className="font-bold text-slate-800 py-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        {invoice.invoice_number || 'Draft - Not Generated'}
                      </TableCell>
                      <TableCell>
                        {format(new Date(invoice.invoice_date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>{invoice.customer_name}</TableCell>
                      <TableCell>
                        {invoice.sales_orders?.order_number || 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">₹{Math.round(invoice.subtotal_amount).toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-right">₹{Math.round(invoice.tax_amount).toLocaleString('en-IN')}</TableCell>
                      <TableCell className="font-medium text-right">
                        ₹{Math.round(invoice.total_amount).toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                          {/* Primary Actions Group */}
                          <div className="flex items-center rounded-lg border border-slate-200 bg-white shadow-sm">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onView(invoice)}
                              className="h-9 px-3 rounded-l-lg rounded-r-none border-r border-slate-200 hover:bg-blue-50 hover:text-blue-700 transition-all duration-200"
                              title="View Invoice"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {canEdit(invoice) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onEdit(invoice)}
                                className="h-9 px-3 rounded-none border-r border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 transition-all duration-200"
                                title="Edit Invoice"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete(invoice) && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 px-3 rounded-r-lg rounded-l-none hover:bg-red-50 hover:text-red-700 transition-all duration-200"
                                    title="Delete Invoice"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete this invoice? 
                                      This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(invoice.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                          
                          {/* Export Actions Group */}
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadExcel(invoice)}
                              className="h-9 px-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-all duration-200 shadow-sm"
                              title="Download Excel"
                            >
                              <FileSpreadsheet className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadPDF(invoice)}
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
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to {Math.min(endIndex, sortedInvoices.length)} of {sortedInvoices.length} invoices
                </div>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                    </PaginationItem>
                    
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          onClick={() => setCurrentPage(page)}
                          isActive={currentPage === page}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    
                    <PaginationItem>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};