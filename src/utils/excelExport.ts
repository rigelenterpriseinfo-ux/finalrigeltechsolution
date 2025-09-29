import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export interface ExportColumn {
  key: string;
  label: string;
  format?: (value: any) => string | number;
}

export interface ExportOptions {
  filename: string;
  sheetName: string;
  columns: ExportColumn[];
  data: any[];
  includeMetadata?: boolean;
  companyName?: string;
}

// Sanitize sheet name to remove invalid Excel characters
const sanitizeSheetName = (name: string): string => {
  // Excel sheet names cannot contain: : \ / ? * [ ]
  // Also limit to 31 characters (Excel limit)
  return name
    .replace(/[:\\/\?\*\[\]]/g, '-')
    .substring(0, 31);
};

export const exportToExcel = ({
  filename,
  sheetName,
  columns,
  data,
  includeMetadata = true,
  companyName
}: ExportOptions) => {
  try {
    // Create workbook
    const workbook = XLSX.utils.book_new();
    
    // Prepare data for export
    const exportData = data.map(row => {
      const exportRow: any = {};
      columns.forEach(col => {
        const value = row[col.key];
        exportRow[col.label] = col.format ? col.format(value) : value;
      });
      return exportRow;
    });

    // Create worksheet from JSON data
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Add metadata if requested
    if (includeMetadata) {
      // Create horizontal metadata in first row
      const metadataRow = [
        companyName || 'Company Report',
        `Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}`,
        `Total Records: ${data.length}`
      ];
      
      // Insert metadata horizontally at the top
      XLSX.utils.sheet_add_aoa(worksheet, [metadataRow, ['']], { origin: 'A1' });
      
      // Get the existing data and shift it down by 2 rows (metadata + empty row)
      const existingData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      const dataStartRow = 3; // Row 3 (0-indexed as 2)
      
      // Clear worksheet and rebuild with proper structure
      const newWorksheet = XLSX.utils.aoa_to_sheet([]);
      
      // Add metadata row
      XLSX.utils.sheet_add_aoa(newWorksheet, [metadataRow], { origin: 'A1' });
      
      // Add empty row
      XLSX.utils.sheet_add_aoa(newWorksheet, [['']], { origin: 'A2' });
      
      // Add column headers
      const headers = columns.map(col => col.label);
      XLSX.utils.sheet_add_aoa(newWorksheet, [headers], { origin: 'A3' });
      
      // Add data starting from row 4
      XLSX.utils.sheet_add_json(newWorksheet, exportData, { 
        origin: 'A4',
        skipHeader: true 
      });
      
      // Replace the original worksheet
      Object.keys(worksheet).forEach(key => delete worksheet[key]);
      Object.assign(worksheet, newWorksheet);
    }

    // Auto-size columns
    const columnWidths = columns.map(col => ({
      wch: Math.max(col.label.length, 15)
    }));
    worksheet['!cols'] = columnWidths;

    // Add worksheet to workbook with sanitized sheet name
    XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName(sheetName));

    // Generate and download file
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    console.error('Export failed:', error);
    return false;
  }
};

export const formatCurrency = (value: number): string => {
  return `₹${value.toFixed(2)}`;
};

export const formatDate = (date: string): string => {
  return format(new Date(date), 'MMM dd, yyyy');
};

export const formatDateTime = (date: string): string => {
  return format(new Date(date), 'MMM dd, yyyy HH:mm');
};