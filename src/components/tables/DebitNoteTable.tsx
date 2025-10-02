import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Eye, Edit, Trash2, FileSpreadsheet, FileText, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Search, PackageOpen } from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface DebitNote {
  id: string;
  debit_note_number: string;
  debit_note_date: string;
  supplier_name: string;
  reason: string;
  total_amount: number;
  status: string;
  created_at: string;
  subtotal_amount: number;
  discount_amount: number;
  tax_amount: number;
  notes?: string;
  supplier_invoice_number?: string;
  credit_note_numbers?: string;
  credit_note_total_amount?: number;
  settlement_status: 'open' | 'settled' | 'partially_settled';
  difference_amount: number;
  items?: any[];
}

interface DebitNoteTableProps {
  refreshTrigger?: number;
  onView: (debitNote: any) => void;
  onEdit: (debitNote: any) => void;
  onDelete: (debitNoteId: string) => void;
  onFiltersChange?: (filters: { searchTerm: string; statusFilter: string }) => void;
}

export function DebitNoteTable({ refreshTrigger, onView, onEdit, onDelete, onFiltersChange }: DebitNoteTableProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [debitNotes, setDebitNotes] = useState<DebitNote[]>([]);
  const [filteredDebitNotes, setFilteredDebitNotes] = useState<DebitNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState<keyof DebitNote>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [company, setCompany] = useState<any>(null);
  const itemsPerPage = 5;

  // Transaction protection state
  const [debitNotesWithTransactions, setDebitNotesWithTransactions] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (profile?.company_id) {
      fetchDebitNotes();
      fetchCompanyData();
    }
  }, [profile?.company_id, refreshTrigger]);

  useEffect(() => {
    filterAndSortDebitNotes();
  }, [debitNotes, searchTerm, statusFilter, sortField, sortDirection]);

  useEffect(() => {
    // Notify parent component about filter changes
    if (onFiltersChange) {
      onFiltersChange({ searchTerm, statusFilter });
    }
  }, [searchTerm, statusFilter, onFiltersChange]);

  // Check for debit note transactions
  useEffect(() => {
    const checkDebitNoteTransactions = async () => {
      if (!profile?.company_id || debitNotes.length === 0) return;
      
      const debitNoteIds = debitNotes.map(dn => dn.id);
      const debitNotesWithTxns = new Set<string>();
      
      try {
        // Check for supplier credit notes
        const { data: creditNoteData } = await supabase
          .from('supplier_credit_notes')
          .select('debit_note_id')
          .eq('company_id', profile.company_id)
          .in('debit_note_id', debitNoteIds)
          .not('debit_note_id', 'is', null);
        
        creditNoteData?.forEach(cn => debitNotesWithTxns.add(cn.debit_note_id));
        
        // Check for payments
        const { data: paymentData } = await supabase
          .from('payments')
          .select('reference_number')
          .eq('company_id', profile.company_id)
          .eq('payment_type', 'debit_note')
          .in('reference_number', debitNotes.map(dn => dn.debit_note_number));
        
        if (paymentData && paymentData.length > 0) {
          const paymentRefs = new Set(paymentData.map(p => p.reference_number));
          debitNotes.forEach(dn => {
            if (paymentRefs.has(dn.debit_note_number)) {
              debitNotesWithTxns.add(dn.id);
            }
          });
        }
        
        setDebitNotesWithTransactions(debitNotesWithTxns);
      } catch (error) {
        console.error('Error checking debit note transactions:', error);
      }
    };
    
    checkDebitNoteTransactions();
  }, [debitNotes, profile?.company_id]);

  const fetchCompanyData = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile?.company_id)
        .single();

      if (error) throw error;
      setCompany(data);
    } catch (error) {
      console.error('Error fetching company data:', error);
    }
  };

  const fetchDebitNotes = async () => {
    try {
      setLoading(true);
      
      // Fetch debit notes with aggregated credit note data
      const { data, error } = await supabase
        .from('debit_notes')
        .select(`
          *,
          supplier_credit_notes:supplier_credit_notes(
            id,
            supplier_credit_note_number,
            total_amount
          )
        `)
        .eq('company_id', profile?.company_id)
        .order('debit_note_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Process the data to add settlement information
      const processedDebitNotes = (data || []).map((debitNote: any) => {
        const creditNotes = debitNote.supplier_credit_notes || [];
        const creditNoteNumbers = creditNotes.map((cn: any) => cn.supplier_credit_note_number).join(', ');
        const creditNoteTotalAmount = creditNotes.reduce((sum: number, cn: any) => sum + (cn.total_amount || 0), 0);
        const differenceAmount = debitNote.total_amount - creditNoteTotalAmount;
        
        let settlementStatus: 'open' | 'settled' | 'partially_settled';
        if (creditNoteTotalAmount === 0) {
          settlementStatus = 'open';
        } else if (creditNoteTotalAmount >= debitNote.total_amount) {
          settlementStatus = 'settled';
        } else {
          settlementStatus = 'partially_settled';
        }

        return {
          ...debitNote,
          credit_note_numbers: creditNoteNumbers || '',
          credit_note_total_amount: creditNoteTotalAmount,
          settlement_status: settlementStatus,
          difference_amount: differenceAmount
        };
      });

      setDebitNotes(processedDebitNotes);
    } catch (error) {
      console.error('Error fetching debit notes:', error);
      toast({
        title: "Error",
        description: "Failed to fetch debit notes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortDebitNotes = () => {
    let filtered = debitNotes.filter((debitNote) => {
      const matchesSearch = 
        debitNote.debit_note_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        debitNote.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        debitNote.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (debitNote.credit_note_numbers && debitNote.credit_note_numbers.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = statusFilter === 'all' || 
                           debitNote.settlement_status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });

    // Sort the filtered results
    filtered.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    setFilteredDebitNotes(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleSort = (field: keyof DebitNote) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: keyof DebitNote) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4" /> 
      : <ArrowDown className="h-4 w-4" />;
  };
  const getSettlementStatusBadge = (settlementStatus: 'open' | 'settled' | 'partially_settled') => {
    const statusConfig = {
      open: { variant: 'destructive' as const, label: 'Open' },
      settled: { variant: 'default' as const, label: 'Settled' },
      partially_settled: { variant: 'secondary' as const, label: 'Partially Settled' },
    };
    
    const config = statusConfig[settlementStatus];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const exportToExcel = async (debitNote: DebitNote) => {
    try {
      // Fetch detailed debit note data with items and supplier
      const { data: debitNoteDetail, error } = await supabase
        .from('debit_notes')
        .select(`
          *,
          suppliers(*)
        `)
        .eq('id', debitNote.id)
        .single();

      if (error) throw error;

      // Fetch debit note items separately
      const { data: debitNoteItems, error: itemsError } = await supabase
        .from('debit_note_items')
        .select('*')
        .eq('debit_note_id', debitNote.id);

      if (itemsError) throw itemsError;

      const supplier = debitNoteDetail.suppliers as any || {};

      const workbook = XLSX.utils.book_new();
      
      // Comprehensive header information matching PO format
      const headerData = [
        ['DEBIT NOTE'],
        [''],
        ['Company Information:'],
        ['Name:', company?.name || 'N/A'],
        ['Address:', `${company?.address_line1 || ''} ${company?.address_line2 || ''}`],
        ['City:', `${company?.city || ''}, ${company?.state || ''} ${company?.postal_code || ''}`],
        ['Phone:', company?.phone || 'N/A', 'Email:', company?.email || 'N/A'],
        ['GSTIN:', company?.gstn || 'N/A'],
        [''],
        ['DEBIT NOTE HEADER:'],
        ['Debit Note Number:', debitNoteDetail.debit_note_number, 'Date:', format(new Date(debitNoteDetail.debit_note_date), 'dd/MM/yyyy')],
        ['Status:', debitNoteDetail.status],
        [''],
        ['SUPPLIER DETAILS:'],
        ['Supplier Name:', supplier.name || debitNoteDetail.supplier_name],
        ['Contact Person:', supplier.contact_person || 'N/A'],
        ['Phone:', supplier.phone || 'N/A', 'Email:', supplier.email || 'N/A'],
        ['GSTIN:', supplier.gst_number || 'N/A'],
        ['Address:', `${supplier.address_line1 || ''} ${supplier.address_line2 || ''}`],
        ['City:', `${supplier.city || ''}, ${supplier.state || ''} ${supplier.pin_code || ''}`],
        [''],
        ['DEBIT NOTE DETAILS:'],
        ['Reason:', debitNoteDetail.reason],
        ['Supplier Invoice:', debitNoteDetail.supplier_invoice_number || 'N/A'],
        ['Notes:', debitNoteDetail.notes || 'No additional notes'],
        [''],
        ['LINE ITEMS:'],
        ['S.No', 'Product Name', 'SKU', 'HSN', 'UOM', 'Quantity', 'Unit Price', 'Disc%', 'Disc Amt', 'Tax%', 'CGST', 'SGST', 'IGST', 'Tax Amt', 'Line Total']
      ];

      // Add line items with comprehensive details
      let subtotal = 0;
      let totalDiscount = 0;
      let cgstTotal = 0;
      let sgstTotal = 0;
      let igstTotal = 0;
      let totalTax = 0;
      
      debitNoteItems?.forEach((item: any, index: number) => {
        const qty = item.quantity || 0;
        const unitPrice = item.unit_price || 0;
        const discPct = item.discount_percentage || 0;
        const discAmt = item.discount_amount || 0;
        const lineSubtotal = qty * unitPrice;
        const lineTaxRate = (item.cgst_rate || 0) + (item.sgst_rate || 0) + (item.igst_rate || 0);
        const lineTax = item.tax_amount || 0;
        const lineTotal = item.line_total || (lineSubtotal - discAmt + lineTax);
        
        subtotal += lineSubtotal;
        totalDiscount += discAmt;
        cgstTotal += (item.cgst_amount || 0);
        sgstTotal += (item.sgst_amount || 0);
        igstTotal += (item.igst_amount || 0);
        totalTax += lineTax;
        
        headerData.push([
          index + 1,
          item.product_name,
          item.product_sku,
          item.hsn_sac_code || '',
          item.unit_of_measure,
          qty,
          Math.round(unitPrice),
          discPct,
          Math.round(discAmt),
          lineTaxRate,
          Math.round(item.cgst_amount || 0),
          Math.round(item.sgst_amount || 0),
          Math.round(item.igst_amount || 0),
          Math.round(lineTax),
          Math.round(lineTotal)
        ]);
      });

      // Add comprehensive totals
      headerData.push(
        [''],
        ['FINANCIAL SUMMARY:'],
        ['Subtotal Amount:', Math.round(subtotal)],
        ['Total Discount:', Math.round(totalDiscount)],
        ['CGST Amount:', Math.round(cgstTotal)],
        ['SGST Amount:', Math.round(sgstTotal)],
        ['IGST Amount:', Math.round(igstTotal)],
        ['Total Tax Amount:', Math.round(totalTax)],
        ['Grand Total:', Math.round(subtotal - totalDiscount + totalTax)],
        [''],
        ['Settlement Status:', debitNote.settlement_status?.toUpperCase() || 'OPEN'],
        ['Credit Note Numbers:', debitNote.credit_note_numbers || 'None'],
        ['Difference Amount:', Math.round(debitNote.difference_amount || 0)]
      );

      const worksheet = XLSX.utils.aoa_to_sheet(headerData);
      
      // Set column widths
      worksheet['!cols'] = [
        { wch: 6 }, { wch: 30 }, { wch: 15 }, { wch: 10 },
        { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 8 },
        { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 10 },
        { wch: 10 }, { wch: 12 }, { wch: 15 }
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Debit Note');
      XLSX.writeFile(workbook, `DebitNote_${debitNoteDetail.debit_note_number}.xlsx`);

      toast({
        title: "Success",
        description: "Debit note exported to Excel successfully",
      });
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast({
        title: "Error",
        description: "Failed to export debit note to Excel",
        variant: "destructive",
      });
    }
  };

  // Helper function to convert number to words
  const convertNumberToWords = (num: number): string => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

    if (num === 0) return 'Zero';

    const convertLessThanThousand = (n: number): string => {
      if (n === 0) return '';
      if (n < 10) return ones[n];
      if (n < 20) return teens[n - 10];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
      return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + convertLessThanThousand(n % 100) : '');
    };

    let intNum = Math.floor(num);
    let decNum = Math.round((num - intNum) * 100);
    let words = '';
    
    if (intNum >= 10000000) {
      words += convertLessThanThousand(Math.floor(intNum / 10000000)) + ' Crore ';
      intNum %= 10000000;
    }
    if (intNum >= 100000) {
      words += convertLessThanThousand(Math.floor(intNum / 100000)) + ' Lakh ';
      intNum %= 100000;
    }
    if (intNum >= 1000) {
      words += convertLessThanThousand(Math.floor(intNum / 1000)) + ' Thousand ';
      intNum %= 1000;
    }
    if (intNum > 0) {
      words += convertLessThanThousand(intNum) + ' ';
    }
    
    words += 'Rupees ';
    if (decNum > 0) {
      words += 'and ' + convertLessThanThousand(decNum) + ' Paise ';
    }
    
    return words.trim() + ' Only';
  };

  const exportToPDF = async (debitNote: DebitNote) => {
    try {
      // Fetch detailed debit note data with items and supplier
      const { data: debitNoteDetail, error } = await supabase
        .from('debit_notes')
        .select(`
          *,
          suppliers(*)
        `)
        .eq('id', debitNote.id)
        .single();

      if (error) throw error;

      // Fetch debit note items separately
      const { data: debitNoteItems, error: itemsError } = await supabase
        .from('debit_note_items')
        .select('*')
        .eq('debit_note_id', debitNote.id);

      if (itemsError) throw itemsError;

      const supplier = debitNoteDetail.suppliers as any || {};

      const doc = new jsPDF();
      let yPos = 15;
      
      // ========== MODERN HEADER SECTION ==========
      doc.setFillColor(41, 128, 185);
      doc.rect(0, 0, 210, 55, 'F');
      
      // Add company logo if available
      if (company?.logo_url) {
        try {
          const response = await fetch(company.logo_url);
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
      
      // Company name and details
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(company?.name || 'YOUR COMPANY NAME', 42, 16);
      
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      const companyDetails = [
        company?.address_line1 || 'Address Line 1',
        `${company?.city || 'City'}, ${company?.state || 'State'} - ${company?.postal_code || 'PIN'}`,
        `GSTIN: ${company?.gstn || 'N/A'}`,
        `Phone: ${company?.phone || 'N/A'}`,
        `Email: ${company?.email || 'company@example.com'}`
      ];
      
      let detailY = 22;
      companyDetails.forEach(detail => {
        doc.text(detail, 42, detailY);
        detailY += 4;
      });
      
      // Document title
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('DEBIT', 195, 20, { align: 'right' });
      doc.text('NOTE', 195, 27, { align: 'right' });
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`DN #: ${debitNoteDetail.debit_note_number}`, 195, 37, { align: 'right' });
      doc.text(`Date: ${format(new Date(debitNoteDetail.debit_note_date), 'dd/MM/yyyy')}`, 195, 43, { align: 'right' });
      
      yPos = 63;
      
      // ========== SUPPLIER & COMPANY INFORMATION SECTION ==========
      doc.setFillColor(245, 245, 245);
      doc.rect(15, yPos, 87, 48, 'F');
      doc.rect(108, yPos, 87, 48, 'F');
      
      // Supplier Details
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 128, 185);
      doc.text('SUPPLIER DETAILS', 17, yPos + 7);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(supplier.name || debitNoteDetail.supplier_name, 17, yPos + 14);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(supplier.address_line1 || 'Address', 17, yPos + 19);
      doc.text(`${supplier.city || ''}, ${supplier.state || ''} - ${supplier.pin_code || ''}`, 17, yPos + 24);
      doc.text(`Contact: ${supplier.contact_person || 'N/A'}`, 17, yPos + 29);
      doc.text(`Phone: ${supplier.phone || 'N/A'}`, 17, yPos + 34);
      doc.text(`Email: ${supplier.email || 'N/A'}`, 17, yPos + 39);
      doc.text(`GSTIN: ${supplier.gst_number || 'N/A'}`, 17, yPos + 44);
      
      // Company / Bill To Details
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 128, 185);
      doc.text('BILL TO / COMPANY DETAILS', 110, yPos + 7);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(company?.name || 'Company Name', 110, yPos + 14);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(company?.address_line1 || 'Address', 110, yPos + 19);
      doc.text(`${company?.city || 'City'}, ${company?.state || 'State'}`, 110, yPos + 24);
      doc.text(`PIN: ${company?.postal_code || 'N/A'}`, 110, yPos + 29);
      doc.text(`GSTIN: ${company?.gstn || 'N/A'}`, 110, yPos + 34);
      
      yPos += 53;
      
      // ========== DEBIT NOTE DETAILS SECTION ==========
      doc.setFillColor(240, 240, 240);
      doc.rect(15, yPos, 180, 20, 'F');
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Reason:', 17, yPos + 6);
      doc.text('Supplier Invoice:', 17, yPos + 12);
      doc.text('Status:', 17, yPos + 18);
      
      doc.setFont('helvetica', 'normal');
      const reasonText = doc.splitTextToSize(debitNoteDetail.reason || 'N/A', 70);
      doc.text(reasonText[0], 45, yPos + 6);
      doc.text(debitNoteDetail.supplier_invoice_number || 'N/A', 55, yPos + 12);
      doc.text(debitNoteDetail.status.toUpperCase(), 35, yPos + 18);
      
      doc.setFont('helvetica', 'bold');
      doc.text('Settlement Status:', 110, yPos + 6);
      doc.text('Credit Note #:', 110, yPos + 12);
      doc.text('Difference Amt:', 110, yPos + 18);
      
      doc.setFont('helvetica', 'normal');
      doc.text(debitNote.settlement_status?.toUpperCase() || 'OPEN', 155, yPos + 6);
      doc.text(debitNote.credit_note_numbers || '-', 145, yPos + 12);
      doc.text(`₹${(debitNote.difference_amount || 0).toFixed(2)}`, 150, yPos + 18);
      
      yPos += 28;
      
      // ========== LINE ITEMS TABLE ==========
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 128, 185);
      doc.text('LINE ITEMS', 15, yPos);
      
      yPos += 6;
      
      // Calculate totals
      let subtotal = 0;
      let totalDiscount = 0;
      let cgstTotal = 0;
      let sgstTotal = 0;
      let igstTotal = 0;
      let totalTax = 0;

      const tableData = debitNoteItems?.map((item: any, index: number) => {
        const qty = item.quantity || 0;
        const unitPrice = item.unit_price || 0;
        const discPct = item.discount_percentage || 0;
        const discAmt = item.discount_amount || 0;
        const lineSubtotal = qty * unitPrice;
        const lineTax = item.tax_amount || 0;
        const lineTotal = item.line_total || (lineSubtotal - discAmt + lineTax);
        
        subtotal += lineSubtotal;
        totalDiscount += discAmt;
        cgstTotal += (item.cgst_amount || 0);
        sgstTotal += (item.sgst_amount || 0);
        igstTotal += (item.igst_amount || 0);
        totalTax += lineTax;

        return [
          (index + 1).toString(),
          item.product_sku,
          item.product_name,
          item.hsn_sac_code || '',
          qty,
          Math.round(unitPrice),
          discPct,
          Math.round(discAmt),
          Math.round((item.cgst_rate || 0) + (item.sgst_rate || 0) + (item.igst_rate || 0)),
          Math.round(lineTax),
          Math.round(lineTotal)
        ];
      }) || [];

      (doc as any).autoTable({
        startY: yPos,
        head: [['S.No', 'Item Code', 'Description', 'HSN', 'Qty', 'Rate', 'Disc%', 'Disc Amt', 'Tax%', 'Tax Amt', 'Amount']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: [255, 255, 255],
          fontSize: 7.5,
          fontStyle: 'bold',
          halign: 'center'
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [0, 0, 0]
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 12 },
          1: { halign: 'left', cellWidth: 20 },
          2: { halign: 'left', cellWidth: 35 },
          3: { halign: 'center', cellWidth: 15 },
          4: { halign: 'center', cellWidth: 12 },
          5: { halign: 'right', cellWidth: 18 },
          6: { halign: 'center', cellWidth: 14 },
          7: { halign: 'right', cellWidth: 18 },
          8: { halign: 'center', cellWidth: 14 },
          9: { halign: 'right', cellWidth: 18 },
          10: { halign: 'right', cellWidth: 22 }
        },
        margin: { left: 15, right: 15 },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;
      
      // ========== TOTALS SECTION ==========
      const grandTotal = subtotal - totalDiscount + totalTax;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Subtotal:', 140, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(`INR ${Math.round(subtotal).toLocaleString('en-IN')}`, 195, yPos, { align: 'right' });
      
      yPos += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('Total Discount:', 140, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(`INR ${Math.round(totalDiscount).toLocaleString('en-IN')}`, 195, yPos, { align: 'right' });
      
      yPos += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('CGST (9%):', 140, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(`INR ${Math.round(cgstTotal).toLocaleString('en-IN')}`, 195, yPos, { align: 'right' });
      
      yPos += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('SGST (9%):', 140, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(`INR ${Math.round(sgstTotal).toLocaleString('en-IN')}`, 195, yPos, { align: 'right' });
      
      yPos += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('IGST (18%):', 140, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(`INR ${Math.round(igstTotal).toLocaleString('en-IN')}`, 195, yPos, { align: 'right' });
      
      yPos += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Total:', 140, yPos);
      doc.text(`INR ${Math.round(grandTotal).toLocaleString('en-IN')}`, 195, yPos, { align: 'right' });
      
      yPos += 8;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text(`Amount in words: ${convertNumberToWords(Math.round(grandTotal))}`, 15, yPos);
      
      // ========== TERMS & CONDITIONS ==========
      yPos += 10;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Terms & Conditions:', 15, yPos);
      yPos += 5;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.text('1. This debit note is issued against the supplier invoice mentioned above', 15, yPos);
      yPos += 4;
      doc.text('2. Please adjust this amount in your next invoice or process a refund', 15, yPos);
      yPos += 4;
      doc.text('3. All amounts are in Indian Rupees (INR) unless otherwise stated', 15, yPos);
      
      // ========== FOOTER ==========
      const footerY = 270;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('For ' + (company?.name || 'Company Name'), 15, footerY);
      doc.text('Supplier Acknowledgment', 130, footerY);
      
      doc.setFont('helvetica', 'normal');
      doc.text('_____________________', 15, footerY + 15);
      doc.text('_____________________', 130, footerY + 15);
      doc.text('Authorized Signatory', 15, footerY + 20);
      doc.text('Supplier Signature', 130, footerY + 20);

      doc.save(`DebitNote_${debitNoteDetail.debit_note_number}.pdf`);

      toast({
        title: "Success",
        description: "Debit note exported to PDF successfully",
      });
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      toast({
        title: "Error",
        description: "Failed to export debit note to PDF",
        variant: "destructive",
      });
    }
  };

  // Ensure dialogs receive items
  const fetchDebitNoteItems = async (debitNoteId: string) => {
    const { data, error } = await supabase
      .from('debit_note_items')
      .select('*')
      .eq('debit_note_id', debitNoteId);
    if (error) throw error;
    return data || [];
  };

  const handleViewClick = async (debitNote: DebitNote) => {
    try {
      const items = await fetchDebitNoteItems(debitNote.id);
      onView({ ...debitNote, items });
    } catch (err) {
      console.error('Error loading debit note items for view:', err);
      toast({ title: 'Error', description: 'Failed to load debit note items', variant: 'destructive' });
      onView(debitNote); // fallback
    }
  };

  const handleEditClick = async (debitNote: DebitNote) => {
    try {
      const items = await fetchDebitNoteItems(debitNote.id);
      onEdit({ ...debitNote, items });
    } catch (err) {
      console.error('Error loading debit note items for edit:', err);
      toast({ title: 'Error', description: 'Failed to load debit note items', variant: 'destructive' });
      onEdit(debitNote); // fallback
    }
  };

  const handleViewCreditNotes = async (debitNote: DebitNote) => {
    try {
      const { data, error } = await supabase
        .from('supplier_credit_notes')
        .select('*')
        .eq('debit_note_id', debitNote.id);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        toast({
          title: "Credit Notes",
          description: `Found ${data.length} credit note(s): ${data.map(cn => cn.supplier_credit_note_number).join(', ')}`,
        });
        // Could open a dedicated credit notes view dialog here
      } else {
        toast({
          title: "No Credit Notes",
          description: "No credit notes found for this debit note",
        });
      }
    } catch (error) {
      console.error('Error fetching credit notes:', error);
      toast({
        title: "Error",
        description: "Failed to fetch credit notes",
        variant: "destructive",
      });
    }
  };

  // Pagination
  const totalPages = Math.ceil(filteredDebitNotes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentDebitNotes = filteredDebitNotes.slice(startIndex, endIndex);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading debit notes...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <CardTitle>Debit Notes</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by debit note number, supplier, reason, credit note..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Export all filtered debit notes
              const wsData = filteredDebitNotes.map(dn => ({
                'Debit Note #': dn.debit_note_number,
                'Date': format(new Date(dn.debit_note_date), 'dd/MM/yyyy'),
                'Supplier': dn.supplier_name,
                'Credit Note #': dn.credit_note_numbers || '-',
                'Debit Amount': dn.total_amount,
                'Settlement Status': dn.settlement_status.toUpperCase(),
                'Difference Amount': dn.difference_amount
              }));
              const ws = XLSX.utils.json_to_sheet(wsData);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, 'Debit Notes');
              XLSX.writeFile(wb, `DebitNotes_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
              toast({ title: "Success", description: `Exported ${filteredDebitNotes.length} debit notes to Excel` });
            }}
            className="h-9 px-4 gap-2 rounded-md bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 font-medium transition-colors"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export Excel
          </Button>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open (Settlement)</SelectItem>
              <SelectItem value="settled">Settled</SelectItem>
              <SelectItem value="partially_settled">Partially Settled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>

      <CardContent>
        {filteredDebitNotes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {searchTerm || statusFilter !== 'all'
                ? 'No debit notes match your filters'
                : 'No debit notes found'
              }
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200 hover:from-slate-50 hover:to-slate-100">
                    <TableHead className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4" onClick={() => handleSort('debit_note_number')}>
                      <div className="flex items-center space-x-1">
                        <span>Debit Note #</span>
                        {getSortIcon('debit_note_number')}
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4" onClick={() => handleSort('debit_note_date')}>
                      <div className="flex items-center space-x-1">
                        <span>Date</span>
                        {getSortIcon('debit_note_date')}
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4" onClick={() => handleSort('supplier_name')}>
                      <div className="flex items-center space-x-1">
                        <span>Supplier</span>
                        {getSortIcon('supplier_name')}
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-slate-800 py-4">Credit Note #</TableHead>
                    <TableHead className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4" onClick={() => handleSort('total_amount')}>
                      <div className="flex items-center space-x-1">
                        <span>Debit Amount</span>
                        {getSortIcon('total_amount')}
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4" onClick={() => handleSort('settlement_status')}>
                      <div className="flex items-center space-x-1">
                        <span>Settlement Status</span>
                        {getSortIcon('settlement_status')}
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4" onClick={() => handleSort('difference_amount')}>
                      <div className="flex items-center space-x-1">
                        <span>Difference Amount</span>
                        {getSortIcon('difference_amount')}
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-slate-800 text-right py-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentDebitNotes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12">
                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                          <PackageOpen className="h-12 w-12 text-slate-300" />
                          <p>
                            {searchTerm || statusFilter !== 'all'
                              ? 'No debit notes match your filters'
                              : 'No debit notes found'
                            }
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentDebitNotes.map((debitNote) => (
                    <TableRow key={debitNote.id} className="hover:bg-slate-50 transition-all">
                      <TableCell className="font-semibold text-blue-600 py-4">
                        {debitNote.debit_note_number}
                      </TableCell>
                      <TableCell className="text-slate-600 py-4">
                        {format(new Date(debitNote.debit_note_date), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell className="font-medium text-slate-700 py-4">{debitNote.supplier_name}</TableCell>
                      <TableCell className="max-w-xs truncate text-slate-600 py-4">
                        {debitNote.credit_note_numbers || '-'}
                      </TableCell>
                      <TableCell className="font-bold text-slate-900 py-4">
                        ₹{debitNote.total_amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="py-4">
                        {getSettlementStatusBadge(debitNote.settlement_status)}
                      </TableCell>
                      <TableCell className="font-semibold text-amber-600 py-4">
                        ₹{debitNote.difference_amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-2">
                          {/* Primary Actions Group */}
                          <div className="flex items-center rounded-lg border border-slate-200 bg-white shadow-sm">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewClick(debitNote)}
                              className="h-9 px-3 rounded-l-lg rounded-r-none border-r border-slate-200 hover:bg-blue-50 hover:text-blue-700 transition-all duration-200"
                              title="View Debit Note"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditClick(debitNote)}
                              disabled={debitNote.settlement_status === 'settled'}
                              className={`h-9 px-3 rounded-none border-r border-slate-200 hover:bg-amber-50 hover:text-amber-700 transition-all duration-200 ${
                                debitNote.settlement_status === 'settled' 
                                  ? 'opacity-50 cursor-not-allowed' 
                                  : ''
                              }`}
                              title={
                                debitNote.settlement_status === 'settled' 
                                  ? "Cannot edit settled debit note" 
                                  : "Edit Debit Note"
                              }
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDelete(debitNote.id)}
                              disabled={debitNote.settlement_status === 'settled' || debitNote.settlement_status === 'partially_settled' || debitNotesWithTransactions.has(debitNote.id)}
                              className={`h-9 px-3 rounded-r-lg rounded-l-none hover:bg-red-50 hover:text-red-700 transition-all duration-200 ${
                                debitNote.settlement_status === 'settled' || debitNote.settlement_status === 'partially_settled' || debitNotesWithTransactions.has(debitNote.id)
                                  ? 'opacity-50 cursor-not-allowed' 
                                  : ''
                              }`}
                              title={
                                debitNotesWithTransactions.has(debitNote.id)
                                  ? "Cannot delete debit note with existing transactions"
                                  : debitNote.settlement_status === 'settled' 
                                  ? "Cannot delete settled debit note"
                                  : debitNote.settlement_status === 'partially_settled'
                                  ? "Cannot delete partially settled debit note"
                                  : "Delete Debit Note"
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          {/* Export Actions Group */}
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => exportToExcel(debitNote)}
                              className="h-9 px-3 rounded-md bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 transition-colors"
                              title="Export Excel"
                            >
                              <FileSpreadsheet className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => exportToPDF(debitNote)}
                              className="h-9 px-3 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300 transition-all duration-200 shadow-sm"
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredDebitNotes.length)} of {filteredDebitNotes.length} debit notes
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="hover:bg-white hover:shadow-md transition-all"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = currentPage <= 3 ? i + 1 : currentPage + i - 2;
                      if (pageNum > totalPages) return null;
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className={currentPage === pageNum ? "bg-slate-800 text-white" : "hover:bg-white hover:shadow-md transition-all"}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="hover:bg-white hover:shadow-md transition-all"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}