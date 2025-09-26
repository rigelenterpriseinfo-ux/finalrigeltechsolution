import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, Download, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

interface BulkUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | undefined;
  onUploadComplete: () => void;
}

interface UploadProgress {
  status: 'idle' | 'processing' | 'completed' | 'error';
  total: number;
  processed: number;
  successful: number;
  failed: number;
  errors: Array<{ row: number; error: string; data?: any }>;
}

export function BulkUploadDialog({ open, onOpenChange, companyId, onUploadComplete }: BulkUploadDialogProps) {
  const { toast } = useToast();
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    status: 'idle',
    total: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    errors: []
  });

  // Download template for bulk upload
  const downloadTemplate = () => {
    const templateData = [{
      'SKU': 'SAMPLE-001',
      'Name': 'Sample Product',
      'Description': 'Sample product description',
      'Type': 'goods', // goods or service
      'Category': 'raw_material', // raw_material, work_in_progress, finished_goods, service
      'Unit': 'pcs',
      'Cost Price': 100,
      'Unit Price': 150,
      'HSN Code': '1234',
      'GST %': 18,
      'Min Stock': 10,
      'Max Stock': 100,
      'Weight (kg)': 1.5,
      'Length (cm)': 10,
      'Width (cm)': 5,
      'Height (cm)': 2,
      'Status': 'Active' // Active or Inactive
    }];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    
    // Add instructions as comments or in a separate sheet
    const instructionsData = [
      { Field: 'SKU', Description: 'Unique product identifier', Required: 'Yes', Example: 'PROD-001' },
      { Field: 'Name', Description: 'Product name', Required: 'Yes', Example: 'Sample Product' },
      { Field: 'Type', Description: 'Product type', Required: 'Yes', Example: 'goods or service' },
      { Field: 'Category', Description: 'Product category', Required: 'Yes', Example: 'raw_material, work_in_progress, finished_goods, service' },
      { Field: 'Unit', Description: 'Unit of measure', Required: 'No', Example: 'pcs, kg, liters' },
      { Field: 'Cost Price', Description: 'Product cost price', Required: 'Yes', Example: '100' },
      { Field: 'Unit Price', Description: 'Selling price', Required: 'Yes', Example: '150' },
      { Field: 'Status', Description: 'Product status', Required: 'No', Example: 'Active or Inactive (default: Active)' }
    ];
    
    const instructionsSheet = XLSX.utils.json_to_sheet(instructionsData);
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');
    
    XLSX.writeFile(workbook, 'products_bulk_upload_template.xlsx');
    
    toast({
      title: "Template Downloaded",
      description: "Fill the template with your product data and upload it back.",
    });
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
          file.type === 'application/vnd.ms-excel') {
        setUploadFile(file);
        setUploadProgress(prev => ({ ...prev, status: 'idle', errors: [] }));
      } else {
        toast({
          title: "Invalid File Type",
          description: "Please upload an Excel file (.xlsx or .xls)",
          variant: "destructive"
        });
      }
    }
  };

  // Process bulk upload
  const processBulkUpload = async () => {
    if (!uploadFile || !companyId) return;

    setUploadProgress(prev => ({ 
      ...prev, 
      status: 'processing', 
      total: 0, 
      processed: 0, 
      successful: 0, 
      failed: 0, 
      errors: [] 
    }));

    try {
      const arrayBuffer = await uploadFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        throw new Error('No data found in the uploaded file');
      }

      setUploadProgress(prev => ({ ...prev, total: jsonData.length }));

      const results = {
        successful: 0,
        failed: 0,
        errors: [] as Array<{ row: number; error: string; data?: any }>
      };

      // Process each row
      for (let i = 0; i < jsonData.length; i++) {
        const rowData = jsonData[i] as any;
        const rowNumber = i + 2; // +2 because Excel starts at 1 and we have header

        try {
          // Validate required fields
          if (!rowData.SKU || !rowData.Name || !rowData['Cost Price'] || !rowData['Unit Price']) {
            throw new Error('Missing required fields: SKU, Name, Cost Price, or Unit Price');
          }

          // Prepare product data
          const productData = {
            company_id: companyId,
            sku: String(rowData.SKU).trim(),
            name: String(rowData.Name).trim(),
            description: rowData.Description ? String(rowData.Description).trim() : null,
            product_type: rowData.Type === 'service' ? 'service' : 'goods',
            product_category: rowData.Category || 'raw_material',
            unit: rowData.Unit ? String(rowData.Unit).trim() : 'pcs',
            cost_price: Number(rowData['Cost Price']) || 0,
            unit_price: Number(rowData['Unit Price']) || 0,
            mrp: rowData.MRP ? Number(rowData.MRP) : null,
            hsn_code: rowData['HSN Code'] ? String(rowData['HSN Code']).trim() : null,
            gst_percentage: Number(rowData['GST %']) || 0,
            min_stock_level: Number(rowData['Min Stock']) || 0,
            max_stock_level: rowData['Max Stock'] ? Number(rowData['Max Stock']) : null,
            weight_kg: rowData['Weight (kg)'] ? Number(rowData['Weight (kg)']) : null,
            length_cm: rowData['Length (cm)'] ? Number(rowData['Length (cm)']) : null,
            width_cm: rowData['Width (cm)'] ? Number(rowData['Width (cm)']) : null,
            height_cm: rowData['Height (cm)'] ? Number(rowData['Height (cm)']) : null,
            is_active: rowData.Status === 'Inactive' ? false : true,
            stock_quantity: 0
          };

          // Check if product with SKU already exists
          const { data: existingProduct } = await supabase
            .from('products')
            .select('id')
            .eq('company_id', companyId)
            .eq('sku', productData.sku)
            .maybeSingle();

          let result;
          if (existingProduct) {
            // Update existing product
            result = await supabase
              .from('products')
              .update(productData)
              .eq('id', existingProduct.id);
          } else {
            // Insert new product
            result = await supabase
              .from('products')
              .insert(productData);
          }

          if (result.error) {
            throw new Error(result.error.message);
          }

          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            row: rowNumber,
            error: error instanceof Error ? error.message : 'Unknown error',
            data: rowData
          });
        }

        // Update progress
        setUploadProgress(prev => ({
          ...prev,
          processed: i + 1,
          successful: results.successful,
          failed: results.failed,
          errors: results.errors
        }));

        // Small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      setUploadProgress(prev => ({ ...prev, status: 'completed' }));
      
      // Refresh products list
      onUploadComplete();
      
      toast({
        title: "Bulk Upload Completed",
        description: `Successfully processed ${results.successful} products. ${results.failed} failed.`,
      });

    } catch (error) {
      setUploadProgress(prev => ({ 
        ...prev, 
        status: 'error',
        errors: [{ row: 0, error: error instanceof Error ? error.message : 'Upload failed' }]
      }));
      
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : 'Failed to process upload',
        variant: "destructive"
      });
    }
  };

  const resetDialog = () => {
    setUploadFile(null);
    setUploadProgress({
      status: 'idle',
      total: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      errors: []
    });
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) resetDialog();
    }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Upload Products</DialogTitle>
          <DialogDescription>
            Upload an Excel file to add or update multiple products at once
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {uploadProgress.status === 'idle' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                <div className="text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="mt-4">
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <span className="mt-2 block text-sm font-medium text-gray-900">
                        Choose an Excel file or drag and drop
                      </span>
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        className="sr-only"
                        accept=".xlsx,.xls"
                        onChange={handleFileUpload}
                      />
                    </label>
                    <p className="mt-1 text-xs text-gray-500">
                      XLSX or XLS up to 10MB
                    </p>
                  </div>
                </div>
              </div>
              
              {uploadFile && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                    <span className="text-sm font-medium text-green-800">
                      File selected: {uploadFile.name}
                    </span>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-800 mb-2">Instructions:</h4>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• Download the template first and fill in your data</li>
                  <li>• SKU, Name, Cost Price, and Unit Price are required fields</li>
                  <li>• Existing products (same SKU) will be updated</li>
                  <li>• New products will be created</li>
                  <li>• Use the provided categories and product types</li>
                </ul>
              </div>
            </div>
          )}

          {uploadProgress.status === 'processing' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-800 mb-2">Processing Upload...</h4>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(uploadProgress.processed / uploadProgress.total) * 100}%` }}
                  ></div>
                </div>
                <div className="mt-2 text-xs text-blue-700">
                  Progress: {uploadProgress.processed} / {uploadProgress.total} 
                  ({Math.round((uploadProgress.processed / uploadProgress.total) * 100)}%)
                </div>
              </div>
            </div>
          )}

          {uploadProgress.status === 'completed' && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <h4 className="text-sm font-medium text-green-800">Upload Completed!</h4>
                </div>
                <div className="grid grid-cols-3 gap-4 text-xs text-green-700">
                  <div>Total: {uploadProgress.total}</div>
                  <div>Successful: {uploadProgress.successful}</div>
                  <div>Failed: {uploadProgress.failed}</div>
                </div>
              </div>

              {uploadProgress.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <h4 className="text-sm font-medium text-red-800 mb-2">Errors ({uploadProgress.errors.length}):</h4>
                  <div className="space-y-1">
                    {uploadProgress.errors.slice(0, 10).map((error, index) => (
                      <div key={index} className="text-xs text-red-700">
                        Row {error.row}: {error.error}
                      </div>
                    ))}
                    {uploadProgress.errors.length > 10 && (
                      <div className="text-xs text-red-600 font-medium">
                        ... and {uploadProgress.errors.length - 10} more errors
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {uploadProgress.status === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <XCircle className="h-5 w-5 text-red-500 mr-2" />
                <h4 className="text-sm font-medium text-red-800">Upload Failed</h4>
              </div>
              <div className="text-xs text-red-700">
                {uploadProgress.errors[0]?.error || 'Unknown error occurred'}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between pt-4">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          
          <div className="flex gap-2">
            {uploadProgress.status === 'idle' && (
              <Button onClick={downloadTemplate} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Download Template
              </Button>
            )}
            
            {uploadProgress.status === 'idle' && uploadFile && (
              <Button onClick={processBulkUpload}>
                <Upload className="w-4 h-4 mr-2" />
                Start Upload
              </Button>
            )}

            {uploadProgress.status === 'completed' && uploadProgress.failed > 0 && (
              <Button 
                onClick={() => setUploadProgress(prev => ({ ...prev, status: 'idle' }))}
                variant="outline"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}