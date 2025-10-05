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
  const [suppliersWithTransactions, setSuppliersWithTransactions] = useState<Set<string>>(new Set());
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

  // Export single supplier to PDF as Professional Certificate
  const exportSupplierToPDF = async (supplier: Supplier) => {
    try {
      const doc = new jsPDF();
      
      // ========== DECORATIVE BORDER ==========
      // Outer border - Gold/Premium color
      doc.setDrawColor(184, 134, 11); // Dark goldenrod
      doc.setLineWidth(1.5);
      doc.rect(10, 10, 190, 277, 'S');
      
      // Inner decorative border
      doc.setDrawColor(218, 165, 32); // Goldenrod
      doc.setLineWidth(0.5);
      doc.rect(12, 12, 186, 273, 'S');
      
      // Corner decorations
      doc.setDrawColor(41, 128, 185);
      doc.setLineWidth(2);
      // Top-left corner
      doc.line(15, 15, 30, 15);
      doc.line(15, 15, 15, 30);
      // Top-right corner
      doc.line(180, 15, 195, 15);
      doc.line(195, 15, 195, 30);
      // Bottom-left corner
      doc.line(15, 285, 30, 285);
      doc.line(15, 270, 15, 285);
      // Bottom-right corner
      doc.line(180, 285, 195, 285);
      doc.line(195, 270, 195, 285);
      
      // ========== HEADER SECTION ==========
      let yPos = 25;
      
      // Company Logo/Badge placeholder
      doc.setFillColor(41, 128, 185);
      doc.circle(105, yPos + 5, 8, 'F');
      doc.setFontSize(6);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text('CERTIFIED', 105, yPos + 7, { align: 'center' });
      
      yPos += 15;
      
      // Certificate Title
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 128, 185);
      doc.text('AUTHORIZED SUPPLIER', 105, yPos, { align: 'center' });
      
      yPos += 8;
      doc.setFontSize(18);
      doc.setTextColor(184, 134, 11);
      doc.text('REGISTRATION CERTIFICATE', 105, yPos, { align: 'center' });
      
      yPos += 12;
      
      // Decorative line
      doc.setDrawColor(184, 134, 11);
      doc.setLineWidth(0.5);
      doc.line(50, yPos, 160, yPos);
      
      yPos += 10;
      
      // Certificate Statement
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      const certStatement = 'This is to certify that the following supplier is officially registered and authorized';
      doc.text(certStatement, 105, yPos, { align: 'center' });
      yPos += 5;
      doc.text('as a trusted business partner in our supplier network', 105, yPos, { align: 'center' });
      
      yPos += 12;
      
      // ========== COMPANY INFORMATION BOX ==========
      doc.setFillColor(240, 248, 255); // Alice blue background
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
      
      // ========== SUPPLIER DETAILS SECTION ==========
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 128, 185);
      doc.text('SUPPLIER DETAILS', 105, yPos, { align: 'center' });
      
      yPos += 8;
      
      // Supplier Name - Highlighted
      doc.setFillColor(255, 250, 205); // Lemon chiffon
      doc.roundedRect(30, yPos - 3, 150, 10, 1, 1, 'F');
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(supplier.name, 105, yPos + 4, { align: 'center' });
      
      yPos += 15;
      
      // Details grid with better formatting
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
      
      // Left column
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
      
      // Right column
      let rightY = yPos;
      detailsRight.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(60, 60, 60);
        doc.text(label, 110, rightY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        if (label === 'Status:' && value === 'ACTIVE') {
          doc.setTextColor(34, 139, 34); // Green for active
          doc.setFont('helvetica', 'bold');
        }
        const valueText = doc.splitTextToSize(value, 55);
        doc.text(valueText, 155, rightY);
        rightY += 8;
      });
      
      yPos = Math.max(leftY, rightY) + 10;
      
      // ========== VALIDITY & TERMS SECTION ==========
      doc.setFillColor(255, 248, 220); // Cornsilk
      doc.roundedRect(20, yPos, 170, 18, 2, 2, 'F');
      doc.setDrawColor(184, 134, 11);
      doc.setLineWidth(0.3);
      doc.roundedRect(20, yPos, 170, 18, 2, 2, 'S');
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(139, 69, 19); // Saddle brown
      doc.text('CERTIFICATE TERMS:', 25, yPos + 5);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text('• This certificate confirms the supplier\'s registration in our authorized vendor database', 25, yPos + 10);
      doc.text('• Valid as long as the business relationship remains active and in good standing', 25, yPos + 14);
      
      yPos += 25;
      
      // ========== VERIFICATION SECTION ==========
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
      
      // QR Code placeholder
      doc.setFillColor(255, 255, 255);
      doc.rect(110, yPos + 3, 24, 24, 'F');
      doc.setDrawColor(41, 128, 185);
      doc.setLineWidth(0.5);
      doc.rect(110, yPos + 3, 24, 24, 'S');
      doc.setFontSize(6);
      doc.setTextColor(100, 100, 100);
      doc.text('QR CODE', 122, yPos + 13, { align: 'center' });
      doc.text('VERIFICATION', 122, yPos + 17, { align: 'center' });
      
      // Authorized Signature Section
      doc.setFillColor(255, 250, 240);
      doc.roundedRect(140, yPos, 50, 30, 2, 2, 'F');
      doc.setDrawColor(184, 134, 11);
      doc.setLineWidth(0.3);
      doc.roundedRect(140, yPos, 50, 30, 2, 2, 'S');
      
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text('Authorized By:', 145, yPos + 8);
      
      // Signature line
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.line(145, yPos + 20, 183, yPos + 20);
      
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('Authorized Signatory', 164, yPos + 25, { align: 'center' });
      
      yPos += 35;
      
      // ========== FOOTER ==========
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      const footerText = 'This is a digitally generated certificate. For verification, please contact the issuing company.';
      doc.text(footerText, 105, yPos + 5, { align: 'center' });
      
      // Security watermark
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
          {/* Filters Row */}
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
          
          {/* Search and Export Row */}
          <div className="flex gap-4 items-center">
            <div className="w-96">
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
              className="h-9 px-4 gap-2 rounded-md bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 font-medium transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export Excel
            </Button>
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
                        {supplier.city || 'Not specified'}
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
                          onClick={() => {
                            console.log('SupplierTable: Delete button clicked for supplier:', supplier.id, 'Has transactions:', suppliersWithTransactions.has(supplier.id));
                            onDelete(supplier.id);
                          }}
                          disabled={!canEdit || suppliersWithTransactions.has(supplier.id)}
                          className={`transition-all duration-200 ${
                            suppliersWithTransactions.has(supplier.id)
                              ? 'text-slate-400 cursor-not-allowed hover:bg-transparent'
                              : 'text-destructive hover:text-destructive'
                          }`}
                          title={suppliersWithTransactions.has(supplier.id) ? "Cannot delete supplier with existing transactions" : !canEdit ? "No permission to delete" : "Delete Supplier"}
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