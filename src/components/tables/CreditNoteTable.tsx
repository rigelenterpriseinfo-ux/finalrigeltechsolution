import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  Eye, 
  Edit, 
  Download,
  FileText,
  ChevronLeft, 
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Loader2
} from 'lucide-react';
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
}

type SortField = 'cn_number' | 'cn_date' | 'customer_name' | 'rso_number' | 'status' | 'total_amount';
type SortDirection = 'asc' | 'desc';

export function CreditNoteTable({
  creditNotes,
  onView,
  onEdit,
  onExport,
  loading = false
}: CreditNoteTableProps) {
  const isMobile = useIsMobile();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('cn_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  const itemsPerPage = 5;

  // Mobile view
  if (isMobile) {
    return (
      <CreditNoteTableMobile
        creditNotes={creditNotes}
        onView={onView}
        onEdit={onEdit}
        onExport={onExport}
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
        return 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200';
      case 'Confirmed':
        return 'bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Credit Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Loading credit notes...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between flex-wrap gap-4">
          <span>Credit Notes</span>
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
        </CardTitle>
      </CardHeader>
      <CardContent>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('cn_number')}
                  >
                    <div className="flex items-center gap-2">
                      CN Number
                      {getSortIcon('cn_number')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('cn_date')}
                  >
                    <div className="flex items-center gap-2">
                      CN Date
                      {getSortIcon('cn_date')}
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
                    onClick={() => handleSort('rso_number')}
                  >
                    <div className="flex items-center gap-2">
                      RSO Number
                      {getSortIcon('rso_number')}
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
                {currentNotes.map((note) => (
                  <TableRow key={note.id} className="hover:bg-muted/50">
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
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onView(note.id)}
                          title="View Credit Note"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {note.status === 'Draft' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(note.id)}
                            title="Edit Credit Note"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onExport(note)}
                          title="Export Credit Note"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

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
      </CardContent>
    </Card>
  );
}
