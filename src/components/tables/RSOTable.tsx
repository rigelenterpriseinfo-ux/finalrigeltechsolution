import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  AlertTriangle,
  Lock
} from 'lucide-react';
import * as XLSX from 'xlsx';
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
  loading = false
}: RSOTableProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const isMobile = useIsMobile();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
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
        loading={loading}
      />
    );
  }

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
    
    return matchesSearch && matchesStatus;
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
        return 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200';
      case 'Confirmed':
        return 'bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200';
    }
  };

  const getCNStatusColor = (rsoId: string) => {
    const hasCreditNote = rsosWithCreditNotes.has(rsoId);
    const cns = creditNotes.filter(cn => cn.rso_id === rsoId);
    
    if (!hasCreditNote) {
      return { color: 'bg-red-100 text-red-700 border border-red-200', text: 'CN Pending' };
    }
    
    const hasConfirmed = cns.some(cn => cn.status === 'Confirmed');
    if (hasConfirmed) {
      return { color: 'bg-green-100 text-green-700 border border-green-200', text: 'CN Processed' };
    }
    
    return { color: 'bg-amber-100 text-amber-700 border border-amber-200', text: 'CN Draft' };
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Return Sales Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Loading return orders...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between flex-wrap gap-4">
            <span>Return Sales Orders</span>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search RSOs..."
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
          </CardTitle>
        </CardHeader>
        <CardContent>
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
                    <TableRow>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleSort('rso_number')}
                      >
                        <div className="flex items-center gap-2">
                          RSO Number
                          {getSortIcon('rso_number')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleSort('rso_date')}
                      >
                        <div className="flex items-center gap-2">
                          RSO Date
                          {getSortIcon('rso_date')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleSort('customer_name')}
                      >
                        <div className="flex items-center gap-2">
                          Customer
                          {getSortIcon('customer_name')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleSort('invoice_number')}
                      >
                        <div className="flex items-center gap-2">
                          Invoice Number
                          {getSortIcon('invoice_number')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleSort('status')}
                      >
                        <div className="flex items-center gap-2">
                          Status
                          {getSortIcon('status')}
                        </div>
                      </TableHead>
                      <TableHead>CN Status</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50 transition-colors text-right"
                        onClick={() => handleSort('total_amount')}
                      >
                        <div className="flex items-center gap-2 justify-end">
                          Amount
                          {getSortIcon('total_amount')}
                        </div>
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentOrders.map((order) => {
                      const cnStatus = getCNStatusColor(order.id);
                      const canDelete = canDeleteRSO(order.id);
                      const canEdit = canEditRSO(order.id);
                      const linkedCNs = rsoLinkedCNs.get(order.id) || [];
                      
                      return (
                        <TableRow key={order.id} className="hover:bg-muted/50 transition-colors">
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
                                    size="sm"
                                    onClick={() => onView(order.id)}
                                    className="hover:bg-primary/10 hover:text-primary transition-colors"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>View RSO</TooltipContent>
                              </Tooltip>

                              {order.status === 'Draft' && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => canEdit ? onEdit(order.id) : undefined}
                                        disabled={!canEdit}
                                        className={canEdit ? "hover:bg-blue-100 hover:text-blue-700 transition-colors" : "opacity-50 cursor-not-allowed"}
                                      >
                                        {!canEdit && <Lock className="h-3 w-3 mr-1" />}
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>{getEditTooltip(order.id)}</TooltipContent>
                                </Tooltip>
                              )}

                              {rsosWithCreditNotes.has(order.id) && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => onViewCreditNotes(order)}
                                      className="hover:bg-blue-100 hover:text-blue-700 transition-colors"
                                    >
                                      <FileText className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    View {linkedCNs.length} Credit Note{linkedCNs.length > 1 ? 's' : ''}
                                  </TooltipContent>
                                </Tooltip>
                              )}

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onExport ? onExport(order) : exportToExcel(order)}
                                    className="hover:bg-green-100 hover:text-green-700 transition-colors"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Export to Excel</TooltipContent>
                              </Tooltip>

                              {order.status === 'Draft' && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteClick(order)}
                                        disabled={!canDelete}
                                        className={canDelete ? "hover:bg-destructive/10 hover:text-destructive transition-colors" : "opacity-50 cursor-not-allowed"}
                                      >
                                        {!canDelete && <Lock className="h-3 w-3 mr-1" />}
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>{getDeleteTooltip(order.id)}</TooltipContent>
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
        </CardContent>
      </Card>

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
