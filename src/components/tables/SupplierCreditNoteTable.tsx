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
import { Edit, Eye, Trash2, Search, FileSpreadsheet, FileText, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useBusinessAuth } from "@/hooks/useBusinessAuth";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

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

  // Export to Excel
  const exportToExcel = () => {
    try {
      const workbook = XLSX.utils.book_new();
      
      // Company Header
      const companyInfo = [
        [`${companyData?.name || 'Company'} - Supplier Credit Notes`],
        [`Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}`],
        [`Total Credit Notes: ${sortedCreditNotes.length}`],
        ['']
      ];

      // Headers
      const headers = [
        ['Credit Note #', 'Date', 'Supplier', 'Reason', 'Amount', 'Status', 'Created']
      ];

      // Data rows
      const dataRows = sortedCreditNotes.map(creditNote => [
        creditNote.supplier_credit_note_number,
        format(new Date(creditNote.supplier_credit_note_date), 'MMM dd, yyyy'),
        creditNote.supplier_name,
        creditNote.reason,
        creditNote.total_amount,
        creditNote.status.charAt(0).toUpperCase() + creditNote.status.slice(1),
        format(new Date(creditNote.created_at), 'MMM dd, yyyy')
      ]);

      const wsData = [...companyInfo, ...headers, ...dataRows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Set column widths
      ws['!cols'] = [
        { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 30 }, 
        { wch: 15 }, { wch: 15 }, { wch: 15 }
      ];

      XLSX.utils.book_append_sheet(workbook, ws, 'Supplier Credit Notes');
      XLSX.writeFile(workbook, `SupplierCreditNotes_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      
      toast({
        title: "Export Successful",
        description: `${sortedCreditNotes.length} credit notes exported to Excel`,
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

  // Export single credit note to PDF
  const exportCreditNoteToPDF = (creditNote: SupplierCreditNote) => {
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(18);
      doc.setTextColor(44, 62, 80);
      doc.text('SUPPLIER CREDIT NOTE', 20, 30);
      
      doc.setFontSize(12);
      doc.setTextColor(108, 117, 125);
      doc.text(`Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}`, 20, 40);
      
      // Company info
      if (companyData) {
        doc.setFontSize(10);
        doc.setTextColor(73, 80, 87);
        doc.text(companyData.name, 20, 55);
        if (companyData.address_line1) doc.text(companyData.address_line1, 20, 65);
      }
      
      // Credit note details
      doc.setFontSize(14);
      doc.setTextColor(44, 62, 80);
      doc.text('Credit Note Details', 20, 85);
      
      doc.setFontSize(10);
      doc.setTextColor(73, 80, 87);
      let yPos = 100;
      
      const details = [
        ['Credit Note #:', creditNote.supplier_credit_note_number],
        ['Date:', format(new Date(creditNote.supplier_credit_note_date), 'MMM dd, yyyy')],
        ['Supplier:', creditNote.supplier_name],
        ['Reason:', creditNote.reason],
        ['Amount:', `₹${creditNote.total_amount.toFixed(2)}`],
        ['Status:', creditNote.status.charAt(0).toUpperCase() + creditNote.status.slice(1)],
        ['Created:', format(new Date(creditNote.created_at), 'MMM dd, yyyy')]
      ];
      
      details.forEach(([label, value]) => {
        doc.setTextColor(44, 62, 80);
        doc.text(label, 20, yPos);
        doc.setTextColor(73, 80, 87);
        doc.text(value, 80, yPos);
        yPos += 12;
      });
      
      doc.save(`SupplierCreditNote_${creditNote.supplier_credit_note_number}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      
      toast({
        title: "PDF Export Successful",
        description: `Credit Note ${creditNote.supplier_credit_note_number} exported to PDF`,
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
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('supplier_credit_note_number')}
                >
                  <div className="flex items-center gap-1">
                    Credit Note #
                    {getSortIcon('supplier_credit_note_number')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('supplier_credit_note_date')}
                >
                  <div className="flex items-center gap-1">
                    Date
                    {getSortIcon('supplier_credit_note_date')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('supplier_name')}
                >
                  <div className="flex items-center gap-1">
                    Supplier
                    {getSortIcon('supplier_name')}
                  </div>
                </TableHead>
                <TableHead>Reason</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('total_amount')}
                >
                  <div className="flex items-center gap-1">
                    Amount
                    {getSortIcon('total_amount')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    Status
                    {getSortIcon('status')}
                  </div>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedCreditNotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="text-muted-foreground">
                      {searchTerm || statusFilter !== 'all' 
                        ? 'No credit notes match your filters'
                        : 'No credit notes found.'
                      }
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedCreditNotes.map((creditNote) => (
                  <TableRow key={creditNote.id} className="hover:bg-muted/50">
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
                      <div className="flex justify-end space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onView(creditNote)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(creditNote)}
                          disabled={!canEdit}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => exportCreditNoteToPDF(creditNote)}
                          title="Export to PDF"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(creditNote)}
                          disabled={!canEdit || creditNotesWithTransactions.has(creditNote.id)}
                          className={`${
                            creditNotesWithTransactions.has(creditNote.id)
                              ? 'text-gray-400 hover:text-gray-400 cursor-not-allowed opacity-50'
                              : 'text-destructive hover:text-destructive'
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
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className="w-8"
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
              >
                Next
                <ChevronRight className="h-4 w-4" />
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