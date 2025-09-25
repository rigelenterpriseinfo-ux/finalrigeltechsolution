import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Settings as SettingsIcon } from 'lucide-react';
import { DocumentFormatsTable } from '@/components/tables/DocumentFormatsTable';

export const SettingsModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState('document-formats');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <SettingsIcon className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-1 max-w-[400px]">
          <TabsTrigger value="document-formats" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Document Formats
          </TabsTrigger>
        </TabsList>

        <TabsContent value="document-formats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Document Format Configuration
              </CardTitle>
              <CardDescription>
                Configure prefixes, suffixes, and numbering for various document types like invoices, purchase orders, and more.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentFormatsTable />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};