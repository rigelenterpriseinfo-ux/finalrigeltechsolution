import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { DocumentFormatDialog } from '@/components/dialogs/DocumentFormatDialog';

interface DocumentFormatConfig {
  id: string;
  company_id: string;
  document_type: string;
  prefix: string;
  current_counter: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const DOCUMENT_TYPE_LABELS = {
  purchase_order: 'Purchase Order',
  sales_order: 'Sales Order',
  invoice: 'Invoice',
  debit_note: 'Debit Note',
  credit_note: 'Credit Note',
  customer_id: 'Customer ID',
  supplier_id: 'Supplier ID',
  grn: 'GRN',
  return_sales_order: 'Return Sales Order',
};

export const DocumentFormatsTable: React.FC = () => {
  const { company } = useAuth();
  const { toast } = useToast();
  const [configs, setConfigs] = useState<DocumentFormatConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<DocumentFormatConfig | null>(null);

  useEffect(() => {
    if (company?.id) {
      fetchConfigs();
    }
  }, [company?.id]);

  const fetchConfigs = async () => {
    if (!company?.id) return;

    try {
      const { data, error } = await supabase
        .from('document_format_configs')
        .select('*')
        .eq('company_id', company.id)
        .order('document_type');

      if (error) throw error;
      setConfigs(data || []);
    } catch (error) {
      console.error('Error fetching document format configs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load document format configurations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (config: DocumentFormatConfig) => {
    setEditingConfig(config);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingConfig(null);
    setDialogOpen(true);
  };


  const generatePreview = (config: DocumentFormatConfig) => {
    if (!config.prefix) return 'N/A';
    return `${config.prefix}${config.current_counter}`;
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Document Formats</h3>
        <Button onClick={handleCreate} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Format
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
              <TableRow>
                <TableHead>Document Type</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Current Counter</TableHead>
                <TableHead>Preview</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
          </TableHeader>
          <TableBody>
            {configs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No document format configurations found. Click "Add Format" to create your first configuration.
                </TableCell>
              </TableRow>
            ) : (
              configs.map((config) => (
                <TableRow key={config.id}>
                  <TableCell className="font-medium">
                    {DOCUMENT_TYPE_LABELS[config.document_type as keyof typeof DOCUMENT_TYPE_LABELS]}
                  </TableCell>
                  <TableCell>
                    <code className="bg-muted px-2 py-1 rounded text-sm">
                      {config.prefix || '(none)'}
                    </code>
                  </TableCell>
                  <TableCell>{config.current_counter}</TableCell>
                  <TableCell>
                    <code className="bg-muted px-2 py-1 rounded text-sm font-medium">
                      {generatePreview(config)}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge variant={config.is_active ? 'default' : 'secondary'}>
                      {config.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(config)}
                        className="h-8 w-8 p-0"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(config)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <DocumentFormatDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        config={editingConfig}
        onSuccess={() => {
          fetchConfigs();
          setDialogOpen(false);
          setEditingConfig(null);
        }}
      />
    </div>
  );
};