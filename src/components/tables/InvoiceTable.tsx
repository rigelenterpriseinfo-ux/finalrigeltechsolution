
import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit, Trash2, Search, ArrowUpDown } from "lucide-react";

interface InvoiceTableProps {
  invoices: any[];
  onEdit: (invoice: any) => void;
  onDelete: (invoiceId: string) => void;
}

type SortField = 'performa_invoice_number' | 'customer_name' | 'performa_invoice_date' | 'total_amount' | 'status' | 'place_of_supply';
type SortDirection = 'asc' | 'desc';

export default function InvoiceTable({ invoices, onEdit, onDelete }: InvoiceTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('performa_invoice_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedInvoices = useMemo(() => {
    let filtered = invoices.filter(invoice =>
      (invoice.performa_invoice_number?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (invoice.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (invoice.place_of_supply?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return filtered.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      // Handle different data types
      if (sortField === 'total_amount') {
        aValue = parseFloat(aValue) || 0;
        bValue = parseFloat(bValue) || 0;
      } else if (sortField === 'performa_invoice_date') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      } else {
        aValue = aValue?.toString().toLowerCase() || '';
        bValue = bValue?.toString().toLowerCase() || '';
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [invoices, searchTerm, sortField, sortDirection]);

  const getStatusBadgeVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'draft':
        return 'secondary';
      case 'invoiced':
        return 'default';
      default:
        return 'outline';
    }
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-gray-50"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        <ArrowUpDown className="h-4 w-4" />
      </div>
    </TableHead>
  );

  if (invoices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-500">No invoices found. Create your first invoice to get started.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Recent Invoices (Top 5)</CardTitle>
          <div className="relative w-72">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search invoices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader field="performa_invoice_number">Invoice #</SortableHeader>
                <SortableHeader field="customer_name">Customer</SortableHeader>
                <SortableHeader field="performa_invoice_date">Date</SortableHeader>
                <SortableHeader field="total_amount">Amount</SortableHeader>
                <SortableHeader field="status">Status</SortableHeader>
                <SortableHeader field="place_of_supply">Place of Supply</SortableHeader>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedInvoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">
                    {invoice.performa_invoice_number || 'DRAFT'}
                  </TableCell>
                  <TableCell>{invoice.customer_name}</TableCell>
                  <TableCell>
                    {new Date(invoice.performa_invoice_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>₹{invoice.total_amount?.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(invoice.status)}>
                      {invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{invoice.place_of_supply || '-'}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(invoice)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(invoice.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
