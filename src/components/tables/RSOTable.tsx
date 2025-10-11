import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PowerBICard } from '@/components/ui/powerbi-card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { 
  Eye, 
  Edit, 
  Trash2, 
  FileText,
  ChevronLeft, 
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Loader2,
  Download,
  FileSpreadsheet,
  AlertTriangle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format as formatDate } from 'date-fns';
import { RSOTableMobile } from './RSOTableMobile';

interface ReturnOrder {
  id: string;
  rso_number: string;
  rso_date: string;
  customer_id: string;
  customer_name: string;
  invoice_number: string;
  status: 'Draft' | 'Confirmed';
  reason_for_credit: string;
  total_amount: number;
}

interface CreditNote {
  id: string;
  cn_number: string;
  rso_id: string;
  status: 'Draft' | 'Confirmed';
}

interface RSOTableProps {
  returnOrders: ReturnOrder[];
  creditNotes: CreditNote[];
  onView: (rsoId: string) => void;
  onEdit: (rsoId: string) => void;
  onDelete: (rsoId: string) => void;
  onViewCreditNotes: (rso: ReturnOrder) => void;
  onExport?: (rso: ReturnOrder) => void;
  loading?: boolean;
  isActive?: boolean;
}

type SortField = 'rso_number' | 'rso_date' | 'customer_name' | 'invoice_number' | 'status' | 'total_amount';
type SortDirection = 'asc' | 'desc';

export function RSOTable({
  returnOrders,
  creditNotes,
  onView,
  onEdit,
  onDelete,
  onViewCreditNotes,
  onExport,
  loading = false,
  isActive = false
}: RSOTableProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const isMobile = useIsMobile();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cnStatusFilter, setCnStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('rso_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [companyData, setCompanyData] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rsoToDelete, setRsoToDelete] = useState<ReturnOrder | null>(null);
  
  // Track RSOs with credit notes
  const [rsosWithCreditNotes, setRSOsWithCreditNotes] = useState<Set<string>>(new Set());
  const [rsoLinkedCNs, setRsoLinkedCNs] = useState<Map<string, CreditNote[]>>(new Map());
  
  const itemsPerPage = 5;

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

  // Helper function to convert number to words (Indian format)
  const convertNumberToWords = (num: number): string => {
    if (num === 0) return 'Zero Rupees Only';
    
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    
    const convertGroup = (n: number): string => {
      if (n === 0) return '';
      if (n < 10) return ones[n];
      if (n < 20) return teens[n - 10];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
      return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertGroup(n % 100) : '');
    };
    
    const crore = Math.floor(num / 10000000);
    const lakh = Math.floor((num % 10000000) / 100000);
    const thousand = Math.floor((num % 100000) / 1000);
    const remainder = Math.floor(num % 1000);
    
    let result = '';
    if (crore) result += convertGroup(crore) + ' Crore ';
    if (lakh) result += convertGroup(lakh) + ' Lakh ';
    if (thousand) result += convertGroup(thousand) + ' Thousand ';
    if (remainder) result += convertGroup(remainder);
    
    return result.trim() + ' Rupees Only';
  };

  const exportToExcel = async (order: ReturnOrder) => {
    try {
      // Fetch complete RSO details
      const { data: fullRSO, error: rsoError } = await supabase
        .from('return_order_header')
        .select('*')
        .eq('id', order.id)
        .single();

      if (rsoError || !fullRSO) {
        toast({
          title: "Error",
          description: "Failed to fetch RSO details",
          variant: "destructive",
        });
        return;
      }

      // Fetch RSO line items
      const { data: rsoItems, error: itemsError } = await supabase
        .from('return_order_lines')
        .select('*')
        .eq('return_order_id', order.id)
        .order('created_at', { ascending: true });

      if (itemsError) {
        toast({
          title: "Error",
          description: "Failed to fetch RSO items",
          variant: "destructive",
        });
        return;
      }

      // Company Header
      const companyInfo = [
        ['RETURN SALES ORDER (RSO)'],
        [''],
        [`Company: ${companyData?.name || 'Your Company Name'}`],
        [companyData?.address_line1 || 'Address Line 1'],
        [`${companyData?.city || 'City'}, ${companyData?.state || 'State'} - ${companyData?.postal_code || 'PIN'}`],
        [`GSTIN: ${companyData?.gstn || 'N/A'} | Phone: ${companyData?.phone || 'N/A'}`],
        [`Email: ${companyData?.email || 'company@example.com'}`],
        ['']
      ];

      // RSO Header Details
      const rsoHeader = [
        ['RSO Number:', fullRSO.rso_number, '', 'Date:', new Date(fullRSO.rso_date).toLocaleDateString('en-IN')],
        ['Invoice Number:', fullRSO.invoice_number, '', 'Invoice Date:', new Date(fullRSO.invoice_date).toLocaleDateString('en-IN')],
        [''],
      ];

      // Customer Details
      const customerDetails = [
        ['CUSTOMER DETAILS', '', '', 'DELIVERY ADDRESS'],
        [fullRSO.customer_name, '', '', fullRSO.delivery_address_line1 || companyData?.address_line1 || 'N/A'],
        ['', '', '', fullRSO.delivery_address_line2 || ''],
        ['', '', '', `${fullRSO.delivery_city || companyData?.city || 'City'}`],
        ['', '', '', `PIN: ${fullRSO.delivery_pin_code || fullRSO.delivery_country || 'N/A'}`],
        [''],
        ['Reason for Return:', fullRSO.reason_for_credit],
        ['']
      ];

      // Line Items Header
      const lineItemsHeader = [
        ['LINE ITEMS'],
        ['S.No', 'Item Code', 'Description', 'HSN', 'Return Qty', 'Rate', 'Disc%', 'Disc Amt', 'CGST%', 'SGST%', 'IGST%', 'Tax Amt', 'Amount']
      ];

      // Map RSO items
      const lineItems = (rsoItems || []).map((item: any, index: number) => {
        const taxAmount = (item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0);
        
        return [
          index + 1,
          item.product_sku || 'N/A',
          item.product_name || 'Item',
          item.hsn_sac_code || '-',
          item.return_qty || 0,
          Math.round(item.unit_price || 0),
          item.discount_percentage || 0,
          Math.round(item.discount_amount || 0),
          item.cgst_rate || 0,
          item.sgst_rate || 0,
          item.igst_rate || 0,
          Math.round(taxAmount),
          Math.round(item.line_total || 0)
        ];
      });

      // Totals Section
      const totalsSection = [
        [''],
        ['', '', '', '', '', '', '', '', '', '', 'Subtotal:', `₹ ${Math.round(fullRSO.subtotal_amount || 0).toLocaleString('en-IN')}`],
        ['', '', '', '', '', '', '', '', '', '', 'Tax:', `₹ ${Math.round(fullRSO.tax_amount || 0).toLocaleString('en-IN')}`],
        ['', '', '', '', '', '', '', '', '', '', 'Total:', `₹ ${Math.round(fullRSO.total_amount || 0).toLocaleString('en-IN')}`],
        ['', '', '', '', '', '', '', '', '', '', 'Amount in words:', convertNumberToWords(fullRSO.total_amount || 0)]
      ];

      // Terms and Notes
      const termsSection = [
        [''],
        ['TERMS & CONDITIONS'],
        ['1. Returns must be processed as per company return policy.'],
        ['2. All returned items must be in original condition and packaging.'],
        ['3. Credit notes will be issued after inspection and approval of returned goods.'],
        ['4. Processing time for returns: 7-10 business days from receipt of goods.'],
        ['']
      ];

      if (fullRSO.notes) {
        termsSection.push(['Notes:', fullRSO.notes]);
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
        ...rsoHeader,
        ...customerDetails,
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
        { wch: 8 },   // CGST%
        { wch: 8 },   // SGST%
        { wch: 8 },   // IGST%
        { wch: 12 },  // Tax Amt
        { wch: 15 }   // Amount
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Return Sales Order');
      XLSX.writeFile(wb, `RSO_${fullRSO.rso_number}_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      toast({
        title: "Excel Export Successful",
        description: `RSO ${fullRSO.rso_number} has been exported`,
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

  // Check for RSOs with credit notes
  useEffect(() => {
    const rsosWithCN = new Set<string>();
    const cnMap = new Map<string, CreditNote[]>();
    
    creditNotes.forEach(cn => {
      rsosWithCN.add(cn.rso_id);
      
      if (!cnMap.has(cn.rso_id)) {
        cnMap.set(cn.rso_id, []);
      }
      cnMap.get(cn.rso_id)?.push(cn);
    });
    
    setRSOsWithCreditNotes(rsosWithCN);
    setRsoLinkedCNs(cnMap);
  }, [creditNotes]);

  // Filter and sort data
  const filteredOrders = returnOrders.filter(order => {
    const matchesSearch = 
      order.rso_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.invoice_number.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    // CN Status Filter
    let matchesCNStatus = true;
    if (cnStatusFilter !== 'all') {
      const linkedCNs = rsoLinkedCNs.get(order.id) || [];
      
      if (cnStatusFilter === 'no-cn') {
        matchesCNStatus = linkedCNs.length === 0;
      } else if (cnStatusFilter === 'cn-draft') {
        matchesCNStatus = linkedCNs.some(cn => cn.status === 'Draft');
      } else if (cnStatusFilter === 'cn-confirmed') {
        matchesCNStatus = linkedCNs.some(cn => cn.status === 'Confirmed');
      } else if (cnStatusFilter === 'cn-pending') {
        matchesCNStatus = order.status === 'Confirmed' && linkedCNs.length === 0;
      }
    }
    
    return matchesSearch && matchesStatus && matchesCNStatus;
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    let aValue: any, bValue: any;
    
    switch (sortField) {
      case 'rso_number':
        aValue = a.rso_number;
        bValue = b.rso_number;
        break;
      case 'rso_date':
        aValue = new Date(a.rso_date);
        bValue = new Date(b.rso_date);
        break;
      case 'customer_name':
        aValue = a.customer_name;
        bValue = b.customer_name;
        break;
      case 'invoice_number':
        aValue = a.invoice_number;
        bValue = b.invoice_number;
        break;
      case 'status':
        aValue = a.status;
        bValue = b.status;
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
    switch (status) {
      case 'Draft':
        return 'bg-gray-50 text-gray-700 border border-gray-200';
      case 'Confirmed':
        return 'bg-blue-50 text-blue-700 border border-blue-200';
      default:
        return 'bg-gray-50 text-gray-700 border border-gray-200';
    }
  };

  const getCNStatusColor = (rsoId: string) => {
    const hasCreditNote = rsosWithCreditNotes.has(rsoId);
    const cns = creditNotes.filter(cn => cn.rso_id === rsoId);
    
    if (!hasCreditNote) {
      return { color: 'bg-red-50 text-red-700 border border-red-200', text: 'CN Pending' };
    }
    
    const hasConfirmed = cns.some(cn => cn.status === 'Confirmed');
    if (hasConfirmed) {
      return { color: 'bg-green-50 text-green-700 border border-green-200', text: 'CN Processed' };
    }
    
    return { color: 'bg-amber-50 text-amber-700 border border-amber-200', text: 'CN Draft' };
  };

  const canDeleteRSO = (rsoId: string) => {
    return !rsosWithCreditNotes.has(rsoId);
  };

  const canEditRSO = (rsoId: string) => {
    const linkedCNs = rsoLinkedCNs.get(rsoId) || [];
    return !linkedCNs.some(cn => cn.status === 'Confirmed');
  };

  const getDeleteTooltip = (rsoId: string) => {
    const linkedCNs = rsoLinkedCNs.get(rsoId) || [];
    if (linkedCNs.length === 0) return "Delete RSO";
    
    const cnNumbers = linkedCNs.map(cn => cn.cn_number).join(', ');
    return `Cannot delete - Has linked credit notes: ${cnNumbers}`;
  };

  const getEditTooltip = (rsoId: string) => {
    const linkedCNs = rsoLinkedCNs.get(rsoId) || [];
    const confirmedCNs = linkedCNs.filter(cn => cn.status === 'Confirmed');
    
    if (confirmedCNs.length === 0) return "Edit RSO";
    
    const cnNumbers = confirmedCNs.map(cn => cn.cn_number).join(', ');
    return `Cannot edit - Has confirmed credit notes: ${cnNumbers}`;
  };

  const handleDeleteClick = (order: ReturnOrder) => {
    if (!canDeleteRSO(order.id)) {
      const linkedCNs = rsoLinkedCNs.get(order.id) || [];
      toast({
        title: "Cannot Delete RSO",
        description: `This RSO has ${linkedCNs.length} linked credit note(s): ${linkedCNs.map(cn => cn.cn_number).join(', ')}`,
        variant: "destructive"
      });
      return;
    }
    
    setRsoToDelete(order);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (rsoToDelete) {
      onDelete(rsoToDelete.id);
      setDeleteDialogOpen(false);
      setRsoToDelete(null);
    }
  };

  // Export all RSOs to Excel
  const exportAllToExcel = () => {
    try {
      const dataToExport = filteredOrders.map((order, index) => {
        const cnStatus = getCNStatusColor(order.id);
        return {
          'S.No': index + 1,
          'RSO Number': order.rso_number,
          'RSO Date': formatDate(new Date(order.rso_date), 'dd/MM/yyyy'),
          'Customer Name': order.customer_name,
          'Invoice Number': order.invoice_number,
          'RSO Status': order.status,
          'CN Status': cnStatus.text,
          'Amount': order.total_amount.toFixed(2),
          'Reason': order.reason_for_credit
        };
      });

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'RSO List');
      XLSX.writeFile(wb, `RSO-List-${formatDate(new Date(), 'dd-MMM-yyyy')}.xlsx`);

      toast({
        title: "Success",
        description: `Exported ${filteredOrders.length} RSOs to Excel`,
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Error",
        description: "Failed to export RSOs",
        variant: "destructive",
      });
    }
  };

  // Export RSO to PDF
  const exportToPDF = async (order: ReturnOrder) => {
    try {
      // Fetch detailed RSO data with line items
      const { data: rsoDetail, error } = await supabase
        .from('return_order_header')
        .select('*')
        .eq('id', order.id)
        .single();

      if (error) throw error;

      // Fetch complete customer data
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', order.customer_id)
        .single();

      if (customerError) {
        console.error('Error fetching customer:', customerError);
      }

      // Fetch RSO line items
      const { data: rsoItems, error: itemsError } = await supabase
        .from('return_order_lines')
        .select('*')
        .eq('return_order_id', order.id);

      if (itemsError) throw itemsError;

      const doc = new jsPDF();
      let yPos = 15;

      // ========== HEADER SECTION ==========
      doc.setFillColor(41, 128, 185);
      doc.rect(0, 0, 210, 55, 'F');

      // Add company logo if available
      if (companyData?.logo_url) {
        try {
          const response = await fetch(companyData.logo_url);
          const blob = await response.blob();
          const reader = new FileReader();

          await new Promise((resolve, reject) => {
            reader.onload = () => {
              try {
                doc.setFillColor(255, 255, 255);
                doc.circle(25, 25, 10, 'F');
                doc.addImage(reader.result as string, 'PNG', 18, 18, 14, 14);
                resolve(true);
              } catch (err) {
                reject(err);
              }
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (error) {
          console.error('Error loading logo:', error);
          doc.setFillColor(255, 255, 255);
          doc.circle(25, 25, 10, 'F');
          doc.setFontSize(7);
          doc.setTextColor(41, 128, 185);
          doc.text('LOGO', 21, 27);
        }
      } else {
        doc.setFillColor(255, 255, 255);
        doc.circle(25, 25, 10, 'F');
        doc.setFontSize(7);
        doc.setTextColor(41, 128, 185);
        doc.text('LOGO', 21, 27);
      }

      // Company details
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(companyData?.name || 'YOUR COMPANY NAME', 42, 16);

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      const companyDetails = [
        companyData?.address_line1 || 'Address Line 1',
        `${companyData?.city || 'City'}, ${companyData?.state || 'State'} - ${companyData?.postal_code || 'PIN'}`,
        `GSTIN: ${companyData?.gstn || 'N/A'}`,
        `Phone: ${companyData?.phone || 'N/A'}`,
        `Email: ${companyData?.email || 'company@example.com'}`
      ];

      let detailY = 22;
      companyDetails.forEach(detail => {
        doc.text(detail, 42, detailY);
        detailY += 4;
      });

      // Document title
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('RETURN SALES', 195, 20, { align: 'right' });
      doc.text('ORDER', 195, 27, { align: 'right' });

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`RSO #: ${rsoDetail.rso_number}`, 195, 37, { align: 'right' });
      doc.text(`Date: ${formatDate(new Date(rsoDetail.rso_date), 'dd/MM/yyyy')}`, 195, 43, { align: 'right' });

      let currentY = 63;

      // ========== CUSTOMER DETAILS & DELIVERY ADDRESS (TWO COLUMNS) ==========
      const leftColumnX = 14;
      const rightColumnX = 110;
      let detailsY = currentY;

      // Left Column - Customer Details
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(240, 240, 240);
      doc.setTextColor(0, 0, 0);
      doc.rect(leftColumnX, detailsY, 90, 6, 'F');
      doc.text('CUSTOMER DETAILS', leftColumnX + 2, detailsY + 4);

      detailsY += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`${customerData?.name || rsoDetail.customer_name || 'N/A'}`, leftColumnX + 2, detailsY);
      detailsY += 4;
      if (customerData?.address_line1) {
        doc.text(customerData.address_line1, leftColumnX + 2, detailsY);
        detailsY += 4;
      }
      if (customerData?.address_line2) {
        doc.text(customerData.address_line2, leftColumnX + 2, detailsY);
        detailsY += 4;
      }
      const cityLine = [customerData?.city, customerData?.state, customerData?.pin_code].filter(Boolean).join(', ');
      if (cityLine) {
        doc.text(cityLine, leftColumnX + 2, detailsY);
        detailsY += 4;
      }
      if (customerData?.country) {
        doc.text(customerData.country, leftColumnX + 2, detailsY);
        detailsY += 4;
      }
      if (customerData?.gstin) {
        doc.text(`GSTIN: ${customerData.gstin}`, leftColumnX + 2, detailsY);
        detailsY += 4;
      }
      if (customerData?.phone) {
        doc.text(`Phone: ${customerData.phone}`, leftColumnX + 2, detailsY);
        detailsY += 4;
      }
      if (customerData?.email) {
        doc.text(`Email: ${customerData.email}`, leftColumnX + 2, detailsY);
      }

      // Right Column - Delivery Address
      let deliveryY = currentY;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setFillColor(240, 240, 240);
      doc.rect(rightColumnX, deliveryY, 90, 6, 'F');
      doc.text('DELIVERY ADDRESS', rightColumnX + 2, deliveryY + 4);

      deliveryY += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      if (rsoDetail.delivery_same_as_company) {
        doc.text('Same as Company Address', rightColumnX + 2, deliveryY);
        deliveryY += 4;
        if (companyData?.address_line1) {
          doc.text(companyData.address_line1, rightColumnX + 2, deliveryY);
          deliveryY += 4;
        }
        if (companyData?.address_line2) {
          doc.text(companyData.address_line2, rightColumnX + 2, deliveryY);
          deliveryY += 4;
        }
        const compCityLine = [companyData?.city, companyData?.state, companyData?.postal_code].filter(Boolean).join(', ');
        if (compCityLine) {
          doc.text(compCityLine, rightColumnX + 2, deliveryY);
          deliveryY += 4;
        }
        if (companyData?.country) {
          doc.text(companyData.country, rightColumnX + 2, deliveryY);
        }
      } else {
        if (rsoDetail.delivery_address_line1) {
          doc.text(rsoDetail.delivery_address_line1, rightColumnX + 2, deliveryY);
          deliveryY += 4;
        }
        if (rsoDetail.delivery_address_line2) {
          doc.text(rsoDetail.delivery_address_line2, rightColumnX + 2, deliveryY);
          deliveryY += 4;
        }
        const delCityLine = [rsoDetail.delivery_city, rsoDetail.delivery_country, rsoDetail.delivery_pin_code].filter(Boolean).join(', ');
        if (delCityLine) {
          doc.text(delCityLine, rightColumnX + 2, deliveryY);
        }
      }

      currentY = Math.max(detailsY, deliveryY) + 10;

      // ========== ORDER DETAILS BOX ==========
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setFillColor(240, 240, 240);
      doc.rect(14, currentY, 182, 6, 'F');
      doc.text('ORDER DETAILS', 16, currentY + 4);

      currentY += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      const orderDetailsLeft = [
        { label: 'RSO Date:', value: rsoDetail.created_at ? formatDate(new Date(rsoDetail.created_at), 'dd-MMM-yyyy') : 'N/A' },
        { label: 'Invoice No:', value: rsoDetail.invoice_number || 'N/A' },
        { label: 'Invoice Date:', value: rsoDetail.invoice_date ? formatDate(new Date(rsoDetail.invoice_date), 'dd-MMM-yyyy') : 'N/A' },
      ];

      const orderDetailsRight = [
        { label: 'Status:', value: rsoDetail.status || 'Draft' },
        { label: 'Reason:', value: rsoDetail.reason_for_credit || 'N/A' },
        { label: 'Currency:', value: 'INR' },
      ];

      let detailX = 16;
      orderDetailsLeft.forEach((detail) => {
        doc.setFont('helvetica', 'bold');
        doc.text(detail.label, detailX, currentY);
        doc.setFont('helvetica', 'normal');
        doc.text(detail.value, detailX + 25, currentY);
        currentY += 5;
      });

      currentY -= 15; // Reset to align with left column
      detailX = 110;
      orderDetailsRight.forEach((detail) => {
        doc.setFont('helvetica', 'bold');
        doc.text(detail.label, detailX, currentY);
        doc.setFont('helvetica', 'normal');
        doc.text(detail.value, detailX + 25, currentY);
        currentY += 5;
      });

      currentY += 10;
      yPos = currentY;

      // ========== LINE ITEMS TABLE (SIMPLIFIED) ==========
      const tableData = rsoItems?.map((item: any, index: number) => [
        (index + 1).toString(),
        item.product_sku || '',
        item.product_name || '',
        item.hsn_sac_code || '',
        item.return_qty?.toString() || '0',
        `₹${parseFloat(item.unit_price || 0).toFixed(2)}`,
        `${parseFloat(item.discount_percentage || 0).toFixed(2)}%`,
        `₹${parseFloat(item.discount_amount || 0).toFixed(2)}`,
        `${parseFloat(item.cgst_rate || item.igst_rate || 0).toFixed(2)}%`,
        `₹${parseFloat(item.tax_amount || 0).toFixed(2)}`,
        `₹${parseFloat(item.line_total || 0).toFixed(2)}`
      ]) || [];

      (doc as any).autoTable({
        startY: yPos,
        head: [[
          'S.No',
          'Item Code',
          'Description',
          'HSN/SAC',
          'Qty',
          'Rate',
          'Disc%',
          'Disc Amt',
          'Tax%',
          'Tax Amt',
          'Amount'
        ]],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'center'
        },
        bodyStyles: {
          fontSize: 7,
          cellPadding: 2
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 12 },
          1: { halign: 'left', cellWidth: 20 },
          2: { halign: 'left', cellWidth: 40 },
          3: { halign: 'center', cellWidth: 18 },
          4: { halign: 'center', cellWidth: 12 },
          5: { halign: 'right', cellWidth: 18 },
          6: { halign: 'right', cellWidth: 14 },
          7: { halign: 'right', cellWidth: 16 },
          8: { halign: 'right', cellWidth: 12 },
          9: { halign: 'right', cellWidth: 16 },
          10: { halign: 'right', cellWidth: 20 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 10;

      // ========== TOTALS SECTION (RIGHT ALIGNED) ==========
      // Recalculate totals from line items for accuracy
      const calculatedSubtotal = rsoItems?.reduce((sum: number, item: any) => 
        sum + parseFloat(item.line_subtotal || 0), 0) || 0;
      const calculatedTax = rsoItems?.reduce((sum: number, item: any) => 
        sum + parseFloat(item.tax_amount || 0), 0) || 0;
      const calculatedTotal = calculatedSubtotal + calculatedTax;

      const summaryX = 130;
      const summaryWidth = 66;
      let summaryY = currentY;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);

      // Subtotal
      doc.text('Subtotal:', summaryX, summaryY);
      doc.text(`₹${calculatedSubtotal.toFixed(2)}`, summaryX + summaryWidth, summaryY, { align: 'right' });
      summaryY += 5;

      // Tax
      doc.text('Tax Amount:', summaryX, summaryY);
      doc.text(`₹${calculatedTax.toFixed(2)}`, summaryX + summaryWidth, summaryY, { align: 'right' });
      summaryY += 5;

      // Line separator
      doc.setLineWidth(0.5);
      doc.line(summaryX, summaryY, summaryX + summaryWidth, summaryY);
      summaryY += 5;

      // Total (highlighted)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setFillColor(41, 128, 185);
      doc.rect(summaryX - 2, summaryY - 4, summaryWidth + 4, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text('Total Amount:', summaryX, summaryY);
      doc.text(`₹${calculatedTotal.toFixed(2)}`, summaryX + summaryWidth, summaryY, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');

      summaryY += 10;
      yPos = summaryY;

      // ========== AMOUNT IN WORDS ==========
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Amount in Words:', 10, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(convertNumberToWords(calculatedTotal), 10, yPos + 5, { maxWidth: 190 });

      yPos += 15;

      // ========== NOTES ==========
      if (rsoDetail.notes) {
        doc.setFont('helvetica', 'bold');
        doc.text('Notes:', 10, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(rsoDetail.notes, 10, yPos + 5, { maxWidth: 190 });
        yPos += 15;
      }

      // ========== TERMS & CONDITIONS ==========
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.text('Terms & Conditions:', 10, yPos);
      doc.text('1. This is a computer-generated return sales order.', 10, yPos + 5);
      doc.text('2. All goods must be in original condition for return acceptance.', 10, yPos + 9);
      doc.text('3. Credit will be processed after quality inspection.', 10, yPos + 13);

      // ========== AUTHORIZATION ==========
      yPos = 270;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Authorized Signatory', 150, yPos);
      doc.line(145, yPos - 10, 195, yPos - 10);

      // Save PDF
      doc.save(`RSO-${rsoDetail.rso_number}.pdf`);

      toast({
        title: "Success",
        description: "RSO exported to PDF successfully",
      });
    } catch (error) {
      console.error('PDF export failed:', error);
      toast({
        title: "Error",
        description: "Failed to export RSO to PDF",
        variant: "destructive",
      });
    }
  };

  // Mobile view
  if (isMobile) {
    return (
      <RSOTableMobile
        returnOrders={returnOrders}
        creditNotes={creditNotes}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
        onViewCreditNotes={onViewCreditNotes}
        onExport={onExport}
        onExportPDF={exportToPDF}
        loading={loading}
      />
    );
  }

  if (loading) {
    return (
      <PowerBICard title="Return Sales Orders">
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading return orders...</span>
        </div>
      </PowerBICard>
    );
  }

  return (
    <>
      <PowerBICard 
        title="Return Sales Orders"
        className={cn("transition-all duration-200", isActive && "ring-2 ring-primary")}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by RSO, Customer, or Invoice..."
                  className="pl-8 w-64"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
              <Select value={statusFilter} onValueChange={(value) => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="RSO Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All RSO Status</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Confirmed">Confirmed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={cnStatusFilter} onValueChange={(value) => {
                setCnStatusFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="CN Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All CN Status</SelectItem>
                  <SelectItem value="no-cn">No CN</SelectItem>
                  <SelectItem value="cn-draft">CN Draft</SelectItem>
                  <SelectItem value="cn-confirmed">CN Confirmed</SelectItem>
                  <SelectItem value="cn-pending">CN Pending</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={exportAllToExcel}
                className="gap-2 bg-green-600 hover:bg-green-700 text-white"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export to Excel
              </Button>
            </div>
          </div>
          
          <div>
          {currentOrders.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">No return orders found</p>
              <p className="text-sm text-muted-foreground mt-2">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your filters' 
                  : 'Create your first RSO to get started'}
              </p>
            </div>
          ) : (
            <>
              <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-gray-200">
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50 transition-colors text-gray-700"
                        onClick={() => handleSort('rso_number')}
                      >
                        <div className="flex items-center gap-2">
                          RSO Number
                          <span className="text-gray-400">{getSortIcon('rso_number')}</span>
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50 transition-colors text-gray-700"
                        onClick={() => handleSort('rso_date')}
                      >
                        <div className="flex items-center gap-2">
                          RSO Date
                          <span className="text-gray-400">{getSortIcon('rso_date')}</span>
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50 transition-colors text-gray-700"
                        onClick={() => handleSort('customer_name')}
                      >
                        <div className="flex items-center gap-2">
                          Customer
                          <span className="text-gray-400">{getSortIcon('customer_name')}</span>
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50 transition-colors text-gray-700"
                        onClick={() => handleSort('invoice_number')}
                      >
                        <div className="flex items-center gap-2">
                          Invoice Number
                          <span className="text-gray-400">{getSortIcon('invoice_number')}</span>
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50 transition-colors text-gray-700"
                        onClick={() => handleSort('status')}
                      >
                        <div className="flex items-center gap-2">
                          Status
                          <span className="text-gray-400">{getSortIcon('status')}</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-gray-700">CN Status</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50 transition-colors text-right text-gray-700"
                        onClick={() => handleSort('total_amount')}
                      >
                        <div className="flex items-center gap-2 justify-end">
                          Amount
                          <span className="text-gray-400">{getSortIcon('total_amount')}</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-right text-gray-700">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentOrders.map((order) => {
                      const cnStatus = getCNStatusColor(order.id);
                      const canDelete = canDeleteRSO(order.id);
                      const canEdit = canEditRSO(order.id);
                      const linkedCNs = rsoLinkedCNs.get(order.id) || [];
                      
                      return (
                        <TableRow key={order.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                          <TableCell className="font-medium">{order.rso_number}</TableCell>
                          <TableCell>{new Date(order.rso_date).toLocaleDateString()}</TableCell>
                          <TableCell>{order.customer_name}</TableCell>
                          <TableCell>{order.invoice_number}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(order.status)}>
                              {order.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge className={cnStatus.color}>
                                {cnStatus.text}
                              </Badge>
                              {linkedCNs.length > 0 && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="text-xs text-muted-foreground cursor-help">
                                      ({linkedCNs.length})
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="space-y-1">
                                      <p className="font-semibold">Linked Credit Notes:</p>
                                      {linkedCNs.map(cn => (
                                        <p key={cn.id} className="text-xs">
                                          {cn.cn_number} - {cn.status}
                                        </p>
                                      ))}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ₹{order.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => onView(order.id)}
                                    className="h-8 w-8 text-gray-600 hover:text-primary hover:bg-gray-100 transition-colors"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-sm">View RSO</p>
                                </TooltipContent>
                              </Tooltip>

                              {order.status === 'Draft' && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => canEdit ? onEdit(order.id) : undefined}
                                        disabled={!canEdit}
                                        className={cn(
                                          "h-8 w-8",
                                          canEdit 
                                            ? "text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors" 
                                            : "text-gray-300 cursor-not-allowed opacity-50"
                                        )}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-sm">{getEditTooltip(order.id)}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}

                              {rsosWithCreditNotes.has(order.id) && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => onViewCreditNotes(order)}
                                      className="h-8 w-8 text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                    >
                                      <FileText className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-sm">View {linkedCNs.length} Credit Note{linkedCNs.length > 1 ? 's' : ''}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => onExport ? onExport(order) : exportToExcel(order)}
                                    className="h-8 w-8 text-gray-600 hover:text-green-600 hover:bg-green-50 transition-colors"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-sm">Export to Excel</p>
                                </TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => exportToPDF(order)}
                                    className="h-8 w-8 text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors"
                                  >
                                    <FileText className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-sm">Export to PDF</p>
                                </TooltipContent>
                              </Tooltip>

                              {order.status === 'Draft' && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDeleteClick(order)}
                                        disabled={!canDelete}
                                        className={cn(
                                          "h-8 w-8",
                                          canDelete 
                                            ? "text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors" 
                                            : "text-gray-300 cursor-not-allowed opacity-50"
                                        )}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-sm">{getDeleteTooltip(order.id)}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TooltipProvider>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to {Math.min(endIndex, sortedOrders.length)} of {sortedOrders.length} entries
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
          </div>
        </div>
      </PowerBICard>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Return Sales Order
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete RSO <strong>{rsoToDelete?.rso_number}</strong>?
              <br /><br />
              <span className="text-destructive font-medium">This action cannot be undone.</span>
              <br /><br />
              Details:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Customer: {rsoToDelete?.customer_name}</li>
                <li>Invoice: {rsoToDelete?.invoice_number}</li>
                <li>Amount: ₹{rsoToDelete?.total_amount.toLocaleString('en-IN')}</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete RSO
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
