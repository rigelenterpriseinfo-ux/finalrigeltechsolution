import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Edit, Trash2, Search, Download, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { WarehouseBinForm } from '@/components/forms/WarehouseBinForm';
import * as XLSX from 'xlsx';

interface WarehouseBin {
  id: string;
  wh_bin_code: string;
  bin_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function WarehouseBinTable() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [bins, setBins] = useState<WarehouseBin[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingBin, setEditingBin] = useState<WarehouseBin | null>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    fetchBins();
  }, []);

  const fetchBins = async () => {
    try {
      const { data, error } = await supabase
        .from('warehouse_bins')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching warehouse bins:', error);
        return;
      }

      setBins(data || []);
    } catch (error) {
      console.error('Error fetching warehouse bins:', error);
    } finally {
      setLoading(false);
    }
  };

  // Sort function
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (columnKey: string) => {
    if (!sortConfig || sortConfig.key !== columnKey) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortConfig.direction === 'asc' ? 
      <ArrowUp className="h-4 w-4" /> : 
      <ArrowDown className="h-4 w-4" />;
  };

  // Enhanced search and sort functionality
  const filteredBins = useMemo(() => {
    let filtered = bins.filter(bin =>
      bin.wh_bin_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bin.bin_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Apply sorting
    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortConfig.key) {
          case 'wh_bin_code':
            aValue = a.wh_bin_code;
            bValue = b.wh_bin_code;
            break;
          case 'bin_name':
            aValue = a.bin_name;
            bValue = b.bin_name;
            break;
          case 'is_active':
            aValue = a.is_active;
            bValue = b.is_active;
            break;
          case 'created_at':
            aValue = new Date(a.created_at);
            bValue = new Date(b.created_at);
            break;
          default:
            return 0;
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [bins, searchTerm, sortConfig]);

  // Reset to first page when search or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortConfig]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredBins.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentBins = filteredBins.slice(startIndex, endIndex);

  // Pagination handlers
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const goToPrevious = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const goToNext = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const handleEditBin = (bin: WarehouseBin) => {
    setEditingBin(bin);
    setShowEditDialog(true);
  };

  const handleDeleteBin = async (binId: string) => {
    if (!window.confirm('Are you sure you want to delete this warehouse bin?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('warehouse_bins')
        .delete()
        .eq('id', binId);

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Warehouse bin deleted successfully",
      });

      fetchBins();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete warehouse bin",
        variant: "destructive",
      });
    }
  };

  const exportToExcel = () => {
    try {
      // Prepare data for export
      const exportData = filteredBins.map(bin => ({
        'WH BIN Code': bin.wh_bin_code,
        'Bin Name': bin.bin_name,
        'Status': bin.is_active ? 'Active' : 'Inactive',
        'Created Date': new Date(bin.created_at).toLocaleDateString('en-IN'),
        'Last Updated': new Date(bin.updated_at).toLocaleDateString('en-IN')
      }));

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Auto-size columns
      const colWidths = Object.keys(exportData[0] || {}).map(key => ({
        wch: Math.max(key.length, 15)
      }));
      worksheet['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Warehouse_Bins');

      // Generate filename with current date
      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `Warehouse_Bins_Export_${currentDate}.xlsx`;

      // Save file
      XLSX.writeFile(workbook, filename);

      toast({
        title: "Export Successful",
        description: `${filteredBins.length} warehouse bins exported to ${filename}`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: "An error occurred while exporting the data",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Export Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search bins..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={exportToExcel} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export Excel
        </Button>
      </div>

      {/* Bins Table */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 select-none"
                onClick={() => handleSort('wh_bin_code')}
              >
                <div className="flex items-center gap-2">
                  WH BIN Code
                  {getSortIcon('wh_bin_code')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 select-none"
                onClick={() => handleSort('bin_name')}
              >
                <div className="flex items-center gap-2">
                  Bin Name
                  {getSortIcon('bin_name')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 select-none"
                onClick={() => handleSort('is_active')}
              >
                <div className="flex items-center gap-2">
                  Status
                  {getSortIcon('is_active')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 select-none"
                onClick={() => handleSort('created_at')}
              >
                <div className="flex items-center gap-2">
                  Created Date
                  {getSortIcon('created_at')}
                </div>
              </TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentBins.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  {searchTerm ? 'No bins found matching your search.' : 'No warehouse bins found. Create your first bin to get started.'}
                </TableCell>
              </TableRow>
            ) : (
              currentBins.map((bin) => (
                <TableRow key={bin.id}>
                  <TableCell className="font-mono font-medium">
                    {bin.wh_bin_code}
                  </TableCell>
                  <TableCell>{bin.bin_name}</TableCell>
                  <TableCell>
                    <Badge variant={bin.is_active ? "default" : "secondary"}>
                      {bin.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(bin.created_at).toLocaleDateString('en-IN')}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditBin(bin)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteBin(bin.id)}
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
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1} to {Math.min(endIndex, filteredBins.length)} of {filteredBins.length} entries
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPrevious}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            
            <div className="flex items-center gap-1">
              {getPageNumbers().map((page, index) => (
                <React.Fragment key={index}>
                  {page === '...' ? (
                    <span className="px-2 py-1 text-sm text-muted-foreground">...</span>
                  ) : (
                    <Button
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => goToPage(page as number)}
                      className="w-8 h-8 p-0"
                    >
                      {page}
                    </Button>
                  )}
                </React.Fragment>
              ))}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={goToNext}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <WarehouseBinForm
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSuccess={() => {
          fetchBins();
          setEditingBin(null);
        }}
        editingBin={editingBin}
      />
    </div>
  );
}