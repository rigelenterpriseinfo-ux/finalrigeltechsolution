import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Bot, Send, User, Lightbulb, TrendingUp, Package, DollarSign } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

const quickActions = [
  {
    icon: Package,
    title: "Inventory Analysis",
    description: "Check low stock items and reorder recommendations",
    prompt: "Analyze my current inventory levels and suggest which products need reordering"
  },
  {
    icon: TrendingUp,
    title: "Sales Insights",
    description: "Get insights on sales performance and trends",
    prompt: "Provide insights on my sales performance and identify trends in customer behavior"
  },
  {
    icon: DollarSign,
    title: "Financial Summary",
    description: "Review revenue, expenses, and profitability",
    prompt: "Give me a financial summary including revenue, expenses, and profit margins"
  },
  {
    icon: Lightbulb,
    title: "Business Recommendations",
    description: "Get strategic recommendations for business growth",
    prompt: "Based on my business data, what recommendations do you have for improving operations and growth?"
  }
];

export function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Hello! I'm your AI business assistant. I can help you analyze your inventory, sales, finances, and provide strategic recommendations. What would you like to know about your business?",
      isUser: false,
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSendMessage = async (message?: string) => {
    const messageText = message || inputValue.trim();
    if (!messageText || isLoading) return;

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
      // Simulate AI response (in a real implementation, this would call your AI service)
      await new Promise(resolve => setTimeout(resolve, 1500));

      const aiResponse = generateAIResponse(messageText);
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: aiResponse,
        isUser: false,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to get AI response. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateAIResponse = (userMessage: string): string => {
    const message = userMessage.toLowerCase();
    
    if (message.includes('inventory') || message.includes('stock')) {
      return `Based on your current inventory data:

📊 **Inventory Analysis:**
• You have 45 active products in your system
• 3 products are currently below minimum stock levels
• Top moving items: Product A, Product B, Product C
• Slow-moving items: Product X, Product Y (consider promotional strategies)

🚨 **Immediate Actions Needed:**
• Reorder SKU-001: Current stock 5, minimum 20
• Reorder SKU-045: Current stock 2, minimum 15
• Review pricing for slow-moving items

💡 **Recommendations:**
• Set up automated reorder alerts
• Consider bulk purchasing discounts for fast-moving items
• Implement ABC analysis for better inventory categorization`;
    }
    
    if (message.includes('sales') || message.includes('revenue')) {
      return `Here's your sales performance analysis:

📈 **Sales Overview:**
• Total orders this month: 28
• Revenue: $45,230 (↑12% vs last month)
• Average order value: $1,615
• Top customer: TechCorp Industries ($8,500)

🎯 **Key Insights:**
• Sales are trending upward with strong Q4 performance
• B2B customers account for 70% of revenue
• Product Category A generates highest margins (35%)

💡 **Growth Opportunities:**
• Focus on upselling to existing customers
• Develop targeted campaigns for Category A products
• Consider volume discounts for repeat customers
• Expand B2B outreach efforts`;
    }
    
    if (message.includes('financial') || message.includes('profit')) {
      return `Your financial summary for this period:

💰 **Revenue & Profitability:**
• Total Revenue: $45,230
• Cost of Goods Sold: $28,650
• Gross Profit: $16,580 (37% margin)
• Operating Expenses: $8,200

📊 **Key Metrics:**
• Net Profit: $8,380 (19% margin)
• Cash Flow: Positive $12,450
• Outstanding Receivables: $15,670
• Inventory Value: $38,920

⚠️ **Attention Areas:**
• Consider collecting overdue payments
• Monitor cash flow for seasonal fluctuations
• Review expense categories for optimization opportunities`;
    }
    
    if (message.includes('recommendation') || message.includes('improve')) {
      return `Based on comprehensive analysis of your business data:

🚀 **Strategic Recommendations:**

**Immediate Actions (Next 30 days):**
• Implement automated inventory alerts to prevent stockouts
• Follow up on $15,670 in outstanding receivables
• Launch targeted email campaign for slow-moving inventory

**Growth Initiatives (Next 90 days):**
• Expand product line in high-margin Category A
• Develop customer loyalty program for repeat buyers
• Negotiate better terms with top 3 suppliers

**Long-term Strategy (6-12 months):**
• Consider warehouse management system upgrade
• Explore new market segments with highest ROI
• Implement predictive analytics for demand forecasting

**Technology Investments:**
• Barcode scanning for inventory management
• Customer relationship management (CRM) system
• Business intelligence dashboard for real-time insights`;
    }
    
    return `I understand you're asking about "${userMessage}". Let me help you with that:

Based on your current business data, I can provide insights on:
• Inventory management and stock optimization
• Sales performance and customer analytics  
• Financial health and profitability analysis
• Strategic recommendations for growth

Could you be more specific about what aspect you'd like me to analyze? For example:
- "How is my inventory performing?"
- "What are my top sales trends?"
- "Show me my financial summary"
- "What recommendations do you have for growth?"

I'm here to help you make data-driven decisions for your business!`;
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">AI Business Assistant</h1>
        <p className="text-muted-foreground">Get insights, recommendations, and answers about your business data</p>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((action, index) => (
          <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleSendMessage(action.prompt)}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <action.icon className="h-5 w-5 text-primary" />
                <CardTitle className="text-sm">{action.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-xs">{action.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chat Interface */}
      <Card className="h-[600px] flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Assistant Chat
          </CardTitle>
          <CardDescription>Ask questions about your business data and get intelligent insights</CardDescription>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col p-0">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex gap-3 ${message.isUser ? 'justify-end' : 'justify-start'}`}>
                  {!message.isUser && (
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-lg p-3 ${
                    message.isUser 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <span className="text-xs opacity-70 mt-2 block">
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  {message.isUser && (
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                      <User className="h-4 w-4 text-secondary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
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
                placeholder="Ask me anything about your business..."
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}