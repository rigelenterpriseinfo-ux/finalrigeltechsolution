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
import { Eye, Edit, Trash2, FileSpreadsheet, File, ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

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
}

interface DebitNoteTableProps {
  refreshTrigger?: number;
  onView: (debitNote: any) => void;
  onEdit: (debitNote: any) => void;
  onDelete: (debitNoteId: string) => void;
}

export function DebitNoteTable({ refreshTrigger, onView, onEdit, onDelete }: DebitNoteTableProps) {
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

  useEffect(() => {
    if (profile?.company_id) {
      fetchDebitNotes();
      fetchCompanyData();
    }
  }, [profile?.company_id, refreshTrigger]);

  useEffect(() => {
    filterAndSortDebitNotes();
  }, [debitNotes, searchTerm, statusFilter, sortField, sortDirection]);

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
      // Fix database query - remove the relation join since debit_note_items might not exist
      const { data, error } = await supabase
        .from('debit_notes')
        .select('*')
        .eq('company_id', profile?.company_id)
        .order('debit_note_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      setDebitNotes(data || []);
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
        debitNote.reason.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || debitNote.status === statusFilter;
      
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
    return <ArrowUpDown className={`h-4 w-4 ${sortDirection === 'asc' ? 'rotate-180' : ''}`} />;
  };
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { variant: 'secondary' as const, label: 'Draft' },
      confirmed: { variant: 'default' as const, label: 'Confirmed' },
      cancelled: { variant: 'destructive' as const, label: 'Cancelled' },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const exportToExcel = async (debitNote: DebitNote) => {
    try {
      // Fetch detailed debit note data with items
      const { data: debitNoteDetail, error } = await supabase
        .from('debit_notes')
        .select('*')
        .eq('id', debitNote.id)
        .single();

      if (error) throw error;

      // Fetch debit note items separately
      const { data: debitNoteItems, error: itemsError } = await supabase
        .from('debit_note_items')
        .select('*')
        .eq('debit_note_id', debitNote.id);

      if (itemsError) throw itemsError;

      const workbook = XLSX.utils.book_new();
      
      // Header information
      const headerData = [
        ['DEBIT NOTE'],
        [''],
        ['Company:', company?.name || 'N/A'],
        ['Address:', `${company?.address_line1 || ''} ${company?.address_line2 || ''}`],
        ['City:', `${company?.city || ''}, ${company?.state || ''} ${company?.postal_code || ''}`],
        ['Phone:', company?.phone || 'N/A'],
        ['Email:', company?.email || 'N/A'],
        [''],
        ['Debit Note Number:', debitNoteDetail.debit_note_number],
        ['Debit Note Date:', format(new Date(debitNoteDetail.debit_note_date), 'dd/MM/yyyy')],
        ['Supplier:', debitNoteDetail.supplier_name],
        ['Supplier Invoice:', debitNoteDetail.supplier_invoice_number || 'N/A'],
        ['Reason:', debitNoteDetail.reason],
        ['Status:', debitNoteDetail.status],
        [''],
        ['LINE ITEMS:'],
        ['Product Name', 'SKU', 'UOM', 'Quantity', 'Unit Price', 'Subtotal', 'Tax Rate', 'Tax Amount', 'Line Total']
      ];

      // Add line items with GST details
      let subtotal = 0;
      let totalTax = 0;
      let cgstTotal = 0;
      let sgstTotal = 0;
      let igstTotal = 0;
      
      debitNoteItems?.forEach((item: any) => {
        const qty = item.quantity || 0;
        const unitPrice = item.unit_price || 0;
        const lineSubtotal = qty * unitPrice;
        const lineTaxRate = (item.cgst_rate || 0) + (item.sgst_rate || 0) + (item.igst_rate || 0);
        const lineTax = item.tax_amount ?? (lineSubtotal * lineTaxRate) / 100;
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
          item.quantity,
          `₹${unitPrice.toFixed(2)}`,
          `₹${lineSubtotal.toFixed(2)}`,
          `${lineTaxRate}%`,
          `₹${Number(lineTax).toFixed(2)}`,
          `₹${Number(lineTotal).toFixed(2)}`
        ]);
      });

      // Add totals with GST breakdown
      headerData.push(
        [''],
        ['FINANCIAL SUMMARY:'],
        ['Subtotal Amount:', `₹${subtotal.toFixed(2)}`],
        ['CGST Amount:', `₹${cgstTotal.toFixed(2)}`],
        ['SGST Amount:', `₹${sgstTotal.toFixed(2)}`],
        ['IGST Amount:', `₹${igstTotal.toFixed(2)}`],
        ['Total Tax Amount:', `₹${totalTax.toFixed(2)}`],
        ['Total Amount:', `₹${(subtotal + totalTax).toFixed(2)}`]
      );

      const worksheet = XLSX.utils.aoa_to_sheet(headerData);
      
      // Set column widths
      const colWidths = [
        { wch: 25 }, { wch: 15 }, { wch: 8 }, { wch: 12 }, 
        { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, 
        { wch: 15 }
      ];
      worksheet['!cols'] = colWidths;

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

  const exportToPDF = async (debitNote: DebitNote) => {
    try {
      // Fetch detailed debit note data with items
      const { data: debitNoteDetail, error } = await supabase
        .from('debit_notes')
        .select('*')
        .eq('id', debitNote.id)
        .single();

      if (error) throw error;

      // Fetch debit note items separately
      const { data: debitNoteItems, error: itemsError } = await supabase
        .from('debit_note_items')
        .select('*')
        .eq('debit_note_id', debitNote.id);

      if (itemsError) throw itemsError;

      const pdf = new jsPDF();
      let yPosition = 20;

      // Header
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('DEBIT NOTE', 20, yPosition);
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

      // Debit Note Details
      pdf.setFont('helvetica', 'bold');
      pdf.text('DEBIT NOTE DETAILS:', 20, yPosition);
      yPosition += 10;
      
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Debit Note Number: ${debitNoteDetail.debit_note_number}`, 20, yPosition);
      pdf.text(`Date: ${format(new Date(debitNoteDetail.debit_note_date), 'dd/MM/yyyy')}`, 120, yPosition);
      yPosition += 7;
      pdf.text(`Supplier: ${debitNoteDetail.supplier_name}`, 20, yPosition);
      yPosition += 7;
      pdf.text(`Status: ${debitNoteDetail.status}`, 20, yPosition);
      yPosition += 7;
      pdf.text(`Reason: ${debitNoteDetail.reason}`, 20, yPosition);
      yPosition += 15;

      // Table Header
      pdf.setFont('helvetica', 'bold');
      pdf.text('LINE ITEMS:', 20, yPosition);
      yPosition += 10;

      // Table headers with GST
      const headers = ['Product', 'Qty', 'Unit Price', 'Subtotal', 'Tax%', 'Tax Amt', 'Total'];
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
      
      debitNoteItems?.forEach((item: any) => {
        if (yPosition > 250) {
          pdf.addPage();
          yPosition = 20;
        }

        const qty = item.quantity || 0;
        const unitPrice = item.unit_price || 0;
        const lineSubtotal = qty * unitPrice;
        const lineTaxRate = (item.cgst_rate || 0) + (item.sgst_rate || 0) + (item.igst_rate || 0);
        const lineTax = item.tax_amount ?? (lineSubtotal * lineTaxRate) / 100;
        const lineTotal = item.line_total ?? (lineSubtotal + lineTax);
        
        subtotal += lineSubtotal;
        totalTax += Number(lineTax);

        xPos = 20;
        const rowData = [
          item.product_name.substring(0, 12),
          item.quantity.toString(),
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

      // Summary
      yPosition += 15;
      pdf.setFont('helvetica', 'bold');
      pdf.text('FINANCIAL SUMMARY:', 20, yPosition);
      yPosition += 10;
      
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Subtotal Amount: ₹${subtotal.toFixed(2)}`, 20, yPosition);
      yPosition += 7;
      pdf.text(`Total Tax Amount: ₹${totalTax.toFixed(2)}`, 20, yPosition);
      yPosition += 10;
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Total Amount: ₹${(subtotal + totalTax).toFixed(2)}`, 20, yPosition);

      pdf.save(`DebitNote_${debitNoteDetail.debit_note_number}.pdf`);

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
      <CardHeader>
        <CardTitle>Debit Note Management</CardTitle>
        <CardDescription>
          Manage debit notes for purchase returns and adjustments
        </CardDescription>
        
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by debit note number, supplier, reason..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

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
                  <TableRow>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('debit_note_number')}>
                      <div className="flex items-center space-x-1">
                        <span>Debit Note #</span>
                        {getSortIcon('debit_note_number')}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('debit_note_date')}>
                      <div className="flex items-center space-x-1">
                        <span>Date</span>
                        {getSortIcon('debit_note_date')}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('supplier_name')}>
                      <div className="flex items-center space-x-1">
                        <span>Supplier</span>
                        {getSortIcon('supplier_name')}
                      </div>
                    </TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('total_amount')}>
                      <div className="flex items-center space-x-1">
                        <span>Amount</span>
                        {getSortIcon('total_amount')}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('status')}>
                      <div className="flex items-center space-x-1">
                        <span>Status</span>
                        {getSortIcon('status')}
                      </div>
                    </TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentDebitNotes.map((debitNote) => (
                    <TableRow key={debitNote.id}>
                      <TableCell className="font-medium">
                        {debitNote.debit_note_number}
                      </TableCell>
                      <TableCell>
                        {format(new Date(debitNote.debit_note_date), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>{debitNote.supplier_name}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {debitNote.reason}
                      </TableCell>
                      <TableCell className="font-medium">
                        ₹{debitNote.total_amount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(debitNote.status)}
                      </TableCell>
                      <TableCell>
                        {format(new Date(debitNote.created_at), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onView(debitNote)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            title="View Debit Note"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(debitNote)}
                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            title="Edit Debit Note"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDelete(debitNote.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Delete Debit Note"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => exportToExcel(debitNote)}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            title="Export to Excel"
                          >
                            <FileSpreadsheet className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => exportToPDF(debitNote)}
                            className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                            title="Export to PDF"
                          >
                            <File className="h-4 w-4" />
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
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredDebitNotes.length)} of {filteredDebitNotes.length} debit notes
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="text-sm">
                    Page {currentPage} of {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
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
}