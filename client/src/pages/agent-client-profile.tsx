import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useRoute } from "wouter";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  FileText,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Target,
  PiggyBank,
  Briefcase,
  GraduationCap,
  Home,
  Plane,
  Heart,
  Plus,
  Edit,
  MessageSquare,
  Video,
  PhoneCall,
  ArrowLeft,
  Star,
  Activity,
  Bell,
  ExternalLink,
  ChevronRight,
  Loader2
} from "lucide-react";
import { Link } from "wouter";

interface ClientProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  pan: string;
  dateOfBirth: string;
  occupation: string;
  annualIncome: number;
  riskProfile: 'conservative' | 'moderate' | 'aggressive';
  kycStatus: 'pending' | 'verified' | 'expired';
  kycExpiry: string;
  totalPortfolio: number;
  portfolioGrowth: number;
  investedSince: string;
  lastContact: string;
  nextReview: string;
  preferredContact: string;
  notes: string;
  tags: string[];
}

interface ActivityItem {
  id: string;
  type: 'call' | 'meeting' | 'email' | 'investment' | 'withdrawal' | 'document' | 'alert' | 'kyc';
  title: string;
  description: string;
  date: string;
  amount?: number;
  status?: string;
}

interface FinancialGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  priority: 'high' | 'medium' | 'low';
  category: 'retirement' | 'education' | 'house' | 'travel' | 'emergency' | 'other';
}

interface MeetingNote {
  id: string;
  date: string;
  type: 'call' | 'meeting' | 'video';
  summary: string;
  actionItems: string[];
  nextSteps: string;
}

interface Holding {
  id: string;
  name: string;
  type: string;
  invested: number;
  current: number;
  returns: number;
  returnsPercent: number;
}

const GOAL_ICONS = {
  retirement: PiggyBank,
  education: GraduationCap,
  house: Home,
  travel: Plane,
  emergency: Shield,
  other: Target
};

export default function AgentClientProfile() {
  const [, params] = useRoute("/clients/:id");
  const clientId = params?.id || "1";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNote, setNewNote] = useState({ type: 'call', summary: '', actionItems: '', nextSteps: '' });

  const defaultClient: ClientProfile = {
    id: "1",
    name: "Rajesh Sharma",
    email: "rajesh.sharma@email.com",
    phone: "+91 98765 43210",
    address: "123 MG Road, Bangalore 560001",
    pan: "ABCDE1234F",
    dateOfBirth: "1975-05-15",
    occupation: "Business Owner",
    annualIncome: 5000000,
    riskProfile: "moderate",
    kycStatus: "verified",
    kycExpiry: "2025-12-31",
    totalPortfolio: 12500000,
    portfolioGrowth: 18.5,
    investedSince: "2019-03-15",
    lastContact: "2024-12-20",
    nextReview: "2025-01-15",
    preferredContact: "Phone",
    notes: "Prefers evening calls. Interested in tax-saving investments and long-term wealth creation.",
    tags: ["HNI", "Tax-saver", "Long-term"]
  };

  const defaultActivities: ActivityItem[] = [
    { id: "1", type: "call", title: "Portfolio Review Call", description: "Discussed Q4 performance and rebalancing options", date: "2024-12-20", status: "completed" },
    { id: "2", type: "investment", title: "SIP Investment - Axis Bluechip", description: "Monthly SIP processed", date: "2024-12-15", amount: 50000 },
    { id: "3", type: "alert", title: "Exit Alert Triggered", description: "HDFC Bank reached target price", date: "2024-12-14", status: "action_needed" },
    { id: "4", type: "document", title: "Annual Statement Sent", description: "FY 2023-24 portfolio statement", date: "2024-12-10" },
    { id: "5", type: "meeting", title: "Quarterly Review Meeting", description: "In-person meeting at office", date: "2024-12-05", status: "completed" },
    { id: "6", type: "email", title: "Tax Planning Proposal", description: "Sent ELSS recommendations", date: "2024-12-01" },
    { id: "7", type: "investment", title: "Lump Sum - ICICI Prudential Value", description: "One-time investment", date: "2024-11-28", amount: 500000 },
    { id: "8", type: "kyc", title: "KYC Renewal Reminder", description: "KYC expires in 12 months", date: "2024-11-25", status: "pending" }
  ];

  const defaultGoals: FinancialGoal[] = [
    { id: "1", name: "Retirement Corpus", targetAmount: 50000000, currentAmount: 12500000, targetDate: "2035-05-15", priority: "high", category: "retirement" },
    { id: "2", name: "Daughter's Education", targetAmount: 15000000, currentAmount: 4500000, targetDate: "2028-06-01", priority: "high", category: "education" },
    { id: "3", name: "Son's Education", targetAmount: 15000000, currentAmount: 2800000, targetDate: "2030-06-01", priority: "medium", category: "education" },
    { id: "4", name: "New House Purchase", targetAmount: 25000000, currentAmount: 8000000, targetDate: "2027-12-31", priority: "medium", category: "house" },
    { id: "5", name: "Emergency Fund", targetAmount: 2500000, currentAmount: 2500000, targetDate: "2024-12-31", priority: "high", category: "emergency" }
  ];

  const defaultNotes: MeetingNote[] = [
    { id: "1", date: "2024-12-20", type: "call", summary: "Discussed portfolio performance and rebalancing. Client happy with returns but wants to reduce equity exposure by 10%.", actionItems: ["Prepare rebalancing proposal", "Send updated risk assessment"], nextSteps: "Schedule follow-up call for proposal review" },
    { id: "2", date: "2024-12-05", type: "meeting", summary: "Quarterly review meeting. Reviewed all holdings, discussed tax implications. Client interested in increasing ELSS investments.", actionItems: ["Send ELSS comparison", "Calculate tax savings"], nextSteps: "Client will decide on ELSS by month end" },
    { id: "3", date: "2024-11-15", type: "video", summary: "Discussed daughter's education fund progress. On track but may need to increase SIP.", actionItems: ["Calculate required SIP increase", "Explore education insurance options"], nextSteps: "Present options in next meeting" }
  ];

  const defaultHoldings: Holding[] = [
    { id: "1", name: "Axis Bluechip Fund", type: "Mutual Fund", invested: 1500000, current: 1850000, returns: 350000, returnsPercent: 23.3 },
    { id: "2", name: "ICICI Prudential Value Discovery", type: "Mutual Fund", invested: 2000000, current: 2450000, returns: 450000, returnsPercent: 22.5 },
    { id: "3", name: "HDFC Bank Ltd", type: "Equity", invested: 800000, current: 1120000, returns: 320000, returnsPercent: 40.0 },
    { id: "4", name: "SBI Corporate Bond Fund", type: "Debt Fund", invested: 1000000, current: 1080000, returns: 80000, returnsPercent: 8.0 },
    { id: "5", name: "Nippon India ELSS Tax Saver", type: "ELSS", invested: 500000, current: 620000, returns: 120000, returnsPercent: 24.0 }
  ];

  const client = defaultClient;
  const activities = defaultActivities;
  const goals = defaultGoals;
  const notes = defaultNotes;
  const holdings = defaultHoldings;

  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
    return `₹${(value / 1000).toFixed(0)}K`;
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call': return PhoneCall;
      case 'meeting': return User;
      case 'email': return Mail;
      case 'investment': return TrendingUp;
      case 'withdrawal': return TrendingDown;
      case 'document': return FileText;
      case 'alert': return Bell;
      case 'kyc': return Shield;
      default: return Activity;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'call': return 'bg-blue-500/20 text-blue-400';
      case 'meeting': return 'bg-purple-500/20 text-purple-400';
      case 'email': return 'bg-cyan-500/20 text-cyan-400';
      case 'investment': return 'bg-emerald-500/20 text-emerald-400';
      case 'withdrawal': return 'bg-red-500/20 text-red-400';
      case 'document': return 'bg-amber-500/20 text-amber-400';
      case 'alert': return 'bg-orange-500/20 text-orange-400';
      case 'kyc': return 'bg-indigo-500/20 text-indigo-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'conservative': return 'bg-blue-500/20 text-blue-400';
      case 'moderate': return 'bg-amber-500/20 text-amber-400';
      case 'aggressive': return 'bg-red-500/20 text-red-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  const getKycStatusColor = (status: string) => {
    switch (status) {
      case 'verified': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'pending': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'expired': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/clients">
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Clients
            </Button>
          </Link>
        </div>

        {/* Client Header Card */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6">
              <Avatar className="h-24 w-24 border-2 border-emerald-500">
                <AvatarFallback className="bg-emerald-500/20 text-emerald-400 text-2xl">
                  {(client.name || 'U').split(' ').map(n => n[0] || '').join('')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2" data-testid="text-client-name">
                      {client.name}
                      <Badge className={getRiskColor(client.riskProfile)}>
                        {(client.riskProfile || 'moderate').charAt(0).toUpperCase() + (client.riskProfile || 'moderate').slice(1)}
                      </Badge>
                    </h1>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-400">
                      <span className="flex items-center gap-1"><Mail className="h-4 w-4" />{client.email}</span>
                      <span className="flex items-center gap-1"><Phone className="h-4 w-4" />{client.phone}</span>
                      <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{client.address}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {client.tags.map((tag, i) => (
                        <Badge key={i} variant="outline" className="text-xs border-slate-600 text-slate-300">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" data-testid="button-call-client">
                      <Phone className="h-4 w-4 mr-2" />
                      Call
                    </Button>
                    <Button size="sm" variant="outline" className="border-slate-600" data-testid="button-email-client">
                      <Mail className="h-4 w-4 mr-2" />
                      Email
                    </Button>
                    <Button size="sm" variant="outline" className="border-slate-600" data-testid="button-schedule-meeting">
                      <Video className="h-4 w-4 mr-2" />
                      Meet
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <p className="text-slate-400 text-sm">Total Portfolio</p>
              <p className="text-xl font-bold text-white" data-testid="text-total-portfolio">{formatCurrency(client.totalPortfolio)}</p>
              <p className="text-sm text-emerald-400 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />+{client.portfolioGrowth}%
              </p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <p className="text-slate-400 text-sm">Invested Since</p>
              <p className="text-xl font-bold text-white">{(formatDate(client.investedSince) || 'N/A').split(' ')[1] || ''} {(formatDate(client.investedSince) || 'N/A').split(' ')[2] || ''}</p>
              <p className="text-sm text-slate-400">{Math.floor((Date.now() - new Date(client.investedSince).getTime()) / (365 * 24 * 60 * 60 * 1000))} years</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <p className="text-slate-400 text-sm">KYC Status</p>
              <Badge className={`mt-1 ${getKycStatusColor(client.kycStatus)}`}>
                {client.kycStatus === 'verified' && <CheckCircle className="h-3 w-3 mr-1" />}
                {client.kycStatus === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                {client.kycStatus === 'expired' && <XCircle className="h-3 w-3 mr-1" />}
                {(client.kycStatus || 'pending').charAt(0).toUpperCase() + (client.kycStatus || 'pending').slice(1)}
              </Badge>
              <p className="text-sm text-slate-400 mt-1">Expires: {formatDate(client.kycExpiry)}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <p className="text-slate-400 text-sm">Last Contact</p>
              <p className="text-xl font-bold text-white">{formatDate(client.lastContact)}</p>
              <p className="text-sm text-slate-400">{client.preferredContact}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <p className="text-slate-400 text-sm">Next Review</p>
              <p className="text-xl font-bold text-white">{formatDate(client.nextReview)}</p>
              <p className="text-sm text-amber-400 flex items-center gap-1">
                <Calendar className="h-3 w-3" />In {Math.ceil((new Date(client.nextReview).getTime() - Date.now()) / (24 * 60 * 60 * 1000))} days
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="overview" className="data-[state=active]:bg-emerald-600">Overview</TabsTrigger>
            <TabsTrigger value="goals" className="data-[state=active]:bg-emerald-600">Financial Goals</TabsTrigger>
            <TabsTrigger value="holdings" className="data-[state=active]:bg-emerald-600">Holdings</TabsTrigger>
            <TabsTrigger value="notes" className="data-[state=active]:bg-emerald-600">Meeting Notes</TabsTrigger>
            <TabsTrigger value="activity" className="data-[state=active]:bg-emerald-600">Activity Timeline</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Client Details */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <User className="h-5 w-5 text-emerald-400" />
                    Client Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">PAN</span>
                    <span className="text-white font-mono">{client.pan}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Date of Birth</span>
                    <span className="text-white">{formatDate(client.dateOfBirth)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Occupation</span>
                    <span className="text-white">{client.occupation}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Annual Income</span>
                    <span className="text-white">{formatCurrency(client.annualIncome)}</span>
                  </div>
                  <div className="pt-3 border-t border-slate-700">
                    <p className="text-slate-400 text-sm mb-2">Notes</p>
                    <p className="text-white text-sm">{client.notes}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Goals Summary */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-emerald-400" />
                      Financial Goals
                    </span>
                    <Badge variant="outline" className="border-slate-600 text-slate-300">
                      {goals.length} goals
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[280px]">
                    <div className="space-y-4">
                      {goals.map((goal) => {
                        const Icon = GOAL_ICONS[goal.category];
                        const progress = (goal.currentAmount / goal.targetAmount) * 100;
                        return (
                          <div key={goal.id} className="p-3 bg-slate-900/50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4 text-emerald-400" />
                                <span className="text-white text-sm font-medium">{goal.name}</span>
                              </div>
                              <Badge className={goal.priority === 'high' ? 'bg-red-500/20 text-red-400' : goal.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}>
                                {goal.priority}
                              </Badge>
                            </div>
                            <Progress value={progress} className="h-2 mb-2" />
                            <div className="flex justify-between text-xs text-slate-400">
                              <span>{formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}</span>
                              <span>{progress.toFixed(0)}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-emerald-400" />
                      Recent Activity
                    </span>
                    <Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300" onClick={() => setActiveTab('activity')}>
                      View All
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[280px]">
                    <div className="space-y-3">
                      {activities.slice(0, 5).map((activity) => {
                        const Icon = getActivityIcon(activity.type);
                        return (
                          <div key={activity.id} className="flex gap-3 p-2 rounded-lg hover:bg-slate-900/50">
                            <div className={`p-2 rounded-lg ${getActivityColor(activity.type)}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1">
                              <p className="text-white text-sm font-medium">{activity.title}</p>
                              <p className="text-slate-400 text-xs">{activity.description}</p>
                              <p className="text-slate-500 text-xs mt-1">{formatDate(activity.date)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Financial Goals Tab */}
          <TabsContent value="goals" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">Financial Goals</h2>
              <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="button-add-goal">
                <Plus className="h-4 w-4 mr-2" />
                Add Goal
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {goals.map((goal) => {
                const Icon = GOAL_ICONS[goal.category];
                const progress = (goal.currentAmount / goal.targetAmount) * 100;
                const isComplete = progress >= 100;
                return (
                  <Card key={goal.id} className={`bg-slate-800/50 border-slate-700 ${isComplete ? 'border-emerald-500/50' : ''}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-lg ${isComplete ? 'bg-emerald-500/20' : 'bg-slate-700'}`}>
                            <Icon className={`h-5 w-5 ${isComplete ? 'text-emerald-400' : 'text-slate-400'}`} />
                          </div>
                          <CardTitle className="text-white text-lg">{goal.name}</CardTitle>
                        </div>
                        {isComplete && <CheckCircle className="h-5 w-5 text-emerald-400" />}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-slate-400">Progress</span>
                          <span className={isComplete ? 'text-emerald-400' : 'text-white'}>{progress.toFixed(0)}%</span>
                        </div>
                        <Progress value={Math.min(progress, 100)} className="h-3" />
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Current</span>
                          <span className="text-white font-medium">{formatCurrency(goal.currentAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Target</span>
                          <span className="text-white font-medium">{formatCurrency(goal.targetAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Target Date</span>
                          <span className="text-white">{formatDate(goal.targetDate)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Priority</span>
                          <Badge className={goal.priority === 'high' ? 'bg-red-500/20 text-red-400' : goal.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}>
                            {goal.priority.charAt(0).toUpperCase() + goal.priority.slice(1)}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Holdings Tab */}
          <TabsContent value="holdings" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">Portfolio Holdings</h2>
              <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="button-add-holding">
                <Plus className="h-4 w-4 mr-2" />
                Add Investment
              </Button>
            </div>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left p-4 text-slate-400 text-sm font-medium">Investment</th>
                        <th className="text-left p-4 text-slate-400 text-sm font-medium">Type</th>
                        <th className="text-right p-4 text-slate-400 text-sm font-medium">Invested</th>
                        <th className="text-right p-4 text-slate-400 text-sm font-medium">Current</th>
                        <th className="text-right p-4 text-slate-400 text-sm font-medium">Returns</th>
                        <th className="text-right p-4 text-slate-400 text-sm font-medium">Returns %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holdings.map((holding) => (
                        <tr key={holding.id} className="border-b border-slate-700/50 hover:bg-slate-900/50">
                          <td className="p-4">
                            <span className="text-white font-medium">{holding.name}</span>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline" className="border-slate-600 text-slate-300">{holding.type}</Badge>
                          </td>
                          <td className="p-4 text-right text-slate-300">{formatCurrency(holding.invested)}</td>
                          <td className="p-4 text-right text-white font-medium">{formatCurrency(holding.current)}</td>
                          <td className="p-4 text-right">
                            <span className={holding.returns >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                              {holding.returns >= 0 ? '+' : ''}{formatCurrency(holding.returns)}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <span className={`flex items-center justify-end gap-1 ${holding.returnsPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {holding.returnsPercent >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {holding.returnsPercent >= 0 ? '+' : ''}{holding.returnsPercent.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-900/50">
                        <td colSpan={2} className="p-4 text-white font-bold">Total</td>
                        <td className="p-4 text-right text-slate-300 font-medium">{formatCurrency(holdings.reduce((s, h) => s + h.invested, 0))}</td>
                        <td className="p-4 text-right text-white font-bold">{formatCurrency(holdings.reduce((s, h) => s + h.current, 0))}</td>
                        <td className="p-4 text-right text-emerald-400 font-bold">+{formatCurrency(holdings.reduce((s, h) => s + h.returns, 0))}</td>
                        <td className="p-4 text-right text-emerald-400 font-bold">+{((holdings.reduce((s, h) => s + h.returns, 0) / holdings.reduce((s, h) => s + h.invested, 0)) * 100).toFixed(1)}%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Meeting Notes Tab */}
          <TabsContent value="notes" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">Meeting Notes</h2>
              <Dialog open={showAddNote} onOpenChange={setShowAddNote}>
                <DialogTrigger asChild>
                  <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="button-add-note">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Note
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Add Meeting Note</DialogTitle>
                    <DialogDescription className="text-slate-400">Record notes from your client interaction</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div>
                      <Label className="text-slate-300">Meeting Type</Label>
                      <div className="flex gap-2 mt-2">
                        {['call', 'meeting', 'video'].map((type) => (
                          <Button
                            key={type}
                            variant={newNote.type === type ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setNewNote({ ...newNote, type: type as any })}
                            className={newNote.type === type ? 'bg-emerald-600' : 'border-slate-600'}
                          >
                            {type === 'call' && <PhoneCall className="h-4 w-4 mr-1" />}
                            {type === 'meeting' && <User className="h-4 w-4 mr-1" />}
                            {type === 'video' && <Video className="h-4 w-4 mr-1" />}
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="summary" className="text-slate-300">Summary</Label>
                      <Textarea
                        id="summary"
                        value={newNote.summary}
                        onChange={(e) => setNewNote({ ...newNote, summary: e.target.value })}
                        className="mt-1 bg-slate-800 border-slate-700"
                        placeholder="Key discussion points..."
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label htmlFor="actions" className="text-slate-300">Action Items (one per line)</Label>
                      <Textarea
                        id="actions"
                        value={newNote.actionItems}
                        onChange={(e) => setNewNote({ ...newNote, actionItems: e.target.value })}
                        className="mt-1 bg-slate-800 border-slate-700"
                        placeholder="- Action 1&#10;- Action 2"
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label htmlFor="next" className="text-slate-300">Next Steps</Label>
                      <Input
                        id="next"
                        value={newNote.nextSteps}
                        onChange={(e) => setNewNote({ ...newNote, nextSteps: e.target.value })}
                        className="mt-1 bg-slate-800 border-slate-700"
                        placeholder="Follow-up plan..."
                      />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button variant="outline" onClick={() => setShowAddNote(false)} className="border-slate-600">Cancel</Button>
                      <Button className="bg-emerald-600 hover:bg-emerald-700">Save Note</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="space-y-4">
              {notes.map((note) => (
                <Card key={note.id} className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${note.type === 'call' ? 'bg-blue-500/20' : note.type === 'meeting' ? 'bg-purple-500/20' : 'bg-cyan-500/20'}`}>
                        {note.type === 'call' && <PhoneCall className="h-5 w-5 text-blue-400" />}
                        {note.type === 'meeting' && <User className="h-5 w-5 text-purple-400" />}
                        {note.type === 'video' && <Video className="h-5 w-5 text-cyan-400" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className="border-slate-600 text-slate-300">
                            {note.type.charAt(0).toUpperCase() + note.type.slice(1)}
                          </Badge>
                          <span className="text-slate-400 text-sm">{formatDate(note.date)}</span>
                        </div>
                        <p className="text-white mb-3">{note.summary}</p>
                        {note.actionItems.length > 0 && (
                          <div className="mb-3">
                            <p className="text-slate-400 text-sm mb-1">Action Items:</p>
                            <ul className="list-disc list-inside text-sm text-slate-300">
                              {note.actionItems.map((item, i) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm">
                          <ChevronRight className="h-4 w-4 text-emerald-400" />
                          <span className="text-slate-300">{note.nextSteps}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Activity Timeline Tab */}
          <TabsContent value="activity" className="space-y-4">
            <h2 className="text-xl font-bold text-white">Activity Timeline</h2>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4">
                <div className="space-y-4">
                  {activities.map((activity, index) => {
                    const Icon = getActivityIcon(activity.type);
                    return (
                      <div key={activity.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`p-2 rounded-full ${getActivityColor(activity.type)}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          {index < activities.length - 1 && (
                            <div className="w-0.5 flex-1 bg-slate-700 my-2" />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-white font-medium">{activity.title}</p>
                              <p className="text-slate-400 text-sm">{activity.description}</p>
                              {activity.amount && (
                                <p className="text-emerald-400 text-sm mt-1">
                                  {formatCurrency(activity.amount)}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-slate-500 text-sm">{formatDate(activity.date)}</p>
                              {activity.status && (
                                <Badge className={`mt-1 ${activity.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : activity.status === 'action_needed' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                  {activity.status.replace('_', ' ')}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
