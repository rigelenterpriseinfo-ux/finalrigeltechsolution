import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Building2, MapPin, User, Phone, Mail, Calendar, Settings } from 'lucide-react';

interface WarehouseBin {
  id: string;
  wh_bin_code: string;
  bin_name: string;
  warehouse_name?: string;
  warehouse_code?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  contact_person_name?: string;
  contact_person_phone?: string;
  contact_person_email?: string;
  is_active: boolean;
  is_default?: boolean;
  created_at: string;
  updated_at: string;
}

interface WarehouseBinViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bin: WarehouseBin | null;
}

export const WarehouseBinViewDialog: React.FC<WarehouseBinViewDialogProps> = ({
  open,
  onOpenChange,
  bin,
}) => {
  if (!bin) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <Building2 className="h-5 w-5 text-primary" />
            Warehouse & BIN Details
          </DialogTitle>
          <DialogDescription>
            Complete information about this warehouse location and bin
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-h-[calc(90vh-8rem)] overflow-y-auto">
          {/* Warehouse & BIN Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-primary/20">
              <Building2 className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-primary">Warehouse & BIN Information</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Warehouse Name</label>
                <p className="text-sm font-semibold mt-1">{bin.warehouse_name || 'N/A'}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Warehouse Code</label>
                <p className="text-sm font-mono bg-muted/50 px-2 py-1 rounded mt-1">
                  {bin.warehouse_code || 'N/A'}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">BIN Code</label>
                <p className="text-sm font-mono font-semibold text-primary bg-primary/10 px-2 py-1 rounded mt-1">
                  {bin.wh_bin_code}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">BIN Name</label>
                <p className="text-sm font-semibold mt-1">{bin.bin_name}</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Badge variant={bin.is_active ? "default" : "secondary"}>
                {bin.is_active ? 'Active' : 'Inactive'}
              </Badge>
              {bin.is_default && (
                <Badge variant="outline" className="border-blue-200 text-blue-700">
                  Default Location
                </Badge>
              )}
            </div>
          </div>

          {/* Address Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-green-500/20">
              <MapPin className="h-4 w-4 text-green-600" />
              <h3 className="font-semibold text-green-600">Address Information</h3>
            </div>
            
            <div className="space-y-3">
              {bin.address_line1 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Address Line 1</label>
                  <p className="text-sm mt-1">{bin.address_line1}</p>
                </div>
              )}
              
              {bin.address_line2 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Address Line 2</label>
                  <p className="text-sm mt-1">{bin.address_line2}</p>
                </div>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {bin.city && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">City</label>
                    <p className="text-sm font-medium mt-1">{bin.city}</p>
                  </div>
                )}
                
                {bin.state && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">State</label>
                    <p className="text-sm font-medium mt-1">{bin.state}</p>
                  </div>
                )}
                
                {bin.postal_code && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">PIN Code</label>
                    <p className="text-sm font-mono bg-muted/50 px-2 py-1 rounded mt-1">
                      {bin.postal_code}
                    </p>
                  </div>
                )}
                
                {bin.country && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Country</label>
                    <p className="text-sm font-medium mt-1">{bin.country}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Contact Information */}
          {(bin.contact_person_name || bin.contact_person_phone || bin.contact_person_email) && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-blue-500/20">
                <User className="h-4 w-4 text-blue-600" />
                <h3 className="font-semibold text-blue-600">Contact Information</h3>
              </div>
              
              <div className="space-y-3">
                {bin.contact_person_name && (
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Contact Person</label>
                      <p className="text-sm font-medium">{bin.contact_person_name}</p>
                    </div>
                  </div>
                )}
                
                {bin.contact_person_phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Phone</label>
                      <p className="text-sm font-mono">{bin.contact_person_phone}</p>
                    </div>
                  </div>
                )}
                
                {bin.contact_person_email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Email</label>
                      <p className="text-sm">{bin.contact_person_email}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-purple-500/20">
              <Settings className="h-4 w-4 text-purple-600" />
              <h3 className="font-semibold text-purple-600">Metadata</h3>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created</label>
                  <p className="text-sm">
                    {new Date(bin.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
                  <p className="text-sm">
                    {new Date(bin.updated_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};