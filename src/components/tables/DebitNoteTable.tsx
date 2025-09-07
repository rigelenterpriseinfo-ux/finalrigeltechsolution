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

interface DebitNote {
  id: string;
  debit_note_number: string;
  debit_note_date: string;
  supplier_name: string;
  reason: string;
  total_amount: number;
  status: string;
  created_at: string;
}

interface DebitNoteTableProps {
  debitNotes: DebitNote[];
  onView: (debitNote: DebitNote) => void;
  onEdit: (debitNote: DebitNote) => void;
  onDelete: (debitNote: DebitNote) => void;
}

export function DebitNoteTable({ debitNotes, onView, onEdit, onDelete }: DebitNoteTableProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (debitNotes.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No debit notes found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Debit Note #</TableHead>
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
          {debitNotes.map((debitNote) => (
            <TableRow key={debitNote.id}>
              <TableCell className="font-medium">
                {debitNote.debit_note_number}
              </TableCell>
              <TableCell>
                {format(new Date(debitNote.debit_note_date), "MMM dd, yyyy")}
              </TableCell>
              <TableCell>{debitNote.supplier_name}</TableCell>
              <TableCell className="max-w-xs truncate">
                {debitNote.reason}
              </TableCell>
              <TableCell className="font-medium">
                ₹{debitNote.total_amount.toFixed(2)}
              </TableCell>
              <TableCell>
                <Badge className={getStatusColor(debitNote.status)}>
                  {debitNote.status.charAt(0).toUpperCase() + debitNote.status.slice(1)}
                </Badge>
              </TableCell>
              <TableCell>
                {format(new Date(debitNote.created_at), "MMM dd, yyyy")}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end space-x-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onView(debitNote)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(debitNote)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(debitNote)}
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