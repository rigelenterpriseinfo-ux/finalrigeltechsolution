import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { RotateCcw, FileText, AlertCircle, CheckCircle, Clock, X } from 'lucide-react';
import { APARFilters } from '@/contexts/APARFilterContext';

interface ARSummary {
  total_rsos: number;
  draft_rsos: number;
  confirmed_rsos: number;
  total_rso_amount: number;
  pending_credit_notes: number;
  processed_credit_notes: number;
  total_credit_amount: number;
  pending_credit_amount: number;
}

interface ARDashboardWidgetProps {
  filters?: APARFilters;
  showFilterLabel?: boolean;
  onFilterClear?: () => void;
}

export function ARDashboardWidget({ filters, showFilterLabel = false, onFilterClear }: ARDashboardWidgetProps = {}) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [arSummary, setArSummary] = useState<ARSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.company_id) {
      fetchARSummary();
    }
  }, [profile?.company_id, filters]);

  const fetchARSummary = async () => {
    try {
      setLoading(true);
      
      // Fetch RSOs with filters
      let rsoQuery = supabase
        .from('return_order_header')
        .select('*')
        .eq('company_id', profile?.company_id);

      if (filters?.searchTerm) {
        rsoQuery = rsoQuery.or(`rso_number.ilike.%${filters.searchTerm}%,customer_name.ilike.%${filters.searchTerm}%,invoice_number.ilike.%${filters.searchTerm}%`);
      }

      if (filters?.statusFilter && filters.statusFilter !== 'all') {
        rsoQuery = rsoQuery.eq('status', filters.statusFilter);
      }

      const { data: rsos, error: rsoError } = await rsoQuery;

      if (rsoError) throw rsoError;

      // Fetch Credit Notes
      const { data: creditNotes, error: cnError } = await supabase
        .from('credit_notes')
        .select('*')
        .eq('company_id', profile?.company_id);

      if (cnError) throw cnError;

      // Calculate RSO statistics
      const totalRsos = rsos?.length || 0;
      const draftRsos = rsos?.filter(rso => rso.status === 'Draft').length || 0;
      const confirmedRsos = rsos?.filter(rso => rso.status === 'Confirmed').length || 0;
      const totalRsoAmount = rsos?.reduce((sum, rso) => sum + (rso.total_amount || 0), 0) || 0;

      // Calculate Credit Note statistics
      const processedCreditNotes = creditNotes?.length || 0;
      const totalCreditAmount = creditNotes?.reduce((sum, cn) => sum + (cn.total_amount || 0), 0) || 0;

      // RSOs linked to credit notes
      const rsoIdsWithCreditNotes = new Set(creditNotes?.map(cn => cn.rso_id).filter(Boolean) || []);
      const rsosWithoutCreditNotes = rsos?.filter(rso => !rsoIdsWithCreditNotes.has(rso.id)) || [];
      
      const pendingCreditNotes = rsosWithoutCreditNotes.length;
      const pendingCreditAmount = rsosWithoutCreditNotes
        .reduce((sum, rso) => sum + (rso.total_amount || 0), 0);

      setArSummary({
        total_rsos: totalRsos,
        draft_rsos: draftRsos,
        confirmed_rsos: confirmedRsos,
        total_rso_amount: totalRsoAmount,
        pending_credit_notes: pendingCreditNotes,
        processed_credit_notes: processedCreditNotes,
        total_credit_amount: totalCreditAmount,
        pending_credit_amount: pendingCreditAmount
      });

    } catch (error) {
      console.error('Error fetching AR summary:', error);
      toast({
        title: "Error",
        description: "Failed to fetch accounts receivable summary",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Accounts Receivable (AR)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!arSummary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Accounts Receivable (AR)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-green-600" />
            Accounts Receivable (AR)
          </div>
          {showFilterLabel && filters?.searchTerm && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                Filtered by: {filters.searchTerm}
              </Badge>
              {onFilterClear && (
                <Button variant="ghost" size="sm" onClick={onFilterClear}>
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* RSO Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 p-3 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {arSummary.total_rsos}
            </div>
            <div className="text-sm text-green-600">Total RSOs</div>
          </div>
          
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              ₹{arSummary.total_rso_amount.toLocaleString()}
            </div>
            <div className="text-sm text-blue-600">Total RSO Amount</div>
          </div>
        </div>

        {/* RSO Status */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">RSO Status</h4>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-sm">Draft</span>
              <Badge variant="secondary" className="text-xs">
                {arSummary.draft_rsos}
              </Badge>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">Confirmed</span>
              <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                {arSummary.confirmed_rsos}
              </Badge>
            </div>
          </div>
        </div>

        {/* Credit Note Processing Status */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Credit Note Processing</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <span className="text-sm">Pending</span>
                <Badge variant="destructive" className="text-xs">
                  {arSummary.pending_credit_notes}
                </Badge>
              </div>
              <span className="text-sm font-medium text-orange-600">
                ₹{arSummary.pending_credit_amount.toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-green-500" />
                <span className="text-sm">Processed</span>
                <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                  {arSummary.processed_credit_notes}
                </Badge>
              </div>
              <span className="text-sm font-medium text-green-600">
                ₹{arSummary.total_credit_amount.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Pending Credit Notes Alert */}
        {arSummary.pending_credit_notes > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded p-3">
            <div className="flex items-center gap-2 text-orange-800">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">
                Pending Credit Notes: {arSummary.pending_credit_notes}
              </span>
            </div>
            <p className="text-xs text-orange-600 mt-1">
              ₹{arSummary.pending_credit_amount.toLocaleString()} worth of RSOs awaiting credit note processing
            </p>
          </div>
        )}

        {/* Quick Actions */}
        <div className="pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              // Navigate to Returns module - could be implemented as a prop or context action
              window.location.hash = '#returns';
            }}
          >
            View Returns & Credit Notes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}