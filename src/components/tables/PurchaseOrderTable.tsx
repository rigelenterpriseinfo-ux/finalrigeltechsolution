import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { 
  Eye, 
  Edit, 
  Trash2, 
  Download, 
  FileSpreadsheet, 
  FileText,
  ChevronLeft, 
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

interface PurchaseOrder {
  id: string;
  po_number: string;
  status: string;
  order_date: string;
  expected_date?: string;
  total_amount: number;
  currency: string;
  supplier: {
    name: string;
  };
  created_at: string;
  notes?: string;
}

interface PurchaseOrderTableProps {
  purchaseOrders: PurchaseOrder[];
  onView: (po: PurchaseOrder) => void;
  onEdit: (po: PurchaseOrder) => void;
  onDelete: (poId: string) => void;
  loading?: boolean;
}

type SortField = 'po_number' | 'supplier_name' | 'order_date' | 'total_amount' | 'status';
type SortDirection = 'asc' | 'desc';

export function PurchaseOrderTable({
  purchaseOrders,
  onView,
  onEdit,
  onDelete,
  loading = false
}: PurchaseOrderTableProps) {
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('order_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  const itemsPerPage = 5;

  // Filter and sort data
  const filteredOrders = purchaseOrders.filter(order =>
    order.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    let aValue: any, bValue: any;
    
    switch (sortField) {
      case 'po_number':
        aValue = a.po_number;
        bValue = b.po_number;
        break;
      case 'supplier_name':
        aValue = a.supplier.name;
        bValue = b.supplier.name;
        break;
      case 'order_date':
        aValue = new Date(a.order_date);
        bValue = new Date(b.order_date);
        break;
      case 'total_amount':
        aValue = a.total_amount;
        bValue = b.total_amount;
        break;
      case 'status':
        aValue = a.status;
        bValue = b.status;
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
    switch (status.toLowerCase()) {
      case 'draft':
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
      case 'open':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
      case 'confirmed':
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'partially_received':
        return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
      case 'closed':
        return 'bg-purple-100 text-purple-800 hover:bg-purple-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 hover:bg-red-200';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };

  const exportToExcel = (order: PurchaseOrder) => {
    try {
      const exportData = [{
        'PO Number': order.po_number,
        'Supplier': order.supplier.name,
        'Order Date': order.order_date,
        'Expected Date': order.expected_date || 'N/A',
        'Status': order.status,
        'Total Amount': order.total_amount,
        'Currency': order.currency,
        'Notes': order.notes || 'N/A'
      }];

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Purchase Order');

      // Auto-size columns
      const colWidths = Object.keys(exportData[0]).map(key => ({
        wch: Math.max(key.length, String(exportData[0][key as keyof typeof exportData[0]]).length) + 2
      }));
      ws['!cols'] = colWidths;

      XLSX.writeFile(wb, `PO_${order.po_number}.xlsx`);
      
      toast({
        title: "Export Successful",
        description: `Purchase Order ${order.po_number} exported to Excel`,
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

  const exportToPDF = (order: PurchaseOrder) => {
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(20);
      doc.setTextColor(40);
      doc.text('Purchase Order', 20, 20);
      
      // PO Details
      doc.setFontSize(12);
      doc.setTextColor(100);
      
      const details = [
        `PO Number: ${order.po_number}`,
        `Supplier: ${order.supplier.name}`,
        `Order Date: ${order.order_date}`,
        `Expected Date: ${order.expected_date || 'N/A'}`,
        `Status: ${order.status}`,
        `Total Amount: ${order.currency} ${order.total_amount.toLocaleString()}`,
        `Notes: ${order.notes || 'N/A'}`
      ];
      
      let yPosition = 40;
      details.forEach(detail => {
        doc.text(detail, 20, yPosition);
        yPosition += 10;
      });
      
      // Footer
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, 280);
      
      doc.save(`PO_${order.po_number}.pdf`);
      
      toast({
        title: "Export Successful",
        description: `Purchase Order ${order.po_number} exported to PDF`,
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

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        {/* Search and Controls */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-blue-100">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by PO number, supplier, or status..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-white"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Select value={`${sortField}-${sortDirection}`} onValueChange={(value) => {
                const [field, direction] = value.split('-') as [SortField, SortDirection];
                setSortField(field);
                setSortDirection(direction);
              }}>
                <SelectTrigger className="w-48 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="po_number-asc">PO Number (A-Z)</SelectItem>
                  <SelectItem value="po_number-desc">PO Number (Z-A)</SelectItem>
                  <SelectItem value="supplier_name-asc">Supplier (A-Z)</SelectItem>
                  <SelectItem value="supplier_name-desc">Supplier (Z-A)</SelectItem>
                  <SelectItem value="order_date-desc">Date (Newest)</SelectItem>
                  <SelectItem value="order_date-asc">Date (Oldest)</SelectItem>
                  <SelectItem value="total_amount-desc">Amount (High-Low)</SelectItem>
                  <SelectItem value="total_amount-asc">Amount (Low-High)</SelectItem>
                  <SelectItem value="status-asc">Status (A-Z)</SelectItem>
                  <SelectItem value="status-desc">Status (Z-A)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex justify-between items-center mt-4 text-sm text-muted-foreground">
            <span>
              Showing {currentOrders.length} of {filteredOrders.length} purchase orders
            </span>
            <span>
              Page {currentPage} of {totalPages}
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead 
                  className="font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('po_number')}
                >
                  <div className="flex items-center gap-2">
                    PO Number
                    {getSortIcon('po_number')}
                  </div>
                </TableHead>
                <TableHead 
                  className="font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('supplier_name')}
                >
                  <div className="flex items-center gap-2">
                    Supplier
                    {getSortIcon('supplier_name')}
                  </div>
                </TableHead>
                <TableHead 
                  className="font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('order_date')}
                >
                  <div className="flex items-center gap-2">
                    Order Date
                    {getSortIcon('order_date')}
                  </div>
                </TableHead>
                <TableHead 
                  className="font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('total_amount')}
                >
                  <div className="flex items-center gap-2">
                    Total Amount
                    {getSortIcon('total_amount')}
                  </div>
                </TableHead>
                <TableHead 
                  className="font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-2">
                    Status
                    {getSortIcon('status')}
                  </div>
                </TableHead>
                <TableHead className="font-semibold text-gray-700 text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? 'No purchase orders found matching your search.' : 'No purchase orders found.'}
                  </TableCell>
                </TableRow>
              ) : (
                currentOrders.map((order) => (
                  <TableRow key={order.id} className="hover:bg-gray-50 transition-colors">
                    <TableCell className="font-medium text-blue-600">
                      {order.po_number}
                    </TableCell>
                    <TableCell className="font-medium">
                      {order.supplier.name}
                    </TableCell>
                    <TableCell>
                      {new Date(order.order_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {order.currency} {order.total_amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary" 
                        className={getStatusColor(order.status)}
                      >
                        {order.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 justify-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onView(order)}
                          className="hover:bg-blue-100 hover:text-blue-700"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(order)}
                          className="hover:bg-green-100 hover:text-green-700"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(order.id)}
                          className="hover:bg-red-100 hover:text-red-700"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => exportToExcel(order)}
                          className="hover:bg-emerald-100 hover:text-emerald-700"
                          title="Export to Excel"
                        >
                          <FileSpreadsheet className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => exportToPDF(order)}
                          className="hover:bg-orange-100 hover:text-orange-700"
                          title="Export to PDF"
                        >
                          <FileText className="h-4 w-4" />
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
          <div className="flex items-center justify-between p-6 border-t bg-gray-50">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredOrders.length)} of {filteredOrders.length} results
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
      </CardContent>
    </Card>
  );
}