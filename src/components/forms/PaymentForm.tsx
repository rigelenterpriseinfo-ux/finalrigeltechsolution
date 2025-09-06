import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PaymentFormProps {
  mode: 'create' | 'edit';
  payment?: any;
  recordId: string;
  recordType: 'grn' | 'sales_invoice';
  onSave: () => void;
  onCancel: () => void;
  companyId: string;
  maxAmount?: number;
}

export const PaymentForm: React.FC<PaymentFormProps> = ({
  mode,
  payment,
  recordId,
  recordType,
  onSave,
  onCancel,
  companyId,
  maxAmount
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    amount: payment?.amount || '',
    payment_method: payment?.payment_method || '',
    payment_date: payment?.payment_date || new Date().toISOString().split('T')[0],
    reference_number: payment?.reference_number || '',
    payment_type: payment?.payment_type || 'regular',
    notes: payment?.notes || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        toast({
          title: "Error",
          description: "Please enter a valid amount",
          variant: "destructive"
        });
        return;
      }

      if (maxAmount && amount > maxAmount) {
        toast({
          title: "Error", 
          description: `Amount cannot exceed ₹${maxAmount.toLocaleString()}`,
          variant: "destructive"
        });
        return;
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to record payments",
          variant: "destructive"
        });
        return;
      }

      const paymentData = {
        amount,
        payment_method: formData.payment_method,
        payment_date: formData.payment_date,
        reference_number: formData.reference_number,
        payment_type: formData.payment_type,
        notes: formData.notes,
        company_id: companyId,
        created_by: user.id,
        payment_status: 'completed',
        ...(recordType === 'grn' ? { grn_id: recordId } : { sales_invoice_id: recordId })
      };

      if (mode === 'create') {
        const { error } = await supabase
          .from('payments')
          .insert(paymentData);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Payment recorded successfully"
        });
      } else {
        const { error } = await supabase
          .from('payments')
          .update({
            amount: paymentData.amount,
            payment_method: paymentData.payment_method,
            payment_date: paymentData.payment_date,
            reference_number: paymentData.reference_number,
            payment_type: paymentData.payment_type,
            notes: paymentData.notes
          })
          .eq('id', payment.id);

        if (error) throw error;

        toast({
          title: "Success", 
          description: "Payment updated successfully"
        });
      }

      onSave();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="amount">Amount *</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            required
          />
        </div>
        
        <div>
          <Label htmlFor="payment_type">Payment Type</Label>
          <Select value={formData.payment_type} onValueChange={(value) => setFormData({ ...formData, payment_type: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="advance">Advance Payment</SelectItem>
              <SelectItem value="regular">Regular Payment</SelectItem>
              <SelectItem value="final">Final Payment</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="payment_method">Payment Method *</Label>
          <Select value={formData.payment_method} onValueChange={(value) => setFormData({ ...formData, payment_method: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Cash">Cash</SelectItem>
              <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
              <SelectItem value="Cheque">Cheque</SelectItem>
              <SelectItem value="UPI">UPI</SelectItem>
              <SelectItem value="Card">Card</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="payment_date">Payment Date *</Label>
          <Input
            id="payment_date"
            type="date"
            value={formData.payment_date}
            onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="reference_number">Reference Number</Label>
        <Input
          id="reference_number"
          placeholder="Payment reference"
          value={formData.reference_number}
          onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          placeholder="Additional notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : mode === 'create' ? 'Record Payment' : 'Update Payment'}
        </Button>
      </div>
    </form>
  );
};