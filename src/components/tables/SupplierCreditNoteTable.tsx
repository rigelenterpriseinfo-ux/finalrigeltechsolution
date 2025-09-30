import React, { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Eye, Trash2, Search, FileSpreadsheet, FileText, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, PackageOpen } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useBusinessAuth } from "@/hooks/useBusinessAuth";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface SupplierCreditNote {
  id: string;
  supplier_credit_note_number: string;
  supplier_credit_note_date: string;
  supplier_name: string;
  reason: string;
  total_amount: number;
  status: string;
  created_at: string;
}

interface SupplierCreditNoteTableProps {
  supplierCreditNotes: SupplierCreditNote[];
  onView: (creditNote: SupplierCreditNote) => void;
  onEdit: (creditNote: SupplierCreditNote) => void;
  onDelete: (creditNote: SupplierCreditNote) => void;
  loading?: boolean;
}

type SortField = 'supplier_credit_note_number' | 'supplier_name' | 'supplier_credit_note_date' | 'total_amount' | 'status' | 'created_at';
type SortDirection = 'asc' | 'desc';

export function SupplierCreditNoteTable({ 
  supplierCreditNotes, 
  onView, 
  onEdit, 
  onDelete,
  loading = false 
}: SupplierCreditNoteTableProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { hasEditAccess } = useBusinessAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'received' | 'processed' | 'cancelled'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [companyData, setCompanyData] = useState<any>(null);
  const itemsPerPage = 5;
  
  const canEdit = hasEditAccess('purchase');

  // Transaction protection state
  const [creditNotesWithTransactions, setCreditNotesWithTransactions] = useState<Set<string>>(new Set());

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

  // Check for supplier credit note transactions
  useEffect(() => {
    const checkCreditNoteTransactions = async () => {
      if (!profile?.company_id || supplierCreditNotes.length === 0) return;
      
      const creditNoteIds = supplierCreditNotes.map(cn => cn.id);
      const creditNotesWithTxns = new Set<string>();
      
      try {
        // Check for payments
        const { data: paymentData } = await supabase
          .from('payments')
          .select('reference_number')
          .eq('company_id', profile.company_id)
          .eq('payment_type', 'supplier_credit_note')
          .in('reference_number', supplierCreditNotes.map(cn => cn.supplier_credit_note_number));
        
        if (paymentData && paymentData.length > 0) {
          const paymentRefs = new Set(paymentData.map(p => p.reference_number));
          supplierCreditNotes.forEach(cn => {
            if (paymentRefs.has(cn.supplier_credit_note_number)) {
              creditNotesWithTxns.add(cn.id);
            }
          });
        }
        
        setCreditNotesWithTransactions(creditNotesWithTxns);
      } catch (error) {
        console.error('Error checking supplier credit note transactions:', error);
      }
    };
    
    checkCreditNoteTransactions();
  }, [supplierCreditNotes, profile?.company_id]);

  // Filter credit notes
  const filteredCreditNotes = supplierCreditNotes.filter(creditNote => {
    const matchesSearch = !searchTerm || 
      creditNote.supplier_credit_note_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      creditNote.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      creditNote.reason.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || creditNote.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Sort credit notes
  const sortedCreditNotes = [...filteredCreditNotes].sort((a, b) => {
    let aValue: any, bValue: any;
    
    switch (sortField) {
      case 'supplier_credit_note_number':
        aValue = a.supplier_credit_note_number;
        bValue = b.supplier_credit_note_number;
        break;
      case 'supplier_name':
        aValue = a.supplier_name;
        bValue = b.supplier_name;
        break;
      case 'supplier_credit_note_date':
        aValue = new Date(a.supplier_credit_note_date);
        bValue = new Date(b.supplier_credit_note_date);
        break;
      case 'total_amount':
        aValue = a.total_amount;
        bValue = b.total_amount;
        break;
      case 'status':
        aValue = a.status;
        bValue = b.status;
        break;
      case 'created_at':
        aValue = new Date(a.created_at);
        bValue = new Date(b.created_at);
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
  const totalPages = Math.ceil(sortedCreditNotes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCreditNotes = sortedCreditNotes.slice(startIndex, startIndex + itemsPerPage);

  // Sorting functions
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
      case 'received':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
      case 'processed':
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 hover:bg-red-200';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };

  // Export to Excel with comprehensive data
  const exportToExcel = async () => {
    try {
      const workbook = XLSX.utils.book_new();
      
      // Comprehensive header information
      const headerData = [
        ['SUPPLIER CREDIT NOTES REPORT'],
        [''],
        ['Company Information:'],
        ['Name:', companyData?.name || 'N/A'],
        ['Address:', `${companyData?.address_line1 || ''} ${companyData?.address_line2 || ''}`],
        ['City:', `${companyData?.city || ''}, ${companyData?.state || ''} ${companyData?.postal_code || ''}`],
        ['Phone:', companyData?.phone || 'N/A', 'Email:', companyData?.email || 'N/A'],
        ['GSTIN:', companyData?.gstn || 'N/A'],
        [''],
        ['REPORT DETAILS:'],
        ['Generated:', format(new Date(), 'dd/MM/yyyy HH:mm')],
        ['Total Credit Notes:', sortedCreditNotes.length],
        ['Status Filter:', statusFilter === 'all' ? 'All' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)],
        [''],
        ['CREDIT NOTES LIST:'],
        ['S.No', 'Credit Note #', 'Date', 'Supplier', 'Reason', 'Amount', 'Status', 'Created Date']
      ];

      // Add data rows with comprehensive details
      let totalAmount = 0;
      
      sortedCreditNotes.forEach((creditNote, index) => {
        totalAmount += creditNote.total_amount;
        
        headerData.push([
          index + 1,
          creditNote.supplier_credit_note_number,
          format(new Date(creditNote.supplier_credit_note_date), 'dd/MM/yyyy'),
          creditNote.supplier_name,
          creditNote.reason,
          Math.round(creditNote.total_amount),
          creditNote.status.charAt(0).toUpperCase() + creditNote.status.slice(1),
          format(new Date(creditNote.created_at), 'dd/MM/yyyy HH:mm')
        ]);
      });

      // Add summary
      headerData.push(
        [''],
        ['SUMMARY:'],
        ['Total Credit Notes:', sortedCreditNotes.length],
        ['Total Amount:', Math.round(totalAmount)],
        ['Received Count:', sortedCreditNotes.filter(cn => cn.status === 'received').length],
        ['Processed Count:', sortedCreditNotes.filter(cn => cn.status === 'processed').length],
        ['Cancelled Count:', sortedCreditNotes.filter(cn => cn.status === 'cancelled').length]
      );

      const worksheet = XLSX.utils.aoa_to_sheet(headerData);
      
      // Set column widths
      worksheet['!cols'] = [
        { wch: 6 }, { wch: 20 }, { wch: 12 }, { wch: 25 },
        { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 18 }
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Credit Notes');
      XLSX.writeFile(workbook, `SupplierCreditNotes_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      
      toast({
        title: "Success",
        description: `${sortedCreditNotes.length} credit notes exported to Excel`,
      });
    } catch (error) {
      console.error('Export to Excel failed:', error);
      toast({
        title: "Error",
        description: "Failed to export to Excel",
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

  // Export single credit note to PDF with comprehensive formatting
  const exportCreditNoteToPDF = async (creditNote: SupplierCreditNote) => {
    try {
      // Fetch detailed credit note data
      const { data: creditNoteDetail, error } = await supabase
        .from('supplier_credit_notes')
        .select('*')
        .eq('id', creditNote.id)
        .maybeSingle();

      if (error) throw error;
      if (!creditNoteDetail) {
        throw new Error('Credit note not found');
      }

      // Fetch supplier data separately
      const { data: supplier, error: supplierError } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', creditNoteDetail.supplier_id)
        .maybeSingle();

      if (supplierError) throw supplierError;

      // Fetch credit note items
      const { data: creditNoteItems, error: itemsError } = await supabase
        .from('supplier_credit_note_items')
        .select('*')
        .eq('supplier_credit_note_id', creditNote.id);

      if (itemsError) throw itemsError;

      const doc = new jsPDF();
      let yPos = 15;
      
      // ========== MODERN HEADER SECTION ==========
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
      
      // Company name and details
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
      doc.text('SUPPLIER', 195, 20, { align: 'right' });
      doc.text('CREDIT NOTE', 195, 27, { align: 'right' });
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`CN #: ${creditNote.supplier_credit_note_number}`, 195, 37, { align: 'right' });
      doc.text(`Date: ${format(new Date(creditNote.supplier_credit_note_date), 'dd/MM/yyyy')}`, 195, 43, { align: 'right' });
      
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
      doc.text(supplier?.name || creditNote.supplier_name, 17, yPos + 14);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(supplier?.address_line1 || 'Address', 17, yPos + 19);
      doc.text(`${supplier?.city || ''}, ${supplier?.state || ''} - ${supplier?.pin_code || ''}`, 17, yPos + 24);
      doc.text(`Contact: ${supplier?.contact_person || 'N/A'}`, 17, yPos + 29);
      doc.text(`Phone: ${supplier?.phone || 'N/A'}`, 17, yPos + 34);
      doc.text(`Email: ${supplier?.email || 'N/A'}`, 17, yPos + 39);
      doc.text(`GSTIN: ${supplier?.gst_number || 'N/A'}`, 17, yPos + 44);
      
      // Company / Bill To Details
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 128, 185);
      doc.text('BILL TO / COMPANY DETAILS', 110, yPos + 7);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(companyData?.name || 'Company Name', 110, yPos + 14);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(companyData?.address_line1 || 'Address', 110, yPos + 19);
      doc.text(`${companyData?.city || 'City'}, ${companyData?.state || 'State'}`, 110, yPos + 24);
      doc.text(`PIN: ${companyData?.postal_code || 'N/A'}`, 110, yPos + 29);
      doc.text(`GSTIN: ${companyData?.gstn || 'N/A'}`, 110, yPos + 34);
      
      yPos += 53;
      
      // ========== CREDIT NOTE DETAILS SECTION ==========
      doc.setFillColor(240, 240, 240);
      doc.rect(15, yPos, 180, 20, 'F');
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Reason:', 17, yPos + 6);
      doc.text('Debit Note #:', 17, yPos + 12);
      doc.text('Status:', 17, yPos + 18);
      
      doc.setFont('helvetica', 'normal');
      const reasonText = doc.splitTextToSize(creditNote.reason || 'N/A', 70);
      doc.text(reasonText[0], 45, yPos + 6);
      doc.text(creditNoteDetail?.debit_note_id || 'N/A', 52, yPos + 12);
      doc.text(creditNote.status.toUpperCase(), 35, yPos + 18);
      
      doc.setFont('helvetica', 'bold');
      doc.text('CN Date:', 110, yPos + 6);
      doc.text('Created Date:', 110, yPos + 12);
      doc.text('Supplier Invoice:', 110, yPos + 18);
      
      doc.setFont('helvetica', 'normal');
      doc.text(format(new Date(creditNote.supplier_credit_note_date), 'dd/MM/yyyy'), 135, yPos + 6);
      doc.text(format(new Date(creditNote.created_at), 'dd/MM/yyyy'), 145, yPos + 12);
      doc.text('N/A', 155, yPos + 18);
      
      yPos += 28;
      
      // ========== LINE ITEMS TABLE (if available) ==========
      if (creditNoteItems && creditNoteItems.length > 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(41, 128, 185);
        doc.text('LINE ITEMS', 15, yPos);
        
        yPos += 6;
        
        let subtotal = 0;
        let totalTax = 0;

        const tableData = creditNoteItems.map((item: any, index: number) => {
          const qty = item.quantity || 0;
          const unitPrice = item.unit_price || 0;
          const lineSubtotal = qty * unitPrice;
          const lineTax = item.tax_amount || 0;
          const lineTotal = item.line_total || (lineSubtotal + lineTax);
          
          subtotal += lineSubtotal;
          totalTax += lineTax;

          return [
            (index + 1).toString(),
            item.product_sku,
            item.product_name,
            item.hsn_sac_code || '',
            qty,
            Math.round(unitPrice),
            Math.round((item.cgst_rate || 0) + (item.sgst_rate || 0) + (item.igst_rate || 0)),
            Math.round(lineTax),
            Math.round(lineTotal)
          ];
        });

        (doc as any).autoTable({
          startY: yPos,
          head: [['S.No', 'Item Code', 'Description', 'HSN', 'Qty', 'Rate', 'Tax%', 'Tax Amt', 'Amount']],
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
            2: { halign: 'left', cellWidth: 40 },
            3: { halign: 'center', cellWidth: 15 },
            4: { halign: 'center', cellWidth: 12 },
            5: { halign: 'right', cellWidth: 18 },
            6: { halign: 'center', cellWidth: 14 },
            7: { halign: 'right', cellWidth: 18 },
            8: { halign: 'right', cellWidth: 22 }
          },
          margin: { left: 15, right: 15 },
        });

        yPos = (doc as any).lastAutoTable.finalY + 10;
        
        // ========== TOTALS SECTION ==========
        const grandTotal = subtotal + totalTax;
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Subtotal:', 140, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(`INR ${Math.round(subtotal).toLocaleString('en-IN')}`, 195, yPos, { align: 'right' });
        
        yPos += 5;
        doc.setFont('helvetica', 'bold');
        doc.text('Total Tax:', 140, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(`INR ${Math.round(totalTax).toLocaleString('en-IN')}`, 195, yPos, { align: 'right' });
        
        yPos += 8;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Total:', 140, yPos);
        doc.text(`INR ${Math.round(grandTotal).toLocaleString('en-IN')}`, 195, yPos, { align: 'right' });
        
        yPos += 8;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text(`Amount in words: ${convertNumberToWords(Math.round(grandTotal))}`, 15, yPos);
      } else {
        // If no line items, show total amount
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Total Amount:', 140, yPos);
        doc.text(`INR ${Math.round(creditNote.total_amount).toLocaleString('en-IN')}`, 195, yPos, { align: 'right' });
        
        yPos += 8;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text(`Amount in words: ${convertNumberToWords(Math.round(creditNote.total_amount))}`, 15, yPos);
      }
      
      // ========== TERMS & CONDITIONS ==========
      yPos += 10;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Terms & Conditions:', 15, yPos);
      yPos += 5;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.text('1. This credit note is issued by the supplier against the purchase', 15, yPos);
      yPos += 4;
      doc.text('2. The amount will be adjusted in future purchases or as per agreement', 15, yPos);
      yPos += 4;
      doc.text('3. All amounts are in Indian Rupees (INR) unless otherwise stated', 15, yPos);
      
      // ========== FOOTER ==========
      const footerY = 270;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('For ' + (companyData?.name || 'Company Name'), 15, footerY);
      doc.text('Supplier Acknowledgment', 130, footerY);
      
      doc.setFont('helvetica', 'normal');
      doc.text('_____________________', 15, footerY + 15);
      doc.text('_____________________', 130, footerY + 15);
      doc.text('Authorized Signatory', 15, footerY + 20);
      doc.text('Supplier Signature', 130, footerY + 20);

      doc.save(`SupplierCreditNote_${creditNote.supplier_credit_note_number}.pdf`);
      
      toast({
        title: "Success",
        description: `Credit Note ${creditNote.supplier_credit_note_number} exported to PDF`,
      });
    } catch (error) {
      console.error('Export to PDF failed:', error);
      toast({
        title: "Error",
        description: "Failed to export to PDF",
        variant: "destructive",
      });
    }
  };

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, sortField, sortDirection]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (supplierCreditNotes.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-12">
            <p className="text-muted-foreground">No supplier credit notes found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        {/* Search and Export Controls */}
        <div className="p-4 sm:p-6 border-b bg-gradient-to-r from-blue-50 to-blue-100">
          <div className="flex flex-col gap-4 items-start justify-between">
            <div className="flex items-center gap-2 w-full">
              <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Input
                placeholder="Search by credit note number, supplier, or reason..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-white"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={exportToExcel}
                className="flex items-center gap-2 ml-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export Excel
              </Button>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-4 gap-2">
            <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="processed">Processed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="text-sm text-muted-foreground">
              Showing {paginatedCreditNotes.length} of {sortedCreditNotes.length} credit notes
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200 hover:from-slate-50 hover:to-slate-100">
                <TableHead 
                  className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4"
                  onClick={() => handleSort('supplier_credit_note_number')}
                >
                  <div className="flex items-center gap-1">
                    Credit Note #
                    {getSortIcon('supplier_credit_note_number')}
                  </div>
                </TableHead>
                <TableHead 
                  className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4"
                  onClick={() => handleSort('supplier_credit_note_date')}
                >
                  <div className="flex items-center gap-1">
                    Date
                    {getSortIcon('supplier_credit_note_date')}
                  </div>
                </TableHead>
                <TableHead 
                  className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4"
                  onClick={() => handleSort('supplier_name')}
                >
                  <div className="flex items-center gap-1">
                    Supplier
                    {getSortIcon('supplier_name')}
                  </div>
                </TableHead>
                <TableHead className="font-bold text-slate-800 py-4">Reason</TableHead>
                <TableHead 
                  className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4"
                  onClick={() => handleSort('total_amount')}
                >
                  <div className="flex items-center gap-1">
                    Amount
                    {getSortIcon('total_amount')}
                  </div>
                </TableHead>
                <TableHead 
                  className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    Status
                    {getSortIcon('status')}
                  </div>
                </TableHead>
                <TableHead className="font-bold text-slate-800 text-right py-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedCreditNotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <PackageOpen className="h-12 w-12 text-slate-300" />
                      <p>
                        {searchTerm || statusFilter !== 'all' 
                          ? 'No credit notes match your filters'
                          : 'No credit notes found.'
                        }
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedCreditNotes.map((creditNote) => (
                  <TableRow key={creditNote.id} className="hover:bg-slate-50 transition-all">
                    <TableCell className="font-medium">
                      {creditNote.supplier_credit_note_number}
                    </TableCell>
                    <TableCell>
                      {format(new Date(creditNote.supplier_credit_note_date), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell>{creditNote.supplier_name}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {creditNote.reason}
                    </TableCell>
                    <TableCell className="font-medium">
                      ₹{creditNote.total_amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(creditNote.status)}>
                        {creditNote.status.charAt(0).toUpperCase() + creditNote.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-2">
                        {/* Primary Actions Group */}
                        <div className="flex items-center rounded-lg border border-slate-200 bg-white shadow-sm">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onView(creditNote)}
                            className="h-9 px-3 rounded-l-lg rounded-r-none border-r border-slate-200 hover:bg-blue-50 hover:text-blue-700 transition-all duration-200"
                            title="View Credit Note"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(creditNote)}
                            disabled={!canEdit}
                            className="h-9 px-3 rounded-none border-r border-slate-200 hover:bg-amber-50 hover:text-amber-700 transition-all duration-200"
                            title={!canEdit ? "No permission to edit" : "Edit Credit Note"}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(creditNote)}
                            disabled={!canEdit || creditNotesWithTransactions.has(creditNote.id)}
                            className={`h-9 px-3 rounded-r-lg rounded-l-none hover:bg-red-50 hover:text-red-700 transition-all duration-200 ${
                              !canEdit || creditNotesWithTransactions.has(creditNote.id)
                                ? 'opacity-50 cursor-not-allowed'
                                : ''
                            }`}
                            title={
                              creditNotesWithTransactions.has(creditNote.id)
                                ? "Cannot delete credit note with existing transactions"
                                : !canEdit
                                ? "No permission to delete"
                                : "Delete credit note"
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
                            onClick={() => exportCreditNoteToPDF(creditNote)}
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
          <div className="flex items-center justify-between p-4 border-t">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, sortedCreditNotes.length)} of {sortedCreditNotes.length} results
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
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
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="hover:bg-white hover:shadow-md transition-all"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Summary */}
        {sortedCreditNotes.length > 0 && (
          <div className="flex justify-between items-center p-4 text-sm text-muted-foreground bg-muted/30">
            <div>
              Total: {supplierCreditNotes.length} credit notes | Filtered: {sortedCreditNotes.length}
            </div>
            <div>
              Total Amount: ₹{sortedCreditNotes.reduce((sum, cn) => sum + cn.total_amount, 0).toFixed(2)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}