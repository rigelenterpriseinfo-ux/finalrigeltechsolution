import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, Edit, Trash2, Search, Plus, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, FileSpreadsheet, FileText } from 'lucide-react';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { format } from 'date-fns';

interface Supplier {
  id: string;
  supplier_ref?: string;
  name: string;
  supplier_type?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  website?: string;
  city?: string;
  state?: string;
  country?: string;
  gst_number?: string;
  preferred_currency?: string;
  payment_terms?: string;
  is_active: boolean;
  created_at: string;
}

interface SupplierTableProps {
  suppliers: Supplier[];
  onView: (supplier: Supplier) => void;
  onEdit: (supplier: Supplier) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
  loading?: boolean;
}

type SortField = 'name' | 'supplier_ref' | 'supplier_type' | 'email' | 'created_at';
type SortDirection = 'asc' | 'desc';

export const SupplierTable: React.FC<SupplierTableProps> = ({
  suppliers,
  onView,
  onEdit,
  onDelete,
  onCreate,
  loading = false,
}) => {
  const { hasEditAccess } = useBusinessAuth();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'Manufacturer' | 'Distributor' | 'Service Provider' | 'Other'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [companyData, setCompanyData] = useState<any>(null);
  const itemsPerPage = 5;
  
  const canEdit = hasEditAccess('purchase');

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

  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSearch = !searchTerm || 
      supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.supplier_ref?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.gst_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && supplier.is_active) ||
      (statusFilter === 'inactive' && !supplier.is_active);
    
    const matchesType = typeFilter === 'all' || supplier.supplier_type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  // Sort suppliers
  const sortedSuppliers = [...filteredSuppliers].sort((a, b) => {
    let aValue: any, bValue: any;
    
    switch (sortField) {
      case 'name':
        aValue = a.name;
        bValue = b.name;
        break;
      case 'supplier_ref':
        aValue = a.supplier_ref || '';
        bValue = b.supplier_ref || '';
        break;
      case 'supplier_type':
        aValue = a.supplier_type || '';
        bValue = b.supplier_type || '';
        break;
      case 'email':
        aValue = a.email || '';
        bValue = b.email || '';
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

  // Pagination calculations
  const totalPages = Math.ceil(sortedSuppliers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSuppliers = sortedSuppliers.slice(startIndex, startIndex + itemsPerPage);

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

  // Export to Excel
  const exportToExcel = () => {
    try {
      const workbook = XLSX.utils.book_new();
      
      // Company Header
      const companyInfo = [
        [`${companyData?.name || 'Company'} - Suppliers List`],
        [`Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}`],
        [`Total Suppliers: ${sortedSuppliers.length}`],
        ['']
      ];

      // Headers
      const headers = [
        ['Supplier ID', 'Name', 'Type', 'Contact Person', 'Email', 'Phone', 'GST Number', 'City', 'State', 'Country', 'Currency', 'Payment Terms', 'Status', 'Created Date']
      ];

      // Data rows
      const dataRows = sortedSuppliers.map(supplier => [
        supplier.supplier_ref || 'Auto-generated',
        supplier.name,
        supplier.supplier_type || 'Not specified',
        supplier.contact_person || '',
        supplier.email || '',
        supplier.phone || '',
        supplier.gst_number || '',
        supplier.city || '',
        supplier.state || '',
        supplier.country || '',
        supplier.preferred_currency || 'INR',
        supplier.payment_terms || '',
        supplier.is_active ? 'Active' : 'Inactive',
        format(new Date(supplier.created_at), 'MMM dd, yyyy')
      ]);

      const wsData = [...companyInfo, ...headers, ...dataRows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Set column widths
      ws['!cols'] = [
        { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 25 }, 
        { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
        { wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 15 }
      ];

      XLSX.utils.book_append_sheet(workbook, ws, 'Suppliers');
      XLSX.writeFile(workbook, `Suppliers_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      
      toast({
        title: "Export Successful",
        description: `${sortedSuppliers.length} suppliers exported to Excel`,
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

  // Export single supplier to PDF
  const exportSupplierToPDF = (supplier: Supplier) => {
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(18);
      doc.setTextColor(44, 62, 80);
      doc.text('SUPPLIER DETAILS', 20, 30);
      
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
      
      // Supplier details
      doc.setFontSize(14);
      doc.setTextColor(44, 62, 80);
      doc.text('Supplier Information', 20, 85);
      
      doc.setFontSize(10);
      doc.setTextColor(73, 80, 87);
      let yPos = 100;
      
      const details = [
        ['Supplier ID:', supplier.supplier_ref || 'Auto-generated'],
        ['Name:', supplier.name],
        ['Type:', supplier.supplier_type || 'Not specified'],
        ['Contact Person:', supplier.contact_person || 'N/A'],
        ['Email:', supplier.email || 'N/A'],
        ['Phone:', supplier.phone || 'N/A'],
        ['Website:', supplier.website || 'N/A'],
        ['GST Number:', supplier.gst_number || 'N/A'],
        ['Address:', [supplier.city, supplier.state, supplier.country].filter(Boolean).join(', ') || 'N/A'],
        ['Currency:', supplier.preferred_currency || 'INR'],
        ['Payment Terms:', supplier.payment_terms || 'Not specified'],
        ['Status:', supplier.is_active ? 'Active' : 'Inactive'],
        ['Created Date:', format(new Date(supplier.created_at), 'MMM dd, yyyy')]
      ];
      
      details.forEach(([label, value]) => {
        doc.setTextColor(44, 62, 80);
        doc.text(label, 20, yPos);
        doc.setTextColor(73, 80, 87);
        doc.text(value, 80, yPos);
        yPos += 12;
      });
      
      doc.save(`Supplier_${supplier.supplier_ref || supplier.name}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      
      toast({
        title: "PDF Export Successful",
        description: `Supplier ${supplier.name} exported to PDF`,
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
  }, [searchTerm, statusFilter, typeFilter, sortField, sortDirection]);

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

  return (
    <Card>
      <CardContent>
        {/* Search and Export Controls */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search by supplier name or GST number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToExcel}
              className="flex items-center gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export Excel
            </Button>
          </div>
          
          <div className="flex gap-4">
            <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(value: any) => setTypeFilter(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Manufacturer">Manufacturer</SelectItem>
                <SelectItem value="Distributor">Distributor</SelectItem>
                <SelectItem value="Service Provider">Service Provider</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('supplier_ref')}
                >
                  <div className="flex items-center gap-1">
                    Supplier ID
                    {getSortIcon('supplier_ref')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Name
                    {getSortIcon('name')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('supplier_type')}
                >
                  <div className="flex items-center gap-1">
                    Type
                    {getSortIcon('supplier_type')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('email')}
                >
                  <div className="flex items-center gap-1">
                    Contact
                    {getSortIcon('email')}
                  </div>
                </TableHead>
                <TableHead>City</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Payment Terms</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedSuppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <div className="text-muted-foreground">
                      {searchTerm || statusFilter !== 'all' || typeFilter !== 'all' 
                        ? 'No suppliers match your filters'
                        : 'No suppliers found. Add your first supplier to get started.'
                      }
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedSuppliers.map((supplier) => (
                  <TableRow key={supplier.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <div className="font-mono text-sm">
                        {supplier.supplier_ref || 'Auto-generated'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{supplier.name}</div>
                        {supplier.contact_person && (
                          <div className="text-sm text-muted-foreground">
                            Contact: {supplier.contact_person}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {supplier.supplier_type || 'Not specified'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {supplier.email && (
                          <div className="text-sm">{supplier.email}</div>
                        )}
                        {supplier.phone && (
                          <div className="text-sm text-muted-foreground">{supplier.phone}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {[supplier.city, supplier.state, supplier.country]
                          .filter(Boolean)
                          .join(', ') || 'Not specified'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {supplier.preferred_currency || 'INR'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {supplier.payment_terms || 'Not specified'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={supplier.is_active ? "default" : "secondary"}>
                        {supplier.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onView(supplier)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(supplier)}
                          disabled={!canEdit}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => exportSupplierToPDF(supplier)}
                          title="Export to PDF"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(supplier.id)}
                          disabled={!canEdit}
                          className="text-destructive hover:text-destructive"
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
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, sortedSuppliers.length)} of {sortedSuppliers.length} results
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
        {sortedSuppliers.length > 0 && (
          <div className="flex justify-between items-center mt-4 text-sm text-muted-foreground">
            <div>
              Total: {suppliers.length} suppliers | Filtered: {sortedSuppliers.length}
            </div>
            <div>
              Active: {suppliers.filter(s => s.is_active).length} | 
              Inactive: {suppliers.filter(s => !s.is_active).length}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};