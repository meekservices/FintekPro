import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Target,
  LucideShield as LucideShield,
  Phone,
  Mail,
  Calendar,
  ArrowRight,
  Sparkles,
  Clock,
  IndianRupee,
  ChevronRight,
  CheckCircle,
  User,
  Bell,
  Star,
  Zap
} from "lucide-react";

interface NextAction {
  id: string;
  type: 'exit_alert' | 'rebalance' | 'tax_harvest' | 'kyc' | 'follow_up' | 'upsell' | 'review';
  priority: 'critical' | 'high' | 'medium';
  title: string;
  description: string;
  clientName: string;
  clientId: string;
  impact: string;
  suggestedAction: string;
  deadline?: string;
  potentialValue?: number;
  reasoning: string;
}

const NEXT_ACTIONS: NextAction[] = [
  {
    id: '1',
    type: 'exit_alert',
    priority: 'critical',
    title: 'HDFC Bank Target Achieved',
    description: 'Stock reached target price of ₹1,750. Consider booking profits.',
    clientName: 'Rajesh Sharma',
    clientId: '1',
    impact: 'Protect ₹2.4L gains',
    suggestedAction: 'Call client to discuss profit booking before price correction',
    deadline: 'Today',
    potentialValue: 240000,
    reasoning: 'AI detected target price breach with overbought RSI (78). Historical pattern suggests 15% correction probability in next 2 weeks.'
  },
  {
    id: '2',
    type: 'tax_harvest',
    priority: 'high',
    title: 'Tax Loss Harvesting Opportunity',
    description: 'Utilize IT sector losses to offset gains before March 31',
    clientName: 'Priya Patel',
    clientId: '2',
    impact: 'Save ₹32K in taxes',
    suggestedAction: 'Schedule call to discuss selling Wipro, reinvesting in TCS after 30 days',
    deadline: '3 days',
    potentialValue: 32000,
    reasoning: 'Portfolio has ₹2.5L STCG. Wipro showing ₹1.1L loss can offset, saving 30% tax.'
  },
  {
    id: '3',
    type: 'rebalance',
    priority: 'high',
    title: 'Portfolio Drift Alert',
    description: 'Equity allocation at 82%, exceeds target of 70%',
    clientName: 'Amit Kumar',
    clientId: '3',
    impact: 'Risk alignment',
    suggestedAction: 'Propose rebalancing ₹8L from equity to debt funds',
    potentialValue: 800000,
    reasoning: 'Client risk profile is Moderate Conservative. Current allocation exposes to unnecessary volatility. Suggest SDP to debt over 3 months.'
  },
  {
    id: '4',
    type: 'upsell',
    priority: 'medium',
    title: 'NPS Investment Opportunity',
    description: 'Client can save additional ₹50K in taxes under 80CCD(1B)',
    clientName: 'Sunita Reddy',
    clientId: '4',
    impact: 'Tax benefit ₹15.6K',
    suggestedAction: 'Present NPS benefits during next review meeting',
    potentialValue: 50000,
    reasoning: 'Client in 31.2% tax bracket with no NPS. ₹50K contribution provides additional deduction beyond 80C limit.'
  },
  {
    id: '5',
    type: 'follow_up',
    priority: 'medium',
    title: 'Proposal Pending Decision',
    description: 'SIP increase proposal shared 7 days ago, no response',
    clientName: 'Vikram Singh',
    clientId: '5',
    impact: 'Monthly ₹25K SIP',
    suggestedAction: 'Send reminder email, offer call to address concerns',
    potentialValue: 300000,
    reasoning: 'High-value proposal awaiting decision. 7-day follow-up window optimal for conversion.'
  },
  {
    id: '6',
    type: 'kyc',
    priority: 'high',
    title: 'KYC Expiring Soon',
    description: 'KYC expires in 10 days, trading will be blocked',
    clientName: 'Meera Gupta',
    clientId: '6',
    impact: 'Prevent trading block',
    suggestedAction: 'Schedule KYC renewal appointment this week',
    deadline: '10 days',
    reasoning: 'Approaching KYC expiry. Early renewal prevents service disruption and demonstrates proactive care.'
  },
  {
    id: '7',
    type: 'exit_alert',
    priority: 'high',
    title: 'Stop Loss Triggered - Reliance',
    description: 'Stock fell below 8% stop loss threshold',
    clientName: 'Rajesh Sharma',
    clientId: '1',
    impact: 'Limit further losses',
    suggestedAction: 'Immediate call to discuss exit or holding strategy',
    deadline: 'Today',
    potentialValue: -45000,
    reasoning: 'Stock down 8.2% from purchase. Technical indicators bearish. Suggest exit to protect capital.'
  },
  {
    id: '8',
    type: 'review',
    priority: 'medium',
    title: 'Quarterly Review Due',
    description: 'Q4 review meeting not scheduled, last review was 95 days ago',
    clientName: 'Arjun Nair',
    clientId: '7',
    impact: 'Client engagement',
    suggestedAction: 'Send calendar invite for Q4 portfolio review',
    reasoning: 'Regular reviews improve retention. Client AUM ₹45L warrants quarterly engagement.'
  }
];

const TYPE_CONFIG = {
  exit_alert: { label: 'Exit Alert', icon: AlertTriangle, color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  rebalance: { label: 'Rebalance', icon: TrendingUp, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  tax_harvest: { label: 'Tax Saving', icon: IndianRupee, color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  kyc: { label: 'Compliance', icon: LucideShield, color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
  follow_up: { label: 'Follow Up', icon: Phone, color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  upsell: { label: 'Opportunity', icon: Star, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  review: { label: 'Review', icon: Calendar, color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' }
};

const PRIORITY_CONFIG = {
  critical: { label: 'Critical', color: 'bg-red-600 text-white', pulse: true },
  high: { label: 'High', color: 'bg-orange-500/20 text-orange-400' },
  medium: { label: 'Medium', color: 'bg-blue-500/20 text-blue-400' }
};

interface AINextActionsProps {
  maxItems?: number;
  compact?: boolean;
}

export default function AINextActions({ maxItems = 8, compact = false }: AINextActionsProps) {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  
  const activeActions = NEXT_ACTIONS
    .filter(action => !dismissedIds.includes(action.id))
    .slice(0, maxItems);

  const criticalCount = activeActions.filter(a => a.priority === 'critical').length;
  const highCount = activeActions.filter(a => a.priority === 'high').length;

  const handleDismiss = (id: string) => {
    setDismissedIds([...dismissedIds, id]);
  };

  const formatValue = (value: number) => {
    const absValue = Math.abs(value);
    if (absValue >= 100000) {
      return `₹${(absValue / 100000).toFixed(1)}L`;
    }
    return `₹${(absValue / 1000).toFixed(0)}K`;
  };

  if (compact) {
    return (
      <Card className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border-border border-l-4 border-l-emerald-500">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground text-lg flex items-center gap-2">
              <Brain className="h-5 w-5 text-emerald-400" />
              AI Next-Best-Actions
            </CardTitle>
            <div className="flex items-center gap-2">
              {criticalCount > 0 && (
                <Badge className="bg-red-600 text-white animate-pulse">{criticalCount} Critical</Badge>
              )}
              {highCount > 0 && (
                <Badge className="bg-orange-500/20 text-orange-400">{highCount} High</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {activeActions.slice(0, 4).map((action) => {
            const typeConfig = TYPE_CONFIG[action.type];
            const Icon = typeConfig.icon;
            return (
              <div
                key={action.id}
                className="flex items-center justify-between p-3 bg-card/50 rounded-lg hover:bg-card transition-colors cursor-pointer"
                data-testid={`action-compact-${action.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${typeConfig.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-foreground text-sm font-medium">{action.title}</p>
                    <p className="text-muted-foreground text-xs">{action.clientName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 text-sm">{action.impact}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            );
          })}
          {activeActions.length > 4 && (
            <Button variant="ghost" className="w-full text-emerald-400 hover:text-emerald-300 mt-2">
              View all {activeActions.length} actions
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-foreground flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg">
                <Brain className="h-5 w-5 text-foreground" />
              </div>
              AI Next-Best-Actions
            </CardTitle>
            <CardDescription className="text-muted-foreground mt-1">
              Personalized recommendations based on client data and market signals
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <Badge className="bg-red-600 text-white animate-pulse">{criticalCount} Critical</Badge>
            )}
            <Badge className="bg-muted text-foreground">{activeActions.length} Actions</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-4">
            {activeActions.map((action) => {
              const typeConfig = TYPE_CONFIG[action.type];
              const priorityConfig = PRIORITY_CONFIG[action.priority];
              const Icon = typeConfig.icon;
              
              return (
                <div
                  key={action.id}
                  className={`p-4 bg-background/50 rounded-lg border ${action.priority === 'critical' ? 'border-red-500/50' : 'border-border'} hover:border-emerald-500/50 transition-colors`}
                  data-testid={`action-${action.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${typeConfig.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-foreground font-medium">{action.title}</h4>
                          <Badge className={typeConfig.color}>{typeConfig.label}</Badge>
                          <Badge className={priorityConfig.color}>
                            {priorityConfig.label}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-sm mt-1">{action.description}</p>
                        
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <User className="h-3 w-3" />
                            {action.clientName}
                          </span>
                          {action.deadline && (
                            <span className={`flex items-center gap-1 ${action.deadline === 'Today' ? 'text-red-400' : 'text-amber-400'}`}>
                              <Clock className="h-3 w-3" />
                              {action.deadline}
                            </span>
                          )}
                          {action.potentialValue && (
                            <span className={`flex items-center gap-1 ${action.potentialValue > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              <IndianRupee className="h-3 w-3" />
                              {action.potentialValue > 0 ? '+' : ''}{formatValue(action.potentialValue)}
                            </span>
                          )}
                        </div>

                        <div className="mt-3 p-2 bg-card/50 rounded-md">
                          <div className="flex items-start gap-2">
                            <Sparkles className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-emerald-400 text-xs font-medium">AI Reasoning</p>
                              <p className="text-muted-foreground text-xs mt-0.5">{action.reasoning}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 mt-3">
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" data-testid={`button-act-${action.id}`}>
                            <Zap className="h-3 w-3 mr-1" />
                            {action.suggestedAction.split(' ').slice(0, 2).join(' ')}
                          </Button>
                          <Button size="sm" variant="outline" className="border-border text-muted-foreground">
                            <Phone className="h-3 w-3 mr-1" />
                            Call
                          </Button>
                          <Button size="sm" variant="outline" className="border-border text-muted-foreground">
                            <Mail className="h-3 w-3 mr-1" />
                            Email
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-muted-foreground hover:text-muted-foreground ml-auto"
                            onClick={() => handleDismiss(action.id)}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Done
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
