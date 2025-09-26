import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { supabase } from '@/integrations/supabase/client';
import { Bot, Send, User, Lightbulb, TrendingUp, Package, DollarSign, Table as TableIcon, FileText, BarChart3, Copy, Check } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  tableData?: {
    columns: string[];
    rows: string[][];
  } | null;
}

const quickActions: never[] = [];

export function AIAssistant() {
  const { profile } = useAuth();
  const { hasAccess } = useBusinessAuth();
  const { toast } = useToast();
  
  const [copiedTableId, setCopiedTableId] = useState<string | null>(null);
  
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "🤖 Welcome to your AI Business Assistant!\n\nI'm powered by Google Gemini and can help you with comprehensive business intelligence and data analysis.\n\nI can answer questions about:\n• Sales orders and performance\n• Purchase orders and supplier data\n• Inventory and stock management\n• Customer and supplier information\n• Financial analytics and reports\n• Business KPIs and trends\n\nJust ask me anything about your business data using natural language! For example:\n• \"Show me top-performing products this quarter\"\n• \"Which customers have outstanding payments?\"\n• \"What are my inventory levels?\"\n• \"Analyze my sales trends for last month\"",
      isUser: false,
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const copyTableData = async (tableData: { columns: string[]; rows: string[][] }, messageId: string) => {
    try {
      // Convert table data to CSV format
      const csvContent = [
        tableData.columns.join(','),
        ...tableData.rows.map(row => row.join(','))
      ].join('\n');
      
      await navigator.clipboard.writeText(csvContent);
      setCopiedTableId(messageId);
      
      toast({
        title: 'Data Copied!',
        description: 'Table data has been copied to clipboard as CSV format.',
      });
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopiedTableId(null), 2000);
    } catch (error) {
      toast({
        title: 'Copy Failed',
        description: 'Unable to copy data to clipboard.',
        variant: 'destructive',
      });
    }
  };

  if (!hasAccess('ai')) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-muted-foreground mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to use the AI Assistant.</p>
        </div>
      </div>
    );
  }


  const handleSendMessage = async (message?: string) => {
    const messageText = message || inputValue.trim();
    if (!messageText || isLoading || !profile?.company_id) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: messageText,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      console.log('Sending message to AI assistant:', messageText);
      
      const { data, error } = await supabase.functions.invoke('gemini-business-assistant', {
        body: { 
          message: messageText,
          companyId: profile.company_id,
          userId: profile.id
        }
      });

      if (error) {
        console.error('Error from AI assistant:', error);
        throw error;
      }

      console.log('AI assistant response:', data);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response || "I'm sorry, I couldn't process your request right now.",
        isUser: false,
        timestamp: new Date(),
        tableData: data.tableData || null
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error calling AI assistant:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'm sorry, I encountered an error while processing your request. Please make sure you're connected to the internet and try again.",
        isUser: false,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: 'AI Assistant Error',
        description: 'Failed to get response from AI assistant',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="space-y-6">
      {/* Chat Interface */}
      <Card className="h-[700px] flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Assistant Chat
          </CardTitle>
          <CardDescription>Ask questions about your business data and get intelligent insights with real-time analysis</CardDescription>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col p-0">
          <ScrollArea className="flex-1 p-4 max-h-[500px] overflow-y-auto">
            <div className="space-y-4 pr-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex gap-3 ${message.isUser ? 'justify-end' : 'justify-start'}`}>
                  {!message.isUser && (
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                   <div className={`${
                     message.isUser 
                       ? 'max-w-[85%] bg-primary text-primary-foreground' 
                       : message.tableData 
                         ? 'w-full bg-muted'
                         : 'max-w-[85%] bg-muted'
                   } rounded-lg p-3`}>
                    {/* Only show text content if it's not the table-only indicator */}
                    {message.content !== "TABLE_DATA_ONLY" && (
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                    )}
                    
                     {/* Table Data Display */}
                     {message.tableData && (
                       <div className={`${message.content !== "TABLE_DATA_ONLY" ? 'mt-4' : ''} border rounded-lg overflow-hidden bg-background w-full`}>
                         <div className="bg-muted px-3 py-2 flex items-center justify-between">
                           <div className="flex items-center gap-2">
                             <TableIcon className="h-4 w-4" />
                             <span className="text-sm font-medium text-foreground">Data Results</span>
                           </div>
                           <Button
                             variant="ghost"
                             size="sm"
                             onClick={() => copyTableData(message.tableData!, message.id)}
                             className="h-6 px-2 text-xs"
                           >
                             {copiedTableId === message.id ? (
                               <Check className="h-3 w-3" />
                             ) : (
                               <Copy className="h-3 w-3" />
                             )}
                             {copiedTableId === message.id ? 'Copied!' : 'Copy'}
                           </Button>
                         </div>
                         <div className="max-h-60 overflow-auto w-full">
                           <Table className="w-full">
                             <TableHeader>
                               <TableRow>
                                 {message.tableData.columns.map((column, colIndex) => (
                                   <TableHead key={colIndex} className="text-xs font-medium whitespace-nowrap">
                                     {column}
                                   </TableHead>
                                 ))}
                               </TableRow>
                             </TableHeader>
                             <TableBody>
                               {message.tableData.rows.map((row, rowIndex) => (
                                 <TableRow key={rowIndex}>
                                   {row.map((cell, cellIndex) => (
                                     <TableCell key={cellIndex} className="text-xs whitespace-nowrap">
                                       {cell}
                                     </TableCell>
                                   ))}
                                 </TableRow>
                               ))}
                             </TableBody>
                           </Table>
                         </div>
                       </div>
                     )}
                    
                    <span className="text-xs opacity-70 mt-2 block">
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  {message.isUser && (
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-secondary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                      <span className="text-xs text-muted-foreground">AI is analyzing your data...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          
          {/* Input Area */}
          <div className="border-t p-4">
            <div className="flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask anything: 'Monthly sales trends', 'Low stock alerts', 'Customer payment analysis', 'Supplier performance metrics'..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button 
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim() || isLoading}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {!profile?.company_id && (
              <p className="text-xs text-muted-foreground mt-2">
                Please make sure you're logged in and have a company profile set up to use the AI assistant.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}