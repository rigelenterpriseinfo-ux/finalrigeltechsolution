import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  RefreshCw,
  Download,
  Filter,
  BarChart3,
  PieChart
} from 'lucide-react';

interface ReconciliationData {
  ap_summary: {
    total_debit_notes: number;
    total_debit_amount: number;
    outstanding_debit_notes: number;
    outstanding_amount: number;
    settlement_rate: number;
  };
  ar_summary: {
    total_rsos: number;
    total_rso_amount: number;
    pending_credit_notes: number;
    pending_amount: number;
    processing_rate: number;
  };
  aging_analysis: {
    ap_aging: { range: string; count: number; amount: number }[];
    ar_aging: { range: string; count: number; amount: number }[];
  };
  trends: {
    monthly_ap: { month: string; amount: number }[];
    monthly_ar: { month: string; amount: number }[];
  };
}

export function APARReconciliationDashboard() {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [reconciliationData, setReconciliationData] = useState<ReconciliationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (profile?.company_id) {
      loadReconciliationData();
    }
  }, [profile?.company_id]);

  const loadReconciliationData = async () => {
    try {
      setLoading(true);
      
      // Load debit notes data
      const { data: debitNotes, error: dnError } = await supabase
        .from('debit_notes')
        .select(`
          *,
          supplier_credit_notes:supplier_credit_notes(total_amount)
        `)
        .eq('company_id', profile?.company_id);

      if (dnError) throw dnError;

      // Load RSOs data
      const { data: rsos, error: rsoError } = await supabase
        .from('return_order_header')
        .select('*')
        .eq('company_id', profile?.company_id);

      if (rsoError) throw rsoError;

      // Load credit notes data
      const { data: creditNotes, error: cnError } = await supabase
        .from('credit_notes')
        .select('*')
        .eq('company_id', profile?.company_id);

      if (cnError) throw cnError;

      // Process the data
      const processedData = processReconciliationData(debitNotes, rsos, creditNotes);
      setReconciliationData(processedData);

    } catch (error) {
      console.error('Error loading reconciliation data:', error);
      toast({
        title: "Error",
        description: "Failed to load reconciliation data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const processReconciliationData = (debitNotes: any[], rsos: any[], creditNotes: any[]): ReconciliationData => {
    // Process AP data
    const totalDebitNotes = debitNotes.length;
    const totalDebitAmount = debitNotes.reduce((sum, dn) => sum + (dn.total_amount || 0), 0);
    
    let outstandingDebitNotes = 0;
    let outstandingAmount = 0;
    
    debitNotes.forEach(dn => {
      const creditTotal = (dn.supplier_credit_notes || [])
        .reduce((sum: number, cn: any) => sum + (cn.total_amount || 0), 0);
      const balance = dn.total_amount - creditTotal;
      
      if (balance > 0) {
        outstandingDebitNotes++;
        outstandingAmount += balance;
      }
    });

    const settlementRate = totalDebitNotes > 0 ? 
      ((totalDebitNotes - outstandingDebitNotes) / totalDebitNotes) * 100 : 0;

    // Process AR data
    const totalRsos = rsos.length;
    const totalRsoAmount = rsos.reduce((sum, rso) => sum + (rso.total_amount || 0), 0);
    
    const rsoIdsWithCreditNotes = new Set(creditNotes.map(cn => cn.rso_id).filter(Boolean));
    const pendingRsos = rsos.filter(rso => !rsoIdsWithCreditNotes.has(rso.id));
    const pendingCreditNotes = pendingRsos.length;
    const pendingAmount = pendingRsos.reduce((sum, rso) => sum + (rso.total_amount || 0), 0);
    
    const processingRate = totalRsos > 0 ? 
      ((totalRsos - pendingCreditNotes) / totalRsos) * 100 : 0;

    // Aging analysis (simplified)
    const currentDate = new Date();
    const thirtyDaysAgo = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(currentDate.getTime() - 60 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(currentDate.getTime() - 90 * 24 * 60 * 60 * 1000);

    const apAging = [
      { range: '0-30 days', count: 0, amount: 0 },
      { range: '31-60 days', count: 0, amount: 0 },
      { range: '61-90 days', count: 0, amount: 0 },
      { range: '90+ days', count: 0, amount: 0 }
    ];

    const arAging = [
      { range: '0-30 days', count: 0, amount: 0 },
      { range: '31-60 days', count: 0, amount: 0 },
      { range: '61-90 days', count: 0, amount: 0 },
      { range: '90+ days', count: 0, amount: 0 }
    ];

    // Process aging for outstanding debit notes
    debitNotes.forEach(dn => {
      const creditTotal = (dn.supplier_credit_notes || [])
        .reduce((sum: number, cn: any) => sum + (cn.total_amount || 0), 0);
      const balance = dn.total_amount - creditTotal;
      
      if (balance > 0) {
        const dnDate = new Date(dn.debit_note_date);
        const daysDiff = Math.floor((currentDate.getTime() - dnDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 30) {
          apAging[0].count++;
          apAging[0].amount += balance;
        } else if (daysDiff <= 60) {
          apAging[1].count++;
          apAging[1].amount += balance;
        } else if (daysDiff <= 90) {
          apAging[2].count++;
          apAging[2].amount += balance;
        } else {
          apAging[3].count++;
          apAging[3].amount += balance;
        }
      }
    });

    // Process aging for pending RSOs
    pendingRsos.forEach(rso => {
      const rsoDate = new Date(rso.rso_date);
      const daysDiff = Math.floor((currentDate.getTime() - rsoDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff <= 30) {
        arAging[0].count++;
        arAging[0].amount += rso.total_amount;
      } else if (daysDiff <= 60) {
        arAging[1].count++;
        arAging[1].amount += rso.total_amount;
      } else if (daysDiff <= 90) {
        arAging[2].count++;
        arAging[2].amount += rso.total_amount;
      } else {
        arAging[3].count++;
        arAging[3].amount += rso.total_amount;
      }
    });

    // Mock monthly trends (in real implementation, this would be calculated from historical data)
    const monthlyAP = [
      { month: 'Jan', amount: totalDebitAmount * 0.8 },
      { month: 'Feb', amount: totalDebitAmount * 0.9 },
      { month: 'Mar', amount: totalDebitAmount },
    ];

    const monthlyAR = [
      { month: 'Jan', amount: totalRsoAmount * 0.7 },
      { month: 'Feb', amount: totalRsoAmount * 0.85 },
      { month: 'Mar', amount: totalRsoAmount },
    ];

    return {
      ap_summary: {
        total_debit_notes: totalDebitNotes,
        total_debit_amount: totalDebitAmount,
        outstanding_debit_notes: outstandingDebitNotes,
        outstanding_amount: outstandingAmount,
        settlement_rate: settlementRate
      },
      ar_summary: {
        total_rsos: totalRsos,
        total_rso_amount: totalRsoAmount,
        pending_credit_notes: pendingCreditNotes,
        pending_amount: pendingAmount,
        processing_rate: processingRate
      },
      aging_analysis: {
        ap_aging: apAging,
        ar_aging: arAging
      },
      trends: {
        monthly_ap: monthlyAP,
        monthly_ar: monthlyAR
      }
    };
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!reconciliationData) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">No reconciliation data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">AP/AR Reconciliation Dashboard</h2>
          <p className="text-muted-foreground">Complete visibility into accounts payable and receivable</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={loadReconciliationData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Settlement Rate (AP)</p>
                <p className="text-2xl font-bold text-green-600">
                  {reconciliationData.ap_summary.settlement_rate.toFixed(1)}%
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <Progress value={reconciliationData.ap_summary.settlement_rate} className="w-12" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Processing Rate (AR)</p>
                <p className="text-2xl font-bold text-blue-600">
                  {reconciliationData.ar_summary.processing_rate.toFixed(1)}%
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-blue-500" />
                <Progress value={reconciliationData.ar_summary.processing_rate} className="w-12" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Outstanding AP</p>
                <p className="text-2xl font-bold text-red-600">
                  ₹{reconciliationData.ap_summary.outstanding_amount.toLocaleString()}
                </p>
              </div>
              <AlertCircle className="h-5 w-5 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending AR</p>
                <p className="text-2xl font-bold text-orange-600">
                  ₹{reconciliationData.ar_summary.pending_amount.toLocaleString()}
                </p>
              </div>
              <Clock className="h-5 w-5 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="aging">Aging Analysis</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* AP Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                  Accounts Payable Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Total Debit Notes</span>
                  <Badge variant="outline">{reconciliationData.ap_summary.total_debit_notes}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Total Amount</span>
                  <span className="font-medium">₹{reconciliationData.ap_summary.total_debit_amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Outstanding Notes</span>
                  <Badge variant="destructive">{reconciliationData.ap_summary.outstanding_debit_notes}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Outstanding Amount</span>
                  <span className="font-medium text-red-600">₹{reconciliationData.ap_summary.outstanding_amount.toLocaleString()}</span>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Settlement Rate</span>
                    <span className="font-bold text-green-600">{reconciliationData.ap_summary.settlement_rate.toFixed(1)}%</span>
                  </div>
                  <Progress value={reconciliationData.ap_summary.settlement_rate} className="mt-2" />
                </div>
              </CardContent>
            </Card>

            {/* AR Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  Accounts Receivable Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Total RSOs</span>
                  <Badge variant="outline">{reconciliationData.ar_summary.total_rsos}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Total Amount</span>
                  <span className="font-medium">₹{reconciliationData.ar_summary.total_rso_amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Pending Credit Notes</span>
                  <Badge variant="secondary">{reconciliationData.ar_summary.pending_credit_notes}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Pending Amount</span>
                  <span className="font-medium text-orange-600">₹{reconciliationData.ar_summary.pending_amount.toLocaleString()}</span>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Processing Rate</span>
                    <span className="font-bold text-blue-600">{reconciliationData.ar_summary.processing_rate.toFixed(1)}%</span>
                  </div>
                  <Progress value={reconciliationData.ar_summary.processing_rate} className="mt-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="aging">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* AP Aging */}
            <Card>
              <CardHeader>
                <CardTitle>AP Aging Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Age Range</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reconciliationData.aging_analysis.ap_aging.map((aging, index) => (
                      <TableRow key={index}>
                        <TableCell>{aging.range}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={index >= 2 ? 'destructive' : 'outline'}>
                            {aging.count}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ₹{aging.amount.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* AR Aging */}
            <Card>
              <CardHeader>
                <CardTitle>AR Aging Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Age Range</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reconciliationData.aging_analysis.ar_aging.map((aging, index) => (
                      <TableRow key={index}>
                        <TableCell>{aging.range}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={index >= 2 ? 'destructive' : 'outline'}>
                            {aging.count}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ₹{aging.amount.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Monthly AP Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly AP Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {reconciliationData.trends.monthly_ap.map((trend, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span>{trend.month}</span>
                      <span className="font-medium">₹{trend.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Monthly AR Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly AR Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {reconciliationData.trends.monthly_ar.map((trend, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span>{trend.month}</span>
                      <span className="font-medium">₹{trend.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}