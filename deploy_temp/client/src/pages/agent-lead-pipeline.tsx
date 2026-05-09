import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Plus,
  Search,
  Phone,
  Mail,
  Calendar,
  User,
  IndianRupee,
  Target,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
  MoreHorizontal,
  MessageSquare,
  Edit,
  Trash2,
  Filter,
  ChevronRight,
  Loader2,
  AlertCircle,
  Star,
  Zap
} from "lucide-react";

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  stage: 'new' | 'contacted' | 'proposal_sent' | 'negotiating' | 'converted' | 'lost';
  source: string;
  potentialValue: number;
  score: number;
  notes: string;
  lastContact?: string;
  nextFollowUp?: string;
  createdAt: string;
  tags: string[];
}

interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  proposalSent: number;
  negotiating: number;
  converted: number;
  lost: number;
  conversionRate: number;
  avgDealValue: number;
  pipelineValue: number;
}

const STAGE_CONFIG = {
  new: { label: 'New Leads', color: 'bg-blue-500', textColor: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30' },
  contacted: { label: 'Contacted', color: 'bg-amber-500', textColor: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30' },
  proposal_sent: { label: 'Proposal Sent', color: 'bg-purple-500', textColor: 'text-purple-400', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/30' },
  negotiating: { label: 'Negotiating', color: 'bg-orange-500', textColor: 'text-orange-400', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/30' },
  converted: { label: 'Converted', color: 'bg-emerald-500', textColor: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30' },
  lost: { label: 'Lost', color: 'bg-red-500', textColor: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/30' }
};

const STAGES: (keyof typeof STAGE_CONFIG)[] = ['new', 'contacted', 'proposal_sent', 'negotiating', 'converted', 'lost'];

export default function AgentLeadPipeline() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddLead, setShowAddLead] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);

  const [newLead, setNewLead] = useState({
    name: '',
    email: '',
    phone: '',
    source: 'referral',
    potentialValue: '',
    notes: ''
  });

  const { data: leads, isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: ['/api/agent/leads']
  });

  const { data: stats } = useQuery<LeadStats>({
    queryKey: ['/api/agent/leads/stats']
  });

  const createLeadMutation = useMutation({
    mutationFn: (data: typeof newLead) => apiRequest('/api/agent/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agent/leads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/agent/leads/stats'] });
      setShowAddLead(false);
      setNewLead({ name: '', email: '', phone: '', source: 'referral', potentialValue: '', notes: '' });
      toast({ title: "Lead added successfully" });
    }
  });

  const updateLeadStageMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => 
      apiRequest(`/api/agent/leads/${id}/stage`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agent/leads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/agent/leads/stats'] });
      toast({ title: "Lead stage updated" });
    }
  });

  if (leadsLoading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        <span className="ml-2 text-muted-foreground">Loading lead pipeline...</span>
      </div>
    );
  }

  const displayLeads = leads || [];
  const displayStats: LeadStats = stats || {
    total: 0,
    new: 0,
    contacted: 0,
    proposalSent: 0,
    negotiating: 0,
    converted: 0,
    lost: 0,
    conversionRate: 0,
    avgDealValue: 0,
    pipelineValue: 0
  };

  const filteredLeads = displayLeads.filter(lead =>
    (lead.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (lead.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (lead.phone || '').includes(searchQuery)
  );

  const getLeadsByStage = (stage: string) => 
    filteredLeads.filter(lead => lead.stage === stage);

  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    return `₹${(value / 1000).toFixed(0)}K`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400 bg-emerald-500/20';
    if (score >= 60) return 'text-amber-400 bg-amber-500/20';
    return 'text-red-400 bg-red-500/20';
  };

  const handleDragStart = (lead: Lead) => {
    setDraggedLead(lead);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (stage: keyof typeof STAGE_CONFIG) => {
    if (draggedLead && draggedLead.stage !== stage) {
      updateLeadStageMutation.mutate({ id: draggedLead.id, stage });
    }
    setDraggedLead(null);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-full mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Target className="h-7 w-7 text-emerald-500" />
              Lead Pipeline
            </h1>
            <p className="text-muted-foreground mt-1">Track and convert prospects into clients</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64 bg-card border-border text-foreground"
                data-testid="input-search-leads"
              />
            </div>
            <Dialog open={showAddLead} onOpenChange={setShowAddLead}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="button-add-lead">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Lead
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-background border-border text-foreground max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Lead</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Enter prospect details to add to your pipeline
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="name" className="text-muted-foreground">Name *</Label>
                    <Input
                      id="name"
                      value={newLead.name}
                      onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                      className="mt-1 bg-card border-border"
                      placeholder="Full name"
                      data-testid="input-lead-name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email" className="text-muted-foreground">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newLead.email}
                        onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                        className="mt-1 bg-card border-border"
                        placeholder="email@example.com"
                        data-testid="input-lead-email"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone" className="text-muted-foreground">Phone</Label>
                      <Input
                        id="phone"
                        value={newLead.phone}
                        onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                        className="mt-1 bg-card border-border"
                        placeholder="9876543210"
                        data-testid="input-lead-phone"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="source" className="text-muted-foreground">Source</Label>
                      <Select value={newLead.source} onValueChange={(value) => setNewLead({ ...newLead, source: value })}>
                        <SelectTrigger className="mt-1 bg-card border-border" data-testid="select-lead-source">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          <SelectItem value="referral">Referral</SelectItem>
                          <SelectItem value="website">Website</SelectItem>
                          <SelectItem value="linkedin">LinkedIn</SelectItem>
                          <SelectItem value="event">Event</SelectItem>
                          <SelectItem value="webinar">Webinar</SelectItem>
                          <SelectItem value="cold_call">Cold Call</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="value" className="text-muted-foreground">Potential Value (₹)</Label>
                      <Input
                        id="value"
                        type="number"
                        value={newLead.potentialValue}
                        onChange={(e) => setNewLead({ ...newLead, potentialValue: e.target.value })}
                        className="mt-1 bg-card border-border"
                        placeholder="1000000"
                        data-testid="input-lead-value"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="notes" className="text-muted-foreground">Notes</Label>
                    <Textarea
                      id="notes"
                      value={newLead.notes}
                      onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                      className="mt-1 bg-card border-border"
                      placeholder="Initial observations, interests, requirements..."
                      rows={3}
                      data-testid="textarea-lead-notes"
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <Button variant="outline" onClick={() => setShowAddLead(false)} className="border-border">
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => createLeadMutation.mutate(newLead)}
                      disabled={!newLead.name || createLeadMutation.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700"
                      data-testid="button-save-lead"
                    >
                      {createLeadMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Add Lead
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-card/50 border-border">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-muted-foreground text-sm">Pipeline Value</p>
                  <p className="text-xl font-bold text-foreground mt-1" data-testid="text-pipeline-value">
                    {formatCurrency(displayStats.pipelineValue)}
                  </p>
                </div>
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <IndianRupee className="h-5 w-5 text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-muted-foreground text-sm">Total Leads</p>
                  <p className="text-xl font-bold text-foreground mt-1" data-testid="text-total-leads">
                    {displayStats.total}
                  </p>
                </div>
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <User className="h-5 w-5 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-muted-foreground text-sm">Conversion Rate</p>
                  <p className="text-xl font-bold text-foreground mt-1" data-testid="text-conversion-rate">
                    {displayStats.conversionRate.toFixed(1)}%
                  </p>
                </div>
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-muted-foreground text-sm">Avg Deal Size</p>
                  <p className="text-xl font-bold text-foreground mt-1">
                    {formatCurrency(displayStats.avgDealValue)}
                  </p>
                </div>
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <Target className="h-5 w-5 text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-muted-foreground text-sm">Hot Leads</p>
                  <p className="text-xl font-bold text-foreground mt-1">
                    {displayLeads.filter(l => l.score >= 80 && l.stage !== 'converted' && l.stage !== 'lost').length}
                  </p>
                </div>
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <Zap className="h-5 w-5 text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Kanban Board */}
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {STAGES.filter(s => s !== 'lost').map((stage) => {
              const config = STAGE_CONFIG[stage];
              const stageLeads = getLeadsByStage(stage);
              const stageValue = stageLeads.reduce((sum, l) => sum + l.potentialValue, 0);

              return (
                <div
                  key={stage}
                  className="w-80 flex-shrink-0"
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(stage)}
                >
                  <div className={`rounded-t-lg p-3 ${config.bgColor} border ${config.borderColor} border-b-0`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${config.color}`} />
                        <span className="text-foreground font-medium">{config.label}</span>
                        <Badge variant="outline" className="text-muted-foreground border-border ml-1">
                          {stageLeads.length}
                        </Badge>
                      </div>
                      <span className={`text-sm ${config.textColor}`}>{formatCurrency(stageValue)}</span>
                    </div>
                  </div>
                  <ScrollArea className="h-[500px] rounded-b-lg border border-border border-t-0 bg-background/50">
                    <div className="p-2 space-y-2">
                      {stageLeads.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground text-sm">
                          No leads in this stage
                        </div>
                      ) : (
                        stageLeads.map((lead) => (
                          <Card
                            key={lead.id}
                            className="bg-card border-border cursor-grab active:cursor-grabbing hover:border-border transition-colors"
                            draggable
                            onDragStart={() => handleDragStart(lead)}
                            onClick={() => setSelectedLead(lead)}
                            data-testid={`card-lead-${lead.id}`}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <p className="text-foreground font-medium text-sm">{lead.name}</p>
                                  <p className="text-muted-foreground text-xs">{lead.source}</p>
                                </div>
                                <Badge className={`${getScoreColor(lead.score)} text-xs`}>
                                  {lead.score}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                                <IndianRupee className="h-3 w-3" />
                                <span>{formatCurrency(lead.potentialValue)}</span>
                              </div>
                              {lead.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {lead.tags.slice(0, 2).map((tag, i) => (
                                    <Badge key={i} variant="outline" className="text-xs border-border text-muted-foreground py-0">
                                      {tag}
                                    </Badge>
                                  ))}
                                  {lead.tags.length > 2 && (
                                    <Badge variant="outline" className="text-xs border-border text-muted-foreground py-0">
                                      +{lead.tags.length - 2}
                                    </Badge>
                                  )}
                                </div>
                              )}
                              {lead.nextFollowUp && (
                                <div className="flex items-center gap-1 text-xs text-amber-400">
                                  <Clock className="h-3 w-3" />
                                  <span>Follow up: {new Date(lead.nextFollowUp).toLocaleDateString()}</span>
                                </div>
                              )}
                              <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
                                <div className="flex gap-1">
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                                    <Phone className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                                    <Mail className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                                    <MessageSquare className="h-3 w-3" />
                                  </Button>
                                </div>
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground hover:text-foreground">
                                  <ChevronRight className="h-3 w-3" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              );
            })}
          </div>
        </div>

        {/* Lost Leads Section (Collapsed) */}
        <Card className="bg-background/50 border-border">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground text-sm flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-400" />
                Lost Leads ({getLeadsByStage('lost').length})
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="py-2">
            <div className="flex gap-4 overflow-x-auto pb-2">
              {getLeadsByStage('lost').map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center gap-3 p-2 bg-card/50 rounded-lg min-w-[200px]"
                >
                  <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                    <User className="h-4 w-4 text-red-400" />
                  </div>
                  <div>
                    <p className="text-foreground text-sm">{lead.name}</p>
                    <p className="text-muted-foreground text-xs">{formatCurrency(lead.potentialValue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Lead Detail Dialog */}
        <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
          <DialogContent className="bg-background border-border text-foreground max-w-lg">
            {selectedLead && (
              <>
                <DialogHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <DialogTitle className="text-xl">{selectedLead.name}</DialogTitle>
                      <DialogDescription className="text-muted-foreground flex items-center gap-2 mt-1">
                        <Badge className={`${STAGE_CONFIG[selectedLead.stage].bgColor} ${STAGE_CONFIG[selectedLead.stage].textColor}`}>
                          {STAGE_CONFIG[selectedLead.stage].label}
                        </Badge>
                        <span>•</span>
                        <span>Score: {selectedLead.score}</span>
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-card rounded-lg">
                      <p className="text-muted-foreground text-xs">Potential Value</p>
                      <p className="text-foreground font-medium">{formatCurrency(selectedLead.potentialValue)}</p>
                    </div>
                    <div className="p-3 bg-card rounded-lg">
                      <p className="text-muted-foreground text-xs">Source</p>
                      <p className="text-foreground font-medium">{selectedLead.source}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{selectedLead.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{selectedLead.phone}</span>
                    </div>
                    {selectedLead.lastContact && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Last contact: {new Date(selectedLead.lastContact).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                  {selectedLead.notes && (
                    <div className="p-3 bg-card rounded-lg">
                      <p className="text-muted-foreground text-xs mb-1">Notes</p>
                      <p className="text-foreground text-sm">{selectedLead.notes}</p>
                    </div>
                  )}
                  {selectedLead.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedLead.tags.map((tag, i) => (
                        <Badge key={i} variant="outline" className="border-border text-muted-foreground">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-3 pt-4 border-t border-border">
                    <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" data-testid="button-call-lead">
                      <Phone className="h-4 w-4 mr-2" />
                      Call
                    </Button>
                    <Button variant="outline" className="flex-1 border-border" data-testid="button-email-lead">
                      <Mail className="h-4 w-4 mr-2" />
                      Email
                    </Button>
                    <Button variant="outline" className="border-border" data-testid="button-edit-lead">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
