import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  Loader2
} from 'lucide-react';
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
  
  // Track RSOs with credit notes
  const [rsosWithCreditNotes, setRSOsWithCreditNotes] = useState<Set<string>>(new Set());
  
  const itemsPerPage = 5;

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
        loading={loading}
      />
    );
  }

  // Check for RSOs with credit notes
  useEffect(() => {
    const rsosWithCN = new Set<string>();
    creditNotes.forEach(cn => {
      rsosWithCN.add(cn.rso_id);
    });
    setRSOsWithCreditNotes(rsosWithCN);
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('rso_number')}
                  >
                    <div className="flex items-center gap-2">
                      RSO Number
                      {getSortIcon('rso_number')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('rso_date')}
                  >
                    <div className="flex items-center gap-2">
                      RSO Date
                      {getSortIcon('rso_date')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('customer_name')}
                  >
                    <div className="flex items-center gap-2">
                      Customer
                      {getSortIcon('customer_name')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('invoice_number')}
                  >
                    <div className="flex items-center gap-2">
                      Invoice Number
                      {getSortIcon('invoice_number')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-2">
                      Status
                      {getSortIcon('status')}
                    </div>
                  </TableHead>
                  <TableHead>CN Status</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 text-right"
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
                  
                  return (
                    <TableRow key={order.id} className="hover:bg-muted/50">
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
                        <Badge className={cnStatus.color}>
                          {cnStatus.text}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ₹{order.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onView(order.id)}
                            title="View RSO"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {order.status === 'Draft' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEdit(order.id)}
                              title="Edit RSO"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {rsosWithCreditNotes.has(order.id) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onViewCreditNotes(order)}
                              title="View Credit Notes"
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          )}
                          {order.status === 'Draft' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (!canDelete) {
                                  toast({
                                    title: "Cannot Delete",
                                    description: "This RSO has linked credit notes and cannot be deleted",
                                    variant: "destructive"
                                  });
                                  return;
                                }
                                onDelete(order.id);
                              }}
                              disabled={!canDelete}
                              title={canDelete ? "Delete RSO" : "Cannot delete - has credit notes"}
                              className={!canDelete ? 'opacity-50 cursor-not-allowed' : ''}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

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
  );
}
