import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { 
  Eye, 
  Edit, 
  Trash2, 
  Download, 
  FileSpreadsheet, 
  FileText,
  ChevronLeft, 
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { PurchaseOrderTableMobile } from './PurchaseOrderTableMobile';

interface PurchaseOrder {
  id: string;
  po_number: string;
  status: string;
  order_date: string;
  expected_date?: string;
  total_amount: number;
  received_amount: number;
  pending_amount: number;
  currency: string;
  supplier: {
    name: string;
  };
  created_at: string;
  notes?: string;
}

interface PurchaseOrderTableProps {
  purchaseOrders: PurchaseOrder[];
  onView: (po: PurchaseOrder) => void;
  onEdit: (po: PurchaseOrder) => void;
  onDelete: (poId: string) => void;
  loading?: boolean;
}

type SortField = 'po_number' | 'supplier_name' | 'order_date' | 'expected_date' | 'total_amount' | 'received_amount' | 'pending_amount' | 'status';
type SortDirection = 'asc' | 'desc';

export function PurchaseOrderTable({
  purchaseOrders,
  onView,
  onEdit,
  onDelete,
  loading = false
}: PurchaseOrderTableProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const isMobile = useIsMobile();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('order_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [companyData, setCompanyData] = useState<any>(null);
  
  // Transaction protection state
  const [posWithTransactions, setPOsWithTransactions] = useState<Set<string>>(new Set());
  
  const itemsPerPage = 5;

  // Mobile view
  if (isMobile) {
    return (
      <PurchaseOrderTableMobile
        purchaseOrders={purchaseOrders}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
        loading={loading}
      />
    );
  }

  // Fetch company data
  useEffect(() => {
    const fetchCompanyData = async () => {
      if (!profile?.company_id) return;
      
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .eq('id', profile.company_id)
          .single();
        
        if (error) throw error;
        setCompanyData(data);
      } catch (error) {
        console.error('Error fetching company data:', error);
      }
    };

    fetchCompanyData();
  }, [profile?.company_id]);

  // Check for PO transactions
  useEffect(() => {
    const checkPOTransactions = async () => {
      if (!profile?.company_id || purchaseOrders.length === 0) return;
      
      const poIds = purchaseOrders.map(po => po.id);
      const posWithTxns = new Set<string>();
      
      try {
        // Check for GRNs
        const { data: grnData } = await supabase
          .from('grn_header')
          .select('purchase_order_id')
          .eq('company_id', profile.company_id)
          .in('purchase_order_id', poIds);
        
        grnData?.forEach(grn => posWithTxns.add(grn.purchase_order_id));
        
        // Check for payments
        const { data: paymentData } = await supabase
          .from('payments')
          .select('purchase_order_id')
          .eq('company_id', profile.company_id)
          .in('purchase_order_id', poIds)
          .not('purchase_order_id', 'is', null);
        
        paymentData?.forEach(payment => posWithTxns.add(payment.purchase_order_id));
        
        // Check for inventory transactions
        const { data: invData } = await supabase
          .from('inventory_transactions')
          .select('reference_id')
          .eq('company_id', profile.company_id)
          .in('reference_id', poIds)
          .eq('transaction_type', 'purchase_receipt');
        
        invData?.forEach(inv => posWithTxns.add(inv.reference_id));
        
        setPOsWithTransactions(posWithTxns);
      } catch (error) {
        console.error('Error checking PO transactions:', error);
      }
    };
    
    checkPOTransactions();
  }, [purchaseOrders, profile?.company_id]);

  // Filter and sort data
  const filteredOrders = purchaseOrders.filter(order =>
    order.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    let aValue: any, bValue: any;
    
    switch (sortField) {
      case 'po_number':
        aValue = a.po_number;
        bValue = b.po_number;
        break;
      case 'supplier_name':
        aValue = a.supplier.name;
        bValue = b.supplier.name;
        break;
      case 'order_date':
        aValue = new Date(a.order_date);
        bValue = new Date(b.order_date);
        break;
      case 'expected_date':
        aValue = a.expected_date ? new Date(a.expected_date) : new Date('1900-01-01');
        bValue = b.expected_date ? new Date(b.expected_date) : new Date('1900-01-01');
        break;
      case 'total_amount':
        aValue = a.total_amount;
        bValue = b.total_amount;
        break;
      case 'received_amount':
        aValue = a.received_amount;
        bValue = b.received_amount;
        break;
      case 'pending_amount':
        aValue = a.pending_amount;
        bValue = b.pending_amount;
        break;
      case 'status':
        aValue = a.status;
        bValue = b.status;
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
  const totalPages = Math.ceil(sortedOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentOrders = sortedOrders.slice(startIndex, endIndex);

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

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'draft':
        return 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200';
      case 'open':
        return 'bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200';
      case 'confirmed':
        return 'bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200';
      case 'partially_received':
        return 'bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200';
      case 'closed':
        return 'bg-purple-100 text-purple-700 border border-purple-200 hover:bg-purple-200';
      case 'cancelled':
        return 'bg-red-100 text-red-700 border border-red-200 hover:bg-red-200';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200';
    }
  };

  const exportToExcel = async (order: PurchaseOrder) => {
    try {
      // Fetch complete purchase order details from database
      const { data: fullPO, error: poError } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          supplier:suppliers(*)
        `)
        .eq('id', order.id)
        .single();

      if (poError || !fullPO) {
        console.error('Error fetching PO details:', poError);
        toast({
          title: "Error",
          description: "Failed to fetch complete purchase order details",
          variant: "destructive",
        });
        return;
      }

      // Fetch purchase order items
      const { data: poItems, error: itemsError } = await supabase
        .from('purchase_order_items')
        .select('*')
        .eq('purchase_order_id', order.id)
        .order('created_at', { ascending: true });

      if (itemsError) {
        console.error('Error fetching PO items:', itemsError);
        toast({
          title: "Error",
          description: "Failed to fetch purchase order items",
          variant: "destructive",
        });
        return;
      }

      // Company Header with logo placeholder
      const companyInfo = [
        ['PURCHASE ORDER'],
        [''],
        [`Company: ${companyData?.name || 'Your Company Name'}`],
        [companyData?.address_line1 || 'Address Line 1'],
        [`${companyData?.city || 'City'}, ${companyData?.state || 'State'} - ${companyData?.postal_code || 'PIN'}`],
        [`GSTIN: ${companyData?.gstn || 'N/A'} | Phone: ${companyData?.phone || 'N/A'}`],
        [`Email: ${companyData?.email || 'company@example.com'}`],
        ['']
      ];

      // PO Header Details
      const poHeader = [
        ['PO Number:', fullPO.po_number, '', 'Date:', new Date(fullPO.order_date).toLocaleDateString('en-IN')],
        [''],
      ];

      // Vendor Details Section
      const vendorDetails = [
        ['VENDOR DETAILS', '', '', 'SHIP TO / DELIVERY ADDRESS'],
        [`${fullPO.supplier?.name || 'Supplier Name'}`, '', '', `${companyData?.name || 'Company Name'}`],
        [fullPO.supplier?.address || fullPO.supplier?.address_line1 || 'Supplier Address', '', '', fullPO.delivery_address_line1 || companyData?.address_line1 || 'Delivery Address'],
        [`Contact: ${fullPO.supplier_contact_person || fullPO.supplier?.contact_person || 'N/A'}`, '', '', `${fullPO.delivery_city || companyData?.city || 'City'}, ${fullPO.delivery_state || companyData?.state || 'State'}`],
        [`Phone: ${fullPO.supplier_contact_phone || fullPO.supplier?.phone || 'N/A'}`, '', '', `PIN: ${fullPO.delivery_postal_code || companyData?.postal_code || 'N/A'}`],
        [`Email: ${fullPO.supplier_contact_email || fullPO.supplier?.email || 'N/A'}`, '', '', `Place of Supply: ${fullPO.company_place_of_supply || companyData?.state || 'N/A'}`],
        [`GSTIN: ${fullPO.supplier_gstin || fullPO.supplier?.gst_number || 'N/A'}`],
        ['']
      ];

      // Order Details Section
      const orderDetails = [
        ['ORDER DETAILS'],
        ['PO Date:', new Date(fullPO.order_date).toLocaleDateString('en-IN'), '', 'PO Reference:', fullPO.external_po_ref || '-'],
        ['Expected Delivery:', fullPO.expected_date ? new Date(fullPO.expected_date).toLocaleDateString('en-IN') : 'TBD', '', 'Currency:', fullPO.currency || 'INR'],
        ['Payment Terms:', fullPO.payment_terms || 'Net 30 Days', '', 'Status:', fullPO.status.toUpperCase()],
        ['']
      ];

      // Line Items Header
      const lineItemsHeader = [
        ['LINE ITEMS'],
        ['S.No', 'Item Code', 'Description', 'HSN', 'Qty', 'Rate', 'Disc%', 'Disc Amt', 'Tax%', 'Tax Amt', 'Amount']
      ];

      // Map actual purchase order items
      const lineItems = (poItems || []).map((item: any, index: number) => {
        const subtotal = item.quantity * item.unit_price;
        const discountAmount = (subtotal * (item.discount_percentage || 0)) / 100;
        const taxAmount = (item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0);
        const totalTaxRate = (item.cgst_rate || 0) + (item.sgst_rate || 0) + (item.igst_rate || 0);
        const lineTotal = item.line_total || (subtotal - discountAmount + taxAmount);
        
        return [
          index + 1,
          item.item_code || item.product_sku || 'N/A',
          item.item_description || item.product_name || 'Item',
          item.hsn_sac_code || '-',
          item.quantity || 0,
          Math.round(item.unit_price || 0),
          item.discount_percentage || 0,
          Math.round(discountAmount),
          totalTaxRate,
          Math.round(taxAmount),
          Math.round(lineTotal)
        ];
      });

      // Totals Section
      const subtotal = fullPO.subtotal_amount || (fullPO.total_amount / 1.18);
      const cgst = ((subtotal * 9) / 100);
      const sgst = ((subtotal * 9) / 100);
      
      const totalsSection = [
        [''],
        ['', '', '', '', '', '', '', '', 'Subtotal:', `${fullPO.currency} ${Math.round(subtotal).toLocaleString('en-IN')}`],
        ['', '', '', '', '', '', '', '', 'CGST (9%):', `${fullPO.currency} ${Math.round(cgst).toLocaleString('en-IN')}`],
        ['', '', '', '', '', '', '', '', 'SGST (9%):', `${fullPO.currency} ${Math.round(sgst).toLocaleString('en-IN')}`],
      ];

      if (fullPO.total_discount_amount && fullPO.total_discount_amount > 0) {
        totalsSection.push(['', '', '', '', '', '', '', '', 'Discount:', `${fullPO.currency} ${Math.round(fullPO.total_discount_amount).toLocaleString('en-IN')}`]);
      }

      totalsSection.push(['', '', '', '', '', '', '', '', 'Total:', `${fullPO.currency} ${Math.round(fullPO.total_amount).toLocaleString('en-IN')}`]);
      
      const amountInWords = convertNumberToWords(fullPO.total_amount);
      totalsSection.push(['', '', '', '', '', '', '', '', 'Amount in words:', amountInWords]);

      // Terms and Conditions
      const termsSection = [
        [''],
        ['TERMS & CONDITIONS'],
        ['1. Payment Terms: Payment to be made as per agreed payment terms. Late payments may attract interest.'],
        ['2. Delivery: Supplier shall deliver goods as per the agreed delivery schedule. Any delays must be communicated in advance.'],
        ['3. Quality Standards: All goods must conform to agreed specifications and quality standards. Goods are subject to inspection.'],
        ['4. Warranty: Standard manufacturer warranty applies unless otherwise specified.'],
        ['5. Returns & Rejections: Defective or non-conforming goods may be returned at supplier\'s expense with prior authorization.'],
        ['6. Force Majeure: Neither party shall be liable for failure to perform due to circumstances beyond reasonable control.'],
        ['7. Governing Law: This PO is governed by the laws of India and subject to jurisdiction of local courts.'],
        ['']
      ];

      if (fullPO.notes) {
        termsSection.push(['Special Instructions:', fullPO.notes]);
        termsSection.push(['']);
      }

      // Authorization Section
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
        ...poHeader,
        ...vendorDetails,
        ...orderDetails,
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
        { wch: 12 },  // Rate
        { wch: 8 },   // Disc%
        { wch: 12 },  // Disc Amt
        { wch: 8 },   // Tax%
        { wch: 12 },  // Tax Amt
        { wch: 15 }   // Amount
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Purchase Order');
      XLSX.writeFile(wb, `PO_${fullPO.po_number}_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      toast({
        title: "Excel Export Successful",
        description: `Purchase Order ${fullPO.po_number} has been exported`,
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
    
    // Split into integer and decimal parts
    const [integerPart, decimalPart] = num.toFixed(2).split('.');
    const intNum = parseInt(integerPart);
    const decNum = parseInt(decimalPart);
    
    if (intNum === 0 && decNum === 0) return 'Zero Rupees Only';
    
    let words = 'Rupees ';
    
    // Indian numbering system: crores, lakhs, thousands, hundreds
    const crore = Math.floor(intNum / 10000000);
    const lakh = Math.floor((intNum % 10000000) / 100000);
    const thousand = Math.floor((intNum % 100000) / 1000);
    const hundred = intNum % 1000;
    
    if (crore > 0) words += convertLessThanThousand(crore) + ' Crore ';
    if (lakh > 0) words += convertLessThanThousand(lakh) + ' Lakh ';
    if (thousand > 0) words += convertLessThanThousand(thousand) + ' Thousand ';
    if (hundred > 0) words += convertLessThanThousand(hundred) + ' ';
    
    // Add paise if present
    if (decNum > 0) {
      words += 'and ' + convertLessThanThousand(decNum) + ' Paise ';
    }
    
    return words.trim() + ' Only';
  };

  const exportToPDF = async (order: PurchaseOrder) => {
    try {
      // Fetch complete purchase order details from database
      const { data: fullPO, error: poError } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          supplier:suppliers(*)
        `)
        .eq('id', order.id)
        .single();

      if (poError || !fullPO) {
        console.error('Error fetching PO details:', poError);
        toast({
          title: "Error",
          description: "Failed to fetch complete purchase order details",
          variant: "destructive",
        });
        return;
      }

      // Fetch purchase order items
      const { data: poItems, error: itemsError } = await supabase
        .from('purchase_order_items')
        .select('*')
        .eq('purchase_order_id', order.id)
        .order('created_at', { ascending: true });

      if (itemsError) {
        console.error('Error fetching PO items:', itemsError);
        toast({
          title: "Error",
          description: "Failed to fetch purchase order items",
          variant: "destructive",
        });
        return;
      }

      const doc = new jsPDF();
      let yPos = 15;
      
      // ========== MODERN HEADER SECTION ==========
      // Top blue accent bar
      doc.setFillColor(41, 128, 185);
      doc.rect(0, 0, 210, 50, 'F');
      
      // Add company logo if available
      if (companyData?.logo_url) {
        try {
          // Logo with white background circle for contrast
          doc.setFillColor(255, 255, 255);
          doc.circle(25, 25, 12, 'F');
          doc.addImage(companyData.logo_url, 'PNG', 16, 16, 18, 18);
        } catch (error) {
          console.error('Error loading logo:', error);
        }
      }
      
      // Company name and details (Left side with better spacing)
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
      
      // Document title and info (Right side with clean layout)
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('PURCHASE ORDER', 195, 18, { align: 'right' });
      
      // Info box on the right
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`PO #: ${fullPO.po_number}`, 195, 28, { align: 'right' });
      doc.text(`Date: ${new Date(fullPO.order_date).toLocaleDateString('en-IN')}`, 195, 34, { align: 'right' });
      
      yPos = 58;
      
      // ========== VENDOR & BUYER INFORMATION SECTION ==========
      doc.setFillColor(245, 245, 245);
      doc.rect(15, yPos, 87, 45, 'F'); // Vendor box
      doc.rect(108, yPos, 87, 45, 'F'); // Buyer box
      
      // Vendor Details
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 128, 185);
      doc.text('VENDOR DETAILS', 17, yPos + 7);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(fullPO.supplier?.name || 'Supplier Name', 17, yPos + 14);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      const vendorAddress = fullPO.supplier?.address || fullPO.supplier?.address_line1 || 'Supplier Address';
      const vendorLines = doc.splitTextToSize(vendorAddress, 80);
      doc.text(vendorLines, 17, yPos + 19);
      
      const vendorDetailsY = yPos + 19 + (vendorLines.length * 4);
      doc.text(`Contact: ${fullPO.supplier_contact_person || fullPO.supplier?.contact_person || 'N/A'}`, 17, vendorDetailsY);
      doc.text(`Phone: ${fullPO.supplier_contact_phone || fullPO.supplier?.phone || 'N/A'}`, 17, vendorDetailsY + 4);
      doc.text(`Email: ${fullPO.supplier_contact_email || fullPO.supplier?.email || 'N/A'}`, 17, vendorDetailsY + 8);
      doc.text(`GSTIN: ${fullPO.supplier_gstin || fullPO.supplier?.gst_number || 'N/A'}`, 17, vendorDetailsY + 12);
      
      // Delivery/Ship To Details
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 128, 185);
      doc.text('SHIP TO / DELIVERY ADDRESS', 110, yPos + 7);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(companyData?.name || 'Company Name', 110, yPos + 14);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      const shipAddress = fullPO.delivery_address_line1 || companyData?.address_line1 || 'Delivery Address';
      const shipLines = doc.splitTextToSize(shipAddress, 80);
      doc.text(shipLines, 110, yPos + 19);
      
      const shipDetailsY = yPos + 19 + (shipLines.length * 4);
      doc.text(`${fullPO.delivery_city || companyData?.city || 'City'}, ${fullPO.delivery_state || companyData?.state || 'State'}`, 110, shipDetailsY);
      doc.text(`PIN: ${fullPO.delivery_postal_code || companyData?.postal_code || 'N/A'}`, 110, shipDetailsY + 4);
      doc.text(`Place of Supply: ${fullPO.company_place_of_supply || companyData?.state || 'N/A'}`, 110, shipDetailsY + 8);
      
      yPos += 50;
      
      // ========== ORDER DETAILS SECTION ==========
      doc.setFillColor(240, 240, 240);
      doc.rect(15, yPos, 180, 20, 'F');
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('PO Date:', 17, yPos + 6);
      doc.text('Expected Delivery:', 17, yPos + 12);
      doc.text('Payment Terms:', 17, yPos + 18);
      
      doc.setFont('helvetica', 'normal');
      doc.text(new Date(fullPO.order_date).toLocaleDateString('en-IN'), 50, yPos + 6);
      doc.text(fullPO.expected_date ? new Date(fullPO.expected_date).toLocaleDateString('en-IN') : 'TBD', 50, yPos + 12);
      doc.text(fullPO.payment_terms || 'Net 30 Days', 50, yPos + 18);
      
      doc.setFont('helvetica', 'bold');
      doc.text('PO Reference:', 110, yPos + 6);
      doc.text('Currency:', 110, yPos + 12);
      doc.text('Status:', 110, yPos + 18);
      
      doc.setFont('helvetica', 'normal');
      doc.text(fullPO.external_po_ref || '-', 140, yPos + 6);
      doc.text(fullPO.currency || 'INR', 140, yPos + 12);
      doc.text(fullPO.status.toUpperCase(), 140, yPos + 18);
      
      yPos += 28;
      
      // ========== LINE ITEMS TABLE ==========
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 128, 185);
      doc.text('LINE ITEMS', 15, yPos);
      
      yPos += 6;
      
      // Table Header with compressed left columns and expanded right columns
      doc.setFillColor(41, 128, 185);
      doc.rect(15, yPos, 180, 10, 'F');
      
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      
      // Optimized column positions - increased space between Disc% and Disc Amt
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
      
      // Map actual purchase order items from database
      const lineItems = (poItems || []).map((item: any, index: number) => {
        const subtotal = item.quantity * item.unit_price;
        const discountAmount = (subtotal * (item.discount_percentage || 0)) / 100;
        const subtotalAfterDiscount = subtotal - discountAmount;
        const taxAmount = (item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0);
        const totalTaxRate = (item.cgst_rate || 0) + (item.sgst_rate || 0) + (item.igst_rate || 0);
        
        return {
          sno: index + 1,
          code: item.item_code || item.product_sku || 'N/A',
          desc: item.item_description || item.product_name || 'Item',
          hsn: item.hsn_sac_code || '-',
          qty: item.quantity || 0,
          uom: item.unit_of_measure || 'PCS',
          rate: item.unit_price || 0,
          disc: item.discount_percentage || 0,
          discAmt: discountAmount,
          tax: totalTaxRate,
          taxAmt: taxAmount,
          amount: item.line_total || (subtotalAfterDiscount + taxAmount)
        };
      });
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(7.5);
      
      lineItems.forEach((item, index) => {
        // Alternating row background with more subtle color
        if (index % 2 === 0) {
          doc.setFillColor(248, 249, 250);
          doc.rect(15, yPos - 2, 180, 9, 'F');
        }
        
        // Draw subtle row border
        doc.setDrawColor(220, 220, 220);
        doc.line(15, yPos + 7, 195, yPos + 7);
        
        // Data with proper alignment and spacing - compressed left columns
        doc.text(item.sno.toString(), colPositions.sno, yPos + 4);
        
        // Item code - reduced to 7 chars
        const itemCode = item.code.length > 7 ? item.code.substring(0, 7) : item.code;
        doc.text(itemCode, colPositions.itemCode, yPos + 4);
        
        // Description - reduced to 25 chars
        const descText = item.desc.length > 25 ? item.desc.substring(0, 25) + '...' : item.desc;
        doc.text(descText, colPositions.description, yPos + 4);
        
        // HSN - reduced to 10 chars
        const hsnText = item.hsn.length > 10 ? item.hsn.substring(0, 10) : item.hsn;
        doc.text(hsnText, colPositions.hsn, yPos + 4);
        
        doc.text(item.qty.toString(), colPositions.qty, yPos + 4, { align: 'center' });
        // Rate without decimals
        doc.text(Math.round(item.rate).toString(), colPositions.rate, yPos + 4, { align: 'right' });
        doc.text(item.disc.toString(), colPositions.discPct, yPos + 4, { align: 'center' });
        doc.text(Math.round(item.discAmt).toString(), colPositions.discAmt, yPos + 4, { align: 'right' });
        doc.text(item.tax.toString(), colPositions.taxPct, yPos + 4, { align: 'center' });
        doc.text(Math.round(item.taxAmt).toString(), colPositions.taxAmt, yPos + 4, { align: 'right' });
        
        // Amount in bold without decimals
        doc.setFont('helvetica', 'bold');
        doc.text(Math.round(item.amount).toString(), colPositions.amount, yPos + 4, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        
        yPos += 9;
      });
      
      // Table bottom border with emphasis
      doc.setDrawColor(41, 128, 185);
      doc.setLineWidth(0.5);
      doc.line(15, yPos, 195, yPos);
      doc.setLineWidth(0.2); // Reset line width
      
      yPos += 10;
      
      // ========== TOTALS SECTION ==========
      const totalsX = 140;
      const subtotal = fullPO.subtotal_amount || (fullPO.total_amount / 1.18); // Assuming 18% GST
      const cgst = ((subtotal * 9) / 100);
      const sgst = ((subtotal * 9) / 100);
      const totalTax = fullPO.total_tax_amount || (cgst + sgst);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      
      doc.text('Subtotal:', totalsX, yPos);
      doc.text(`${fullPO.currency} ${Math.round(subtotal).toLocaleString('en-IN')}`, 193, yPos, { align: 'right' });
      
      yPos += 5;
      doc.text('CGST (9%):', totalsX, yPos);
      doc.text(`${fullPO.currency} ${Math.round(cgst).toLocaleString('en-IN')}`, 193, yPos, { align: 'right' });
      
      yPos += 5;
      doc.text('SGST (9%):', totalsX, yPos);
      doc.text(`${fullPO.currency} ${Math.round(sgst).toLocaleString('en-IN')}`, 193, yPos, { align: 'right' });
      
      yPos += 5;
      if (fullPO.total_discount_amount && fullPO.total_discount_amount > 0) {
        doc.text('Discount:', totalsX, yPos);
        doc.text(`${fullPO.currency} ${Math.round(fullPO.total_discount_amount).toLocaleString('en-IN')}`, 193, yPos, { align: 'right' });
        yPos += 5;
      }
      
      doc.setDrawColor(100, 100, 100);
      doc.line(totalsX, yPos, 193, yPos);
      
      yPos += 7;
      
      // Draw background for total row
      doc.setFillColor(245, 245, 245);
      doc.rect(totalsX - 2, yPos - 5, 55, 8, 'F');
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      
      // Changed label to "Total:" - Remove decimals
      doc.text('Total:', totalsX, yPos);
      doc.text(`${fullPO.currency} ${Math.round(fullPO.total_amount).toLocaleString('en-IN')}`, 193, yPos, { align: 'right' });
      
      yPos += 8;
      
      // Amount in words - Convert actual total to words
      const amountInWords = convertNumberToWords(fullPO.total_amount);
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
        '1. Payment Terms: Payment to be made as per agreed payment terms. Late payments may attract interest.',
        '2. Delivery: Supplier shall deliver goods as per the agreed delivery schedule. Any delays must be communicated in advance.',
        '3. Quality Standards: All goods must conform to agreed specifications and quality standards. Goods are subject to inspection.',
        '4. Warranty: Standard manufacturer warranty applies unless otherwise specified.',
        '5. Returns & Rejections: Defective or non-conforming goods may be returned at supplier\'s expense with prior authorization.',
        '6. Force Majeure: Neither party shall be liable for failure to perform due to circumstances beyond reasonable control.',
        '7. Governing Law: This PO is governed by the laws of India and subject to jurisdiction of local courts.'
      ];
      
      terms.forEach(term => {
        const termLines = doc.splitTextToSize(term, 180);
        doc.text(termLines, 17, yPos);
        yPos += (termLines.length * 4);
      });
      
      yPos += 5;
      
      // Special Notes
      if (fullPO.notes) {
        doc.setFont('helvetica', 'bold');
        doc.text('Special Instructions:', 17, yPos);
        yPos += 4;
        doc.setFont('helvetica', 'normal');
        const notesLines = doc.splitTextToSize(fullPO.notes, 180);
        doc.text(notesLines, 17, yPos);
        yPos += (notesLines.length * 4) + 5;
      }
      
      // ========== AUTHORIZATION SECTION ==========
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setDrawColor(200, 200, 200);
      doc.line(15, yPos, 195, yPos);
      yPos += 8;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      
      // Prepared By
      doc.text('Prepared By:', 20, yPos);
      doc.text('Approved By:', 110, yPos);
      yPos += 15;
      
      doc.setFont('helvetica', 'normal');
      doc.line(20, yPos, 80, yPos); // Signature line
      doc.line(110, yPos, 170, yPos); // Signature line
      yPos += 4;
      
      doc.setFontSize(8);
      doc.text('Name & Signature', 20, yPos);
      doc.text('Name & Signature', 110, yPos);
      yPos += 3;
      doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 20, yPos);
      doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 110, yPos);
      
      // ========== FOOTER ==========
      const pageCount = doc.internal.pages.length - 1;
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 120);
        doc.setFont('helvetica', 'italic');
        doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
        doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, 15, 290);
        doc.text('This is a computer-generated document', 195, 290, { align: 'right' });
      }
      
      doc.save(`PO_${fullPO.po_number}_${new Date().toISOString().split('T')[0]}.pdf`);
      
      toast({
        title: "PDF Generated Successfully",
        description: `Purchase Order ${fullPO.po_number} has been exported`,
      });
    } catch (error) {
      console.error('PDF Export Error:', error);
      toast({
        title: "Export Failed",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        {/* Search and Controls - Mobile Optimized */}
        <div className="p-4 sm:p-6 border-b bg-gradient-to-r from-blue-50 to-blue-100">
          <div className="flex flex-col gap-4 items-start justify-between">
            <div className="flex items-center gap-2 w-full">
              <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Input
                placeholder="Search by PO number, supplier, or status..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-white"
              />
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-4 gap-2 text-sm text-muted-foreground">
            <span>
              Showing {currentOrders.length} of {filteredOrders.length} purchase orders
            </span>
            <span>
              Page {currentPage} of {totalPages}
            </span>
          </div>
        </div>

        {/* Table - Enhanced Design */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200 hover:from-slate-50 hover:to-slate-100">
                <TableHead 
                  className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4"
                  onClick={() => handleSort('po_number')}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wider">PO Number</span>
                    {getSortIcon('po_number')}
                  </div>
                </TableHead>
                <TableHead 
                  className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4"
                  onClick={() => handleSort('supplier_name')}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wider">Supplier</span>
                    {getSortIcon('supplier_name')}
                  </div>
                </TableHead>
                <TableHead 
                  className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4"
                  onClick={() => handleSort('order_date')}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wider">Order Date</span>
                    {getSortIcon('order_date')}
                  </div>
                </TableHead>
                <TableHead 
                  className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4"
                  onClick={() => handleSort('expected_date')}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wider">Expected Delivery</span>
                    {getSortIcon('expected_date')}
                  </div>
                </TableHead>
                <TableHead 
                  className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4 text-right"
                  onClick={() => handleSort('total_amount')}
                >
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-xs uppercase tracking-wider">Total Amount</span>
                    {getSortIcon('total_amount')}
                  </div>
                </TableHead>
                <TableHead 
                  className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4 text-right"
                  onClick={() => handleSort('received_amount')}
                >
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-xs uppercase tracking-wider">Received</span>
                    {getSortIcon('received_amount')}
                  </div>
                </TableHead>
                <TableHead 
                  className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4 text-right"
                  onClick={() => handleSort('pending_amount')}
                >
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-xs uppercase tracking-wider">Pending</span>
                    {getSortIcon('pending_amount')}
                  </div>
                </TableHead>
                <TableHead 
                  className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wider">Status</span>
                    {getSortIcon('status')}
                  </div>
                </TableHead>
                <TableHead className="font-bold text-slate-800 text-center py-4 min-w-[200px]">
                  <span className="text-xs uppercase tracking-wider">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <FileText className="h-12 w-12 opacity-40" />
                      <p className="font-medium">
                        {searchTerm ? 'No purchase orders found matching your search.' : 'No purchase orders found.'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                currentOrders.map((order) => (
                  <TableRow 
                    key={order.id} 
                    className="hover:bg-slate-50 transition-all duration-200 border-b border-slate-100 group"
                  >
                    <TableCell className="font-semibold text-blue-600 py-4">
                      {order.po_number}
                    </TableCell>
                    <TableCell className="font-medium text-slate-700 py-4">
                      {order.supplier.name}
                    </TableCell>
                    <TableCell className="text-slate-600 py-4">
                      {new Date(order.order_date).toLocaleDateString('en-IN', { 
                        day: '2-digit', 
                        month: 'short', 
                        year: 'numeric' 
                      })}
                    </TableCell>
                    <TableCell className="text-slate-600 py-4">
                      {order.expected_date 
                        ? new Date(order.expected_date).toLocaleDateString('en-IN', { 
                            day: '2-digit', 
                            month: 'short', 
                            year: 'numeric' 
                          })
                        : <span className="text-slate-400 italic">Not set</span>
                      }
                    </TableCell>
                    <TableCell className="font-bold text-slate-900 py-4 text-right">
                      {order.currency} {order.total_amount.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell className="font-semibold text-emerald-600 py-4 text-right">
                      {order.currency} {order.received_amount.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell className="font-semibold text-amber-600 py-4 text-right">
                      {order.currency} {order.pending_amount.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge 
                        variant="secondary" 
                        className={`${getStatusColor(order.status)} font-medium px-3 py-1 rounded-full text-xs`}
                      >
                        {order.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2 justify-center">
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
                            disabled={order.status === 'closed'}
                            className={`h-9 px-3 rounded-none border-r border-slate-200 transition-all duration-200 ${
                              order.status === 'closed' 
                                ? 'text-slate-300 cursor-not-allowed' 
                                : 'hover:bg-emerald-50 hover:text-emerald-700'
                            }`}
                            title={order.status === 'closed' ? 'Cannot edit closed order' : 'Edit Order'}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(order.id)}
                            disabled={order.status === 'closed' || order.status === 'partially_received' || posWithTransactions.has(order.id)}
                            className={`h-9 px-3 rounded-r-lg rounded-l-none transition-all duration-200 ${
                              order.status === 'closed' || order.status === 'partially_received' || posWithTransactions.has(order.id)
                                ? 'text-slate-300 cursor-not-allowed' 
                                : 'hover:bg-red-50 hover:text-red-700'
                            }`}
                            title={
                              posWithTransactions.has(order.id)
                                ? 'Has existing transactions'
                                : order.status === 'closed' || order.status === 'partially_received'
                                ? 'Cannot delete this order' 
                                : 'Delete Order'
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Export Actions Group */}
                        <div className="flex items-center rounded-lg border border-slate-200 bg-white shadow-sm">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => exportToExcel(order)}
                            className="h-9 px-3 rounded-l-lg rounded-r-none border-r border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 transition-all duration-200"
                            title="Export Excel"
                          >
                            <FileSpreadsheet className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => exportToPDF(order)}
                            className="h-9 px-3 rounded-r-lg rounded-l-none hover:bg-orange-50 hover:text-orange-700 transition-all duration-200"
                            title="Export PDF"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination - Enhanced Design */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 border-t bg-gradient-to-r from-slate-50 to-slate-100">
            <div className="text-sm font-medium text-slate-600">
              Showing <span className="font-bold text-slate-900">{startIndex + 1}</span> to{' '}
              <span className="font-bold text-slate-900">{Math.min(endIndex, filteredOrders.length)}</span> of{' '}
              <span className="font-bold text-slate-900">{filteredOrders.length}</span> results
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="h-9 px-4 hover:bg-white hover:shadow-md transition-all duration-200 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let page;
                  if (totalPages <= 5) {
                    page = i + 1;
                  } else if (currentPage <= 3) {
                    page = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    page = totalPages - 4 + i;
                  } else {
                    page = currentPage - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className={`h-9 w-9 p-0 transition-all duration-200 ${
                        currentPage === page 
                          ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md" 
                          : "hover:bg-white hover:shadow-md"
                      }`}
                    >
                      {page}
                    </Button>
                  );
                })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="h-9 px-4 hover:bg-white hover:shadow-md transition-all duration-200 disabled:opacity-50"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}