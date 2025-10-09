
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Edit, Trash2, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Download, Eye, FileText, FileSpreadsheet } from "lucide-react";
import { useIsMobile } from '@/hooks/use-mobile';
import { CustomerTableMobile } from './CustomerTableMobile';
import { exportToExcel } from '@/utils/excelExport';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';
import { toast } from '@/hooks/use-toast';

interface Customer {
  id: string;
  name: string;
  customer_ref: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  country?: string;
  customer_type?: string;
  contact_person?: string;
  gst_number?: string;
  pan_number?: string;
  address_line1?: string;
  address_line2?: string;
  pin_code?: string;
  payment_terms?: string;
  credit_limit?: number;
  is_active: boolean;
  created_at: string;
}

interface CustomerTableProps {
  customers: Customer[];
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
  onView?: (customer: Customer) => void;
  loading?: boolean;
}

type SortField = 'name' | 'customer_ref' | 'customer_type' | 'city' | 'state' | 'created_at';
type SortDirection = 'asc' | 'desc';

export const CustomerTable: React.FC<CustomerTableProps> = ({
  customers,
  onEdit,
  onDelete,
  onView,
  loading = false
}) => {
  const isMobile = useIsMobile();
  const { company } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [customersWithTransactions, setCustomersWithTransactions] = useState<Set<string>>(new Set());
  const itemsPerPage = 5;

  // Check for customer transactions
  useEffect(() => {
    const checkCustomerTransactions = async () => {
      if (!company?.id || customers.length === 0) return;

      const customerIds = customers.map(c => c.id);
      const customersWithTxns = new Set<string>();

      try {
        // Check sales_orders
        const { data: ordersData } = await supabase
          .from('sales_orders')
          .select('customer_id')
          .eq('company_id', company.id)
          .in('customer_id', customerIds);

        ordersData?.forEach(order => customersWithTxns.add(order.customer_id));

        // Check sales_invoices
        const { data: invoicesData } = await supabase
          .from('sales_invoices')
          .select('customer_id')
          .eq('company_id', company.id)
          .in('customer_id', customerIds);

        invoicesData?.forEach(invoice => customersWithTxns.add(invoice.customer_id));

        // Check return_order_header
        const { data: returnsData } = await supabase
          .from('return_order_header')
          .select('customer_id')
          .eq('company_id', company.id)
          .in('customer_id', customerIds);

        returnsData?.forEach(returnOrder => customersWithTxns.add(returnOrder.customer_id));

        // Check credit_notes
        const { data: creditNotesData } = await supabase
          .from('credit_notes')
          .select('customer_id')
          .eq('company_id', company.id)
          .in('customer_id', customerIds);

        creditNotesData?.forEach(creditNote => customersWithTxns.add(creditNote.customer_id));

        setCustomersWithTransactions(customersWithTxns);
      } catch (error) {
        console.error('Error checking customer transactions:', error);
      }
    };

    checkCustomerTransactions();
  }, [customers, company?.id]);

  // Use mobile component on small screens
  if (isMobile) {
    return (
      <CustomerTableMobile
        customers={customers}
        onEdit={onEdit}
        onDelete={onDelete}
        loading={loading}
      />
    );
  }

  // Filter customers based on search term and status
  const filteredCustomers = customers.filter(customer => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      customer.name.toLowerCase().includes(searchLower) ||
      customer.customer_ref.toLowerCase().includes(searchLower)
    );
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && customer.is_active) ||
      (statusFilter === 'inactive' && !customer.is_active);
    
    return matchesSearch && matchesStatus;
  });

  // Sort filtered customers
  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    let aValue: any, bValue: any;

    switch (sortField) {
      case 'name':
        aValue = a.name;
        bValue = b.name;
        break;
      case 'customer_ref':
        aValue = a.customer_ref;
        bValue = b.customer_ref;
        break;
      case 'customer_type':
        aValue = a.customer_type || '';
        bValue = b.customer_type || '';
        break;
      case 'city':
        aValue = a.city || '';
        bValue = b.city || '';
        break;
      case 'state':
        aValue = a.state || '';
        bValue = b.state || '';
        break;
      case 'created_at':
        aValue = new Date(a.created_at);
        bValue = new Date(b.created_at);
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Paginate sorted customers
  const totalPages = Math.ceil(sortedCustomers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCustomers = sortedCustomers.slice(startIndex, startIndex + itemsPerPage);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  // Export to Excel
  const handleExportToExcel = () => {
    if (filteredCustomers.length === 0) {
      toast({ title: 'No data to export', description: 'There are no customers to export.', variant: 'destructive' });
      return;
    }

    exportToExcel({
      data: filteredCustomers.map(c => ({
        ...c,
        status: c.is_active ? 'Active' : 'Inactive',
        customer_type: c.customer_type || 'N/A',
      })),
      columns: [
        { label: 'Customer Name', key: 'name' },
        { label: 'Reference', key: 'customer_ref' },
        { label: 'Customer Type', key: 'customer_type' },
        { label: 'Email', key: 'email' },
        { label: 'Phone', key: 'phone' },
        { label: 'City', key: 'city' },
        { label: 'State', key: 'state' },
        { label: 'Status', key: 'status' },
        { label: 'Created Date', key: 'created_at', format: (val) => new Date(val).toLocaleDateString() },
      ],
      filename: `customers_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'Customers',
    });

    toast({ title: 'Export successful', description: 'Customers exported to Excel.' });
  };

  // Generate Customer PDF Certificate
  const generateCustomerPDF = (customer: Customer) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Border
    doc.setDrawColor(0, 102, 204);
    doc.setLineWidth(1);
    doc.rect(10, 10, pageWidth - 20, pageHeight - 20);
    
    // Header
    doc.setFillColor(0, 102, 204);
    doc.rect(15, 15, pageWidth - 30, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('AUTHORIZED CUSTOMER REGISTRATION', pageWidth / 2, 28, { align: 'center' });
    doc.setFontSize(12);
    doc.text('CERTIFICATE', pageWidth / 2, 35, { align: 'center' });
    
    // Company Details
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    let yPos = 50;
    
    if (company) {
      doc.setFont('helvetica', 'bold');
      doc.text('ISSUED BY:', 20, yPos);
      doc.setFont('helvetica', 'normal');
      yPos += 6;
      doc.text(company.name || '', 20, yPos);
      const companyData = company as any;
      if (companyData.address_line1) {
        yPos += 5;
        doc.text(companyData.address_line1, 20, yPos);
      }
      if (companyData.city || companyData.state) {
        yPos += 5;
        doc.text(`${companyData.city || ''}, ${companyData.state || ''} ${companyData.postal_code || ''}`, 20, yPos);
      }
      if (companyData.gstn) {
        yPos += 5;
        doc.text(`GSTN: ${companyData.gstn}`, 20, yPos);
      }
    }
    
    // Customer Details Section
    yPos += 15;
    doc.setFillColor(240, 240, 240);
    doc.rect(15, yPos - 5, pageWidth - 30, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('CUSTOMER DETAILS', 20, yPos);
    
    yPos += 12;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Customer Name:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(customer.name, 70, yPos);
    
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Reference No:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(customer.customer_ref, 70, yPos);
    
    if (customer.customer_type) {
      yPos += 7;
      doc.setFont('helvetica', 'bold');
      doc.text('Customer Type:', 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(customer.customer_type, 70, yPos);
    }
    
    if (customer.contact_person) {
      yPos += 7;
      doc.setFont('helvetica', 'bold');
      doc.text('Contact Person:', 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(customer.contact_person, 70, yPos);
    }
    
    yPos += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('Email:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(customer.email || 'N/A', 70, yPos);
    
    yPos += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('Phone:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(customer.phone || 'N/A', 70, yPos);
    
    // Address
    if (customer.address_line1) {
      yPos += 7;
      doc.setFont('helvetica', 'bold');
      doc.text('Address:', 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(customer.address_line1, 70, yPos);
      
      if (customer.address_line2) {
        yPos += 5;
        doc.text(customer.address_line2, 70, yPos);
      }
      
      if (customer.city || customer.state) {
        yPos += 5;
        doc.text(`${customer.city || ''}, ${customer.state || ''} ${customer.pin_code || ''}`, 70, yPos);
      }
      
      if (customer.country) {
        yPos += 5;
        doc.text(customer.country, 70, yPos);
      }
    }
    
    // Tax Details
    if (customer.gst_number) {
      yPos += 7;
      doc.setFont('helvetica', 'bold');
      doc.text('GST Number:', 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(customer.gst_number, 70, yPos);
    }
    
    if (customer.pan_number) {
      yPos += 7;
      doc.setFont('helvetica', 'bold');
      doc.text('PAN Number:', 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(customer.pan_number, 70, yPos);
    }
    
    // Payment Terms
    if (customer.payment_terms) {
      yPos += 7;
      doc.setFont('helvetica', 'bold');
      doc.text('Payment Terms:', 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(customer.payment_terms, 70, yPos);
    }
    
    yPos += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('Registration Date:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(customer.created_at).toLocaleDateString(), 70, yPos);
    
    yPos += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('Status:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(customer.is_active ? 0 : 255, customer.is_active ? 128 : 0, 0);
    doc.text(customer.is_active ? 'ACTIVE' : 'INACTIVE', 70, yPos);
    doc.setTextColor(0, 0, 0);
    
    // Certificate Statement
    yPos += 15;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    const certText = `This is to certify that ${customer.name} (Ref: ${customer.customer_ref}) is a registered customer of ${company?.name || 'our company'} and is authorized to conduct business transactions as per the terms and conditions agreed upon.`;
    const splitText = doc.splitTextToSize(certText, pageWidth - 50);
    doc.text(splitText, pageWidth / 2, yPos, { align: 'center' });
    
    // Signature Section
    yPos = pageHeight - 50;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.line(20, yPos, 80, yPos);
    doc.text('Authorized Signatory', 20, yPos + 5);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, yPos + 10);
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text('This is a computer-generated certificate and does not require a physical signature.', pageWidth / 2, pageHeight - 15, { align: 'center' });
    
    doc.save(`Customer_Certificate_${customer.customer_ref}.pdf`);
    toast({ title: 'PDF Generated', description: 'Customer certificate downloaded successfully.' });
  };

  return (
    <TooltipProvider>
      <Card>
        <CardContent>
          {/* Search, Filter and Export Controls */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-4 pt-6">
            {/* Left: Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or reference..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10"
              />
            </div>
            
            {/* Right: Filters + Export */}
            <div className="flex gap-2 items-center">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                onClick={handleExportToExcel}
                className="gap-2 bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-muted-foreground">Loading customers...</div>
          </div>
        ) : paginatedCustomers.length === 0 ? (
          <div className="text-center p-8">
            <div className="text-muted-foreground">
              {searchTerm ? 'No customers found matching your search.' : 'No customers yet.'}
            </div>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Name</span>
                      {getSortIcon('name')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('customer_ref')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Reference</span>
                      {getSortIcon('customer_ref')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('customer_type')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Type</span>
                      {getSortIcon('customer_type')}
                    </div>
                  </TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('city')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Location</span>
                      {getSortIcon('city')}
                    </div>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCustomers.map((customer) => (
                  <TableRow key={customer.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      {customer.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{customer.customer_ref}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{customer.customer_type || 'N/A'}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">{customer.email}</div>
                        <div className="text-sm text-muted-foreground">{customer.phone}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">{customer.city}</div>
                        <div className="text-sm text-muted-foreground">{customer.state}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={customer.is_active ? "default" : "secondary"}>
                        {customer.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-1">
                        {onView && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onView(customer)}
                            title="View Details"
                            className="min-h-[44px] min-w-[44px]"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => generateCustomerPDF(customer)}
                          title="Download Certificate"
                          className="min-h-[44px] min-w-[44px]"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(customer)}
                          title="Edit"
                          className="min-h-[44px] min-w-[44px]"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onDelete(customer)}
                                disabled={customersWithTransactions.has(customer.id)}
                                title={customersWithTransactions.has(customer.id) ? "Cannot delete customer with existing transactions" : "Delete"}
                                className="text-destructive hover:text-destructive min-h-[44px] min-w-[44px] disabled:opacity-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          {customersWithTransactions.has(customer.id) && (
                            <TooltipContent>
                              <p>Cannot delete customer with existing transactions</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, sortedCustomers.length)} of {sortedCustomers.length} entries
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => prev - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
    </TooltipProvider>
  );
};
