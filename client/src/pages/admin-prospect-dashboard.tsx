import { useState, useEffect, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Users, UserPlus, Building2, Search, Filter, RefreshCw, Download, 
  TrendingUp, Target, ArrowRight, Loader2, CheckCircle2, AlertCircle,
  UserCheck, Clock, Zap, BarChart3, Link2, Cloud, Eye, History, Pencil,
  Sparkles, Trophy, Activity, HeartHandshake, Banknote, Info
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ProspectMetrics {
  b2bLeads: {
    total: number;
    new: number;
    contacted: number;
    qualified: number;
    converted: number;
    rejected: number;
    unassigned: number;
    hotLeads: number;
    warmLeads: number;
    coldLeads: number;
  };
  individualProspects: {
    total: number;
    prospect: number;
    onboarded: number;
    activeClient: number;
  };
  agentDistribution: {
    individual: Array<{ agentId: string; firstName: string; lastName: string; prospectCount: number }>;
    b2b: Array<{ agentId: string; firstName: string; lastName: string; leadCount: number }>;
  };
  totals: {
    allProspects: number;
    unassignedB2B: number;
  };
}

interface B2BLead {
  id: string;
  cin: string | null;
  companyName: string;
  primaryEmail: string | null;
  primaryMobile: string | null;
  city: string | null;
  state: string | null;
  industrySegment: string | null;
  companyCategory: string | null;
  leadScore: number;
  leadQuality: string | null;
  status: string;
  assignedTo: string | null;
  assignedAgentName: string | null;
  source: string;
  createdAt: string;
  // Prospect Scoring Engine fields
  compositeScore?: number | null;
  wealthScore?: number | null;
  activityScore?: number | null;
  relationshipScore?: number | null;
  estimatedNetworth?: number | null;
  scoringVersion?: string | null;
  scoredAt?: string | null;
}

interface IndividualProspect {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  pan: string | null;
  clientType: string | null;
  indicativeRiskProfile: string | null;
  state: string;
  agentId: string;
  agentName: string | null;
  createdAt: string;
}

interface Agent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  contacted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  qualified: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  converted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  on_hold: "bg-muted text-foreground",
};

const QUALITY_COLORS: Record<string, string> = {
  hot: "bg-red-500 text-white",
  warm: "bg-orange-500 text-white",
  cold: "bg-blue-500 text-white",
};

const STATE_COLORS: Record<string, string> = {
  prospect: "bg-muted text-muted-foreground",
  onboarded: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  active_client: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

export default function AdminProspectDashboardPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [b2bSearch, setB2bSearch] = useState("");
  const [b2bStatus, setB2bStatus] = useState("all");
  const [b2bQuality, setB2bQuality] = useState("all");
  const [b2bAssigned, setB2bAssigned] = useState("all");
  const [individualSearch, setIndividualSearch] = useState("");
  const [individualState, setIndividualState] = useState("all");
  const [individualAgent, setIndividualAgent] = useState("all");
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [isCreateB2BOpen, setIsCreateB2BOpen] = useState(false);
  const [isCreateIndividualOpen, setIsCreateIndividualOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isZohoImportOpen, setIsZohoImportOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<{ id: string; type: "b2b" | "individual" } | null>(null);
  const [isEditLeadOpen, setIsEditLeadOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<B2BLead | null>(null);
  const [isBulkScoring, setIsBulkScoring] = useState(false);

  const { data: metrics, isLoading: loadingMetrics, refetch: refetchMetrics } = useQuery<ProspectMetrics>({
    queryKey: ["/api/admin/prospects/metrics"]
  });

  const { data: b2bData, isLoading: loadingB2B, refetch: refetchB2B } = useQuery<{ leads: B2BLead[]; total: number }>({
    queryKey: ["/api/admin/prospects/b2b-leads", b2bSearch, b2bStatus, b2bQuality, b2bAssigned],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (b2bSearch) params.set("search", b2bSearch);
      if (b2bStatus !== "all") params.set("status", b2bStatus);
      if (b2bQuality !== "all") params.set("quality", b2bQuality);
      if (b2bAssigned !== "all") params.set("assignedTo", b2bAssigned);
      const response = await fetch(`/api/admin/prospects/b2b-leads?${params}`);
      if (!response.ok) throw new Error("Failed to fetch B2B leads");
      return response.json();
    }
  });

  const { data: individualData, isLoading: loadingIndividual, refetch: refetchIndividual } = useQuery<{ prospects: IndividualProspect[]; total: number }>({
    queryKey: ["/api/admin/prospects/individual-prospects", individualSearch, individualState, individualAgent],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (individualSearch) params.set("search", individualSearch);
      if (individualState !== "all") params.set("state", individualState);
      if (individualAgent !== "all") params.set("agentId", individualAgent);
      const response = await fetch(`/api/admin/prospects/individual-prospects?${params}`);
      if (!response.ok) throw new Error("Failed to fetch prospects");
      return response.json();
    }
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/admin/prospects/agents"]
  });

  const { data: zohoStatus } = useQuery<{ configured: boolean; connectionId: string | null }>({
    queryKey: ["/api/admin/prospects/zoho-status"]
  });

  const createB2BMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("/api/admin/prospects/b2b-leads", {
        method: "POST",
        body: JSON.stringify(data)
      });
      return response;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "B2B lead created successfully" });
      setIsCreateB2BOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prospects"] });
      refetchB2B();
      refetchMetrics();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const createIndividualMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("/api/admin/prospects/individual-prospects", {
        method: "POST",
        body: JSON.stringify(data)
      });
      return response;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Prospect created successfully" });
      setIsCreateIndividualOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prospects"] });
      refetchIndividual();
      refetchMetrics();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const assignMutation = useMutation({
    mutationFn: async ({ id, type, agentId, reason }: { id: string; type: "b2b" | "individual"; agentId: string; reason?: string }) => {
      const endpoint = type === "b2b" 
        ? `/api/admin/prospects/b2b-leads/${id}/assign`
        : `/api/admin/prospects/individual-prospects/${id}/assign`;
      const response = await apiRequest(endpoint, {
        method: "PATCH",
        body: JSON.stringify({ agentId, reason })
      });
      return response;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Assignment updated successfully" });
      setIsAssignOpen(false);
      setAssignTarget(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prospects"] });
      refetchB2B();
      refetchIndividual();
      refetchMetrics();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const bulkAssignMutation = useMutation({
    mutationFn: async ({ leadIds, agentId, reason }: { leadIds: string[]; agentId: string; reason?: string }) => {
      const response = await apiRequest("/api/admin/prospects/b2b-leads/bulk-assign", {
        method: "POST",
        body: JSON.stringify({ leadIds, agentId, reason })
      });
      return response;
    },
    onSuccess: (data: any) => {
      toast({ title: "Bulk Assignment Complete", description: `${data.succeeded} leads assigned successfully` });
      setSelectedLeads([]);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prospects"] });
      refetchB2B();
      refetchMetrics();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  // Upgrade 2: Bulk Score All handler
  const handleBulkScoreAll = async () => {
    setIsBulkScoring(true);
    try {
      const response = await apiRequest("/api/agent-wizard/prospects/bulk-score", {
        method: "POST",
        body: JSON.stringify({ limit: 200, staleAfterDays: 7, triggeredBy: "admin_bulk_button" })
      });
      const data: any = response;
      toast({
        title: "Bulk Scoring Complete",
        description: `${data.result?.succeeded ?? 0} leads scored, ${data.result?.failed ?? 0} failed`
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prospects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent-wizard/prospects/top-ranked"] });
      refetchB2B();
      refetchMetrics();
    } catch (err: any) {
      toast({ title: "Bulk Scoring Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsBulkScoring(false);
    }
  };

  // Upgrade 6: Top Prospects query
  const { data: topProspectsData, isLoading: loadingTopProspects, refetch: refetchTopProspects } = useQuery<{ success: boolean; prospects: any[] }>({
    queryKey: ["/api/agent-wizard/prospects/top-ranked"],
    queryFn: async () => {
      const r = await apiRequest("/api/agent-wizard/prospects/top-ranked?limit=50");
      return r as any;
    },
    enabled: activeTab === "top-prospects",
  });

  const zohoImportMutation = useMutation({
    mutationFn: async ({ module, assignToAgent, maxRecords }: { module: string; assignToAgent?: string; maxRecords: number }) => {
      const response = await apiRequest("/api/admin/prospects/import/zoho-crm", {
        method: "POST",
        body: JSON.stringify({ module, assignToAgent, maxRecords })
      });
      return response;
    },
    onSuccess: (data: any) => {
      toast({ 
        title: "Import Complete", 
        description: `Imported ${data.imported} leads, skipped ${data.skipped} duplicates` 
      });
      setIsZohoImportOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prospects"] });
      refetchB2B();
      refetchMetrics();
    },
    onError: (error: any) => {
      toast({ title: "Import Failed", description: error.message, variant: "destructive" });
    }
  });

  const updateLeadMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<B2BLead> }) => {
      const response = await apiRequest(`/api/admin/marketing/leads/${data.id}`, {
        method: "PATCH",
        body: JSON.stringify(data.updates)
      });
      return response;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Lead updated successfully" });
      setIsEditLeadOpen(false);
      setEditingLead(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prospects"] });
      refetchB2B();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const handleEditLead = (lead: B2BLead) => {
    setEditingLead(lead);
    setIsEditLeadOpen(true);
  };

  const handleSelectLead = (leadId: string, checked: boolean) => {
    if (checked) {
      setSelectedLeads(prev => [...prev, leadId]);
    } else {
      setSelectedLeads(prev => prev.filter(id => id !== leadId));
    }
  };

  const handleSelectAllLeads = (checked: boolean) => {
    if (checked && b2bData?.leads) {
      setSelectedLeads(b2bData.leads.map(l => l.id));
    } else {
      setSelectedLeads([]);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Prospect Dashboard</h1>
          <p className="text-muted-foreground">
            Manage all prospects and leads across agents
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { refetchMetrics(); refetchB2B(); refetchIndividual(); }}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          {zohoStatus?.configured && (
            <Button variant="outline" onClick={() => setIsZohoImportOpen(true)}>
              <Cloud className="mr-2 h-4 w-4" />
              Import from Zoho
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ScrollableTabsList>
          <TabsList>
            <TabsTrigger value="overview">
              <BarChart3 className="mr-2 h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="b2b">
              <Building2 className="mr-2 h-4 w-4" />
              B2B Leads
            </TabsTrigger>
            <TabsTrigger value="individual">
              <Users className="mr-2 h-4 w-4" />
              Individual Prospects
            </TabsTrigger>
            <TabsTrigger value="top-prospects">
              <TrendingUp className="mr-2 h-4 w-4" />
              Top Prospects
            </TabsTrigger>
          </TabsList>
        </ScrollableTabsList>

        <TabsContent value="overview" className="space-y-6">
          {loadingMetrics ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Prospects</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{metrics?.totals.allProspects || 0}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {metrics?.b2bLeads.total || 0} B2B + {metrics?.individualProspects.total || 0} Individual
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Hot Leads</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-red-600">{metrics?.b2bLeads.hotLeads || 0}</div>
                    <p className="text-xs text-muted-foreground mt-1">High priority B2B leads</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Unassigned</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-orange-600">{metrics?.totals.unassignedB2B || 0}</div>
                    <p className="text-xs text-muted-foreground mt-1">B2B leads pending assignment</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Active Clients</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">{metrics?.individualProspects.activeClient || 0}</div>
                    <p className="text-xs text-muted-foreground mt-1">Converted from prospects</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      B2B Lead Pipeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { label: "New", count: metrics?.b2bLeads.new || 0, color: "bg-blue-500" },
                        { label: "Contacted", count: metrics?.b2bLeads.contacted || 0, color: "bg-yellow-500" },
                        { label: "Qualified", count: metrics?.b2bLeads.qualified || 0, color: "bg-green-500" },
                        { label: "Converted", count: metrics?.b2bLeads.converted || 0, color: "bg-emerald-500" },
                        { label: "Rejected", count: metrics?.b2bLeads.rejected || 0, color: "bg-red-500" },
                      ].map((stage) => (
                        <div key={stage.label} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                            <span className="text-sm">{stage.label}</span>
                          </div>
                          <span className="font-semibold">{stage.count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Individual Prospect Pipeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { label: "Prospect", count: metrics?.individualProspects.prospect || 0, color: "bg-muted" },
                        { label: "Onboarded", count: metrics?.individualProspects.onboarded || 0, color: "bg-blue-500" },
                        { label: "Active Client", count: metrics?.individualProspects.activeClient || 0, color: "bg-green-500" },
                      ].map((stage) => (
                        <div key={stage.label} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                            <span className="text-sm">{stage.label}</span>
                          </div>
                          <span className="font-semibold">{stage.count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {metrics?.agentDistribution.b2b && metrics.agentDistribution.b2b.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Agent Distribution (B2B Leads)</CardTitle>
                    <CardDescription>Leads assigned to each agent</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-4">
                      {metrics.agentDistribution.b2b.map((agent) => (
                        <div key={agent.agentId} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <span className="text-sm font-medium">{agent.firstName} {agent.lastName}</span>
                          <Badge variant="secondary">{agent.leadCount}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="b2b" className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>B2B Leads</CardTitle>
                  <CardDescription>Company leads from Credhive, Zoho CRM, and manual entry</CardDescription>
                </div>
                <div className="flex gap-2">
                  {selectedLeads.length > 0 && (
                    <Button variant="outline" onClick={() => setIsAssignOpen(true)}>
                      <UserCheck className="mr-2 h-4 w-4" />
                      Bulk Assign ({selectedLeads.length})
                    </Button>
                  )}
                  {/* Upgrade 2: Bulk Score All */}
                  <Button variant="outline" onClick={handleBulkScoreAll} disabled={isBulkScoring}>
                    {isBulkScoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-2 h-4 w-4" />}
                    {isBulkScoring ? "Scoring..." : "Score All Leads"}
                  </Button>
                  <Button onClick={() => setIsCreateB2BOpen(true)}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Lead
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by company, email, CIN..."
                      value={b2bSearch}
                      onChange={(e) => setB2bSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select value={b2bStatus} onValueChange={setB2bStatus}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="converted">Converted</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={b2bQuality} onValueChange={setB2bQuality}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Quality" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Quality</SelectItem>
                    <SelectItem value="hot">Hot</SelectItem>
                    <SelectItem value="warm">Warm</SelectItem>
                    <SelectItem value="cold">Cold</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={b2bAssigned} onValueChange={setB2bAssigned}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Assignment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Assignments</SelectItem>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.firstName} {agent.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {loadingB2B ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={selectedLeads.length === (b2bData?.leads?.length || 0) && (b2bData?.leads?.length || 0) > 0}
                            onCheckedChange={handleSelectAllLeads}
                          />
                        </TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Quality</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>
                          <div className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-violet-500" />
                            <span>FP Score</span>
                          </div>
                        </TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {b2bData?.leads?.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedLeads.includes(lead.id)}
                              onCheckedChange={(checked) => handleSelectLead(lead.id, checked as boolean)}
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{lead.companyName}</div>
                              {lead.cin && <div className="text-xs text-muted-foreground">{lead.cin}</div>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {lead.primaryEmail && <div>{lead.primaryEmail}</div>}
                              {lead.primaryMobile && <div className="text-muted-foreground">{lead.primaryMobile}</div>}
                            </div>
                          </TableCell>
                          <TableCell>
                            {lead.city || lead.state ? `${lead.city || ""}${lead.city && lead.state ? ", " : ""}${lead.state || ""}` : "-"}
                          </TableCell>
                          <TableCell>
                            {lead.leadQuality && (
                              <Badge className={QUALITY_COLORS[lead.leadQuality] || "bg-muted"}>
                                {lead.leadQuality.toUpperCase()}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <span className="font-medium">{lead.leadScore}</span>
                              <span className="text-muted-foreground">/100</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {lead.compositeScore != null ? (
                              <div className="flex items-center gap-1">
                                <Sparkles className={`h-3 w-3 ${lead.compositeScore >= 70 ? "text-violet-600" : lead.compositeScore >= 40 ? "text-amber-500" : "text-muted-foreground"}`} />
                                <span className={`font-semibold text-sm ${lead.compositeScore >= 70 ? "text-violet-700 dark:text-violet-400" : lead.compositeScore >= 40 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                                  {Number(lead.compositeScore).toFixed(1)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={STATUS_COLORS[lead.status] || "bg-muted"}>
                              {lead.status.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {lead.assignedAgentName || (
                              <span className="text-muted-foreground italic">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{lead.source}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditLead(lead)}
                                title="Edit Lead"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setAssignTarget({ id: lead.id, type: "b2b" }); setIsAssignOpen(true); }}
                                title="Assign Agent"
                              >
                                <UserCheck className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!b2bData?.leads || b2bData.leads.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                            No B2B leads found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
              {b2bData?.total && (
                <div className="text-sm text-muted-foreground">
                  Showing {b2bData.leads?.length || 0} of {b2bData.total} leads
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="individual" className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Individual Prospects</CardTitle>
                  <CardDescription>Personal prospects assigned to agents</CardDescription>
                </div>
                <Button onClick={() => setIsCreateIndividualOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Prospect
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, email, PAN..."
                      value={individualSearch}
                      onChange={(e) => setIndividualSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select value={individualState} onValueChange={setIndividualState}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="State" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="onboarded">Onboarded</SelectItem>
                    <SelectItem value="active_client">Active Client</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={individualAgent} onValueChange={setIndividualAgent}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Agent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Agents</SelectItem>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.firstName} {agent.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {loadingIndividual ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>PAN</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Risk Profile</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {individualData?.prospects?.map((prospect) => (
                        <TableRow key={prospect.id}>
                          <TableCell className="font-medium">{prospect.name}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {prospect.email && <div>{prospect.email}</div>}
                              {prospect.mobile && <div className="text-muted-foreground">{prospect.mobile}</div>}
                            </div>
                          </TableCell>
                          <TableCell>{prospect.pan || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{prospect.clientType || "individual"}</Badge>
                          </TableCell>
                          <TableCell>{prospect.indicativeRiskProfile || "-"}</TableCell>
                          <TableCell>
                            <Badge className={STATE_COLORS[prospect.state] || "bg-muted"}>
                              {prospect.state.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>{prospect.agentName || "-"}</TableCell>
                          <TableCell>{format(new Date(prospect.createdAt), "MMM d, yyyy")}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setAssignTarget({ id: prospect.id, type: "individual" }); setIsAssignOpen(true); }}
                            >
                              <UserCheck className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!individualData?.prospects || individualData.prospects.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                            No individual prospects found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
              {individualData?.total && (
                <div className="text-sm text-muted-foreground">
                  Showing {individualData.prospects?.length || 0} of {individualData.total} prospects
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Upgrade 6: Top Prospects ranked tab */}
        <TabsContent value="top-prospects" className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-orange-500" />
                    Top Prospects by FP Score
                  </CardTitle>
                  <CardDescription>
                    Ranked by Wealth Engine composite score — updated nightly. Only scored leads are shown.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchTopProspects()} disabled={loadingTopProspects}>
                  {loadingTopProspects ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingTopProspects ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !topProspectsData?.prospects?.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No scored prospects yet</p>
                  <p className="text-sm mt-1">Click "Score All Leads" in the B2B Leads tab to compute scores</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Segment</TableHead>
                        <TableHead className="text-right">FP Score</TableHead>
                        <TableHead className="text-right">Wealth</TableHead>
                        <TableHead className="text-right">Activity</TableHead>
                        <TableHead className="text-right">Relation</TableHead>
                        <TableHead className="text-right">Net Worth</TableHead>
                        <TableHead className="text-right">Investable</TableHead>
                        <TableHead>Quality</TableHead>
                        <TableHead>Tier</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topProspectsData.prospects.map((p: any, idx: number) => (
                        <TableRow key={p.id} className="hover:bg-muted/40">
                          <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell>
                            <div className="font-medium">{p.companyName}</div>
                            {p.city && <div className="text-xs text-muted-foreground">{p.city}{p.state ? `, ${p.state}` : ""}</div>}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{p.industrySegment || "—"}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className={`font-bold text-lg ${p.compositeScore >= 65 ? "text-green-600 dark:text-green-400" : p.compositeScore >= 35 ? "text-yellow-600 dark:text-yellow-400" : "text-muted-foreground"}`}>
                              {p.compositeScore.toFixed(1)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm">{p.wealthScore.toFixed(1)}</TableCell>
                          <TableCell className="text-right text-sm">{p.activityScore.toFixed(1)}</TableCell>
                          <TableCell className="text-right text-sm">{p.relationshipScore.toFixed(1)}</TableCell>
                          <TableCell className="text-right text-sm">
                            {p.estimatedNetworth > 0
                              ? `₹${(p.estimatedNetworth / 1e7).toFixed(1)}Cr`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {p.investableSurplus > 0
                              ? `₹${(p.investableSurplus / 1e7).toFixed(1)}Cr`
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge className={
                              p.leadQuality === "hot" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" :
                              p.leadQuality === "warm" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" :
                              "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                            }>
                              {p.leadQuality || "—"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={
                              p.scoreTier === "platinum" ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" :
                              p.scoreTier === "gold" ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" :
                              p.scoreTier === "silver" ? "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300" :
                              ""
                            }>
                              {p.scoreTier}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs capitalize">{p.status || "—"}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="mt-3 text-xs text-muted-foreground">
                    Showing top {topProspectsData.prospects.length} scored leads • Scores: 0–100 (hot ≥65, warm ≥35)
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateB2BDialog 
        open={isCreateB2BOpen} 
        onOpenChange={setIsCreateB2BOpen}
        agents={agents}
        onSubmit={(data) => createB2BMutation.mutate(data)}
        isPending={createB2BMutation.isPending}
      />

      <CreateIndividualDialog
        open={isCreateIndividualOpen}
        onOpenChange={setIsCreateIndividualOpen}
        agents={agents}
        onSubmit={(data) => createIndividualMutation.mutate(data)}
        isPending={createIndividualMutation.isPending}
      />

      <AssignDialog
        open={isAssignOpen}
        onOpenChange={(open) => { setIsAssignOpen(open); if (!open) setAssignTarget(null); }}
        agents={agents}
        target={assignTarget}
        selectedLeads={selectedLeads}
        onSubmit={(agentId, reason) => {
          if (assignTarget) {
            assignMutation.mutate({ id: assignTarget.id, type: assignTarget.type, agentId, reason });
          } else if (selectedLeads.length > 0) {
            bulkAssignMutation.mutate({ leadIds: selectedLeads, agentId, reason });
          }
        }}
        isPending={assignMutation.isPending || bulkAssignMutation.isPending}
      />

      <ZohoImportDialog
        open={isZohoImportOpen}
        onOpenChange={setIsZohoImportOpen}
        agents={agents}
        onSubmit={(module, agentId, maxRecords) => zohoImportMutation.mutate({ module, assignToAgent: agentId, maxRecords })}
        isPending={zohoImportMutation.isPending}
      />

      <EditLeadDialog
        open={isEditLeadOpen}
        onOpenChange={(open) => { setIsEditLeadOpen(open); if (!open) setEditingLead(null); }}
        lead={editingLead}
        onSubmit={(updates) => {
          if (editingLead) {
            updateLeadMutation.mutate({ id: editingLead.id, updates });
          }
        }}
        isPending={updateLeadMutation.isPending}
      />
    </div>
  );
}

function CreateB2BDialog({ open, onOpenChange, agents, onSubmit, isPending }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: Agent[];
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState({
    companyName: "",
    cin: "",
    primaryEmail: "",
    primaryMobile: "",
    city: "",
    state: "",
    industrySegment: "",
    companyCategory: "mid_market",
    leadQuality: "warm",
    assignedTo: "",
    notes: ""
  });

  const handleSubmit = () => {
    onSubmit({
      ...formData,
      assignedTo: formData.assignedTo || undefined
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add B2B Lead</DialogTitle>
          <DialogDescription>Create a new company lead manually</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="companyName">Company Name *</Label>
            <Input
              id="companyName"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              placeholder="Enter company name"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="cin">CIN</Label>
              <Input
                id="cin"
                value={formData.cin}
                onChange={(e) => setFormData({ ...formData, cin: e.target.value })}
                placeholder="U12345MH2020PTC123456"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="industrySegment">Industry</Label>
              <Input
                id="industrySegment"
                value={formData.industrySegment}
                onChange={(e) => setFormData({ ...formData, industrySegment: e.target.value })}
                placeholder="e.g., Manufacturing"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="primaryEmail">Email</Label>
              <Input
                id="primaryEmail"
                type="email"
                value={formData.primaryEmail}
                onChange={(e) => setFormData({ ...formData, primaryEmail: e.target.value })}
                placeholder="contact@company.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="primaryMobile">Phone</Label>
              <Input
                id="primaryMobile"
                value={formData.primaryMobile}
                onChange={(e) => setFormData({ ...formData, primaryMobile: e.target.value })}
                placeholder="+91 9876543210"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Lead Quality</Label>
              <Select value={formData.leadQuality} onValueChange={(v) => setFormData({ ...formData, leadQuality: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hot">Hot</SelectItem>
                  <SelectItem value="warm">Warm</SelectItem>
                  <SelectItem value="cold">Cold</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Company Category</Label>
              <Select value={formData.companyCategory} onValueChange={(v) => setFormData({ ...formData, companyCategory: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="msme">MSME</SelectItem>
                  <SelectItem value="mid_market">Mid-Market</SelectItem>
                  <SelectItem value="large_enterprise">Large Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Assign to Agent (Optional)</Label>
            <Select value={formData.assignedTo} onValueChange={(v) => setFormData({ ...formData, assignedTo: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Unassigned</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.firstName} {agent.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes about this lead..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!formData.companyName || isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateIndividualDialog({ open, onOpenChange, agents, onSubmit, isPending }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: Agent[];
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    mobile: "",
    pan: "",
    clientType: "individual",
    indicativeRiskProfile: "",
    agentId: ""
  });

  const handleSubmit = () => {
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Individual Prospect</DialogTitle>
          <DialogDescription>Create a new prospect and assign to an agent</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter full name"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mobile">Mobile</Label>
              <Input
                id="mobile"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                placeholder="+91 9876543210"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="pan">PAN</Label>
              <Input
                id="pan"
                value={formData.pan}
                onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                placeholder="ABCDE1234F"
                maxLength={10}
              />
            </div>
            <div className="grid gap-2">
              <Label>Client Type</Label>
              <Select value={formData.clientType} onValueChange={(v) => setFormData({ ...formData, clientType: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="hni">HNI</SelectItem>
                  <SelectItem value="ultra_hni">Ultra HNI</SelectItem>
                  <SelectItem value="corporate">Corporate</SelectItem>
                  <SelectItem value="nri">NRI</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Risk Profile</Label>
              <Select value={formData.indicativeRiskProfile} onValueChange={(v) => setFormData({ ...formData, indicativeRiskProfile: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select risk profile" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conservative">Conservative</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="aggressive">Aggressive</SelectItem>
                  <SelectItem value="very_aggressive">Very Aggressive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Assign to Agent *</Label>
              <Select value={formData.agentId} onValueChange={(v) => setFormData({ ...formData, agentId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.firstName} {agent.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!formData.name || !formData.agentId || isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Prospect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignDialog({ open, onOpenChange, agents, target, selectedLeads, onSubmit, isPending }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: Agent[];
  target: { id: string; type: "b2b" | "individual" } | null;
  selectedLeads: string[];
  onSubmit: (agentId: string, reason?: string) => void;
  isPending: boolean;
}) {
  const [agentId, setAgentId] = useState("");
  const [reason, setReason] = useState("");

  const isBulk = !target && selectedLeads.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isBulk ? `Bulk Assign ${selectedLeads.length} Leads` : "Assign to Agent"}</DialogTitle>
          <DialogDescription>
            {isBulk 
              ? "Assign selected leads to an agent" 
              : target?.type === "b2b" 
                ? "Assign this B2B lead to an agent" 
                : "Reassign this prospect to a different agent"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Select Agent</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.firstName} {agent.lastName} ({agent.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="reason">Reason (Optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for assignment/reassignment..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSubmit(agentId, reason)} disabled={!agentId || isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ZohoImportDialog({ open, onOpenChange, agents, onSubmit, isPending }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: Agent[];
  onSubmit: (module: string, agentId?: string, maxRecords?: number) => void;
  isPending: boolean;
}) {
  const [module, setModule] = useState("Leads");
  const [agentId, setAgentId] = useState("");
  const [maxRecords, setMaxRecords] = useState(100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Import from Zoho CRM
          </DialogTitle>
          <DialogDescription>
            Import leads or contacts from your connected Zoho CRM
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Import From</Label>
            <Select value={module} onValueChange={setModule}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Leads">Leads</SelectItem>
                <SelectItem value="Contacts">Contacts</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Assign to Agent (Optional)</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger>
                <SelectValue placeholder="Leave unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Unassigned</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.firstName} {agent.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Max Records</Label>
            <Select value={maxRecords.toString()} onValueChange={(v) => setMaxRecords(parseInt(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50 records</SelectItem>
                <SelectItem value="100">100 records</SelectItem>
                <SelectItem value="200">200 records</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Duplicate records (matching email) will be automatically skipped.
            </AlertDescription>
          </Alert>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSubmit(module, agentId || undefined, maxRecords)} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Prospect Scoring Panel ────────────────────────────────────────────────────

interface ScoreData {
  wealthScore: number;
  activityScore: number;
  relationshipScore: number;
  financialHealthScore?: number;
  compositeScore: number;
  estimatedNetworth: number;
  investableSurplus: number;
  leadQuality?: string;
  scoringVersion?: string;
  scoredAt?: string;
}

function ScoreBar({ label, score, icon, color }: { label: string; score: number; icon: ReactNode; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-xs">
        <div className="flex items-center gap-1 text-muted-foreground">
          {icon}
          {label}
        </div>
        <span className="font-semibold">{score.toFixed(1)}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
    </div>
  );
}

function ProspectScorePanel({ leadId, onScored }: { leadId: string; onScored?: () => void }) {
  const { toast } = useToast();
  const [relStrength, setRelStrength] = useState(50);
  const [showHistory, setShowHistory] = useState(false);

  const { data, isLoading, refetch } = useQuery<{
    success: boolean; scored: boolean; scoring: ScoreData | null; sectorBenchmark: any;
  }>({
    queryKey: ["/api/agent-wizard/prospects", leadId, "score"],
    queryFn: () => apiRequest(`/api/agent-wizard/prospects/${leadId}/score`),
    enabled: !!leadId,
  });

  // Upgrade 7: Score history
  const { data: historyData, isLoading: loadingHistory } = useQuery<{
    success: boolean; history: any[];
  }>({
    queryKey: ["/api/agent-wizard/prospects", leadId, "score-history"],
    queryFn: () => apiRequest(`/api/agent-wizard/prospects/${leadId}/score-history`),
    enabled: !!leadId && showHistory,
  });

  const computeMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/agent-wizard/prospects/${leadId}/compute-score`, {
        method: "POST",
        body: JSON.stringify({ relationshipStrength: relStrength }),
      }),
    onSuccess: (res: any) => {
      if (res.success) {
        toast({ title: "Score computed", description: `Composite score: ${res.scoring.compositeScore.toFixed(1)}/100` });
        refetch();
        onScored?.();
        queryClient.invalidateQueries({ queryKey: ["/api/agent-wizard/prospects/top-ranked"] });
      } else {
        toast({ title: "Error", description: res.error, variant: "destructive" });
      }
    },
    onError: () => toast({ title: "Failed to compute score", variant: "destructive" }),
  });

  const scoring = data?.scoring as any;
  const benchmark = data?.sectorBenchmark;

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-gradient-to-br from-violet-50/30 to-transparent dark:from-violet-950/10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-600" />
          <span className="font-semibold text-sm">FintekPro Wealth Score</span>
        </div>
        <div className="flex items-center gap-2">
          {scoring && (
            <Badge className={`text-base font-bold px-3 py-1 ${
              scoring.compositeScore >= 65
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                : scoring.compositeScore >= 35
                ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
                : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
            }`}>
              {scoring.compositeScore.toFixed(1)}/100
            </Badge>
          )}
          {scoring?.leadQuality && (
            <Badge className={
              scoring.leadQuality === "hot" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" :
              scoring.leadQuality === "warm" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" :
              "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
            }>
              {scoring.leadQuality}
            </Badge>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading score…
        </div>
      )}

      {!isLoading && scoring && (
        <div className="space-y-2.5">
          <ScoreBar label="Wealth" score={scoring.wealthScore} icon={<Banknote className="h-3 w-3" />} color="bg-emerald-500" />
          <ScoreBar label="Activity" score={scoring.activityScore} icon={<Activity className="h-3 w-3" />} color="bg-blue-500" />
          <ScoreBar label="Relationship" score={scoring.relationshipScore} icon={<HeartHandshake className="h-3 w-3" />} color="bg-pink-500" />
          {scoring.financialHealthScore !== undefined && (
            <ScoreBar label="Financial Health" score={scoring.financialHealthScore} icon={<Trophy className="h-3 w-3" />} color="bg-amber-500" />
          )}

          {/* Upgrade 3: Investable surplus */}
          {(scoring.estimatedNetworth > 0 || scoring.investableSurplus > 0) && (
            <div className="mt-1 pt-2 border-t grid grid-cols-2 gap-2 text-xs">
              {scoring.estimatedNetworth > 0 && (
                <div className="bg-muted/40 rounded p-2">
                  <p className="text-muted-foreground">Est. Net Worth</p>
                  <p className="font-semibold">₹{(scoring.estimatedNetworth / 1e7).toFixed(2)} Cr</p>
                </div>
              )}
              {scoring.investableSurplus > 0 && (
                <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded p-2">
                  <p className="text-muted-foreground">Investable Surplus</p>
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400">₹{(scoring.investableSurplus / 1e7).toFixed(2)} Cr</p>
                </div>
              )}
            </div>
          )}

          {/* Upgrade 8: Sector benchmark comparison */}
          {benchmark && (
            <div className="mt-1 pt-2 border-t text-xs space-y-1">
              <p className="text-muted-foreground font-medium">vs Sector avg ({benchmark.industrySegment})</p>
              <div className="grid grid-cols-2 gap-1">
                <span className="text-muted-foreground">Composite</span>
                <span className={scoring.compositeScore >= benchmark.avgCompositeScore ? "text-green-600 font-medium" : "text-red-600"}>
                  {scoring.compositeScore.toFixed(1)} vs {benchmark.avgCompositeScore?.toFixed(1) ?? "—"}
                  {scoring.compositeScore >= benchmark.avgCompositeScore ? " ▲" : " ▼"}
                </span>
                <span className="text-muted-foreground">Wealth</span>
                <span className={scoring.wealthScore >= benchmark.avgWealthScore ? "text-green-600 font-medium" : "text-red-600"}>
                  {scoring.wealthScore.toFixed(1)} vs {benchmark.avgWealthScore?.toFixed(1) ?? "—"}
                </span>
              </div>
              <p className="text-muted-foreground">{benchmark.count} peers in benchmark</p>
            </div>
          )}

          {scoring.scoredAt && (
            <p className="text-xs text-muted-foreground">
              Last scored: {format(new Date(scoring.scoredAt), "dd MMM yyyy, HH:mm")}
              {scoring.scoringVersion && ` (${scoring.scoringVersion})`}
            </p>
          )}

          {/* Upgrade 7: Score history toggle */}
          <button
            className="text-xs text-violet-600 dark:text-violet-400 underline-offset-2 hover:underline"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? "Hide" : "Show"} score history
          </button>

          {showHistory && (
            <div className="border rounded p-2 space-y-1 max-h-40 overflow-y-auto">
              {loadingHistory ? (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />Loading history…
                </div>
              ) : !historyData?.history?.length ? (
                <p className="text-xs text-muted-foreground">No history yet</p>
              ) : (
                historyData.history.map((h: any, i: number) => (
                  <div key={h.id || i} className="text-xs flex items-center justify-between gap-2 py-0.5 border-b last:border-0">
                    <span className="text-muted-foreground">
                      {h.createdAt ? format(new Date(h.createdAt), "dd MMM yy HH:mm") : "—"}
                    </span>
                    <span className="font-medium">{parseFloat(h.compositeScore).toFixed(1)}</span>
                    {h.leadQualityAfter && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0">{h.leadQualityAfter}</Badge>
                    )}
                    <span className="text-muted-foreground text-[10px]">{h.triggeredBy || ""}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {!isLoading && !scoring && (
        <p className="text-xs text-muted-foreground">No score computed yet. Click below to run the Wealth Engine.</p>
      )}

      <div className="space-y-2 pt-1 border-t">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Relationship Strength</Label>
          <span className="text-xs font-medium">{relStrength}/100</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={relStrength}
          onChange={(e) => setRelStrength(Number(e.target.value))}
          className="w-full accent-violet-600"
        />
        <Button
          size="sm"
          className="w-full bg-violet-600 hover:bg-violet-700 text-white"
          onClick={() => computeMutation.mutate()}
          disabled={computeMutation.isPending}
        >
          {computeMutation.isPending ? (
            <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Computing…</>
          ) : (
            <><Sparkles className="mr-2 h-3 w-3" />{scoring ? "Recompute Score" : "Compute Score"}</>
          )}
        </Button>
      </div>
    </div>
  );
}

function EditLeadDialog({ open, onOpenChange, lead, onSubmit, isPending }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: B2BLead | null;
  onSubmit: (updates: Partial<B2BLead>) => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState({
    companyName: "",
    primaryEmail: "",
    primaryMobile: "",
    city: "",
    state: "",
    industrySegment: "",
    leadQuality: "",
    status: "",
    notes: "",
    website: "",
    address: ""
  });

  useEffect(() => {
    if (lead && open) {
      setFormData({
        companyName: lead.companyName || "",
        primaryEmail: lead.primaryEmail || "",
        primaryMobile: lead.primaryMobile || "",
        city: lead.city || "",
        state: lead.state || "",
        industrySegment: lead.industrySegment || "",
        leadQuality: lead.leadQuality || "",
        status: lead.status || "",
        notes: "",
        website: (lead as any).website || "",
        address: (lead as any).address || ""
      });
    }
  }, [lead, open]);

  const handleSubmit = () => {
    const updates: any = {};
    if (formData.companyName) updates.companyName = formData.companyName;
    if (formData.primaryEmail) updates.primaryEmail = formData.primaryEmail;
    if (formData.primaryMobile) updates.primaryMobile = formData.primaryMobile;
    if (formData.city) updates.city = formData.city;
    if (formData.state) updates.state = formData.state;
    if (formData.industrySegment) updates.industrySegment = formData.industrySegment;
    if (formData.leadQuality) updates.leadQuality = formData.leadQuality;
    if (formData.status) updates.status = formData.status;
    if (formData.website) updates.website = formData.website;
    if (formData.address) updates.address = formData.address;
    onSubmit(updates);
  };

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Edit Lead
          </DialogTitle>
          <DialogDescription>
            Update contact and location information for this lead
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-companyName">Company Name</Label>
            <Input
              id="edit-companyName"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              placeholder="Company name"
            />
          </div>
          
          <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
            CIN: {lead.cin || "Not available"}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-primaryEmail">Email</Label>
              <Input
                id="edit-primaryEmail"
                type="email"
                value={formData.primaryEmail}
                onChange={(e) => setFormData({ ...formData, primaryEmail: e.target.value })}
                placeholder="contact@company.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-primaryMobile">Phone</Label>
              <Input
                id="edit-primaryMobile"
                value={formData.primaryMobile}
                onChange={(e) => setFormData({ ...formData, primaryMobile: e.target.value })}
                placeholder="+91 9876543210"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-address">Address</Label>
            <Textarea
              id="edit-address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Full address"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-city">City</Label>
              <Input
                id="edit-city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Mumbai"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-state">State</Label>
              <Input
                id="edit-state"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                placeholder="Maharashtra"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-website">Website</Label>
            <Input
              id="edit-website"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              placeholder="https://company.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Lead Quality</Label>
              <Select value={formData.leadQuality} onValueChange={(v) => setFormData({ ...formData, leadQuality: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select quality" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hot">Hot</SelectItem>
                  <SelectItem value="warm">Warm</SelectItem>
                  <SelectItem value="cold">Cold</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-industrySegment">Industry Segment</Label>
            <Input
              id="edit-industrySegment"
              value={formData.industrySegment}
              onChange={(e) => setFormData({ ...formData, industrySegment: e.target.value })}
              placeholder="e.g., Real Estate, Manufacturing"
            />
          </div>

          {lead && <ProspectScorePanel leadId={lead.id} />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
