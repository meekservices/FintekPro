import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  XCircle,
  Eye,
  Edit,
  ArrowRight,
  Calendar,
  Building2,
  Users,
  Shield as LucideShield,
  History,
  BarChart3,
  RefreshCw,
  GitCompare
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-foreground",
  negotiation: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
  review: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
  approved: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
  signed: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200",
  legacy: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200",
  expired: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
  rejected: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
  archived: "bg-muted text-muted-foreground",
};

const STATUS_ICONS: Record<string, any> = {
  draft: Clock,
  negotiation: RefreshCw,
  review: Eye,
  approved: CheckCircle,
  signed: LucideShield,
  legacy: FileText,
  expired: AlertTriangle,
  rejected: XCircle,
  archived: FileText,
};

const ENTITY_TYPES = ["vendor", "partner", "agent", "ca", "lender", "client", "regulator", "internal"];
const AGREEMENT_TYPES = [
  "service_agreement", "partnership_agreement", "agent_agreement", "ca_engagement_letter",
  "lender_agreement", "client_agreement", "nda", "mou", "amendment", "addendum",
  "renewal", "termination", "compliance_declaration", "kyc_document", "regulatory_filing", "other"
];

const createDocumentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  entityType: z.enum(ENTITY_TYPES as [string, ...string[]]),
  entityName: z.string().optional(),
  entityPan: z.string().optional(),
  agreementType: z.enum(AGREEMENT_TYPES as [string, ...string[]]),
  effectiveDate: z.string().optional(),
  expiryDate: z.string().optional(),
  content: z.string().optional(),
  isLegacy: z.boolean().optional(),
});

type CreateDocumentFormData = z.infer<typeof createDocumentSchema>;

export default function AdminDLMPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("documents");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);

  const form = useForm<CreateDocumentFormData>({
    resolver: zodResolver(createDocumentSchema),
    defaultValues: {
      title: "",
      description: "",
      entityType: "vendor",
      agreementType: "service_agreement",
      isLegacy: false,
    },
  });

  // Fetch documents
  const { data: documentsData, isLoading: documentsLoading, refetch: refetchDocuments } = useQuery<any>({
    queryKey: ["/api/dlm/documents", statusFilter, entityTypeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (entityTypeFilter !== "all") params.append("entityType", entityTypeFilter);
      const res = await fetch(`/api/dlm/documents?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
  });

  // Fetch stats
  const { data: statsData, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/dlm/stats"],
  });

  // Create document mutation
  const createDocumentMutation = useMutation({
    mutationFn: async (data: CreateDocumentFormData) => {
      return apiRequest("/api/dlm/documents", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({ title: "Document created successfully" });
      setIsCreateDialogOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/dlm/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dlm/stats"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create document", description: error.message, variant: "destructive" });
    },
  });

  // Transition document mutation
  const transitionMutation = useMutation({
    mutationFn: async ({ documentId, action, reason }: { documentId: string; action: string; reason?: string }) => {
      return apiRequest(`/api/dlm/documents/${documentId}/transition`, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      });
    },
    onSuccess: () => {
      toast({ title: "Document status updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/dlm/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dlm/stats"] });
      setSelectedDocument(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to update status", description: error.message, variant: "destructive" });
    },
  });

  const documents = documentsData?.data || [];
  const stats = statsData?.data;

  const filteredDocuments = documents.filter((doc: any) => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        doc.title?.toLowerCase().includes(search) ||
        doc.documentNumber?.toLowerCase().includes(search) ||
        doc.entityName?.toLowerCase().includes(search) ||
        doc.entityPan?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const onSubmit = (data: CreateDocumentFormData) => {
    createDocumentMutation.mutate(data);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-dlm-title">Document Lifecycle Management</h1>
          <p className="text-muted-foreground">SEBI-compliant document governance and compliance system</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-document">
              <Plus className="w-4 h-4 mr-2" />
              New Document
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Document</DialogTitle>
              <DialogDescription>Add a new agreement or document to the system</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document Title</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Partnership Agreement - ABC Ltd" data-testid="input-document-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="entityType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Entity Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-entity-type">
                              <SelectValue placeholder="Select entity type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ENTITY_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type.charAt(0).toUpperCase() + type.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="agreementType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Agreement Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-agreement-type">
                              <SelectValue placeholder="Select agreement type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {AGREEMENT_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="entityName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Entity Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., ABC Investments Ltd" data-testid="input-entity-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="entityPan"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Entity PAN</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., AAAAA0000A" maxLength={10} data-testid="input-entity-pan" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="effectiveDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Effective Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-effective-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="expiryDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expiry Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-expiry-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Brief description of the document..." data-testid="input-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document Content (Optional)</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={5} placeholder="Paste document content here for AI analysis..." data-testid="input-content" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createDocumentMutation.isPending} data-testid="button-submit-document">
                    {createDocumentMutation.isPending ? "Creating..." : "Create Document"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.totalDocuments || 0}</p>
                <p className="text-xs text-muted-foreground">Total Documents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats?.statusCounts?.draft || 0}</p>
                <p className="text-xs text-muted-foreground">Drafts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-8 h-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.statusCounts?.negotiation || 0}</p>
                <p className="text-xs text-muted-foreground">In Negotiation</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Eye className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.statusCounts?.review || 0}</p>
                <p className="text-xs text-muted-foreground">Under Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.statusCounts?.signed || 0}</p>
                <p className="text-xs text-muted-foreground">Signed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-8 h-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.expiringDocuments?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Expiring Soon</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="documents" data-testid="tab-documents">
            <FileText className="w-4 h-4 mr-2" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="expiring" data-testid="tab-expiring">
            <Calendar className="w-4 h-4 mr-2" />
            Expiring Soon
          </TabsTrigger>
          <TabsTrigger value="high-risk" data-testid="tab-high-risk">
            <AlertTriangle className="w-4 h-4 mr-2" />
            High Risk
          </TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity">
            <History className="w-4 h-4 mr-2" />
            Recent Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search by title, document number, entity name or PAN..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                      data-testid="input-search"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]" data-testid="filter-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="negotiation">Negotiation</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="signed">Signed</SelectItem>
                    <SelectItem value="legacy">Legacy</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
                  <SelectTrigger className="w-[150px]" data-testid="filter-entity-type">
                    <SelectValue placeholder="Entity Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Entities</SelectItem>
                    {ENTITY_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => refetchDocuments()} data-testid="button-refresh">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Documents List */}
          <Card>
            <CardHeader>
              <CardTitle>Document Library</CardTitle>
              <CardDescription>
                {filteredDocuments.length} document{filteredDocuments.length !== 1 ? "s" : ""} found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {documentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No documents found. Create your first document to get started.</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {filteredDocuments.map((doc: any) => {
                      const StatusIcon = STATUS_ICONS[doc.status] || FileText;
                      return (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                          data-testid={`document-row-${doc.id}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-lg ${STATUS_COLORS[doc.status]}`}>
                              <StatusIcon className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="font-medium">{doc.title}</h4>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>{doc.documentNumber}</span>
                                <span>•</span>
                                <span>{doc.entityName || doc.entityType}</span>
                                {doc.entityPan && (
                                  <>
                                    <span>•</span>
                                    <span className="font-mono">{doc.entityPan}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right text-sm">
                              <Badge variant="outline" className={STATUS_COLORS[doc.status]}>
                                {(doc.status || 'pending').charAt(0).toUpperCase() + (doc.status || 'pending').slice(1)}
                              </Badge>
                              <p className="text-muted-foreground mt-1">
                                {doc.expiryDate ? `Expires: ${formatDate(doc.expiryDate)}` : "No expiry"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {doc.riskScore > 70 && (
                                <Badge variant="destructive" className="flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  Risk: {doc.riskScore}
                                </Badge>
                              )}
                              <Link href={`/admin/dlm/negotiate/${doc.id}`}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  data-testid={`button-negotiate-${doc.id}`}
                                >
                                  <GitCompare className="w-4 h-4 mr-1" />
                                  Negotiate
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedDocument(doc)}
                                data-testid={`button-view-${doc.id}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expiring">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Documents Expiring in 90 Days
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.expiringDocuments?.length > 0 ? (
                <div className="space-y-3">
                  {stats.expiringDocuments.map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{doc.title}</h4>
                        <p className="text-sm text-muted-foreground">{doc.entityName}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200">
                          Expires: {formatDate(doc.expiryDate)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No documents expiring soon</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="high-risk">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                High Risk Documents (Score 70+)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.highRiskDocuments?.length > 0 ? (
                <div className="space-y-3">
                  {stats.highRiskDocuments.map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg border-red-200 dark:border-red-800">
                      <div>
                        <h4 className="font-medium">{doc.title}</h4>
                        <p className="text-sm text-muted-foreground">{doc.entityName}</p>
                      </div>
                      <Badge variant="destructive">Risk Score: {doc.riskScore}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No high-risk documents</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.recentActivity?.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {stats.recentActivity.map((event: any) => (
                      <div key={event.id} className="flex items-start gap-4 p-3 border rounded-lg">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                          <History className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{(event.eventType || 'event').replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}</p>
                          <p className="text-sm text-muted-foreground">
                            {event.actorRole && `by ${event.actorRole}`} • {formatDate(event.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-center text-muted-foreground py-8">No recent activity</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Document Detail Dialog */}
      {selectedDocument && (
        <Dialog open={!!selectedDocument} onOpenChange={() => setSelectedDocument(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedDocument.title}</DialogTitle>
              <DialogDescription>{selectedDocument.documentNumber}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Entity</p>
                  <p className="font-medium">{selectedDocument.entityName || selectedDocument.entityType}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Agreement Type</p>
                  <p className="font-medium">{selectedDocument.agreementType?.replace(/_/g, " ")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={STATUS_COLORS[selectedDocument.status]}>
                    {selectedDocument.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Risk Score</p>
                  <p className="font-medium">{selectedDocument.riskScore || 0}/100</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Effective Date</p>
                  <p className="font-medium">{formatDate(selectedDocument.effectiveDate)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Expiry Date</p>
                  <p className="font-medium">{formatDate(selectedDocument.expiryDate)}</p>
                </div>
              </div>

              {selectedDocument.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p>{selectedDocument.description}</p>
                </div>
              )}

              {/* Workflow Actions */}
              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-2">Available Actions</p>
                <div className="flex flex-wrap gap-2">
                  {selectedDocument.status === "draft" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => transitionMutation.mutate({ documentId: selectedDocument.id, action: "submit_for_negotiation" })}
                        data-testid="action-submit-negotiation"
                      >
                        Submit for Negotiation
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => transitionMutation.mutate({ documentId: selectedDocument.id, action: "submit_for_review" })}
                        data-testid="action-submit-review"
                      >
                        Submit for Review
                      </Button>
                    </>
                  )}
                  {selectedDocument.status === "negotiation" && (
                    <Button
                      size="sm"
                      onClick={() => transitionMutation.mutate({ documentId: selectedDocument.id, action: "submit_for_review" })}
                    >
                      Submit for Review
                    </Button>
                  )}
                  {selectedDocument.status === "review" && (
                    <>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => transitionMutation.mutate({ documentId: selectedDocument.id, action: "approve" })}
                        data-testid="action-approve"
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => transitionMutation.mutate({ documentId: selectedDocument.id, action: "send_back" })}
                      >
                        Send Back
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => transitionMutation.mutate({ documentId: selectedDocument.id, action: "reject" })}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  {selectedDocument.status === "approved" && (
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => transitionMutation.mutate({ documentId: selectedDocument.id, action: "sign" })}
                      data-testid="action-sign"
                    >
                      <LucideShield className="w-4 h-4 mr-2" />
                      Mark as Signed
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => transitionMutation.mutate({ documentId: selectedDocument.id, action: "archive" })}
                  >
                    Archive
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}