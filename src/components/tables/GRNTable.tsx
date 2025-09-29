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
            currency
          ),
          suppliers(
            name,
            address_line1,
            city,
            state,
            gst_number,
            contact_person,
            phone
          )
        `)
        .eq('id', grn.id)
        .single();

      if (error) throw error;

      const supplier = grnDetail.suppliers as any || {};
      const po = grnDetail.purchase_orders as any || {};

      const pdf = new jsPDF();
      let yPosition = 20;

      // Header with company name
      pdf.setFontSize(22);
      pdf.setFont('helvetica', 'bold');
      pdf.text(company?.name || 'Company Name', 105, yPosition, { align: 'center' });
      yPosition += 8;
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${company?.address_line1 || ''}, ${company?.city || ''}, ${company?.state || ''}`, 105, yPosition, { align: 'center' });
      yPosition += 5;
      pdf.text(`Phone: ${company?.phone || 'N/A'} | Email: ${company?.email || 'N/A'}`, 105, yPosition, { align: 'center' });
      yPosition += 5;
      pdf.text(`GSTIN: ${company?.gstn || 'N/A'}`, 105, yPosition, { align: 'center' });
      yPosition += 12;

      // Document title
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('GOODS RECEIPT NOTE', 105, yPosition, { align: 'center' });
      yPosition += 12;

      // GRN Details box
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text('GRN HEADER', 14, yPosition);
      yPosition += 6;
      
      pdf.setFont('helvetica', 'normal');
      pdf.text(`GRN Number: ${grnDetail.grn_number}`, 14, yPosition);
      pdf.text(`Date: ${format(new Date(grnDetail.grn_date), 'dd/MM/yyyy')}`, 120, yPosition);
      yPosition += 6;
      pdf.text(`PO Number: ${po.po_number || 'N/A'}`, 14, yPosition);
      pdf.text(`Status: ${grnDetail.status}`, 120, yPosition);
      yPosition += 6;
      pdf.text(`Supplier Invoice: ${grnDetail.supplier_invoice_number || 'N/A'}`, 14, yPosition);
      yPosition += 10;

      // Supplier Details
      pdf.setFont('helvetica', 'bold');
      pdf.text('SUPPLIER DETAILS', 14, yPosition);
      yPosition += 6;
      
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Name: ${supplier.name || grnDetail.supplier_name}`, 14, yPosition);
      yPosition += 6;
      pdf.text(`Contact: ${supplier.contact_person || 'N/A'}`, 14, yPosition);
      pdf.text(`Phone: ${supplier.phone || 'N/A'}`, 120, yPosition);
      yPosition += 6;
      pdf.text(`GSTIN: ${supplier.gst_number || 'N/A'}`, 14, yPosition);
      yPosition += 6;
      pdf.text(`Address: ${supplier.address_line1 || 'N/A'}`, 14, yPosition);
      yPosition += 12;

      // Line Items Table
      pdf.setFont('helvetica', 'bold');
      pdf.text('LINE ITEMS', 14, yPosition);
      yPosition += 8;

      // Table column positions
      const colPositions = {
        sno: 14,
        itemCode: 21,
        description: 38,
        hsn: 75,
        qty: 91,
        rate: 106,
        discPct: 119,
        discAmt: 132,
        taxPct: 147,
        taxAmt: 162,
        amount: 180
      };

      // Table headers
      pdf.setFontSize(8);
      pdf.text('S.No', colPositions.sno, yPosition);
      pdf.text('Item Code', colPositions.itemCode, yPosition);
      pdf.text('Description', colPositions.description, yPosition);
      pdf.text('HSN', colPositions.hsn, yPosition);
      pdf.text('Acc.Qty', colPositions.qty, yPosition);
      pdf.text('Rate', colPositions.rate, yPosition);
      pdf.text('Disc%', colPositions.discPct, yPosition);
      pdf.text('Disc', colPositions.discAmt, yPosition);
      pdf.text('Tax%', colPositions.taxPct, yPosition);
      pdf.text('Tax', colPositions.taxAmt, yPosition);
      pdf.text('Amount', colPositions.amount, yPosition);
      yPosition += 5;

      // Draw line under headers
      pdf.line(14, yPosition, 196, yPosition);
      yPosition += 5;

      // Table rows
      pdf.setFont('helvetica', 'normal');
      let subtotal = 0;
      let totalDiscount = 0;
      let cgstTotal = 0;
      let sgstTotal = 0;
      let totalTax = 0;
      
      grnDetail.grn_line_items?.forEach((item: any, index: number) => {
        if (yPosition > 270) {
          pdf.addPage();
          yPosition = 20;
        }

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
        totalTax += lineTax;

        pdf.text(`${index + 1}`, colPositions.sno, yPosition);
        pdf.text(item.product_sku.substring(0, 8), colPositions.itemCode, yPosition);
        pdf.text(item.product_name.substring(0, 15), colPositions.description, yPosition);
        pdf.text(item.hsn_sac_code || '-', colPositions.hsn, yPosition);
        pdf.text(accQty.toString(), colPositions.qty, yPosition);
        pdf.text(Math.round(unitPrice).toString(), colPositions.rate, yPosition);
        pdf.text(discPct.toString(), colPositions.discPct, yPosition);
        pdf.text(Math.round(discAmt).toString(), colPositions.discAmt, yPosition);
        pdf.text(lineTaxRate.toString(), colPositions.taxPct, yPosition);
        pdf.text(Math.round(lineTax).toString(), colPositions.taxAmt, yPosition);
        pdf.text(Math.round(lineTotal).toString(), colPositions.amount, yPosition);
        yPosition += 6;
      });

      // Draw line before totals
      pdf.line(14, yPosition, 196, yPosition);
      yPosition += 8;

      // Totals section
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      
      const totalXPos = 145;
      pdf.text('Subtotal:', totalXPos, yPosition);
      pdf.text(`₹${Math.round(subtotal).toLocaleString()}`, 180, yPosition);
      yPosition += 6;
      
      if (totalDiscount > 0) {
        pdf.text('Discount:', totalXPos, yPosition);
        pdf.text(`-₹${Math.round(totalDiscount).toLocaleString()}`, 180, yPosition);
        yPosition += 6;
      }
      
      if (cgstTotal > 0) {
        pdf.text('CGST:', totalXPos, yPosition);
        pdf.text(`₹${Math.round(cgstTotal).toLocaleString()}`, 180, yPosition);
        yPosition += 6;
      }
      
      if (sgstTotal > 0) {
        pdf.text('SGST:', totalXPos, yPosition);
        pdf.text(`₹${Math.round(sgstTotal).toLocaleString()}`, 180, yPosition);
        yPosition += 6;
      }
      
      pdf.setFontSize(12);
      pdf.text('Total:', totalXPos, yPosition);
      pdf.text(`₹${Math.round(subtotal - totalDiscount + totalTax).toLocaleString()}`, 180, yPosition);
      yPosition += 12;

      // Notes section
      if (grnDetail.remarks) {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Notes:', 14, yPosition);
        yPosition += 6;
        pdf.setFont('helvetica', 'normal');
        pdf.text(grnDetail.remarks.substring(0, 100), 14, yPosition);
        yPosition += 10;
      }

      // Footer with signatures
      yPosition = 260;
      pdf.setFontSize(9);
      pdf.text('Received By: _______________', 14, yPosition);
      pdf.text('Inspected By: _______________', 80, yPosition);
      pdf.text('Approved By: _______________', 146, yPosition);

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
      <CardHeader>
        <CardTitle>GRN Management</CardTitle>
        <CardDescription>
          Manage Goods Receipt Notes (GRN) for received purchase orders
        </CardDescription>
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
                  // Export functionality can be added later
                  toast({
                    title: "Coming Soon",
                    description: "Bulk Excel export will be available soon",
                  });
                }}
                className="flex items-center gap-2 ml-2 bg-white hover:bg-gray-50"
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
                              className="h-9 px-3 rounded-l-lg rounded-r-none border-r border-slate-200 hover:bg-blue-50 hover:text-blue-700 transition-all duration-200"
                              title="View GRN Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEdit(grn)}
                              disabled={grnsWithTransactions.has(grn.id)}
                              className={`h-9 px-3 rounded-none border-r border-slate-200 transition-all duration-200 ${
                                grnsWithTransactions.has(grn.id)
                                  ? 'text-slate-400 cursor-not-allowed hover:bg-transparent'
                                  : 'hover:bg-emerald-50 hover:text-emerald-700'
                              }`}
                              title={grnsWithTransactions.has(grn.id) ? 'Cannot edit GRN with existing transactions' : 'Edit GRN'}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDelete(grn.id)}
                              disabled={grnsWithTransactions.has(grn.id)}
                              className={`h-9 px-3 rounded-r-lg rounded-l-none transition-all duration-200 ${
                                grnsWithTransactions.has(grn.id)
                                  ? 'text-slate-400 cursor-not-allowed hover:bg-transparent'
                                  : 'hover:bg-red-50 hover:text-red-700'
                              }`}
                              title={grnsWithTransactions.has(grn.id) ? 'Cannot delete GRN with existing transactions' : 'Delete GRN'}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Export Actions Group */}
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => exportToExcel(grn)}
                              className="h-9 px-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-all duration-200 shadow-sm"
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