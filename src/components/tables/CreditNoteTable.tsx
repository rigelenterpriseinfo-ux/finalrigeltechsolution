import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PowerBICard } from '@/components/ui/powerbi-card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { 
  Eye, 
  Edit, 
  Download,
  FileText,
  FileSpreadsheet,
  ChevronLeft, 
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Loader2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { CreditNoteTableMobile } from './CreditNoteTableMobile';

interface CreditNote {
  id: string;
  cn_number: string;
  cn_date: string;
  customer_name: string;
  rso_number: string;
  status: 'Draft' | 'Confirmed';
  total_amount: number;
}

interface CreditNoteTableProps {
  creditNotes: CreditNote[];
  onView: (cnId: string) => void;
  onEdit: (cnId: string) => void;
  onExport: (cn: CreditNote) => void;
  loading?: boolean;
  isActive?: boolean;
}

type SortField = 'cn_number' | 'cn_date' | 'customer_name' | 'rso_number' | 'status' | 'total_amount';
type SortDirection = 'asc' | 'desc';

export function CreditNoteTable({
  creditNotes,
  onView,
  onEdit,
  onExport,
  loading = false,
  isActive = false
}: CreditNoteTableProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const isMobile = useIsMobile();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('cn_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [companyData, setCompanyData] = useState<any>(null);
  
  const itemsPerPage = 5;

  // Fetch company data
  React.useEffect(() => {
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

  const exportToExcel = async (note: CreditNote) => {
    try {
      // Fetch complete credit note details
      const { data: fullCN, error: cnError } = await supabase
        .from('credit_notes')
        .select('*')
        .eq('id', note.id)
        .single();

      if (cnError || !fullCN) {
        toast({
          title: "Error",
          description: "Failed to fetch credit note details",
          variant: "destructive",
        });
        return;
      }

      // Fetch credit note line items
      const { data: cnItems, error: itemsError } = await supabase
        .from('credit_note_items')
        .select('*')
        .eq('credit_note_id', note.id)
        .order('created_at', { ascending: true });

      if (itemsError) {
        toast({
          title: "Error",
          description: "Failed to fetch credit note items",
          variant: "destructive",
        });
        return;
      }

      // Company Header
      const companyInfo = [
        ['CREDIT NOTE'],
        [''],
        [`Company: ${companyData?.name || 'Your Company Name'}`],
        [companyData?.address_line1 || 'Address Line 1'],
        [`${companyData?.city || 'City'}, ${companyData?.state || 'State'} - ${companyData?.postal_code || 'PIN'}`],
        [`GSTIN: ${companyData?.gstn || 'N/A'} | Phone: ${companyData?.phone || 'N/A'}`],
        [`Email: ${companyData?.email || 'company@example.com'}`],
        ['']
      ];

      // Credit Note Header Details
      const cnHeader = [
        ['CN Number:', fullCN.cn_number, '', 'Date:', new Date(fullCN.cn_date).toLocaleDateString('en-IN')],
        ['RSO Reference:', note.rso_number, '', 'Status:', fullCN.status],
        [''],
      ];

      // Customer Details
      const customerDetails = [
        ['CUSTOMER DETAILS'],
        [fullCN.customer_name],
        [''],
      ];

      // Line Items Header
      const lineItemsHeader = [
        ['LINE ITEMS'],
        ['S.No', 'Item Code', 'Description', 'HSN', 'Return Qty', 'Rate', 'Disc%', 'Disc Amt', 'CGST%', 'SGST%', 'IGST%', 'Tax Amt', 'Amount']
      ];

      // Map credit note items
      const lineItems = (cnItems || []).map((item: any, index: number) => {
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
        ['', '', '', '', '', '', '', '', '', '', 'Subtotal:', `₹ ${Math.round(fullCN.subtotal_amount || 0).toLocaleString('en-IN')}`],
        ['', '', '', '', '', '', '', '', '', '', 'Tax:', `₹ ${Math.round(fullCN.tax_amount || 0).toLocaleString('en-IN')}`],
        ['', '', '', '', '', '', '', '', '', '', 'Total:', `₹ ${Math.round(fullCN.total_amount || 0).toLocaleString('en-IN')}`],
        ['', '', '', '', '', '', '', '', '', '', 'Amount in words:', convertNumberToWords(fullCN.total_amount || 0)]
      ];

      // Terms and Notes
      const termsSection = [
        [''],
        ['TERMS & CONDITIONS'],
        ['1. This credit note is issued against returned goods as per RSO.'],
        ['2. The credit amount will be adjusted against future invoices or refunded as per terms.'],
        ['3. Please retain this credit note for your records.'],
        ['']
      ];

      if (fullCN.notes) {
        termsSection.push(['Notes:', fullCN.notes]);
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
        ...cnHeader,
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

      XLSX.utils.book_append_sheet(wb, ws, 'Credit Note');
      XLSX.writeFile(wb, `CN_${fullCN.cn_number}_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      toast({
        title: "Excel Export Successful",
        description: `Credit Note ${fullCN.cn_number} has been exported`,
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

  // Mobile view
  if (isMobile) {
    return (
      <CreditNoteTableMobile
        creditNotes={creditNotes}
        onView={onView}
        onEdit={onEdit}
        onExport={exportToExcel}
        loading={loading}
      />
    );
  }

  // Filter and sort data
  const filteredNotes = creditNotes.filter(note => {
    const matchesSearch = 
      note.cn_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.rso_number.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || note.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    let aValue: any, bValue: any;
    
    switch (sortField) {
      case 'cn_number':
        aValue = a.cn_number;
        bValue = b.cn_number;
        break;
      case 'cn_date':
        aValue = new Date(a.cn_date);
        bValue = new Date(b.cn_date);
        break;
      case 'customer_name':
        aValue = a.customer_name;
        bValue = b.customer_name;
        break;
      case 'rso_number':
        aValue = a.rso_number;
        bValue = b.rso_number;
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
  const totalPages = Math.ceil(sortedNotes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentNotes = sortedNotes.slice(startIndex, endIndex);

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

  // Export all credit notes to Excel
  const exportAllToExcel = () => {
    try {
      const dataToExport = filteredNotes.map((note, index) => ({
        'S.No': index + 1,
        'CN Number': note.cn_number,
        'CN Date': new Date(note.cn_date).toLocaleDateString('en-IN'),
        'Customer Name': note.customer_name,
        'RSO Number': note.rso_number,
        'Status': note.status,
        'Amount': note.total_amount.toFixed(2)
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Credit Notes');
      XLSX.writeFile(wb, `Credit-Notes-${new Date().toISOString().split('T')[0]}.xlsx`);

      toast({
        title: "Success",
        description: `Exported ${filteredNotes.length} credit notes to Excel`,
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Error",
        description: "Failed to export credit notes",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <PowerBICard title="Credit Notes">
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading credit notes...</span>
        </div>
      </PowerBICard>
    );
  }

  return (
    <PowerBICard 
      title="Credit Notes"
      className={cn("transition-all duration-200", isActive && "ring-2 ring-primary")}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search credit notes..."
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
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Confirmed">Confirmed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={exportAllToExcel}
            className="gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export to Excel
          </Button>
        </div>
        
        <div>
        {currentNotes.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-lg">No credit notes found</p>
            <p className="text-sm text-muted-foreground mt-2">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your filters' 
                : 'Create your first credit note to get started'}
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
                        onClick={() => handleSort('cn_number')}
                      >
                        <div className="flex items-center gap-2">
                          CN Number
                          <span className="text-gray-400">{getSortIcon('cn_number')}</span>
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50 transition-colors text-gray-700"
                        onClick={() => handleSort('cn_date')}
                      >
                        <div className="flex items-center gap-2">
                          CN Date
                          <span className="text-gray-400">{getSortIcon('cn_date')}</span>
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
                        onClick={() => handleSort('rso_number')}
                      >
                        <div className="flex items-center gap-2">
                          RSO Number
                          <span className="text-gray-400">{getSortIcon('rso_number')}</span>
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
                    {currentNotes.map((note) => {
                      const canEdit = note.status === 'Draft';
                      
                      return (
                      <TableRow key={note.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                        <TableCell className="font-medium">{note.cn_number}</TableCell>
                        <TableCell>{new Date(note.cn_date).toLocaleDateString()}</TableCell>
                        <TableCell>{note.customer_name}</TableCell>
                        <TableCell>{note.rso_number}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(note.status)}>
                            {note.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ₹{note.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => onView(note.id)}
                                  className="h-8 w-8 text-gray-600 hover:text-primary hover:bg-gray-100 transition-colors"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-sm">View Credit Note</p>
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => canEdit ? onEdit(note.id) : undefined}
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
                                <p className="text-sm">
                                  {canEdit ? 'Edit Credit Note' : 'Cannot edit confirmed credit note'}
                                </p>
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => exportToExcel(note)}
                                  className="h-8 w-8 text-gray-600 hover:text-green-600 hover:bg-green-50 transition-colors"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-sm">Export to Excel</p>
                              </TooltipContent>
                            </Tooltip>
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
                  Showing {startIndex + 1} to {Math.min(endIndex, sortedNotes.length)} of {sortedNotes.length} entries
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
  );
}
