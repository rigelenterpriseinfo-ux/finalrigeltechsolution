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
import { Eye, Edit, Trash2, FileText, FileSpreadsheet, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Search, PackageOpen } from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface GRN {
  id: string;
  grn_number: string;
  grn_date: string;
  supplier_name: string;
  supplier_invoice_number?: string;
  status: string;
  total_ordered_quantity: number;
  total_received_quantity: number;
  total_accepted_quantity: number;
  total_rejected_quantity: number;
  total_amount: number;
  purchase_order_id: string;
  purchase_orders?: {
    po_number: string;
  };
  created_at: string;
}

interface GRNTableProps {
  refreshTrigger?: number;
  onView: (grn: any) => void;
  onEdit: (grn: any) => void;
  onDelete: (grnId: string) => void;
}

export function GRNTable({ refreshTrigger, onView, onEdit, onDelete }: GRNTableProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [grns, setGRNs] = useState<GRN[]>([]);
  const [filteredGRNs, setFilteredGRNs] = useState<GRN[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState<keyof GRN>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [company, setCompany] = useState<any>(null);
  const itemsPerPage = 5;

  // Transaction protection state
  const [grnsWithTransactions, setGRNsWithTransactions] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (profile?.company_id) {
      fetchGRNs();
      fetchCompanyData();
    }
  }, [profile?.company_id, refreshTrigger]);

  // Check for GRN transactions
  useEffect(() => {
    const checkGRNTransactions = async () => {
      if (!profile?.company_id || grns.length === 0) return;
      
      const grnIds = grns.map(grn => grn.id);
      const grnsWithTxns = new Set<string>();
      
      try {
        // Check for inventory transactions
        const { data: invData } = await supabase
          .from('inventory_transactions')
          .select('reference_id')
          .eq('company_id', profile.company_id)
          .in('reference_id', grnIds)
          .eq('transaction_type', 'purchase_receipt');
        
        invData?.forEach(inv => grnsWithTxns.add(inv.reference_id));
        
        // Check for payments
        const { data: paymentData } = await supabase
          .from('payments')
          .select('grn_id')
          .eq('company_id', profile.company_id)
          .in('grn_id', grnIds)
          .not('grn_id', 'is', null);
        
        paymentData?.forEach(payment => grnsWithTxns.add(payment.grn_id));
        
        setGRNsWithTransactions(grnsWithTxns);
      } catch (error) {
        console.error('Error checking GRN transactions:', error);
      }
    };
    
    checkGRNTransactions();
  }, [grns, profile?.company_id]);

  useEffect(() => {
    filterAndSortGRNs();
  }, [grns, searchTerm, statusFilter, sortField, sortDirection]);

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

  const fetchGRNs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('grn_header')
        .select(`
          *,
          grn_line_items(*),
          purchase_orders(po_number)
        `)
        .eq('company_id', profile?.company_id)
        .order('grn_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      setGRNs(data || []);
    } catch (error) {
      console.error('Error fetching GRNs:', error);
      toast({
        title: "Error",
        description: "Failed to fetch GRNs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortGRNs = () => {
    let filtered = grns.filter((grn) => {
      const matchesSearch = 
        grn.grn_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        grn.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (grn.supplier_invoice_number && grn.supplier_invoice_number.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = statusFilter === 'all' || grn.status === statusFilter;
      
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

    setFilteredGRNs(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleSort = (field: keyof GRN) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: keyof GRN) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { 
        className: 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 rounded-full', 
        label: 'Draft' 
      },
      received: { 
        className: 'bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200 rounded-full', 
        label: 'Received' 
      },
      accepted: { 
        className: 'bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200 rounded-full', 
        label: 'Accepted' 
      },
      partially_received: { 
        className: 'bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200 rounded-full', 
        label: 'Partially Received' 
      },
      rejected: { 
        className: 'bg-red-100 text-red-700 border border-red-200 hover:bg-red-200 rounded-full', 
        label: 'Rejected' 
      },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return <Badge variant="secondary" className={config.className}>{config.label}</Badge>;
  };

  const exportToExcel = async (grn: GRN) => {
    try {
      // Fetch detailed GRN data with supplier info
      const { data: grnDetail, error } = await supabase
        .from('grn_header')
        .select(`
          *,
          grn_line_items(*),
          purchase_orders(
            po_number,
            external_po_ref,
            payment_terms,
            currency,
            delivery_address_line1,
            delivery_address_line2,
            delivery_city,
            delivery_state,
            delivery_country,
            delivery_postal_code
          ),
          suppliers(
            name,
            address_line1,
            address_line2,
            city,
            state,
            country,
            pin_code,
            phone,
            email,
            gst_number,
            contact_person
          )
        `)
        .eq('id', grn.id)
        .single();

      if (error) throw error;

      const supplier = grnDetail.suppliers as any || {};
      const po = grnDetail.purchase_orders as any || {};

      const workbook = XLSX.utils.book_new();
      
      // Comprehensive header information matching PO format
      const headerData = [
        ['GOODS RECEIPT NOTE (GRN)'],
        [''],
        ['Company Information:'],
        ['Name:', company?.name || 'N/A'],
        ['Address:', `${company?.address_line1 || ''} ${company?.address_line2 || ''}`],
        ['City:', `${company?.city || ''}, ${company?.state || ''} ${company?.postal_code || ''}`],
        ['Phone:', company?.phone || 'N/A', 'Email:', company?.email || 'N/A'],
        ['GSTIN:', company?.gstn || 'N/A'],
        [''],
        ['GRN HEADER:'],
        ['GRN Number:', grnDetail.grn_number, 'GRN Date:', format(new Date(grnDetail.grn_date), 'dd/MM/yyyy')],
        [''],
        ['SUPPLIER DETAILS:'],
        ['Supplier Name:', supplier.name || grnDetail.supplier_name],
        ['Contact Person:', supplier.contact_person || 'N/A'],
        ['Phone:', supplier.phone || 'N/A', 'Email:', supplier.email || 'N/A'],
        ['GSTIN:', supplier.gst_number || 'N/A'],
        ['Address:', `${supplier.address_line1 || ''} ${supplier.address_line2 || ''}`],
        ['City:', `${supplier.city || ''}, ${supplier.state || ''} ${supplier.pin_code || ''}`],
        [''],
        ['DELIVERY LOCATION:'],
        ['Address:', `${po.delivery_address_line1 || ''} ${po.delivery_address_line2 || ''}`],
        ['City:', `${po.delivery_city || ''}, ${po.delivery_state || ''} ${po.delivery_postal_code || ''}`],
        ['Country:', po.delivery_country || 'India'],
        [''],
        ['ORDER DETAILS:'],
        ['PO Number:', po.po_number || 'N/A', 'PO Reference:', po.external_po_ref || 'N/A'],
        ['Supplier Invoice:', grnDetail.supplier_invoice_number || 'N/A'],
        ['Payment Terms:', po.payment_terms || 'N/A', 'Currency:', po.currency || 'INR'],
        ['Status:', grnDetail.status],
        [''],
        ['LINE ITEMS:'],
        ['S.No', 'Item Code', 'Description', 'HSN', 'Ordered Qty', 'Received Qty', 'Accepted Qty', 'Rejected Qty', 'Rate', 'Disc%', 'Disc Amt', 'Tax%', 'Tax Amt', 'Amount']
      ];

      // Add line items with comprehensive details
      let subtotal = 0;
      let totalDiscount = 0;
      let cgstTotal = 0;
      let sgstTotal = 0;
      let igstTotal = 0;
      let totalTax = 0;
      
      grnDetail.grn_line_items?.forEach((item: any, index: number) => {
        const accQty = item.accepted_quantity || 0;
        const unitPrice = item.unit_price || 0;
        const discPct = item.discount_percentage || 0;
        const discAmt = item.discount_amount || 0;
        const lineSubtotal = accQty * unitPrice;
        const lineTaxRate = (item.cgst_rate || 0) + (item.sgst_rate || 0) + (item.igst_rate || 0);
        const lineTax = item.total_tax_amount || 0;
        const lineTotal = item.line_total || (lineSubtotal - discAmt + lineTax);
        
        subtotal += lineSubtotal;
        totalDiscount += discAmt;
        cgstTotal += (item.cgst_amount || 0);
        sgstTotal += (item.sgst_amount || 0);
        igstTotal += (item.igst_amount || 0);
        totalTax += lineTax;
        
        headerData.push([
          index + 1,
          item.product_sku,
          item.product_name,
          item.hsn_sac_code || '',
          item.ordered_quantity,
          item.received_quantity,
          accQty,
          item.rejected_quantity || 0,
          Math.round(unitPrice),
          discPct,
          Math.round(discAmt),
          lineTaxRate,
          Math.round(lineTax),
          Math.round(lineTotal)
        ]);
      });

      // Add comprehensive totals
      headerData.push(
        [''],
        ['QUANTITY SUMMARY:'],
        ['Total Ordered Quantity:', grnDetail.total_ordered_quantity],
        ['Total Received Quantity:', grnDetail.total_received_quantity],
        ['Total Accepted Quantity:', grnDetail.total_accepted_quantity],
        ['Total Rejected Quantity:', grnDetail.total_rejected_quantity],
        [''],
        ['FINANCIAL SUMMARY:'],
        ['Subtotal:', Math.round(subtotal)],
        ['Total Discount:', Math.round(totalDiscount)],
        ['CGST Amount:', Math.round(cgstTotal)],
        ['SGST Amount:', Math.round(sgstTotal)],
        ['IGST Amount:', Math.round(igstTotal)],
        ['Total Tax:', Math.round(totalTax)],
        ['Grand Total:', Math.round(subtotal - totalDiscount + totalTax)],
        [''],
        ['NOTES:'],
        [grnDetail.remarks || 'No additional notes'],
        [''],
        ['AUTHORIZATION:'],
        ['Received By:', '___________________', 'Date:', '___________________'],
        ['Inspected By:', '___________________', 'Date:', '___________________'],
        ['Approved By:', '___________________', 'Date:', '___________________']
      );

      const worksheet = XLSX.utils.aoa_to_sheet(headerData);
      
      // Set column widths
      worksheet['!cols'] = [
        { wch: 6 }, { wch: 12 }, { wch: 30 }, { wch: 10 },
        { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
        { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 8 },
        { wch: 12 }, { wch: 15 }
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, 'GRN');
      XLSX.writeFile(workbook, `GRN_${grnDetail.grn_number}.xlsx`);

      toast({
        title: "Success",
        description: "GRN exported to Excel successfully",
      });
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast({
        title: "Error",
        description: "Failed to export GRN to Excel",
        variant: "destructive",
      });
    }
  };

  const exportToPDF = async (grn: GRN) => {
    try {
      // Fetch detailed GRN data with supplier info
      const { data: grnDetail, error } = await supabase
        .from('grn_header')
        .select(`
          *,
          grn_line_items(*),
          purchase_orders(
            po_number,
            external_po_ref,
            payment_terms,
            currency,
            delivery_address_line1,
            delivery_address_line2,
            delivery_city,
            delivery_state,
            delivery_postal_code
          ),
          suppliers(
            name,
            address_line1,
            address_line2,
            city,
            state,
            pin_code,
            contact_person,
            phone,
            email,
            gst_number
          )
        `)
        .eq('id', grn.id)
        .single();

      if (error) throw error;

      const supplier = grnDetail.suppliers as any || {};
      const po = grnDetail.purchase_orders as any || {};

      const pdf = new jsPDF();
      
      // Blue header background - increased height
      pdf.setFillColor(41, 128, 185);
      pdf.rect(0, 0, 220, 55, 'F');

      // Company logo - Add actual logo if available
      if (company?.logo_url) {
        try {
          // Fetch and convert logo to base64 for PDF
          const response = await fetch(company.logo_url);
          const blob = await response.blob();
          const reader = new FileReader();
          
          await new Promise((resolve, reject) => {
            reader.onload = () => {
              try {
                pdf.addImage(reader.result as string, 'PNG', 12, 12, 22, 22);
                resolve(true);
              } catch (err) {
                reject(err);
              }
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (error) {
          console.error('Error adding logo:', error);
          // Fallback to placeholder circle
          pdf.setFillColor(255, 255, 255);
          pdf.circle(23, 23, 10, 'F');
          pdf.setFontSize(7);
          pdf.setTextColor(41, 128, 185);
          pdf.text('LOGO', 18, 25);
        }
      } else {
        // Logo placeholder circle
        pdf.setFillColor(255, 255, 255);
        pdf.circle(23, 23, 10, 'F');
        pdf.setFontSize(7);
        pdf.setTextColor(41, 128, 185);
        pdf.text('LOGO', 18, 25);
      }

      // Company details - Left side with improved text handling
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(13);
      pdf.setFont('helvetica', 'bold');
      
      // Truncate company name if too long
      const companyName = company?.name || 'Company Name';
      const maxCompanyNameWidth = 80;
      let displayCompanyName = companyName;
      if (pdf.getTextWidth(displayCompanyName) > maxCompanyNameWidth) {
        while (pdf.getTextWidth(displayCompanyName + '...') > maxCompanyNameWidth && displayCompanyName.length > 0) {
          displayCompanyName = displayCompanyName.slice(0, -1);
        }
        displayCompanyName += '...';
      }
      pdf.text(displayCompanyName, 40, 16);
      
      pdf.setFontSize(7.5);
      pdf.setFont('helvetica', 'normal');
      
      // Address line 1
      const addressLine1 = company?.address_line1 || 'Address';
      pdf.text(addressLine1.substring(0, 45), 40, 22);
      
      // City, State, Pin - on one line
      const cityStateLine = `${company?.city || 'City'}, ${company?.state || 'State'} - ${company?.postal_code || '000000'}`;
      pdf.text(cityStateLine.substring(0, 45), 40, 27);
      
      // GSTIN and Phone on separate lines for better readability
      pdf.text(`GSTIN: ${(company?.gstn || 'N/A').substring(0, 18)}`, 40, 32);
      pdf.text(`Phone: ${(company?.phone || 'N/A').substring(0, 22)}`, 40, 37);
      pdf.text(`Email: ${(company?.email || 'N/A').substring(0, 30)}`, 40, 42);

      // Document title - Right side with better positioning
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('GOODS RECEIPT', 205, 18, { align: 'right' });
      pdf.text('NOTE', 205, 25, { align: 'right' });
      
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`GRN #: ${grnDetail.grn_number}`, 205, 35, { align: 'right' });
      pdf.text(`Date: ${format(new Date(grnDetail.grn_date), 'dd/MM/yyyy')}`, 205, 41, { align: 'right' });

      // Reset text color for body
      pdf.setTextColor(0, 0, 0);
      let yPosition = 65;

      // ========== VENDOR & BUYER INFORMATION SECTION ==========
      pdf.setFillColor(245, 245, 245);
      pdf.rect(14, yPosition, 90, 48, 'F'); // Vendor box
      pdf.rect(110, yPosition, 90, 48, 'F'); // Ship To box
      
      // Vendor Details
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(41, 128, 185);
      pdf.text('VENDOR DETAILS', 16, yPosition + 7);
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text(supplier.name || grnDetail.supplier_name, 16, yPosition + 14);
      
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(60, 60, 60);
      pdf.text(supplier.address_line1 || 'N/A', 16, yPosition + 19);
      pdf.text(`${supplier.city || ''}, ${supplier.state || ''} - ${supplier.pin_code || ''}`, 16, yPosition + 24);
      pdf.text(`Contact: ${supplier.contact_person || 'N/A'}`, 16, yPosition + 29);
      pdf.text(`Phone: ${supplier.phone || 'N/A'}`, 16, yPosition + 34);
      pdf.text(`Email: ${supplier.email || 'N/A'}`, 16, yPosition + 39);
      pdf.text(`GSTIN: ${supplier.gst_number || 'N/A'}`, 16, yPosition + 44);

      // Ship To / Delivery Address
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(41, 128, 185);
      pdf.text('SHIP TO / DELIVERY ADDRESS', 112, yPosition + 7);
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text(company?.name || 'Company Name', 112, yPosition + 14);
      
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(60, 60, 60);
      pdf.text(po.delivery_address_line1 || company?.address_line1 || 'Address', 112, yPosition + 19);
      pdf.text(`${po.delivery_city || company?.city || 'City'}, ${po.delivery_state || company?.state || 'State'}`, 112, yPosition + 24);
      pdf.text(`PIN: ${po.delivery_postal_code || company?.postal_code || 'N/A'}`, 112, yPosition + 29);
      pdf.text(`Place of Supply: ${po.delivery_state || company?.state || 'N/A'}`, 112, yPosition + 34);

      yPosition += 53;

      // ========== ORDER DETAILS SECTION ==========
      pdf.setFillColor(240, 240, 240);
      pdf.rect(14, yPosition, 186, 20, 'F');
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      
      // Left column
      pdf.text('GRN Date:', 16, yPosition + 6);
      pdf.text('PO Number:', 16, yPosition + 12);
      pdf.text('Payment Terms:', 16, yPosition + 18);
      
      pdf.setFont('helvetica', 'normal');
      pdf.text(format(new Date(grnDetail.grn_date), 'dd/MM/yyyy'), 48, yPosition + 6);
      pdf.text(po.po_number || 'N/A', 48, yPosition + 12);
      pdf.text(po.payment_terms || 'N/A', 48, yPosition + 18);

      // Right column
      pdf.setFont('helvetica', 'bold');
      pdf.text('Supplier Invoice:', 110, yPosition + 6);
      pdf.text('Currency:', 110, yPosition + 12);
      pdf.text('Status:', 110, yPosition + 18);
      
      pdf.setFont('helvetica', 'normal');
      pdf.text(grnDetail.supplier_invoice_number || 'N/A', 145, yPosition + 6);
      pdf.text(po.currency || 'INR', 145, yPosition + 12);
      pdf.text(grnDetail.status.toUpperCase(), 145, yPosition + 18);

      yPosition += 28;

      // ========== LINE ITEMS TABLE ==========
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(41, 128, 185);
      pdf.text('LINE ITEMS', 14, yPosition);
      
      yPosition += 6;

      // Prepare table data
      const tableData = grnDetail.grn_line_items?.map((item: any, index: number) => {
        const accQty = item.accepted_quantity || 0;
        const unitPrice = item.unit_price || 0;
        const discPct = item.discount_percentage || 0;
        const discAmt = item.discount_amount || 0;
        const lineTaxRate = (item.cgst_rate || 0) + (item.sgst_rate || 0) + (item.igst_rate || 0);
        const lineTax = item.total_tax_amount || 0;
        const lineTotal = item.line_total || 0;
        
        return [
          index + 1,
          item.product_sku,
          item.product_name,
          item.hsn_sac_code || '-',
          accQty,
          Math.round(unitPrice),
          discPct,
          Math.round(discAmt),
          lineTaxRate,
          Math.round(lineTax),
          Math.round(lineTotal)
        ];
      }) || [];

      // Use autoTable for professional table layout
      (pdf as any).autoTable({
        startY: yPosition,
        head: [['S.No', 'Item Code', 'Description', 'HSN', 'Qty', 'Rate', 'Disc%', 'Disc Amt', 'Tax%', 'Tax Amt', 'Amount']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold',
          halign: 'center'
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [0, 0, 0]
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 12 },
          1: { halign: 'left', cellWidth: 20 },
          2: { halign: 'left', cellWidth: 35 },
          3: { halign: 'center', cellWidth: 15 },
          4: { halign: 'center', cellWidth: 12 },
          5: { halign: 'right', cellWidth: 18 },
          6: { halign: 'center', cellWidth: 12 },
          7: { halign: 'right', cellWidth: 18 },
          8: { halign: 'center', cellWidth: 12 },
          9: { halign: 'right', cellWidth: 18 },
          10: { halign: 'right', cellWidth: 20 }
        },
        margin: { left: 14, right: 14 }
      });

      // Get position after table
      yPosition = (pdf as any).lastAutoTable.finalY + 10;

      // Calculate totals
      let subtotal = 0;
      let totalDiscount = 0;
      let cgstTotal = 0;
      let sgstTotal = 0;
      let igstTotal = 0;
      
      grnDetail.grn_line_items?.forEach((item: any) => {
        const accQty = item.accepted_quantity || 0;
        const unitPrice = item.unit_price || 0;
        subtotal += accQty * unitPrice;
        totalDiscount += item.discount_amount || 0;
        cgstTotal += item.cgst_amount || 0;
        sgstTotal += item.sgst_amount || 0;
        igstTotal += item.igst_amount || 0;
      });

      const totalTax = cgstTotal + sgstTotal + igstTotal;
      const grandTotal = subtotal - totalDiscount + totalTax;

      // Totals section (right-aligned)
      const totalsX = 145;
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      
      pdf.text('Subtotal:', totalsX, yPosition);
      pdf.text(`INR ${Math.round(subtotal).toLocaleString()}`, 196, yPosition, { align: 'right' });
      yPosition += 6;
      
      if (cgstTotal > 0) {
        pdf.text(`CGST (${grnDetail.grn_line_items?.[0]?.cgst_rate || 0}%):`, totalsX, yPosition);
        pdf.text(`INR ${Math.round(cgstTotal).toLocaleString()}`, 196, yPosition, { align: 'right' });
        yPosition += 6;
      }
      
      if (sgstTotal > 0) {
        pdf.text(`SGST (${grnDetail.grn_line_items?.[0]?.sgst_rate || 0}%):`, totalsX, yPosition);
        pdf.text(`INR ${Math.round(sgstTotal).toLocaleString()}`, 196, yPosition, { align: 'right' });
        yPosition += 6;
      }
      
      if (igstTotal > 0) {
        pdf.text(`IGST (${grnDetail.grn_line_items?.[0]?.igst_rate || 0}%):`, totalsX, yPosition);
        pdf.text(`INR ${Math.round(igstTotal).toLocaleString()}`, 196, yPosition, { align: 'right' });
        yPosition += 6;
      }
      
      if (totalDiscount > 0) {
        pdf.text('Discount:', totalsX, yPosition);
        pdf.text(`-INR ${Math.round(totalDiscount).toLocaleString()}`, 196, yPosition, { align: 'right' });
        yPosition += 6;
      }
      
      // Total line
      yPosition += 2;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text('Total:', totalsX, yPosition);
      pdf.text(`INR ${Math.round(grandTotal).toLocaleString()}`, 196, yPosition, { align: 'right' });
      
      // Amount in words
      yPosition += 8;
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'italic');
      pdf.text(`Amount in words: ${convertNumberToWords(Math.round(grandTotal))} Only`, 14, yPosition);

      // Terms & Conditions section
      yPosition += 10;
      if (yPosition > 250) {
        pdf.addPage();
        yPosition = 20;
      }
      
      pdf.setFillColor(240, 240, 240);
      pdf.rect(14, yPosition, 182, 7, 'F');
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(70, 130, 180);
      pdf.text('TERMS & CONDITIONS', 16, yPosition + 5);
      
      yPosition += 12;
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 0, 0);
      
      const terms = [
        '1. All goods received are subject to quality inspection.',
        '2. Damaged or defective items must be reported within 24 hours of receipt.',
        '3. Payment terms as per purchase order agreement.',
        '4. Any discrepancies in quantity or quality should be reported immediately.',
        '5. This GRN serves as proof of goods received and accepted.'
      ];
      
      terms.forEach(term => {
        pdf.text(term, 16, yPosition);
        yPosition += 5;
      });

      // Notes section
      if (grnDetail.remarks) {
        yPosition += 5;
        pdf.setFont('helvetica', 'bold');
        pdf.text('Notes:', 16, yPosition);
        yPosition += 5;
        pdf.setFont('helvetica', 'normal');
        const remarks = pdf.splitTextToSize(grnDetail.remarks, 170);
        pdf.text(remarks, 16, yPosition);
      }

      // Footer with signatures
      yPosition = 270;
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Received By: _______________', 16, yPosition);
      pdf.text('Inspected By: _______________', 80, yPosition);
      pdf.text('Approved By: _______________', 144, yPosition);

      pdf.save(`GRN_${grnDetail.grn_number}.pdf`);

      toast({
        title: "Success",
        description: "GRN exported to PDF successfully",
      });
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      toast({
        title: "Error",
        description: "Failed to export GRN to PDF",
        variant: "destructive",
      });
    }
  };

  // Helper function to convert number to words
  const convertNumberToWords = (num: number): string => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    
    if (num === 0) return 'Zero Rupees';
    
    const convertLessThanThousand = (n: number): string => {
      if (n === 0) return '';
      if (n < 10) return ones[n];
      if (n < 20) return teens[n - 10];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
      return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertLessThanThousand(n % 100) : '');
    };
    
    if (num < 1000) return 'Rupees ' + convertLessThanThousand(num);
    if (num < 100000) {
      const thousands = Math.floor(num / 1000);
      const remainder = num % 1000;
      return 'Rupees ' + convertLessThanThousand(thousands) + ' Thousand' + 
             (remainder !== 0 ? ' ' + convertLessThanThousand(remainder) : '');
    }
    if (num < 10000000) {
      const lakhs = Math.floor(num / 100000);
      const remainder = num % 100000;
      return 'Rupees ' + convertLessThanThousand(lakhs) + ' Lakh' + 
             (remainder !== 0 ? ' ' + convertNumberToWords(remainder).replace('Rupees ', '') : '');
    }
    
    const crores = Math.floor(num / 10000000);
    const remainder = num % 10000000;
    return 'Rupees ' + convertLessThanThousand(crores) + ' Crore' + 
           (remainder !== 0 ? ' ' + convertNumberToWords(remainder).replace('Rupees ', '') : '');
  };

  // Pagination
  const totalPages = Math.ceil(filteredGRNs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentGRNs = filteredGRNs.slice(startIndex, endIndex);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading GRNs...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <CardTitle>Goods Receipt Notes (GRN)</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Search and Export Controls */}
        <div className="p-4 sm:p-6 border-b bg-gradient-to-r from-blue-50 to-blue-100">
          <div className="flex flex-col gap-4 items-start justify-between">
            <div className="flex items-center gap-2 w-full">
              <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Input
                placeholder="Search by GRN Number or Supplier..."
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
                onClick={() => {
                  // Export all filtered GRNs
                  const wsData = filteredGRNs.map(grn => ({
                    'GRN Number': grn.grn_number,
                    'GRN Date': format(new Date(grn.grn_date), 'dd/MM/yyyy'),
                    'PO Number': grn.purchase_orders?.po_number || 'N/A',
                    'Supplier': grn.supplier_name,
                    'Supplier Invoice': grn.supplier_invoice_number || '-',
                    'Status': grn.status.toUpperCase(),
                    'Total Amount': grn.total_amount
                  }));
                  const ws = XLSX.utils.json_to_sheet(wsData);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, 'GRNs');
                  XLSX.writeFile(wb, `GRNs_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
                  toast({ title: "Success", description: `Exported ${filteredGRNs.length} GRNs to Excel` });
                }}
                className="h-9 px-4 gap-2 rounded-md bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 font-medium transition-colors"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export Excel
              </Button>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-4 gap-2 text-sm text-muted-foreground">
            <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
              <SelectTrigger className="w-[180px] bg-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="partially_received">Partially Received</SelectItem>
              </SelectContent>
            </Select>
            
            <span>
              Showing {currentGRNs.length} of {filteredGRNs.length} GRNs
            </span>
            <span>
              Page {currentPage} of {totalPages}
            </span>
          </div>
        </div>
        {filteredGRNs.length === 0 ? (
          <div className="text-center py-12">
            <PackageOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground font-medium">
              {grns.length === 0 
                ? "No GRNs found. Create your first GRN to get started." 
                : "No GRNs match your current filters."
              }
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200 hover:from-slate-50 hover:to-slate-100">
                    <TableHead 
                      className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4"
                      onClick={() => handleSort('grn_number')}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wider">GRN Number</span>
                        {getSortIcon('grn_number')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4"
                      onClick={() => handleSort('grn_date')}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wider">GRN Date</span>
                        {getSortIcon('grn_date')}
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-slate-800 py-4">
                      <span className="text-xs uppercase tracking-wider">PO Number</span>
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
                    <TableHead className="font-bold text-slate-800 py-4">
                      <span className="text-xs uppercase tracking-wider">Supplier Invoice</span>
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
                    <TableHead 
                      className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4 text-right"
                      onClick={() => handleSort('total_amount')}
                    >
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-xs uppercase tracking-wider">Total Amount</span>
                        {getSortIcon('total_amount')}
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-slate-800 text-center py-4 min-w-[200px]">
                      <span className="text-xs uppercase tracking-wider">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentGRNs.map((grn) => (
                    <TableRow key={grn.id} className="hover:bg-slate-50 transition-all">
                      <TableCell className="font-medium text-blue-600">{grn.grn_number}</TableCell>
                      <TableCell>{format(new Date(grn.grn_date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>
                        <div className="inline-flex items-center px-3 py-1.5 rounded-md bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 hover:from-blue-100 hover:to-blue-150 transition-all duration-200 max-w-fit">
                          <span className="text-sm font-semibold text-blue-800 whitespace-nowrap">
                            {grn.purchase_orders?.po_number || 'N/A'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{grn.supplier_name}</TableCell>
                      <TableCell className="text-muted-foreground">{grn.supplier_invoice_number || '-'}</TableCell>
                      <TableCell>{getStatusBadge(grn.status)}</TableCell>
                      <TableCell className="text-right font-semibold">₹{grn.total_amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 justify-center">
                          {/* Primary Actions Group */}
                          <div className="flex items-center rounded-lg border border-slate-200 bg-white shadow-sm">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onView(grn)}
                              className="h-9 px-3 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-all duration-200"
                              title="View GRN Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Export Actions Group */}
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => exportToExcel(grn)}
                              className="h-9 px-3 rounded-md bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 transition-colors"
                              title="Export Excel"
                            >
                              <FileSpreadsheet className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => exportToPDF(grn)}
                              className="h-9 px-3 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300 transition-all duration-200 shadow-sm"
                              title="Export PDF"
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
              <div className="flex items-center justify-between p-6 border-t bg-gradient-to-r from-slate-50 to-slate-100">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredGRNs.length)} of {filteredGRNs.length} results
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="hover:bg-white hover:shadow-md"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className={currentPage === page ? "bg-blue-600 hover:bg-blue-700" : "hover:bg-white hover:shadow-md"}
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="hover:bg-white hover:shadow-md"
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
}