import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Column {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
  format?: (value: any) => React.ReactNode;
  className?: string;
}

interface EnhancedTableProps {
  columns: Column[];
  data: any[];
  loading?: boolean;
  emptyMessage?: string;
  stickyHeader?: boolean;
}

export function EnhancedTable({ 
  columns, 
  data, 
  loading = false,
  emptyMessage = 'No data available',
  stickyHeader = true 
}: EnhancedTableProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => (
                <TableHead key={column.key} className={cn(
                  column.align === 'right' && 'text-right',
                  column.align === 'center' && 'text-center'
                )}>
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                {columns.map((column) => (
                  <TableCell key={column.key}>
                    <div className="h-4 bg-muted rounded animate-pulse" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border/50 p-12 text-center">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      <div className={cn('overflow-auto', stickyHeader && 'max-h-[600px]')}>
        <Table>
          <TableHeader className={cn(stickyHeader && 'sticky top-0 z-10 bg-muted/80 backdrop-blur-sm')}>
            <TableRow className="hover:bg-transparent border-b border-border/50">
              {columns.map((column) => (
                <TableHead 
                  key={column.key} 
                  className={cn(
                    'font-semibold text-foreground',
                    column.align === 'right' && 'text-right',
                    column.align === 'center' && 'text-center',
                    column.className
                  )}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, index) => (
              <TableRow 
                key={index}
                className={cn(
                  'transition-colors hover:bg-muted/50',
                  index % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                )}
              >
                {columns.map((column) => (
                  <TableCell 
                    key={column.key}
                    className={cn(
                      'py-3',
                      column.align === 'right' && 'text-right tabular-nums',
                      column.align === 'center' && 'text-center',
                      column.className
                    )}
                  >
                    {column.format ? column.format(row[column.key]) : row[column.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// Format helper for currency
export const formatCurrency = (value: number) => (
  <span className="font-medium">
    ₹{value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
  </span>
);

// Format helper for dates
export const formatDate = (value: string) => (
  <span className="text-muted-foreground">
    {new Date(value).toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    })}
  </span>
);

// Format helper for status badges
export const formatStatus = (value: string) => {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    'completed': 'default',
    'pending': 'secondary',
    'cancelled': 'destructive',
    'outstanding': 'outline'
  };
  
  return (
    <Badge variant={variants[value.toLowerCase()] || 'default'} className="capitalize">
      {value}
    </Badge>
  );
};
