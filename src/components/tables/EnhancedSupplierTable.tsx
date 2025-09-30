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
  TrendingUp,
  PackageOpen
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
  
  // Transaction protection state
  const [suppliersWithTransactions, setSuppliersWithTransactions] = useState<Set<string>>(new Set());
  
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

  // Check for supplier transactions
  useEffect(() => {
    const checkSupplierTransactions = async () => {
      if (!profile?.company_id || suppliers.length === 0) {
        console.log('SupplierTable: Skipping transaction check - no company_id or suppliers', { 
          company_id: profile?.company_id, 
          suppliers_count: suppliers.length 
        });
        return;
      }
      
      const supplierIds = suppliers.map(s => s.id);
      const suppliersWithTxns = new Set<string>();
      
      console.log('SupplierTable: Checking transactions for suppliers:', supplierIds);
      
      try {
        // Check for purchase orders
        const { data: poData, error: poError } = await supabase
          .from('purchase_orders')
          .select('supplier_id')
          .eq('company_id', profile.company_id)
          .in('supplier_id', supplierIds);
        
        if (poError) {
          console.error('SupplierTable: Error checking purchase orders:', poError);
        } else {
          console.log('SupplierTable: Found purchase orders:', poData);
          poData?.forEach(po => suppliersWithTxns.add(po.supplier_id));
        }
        
        // Check for GRNs
        const { data: grnData, error: grnError } = await supabase
          .from('grn_header')
          .select('supplier_id')
          .eq('company_id', profile.company_id)
          .in('supplier_id', supplierIds);
        
        if (grnError) {
          console.error('SupplierTable: Error checking GRNs:', grnError);
        } else {
          console.log('SupplierTable: Found GRNs:', grnData);
          grnData?.forEach(grn => suppliersWithTxns.add(grn.supplier_id));
        }
        
        // Check for debit notes
        const { data: dnData, error: dnError } = await supabase
          .from('debit_notes')
          .select('supplier_id')
          .eq('company_id', profile.company_id)
          .in('supplier_id', supplierIds);
        
        if (dnError) {
          console.error('SupplierTable: Error checking debit notes:', dnError);
        } else {
          console.log('SupplierTable: Found debit notes:', dnData);
          dnData?.forEach(dn => suppliersWithTxns.add(dn.supplier_id));
        }
        
        console.log('SupplierTable: Final suppliers with transactions:', Array.from(suppliersWithTxns));
        setSuppliersWithTransactions(suppliersWithTxns);
      } catch (error) {
        console.error('SupplierTable: Error checking supplier transactions:', error);
      }
    };
    
    checkSupplierTransactions();
  }, [suppliers, profile?.company_id]);

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

  // Debug logging for transaction protection
  console.log('SupplierTable: Current state:', {
    totalSuppliers: suppliers.length,
    suppliersWithTransactions: Array.from(suppliersWithTransactions),
    paginatedSuppliers: paginatedSuppliers.map(s => ({ id: s.id, name: s.name }))
  });

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
      const exportData = sortedSuppliers.map(supplier => ({
        'Supplier Ref': supplier.supplier_ref || 'N/A',
        'Name': supplier.name,
        'Type': supplier.supplier_type || 'General',
        'Contact Person': supplier.contact_person || 'N/A',
        'Email': supplier.email || 'N/A',
        'Phone': supplier.phone || 'N/A',
        'Website': supplier.website || 'N/A',
        'GST Number': supplier.gst_number || 'N/A',
        'City': supplier.city || 'N/A',
        'State': supplier.state || 'N/A',
        'Country': supplier.country || 'N/A',
        'Currency': supplier.preferred_currency || 'INR',
        'Payment Terms': supplier.payment_terms || 'N/A',
        'Status': supplier.is_active ? 'Active' : 'Inactive',
        'Created Date': format(new Date(supplier.created_at), 'dd MMM yyyy')
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      
      ws['!cols'] = [
        { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 20 },
        { wch: 25 }, { wch: 15 }, { wch: 25 }, { wch: 18 },
        { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
        { wch: 15 }, { wch: 10 }, { wch: 15 }
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Suppliers');
      XLSX.writeFile(wb, `Suppliers_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      
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

  // Export single supplier to PDF as Professional Certificate
  const exportSupplierToPDF = async (supplier: Supplier) => {
    try {
      const doc = new jsPDF();
      
      // ========== DECORATIVE BORDER ==========
      doc.setDrawColor(184, 134, 11);
      doc.setLineWidth(1.5);
      doc.rect(10, 10, 190, 277, 'S');
      
      doc.setDrawColor(218, 165, 32);
      doc.setLineWidth(0.5);
      doc.rect(12, 12, 186, 273, 'S');
      
      doc.setDrawColor(41, 128, 185);
      doc.setLineWidth(2);
      doc.line(15, 15, 30, 15);
      doc.line(15, 15, 15, 30);
      doc.line(180, 15, 195, 15);
      doc.line(195, 15, 195, 30);
      doc.line(15, 285, 30, 285);
      doc.line(15, 270, 15, 285);
      doc.line(180, 285, 195, 285);
      doc.line(195, 270, 195, 285);
      
      let yPos = 25;
      
      doc.setFillColor(41, 128, 185);
      doc.circle(105, yPos + 5, 8, 'F');
      doc.setFontSize(6);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text('CERTIFIED', 105, yPos + 7, { align: 'center' });
      
      yPos += 15;
      
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 128, 185);
      doc.text('AUTHORIZED SUPPLIER', 105, yPos, { align: 'center' });
      
      yPos += 8;
      doc.setFontSize(18);
      doc.setTextColor(184, 134, 11);
      doc.text('REGISTRATION CERTIFICATE', 105, yPos, { align: 'center' });
      
      yPos += 12;
      doc.setDrawColor(184, 134, 11);
      doc.setLineWidth(0.5);
      doc.line(50, yPos, 160, yPos);
      yPos += 10;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text('This is to certify that the following supplier is officially registered and authorized', 105, yPos, { align: 'center' });
      yPos += 5;
      doc.text('as a trusted business partner in our supplier network', 105, yPos, { align: 'center' });
      yPos += 12;
      
      doc.setFillColor(240, 248, 255);
      doc.roundedRect(20, yPos, 170, 25, 2, 2, 'F');
      doc.setDrawColor(41, 128, 185);
      doc.setLineWidth(0.5);
      doc.roundedRect(20, yPos, 170, 25, 2, 2, 'S');
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 128, 185);
      doc.text('REGISTERED WITH:', 25, yPos + 6);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(companyData?.name || 'YOUR COMPANY NAME', 25, yPos + 13);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      const companyAddr = [
        companyData?.address_line1,
        `${companyData?.city || ''}, ${companyData?.state || ''} - ${companyData?.postal_code || ''}`
      ].filter(Boolean).join(', ');
      doc.text(companyAddr || 'Company Address', 25, yPos + 19);
      
      yPos += 32;
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 128, 185);
      doc.text('SUPPLIER DETAILS', 105, yPos, { align: 'center' });
      yPos += 8;
      
      doc.setFillColor(255, 250, 205);
      doc.roundedRect(30, yPos - 3, 150, 10, 1, 1, 'F');
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(supplier.name, 105, yPos + 4, { align: 'center' });
      yPos += 15;
      
      doc.setFontSize(9);
      const detailsLeft = [
        ['Certificate No.:', supplier.supplier_ref || 'AUTO-GEN'],
        ['Supplier Type:', supplier.supplier_type || 'General Supplier'],
        ['Contact Person:', supplier.contact_person || 'N/A'],
        ['Email:', supplier.email || 'N/A'],
        ['Phone:', supplier.phone || 'N/A'],
        ['Website:', supplier.website || 'N/A']
      ];
      
      const detailsRight = [
        ['Registration Date:', format(new Date(supplier.created_at), 'dd MMM yyyy')],
        ['GST Number:', supplier.gst_number || 'N/A'],
        ['Location:', [supplier.city, supplier.state, supplier.country].filter(Boolean).join(', ') || 'N/A'],
        ['Currency:', supplier.preferred_currency || 'INR'],
        ['Payment Terms:', supplier.payment_terms || 'Net 30'],
        ['Status:', supplier.is_active ? 'ACTIVE' : 'INACTIVE']
      ];
      
      let leftY = yPos;
      detailsLeft.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(60, 60, 60);
        doc.text(label, 25, leftY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        const valueText = doc.splitTextToSize(value, 55);
        doc.text(valueText, 60, leftY);
        leftY += 8;
      });
      
      let rightY = yPos;
      detailsRight.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(60, 60, 60);
        doc.text(label, 110, rightY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        if (label === 'Status:' && value === 'ACTIVE') {
          doc.setTextColor(34, 139, 34);
          doc.setFont('helvetica', 'bold');
        }
        const valueText = doc.splitTextToSize(value, 55);
        doc.text(valueText, 155, rightY);
        rightY += 8;
      });
      
      yPos = Math.max(leftY, rightY) + 10;
      
      doc.setFillColor(255, 248, 220);
      doc.roundedRect(20, yPos, 170, 18, 2, 2, 'F');
      doc.setDrawColor(184, 134, 11);
      doc.setLineWidth(0.3);
      doc.roundedRect(20, yPos, 170, 18, 2, 2, 'S');
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(139, 69, 19);
      doc.text('CERTIFICATE TERMS:', 25, yPos + 5);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text('• This certificate confirms the supplier\'s registration in our authorized vendor database', 25, yPos + 10);
      doc.text('• Valid as long as the business relationship remains active and in good standing', 25, yPos + 14);
      
      yPos += 25;
      
      doc.setFillColor(240, 248, 255);
      doc.roundedRect(20, yPos, 82, 30, 2, 2, 'F');
      doc.setDrawColor(41, 128, 185);
      doc.setLineWidth(0.3);
      doc.roundedRect(20, yPos, 82, 30, 2, 2, 'S');
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 128, 185);
      doc.text('VERIFICATION DETAILS', 25, yPos + 6);
      
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(`Issue Date: ${format(new Date(), 'dd MMM yyyy')}`, 25, yPos + 12);
      doc.text(`Certificate ID: ${supplier.id.substring(0, 8).toUpperCase()}`, 25, yPos + 17);
      doc.text(`Company ID: ${companyData?.business_ref_no || 'N/A'}`, 25, yPos + 22);
      doc.text(`Verification: ${companyData?.email || 'contact@company.com'}`, 25, yPos + 27);
      
      doc.setFillColor(255, 255, 255);
      doc.rect(110, yPos + 3, 24, 24, 'F');
      doc.setDrawColor(41, 128, 185);
      doc.setLineWidth(0.5);
      doc.rect(110, yPos + 3, 24, 24, 'S');
      doc.setFontSize(6);
      doc.setTextColor(100, 100, 100);
      doc.text('QR CODE', 122, yPos + 13, { align: 'center' });
      doc.text('VERIFICATION', 122, yPos + 17, { align: 'center' });
      
      doc.setFillColor(255, 250, 240);
      doc.roundedRect(140, yPos, 50, 30, 2, 2, 'F');
      doc.setDrawColor(184, 134, 11);
      doc.setLineWidth(0.3);
      doc.roundedRect(140, yPos, 50, 30, 2, 2, 'S');
      
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text('Authorized By:', 145, yPos + 8);
      
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.line(145, yPos + 20, 183, yPos + 20);
      
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('Authorized Signatory', 164, yPos + 25, { align: 'center' });
      
      yPos += 35;
      
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      const footerText = 'This is a digitally generated certificate. For verification, please contact the issuing company.';
      doc.text(footerText, 105, yPos + 5, { align: 'center' });
      
      doc.setFontSize(50);
      doc.setTextColor(230, 230, 230);
      doc.setFont('helvetica', 'bold');
      doc.saveGraphicsState();
      doc.text('CERTIFIED', 105, 150, { 
        align: 'center',
        angle: 45
      });
      doc.restoreGraphicsState();
      
      doc.save(`Supplier_Certificate_${supplier.supplier_ref || supplier.name}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      
      toast({
        title: "Certificate Generated",
        description: `Supplier certificate for ${supplier.name} downloaded successfully`,
      });
    } catch (error) {
      console.error('Export to PDF failed:', error);
      toast({
        title: "Export Failed",
        description: "Failed to generate supplier certificate",
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
                  className="h-9 px-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-all duration-200 shadow-sm"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export Excel
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
                <TableRow className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200 hover:from-slate-50 hover:to-slate-100">
                  <TableHead 
                    className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4"
                    onClick={() => handleSort('supplier_ref')}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase tracking-wider">Supplier Ref</span>
                      {getSortIcon('supplier_ref')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase tracking-wider">Name</span>
                      {getSortIcon('name')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4"
                    onClick={() => handleSort('supplier_type')}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase tracking-wider">Type</span>
                      {getSortIcon('supplier_type')}
                    </div>
                  </TableHead>
                  <TableHead className="font-bold text-slate-800 py-4">
                    <span className="text-xs uppercase tracking-wider">Contact Person</span>
                  </TableHead>
                  <TableHead 
                    className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4"
                    onClick={() => handleSort('email')}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase tracking-wider">Email</span>
                      {getSortIcon('email')}
                    </div>
                  </TableHead>
                  <TableHead className="font-bold text-slate-800 py-4">
                    <span className="text-xs uppercase tracking-wider">Phone</span>
                  </TableHead>
                  <TableHead className="font-bold text-slate-800 py-4">
                    <span className="text-xs uppercase tracking-wider">Status</span>
                  </TableHead>
                  <TableHead 
                    className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-all duration-200 py-4"
                    onClick={() => handleSort('created_at')}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase tracking-wider">Created</span>
                      {getSortIcon('created_at')}
                    </div>
                  </TableHead>
                  <TableHead className="font-bold text-slate-800 text-center py-4 min-w-[200px]">
                    <span className="text-xs uppercase tracking-wider">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSuppliers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <PackageOpen className="h-12 w-12 text-slate-300" />
                        <p className="font-medium">
                          {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
                            ? "No suppliers found matching your criteria"
                            : "No suppliers available. Add your first supplier to get started."}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedSuppliers.map((supplier) => (
                    <TableRow 
                      key={supplier.id}
                      className="hover:bg-slate-50 transition-all"
                    >
                      <TableCell className="font-semibold text-blue-600 py-4">{supplier.supplier_ref}</TableCell>
                      <TableCell className="font-medium text-slate-700 py-4">{supplier.name}</TableCell>
                      <TableCell className="py-4">
                        <Badge 
                          variant="outline" 
                          className="capitalize bg-blue-50 text-blue-700 border-blue-200 font-medium px-3 py-1 rounded-full text-xs"
                        >
                          {supplier.supplier_type || 'General'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600 py-4">{supplier.contact_person || '-'}</TableCell>
                      <TableCell className="text-slate-600 py-4">{supplier.email || '-'}</TableCell>
                      <TableCell className="text-slate-600 py-4">{supplier.phone || '-'}</TableCell>
                      <TableCell className="py-4">
                        <Badge 
                          variant={supplier.is_active ? "default" : "secondary"}
                          className={supplier.is_active 
                            ? "bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200 font-medium px-3 py-1 rounded-full text-xs"
                            : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 font-medium px-3 py-1 rounded-full text-xs"
                          }
                        >
                          {supplier.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600 py-4">
                        {format(new Date(supplier.created_at), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2 justify-center">
                          {/* Primary Actions Group */}
                          <div className="flex items-center rounded-lg border border-slate-200 bg-white shadow-sm">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onView(supplier)}
                              className="h-9 px-3 rounded-l-lg rounded-r-none border-r border-slate-200 hover:bg-blue-50 hover:text-blue-700 transition-all duration-200"
                              title="View Supplier Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onEdit(supplier)}
                                className="h-9 px-3 rounded-none border-r border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 transition-all duration-200"
                                title="Edit Supplier"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  console.log('SupplierTable: Delete button clicked for supplier:', supplier.id, 'Has transactions:', suppliersWithTransactions.has(supplier.id));
                                  onDelete(supplier.id);
                                }}
                                disabled={suppliersWithTransactions.has(supplier.id)}
                                className={`h-9 px-3 rounded-r-lg rounded-l-none transition-all duration-200 ${
                                  suppliersWithTransactions.has(supplier.id)
                                    ? 'text-slate-400 cursor-not-allowed hover:bg-transparent'
                                    : 'hover:bg-red-50 hover:text-red-700'
                                }`}
                                title={suppliersWithTransactions.has(supplier.id) ? "Cannot delete supplier with existing transactions" : "Delete Supplier"}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>

                          {/* Export Actions Group */}
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => exportSupplierToPDF(supplier)}
                              className="h-9 px-3 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300 transition-all duration-200 shadow-sm"
                              title="Export Certificate PDF"
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          </div>
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
            <div className="flex items-center justify-between p-6 border-t bg-gradient-to-r from-slate-50 to-slate-100">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredSuppliers.length)} of {filteredSuppliers.length} results
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="hover:bg-white hover:shadow-md"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className={currentPage === page ? "bg-blue-600 hover:bg-blue-700" : "hover:bg-white hover:shadow-md"}
                    >
                      {page}
                    </Button>
                  ))}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="hover:bg-white hover:shadow-md"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};