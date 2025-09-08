import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Eye, 
  Edit, 
  Trash2, 
  Search, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  FileSpreadsheet, 
  FileText,
  Users,
  Building2,
  TrendingUp
} from 'lucide-react';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { StatsCard } from '@/components/ui/stats-card';
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

interface EnhancedSupplierTableProps {
  suppliers: Supplier[];
  onView: (supplier: Supplier) => void;
  onEdit: (supplier: Supplier) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
  loading?: boolean;
}

type SortField = 'name' | 'supplier_ref' | 'supplier_type' | 'email' | 'created_at';
type SortDirection = 'asc' | 'desc';

export const EnhancedSupplierTable: React.FC<EnhancedSupplierTableProps> = ({
  suppliers,
  onView,
  onEdit,
  onDelete,
  onCreate,
  loading = false
}) => {
  const { hasEditAccess } = useBusinessAuth();
  const { profile } = useAuth();
  const { toast } = useToast();
  
  // Table state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [companyData, setCompanyData] = useState<any>(null);
  
  // Stats state
  const [supplierStats, setSupplierStats] = useState({
    total: 0,
    active: 0,
    newThisMonth: 0
  });
  
  const itemsPerPage = 10;
  const canEdit = hasEditAccess('purchase');

  // Fetch company data for exports
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

  // Calculate supplier stats
  useEffect(() => {
    const total = suppliers.length;
    const active = suppliers.filter(s => s.is_active).length;
    const thisMonth = new Date();
    thisMonth.setDate(1);
    const newThisMonth = suppliers.filter(s => new Date(s.created_at) >= thisMonth).length;
    
    setSupplierStats({ total, active, newThisMonth });
  }, [suppliers]);

  // Filter suppliers
  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSearch = !searchTerm || 
      supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (supplier.supplier_ref && supplier.supplier_ref.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (supplier.email && supplier.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (supplier.phone && supplier.phone.includes(searchTerm));
    
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

  // Pagination
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

  // Enhanced export to Excel
  const exportToExcel = () => {
    try {
      const workbook = XLSX.utils.book_new();
      
      // Company Header
      const companyInfo = [
        [`${companyData?.name || 'Company'} - Supplier Directory`],
        [`Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}`],
        [`Total Suppliers: ${sortedSuppliers.length}`],
        [`Active Suppliers: ${supplierStats.active}`],
        [`New This Month: ${supplierStats.newThisMonth}`],
        ['']
      ];

      // Headers
      const headers = [
        ['Supplier Ref', 'Name', 'Type', 'Contact Person', 'Email', 'Phone', 'City', 'State', 'Country', 'GST Number', 'Status', 'Created Date']
      ];

      // Data rows
      const dataRows = sortedSuppliers.map(supplier => [
        supplier.supplier_ref || '',
        supplier.name,
        supplier.supplier_type || '',
        supplier.contact_person || '',
        supplier.email || '',
        supplier.phone || '',
        supplier.city || '',
        supplier.state || '',
        supplier.country || '',
        supplier.gst_number || '',
        supplier.is_active ? 'Active' : 'Inactive',
        format(new Date(supplier.created_at), 'MMM dd, yyyy')
      ]);

      const wsData = [...companyInfo, ...headers, ...dataRows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Set column widths
      ws['!cols'] = [
        { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, 
        { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, 
        { wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 15 }
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

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter, sortField, sortDirection]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading suppliers...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard
          title="Total Suppliers"
          value={supplierStats.total}
          subtitle="All suppliers"
          icon={Users}
          variant="default"
        />
        <StatsCard
          title="Active Suppliers"
          value={supplierStats.active}
          subtitle="Currently active"
          icon={Building2}
          variant="default"
        />
        <StatsCard
          title="New This Month"
          value={supplierStats.newThisMonth}
          subtitle="Recently added"
          icon={TrendingUp}
          variant="secondary"
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Supplier Management</CardTitle>
            {canEdit && (
              <Button onClick={onCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Add Supplier
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Enhanced Search and Controls */}
          <div className="p-4 sm:p-6 border-b bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20">
            <div className="flex flex-col gap-4 items-start justify-between">
              <div className="flex items-center gap-2 w-full">
                <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-white dark:bg-gray-800"
                />
                <Select value={statusFilter} onValueChange={(value) => {
                  setStatusFilter(value);
                  setCurrentPage(1);
                }}>
                  <SelectTrigger className="w-32 bg-white dark:bg-gray-800">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={(value) => {
                  setTypeFilter(value);
                  setCurrentPage(1);
                }}>
                  <SelectTrigger className="w-36 bg-white dark:bg-gray-800">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="local">Local</SelectItem>
                    <SelectItem value="international">International</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToExcel}
                  className="flex items-center gap-2 ml-2 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Export
                </Button>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-4 gap-2 text-sm text-muted-foreground">
              <span>
                Showing {paginatedSuppliers.length} of {filteredSuppliers.length} suppliers
                {searchTerm && ` matching "${searchTerm}"`}
                {(statusFilter !== 'all' || typeFilter !== 'all') && ' with current filters'}
              </span>
            </div>
          </div>

          {/* Enhanced Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => handleSort('supplier_ref')}
                  >
                    <div className="flex items-center gap-1">
                      Supplier Ref
                      {getSortIcon('supplier_ref')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Name
                      {getSortIcon('name')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => handleSort('supplier_type')}
                  >
                    <div className="flex items-center gap-1">
                      Type
                      {getSortIcon('supplier_type')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => handleSort('email')}
                  >
                    <div className="flex items-center gap-1">
                      Email
                      {getSortIcon('email')}
                    </div>
                  </TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => handleSort('created_at')}
                  >
                    <div className="flex items-center gap-1">
                      Created
                      {getSortIcon('created_at')}
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSuppliers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
                        ? "No suppliers found matching your criteria"
                        : "No suppliers available. Add your first supplier to get started."}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedSuppliers.map((supplier) => (
                    <TableRow 
                      key={supplier.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="font-medium">{supplier.supplier_ref}</TableCell>
                      <TableCell className="font-medium">{supplier.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {supplier.supplier_type || 'Not specified'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{supplier.email || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{supplier.phone || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={supplier.is_active ? "default" : "secondary"}>
                          {supplier.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(supplier.created_at), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onView(supplier)}
                            className="h-8 w-8 p-0 hover:bg-green-100 hover:text-green-600 dark:hover:bg-green-900/20 dark:hover:text-green-400"
                            title="View supplier"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEdit(supplier)}
                              className="h-8 w-8 p-0 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                              title="Edit supplier"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDelete(supplier.id)}
                              className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                              title="Delete supplier"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Enhanced Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredSuppliers.length)} of {filteredSuppliers.length} results
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNumber = i + 1;
                      return (
                        <Button
                          key={pageNumber}
                          variant={currentPage === pageNumber ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNumber)}
                          className="w-8 h-8"
                        >
                          {pageNumber}
                        </Button>
                      );
                    })}
                    {totalPages > 5 && (
                      <>
                        <span className="px-2 text-muted-foreground">...</span>
                        <Button
                          variant={currentPage === totalPages ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(totalPages)}
                          className="w-8 h-8"
                        >
                          {totalPages}
                        </Button>
                      </>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};