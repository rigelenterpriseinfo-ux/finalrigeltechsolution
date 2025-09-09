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
import { Eye, Edit, Trash2, Download, FileSpreadsheet, ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
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

  useEffect(() => {
    if (profile?.company_id) {
      fetchGRNs();
      fetchCompanyData();
    }
  }, [profile?.company_id, refreshTrigger]);

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
          grn_line_items(*)
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
    return sortDirection === 'asc' ? 
      <ArrowUpDown className="h-4 w-4 rotate-180" /> : 
      <ArrowUpDown className="h-4 w-4" />;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { 
        className: 'bg-gray-100 text-gray-800 hover:bg-gray-200', 
        label: 'Draft' 
      },
      received: { 
        className: 'bg-blue-100 text-blue-800 hover:bg-blue-200', 
        label: 'Received' 
      },
      accepted: { 
        className: 'bg-green-100 text-green-800 hover:bg-green-200', 
        label: 'Accepted' 
      },
      partially_received: { 
        className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200', 
        label: 'Partially Received' 
      },
      rejected: { 
        className: 'bg-red-100 text-red-800 hover:bg-red-200', 
        label: 'Rejected' 
      },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return <Badge variant="secondary" className={config.className}>{config.label}</Badge>;
  };

  const exportToExcel = async (grn: GRN) => {
    try {
      // Fetch detailed GRN data
      const { data: grnDetail, error } = await supabase
        .from('grn_header')
        .select(`
          *,
          grn_line_items(*)
        `)
        .eq('id', grn.id)
        .single();

      if (error) throw error;

      const workbook = XLSX.utils.book_new();
      
      // Header information
      const headerData = [
        ['GOODS RECEIPT NOTE (GRN)'],
        [''],
        ['Company:', company?.name || 'N/A'],
        ['Address:', `${company?.address_line1 || ''} ${company?.address_line2 || ''}`],
        ['City:', `${company?.city || ''}, ${company?.state || ''} ${company?.postal_code || ''}`],
        ['Phone:', company?.phone || 'N/A'],
        ['Email:', company?.email || 'N/A'],
        [''],
        ['GRN Number:', grnDetail.grn_number],
        ['GRN Date:', format(new Date(grnDetail.grn_date), 'dd/MM/yyyy')],
        ['PO Number:', `PO-${grnDetail.purchase_order_id.slice(-6)}`],
        ['Supplier:', grnDetail.supplier_name],
        ['Supplier Invoice:', grnDetail.supplier_invoice_number || 'N/A'],
        ['Status:', grnDetail.status],
        [''],
        ['LINE ITEMS:'],
        ['Product Name', 'SKU', 'UOM', 'Ordered Qty', 'Received Qty', 'Accepted Qty', 'Rejected Qty', 'Unit Price', 'Line Total']
      ];

      // Add line items with GST details
      let subtotal = 0;
      let totalTax = 0;
      let cgstTotal = 0;
      let sgstTotal = 0;
      let igstTotal = 0;
      
      grnDetail.grn_line_items?.forEach((item: any) => {
        const accQty = item.accepted_quantity || 0;
        const unitPrice = item.unit_price || 0;
        const lineSubtotal = accQty * unitPrice;
        const lineTaxRate = (item.cgst_rate || 0) + (item.sgst_rate || 0) + (item.igst_rate || 0);
        const lineTax = item.total_tax_amount ?? (lineSubtotal * lineTaxRate) / 100;
        const lineTotal = item.line_total ?? (lineSubtotal + lineTax);
        
        subtotal += lineSubtotal;
        totalTax += lineTax;
        cgstTotal += (item.cgst_amount || 0);
        sgstTotal += (item.sgst_amount || 0);
        igstTotal += (item.igst_amount || 0);
        
        headerData.push([
          item.product_name,
          item.product_sku,
          item.unit_of_measure,
          item.ordered_quantity,
          item.received_quantity,
          accQty,
          item.rejected_quantity,
          `₹${unitPrice.toFixed(2)}`,
          `₹${lineSubtotal.toFixed(2)}`,
          `${lineTaxRate}%`,
          `₹${Number(lineTax).toFixed(2)}`,
          `₹${Number(lineTotal).toFixed(2)}`
        ]);
      });

      // Update headers to include GST columns
      const gstHeaders = ['Product Name', 'SKU', 'UOM', 'Ordered Qty', 'Received Qty', 'Accepted Qty', 'Rejected Qty', 'Unit Price', 'Subtotal', 'Tax Rate', 'Tax Amount', 'Line Total'];
      headerData[16] = gstHeaders;

      // Add totals with GST breakdown
      headerData.push(
        [''],
        ['SUMMARY:'],
        ['Total Ordered Quantity:', grnDetail.total_ordered_quantity],
        ['Total Received Quantity:', grnDetail.total_received_quantity],
        ['Total Accepted Quantity:', grnDetail.total_accepted_quantity],
        ['Total Rejected Quantity:', grnDetail.total_rejected_quantity],
        [''],
        ['FINANCIAL SUMMARY:'],
        ['Taxable Amount:', `₹${subtotal.toFixed(2)}`],
        ['CGST Amount:', `₹${cgstTotal.toFixed(2)}`],
        ['SGST Amount:', `₹${sgstTotal.toFixed(2)}`],
        ['IGST Amount:', `₹${igstTotal.toFixed(2)}`],
        ['Total Tax Amount:', `₹${totalTax.toFixed(2)}`],
        ['Total Amount (Including Tax):', `₹${(subtotal + totalTax).toFixed(2)}`]
      );

      const worksheet = XLSX.utils.aoa_to_sheet(headerData);
      
      // Set column widths for GST report
      const colWidths = [
        { wch: 25 }, { wch: 15 }, { wch: 8 }, { wch: 12 }, 
        { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, 
        { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 15 }
      ];
      worksheet['!cols'] = colWidths;

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
      // Fetch detailed GRN data
      const { data: grnDetail, error } = await supabase
        .from('grn_header')
        .select(`
          *,
          grn_line_items(*)
        `)
        .eq('id', grn.id)
        .single();

      if (error) throw error;

      const pdf = new jsPDF();
      let yPosition = 20;

      // Header
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('GOODS RECEIPT NOTE (GRN)', 20, yPosition);
      yPosition += 20;

      // Company Information
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Company: ${company?.name || 'N/A'}`, 20, yPosition);
      yPosition += 7;
      pdf.text(`Address: ${company?.address_line1 || ''} ${company?.address_line2 || ''}`, 20, yPosition);
      yPosition += 7;
      pdf.text(`City: ${company?.city || ''}, ${company?.state || ''} ${company?.postal_code || ''}`, 20, yPosition);
      yPosition += 7;
      pdf.text(`Phone: ${company?.phone || 'N/A'} | Email: ${company?.email || 'N/A'}`, 20, yPosition);
      yPosition += 15;

      // GRN Details
      pdf.setFont('helvetica', 'bold');
      pdf.text('GRN DETAILS:', 20, yPosition);
      yPosition += 10;
      
      pdf.setFont('helvetica', 'normal');
      pdf.text(`GRN Number: ${grnDetail.grn_number}`, 20, yPosition);
      pdf.text(`GRN Date: ${format(new Date(grnDetail.grn_date), 'dd/MM/yyyy')}`, 120, yPosition);
      yPosition += 7;
      pdf.text(`PO Number: PO-${grnDetail.purchase_order_id.slice(-6)}`, 20, yPosition);
      pdf.text(`Status: ${grnDetail.status}`, 120, yPosition);
      yPosition += 7;
      pdf.text(`Supplier: ${grnDetail.supplier_name}`, 20, yPosition);
      yPosition += 7;
      pdf.text(`Supplier Invoice: ${grnDetail.supplier_invoice_number || 'N/A'}`, 20, yPosition);
      yPosition += 15;

      // Table Header
      pdf.setFont('helvetica', 'bold');
      pdf.text('LINE ITEMS:', 20, yPosition);
      yPosition += 10;

      // Table headers with GST
      const headers = ['Product', 'Acc.Qty', 'Unit Price', 'Subtotal', 'Tax%', 'Tax Amt', 'Total'];
      let xPos = 20;
      const colWidths = [35, 18, 22, 22, 15, 20, 22];
      
      headers.forEach((header, index) => {
        pdf.text(header, xPos, yPosition);
        xPos += colWidths[index];
      });
      yPosition += 7;

      // Table rows with GST calculations
      pdf.setFont('helvetica', 'normal');
      let subtotal = 0;
      let totalTax = 0;
      let cgstTotal = 0;
      let sgstTotal = 0;
      let igstTotal = 0;
      
      grnDetail.grn_line_items?.forEach((item: any) => {
        if (yPosition > 250) {
          pdf.addPage();
          yPosition = 20;
        }

        const accQty = item.accepted_quantity || 0;
        const unitPrice = item.unit_price || 0;
        const lineSubtotal = accQty * unitPrice;
        const lineTaxRate = (item.cgst_rate || 0) + (item.sgst_rate || 0) + (item.igst_rate || 0);
        const lineTax = item.total_tax_amount ?? (lineSubtotal * lineTaxRate) / 100;
        const lineTotal = item.line_total ?? (lineSubtotal + lineTax);
        
        subtotal += lineSubtotal;
        totalTax += Number(lineTax);

        xPos = 20;
        const rowData = [
          item.product_name.substring(0, 12),
          item.accepted_quantity.toString(),
          `₹${item.unit_price.toFixed(2)}`,
          `₹${lineSubtotal.toFixed(2)}`,
          `${lineTaxRate}%`,
          `₹${lineTax.toFixed(2)}`,
          `₹${lineTotal.toFixed(2)}`
        ];

        rowData.forEach((data, index) => {
          pdf.text(data, xPos, yPosition);
          xPos += colWidths[index];
        });
        yPosition += 7;
      });

      // Summary with GST breakdown
      yPosition += 15;
      pdf.setFont('helvetica', 'bold');
      pdf.text('QUANTITY SUMMARY:', 20, yPosition);
      yPosition += 10;

      pdf.setFont('helvetica', 'normal');
      pdf.text(`Total Ordered: ${grnDetail.total_ordered_quantity}`, 20, yPosition);
      pdf.text(`Total Received: ${grnDetail.total_received_quantity}`, 80, yPosition);
      yPosition += 7;
      pdf.text(`Total Accepted: ${grnDetail.total_accepted_quantity}`, 20, yPosition);
      pdf.text(`Total Rejected: ${grnDetail.total_rejected_quantity}`, 80, yPosition);
      yPosition += 15;
      
      pdf.setFont('helvetica', 'bold');
      pdf.text('FINANCIAL SUMMARY:', 20, yPosition);
      yPosition += 10;
      
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Taxable Amount: ₹${subtotal.toFixed(2)}`, 20, yPosition);
      yPosition += 7;
      pdf.text(`CGST Amount: ₹${cgstTotal.toFixed(2)}`, 20, yPosition);
      yPosition += 7;
      pdf.text(`SGST Amount: ₹${sgstTotal.toFixed(2)}`, 20, yPosition);
      yPosition += 7;
      pdf.text(`IGST Amount: ₹${igstTotal.toFixed(2)}`, 20, yPosition);
      yPosition += 7;
      pdf.text(`Total Tax Amount: ₹${totalTax.toFixed(2)}`, 20, yPosition);
      yPosition += 10;
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Total Amount (Including Tax): ₹${(subtotal + totalTax).toFixed(2)}`, 20, yPosition);

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
          <div className="text-center py-8">
            <p className="text-muted-foreground">
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
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead 
                      className="font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('grn_number')}
                    >
                      <div className="flex items-center gap-2">
                        GRN Number
                        {getSortIcon('grn_number')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('grn_date')}
                    >
                      <div className="flex items-center gap-2">
                        GRN Date
                        {getSortIcon('grn_date')}
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700">PO Number</TableHead>
                    <TableHead 
                      className="font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('supplier_name')}
                    >
                      <div className="flex items-center gap-2">
                        Supplier
                        {getSortIcon('supplier_name')}
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700">Supplier Invoice</TableHead>
                    <TableHead 
                      className="font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center gap-2">
                        Status
                        {getSortIcon('status')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors text-right"
                      onClick={() => handleSort('total_amount')}
                    >
                      <div className="flex items-center gap-2 justify-end">
                        Total Amount
                        {getSortIcon('total_amount')}
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-muted-foreground text-center min-w-[200px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentGRNs.map((grn) => (
                    <TableRow key={grn.id} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="font-medium text-blue-600">{grn.grn_number}</TableCell>
                      <TableCell>{format(new Date(grn.grn_date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>
                        <div className="inline-flex items-center px-3 py-1.5 rounded-md bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 hover:from-blue-100 hover:to-blue-150 transition-all duration-200 max-w-fit">
                          <span className="text-sm font-semibold text-blue-800 whitespace-nowrap">
                            PO-{grn.purchase_order_id}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{grn.supplier_name}</TableCell>
                      <TableCell className="text-muted-foreground">{grn.supplier_invoice_number || '-'}</TableCell>
                      <TableCell>{getStatusBadge(grn.status)}</TableCell>
                      <TableCell className="text-right font-semibold">₹{grn.total_amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 justify-center flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onView(grn)}
                            className="h-8 w-8 p-0 border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 text-blue-700 transition-all duration-200"
                            title="View GRN Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEdit(grn)}
                            className="h-8 w-8 p-0 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-300 text-emerald-700 transition-all duration-200"
                            title="Edit GRN"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onDelete(grn.id)}
                            className="h-8 w-8 p-0 border-red-200 bg-red-50 hover:bg-red-100 hover:border-red-300 text-red-700 transition-all duration-200"
                            title="Delete GRN"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => exportToExcel(grn)}
                            className="h-8 w-8 p-0 border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-300 text-green-700 transition-all duration-200"
                            title="Export to Excel Spreadsheet"
                          >
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => exportToPDF(grn)}
                            className="h-8 w-8 p-0 border-purple-200 bg-purple-50 hover:bg-purple-100 hover:border-purple-300 text-purple-700 transition-all duration-200"
                            title="Export to PDF Document"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-6 border-t bg-gray-50">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredGRNs.length)} of {filteredGRNs.length} results
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="hover:bg-gray-200"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className={currentPage === page ? "bg-blue-600 hover:bg-blue-700" : "hover:bg-gray-200"}
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
                    className="hover:bg-gray-200"
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