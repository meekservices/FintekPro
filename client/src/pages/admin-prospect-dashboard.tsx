import { useState, useEffect } from "react";
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
  UserCheck, Clock, Zap, BarChart3, Link2, Cloud, Eye, History, Pencil
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
                  <CardDescription>Company leads from Probe42, Zoho CRM, and manual entry</CardDescription>
                </div>
                <div className="flex gap-2">
                  {selectedLeads.length > 0 && (
                    <Button variant="outline" onClick={() => setIsAssignOpen(true)}>
                      <UserCheck className="mr-2 h-4 w-4" />
                      Bulk Assign ({selectedLeads.length})
                    </Button>
                  )}
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
