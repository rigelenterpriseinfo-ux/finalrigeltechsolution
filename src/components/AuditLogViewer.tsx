import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Filter, Download, Clock, User, Database, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  user_id: string;
  company_id: string;
  old_values: any;
  new_values: any;
  created_at: string;
  user_name?: string;
}

interface AuditLogViewerProps {
  className?: string;
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ className }) => {
  const { company, profile } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState({
    table_name: 'all',
    action: 'all',
    user_id: '',
    date_from: '',
    date_to: ''
  });

  const itemsPerPage = 25;

  const actionColors = {
    INSERT: 'bg-green-100 text-green-800',
    UPDATE: 'bg-blue-100 text-blue-800', 
    DELETE: 'bg-red-100 text-red-800'
  };

  const tableDisplayNames = {
    customers: 'Customers',
    suppliers: 'Suppliers', 
    products: 'Products',
    sales_orders: 'Sales Orders',
    purchase_orders: 'Purchase Orders',
    sales_invoices: 'Sales Invoices',
    purchase_invoices: 'Purchase Invoices',
    performa_invoices: 'Performa Invoices',
    payments: 'Payments',
    grn_header: 'GRN Headers',
    grn_line_items: 'GRN Line Items',
    inventory_adjustments: 'Inventory Adjustments',
    inventory_transactions: 'Inventory Transactions',
    debit_notes: 'Debit Notes',
    credit_notes: 'Credit Notes',
    backorder_items: 'Backorder Items',
    bom_headers: 'BOM Headers',
    company_users: 'Company Users',
    profiles: 'User Profiles'
  };

  useEffect(() => {
    if (company?.id && (profile?.role === 'owner' || profile?.role === 'admin')) {
      fetchAuditLogs();
    }
  }, [company?.id, profile?.role, currentPage, sortBy, sortOrder, filters]);

  const fetchAuditLogs = async () => {
    try {
      setIsLoading(true);
      
      // Build base query with filters
      let baseQuery = supabase
        .from('transaction_audit_log')
        .select('*', { count: 'exact' })
        .eq('company_id', company?.id);

      // Apply filters to base query
      if (filters.table_name && filters.table_name !== 'all') {
        baseQuery = baseQuery.eq('table_name', filters.table_name);
      }
      if (filters.action && filters.action !== 'all') {
        baseQuery = baseQuery.eq('action', filters.action);
      }
      if (filters.user_id) {
        baseQuery = baseQuery.eq('user_id', filters.user_id);
      }
      if (filters.date_from) {
        baseQuery = baseQuery.gte('created_at', filters.date_from);
      }
      if (filters.date_to) {
        baseQuery = baseQuery.lte('created_at', filters.date_to + 'T23:59:59');
      }

      // Get total count first
      const { count } = await baseQuery;
      setTotalLogs(count || 0);

      // Now get paginated data with profiles
      let query = supabase
        .from('transaction_audit_log')
        .select(`
          *,
          profiles!inner(first_name, last_name)
        `)
        .eq('company_id', company?.id);

      // Apply same filters
      if (filters.table_name && filters.table_name !== 'all') {
        query = query.eq('table_name', filters.table_name);
      }
      if (filters.action && filters.action !== 'all') {
        query = query.eq('action', filters.action);
      }
      if (filters.user_id) {
        query = query.eq('user_id', filters.user_id);
      }
      if (filters.date_from) {
        query = query.gte('created_at', filters.date_from);
      }
      if (filters.date_to) {
        query = query.lte('created_at', filters.date_to + 'T23:59:59');
      }

      // Apply sorting and pagination
      query = query
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

      const { data, error } = await query;

      if (error) throw error;

      const processedLogs = (data || []).map((log: any) => ({
        ...log,
        user_name: log.profiles ? `${log.profiles.first_name || ''} ${log.profiles.last_name || ''}`.trim() : 'Unknown User'
      }));

      setLogs(processedLogs);
    } catch (error: any) {
      toast({
        title: "Error loading audit logs",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearFilters = () => {
    const newFilters = {
      table_name: 'all',
      action: 'all',
      user_id: '',
      date_from: '',
      date_to: ''
    };
    setFilters(newFilters);
    setCurrentPage(1);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalLogs / itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const formatLogChanges = (log: AuditLog) => {
    if (log.action === 'DELETE') {
      const identifier = getRecordIdentifier(log.table_name, log.old_values);
      return `Deleted ${identifier || 'record'}`;
    }

    if (!log.new_values) {
      return 'No changes recorded';
    }

    const identifier = getRecordIdentifier(log.table_name, log.new_values);
    const changes = getKeyChanges(log.table_name, log.old_values, log.new_values);
    
    if (log.action === 'INSERT') {
      return `Created ${identifier}${changes ? ` - ${changes}` : ''}`;
    }

    return `${identifier}${changes ? ` - Updated: ${changes}` : ' - Updated'}`;
  };

  const getRecordIdentifier = (tableName: string, values: any) => {
    if (!values) return '';

    const identifierFields: Record<string, string[]> = {
      customers: ['customer_ref', 'name', 'email'],
      suppliers: ['supplier_ref', 'name', 'email'], 
      products: ['sku', 'name'],
      sales_orders: ['order_number', 'customer_name'],
      purchase_orders: ['order_number', 'supplier_name'],
      sales_invoices: ['invoice_number', 'customer_name'],
      purchase_invoices: ['invoice_number', 'supplier_name'],
      performa_invoices: ['performa_invoice_number', 'customer_name'],
      grn_header: ['grn_number', 'supplier_name'],
      debit_notes: ['debit_note_number', 'supplier_name'],
      credit_notes: ['cn_number', 'customer_name'],
      payments: ['reference_number', 'amount'],
      inventory_adjustments: ['reason'],
      company_users: ['full_name', 'email'],
      profiles: ['first_name', 'last_name']
    };

    const fields = identifierFields[tableName] || ['id'];
    
    for (const field of fields) {
      if (values[field]) {
        return `${field === 'amount' ? '$' + values[field] : values[field]}`;
      }
    }
    
    return values.id ? `ID: ${values.id.toString().slice(0, 8)}...` : '';
  };

  const getKeyChanges = (tableName: string, oldValues: any, newValues: any) => {
    if (!oldValues || !newValues) return '';

    const importantFields: Record<string, string[]> = {
      customers: ['name', 'email', 'phone', 'credit_limit', 'is_active'],
      suppliers: ['name', 'email', 'phone', 'is_active'],
      products: ['name', 'unit_price', 'cost_price', 'stock_quantity', 'is_active'],
      sales_orders: ['status', 'total_amount', 'customer_name'],
      purchase_orders: ['status', 'total_amount', 'supplier_name'],
      sales_invoices: ['status', 'total_amount'],
      purchase_invoices: ['status', 'total_amount'],
      grn_header: ['status', 'total_accepted_quantity'],
      payments: ['amount', 'payment_status'],
      inventory_adjustments: ['adjustment_quantity', 'adjustment_type'],
      company_users: ['full_name', 'email', 'status', 'access_type'],
      profiles: ['first_name', 'last_name', 'role', 'is_active']
    };

    const fields = importantFields[tableName] || [];
    const changes: string[] = [];

    fields.forEach(field => {
      if (oldValues[field] !== newValues[field]) {
        const oldVal = oldValues[field];
        const newVal = newValues[field];
        
        if (field === 'is_active' || field === 'status') {
          changes.push(`${field}: ${oldVal} → ${newVal}`);
        } else if (typeof newVal === 'number') {
          changes.push(`${field}: ${oldVal || 0} → ${newVal}`);
        } else if (newVal && newVal !== oldVal) {
          const displayVal = newVal.toString().length > 20 
            ? newVal.toString().substring(0, 20) + '...' 
            : newVal;
          changes.push(`${field}: ${displayVal}`);
        }
      }
    });

    return changes.slice(0, 3).join(', ') + (changes.length > 3 ? '...' : '');
  };

  const exportLogs = () => {
    const csvContent = [
      ['Date/Time', 'User', 'Action', 'Table', 'Record ID', 'Details'].join(','),
      ...logs.map(log => [
        format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
        log.user_name || 'Unknown',
        log.action,
        tableDisplayNames[log.table_name as keyof typeof tableDisplayNames] || log.table_name,
        log.record_id,
        `"${JSON.stringify(log.new_values || log.old_values).replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (profile?.role !== 'owner' && profile?.role !== 'admin') {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center">
          <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <CardTitle>Access Denied</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">
            You don't have permission to view audit logs.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">Track all user actions and system changes with timestamps</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportLogs} disabled={logs.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="bg-muted/50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Table</Label>
                <Select 
                  value={filters.table_name} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, table_name: value }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All tables" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="all">All tables</SelectItem>
                    {Object.entries(tableDisplayNames).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Action</Label>
                <Select 
                  value={filters.action} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, action: value }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actions</SelectItem>
                    <SelectItem value="INSERT">Created</SelectItem>
                    <SelectItem value="UPDATE">Updated</SelectItem>
                    <SelectItem value="DELETE">Deleted</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">From Date</Label>
                <Input
                  type="date"
                  className="h-9"
                  value={filters.date_from}
                  onChange={(e) => setFilters(prev => ({ ...prev, date_from: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">To Date</Label>
                <Input
                  type="date"
                  className="h-9"
                  value={filters.date_to}
                  onChange={(e) => setFilters(prev => ({ ...prev, date_to: e.target.value }))}
                />
              </div>

              <div className="space-y-2 flex flex-col justify-end">
                <Button onClick={() => { setCurrentPage(1); fetchAuditLogs(); }} size="sm" className="h-9">
                  <Filter className="h-4 w-4 mr-2" />
                  Apply Filters
                </Button>
                <Button variant="outline" onClick={clearFilters} size="sm" className="h-9">
                  Clear
                </Button>
              </div>
            </div>
          </div>

          {/* Audit Log Table */}
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16">
              <Database className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No audit logs found</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Transaction logs will appear here as users perform actions. Try adjusting your filters to see more results.
              </p>
            </div>
          ) : (
            <>
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/80 transition-colors"
                          onClick={() => handleSort('created_at')}
                        >
                          <div className="flex items-center gap-1">
                            Date/Time
                            {sortBy === 'created_at' && (
                              sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/80 transition-colors"
                          onClick={() => handleSort('user_id')}
                        >
                          <div className="flex items-center gap-1">
                            User
                            {sortBy === 'user_id' && (
                              sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/80 transition-colors"
                          onClick={() => handleSort('action')}
                        >
                          <div className="flex items-center gap-1">
                            Action
                            {sortBy === 'action' && (
                              sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/80 transition-colors"
                          onClick={() => handleSort('table_name')}
                        >
                          <div className="flex items-center gap-1">
                            Table
                            {sortBy === 'table_name' && (
                              sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead className="w-32">Record ID</TableHead>
                        <TableHead className="min-w-64">Details & Changes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-mono text-xs whitespace-nowrap">
                            {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm:ss')}
                          </TableCell>
                          <TableCell className="min-w-32">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm truncate">{log.user_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={log.action === 'INSERT' ? 'default' : log.action === 'UPDATE' ? 'secondary' : 'destructive'}
                              className="text-xs"
                            >
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {tableDisplayNames[log.table_name as keyof typeof tableDisplayNames] || log.table_name}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {log.record_id.split('-')[0]}...
                          </TableCell>
                          <TableCell>
                            <div className="max-w-sm text-xs">
                              <div className="font-medium text-foreground mb-1">
                                {formatLogChanges(log)}
                              </div>
                              <div className="text-muted-foreground text-xs">
                                {format(new Date(log.created_at), 'MMM dd, HH:mm:ss')}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalLogs)} of {totalLogs} entries
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          className="w-9 h-9"
                          onClick={() => handlePageChange(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};