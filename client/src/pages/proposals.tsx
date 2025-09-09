import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Bot, 
  Users, 
  TrendingUp, 
  Target, 
  IndianRupee,
  Calendar,
  ArrowRight,
  CheckCircle,
  Clock,
  Lightbulb,
  UserCheck,
  Zap,
  BarChart3,
  FileText,
  AlertTriangle
} from "lucide-react";

interface ActionableItem {
  id: string;
  type: 'investment' | 'rebalance' | 'tax_optimization' | 'goal_planning' | 'risk_adjustment';
  title: string;
  description: string;
  amount?: number;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  recommendedBy: 'ai' | 'agent';
  agentName?: string;
  rationale: string;
  expectedImpact: string;
  timeframe: string;
  actionRequired: string[];
  createdAt: string;
}

export default function ProposalsPage() {
  const [selectedTab, setSelectedTab] = useState("ai");
  
  // Mock data for demonstration - no API calls needed
  const mockActionables: ActionableItem[] = [
    {
      id: "ai-001",
      type: "investment",
      title: "Increase SIP in Large Cap Funds",
      description: "Based on your risk profile and market analysis, increasing your SIP allocation to large cap funds can optimize returns.",
      amount: 15000,
      priority: "high",
      status: "pending",
      recommendedBy: "ai",
      rationale: "Current market conditions favor large cap investments. Your portfolio allocation shows underweight in this segment.",
      expectedImpact: "12-15% annual returns with moderate risk",
      timeframe: "Next 2-3 years",
      actionRequired: ["Increase monthly SIP by ₹15,000", "Select suitable large cap funds", "Set up auto-debit mandate"],
      createdAt: "2024-01-15T10:30:00Z"
    },
    {
      id: "ai-002",
      type: "tax_optimization",
      title: "ELSS Investment for Tax Savings",
      description: "Invest in ELSS funds to maximize tax savings under Section 80C while building wealth.",
      amount: 50000,
      priority: "high",
      status: "pending",
      recommendedBy: "ai",
      rationale: "You have ₹50,000 unused 80C limit. ELSS can provide tax savings plus equity exposure.",
      expectedImpact: "₹15,000 tax savings + potential 12-18% returns",
      timeframe: "Before March 31, 2024",
      actionRequired: ["Choose diversified ELSS funds", "Lump sum investment of ₹50,000", "Plan for 3-year lock-in"],
      createdAt: "2024-01-14T14:20:00Z"
    },
    {
      id: "agent-001",
      type: "rebalance",
      title: "Portfolio Rebalancing Recommendation",
      description: "Your portfolio has deviated from target allocation. Rebalancing will optimize risk-return profile.",
      priority: "medium",
      status: "pending",
      recommendedBy: "agent",
      agentName: "Rajesh Kumar",
      rationale: "Equity allocation has increased to 75% from target 65% due to market gains. Booking profits and rebalancing advised.",
      expectedImpact: "Risk reduction and profit booking of ₹2.5L",
      timeframe: "Within 1 month",
      actionRequired: ["Redeem ₹2.5L from equity funds", "Invest in debt/hybrid funds", "Review allocation quarterly"],
      createdAt: "2024-01-13T16:45:00Z"
    },
    {
      id: "agent-002",
      type: "goal_planning",
      title: "Child Education Fund Setup",
      description: "Start dedicated education fund for your child's higher education with inflation-adjusted planning.",
      amount: 25000,
      priority: "high",
      status: "pending",
      recommendedBy: "agent",
      agentName: "Priya Sharma",
      rationale: "With 12 years to goal, starting ₹25,000 monthly SIP in aggressive hybrid funds can build required corpus.",
      expectedImpact: "₹1.2Cr corpus for child's education",
      timeframe: "Start immediately",
      actionRequired: ["Open child education investment account", "Start ₹25,000 monthly SIP", "Review and step up annually"],
      createdAt: "2024-01-12T11:15:00Z"
    }
  ];
  
  const aiActionables = mockActionables.filter(item => item.recommendedBy === 'ai');
  const agentActionables = mockActionables.filter(item => item.recommendedBy === 'agent');
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'investment':
        return <TrendingUp className="w-4 h-4" />;
      case 'rebalance':
        return <BarChart3 className="w-4 h-4" />;
      case 'tax_optimization':
        return <FileText className="w-4 h-4" />;
      case 'goal_planning':
        return <Target className="w-4 h-4" />;
      case 'risk_adjustment':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <ArrowRight className="w-4 h-4" />;
    }
  };
  
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'in_progress':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'completed':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'dismissed':
        return 'bg-gray-50 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };
  
  const renderActionableCard = (actionable: ActionableItem, index: number) => (
    <Card key={actionable.id} className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              actionable.recommendedBy === 'ai' 
                ? 'bg-purple-100 text-purple-600' 
                : 'bg-blue-100 text-blue-600'
            }`}>
              {getTypeIcon(actionable.type)}
            </div>
            <div>
              <CardTitle className="text-lg">{actionable.title}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={getPriorityColor(actionable.priority)}>
                  {actionable.priority.toUpperCase()}
                </Badge>
                <Badge variant="outline">
                  {actionable.type.replace('_', ' ').toUpperCase()}
                </Badge>
                {actionable.amount && (
                  <Badge variant="secondary">
                    {formatCurrency(actionable.amount)}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className={`text-xs px-3 py-1 rounded-full border ${getStatusColor(actionable.status)}`}>
            {actionable.status.replace('_', ' ').toUpperCase()}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <p className="text-gray-700">{actionable.description}</p>
        
        {actionable.agentName && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
            <UserCheck className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">
              Recommended by Agent: {actionable.agentName}
            </span>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="space-y-1">
            <p className="text-muted-foreground font-medium">Expected Impact</p>
            <p className="text-green-600">{actionable.expectedImpact}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground font-medium">Timeframe</p>
            <p className="font-medium">{actionable.timeframe}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground font-medium">Status</p>
            <p className="font-medium">{actionable.status.replace('_', ' ')}</p>
          </div>
        </div>
        
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-amber-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-800">Rationale</p>
              <p className="text-sm text-gray-700">{actionable.rationale}</p>
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-800">Action Required:</p>
          <ul className="space-y-1">
            {actionable.actionRequired.map((action, idx) => (
              <li key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                <CheckCircle className="w-3 h-3 text-green-600" />
                {action}
              </li>
            ))}
          </ul>
        </div>
        
        <div className="flex gap-2 pt-4 border-t">
          <Button className="flex-1" variant="default">
            Accept & Execute
          </Button>
          <Button variant="outline">
            More Details
          </Button>
          <Button variant="ghost" size="sm">
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
  
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Investment Actionables</h1>
          <p className="text-xl text-muted-foreground">
            Personalized recommendations to optimize your financial portfolio
          </p>
        </div>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Bot className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-600">{aiActionables.length}</p>
                  <p className="text-sm font-medium text-purple-800">AI Suggestions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">{agentActionables.length}</p>
                  <p className="text-sm font-medium text-blue-800">Agent Recommendations</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Clock className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {mockActionables.filter(a => a.status === 'pending').length}
                  </p>
                  <p className="text-sm font-medium text-green-800">Pending Actions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-100 rounded-lg">
                  <Zap className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">
                    {mockActionables.filter(a => a.priority === 'high').length}
                  </p>
                  <p className="text-sm font-medium text-amber-800">High Priority</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Tabbed Interface */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ai" className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              AI Recommendations ({aiActionables.length})
            </TabsTrigger>
            <TabsTrigger value="agent" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Agent Suggestions ({agentActionables.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="ai" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-purple-600" />
                  AI-Powered Recommendations
                </CardTitle>
                <CardDescription>
                  Data-driven suggestions based on market analysis, your portfolio performance, and risk profile
                </CardDescription>
              </CardHeader>
            </Card>
            
            <div className="grid gap-6">
              {aiActionables.map((actionable, index) => renderActionableCard(actionable, index))}
            </div>
            
            {aiActionables.length === 0 && (
              <Card>
                <CardContent className="text-center py-12">
                  <Bot className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground mb-2">No AI Recommendations</h3>
                  <p className="text-sm text-muted-foreground">
                    AI recommendations will appear here based on your portfolio analysis
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="agent" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  Professional Agent Recommendations
                </CardTitle>
                <CardDescription>
                  Personalized advice from certified financial advisors based on your specific goals and circumstances
                </CardDescription>
              </CardHeader>
            </Card>
            
            <div className="grid gap-6">
              {agentActionables.map((actionable, index) => renderActionableCard(actionable, index))}
            </div>
            
            {agentActionables.length === 0 && (
              <Card>
                <CardContent className="text-center py-12">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground mb-2">No Agent Recommendations</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Connect with a certified financial advisor to get personalized investment recommendations
                  </p>
                  <Button>
                    Schedule Consultation
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}