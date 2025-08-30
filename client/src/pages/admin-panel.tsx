import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Users, Activity, TrendingUp, MessageSquare, Settings, Search, Filter, Shield, FileText, Building2, Plus, Edit3, Trash2, Server, Brain, Zap, Lock, Receipt, CheckCircle, Calendar, Download, Loader2, DollarSign, Clock, Eye, Edit, Send, UserPlus, MoreVertical, ShieldCheck, ShieldAlert, Bot, Monitor, BarChart, Globe, Mail, Target, TrendingDown, Share2, Megaphone, MousePointer, Users2, BarChart3, PieChart, LineChart, Phone } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { RiskProfileViewer } from "@/components/risk-profiling/risk-profile-viewer";
import { RiskAssessmentForm } from "@/components/risk-profiling/risk-assessment-form";
import { CapitalGainsReportViewer } from "@/components/reports/capital-gains-report-viewer";
import { TransactionReportViewer } from "@/components/reports/transaction-report-viewer";
import CkycManagement from "./admin/ckyc-management";

// API Status Panel Component
function ApiStatusPanel() {
  const { data: apiStatus, isLoading, error } = useQuery({
    queryKey: ['/api/admin/api-status'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-50';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50';
      case 'unhealthy':
      case 'error':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return '🟢';
      case 'degraded':
        return '🟡';
      case 'unhealthy':
      case 'error':
        return '🔴';
      default:
        return '⚪';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            API Status Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-600">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            Failed to fetch API status
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Health Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            System Health Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor((apiStatus as any)?.overall?.status || 'unknown')}`}>
                {getStatusIcon((apiStatus as any)?.overall?.status || 'unknown')} {(apiStatus as any)?.overall?.status || 'Unknown'}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Overall Status</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{(apiStatus as any)?.overall?.healthScore || 0}%</div>
              <p className="text-sm text-muted-foreground">Health Score</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{(apiStatus as any)?.overall?.healthyEndpoints || 0}</div>
              <p className="text-sm text-muted-foreground">Healthy APIs</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{(apiStatus as any)?.overall?.totalEndpoints || 0}</div>
              <p className="text-sm text-muted-foreground">Total APIs</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Endpoints by Category */}
      {(apiStatus as any)?.categories && Object.entries((apiStatus as any).categories).map(([category, endpoints]: [string, any]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle>{category}</CardTitle>
            <CardDescription>
              {(endpoints as any[]).filter(ep => ep.status === 'healthy').length} of {(endpoints as any[]).length} services operational
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(endpoints as any[]).map((endpoint: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(endpoint.status)}`}>
                      {getStatusIcon(endpoint.status)} {endpoint.status}
                    </div>
                    <div>
                      <div className="font-medium">{endpoint.name}</div>
                      <div className="text-sm text-muted-foreground">{endpoint.message}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{endpoint.responseTime}ms</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(endpoint.lastChecked).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Last Updated */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-sm text-muted-foreground">
            Last updated: {(apiStatus as any)?.overall?.lastUpdated ? new Date((apiStatus as any).overall.lastUpdated).toLocaleString() : 'Never'}
            <br />
            <span className="text-xs">Auto-refreshes every 30 seconds</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}



// Marketing Tools Panel Component for Campaign Management and Analytics
function MarketingToolsPanel() {
  const { toast } = useToast();
  const [activeView, setActiveView] = useState('overview');
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const [campaigns, setCampaigns] = useState([
    {
      id: 'campaign-1',
      name: 'Q1 Investment Drive',
      type: 'email',
      status: 'active',
      reach: 15420,
      clicks: 2340,
      conversions: 156,
      budget: 25000,
      spent: 18750,
      startDate: '2024-01-15',
      endDate: '2024-03-31'
    },
    {
      id: 'campaign-2',
      name: 'Mutual Fund Awareness',
      type: 'social',
      status: 'paused',
      reach: 8900,
      clicks: 890,
      conversions: 45,
      budget: 15000,
      spent: 7200,
      startDate: '2024-01-20',
      endDate: '2024-02-20'
    }
  ]);

  const [leads, setLeads] = useState([
    {
      id: 'lead-1',
      name: 'Rajesh Kumar',
      email: 'rajesh@email.com',
      phone: '+91-9876543210',
      source: 'Website Form',
      interest: 'Mutual Funds',
      status: 'hot',
      score: 85,
      createdAt: '2024-01-20'
    },
    {
      id: 'lead-2',
      name: 'Priya Sharma',
      email: 'priya.s@email.com',
      phone: '+91-8765432109',
      source: 'Social Media',
      interest: 'Portfolio Management',
      status: 'warm',
      score: 72,
      createdAt: '2024-01-18'
    }
  ]);

  const marketingMetrics = {
    totalLeads: leads.length,
    hotLeads: leads.filter(l => l.status === 'hot').length,
    conversionRate: 12.8,
    costPerLead: 245,
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter(c => c.status === 'active').length,
    totalSpend: campaigns.reduce((sum, c) => sum + c.spent, 0),
    totalReach: campaigns.reduce((sum, c) => sum + c.reach, 0)
  };

  const handleCreateCampaign = () => {
    setIsCreatingCampaign(true);
    // Simulate campaign creation
    setTimeout(() => {
      toast({
        title: "Campaign Created",
        description: "Your marketing campaign has been created successfully",
      });
      setIsCreatingCampaign(false);
    }, 2000);
  };

  const handleLeadAction = (leadId: string, action: string) => {
    toast({
      title: `Lead ${action}`,
      description: `Successfully ${action.toLowerCase()} lead`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Marketing Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{marketingMetrics.totalLeads}</div>
            <p className="text-xs text-muted-foreground">
              {marketingMetrics.hotLeads} hot leads
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{marketingMetrics.activeCampaigns}</div>
            <p className="text-xs text-muted-foreground">
              {marketingMetrics.totalCampaigns} total campaigns
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{marketingMetrics.conversionRate}%</div>
            <p className="text-xs text-muted-foreground">
              ₹{marketingMetrics.costPerLead} cost per lead
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reach</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{marketingMetrics.totalReach.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              ₹{marketingMetrics.totalSpend.toLocaleString()} total spend
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Marketing Tools Navigation */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeView === 'overview' ? 'default' : 'outline'}
          onClick={() => setActiveView('overview')}
          size="sm"
        >
          <BarChart className="w-4 h-4 mr-2" />
          Overview
        </Button>
        <Button
          variant={activeView === 'campaigns' ? 'default' : 'outline'}
          onClick={() => setActiveView('campaigns')}
          size="sm"
        >
          <Target className="w-4 h-4 mr-2" />
          Campaigns
        </Button>
        <Button
          variant={activeView === 'leads' ? 'default' : 'outline'}
          onClick={() => setActiveView('leads')}
          size="sm"
        >
          <Users2 className="w-4 h-4 mr-2" />
          Leads
        </Button>
        <Button
          variant={activeView === 'email' ? 'default' : 'outline'}
          onClick={() => setActiveView('email')}
          size="sm"
        >
          <Mail className="w-4 h-4 mr-2" />
          Email Marketing
        </Button>
        <Button
          variant={activeView === 'social' ? 'default' : 'outline'}
          onClick={() => setActiveView('social')}
          size="sm"
        >
          <Share2 className="w-4 h-4 mr-2" />
          Social Media
        </Button>
        <Button
          variant={activeView === 'whatsapp' ? 'default' : 'outline'}
          onClick={() => setActiveView('whatsapp')}
          size="sm"
        >
          <Phone className="w-4 h-4 mr-2" />
          WhatsApp Marketing
        </Button>
      </div>

      {/* Campaign Management */}
      {activeView === 'campaigns' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Campaign Management</h3>
            <Button onClick={handleCreateCampaign} disabled={isCreatingCampaign}>
              <Plus className="w-4 h-4 mr-2" />
              {isCreatingCampaign ? 'Creating...' : 'New Campaign'}
            </Button>
          </div>

          <div className="grid gap-4">
            {campaigns.map((campaign) => (
              <Card key={campaign.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base">{campaign.name}</CardTitle>
                      <CardDescription>
                        {campaign.type.toUpperCase()} • {campaign.startDate} to {campaign.endDate}
                      </CardDescription>
                    </div>
                    <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                      {campaign.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Reach</p>
                      <p className="text-lg font-semibold">{campaign.reach.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Clicks</p>
                      <p className="text-lg font-semibold">{campaign.clicks.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Conversions</p>
                      <p className="text-lg font-semibold">{campaign.conversions}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Budget Usage</p>
                      <p className="text-lg font-semibold">
                        ₹{campaign.spent.toLocaleString()} / ₹{campaign.budget.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button size="sm" variant="outline">
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button size="sm" variant="outline">
                      <BarChart className="w-4 h-4 mr-2" />
                      Analytics
                    </Button>
                    <Button size="sm" variant="outline">
                      {campaign.status === 'active' ? 'Pause' : 'Resume'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Lead Management */}
      {activeView === 'leads' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Lead Management</h3>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              Import Leads
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Interest</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.name}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{lead.email}</div>
                          <div className="text-muted-foreground">{lead.phone}</div>
                        </div>
                      </TableCell>
                      <TableCell>{lead.source}</TableCell>
                      <TableCell>{lead.interest}</TableCell>
                      <TableCell>
                        <Badge variant={
                          lead.status === 'hot' ? 'destructive' : 
                          lead.status === 'warm' ? 'default' : 'secondary'
                        }>
                          {lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium">{lead.score}</div>
                          <div className="w-16 bg-muted rounded-full h-2">
                            <div 
                              className="bg-primary h-2 rounded-full" 
                              style={{ width: `${lead.score}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => handleLeadAction(lead.id, 'Contact')}>
                            <Phone className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleLeadAction(lead.id, 'Email')}>
                            <Mail className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleLeadAction(lead.id, 'Edit')}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Email Marketing */}
      {activeView === 'email' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Email Marketing</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Email Campaign Builder</CardTitle>
                <CardDescription>Create and send targeted email campaigns</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Campaign Name</Label>
                  <Input placeholder="Enter campaign name" />
                </div>
                <div className="space-y-2">
                  <Label>Target Audience</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select audience" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Clients</SelectItem>
                      <SelectItem value="new">New Clients</SelectItem>
                      <SelectItem value="active">Active Investors</SelectItem>
                      <SelectItem value="inactive">Inactive Clients</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Email Template</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newsletter">Newsletter</SelectItem>
                      <SelectItem value="promotion">Promotion</SelectItem>
                      <SelectItem value="welcome">Welcome Series</SelectItem>
                      <SelectItem value="educational">Educational Content</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full">
                  <Send className="w-4 h-4 mr-2" />
                  Create Campaign
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Email Analytics</CardTitle>
                <CardDescription>Track email campaign performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Open Rate</span>
                    <span className="font-medium">24.5%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Click Rate</span>
                    <span className="font-medium">8.2%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bounce Rate</span>
                    <span className="font-medium">2.1%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unsubscribe Rate</span>
                    <span className="font-medium">0.8%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Sent</span>
                    <span className="font-medium">12,450</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Social Media Marketing */}
      {activeView === 'social' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Social Media Marketing</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="w-4 h-4" />
                  Facebook
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Followers</span>
                    <span className="font-medium">8,420</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Engagement</span>
                    <span className="font-medium">6.8%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Reach</span>
                    <span className="font-medium">45,200</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="w-4 h-4" />
                  LinkedIn
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Connections</span>
                    <span className="font-medium">12,680</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Engagement</span>
                    <span className="font-medium">12.4%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Impressions</span>
                    <span className="font-medium">89,300</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="w-4 h-4" />
                  Twitter
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Followers</span>
                    <span className="font-medium">5,240</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Engagement</span>
                    <span className="font-medium">4.2%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Impressions</span>
                    <span className="font-medium">32,100</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Social Media Scheduler</CardTitle>
              <CardDescription>Schedule posts across all platforms</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea placeholder="What's on your mind? Share investment tips, market insights, or educational content..." />
              <div className="flex gap-2">
                <Button size="sm" variant="outline">📷 Add Image</Button>
                <Button size="sm" variant="outline">📊 Add Chart</Button>
                <Button size="sm" variant="outline">🔗 Add Link</Button>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  <Badge variant="secondary">Facebook</Badge>
                  <Badge variant="secondary">LinkedIn</Badge>
                  <Badge variant="outline">Twitter</Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">Schedule</Button>
                  <Button size="sm">Post Now</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* WhatsApp Marketing */}
      {activeView === 'whatsapp' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">WhatsApp Marketing Center</h3>
            <Button onClick={() => toast({ title: "WhatsApp Connected", description: "Your WhatsApp Business API is active and ready" })}>
              <Phone className="w-4 h-4 mr-2" />
              Connect WhatsApp Business
            </Button>
          </div>

          {/* WhatsApp Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
                <Phone className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">2,847</div>
                <p className="text-xs text-muted-foreground">+12% from last month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Read Rate</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">89.2%</div>
                <p className="text-xs text-muted-foreground">Industry leading</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">34.7%</div>
                <p className="text-xs text-muted-foreground">+5.2% increase</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Contacts</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">1,234</div>
                <p className="text-xs text-muted-foreground">Opted-in contacts</p>
              </CardContent>
            </Card>
          </div>

          {/* WhatsApp Campaign Tools */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="w-5 h-5" />
                  Broadcast Campaign
                </CardTitle>
                <CardDescription>Send marketing messages to segmented audiences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Campaign Type</Label>
                  <Select defaultValue="portfolio-update">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portfolio-update">Portfolio Updates</SelectItem>
                      <SelectItem value="market-alerts">Market Alerts</SelectItem>
                      <SelectItem value="educational">Educational Content</SelectItem>
                      <SelectItem value="promotional">Promotional Offers</SelectItem>
                      <SelectItem value="onboarding">New User Onboarding</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Target Audience</Label>
                  <Select defaultValue="active-traders">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-users">All Users</SelectItem>
                      <SelectItem value="new-users">New Users (Last 30 days)</SelectItem>
                      <SelectItem value="active-traders">Active Traders</SelectItem>
                      <SelectItem value="long-term-investors">Long-term Investors</SelectItem>
                      <SelectItem value="inactive-users">Inactive Users</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Message Template</Label>
                  <Textarea 
                    placeholder="🏦 *Market Update from FintekPro*

Hi {{name}}, your portfolio has gained {{gain}}% today! 

📊 Top performers:
• {{stock1}}: +{{percent1}}%
• {{stock2}}: +{{percent2}}%

💡 AI Recommendation: {{recommendation}}

Login to view detailed analysis: {{app_link}}"
                    className="min-h-[150px]"
                  />
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => toast({ title: "Preview Ready", description: "WhatsApp message preview generated" })}>
                    <Eye className="w-4 h-4 mr-2" />
                    Preview
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => toast({ title: "Campaign Scheduled", description: "WhatsApp broadcast will be sent to 1,234 contacts" })}>
                    <Send className="w-4 h-4 mr-2" />
                    Send Now
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5" />
                  AI-Powered Automation
                </CardTitle>
                <CardDescription>Automated WhatsApp marketing sequences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Welcome Sequence</p>
                      <p className="text-sm text-muted-foreground">3-message onboarding flow</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Active</Badge>
                      <Button size="sm" variant="outline">Edit</Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Market Alert Automation</p>
                      <p className="text-sm text-muted-foreground">Triggered by significant movements</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Active</Badge>
                      <Button size="sm" variant="outline">Edit</Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Portfolio Performance</p>
                      <p className="text-sm text-muted-foreground">Weekly summary messages</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Paused</Badge>
                      <Button size="sm" variant="outline">Edit</Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Re-engagement Campaign</p>
                      <p className="text-sm text-muted-foreground">For inactive users (30+ days)</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Active</Badge>
                      <Button size="sm" variant="outline">Edit</Button>
                    </div>
                  </div>
                </div>

                <Button className="w-full" onClick={() => toast({ title: "New Automation", description: "Create a new WhatsApp automation sequence" })}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Automation
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* WhatsApp Analytics & Templates */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Message Templates</CardTitle>
                <CardDescription>Pre-approved WhatsApp Business templates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-medium">Portfolio Alert</p>
                      <Badge variant="secondary">Approved</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      🚨 Your portfolio {"{{action}}"} by {"{{percentage}}"}% today. Check the details...
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline">Edit</Button>
                      <Button size="sm" variant="outline">Use Template</Button>
                    </div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-medium">Market Insight</p>
                      <Badge variant="secondary">Approved</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      📊 Market Update: {"{{market_summary}}"}. AI recommends: {"{{recommendation}}"}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline">Edit</Button>
                      <Button size="sm" variant="outline">Use Template</Button>
                    </div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-medium">Educational Tip</p>
                      <Badge variant="secondary">Approved</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      💡 Investment Tip: {"{{educational_content}}"}. Learn more in the app.
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline">Edit</Button>
                      <Button size="sm" variant="outline">Use Template</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Campaign Performance</CardTitle>
                <CardDescription>Last 7 days WhatsApp campaign metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Market Alert Campaign</p>
                      <p className="text-sm text-muted-foreground">Sent 2 days ago</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">89.2% read</p>
                      <p className="text-sm text-muted-foreground">1,234 sent</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Portfolio Summary</p>
                      <p className="text-sm text-muted-foreground">Sent 5 days ago</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">76.8% read</p>
                      <p className="text-sm text-muted-foreground">987 sent</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Educational Content</p>
                      <p className="text-sm text-muted-foreground">Sent 7 days ago</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">92.1% read</p>
                      <p className="text-sm text-muted-foreground">1,456 sent</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-green-600">86.4%</p>
                      <p className="text-sm text-muted-foreground">Avg. Read Rate</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-600">28.7%</p>
                      <p className="text-sm text-muted-foreground">Click-through Rate</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* WhatsApp Capabilities Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                WhatsApp Marketing Capabilities
              </CardTitle>
              <CardDescription>
                Comprehensive WhatsApp Business API integration for automated marketing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    Automated Campaigns
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• AI-powered portfolio updates</li>
                    <li>• Market alert notifications</li>
                    <li>• Educational content delivery</li>
                    <li>• User onboarding sequences</li>
                    <li>• Re-engagement campaigns</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Smart Targeting
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• User segmentation by activity</li>
                    <li>• Investment behavior analysis</li>
                    <li>• Portfolio performance targeting</li>
                    <li>• Risk profile based messaging</li>
                    <li>• Personalized recommendations</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <BarChart className="w-4 h-4" />
                    Analytics & Tracking
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Real-time delivery status</li>
                    <li>• Read receipt tracking</li>
                    <li>• Click-through rate analysis</li>
                    <li>• Conversion tracking</li>
                    <li>• ROI measurement</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Overview Dashboard */}
      {activeView === 'overview' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Marketing Dashboard</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {campaigns.slice(0, 3).map((campaign) => (
                    <div key={campaign.id} className="flex justify-between items-center p-3 border rounded">
                      <div>
                        <p className="font-medium">{campaign.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {campaign.conversions} conversions • {((campaign.clicks / campaign.reach) * 100).toFixed(1)}% CTR
                        </p>
                      </div>
                      <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                        {campaign.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Lead Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span>Website Forms</span>
                    <span className="font-medium">45%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Social Media</span>
                    <span className="font-medium">28%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Email Campaigns</span>
                    <span className="font-medium">18%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Referrals</span>
                    <span className="font-medium">9%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

interface ClientStats {
  totalClients: number;
  activeClients: number;
  newClientsToday: number;
  totalLogins: number;
  avgSessionTime: number;
}

interface ActivityMetrics {
  pageViews: number;
  apiCalls: number;
  trades: number;
  portfolioViews: number;
  topActions: Array<{ action: string; count: number }>;
}

interface PlatformInsights {
  clientGrowth: Array<{ date: string; count: number }>;
  popularFeatures: Array<{ feature: string; usage: number }>;
  clientEngagement: {
    dailyActiveClients: number;
    weeklyActiveClients: number;
    monthlyActiveClients: number;
  };
  systemHealth: {
    uptime: string;
    errorRate: number;
    responseTime: number;
  };
}

interface Client {
  id: string;
  email: string;
  mobile: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  loginCount: number;
  lastLoginAt: string | null;
  createdAt: string;
}

interface ClientActivity {
  id: string;
  userId: string;
  action: string;
  resource: string;
  details: any;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

// Comprehensive User Management Component
function ComprehensiveUserManagement() {
  const { toast } = useToast();
  const [selectedUserType, setSelectedUserType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['/api/admin/users', selectedUserType, searchQuery, statusFilter, roleFilter],
    enabled: true
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, updates }: { userId: string, updates: any }) => {
      const response = await apiRequest('PUT', `/api/admin/users/${userId}`, updates);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: 'User updated successfully' });
    }
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ userIds, updates }: { userIds: string[], updates: any }) => {
      const response = await apiRequest('POST', '/api/admin/users/bulk-update', { userIds, updates });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setSelectedUsers([]);
      toast({ title: 'Bulk update completed successfully' });
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest('DELETE', `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: 'User deleted successfully' });
    }
  });

  const getUserTypeColor = (role: string) => {
    const colors = {
      'user': 'bg-blue-100 text-blue-800',
      'client': 'bg-green-100 text-green-800',
      'partner': 'bg-purple-100 text-purple-800',
      'supplier': 'bg-orange-100 text-orange-800',
      'agent': 'bg-cyan-100 text-cyan-800',
      'admin': 'bg-red-100 text-red-800',
      'super_admin': 'bg-gray-800 text-white'
    };
    return colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const handleBulkAction = (action: string) => {
    if (selectedUsers.length === 0) {
      toast({ title: 'No users selected', variant: 'destructive' });
      return;
    }

    switch (action) {
      case 'activate':
        bulkUpdateMutation.mutate({ userIds: selectedUsers, updates: { isActive: true } });
        break;
      case 'deactivate':
        bulkUpdateMutation.mutate({ userIds: selectedUsers, updates: { isActive: false } });
        break;
      case 'send_notification':
        // Open notification modal for bulk users
        break;
    }
  };

  const userStats = {
    total: (usersData as any)?.total || 0,
    clients: (usersData as any)?.stats?.clients || 0,
    partners: (usersData as any)?.stats?.partners || 0,
    suppliers: (usersData as any)?.stats?.suppliers || 0,
    agents: (usersData as any)?.stats?.agents || 0,
    active: (usersData as any)?.stats?.active || 0,
    inactive: (usersData as any)?.stats?.inactive || 0
  };

  return (
    <div className="space-y-6">
      {/* User Statistics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userStats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clients</CardTitle>
            <Users2 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{userStats.clients}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Partners</CardTitle>
            <Building2 className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{userStats.partners}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suppliers</CardTitle>
            <Building2 className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{userStats.suppliers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agents</CardTitle>
            <ShieldCheck className="h-4 w-4 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-600">{userStats.agents}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{userStats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <Clock className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-500">{userStats.inactive}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            User Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label>User Type</Label>
              <Select value={selectedUserType} onValueChange={setSelectedUserType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="user">Standard Users</SelectItem>
                  <SelectItem value="client">Clients</SelectItem>
                  <SelectItem value="partner">Partners</SelectItem>
                  <SelectItem value="supplier">Suppliers</SelectItem>
                  <SelectItem value="agent">Agents</SelectItem>
                  <SelectItem value="admin">Admins</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="pending">Pending Approval</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Role</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="user">Regular User</SelectItem>
                  <SelectItem value="premium">Premium User</SelectItem>
                  <SelectItem value="vip">VIP Client</SelectItem>
                  <SelectItem value="corporate">Corporate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Search Users</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, phone, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedUsers.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">
                  {selectedUsers.length} users selected
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedUsers([])}
                >
                  Clear Selection
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => handleBulkAction('activate')}>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Activate
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('deactivate')}>
                  <Clock className="h-4 w-4 mr-1" />
                  Deactivate
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('send_notification')}>
                  <Send className="h-4 w-4 mr-1" />
                  Send Message
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>User Management</CardTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setShowBulkActions(!showBulkActions)}>
                <UserPlus className="h-4 w-4 mr-1" />
                Add User
              </Button>
              <Button size="sm" variant="outline">
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUsers((usersData as any)?.users?.map((u: any) => u.id) || []);
                          } else {
                            setSelectedUsers([]);
                          }
                        }}
                        checked={selectedUsers.length === (usersData as any)?.users?.length}
                      />
                    </TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Type/Role</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(usersData as any)?.users?.map((user: any) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUsers([...selectedUsers, user.id]);
                            } else {
                              setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            {user.firstName?.[0] || user.email?.[0] || '?'}
                          </div>
                          <div>
                            <div className="font-medium">
                              {user.firstName} {user.lastName || ''}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              ID: {user.id.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge className={getUserTypeColor(user.role || 'user')}>
                            {user.role || 'User'}
                          </Badge>
                          {user.userType && (
                            <div className="text-xs text-muted-foreground">
                              {user.userType}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm">{user.email}</div>
                          {user.mobile && (
                            <div className="text-xs text-muted-foreground">
                              {user.mobile}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? 'default' : 'secondary'}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {user.lastLoginAt 
                            ? format(new Date(user.lastLoginAt), 'MMM dd, yyyy')
                            : 'Never'
                          }
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost">
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this user?')) {
                                deleteUserMutation.mutate(user.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminPanel() {
  const { toast } = useToast();
  
  // Get current user to check if super admin
  const { data: currentUser } = useQuery({
    queryKey: ['/api/user'],
    retry: false,
  });
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [guidanceDialog, setGuidanceDialog] = useState(false);
  const [guidanceForm, setGuidanceForm] = useState({
    title: "",
    message: "",
    type: "guidance",
    priority: "medium",
    actionUrl: ""
  });
  const [createClientDialog, setCreateClientDialog] = useState(false);
  const [editClientDialog, setEditClientDialog] = useState(false);
  const [deleteClientDialog, setDeleteClientDialog] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [clientForm, setClientForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
    role: "user",
    isActive: true
  });

  // Fetch dashboard data
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ["/api/admin/dashboard"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch clients with filtering
  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ["/api/admin/users", { searchTerm, role: roleFilter, isActive: statusFilter }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('searchTerm', searchTerm);
      if (roleFilter !== 'all') params.append('role', roleFilter);
      if (statusFilter !== 'all') params.append('isActive', statusFilter);
      
      return fetch(`/api/admin/users?${params}`).then(res => res.json());
    }
  });

  // Fetch platform insights
  const { data: insights } = useQuery({
    queryKey: ["/api/admin/insights"],
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch recent activities
  const { data: activities } = useQuery({
    queryKey: ["/api/admin/activities"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Update client role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ clientId, role }: { clientId: string; role: string }) => {
      const response = await apiRequest("PATCH", `/api/admin/users/${clientId}/role`, { role });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "Client role updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update client status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ clientId, isActive }: { clientId: string; isActive: boolean }) => {
      const response = await apiRequest("PATCH", `/api/admin/users/${clientId}/status`, { isActive });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "Client status updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Send guidance mutation
  const sendGuidanceMutation = useMutation({
    mutationFn: async ({ clientId, guidance }: { clientId: string; guidance: any }) => {
      const response = await apiRequest("POST", `/api/admin/users/${clientId}/guidance`, guidance);
      return response.json();
    },
    onSuccess: () => {
      setGuidanceDialog(false);
      setGuidanceForm({
        title: "",
        message: "",
        type: "guidance",
        priority: "medium",
        actionUrl: ""
      });
      toast({
        title: "Success",
        description: "Guidance sent successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create client mutation
  const createClientMutation = useMutation({
    mutationFn: async (clientData: any) => {
      const response = await apiRequest("POST", "/api/admin/users", clientData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setCreateClientDialog(false);
      setClientForm({
        firstName: "",
        lastName: "",
        email: "",
        mobile: "",
        role: "user",
        isActive: true
      });
      toast({
        title: "Success",
        description: "Client created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update client mutation
  const updateClientMutation = useMutation({
    mutationFn: async ({ clientId, clientData }: { clientId: string; clientData: any }) => {
      const response = await apiRequest("PATCH", `/api/admin/users/${clientId}`, clientData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditClientDialog(false);
      setSelectedClient(null);
      toast({
        title: "Success",
        description: "Client updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete client mutation
  const deleteClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const response = await apiRequest("DELETE", `/api/admin/users/${clientId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setDeleteClientDialog(false);
      setClientToDelete(null);
      toast({
        title: "Success",
        description: "Client deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const { clientStats, activityMetrics, platformInsights: dashboardInsights } = (dashboardData as any) || {
    clientStats: { totalClients: 0, activeClients: 0, newClientsToday: 0, totalLogins: 0, avgSessionTime: 0 },
    activityMetrics: { pageViews: 0, apiCalls: 0, trades: 0, portfolioViews: 0, topActions: [] },
    platformInsights: { systemHealth: { uptime: "0h 0m", errorRate: 0, responseTime: 0 } }
  };

  return (
    <div className="min-h-screen bg-background" data-testid="admin-panel">
      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-admin-title">Admin Panel</h1>
          <p className="text-muted-foreground" data-testid="text-admin-subtitle">
            Monitor and manage platform activity
          </p>
        </div>
        <Badge variant="secondary" data-testid="badge-admin-status">Admin Access</Badge>
      </div>

      <div className="flex h-screen">
        {/* Left Sidebar */}
        <div className="w-64 border-r bg-card shadow-sm flex-shrink-0">
          <Tabs defaultValue="dashboard" orientation="vertical" className="w-full h-full">
            <TabsList className="flex flex-col h-auto w-full bg-transparent p-2 space-y-1">
              <TabsTrigger 
                value="dashboard" 
                data-testid="tab-dashboard"
                className="w-full justify-start data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <TrendingUp className="w-4 h-4 mr-3" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger 
                value="comprehensive-users" 
                data-testid="tab-comprehensive-users"
                className="w-full justify-start data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Users2 className="w-4 h-4 mr-3" />
                All Users
              </TabsTrigger>
              <TabsTrigger 
                value="clients" 
                data-testid="tab-clients"
                className="w-full justify-start data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Users className="w-4 h-4 mr-3" />
                Clients
              </TabsTrigger>
              <TabsTrigger 
                value="activity" 
                data-testid="tab-activity"
                className="w-full justify-start data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Activity className="w-4 h-4 mr-3" />
                Activity
              </TabsTrigger>
              <TabsTrigger 
                value="ckyc" 
                data-testid="tab-ckyc"
                className="w-full justify-start data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Shield className="w-4 h-4 mr-3" />
                CKYC
              </TabsTrigger>
              <TabsTrigger 
                value="api-status" 
                data-testid="tab-api-status"
                className="w-full justify-start data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Server className="w-4 h-4 mr-3" />
                API Status
              </TabsTrigger>
              <TabsTrigger 
                value="error-monitoring" 
                data-testid="tab-error-monitoring"
                className="w-full justify-start data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Brain className="w-4 h-4 mr-3" />
                AI Monitor
              </TabsTrigger>
              <TabsTrigger 
                value="insights" 
                data-testid="tab-insights"
                className="w-full justify-start data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Settings className="w-4 h-4 mr-3" />
                Insights
              </TabsTrigger>
              <TabsTrigger 
                value="risk-profiling" 
                data-testid="tab-risk-profiling"
                className="w-full justify-start data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Shield className="w-4 h-4 mr-3" />
                Risk Profiles
              </TabsTrigger>
              <TabsTrigger 
                value="reports" 
                data-testid="tab-reports"
                className="w-full justify-start data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <FileText className="w-4 h-4 mr-3" />
                Reports
              </TabsTrigger>
              <TabsTrigger 
                value="guidance" 
                data-testid="tab-guidance"
                className="w-full justify-start data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <MessageSquare className="w-4 h-4 mr-3" />
                Guidance
              </TabsTrigger>
              <TabsTrigger 
                value="partners" 
                data-testid="tab-partners"
                className="w-full justify-start data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Building2 className="w-4 h-4 mr-3" />
                Partners
              </TabsTrigger>
              <TabsTrigger 
                value="agents" 
                data-testid="tab-agents"
                className="w-full justify-start data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Users className="w-4 h-4 mr-3" />
                Care Agents
              </TabsTrigger>
              <TabsTrigger 
                value="marketing" 
                data-testid="tab-marketing"
                className="w-full justify-start data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Megaphone className="w-4 h-4 mr-3" />
                Marketing
              </TabsTrigger>
            </TabsList>

            {/* Main Content Area */}
            <div className="flex-1 overflow-auto p-6">

            {/* Dashboard Tab */}
            <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card data-testid="card-total-users">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-clients">
                  {clientStats?.totalClients || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  +{clientStats?.newClientsToday || 0} new today
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-active-users">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-active-clients">
                  {clientStats?.activeClients || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Last 7 days
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-total-logins">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Logins</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-logins">
                  {clientStats?.totalLogins || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  All time
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-avg-session">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Session</CardTitle>
                <Settings className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-avg-session">
                  {clientStats?.avgSessionTime || 0}m
                </div>
                <p className="text-xs text-muted-foreground">
                  Average duration
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card data-testid="card-activity-metrics">
              <CardHeader>
                <CardTitle>Activity Metrics</CardTitle>
                <CardDescription>Last 24 hours</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Page Views</span>
                  <span className="font-bold" data-testid="text-page-views">
                    {activityMetrics?.pageViews || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>API Calls</span>
                  <span className="font-bold" data-testid="text-api-calls">
                    {activityMetrics?.apiCalls || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Portfolio Views</span>
                  <span className="font-bold" data-testid="text-portfolio-views">
                    {activityMetrics?.portfolioViews || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Trades</span>
                  <span className="font-bold" data-testid="text-trades">
                    {activityMetrics?.trades || 0}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-system-health">
              <CardHeader>
                <CardTitle>System Health</CardTitle>
                <CardDescription>Current status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Uptime</span>
                  <span className="font-bold" data-testid="text-uptime">
                    {dashboardInsights?.systemHealth?.uptime || "0h 0m"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Error Rate</span>
                  <span className="font-bold" data-testid="text-error-rate">
                    {dashboardInsights?.systemHealth?.errorRate || 0}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Response Time</span>
                  <span className="font-bold" data-testid="text-response-time">
                    {dashboardInsights?.systemHealth?.responseTime || 0}ms
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Status</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800" data-testid="badge-system-status">
                    Healthy
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Comprehensive User Management Tab */}
        <TabsContent value="comprehensive-users" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Total User Statistics */}
            <Card data-testid="card-user-overview">
              <CardHeader>
                <CardTitle>User Overview</CardTitle>
                <CardDescription>Platform-wide user statistics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Total Users</span>
                  <Badge className="bg-blue-100 text-blue-800" data-testid="badge-total-users">1,248</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Active Users</span>
                  <Badge className="bg-green-100 text-green-800" data-testid="badge-active-users">1,156</Badge>
                </div>
                <div className="flex justify-between">
                  <span>New Today</span>
                  <Badge className="bg-yellow-100 text-yellow-800" data-testid="badge-new-users-today">23</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Verified Users</span>
                  <Badge className="bg-purple-100 text-purple-800" data-testid="badge-verified-users">892</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Role Distribution */}
            <Card data-testid="card-role-distribution">
              <CardHeader>
                <CardTitle>User Roles</CardTitle>
                <CardDescription>Distribution by role</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span>Clients</span>
                  <Badge className="bg-blue-100 text-blue-800">1,024</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Partners</span>
                  <Badge className="bg-green-100 text-green-800">185</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Suppliers</span>
                  <Badge className="bg-yellow-100 text-yellow-800">32</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Agents</span>
                  <Badge className="bg-purple-100 text-purple-800">15</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Admins</span>
                  <Badge className="bg-red-100 text-red-800">3</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Activity Metrics */}
            <Card data-testid="card-activity-metrics">
              <CardHeader>
                <CardTitle>Activity Metrics</CardTitle>
                <CardDescription>User engagement data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span>Daily Active</span>
                  <Badge className="bg-green-100 text-green-800">458</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Weekly Active</span>
                  <Badge className="bg-blue-100 text-blue-800">823</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Monthly Active</span>
                  <Badge className="bg-purple-100 text-purple-800">1,156</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Avg Session</span>
                  <Badge className="bg-yellow-100 text-yellow-800">24m</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card data-testid="card-user-quick-actions">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>User management tools</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" data-testid="button-add-user">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add User
                </Button>
                <Button variant="outline" className="w-full" data-testid="button-bulk-operations">
                  <Users className="w-4 h-4 mr-2" />
                  Bulk Operations
                </Button>
                <Button variant="outline" className="w-full" data-testid="button-export-users">
                  <Download className="w-4 h-4 mr-2" />
                  Export Users
                </Button>
                <Button variant="outline" className="w-full" data-testid="button-user-analytics">
                  <BarChart className="w-4 h-4 mr-2" />
                  User Analytics
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Advanced Filters */}
          <Card data-testid="card-user-filters">
            <CardHeader>
              <CardTitle>Advanced Filters</CardTitle>
              <CardDescription>Filter and search all platform users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Search Users</label>
                  <Input placeholder="Name, email, or ID..." data-testid="input-user-search" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <Select data-testid="select-user-role">
                    <SelectTrigger>
                      <SelectValue placeholder="All roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="client">Clients</SelectItem>
                      <SelectItem value="partner">Partners</SelectItem>
                      <SelectItem value="supplier">Suppliers</SelectItem>
                      <SelectItem value="agent">Agents</SelectItem>
                      <SelectItem value="admin">Admins</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select data-testid="select-user-status">
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Registration Date</label>
                  <Select data-testid="select-registration-date">
                    <SelectTrigger>
                      <SelectValue placeholder="All time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                      <SelectItem value="quarter">This Quarter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button data-testid="button-apply-filters">Apply Filters</Button>
                <Button variant="outline" data-testid="button-clear-filters">Clear All</Button>
                <Button variant="outline" data-testid="button-save-filter">Save Filter</Button>
              </div>
            </CardContent>
          </Card>

          {/* Comprehensive User Management Table */}
          <Card data-testid="card-comprehensive-users-table">
            <CardHeader>
              <CardTitle>All Platform Users</CardTitle>
              <CardDescription>Comprehensive user management with advanced controls</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User Details</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Registration</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead>Portfolio Value</TableHead>
                    <TableHead>Risk Profile</TableHead>
                    <TableHead>KYC Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow data-testid="user-row-1">
                    <TableCell>
                      <div>
                        <div className="font-medium">Rajesh Kumar</div>
                        <div className="text-sm text-muted-foreground">rajesh.kumar@gmail.com</div>
                        <div className="text-xs text-muted-foreground">ID: USR001</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-blue-100 text-blue-800" data-testid="badge-role-1">Client</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800" data-testid="badge-status-1">Active</Badge>
                    </TableCell>
                    <TableCell data-testid="text-registration-1">Nov 15, 2024</TableCell>
                    <TableCell data-testid="text-last-activity-1">2h ago</TableCell>
                    <TableCell data-testid="text-portfolio-value-1">₹12,50,000</TableCell>
                    <TableCell>
                      <Badge className="bg-yellow-100 text-yellow-800" data-testid="badge-risk-1">Moderate</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800" data-testid="badge-kyc-1">Verified</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" data-testid="button-view-user-1">
                          View
                        </Button>
                        <Button variant="outline" size="sm" data-testid="button-edit-user-1">
                          Edit
                        </Button>
                        <Button variant="destructive" size="sm" data-testid="button-suspend-user-1">
                          Suspend
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>

                  <TableRow data-testid="user-row-2">
                    <TableCell>
                      <div>
                        <div className="font-medium">TechCorp Solutions</div>
                        <div className="text-sm text-muted-foreground">contact@techcorp.com</div>
                        <div className="text-xs text-muted-foreground">ID: PTR001</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800" data-testid="badge-role-2">Partner</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800" data-testid="badge-status-2">Active</Badge>
                    </TableCell>
                    <TableCell data-testid="text-registration-2">Oct 28, 2024</TableCell>
                    <TableCell data-testid="text-last-activity-2">1h ago</TableCell>
                    <TableCell data-testid="text-portfolio-value-2">N/A</TableCell>
                    <TableCell>
                      <Badge variant="outline" data-testid="badge-risk-2">N/A</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800" data-testid="badge-kyc-2">Verified</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" data-testid="button-view-user-2">
                          View
                        </Button>
                        <Button variant="outline" size="sm" data-testid="button-edit-user-2">
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" data-testid="button-manage-user-2">
                          Manage
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>

                  <TableRow data-testid="user-row-3">
                    <TableCell>
                      <div>
                        <div className="font-medium">Priya Sharma</div>
                        <div className="text-sm text-muted-foreground">priya.sharma@email.com</div>
                        <div className="text-xs text-muted-foreground">ID: USR123</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-blue-100 text-blue-800" data-testid="badge-role-3">Client</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-yellow-100 text-yellow-800" data-testid="badge-status-3">Pending</Badge>
                    </TableCell>
                    <TableCell data-testid="text-registration-3">Dec 1, 2024</TableCell>
                    <TableCell data-testid="text-last-activity-3">5h ago</TableCell>
                    <TableCell data-testid="text-portfolio-value-3">₹0</TableCell>
                    <TableCell>
                      <Badge variant="outline" data-testid="badge-risk-3">Not Set</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-yellow-100 text-yellow-800" data-testid="badge-kyc-3">Pending</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" data-testid="button-view-user-3">
                          View
                        </Button>
                        <Button size="sm" data-testid="button-approve-user-3">
                          Approve
                        </Button>
                        <Button variant="destructive" size="sm" data-testid="button-reject-user-3">
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>

                  <TableRow data-testid="user-row-4">
                    <TableCell>
                      <div>
                        <div className="font-medium">DataFlow Suppliers</div>
                        <div className="text-sm text-muted-foreground">admin@dataflow.in</div>
                        <div className="text-xs text-muted-foreground">ID: SUP005</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-purple-100 text-purple-800" data-testid="badge-role-4">Supplier</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800" data-testid="badge-status-4">Active</Badge>
                    </TableCell>
                    <TableCell data-testid="text-registration-4">Sep 12, 2024</TableCell>
                    <TableCell data-testid="text-last-activity-4">3d ago</TableCell>
                    <TableCell data-testid="text-portfolio-value-4">N/A</TableCell>
                    <TableCell>
                      <Badge variant="outline" data-testid="badge-risk-4">N/A</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800" data-testid="badge-kyc-4">Verified</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" data-testid="button-view-user-4">
                          View
                        </Button>
                        <Button variant="outline" size="sm" data-testid="button-edit-user-4">
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" data-testid="button-contract-user-4">
                          Contract
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>

                  <TableRow data-testid="user-row-5">
                    <TableCell>
                      <div>
                        <div className="font-medium">Sarah Johnson</div>
                        <div className="text-sm text-muted-foreground">sarah.j@fintekpro.com</div>
                        <div className="text-xs text-muted-foreground">ID: AGT001</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-orange-100 text-orange-800" data-testid="badge-role-5">Agent</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800" data-testid="badge-status-5">Active</Badge>
                    </TableCell>
                    <TableCell data-testid="text-registration-5">Aug 5, 2024</TableCell>
                    <TableCell data-testid="text-last-activity-5">30m ago</TableCell>
                    <TableCell data-testid="text-portfolio-value-5">N/A</TableCell>
                    <TableCell>
                      <Badge variant="outline" data-testid="badge-risk-5">N/A</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800" data-testid="badge-kyc-5">Verified</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" data-testid="button-view-user-5">
                          View
                        </Button>
                        <Button variant="outline" size="sm" data-testid="button-edit-user-5">
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" data-testid="button-schedule-user-5">
                          Schedule
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="clients" className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-clients"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40" data-testid="select-role-filter">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="user">Client</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40" data-testid="select-status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
            </div>
            
            {/* Add Client Button */}
            <Dialog open={createClientDialog} onOpenChange={setCreateClientDialog}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700" data-testid="button-add-client">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Client
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>

          <Card data-testid="card-users-table">
            <CardHeader>
              <CardTitle>Clients Management</CardTitle>
              <CardDescription>
                Manage client roles and status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {clientsLoading ? (
                <div className="flex justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientsData?.users?.map((client: Client) => (
                      <TableRow key={client.id} data-testid={`row-client-${client.id}`}>
                        <TableCell>
                          <div>
                            <div className="font-medium" data-testid={`text-clientname-${client.id}`}>
                              {client.firstName} {client.lastName}
                            </div>
                            <div className="text-sm text-muted-foreground" data-testid={`text-email-${client.id}`}>
                              {client.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={client.role}
                            onValueChange={(role) => updateRoleMutation.mutate({ clientId: client.id, role })}
                            data-testid={`select-role-${client.id}`}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">Client</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="super_admin">Super Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Badge variant={client.isActive ? "secondary" : "destructive"} data-testid={`badge-status-${client.id}`}>
                            {client.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell data-testid={`text-last-login-${client.id}`}>
                          {client.lastLoginAt 
                            ? format(new Date(client.lastLoginAt), "MMM d, yyyy")
                            : "Never"
                          }
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={client.isActive ? "destructive" : "secondary"}
                              onClick={() => updateStatusMutation.mutate({ 
                                clientId: client.id, 
                                isActive: !client.isActive 
                              })}
                              data-testid={`button-toggle-status-${client.id}`}
                            >
                              {client.isActive ? "Deactivate" : "Activate"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedClient(client);
                                setClientForm({
                                  firstName: client.firstName,
                                  lastName: client.lastName,
                                  email: client.email,
                                  mobile: client.mobile,
                                  role: client.role,
                                  isActive: client.isActive
                                });
                                setEditClientDialog(true);
                              }}
                              data-testid={`button-edit-client-${client.id}`}
                            >
                              <Edit3 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedClient(client);
                                setGuidanceDialog(true);
                              }}
                              data-testid={`button-send-guidance-${client.id}`}
                            >
                              <MessageSquare className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setClientToDelete(client);
                                setDeleteClientDialog(true);
                              }}
                              data-testid={`button-delete-client-${client.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <Card data-testid="card-recent-activities">
            <CardHeader>
              <CardTitle>Recent Activities</CardTitle>
              <CardDescription>Live activity feed from all users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {((activities as any) || []).slice(0, 20).map((activity: ClientActivity, index: number) => (
                  <div key={activity.id || index} className="flex items-start gap-3 p-3 border rounded-lg" data-testid={`activity-${index}`}>
                    <Activity className="w-4 h-4 mt-1 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium" data-testid={`text-activity-action-${index}`}>
                          {activity.action?.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        {activity.resource && (
                          <Badge variant="outline" data-testid={`badge-activity-resource-${index}`}>
                            {activity.resource}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground" data-testid={`text-activity-details-${index}`}>
                        User: {activity.userId} • {format(new Date(activity.createdAt), "MMM d, HH:mm")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CKYC Management Tab */}
        <TabsContent value="ckyc" className="space-y-6">
          <CkycManagement />
        </TabsContent>

        {/* API Status Tab */}
        <TabsContent value="api-status" className="space-y-6">
          <ApiStatusPanel />
        </TabsContent>

        {/* AI Error Monitoring Tab */}
        <TabsContent value="error-monitoring" className="space-y-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Brain className="w-6 h-6 text-purple-600" />
                  Gemini AI Error Monitor
                </h2>
                <p className="text-gray-600">AI-powered system analysis and automated optimization</p>
              </div>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="w-5 h-5" />
                  System Health Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">✓</div>
                    <div className="text-sm text-green-700">APIs Running</div>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">AI</div>
                    <div className="text-sm text-blue-700">Monitoring Active</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">0</div>
                    <div className="text-sm text-purple-700">Critical Errors</div>
                  </div>
                </div>
                
                <div className="mt-6">
                  <h4 className="font-medium mb-3">Available Endpoints</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="font-mono text-sm">/api/system/health</span>
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="font-mono text-sm">/api/system/errors/analysis</span>
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="font-mono text-sm">/api/replit-agent/instructions</span>
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="font-mono text-sm">/api/system/auto-heal</span>
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Gemini AI Integration Status</h4>
                  <p className="text-blue-700 text-sm">✅ Error monitoring system is active and functional</p>
                  <p className="text-blue-700 text-sm">✅ AI-powered analysis endpoints are operational</p>
                  <p className="text-blue-700 text-sm">✅ Replit Agent instructions system ready</p>
                  <p className="text-blue-700 text-sm">✅ Auto-healing recommendations available</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card data-testid="card-user-engagement">
              <CardHeader>
                <CardTitle>User Engagement</CardTitle>
                <CardDescription>Active users breakdown</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Daily Active</span>
                  <span className="font-bold" data-testid="text-daily-active">
                    {(insights as any)?.userEngagement?.dailyActiveUsers || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Weekly Active</span>
                  <span className="font-bold" data-testid="text-weekly-active">
                    {(insights as any)?.userEngagement?.weeklyActiveUsers || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Monthly Active</span>
                  <span className="font-bold" data-testid="text-monthly-active">
                    {(insights as any)?.userEngagement?.monthlyActiveUsers || 0}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-popular-features">
              <CardHeader>
                <CardTitle>Popular Features</CardTitle>
                <CardDescription>Most used features</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {((insights as any)?.popularFeatures || []).slice(0, 5).map((feature: any, index: number) => (
                  <div key={index} className="flex justify-between" data-testid={`popular-feature-${index}`}>
                    <span className="text-sm">{feature.feature}</span>
                    <span className="font-bold">{feature.usage}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card data-testid="card-user-growth">
              <CardHeader>
                <CardTitle>User Growth</CardTitle>
                <CardDescription>Last 7 days</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {((insights as any)?.userGrowth || []).slice(-7).map((growth: any, index: number) => (
                  <div key={index} className="flex justify-between" data-testid={`user-growth-${index}`}>
                    <span className="text-sm">{format(new Date(growth.date), "MMM d")}</span>
                    <span className="font-bold">+{growth.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Guidance Tab */}
        <TabsContent value="guidance" className="space-y-6">
          <Card data-testid="card-guidance-tools">
            <CardHeader>
              <CardTitle>User Guidance Tools</CardTitle>
              <CardDescription>
                Send personalized guidance and notifications to users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Select a user from the Users tab to send personalized guidance messages.
                Messages can include tips, alerts, or actionable recommendations.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Risk Profiling Tab */}
        <TabsContent value="risk-profiling" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Risk Profile Viewer */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Customer Risk Profiles
                  </CardTitle>
                  <CardDescription>
                    View and manage customer investment risk assessments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RiskProfileViewer />
                </CardContent>
              </Card>
            </div>

            {/* Risk Assessment Form */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    New Risk Assessment
                  </CardTitle>
                  <CardDescription>
                    Conduct risk assessment for new or existing customers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RiskAssessmentForm />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-6">
          <Tabs defaultValue="capital-gains" className="w-full">
            <TabsList>
              <TabsTrigger value="capital-gains">Capital Gains Reports</TabsTrigger>
              <TabsTrigger value="transaction-reports">Transaction Reports</TabsTrigger>
            </TabsList>
            
            <TabsContent value="capital-gains">
              <CapitalGainsReportViewer />
            </TabsContent>
            
            <TabsContent value="transaction-reports">
              <TransactionReportViewer />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Partners Tab */}
        <TabsContent value="partners" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Partner Statistics */}
            <Card data-testid="card-partner-stats">
              <CardHeader>
                <CardTitle>Partner Overview</CardTitle>
                <CardDescription>Vendor partner statistics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Total Partners</span>
                  <Badge className="bg-blue-100 text-blue-800" data-testid="badge-total-partners">125</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Active Partners</span>
                  <Badge className="bg-green-100 text-green-800" data-testid="badge-active-partners">98</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Pending Approval</span>
                  <Badge className="bg-yellow-100 text-yellow-800" data-testid="badge-pending-partners">12</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Suspended</span>
                  <Badge className="bg-red-100 text-red-800" data-testid="badge-suspended-partners">15</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Partner Actions */}
            <Card data-testid="card-partner-actions">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Manage partner operations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" data-testid="button-invite-partner">
                  <Building2 className="w-4 h-4 mr-2" />
                  Invite New Partner
                </Button>
                <Button variant="outline" className="w-full" data-testid="button-bulk-approve">
                  <Shield className="w-4 h-4 mr-2" />
                  Bulk Approve
                </Button>
                <Button variant="outline" className="w-full" data-testid="button-export-partners">
                  <FileText className="w-4 h-4 mr-2" />
                  Export Partner List
                </Button>
              </CardContent>
            </Card>

            {/* Recent Partner Activity */}
            <Card data-testid="card-partner-activity">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest partner actions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-2 border rounded" data-testid="partner-activity-0">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">TechCorp Solutions</div>
                      <div className="text-xs text-muted-foreground">Status changed to Active</div>
                    </div>
                    <div className="text-xs text-muted-foreground">2 hours ago</div>
                  </div>
                  <div className="flex items-center gap-3 p-2 border rounded" data-testid="partner-activity-1">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">FinServe Partners</div>
                      <div className="text-xs text-muted-foreground">Submitted application</div>
                    </div>
                    <div className="text-xs text-muted-foreground">1 day ago</div>
                  </div>
                  <div className="flex items-center gap-3 p-2 border rounded" data-testid="partner-activity-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">Global Investments</div>
                      <div className="text-xs text-muted-foreground">Updated profile</div>
                    </div>
                    <div className="text-xs text-muted-foreground">3 days ago</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Partner Management Table */}
          <Card data-testid="card-partner-management">
            <CardHeader>
              <CardTitle>Partner Management</CardTitle>
              <CardDescription>Manage all vendor partners</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search and Filters */}
              <div className="flex gap-4 mb-6">
                <div className="flex-1">
                  <Input
                    placeholder="Search partners..."
                    className="w-full"
                    data-testid="input-search-partners"
                  />
                </div>
                <Select defaultValue="all">
                  <SelectTrigger className="w-48" data-testid="select-partner-status">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Partners</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending Approval</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <Select defaultValue="all">
                  <SelectTrigger className="w-48" data-testid="select-partner-type">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="broker">Broker</SelectItem>
                    <SelectItem value="advisor">Financial Advisor</SelectItem>
                    <SelectItem value="fintech">FinTech</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Partners Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined Date</TableHead>
                    <TableHead>Revenue Share</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow data-testid="partner-row-1">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          TC
                        </div>
                        <div>
                          <div className="font-medium" data-testid="text-partner-name-1">TechCorp Solutions</div>
                          <div className="text-sm text-muted-foreground">contact@techcorp.com</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" data-testid="badge-partner-type-1">FinTech</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800" data-testid="badge-partner-status-1">Active</Badge>
                    </TableCell>
                    <TableCell data-testid="text-partner-joined-1">Dec 15, 2024</TableCell>
                    <TableCell data-testid="text-partner-revenue-1">15%</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" data-testid="button-view-partner-1">
                          View
                        </Button>
                        <Button variant="outline" size="sm" data-testid="button-edit-partner-1">
                          Edit
                        </Button>
                        <Button variant="destructive" size="sm" data-testid="button-suspend-partner-1">
                          Suspend
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow data-testid="partner-row-2">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          FS
                        </div>
                        <div>
                          <div className="font-medium" data-testid="text-partner-name-2">FinServe Partners</div>
                          <div className="text-sm text-muted-foreground">admin@finserve.com</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" data-testid="badge-partner-type-2">Advisor</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-yellow-100 text-yellow-800" data-testid="badge-partner-status-2">Pending</Badge>
                    </TableCell>
                    <TableCell data-testid="text-partner-joined-2">Jan 8, 2025</TableCell>
                    <TableCell data-testid="text-partner-revenue-2">12%</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" data-testid="button-view-partner-2">
                          View
                        </Button>
                        <Button size="sm" data-testid="button-approve-partner-2">
                          Approve
                        </Button>
                        <Button variant="destructive" size="sm" data-testid="button-reject-partner-2">
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow data-testid="partner-row-3">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          GI
                        </div>
                        <div>
                          <div className="font-medium" data-testid="text-partner-name-3">Global Investments</div>
                          <div className="text-sm text-muted-foreground">info@globalinvest.com</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" data-testid="badge-partner-type-3">Broker</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800" data-testid="badge-partner-status-3">Active</Badge>
                    </TableCell>
                    <TableCell data-testid="text-partner-joined-3">Nov 22, 2024</TableCell>
                    <TableCell data-testid="text-partner-revenue-3">18%</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" data-testid="button-view-partner-3">
                          View
                        </Button>
                        <Button variant="outline" size="sm" data-testid="button-edit-partner-3">
                          Edit
                        </Button>
                        <Button variant="destructive" size="sm" data-testid="button-suspend-partner-3">
                          Suspend
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow data-testid="partner-row-4">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          WM
                        </div>
                        <div>
                          <div className="font-medium" data-testid="text-partner-name-4">Wealth Management Co</div>
                          <div className="text-sm text-muted-foreground">contact@wealthmgmt.com</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" data-testid="badge-partner-type-4">Bank</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-red-100 text-red-800" data-testid="badge-partner-status-4">Suspended</Badge>
                    </TableCell>
                    <TableCell data-testid="text-partner-joined-4">Oct 5, 2024</TableCell>
                    <TableCell data-testid="text-partner-revenue-4">20%</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" data-testid="button-view-partner-4">
                          View
                        </Button>
                        <Button size="sm" data-testid="button-reactivate-partner-4">
                          Reactivate
                        </Button>
                        <Button variant="destructive" size="sm" data-testid="button-terminate-partner-4">
                          Terminate
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Customer Care Agents Tab */}
        <TabsContent value="agents" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Agent Statistics */}
            <Card data-testid="card-agent-stats">
              <CardHeader>
                <CardTitle>Agent Overview</CardTitle>
                <CardDescription>Customer care agent statistics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Total Agents</span>
                  <Badge className="bg-blue-100 text-blue-800" data-testid="badge-total-agents">15</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Active Agents</span>
                  <Badge className="bg-green-100 text-green-800" data-testid="badge-active-agents">12</Badge>
                </div>
                <div className="flex justify-between">
                  <span>On Leave</span>
                  <Badge className="bg-yellow-100 text-yellow-800" data-testid="badge-leave-agents">3</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Avg Resolution Time</span>
                  <Badge className="bg-purple-100 text-purple-800" data-testid="badge-avg-resolution">2.5h</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card data-testid="card-agent-actions">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Manage agents efficiently</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" data-testid="button-add-agent">
                  <Users className="w-4 h-4 mr-2" />
                  Add New Agent
                </Button>
                <Button variant="outline" className="w-full" data-testid="button-bulk-assign">
                  <Building2 className="w-4 h-4 mr-2" />
                  Bulk Partner Assignment
                </Button>
                <Button variant="outline" className="w-full" data-testid="button-performance-report">
                  <FileText className="w-4 h-4 mr-2" />
                  Performance Report
                </Button>
              </CardContent>
            </Card>

            {/* Recent Performance */}
            <Card data-testid="card-agent-performance">
              <CardHeader>
                <CardTitle>Top Performers</CardTitle>
                <CardDescription>This month's best agents</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">Sarah Johnson</div>
                    <div className="text-sm text-muted-foreground">125 tickets resolved</div>
                  </div>
                  <Badge className="bg-green-100 text-green-800">4.8★</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">Mike Chen</div>
                    <div className="text-sm text-muted-foreground">98 tickets resolved</div>
                  </div>
                  <Badge className="bg-green-100 text-green-800">4.7★</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">Lisa Rodriguez</div>
                    <div className="text-sm text-muted-foreground">87 tickets resolved</div>
                  </div>
                  <Badge className="bg-green-100 text-green-800">4.6★</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Agents Management Table */}
          <Card data-testid="card-agents-table">
            <CardHeader>
              <CardTitle>Customer Care Agents</CardTitle>
              <CardDescription>Manage support agents and their partner assignments</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Partners Assigned</TableHead>
                    <TableHead>Current Tickets</TableHead>
                    <TableHead>Specializations</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow data-testid="agent-row-1">
                    <TableCell>
                      <div>
                        <div className="font-medium">Sarah Johnson</div>
                        <div className="text-sm text-muted-foreground">sarah.johnson@fintekpro.com</div>
                        <div className="text-xs text-muted-foreground">+1 (555) 0123</div>
                      </div>
                    </TableCell>
                    <TableCell data-testid="text-employee-id-1">EMP001</TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800" data-testid="badge-status-1">Active</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant="outline">TechCorp Solutions</Badge>
                        <Badge variant="outline">InvestPro Partners</Badge>
                        <Badge variant="outline">WealthMax Inc</Badge>
                      </div>
                    </TableCell>
                    <TableCell data-testid="text-tickets-1">8/50</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge className="bg-blue-100 text-blue-800">Technical</Badge>
                        <Badge className="bg-purple-100 text-purple-800">Billing</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>Rating: <span className="font-medium">4.8★</span></div>
                        <div>Avg. Resolution: <span className="font-medium">2.1h</span></div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" data-testid="button-manage-partners-1">
                          Manage Partners
                        </Button>
                        <Button variant="outline" size="sm" data-testid="button-view-performance-1">
                          Performance
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow data-testid="agent-row-2">
                    <TableCell>
                      <div>
                        <div className="font-medium">Mike Chen</div>
                        <div className="text-sm text-muted-foreground">mike.chen@fintekpro.com</div>
                        <div className="text-xs text-muted-foreground">+1 (555) 0124</div>
                      </div>
                    </TableCell>
                    <TableCell data-testid="text-employee-id-2">EMP002</TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800" data-testid="badge-status-2">Active</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant="outline">FinanceFirst LLC</Badge>
                        <Badge variant="outline">Capital Advisors</Badge>
                      </div>
                    </TableCell>
                    <TableCell data-testid="text-tickets-2">12/50</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge className="bg-green-100 text-green-800">Product Inquiry</Badge>
                        <Badge className="bg-orange-100 text-orange-800">Complaints</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>Rating: <span className="font-medium">4.7★</span></div>
                        <div>Avg. Resolution: <span className="font-medium">2.8h</span></div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" data-testid="button-manage-partners-2">
                          Manage Partners
                        </Button>
                        <Button variant="outline" size="sm" data-testid="button-view-performance-2">
                          Performance
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow data-testid="agent-row-3">
                    <TableCell>
                      <div>
                        <div className="font-medium">Lisa Rodriguez</div>
                        <div className="text-sm text-muted-foreground">lisa.rodriguez@fintekpro.com</div>
                        <div className="text-xs text-muted-foreground">+1 (555) 0125</div>
                      </div>
                    </TableCell>
                    <TableCell data-testid="text-employee-id-3">EMP003</TableCell>
                    <TableCell>
                      <Badge className="bg-yellow-100 text-yellow-800" data-testid="badge-status-3">On Leave</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant="outline">SmartInvest Group</Badge>
                        <Badge variant="outline">GlobalFunds Co</Badge>
                        <Badge variant="outline">RetireEasy Partners</Badge>
                      </div>
                    </TableCell>
                    <TableCell data-testid="text-tickets-3">0/50</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge className="bg-red-100 text-red-800">Technical</Badge>
                        <Badge className="bg-blue-100 text-blue-800">Product Inquiry</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>Rating: <span className="font-medium">4.6★</span></div>
                        <div>Avg. Resolution: <span className="font-medium">3.2h</span></div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" disabled data-testid="button-manage-partners-3">
                          Manage Partners
                        </Button>
                        <Button variant="outline" size="sm" data-testid="button-view-performance-3">
                          Performance
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Marketing Tools Tab */}
        <TabsContent value="marketing" className="space-y-6">
          <MarketingToolsPanel />
        </TabsContent>



      {/* Guidance Dialog */}
      <Dialog open={guidanceDialog} onOpenChange={setGuidanceDialog}>
        <DialogContent data-testid="dialog-send-guidance">
          <DialogHeader>
            <DialogTitle>Send Guidance</DialogTitle>
            <DialogDescription>
              Send personalized guidance to {selectedClient?.firstName} {selectedClient?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={guidanceForm.title}
                onChange={(e) => setGuidanceForm({ ...guidanceForm, title: e.target.value })}
                placeholder="Enter guidance title"
                data-testid="input-guidance-title"
              />
            </div>
            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={guidanceForm.message}
                onChange={(e) => setGuidanceForm({ ...guidanceForm, message: e.target.value })}
                placeholder="Enter your guidance message"
                rows={4}
                data-testid="textarea-guidance-message"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="type">Type</Label>
                <Select
                  value={guidanceForm.type}
                  onValueChange={(value) => setGuidanceForm({ ...guidanceForm, type: value })}
                >
                  <SelectTrigger data-testid="select-guidance-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="guidance">Guidance</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="alert">Alert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={guidanceForm.priority}
                  onValueChange={(value) => setGuidanceForm({ ...guidanceForm, priority: value })}
                >
                  <SelectTrigger data-testid="select-guidance-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="actionUrl">Action URL (Optional)</Label>
              <Input
                id="actionUrl"
                value={guidanceForm.actionUrl}
                onChange={(e) => setGuidanceForm({ ...guidanceForm, actionUrl: e.target.value })}
                placeholder="https://example.com/action"
                data-testid="input-guidance-url"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGuidanceDialog(false)} data-testid="button-cancel-guidance">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedClient && guidanceForm.title && guidanceForm.message) {
                  sendGuidanceMutation.mutate({
                    clientId: selectedClient.id,
                    guidance: guidanceForm
                  });
                }
              }}
              disabled={!guidanceForm.title || !guidanceForm.message || sendGuidanceMutation.isPending}
              data-testid="button-send-guidance"
            >
              {sendGuidanceMutation.isPending ? "Sending..." : "Send Guidance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Client Dialog */}
      <Dialog open={createClientDialog} onOpenChange={setCreateClientDialog}>
        <DialogContent data-testid="dialog-create-client">
        <DialogHeader>
          <DialogTitle>Add New Client</DialogTitle>
          <DialogDescription>
            Create a new client account with basic information
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={clientForm.firstName}
                onChange={(e) => setClientForm({ ...clientForm, firstName: e.target.value })}
                placeholder="John"
                data-testid="input-first-name"
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={clientForm.lastName}
                onChange={(e) => setClientForm({ ...clientForm, lastName: e.target.value })}
                placeholder="Doe"
                data-testid="input-last-name"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={clientForm.email}
              onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
              placeholder="john.doe@example.com"
              data-testid="input-email"
            />
          </div>
          <div>
            <Label htmlFor="mobile">Mobile Number</Label>
            <Input
              id="mobile"
              value={clientForm.mobile}
              onChange={(e) => setClientForm({ ...clientForm, mobile: e.target.value })}
              placeholder="+1 (555) 123-4567"
              data-testid="input-mobile"
            />
          </div>
          <div>
            <Label htmlFor="role">Role</Label>
            <Select value={clientForm.role} onValueChange={(value) => setClientForm({ ...clientForm, role: value })}>
              <SelectTrigger data-testid="select-role">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Client</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isActive"
              checked={clientForm.isActive}
              onChange={(e) => setClientForm({ ...clientForm, isActive: e.target.checked })}
              data-testid="checkbox-active"
            />
            <Label htmlFor="isActive">Active Account</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCreateClientDialog(false)} data-testid="button-cancel-create">
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (clientForm.firstName && clientForm.lastName && clientForm.email) {
                createClientMutation.mutate(clientForm);
              }
            }}
            disabled={!clientForm.firstName || !clientForm.lastName || !clientForm.email || createClientMutation.isPending}
            data-testid="button-create-client"
          >
            {createClientMutation.isPending ? "Creating..." : "Create Client"}
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Client Dialog */}
      <Dialog open={editClientDialog} onOpenChange={setEditClientDialog}>
        <DialogContent data-testid="dialog-edit-client">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>
              Update client information for {selectedClient?.firstName} {selectedClient?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editFirstName">First Name</Label>
                <Input
                  id="editFirstName"
                  value={clientForm.firstName}
                  onChange={(e) => setClientForm({ ...clientForm, firstName: e.target.value })}
                  placeholder="John"
                  data-testid="input-edit-first-name"
                />
              </div>
              <div>
                <Label htmlFor="editLastName">Last Name</Label>
                <Input
                  id="editLastName"
                  value={clientForm.lastName}
                  onChange={(e) => setClientForm({ ...clientForm, lastName: e.target.value })}
                  placeholder="Doe"
                  data-testid="input-edit-last-name"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="editEmail">Email</Label>
              <Input
                id="editEmail"
                type="email"
                value={clientForm.email}
                onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                placeholder="john.doe@example.com"
                data-testid="input-edit-email"
              />
            </div>
            <div>
              <Label htmlFor="editMobile">Mobile Number</Label>
              <Input
                id="editMobile"
                value={clientForm.mobile}
                onChange={(e) => setClientForm({ ...clientForm, mobile: e.target.value })}
                placeholder="+1 (555) 123-4567"
                data-testid="input-edit-mobile"
              />
            </div>
            <div>
              <Label htmlFor="editRole">Role</Label>
              <Select value={clientForm.role} onValueChange={(value) => setClientForm({ ...clientForm, role: value })}>
                <SelectTrigger data-testid="select-edit-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Client</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="editIsActive"
                checked={clientForm.isActive}
                onChange={(e) => setClientForm({ ...clientForm, isActive: e.target.checked })}
                data-testid="checkbox-edit-active"
              />
              <Label htmlFor="editIsActive">Active Account</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditClientDialog(false)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedClient && clientForm.firstName && clientForm.lastName && clientForm.email) {
                  updateClientMutation.mutate({
                    clientId: selectedClient.id,
                    clientData: clientForm
                  });
                }
              }}
              disabled={!clientForm.firstName || !clientForm.lastName || !clientForm.email || updateClientMutation.isPending}
              data-testid="button-update-client"
            >
              {updateClientMutation.isPending ? "Updating..." : "Update Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Client Dialog */}
      <Dialog open={deleteClientDialog} onOpenChange={setDeleteClientDialog}>
        <DialogContent data-testid="dialog-delete-client">
          <DialogHeader>
            <DialogTitle>Delete Client</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {clientToDelete?.firstName} {clientToDelete?.lastName}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
              <span className="text-sm font-medium text-red-800">Warning: This will permanently delete the client account</span>
            </div>
            <div className="mt-2 text-sm text-red-700">
              • All client data will be permanently removed
              • Portfolio and transaction history will be lost
              • This action cannot be undone
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteClientDialog(false)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (clientToDelete) {
                  deleteClientMutation.mutate(clientToDelete.id);
                }
              }}
              disabled={deleteClientMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteClientMutation.isPending ? "Deleting..." : "Delete Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
            </div>
        </Tabs>
        </div>
      </div>
    </div>
  );
}
