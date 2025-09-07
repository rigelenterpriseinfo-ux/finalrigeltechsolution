import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";

interface SupplierCreditNoteViewDialogProps {
  supplierCreditNote: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupplierCreditNoteViewDialog({
  supplierCreditNote,
  open,
  onOpenChange,
}: SupplierCreditNoteViewDialogProps) {
  if (!supplierCreditNote) return null;

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Supplier Credit Note Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Information */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Credit Note Number</h3>
                <p className="text-lg font-semibold">{supplierCreditNote.supplier_credit_note_number}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Supplier</h3>
                <p className="font-medium">{supplierCreditNote.supplier_name}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Reason</h3>
                <p>{supplierCreditNote.reason}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Date</h3>
                <p>{format(new Date(supplierCreditNote.supplier_credit_note_date), "MMM dd, yyyy")}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Status</h3>
                <Badge className={getStatusColor(supplierCreditNote.status)}>
                  {supplierCreditNote.status.charAt(0).toUpperCase() + supplierCreditNote.status.slice(1)}
                </Badge>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Created</h3>
                <p>{format(new Date(supplierCreditNote.created_at), "MMM dd, yyyy HH:mm")}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Items Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Items</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Product</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-900">Qty</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-900">Unit Price</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-900">Discount</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-900">Tax</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-900">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {supplierCreditNote.items?.map((item: any, index: number) => (
                    <tr key={index}>
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium">{item.product_name}</div>
                          <div className="text-sm text-gray-500">{item.product_sku}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">{item.quantity}</td>
                      <td className="px-4 py-3 text-right">₹{item.unit_price.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">
                        {item.discount_percentage > 0 && (
                          <div>
                            <div>{item.discount_percentage}%</div>
                            <div className="text-sm text-gray-500">₹{item.discount_amount.toFixed(2)}</div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">₹{item.tax_amount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-medium">₹{item.line_total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Separator />

          {/* Totals Section */}
          <div className="flex justify-end">
            <div className="w-80 space-y-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{supplierCreditNote.subtotal_amount.toFixed(2)}</span>
              </div>
              {supplierCreditNote.discount_amount > 0 && (
                <div className="flex justify-between">
                  <span>Total Discount:</span>
                  <span>-₹{supplierCreditNote.discount_amount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Total Tax:</span>
                <span>₹{supplierCreditNote.tax_amount.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-semibold">
                <span>Total Amount:</span>
                <span>₹{supplierCreditNote.total_amount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          {supplierCreditNote.notes && (
            <>
              <Separator />
              <div>
                <h3 className="text-lg font-semibold mb-2">Notes</h3>
                <p className="text-gray-600">{supplierCreditNote.notes}</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}