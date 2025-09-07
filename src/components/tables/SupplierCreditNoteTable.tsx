import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Eye, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface SupplierCreditNote {
  id: string;
  supplier_credit_note_number: string;
  supplier_credit_note_date: string;
  supplier_name: string;
  reason: string;
  total_amount: number;
  status: string;
  created_at: string;
}

interface SupplierCreditNoteTableProps {
  supplierCreditNotes: SupplierCreditNote[];
  onView: (creditNote: SupplierCreditNote) => void;
  onEdit: (creditNote: SupplierCreditNote) => void;
  onDelete: (creditNote: SupplierCreditNote) => void;
}

export function SupplierCreditNoteTable({ supplierCreditNotes, onView, onEdit, onDelete }: SupplierCreditNoteTableProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'received':
        return 'bg-blue-100 text-blue-800';
      case 'processed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (supplierCreditNotes.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No supplier credit notes found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Credit Note #</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {supplierCreditNotes.map((creditNote) => (
            <TableRow key={creditNote.id}>
              <TableCell className="font-medium">
                {creditNote.supplier_credit_note_number}
              </TableCell>
              <TableCell>
                {format(new Date(creditNote.supplier_credit_note_date), "MMM dd, yyyy")}
              </TableCell>
              <TableCell>{creditNote.supplier_name}</TableCell>
              <TableCell className="max-w-xs truncate">
                {creditNote.reason}
              </TableCell>
              <TableCell className="font-medium">
                ₹{creditNote.total_amount.toFixed(2)}
              </TableCell>
              <TableCell>
                <Badge className={getStatusColor(creditNote.status)}>
                  {creditNote.status.charAt(0).toUpperCase() + creditNote.status.slice(1)}
                </Badge>
              </TableCell>
              <TableCell>
                {format(new Date(creditNote.created_at), "MMM dd, yyyy")}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end space-x-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onView(creditNote)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(creditNote)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(creditNote)}
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
  );
}