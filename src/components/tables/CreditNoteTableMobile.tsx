import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Eye, 
  Edit, 
  Download,
  ChevronDown, 
  ChevronRight,
  Search,
  Calendar,
  DollarSign,
  User,
  FileText
} from 'lucide-react';

interface CreditNote {
  id: string;
  cn_number: string;
  cn_date: string;
  customer_name: string;
  rso_number: string;
  status: 'Draft' | 'Confirmed';
  total_amount: number;
}

interface CreditNoteTableMobileProps {
  creditNotes: CreditNote[];
  onView: (cnId: string) => void;
  onEdit: (cnId: string) => void;
  onExport: (cn: CreditNote) => void;
  loading?: boolean;
}

export function CreditNoteTableMobile({
  creditNotes,
  onView,
  onEdit,
  onExport,
  loading = false
}: CreditNoteTableMobileProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  
  const itemsPerPage = 10;

  // Filter credit notes based on search term
  const filteredNotes = creditNotes.filter(note =>
    (note.cn_number?.toLowerCase() ?? '').includes(searchTerm.toLowerCase()) ||
    (note.customer_name?.toLowerCase() ?? '').includes(searchTerm.toLowerCase()) ||
    (note.rso_number?.toLowerCase() ?? '').includes(searchTerm.toLowerCase())
  );

  // Pagination
  const totalPages = Math.ceil(filteredNotes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentNotes = filteredNotes.slice(startIndex, startIndex + itemsPerPage);

  const toggleCard = (noteId: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(noteId)) {
      newExpanded.delete(noteId);
    } else {
      newExpanded.add(noteId);
    }
    setExpandedCards(newExpanded);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft':
        return 'bg-muted text-muted-foreground';
      case 'Confirmed':
        return 'bg-primary/10 text-primary';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-24"></div>
                    <div className="h-3 bg-muted rounded w-32"></div>
                  </div>
                  <div className="h-6 bg-muted rounded w-16"></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="h-3 bg-muted rounded w-16"></div>
                    <div className="h-4 bg-muted rounded w-20"></div>
                  </div>
                  <div className="space-y-1">
                    <div className="h-3 bg-muted rounded w-16"></div>
                    <div className="h-4 bg-muted rounded w-24"></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search credit notes..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          className="pl-10"
        />
      </div>

      {/* Results Info */}
      <div className="flex justify-between items-center text-sm text-muted-foreground px-1">
        <span>{currentNotes.length} of {filteredNotes.length} notes</span>
        {totalPages > 1 && (
          <span>Page {currentPage} of {totalPages}</span>
        )}
      </div>

      {/* Notes List */}
      <div className="space-y-3">
        {currentNotes.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-muted-foreground">
                {searchTerm ? 'No credit notes found matching your search.' : 'No credit notes found.'}
              </div>
            </CardContent>
          </Card>
        ) : (
          currentNotes.map((note) => {
            const isExpanded = expandedCards.has(note.id);
            return (
              <Card key={note.id} className="card-interactive">
                <Collapsible>
                  <CollapsibleTrigger
                    onClick={() => toggleCard(note.id)}
                    className="w-full"
                  >
                    <CardHeader className="pb-3">
                      <div className="mobile-card-header">
                        <div className="mobile-card-content">
                          <div className="mobile-card-title">
                            {note.cn_number}
                          </div>
                          <div className="mobile-card-subtitle flex items-center gap-1">
                            <User className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{note.customer_name}</span>
                          </div>
                        </div>
                        <div className="mobile-card-actions">
                          <Badge className={`${getStatusColor(note.status)} text-xs`}>
                            {note.status}
                          </Badge>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(note.cn_date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-1 font-medium">
                          <DollarSign className="h-3 w-3" />
                          <span>{formatCurrency(note.total_amount)}</span>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="space-y-3 mb-4">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground text-sm">RSO Number:</span>
                          <span className="text-sm">{note.rso_number}</span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onView(note.id);
                          }}
                          className="flex-1"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        {note.status === 'Draft' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(note.id);
                            }}
                            className="flex-1"
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onExport(note);
                          }}
                          title="Export Credit Note"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNumber = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
              return (
                <Button
                  key={pageNumber}
                  variant={currentPage === pageNumber ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(pageNumber)}
                  className="min-w-[40px]"
                >
                  {pageNumber}
                </Button>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
