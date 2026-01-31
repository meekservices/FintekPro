import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingState } from "@/components/LoadingState";
import { 
  Building2, 
  FileText, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  IndianRupee,
  User,
  Phone,
  Mail,
  Briefcase,
  ArrowRight,
  Loader2,
  TrendingUp,
  Users,
  Plus,
  Search,
  Send,
  Trash2,
  Eye,
  MoreVertical,
  RefreshCw
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LoanProgressStepper, ProcessingTimeDisplay } from "@/components/loan/loan-progress-stepper";
import { DraftIndicator, RestorePrompt } from "@/components/loan/draft-indicator";
import { useFormAutosave } from "@/hooks/use-form-autosave";
import { LoanDocumentUpload, UploadedDocument } from "@/components/loan/document-upload";

const loanApplicationSchema = z.object({
  clientSource: z.enum(["existing", "new"]),
  existingClientId: z.string().optional(),
  loanType: z.enum(["personal", "home", "car", "business", "education", "gold", "lap"]),
  requestedAmount: z.string().min(1, "Amount is required"),
  requestedTenure: z.string().min(1, "Tenure is required"),
  applicantName: z.string().min(2, "Name is required"),
  applicantEmail: z.string().email("Valid email required").optional().or(z.literal("")),
  applicantPhone: z.string().regex(/^[6-9]\d{9}$/, "Valid 10-digit phone required"),
  dateOfBirth: z.string().optional(),
  applicantPan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format").optional().or(z.literal("")),
  employmentType: z.enum(["salaried", "self_employed", "business", "professional"]),
  monthlyIncome: z.string().min(1, "Monthly income required"),
  creditScore: z.string().optional(),
  routingMode: z.enum(["auto", "manual"]).default("auto"),
  routingStrategy: z.enum(["parallel", "waterfall", "priority_first"]).default("parallel"),
  targetBanks: z.array(z.string()).optional(),
  loanPurpose: z.string().optional(),
});

type LoanApplicationForm = z.infer<typeof loanApplicationSchema>;

interface ClientOption {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  pan?: string;
  type: 'client' | 'prospect';
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  submitted: "bg-blue-100 text-blue-800",
  eligibility_check: "bg-purple-100 text-purple-800",
  routed: "bg-indigo-100 text-indigo-800",
  pending_with_banks: "bg-yellow-100 text-yellow-800",
  in_review: "bg-orange-100 text-orange-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  disbursed: "bg-emerald-100 text-emerald-800",
};

const loanTypeLabels: Record<string, string> = {
  personal: "Personal Loan",
  home: "Home Loan",
  car: "Car Loan",
  business: "Business Loan",
  education: "Education Loan",
  gold: "Gold Loan",
  lap: "Loan Against Property",
};

interface Bank {
  id: string;
  bankCode: string;
  bankName: string;
  supportedLoanTypes: string[];
  isActive: boolean;
}

interface EligibilityResult {
  bankCode: string;
  bankName: string;
  eligible: boolean;
  reasons: string[];
  matchScore: number;
  estimatedRate?: number;
}

interface RoutingHistoryItem {
  id: string;
  bankCode: string;
  bankStatus: string;
  submittedAt: string;
  responseReceivedAt?: string;
  approvedAmount?: string;
  approvedTenure?: number;
  offeredInterestRate?: string;
  rejectionReason?: string;
}

const bankStatusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  in_review: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  query_raised: "bg-orange-100 text-orange-800",
};

export default function AgentLoanApplyPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("apply");
  const [clientSource, setClientSource] = useState<"existing" | "new">("new");
  const [searchQuery, setSearchQuery] = useState("");
  const [routeDialogOpen, setRouteDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [eligibilityDialogOpen, setEligibilityDialogOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
  const [eligibilityResults, setEligibilityResults] = useState<EligibilityResult[]>([]);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);

  const form = useForm<LoanApplicationForm>({
    resolver: zodResolver(loanApplicationSchema),
    defaultValues: {
      clientSource: "new",
      loanType: "personal",
      requestedAmount: "",
      requestedTenure: "36",
      applicantName: "",
      applicantEmail: "",
      applicantPhone: "",
      dateOfBirth: "",
      applicantPan: "",
      employmentType: "salaried",
      monthlyIncome: "",
      creditScore: "",
      routingMode: "auto",
      routingStrategy: "parallel",
      targetBanks: [],
      loanPurpose: "",
    },
  });

  const {
    showRestorePrompt,
    restoreDraft,
    discardDraft,
    clearDraft,
    formatLastSaved,
  } = useFormAutosave({
    form,
    storageKey: "fintekpro-agent-loan-draft",
    debounceMs: 1000,
    excludeFields: ["existingClientId"],
  });

  const { data: myClients, isLoading: loadingClients } = useQuery<ClientOption[]>({
    queryKey: ["/api/agent/clients-for-loan"],
    queryFn: async () => {
      const response = await fetch("/api/admin/marketing/audience/all?filter=all&consentOnly=false");
      if (!response.ok) return [];
      const data = await response.json();
      return data.map((c: any) => ({
        id: c.id,
        name: c.name,
        mobile: c.mobile,
        email: c.email,
        pan: c.pan,
        type: c.type
      }));
    }
  });

  const { data: myApplications, isLoading: loadingApplications, refetch: refetchApplications } = useQuery<any>({
    queryKey: ["/api/agent/loans/my-applications"],
  });

  const { data: banksData } = useQuery<{ success: boolean; data: Bank[] }>({
    queryKey: ["/api/dsa-loans/banks"],
  });

  const banks = banksData?.data || [];

  const { data: routingHistoryData, isLoading: loadingHistory } = useQuery<{ success: boolean; data: RoutingHistoryItem[] }>({
    queryKey: ["/api/dsa-loans/applications", selectedApp?.id, "routing-history"],
    enabled: detailsDialogOpen && !!selectedApp?.id,
  });

  const routingHistory = routingHistoryData?.data || [];

  const routeMutation = useMutation({
    mutationFn: async ({ applicationId, bankCodes }: { applicationId: string; bankCodes: string[] }) => {
      return apiRequest(`/api/dsa-loans/applications/${applicationId}/route`, {
        method: "POST",
        body: JSON.stringify({ bankCodes, strategy: "parallel" }),
      });
    },
    onSuccess: (_data, variables) => {
      toast({ title: "Banks Assigned", description: "Application has been routed to selected banks." });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/loans/my-applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/loans/applications", variables.applicationId, "routing-history"] });
      setRouteDialogOpen(false);
      setSelectedApp(null);
      setSelectedBanks([]);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to route application", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      return apiRequest(`/api/dsa-loans/applications/${applicationId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({ title: "Application Deleted", description: "The loan application has been deleted." });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/loans/my-applications"] });
      setDeleteDialogOpen(false);
      setSelectedApp(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete application", variant: "destructive" });
    },
  });

  const checkEligibilityMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      return apiRequest(`/api/dsa-loans/applications/${applicationId}/check-eligibility`, {
        method: "POST",
      });
    },
    onSuccess: (data: any) => {
      setEligibilityResults([...data.data.eligible, ...data.data.ineligible]);
      setEligibilityDialogOpen(true);
      queryClient.invalidateQueries({ queryKey: ["/api/agent/loans/my-applications"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to check eligibility", variant: "destructive" });
    },
  });

  const createApplicationMutation = useMutation({
    mutationFn: async (data: LoanApplicationForm) => {
      const payload = {
        clientMode: data.clientSource,
        clientId: data.existingClientId || undefined,
        applicantName: data.applicantName,
        applicantPhone: data.applicantPhone,
        applicantEmail: data.applicantEmail || undefined,
        applicantPan: data.applicantPan || undefined,
        dateOfBirth: data.dateOfBirth || undefined,
        loanType: data.loanType,
        requestedAmount: parseInt(data.requestedAmount),
        requestedTenure: parseInt(data.requestedTenure),
        employmentType: data.employmentType,
        monthlyIncome: parseInt(data.monthlyIncome),
        creditScore: data.creditScore ? parseInt(data.creditScore) : undefined,
        routingMode: data.routingMode,
        targetBanks: data.routingMode === "manual" ? data.targetBanks : undefined,
        loanPurpose: data.loanPurpose || undefined,
      };
      return apiRequest("/api/agent/loans/applications", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast({ title: "Loan Lead Submitted", description: "The loan application has been submitted for processing." });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/loans/my-applications"] });
      clearDraft();
      setUploadedDocuments([]);
      form.reset();
      setActiveTab("track");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to submit application", variant: "destructive" });
    },
  });

  const onSubmit = (data: LoanApplicationForm) => {
    createApplicationMutation.mutate(data);
  };

  const handleClientSelect = (clientId: string) => {
    const client = myClients?.find(c => c.id === clientId);
    if (client) {
      form.setValue("existingClientId", clientId);
      form.setValue("applicantName", client.name);
      form.setValue("applicantPhone", client.mobile);
      if (client.email) form.setValue("applicantEmail", client.email);
      if (client.pan) form.setValue("applicantPan", client.pan);
    }
  };

  const filteredClients = myClients?.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.mobile.includes(searchQuery)
  ) || [];

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseInt(amount) : amount;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const applications = myApplications?.data || [];

  const openRouteDialog = (app: any) => {
    setSelectedApp(app);
    setSelectedBanks(app.routedBanks || []);
    setRouteDialogOpen(true);
  };

  const openDeleteDialog = (app: any) => {
    setSelectedApp(app);
    setDeleteDialogOpen(true);
  };

  const openDetailsDialog = (app: any) => {
    setSelectedApp(app);
    setDetailsDialogOpen(true);
  };

  const handleBankToggle = (bankCode: string) => {
    setSelectedBanks(prev => 
      prev.includes(bankCode)
        ? prev.filter(b => b !== bankCode)
        : [...prev, bankCode]
    );
  };

  const handleRouteSubmit = () => {
    if (selectedApp && selectedBanks.length > 0) {
      routeMutation.mutate({
        applicationId: selectedApp.id,
        bankCodes: selectedBanks,
      });
    }
  };

  const handleDeleteConfirm = () => {
    if (selectedApp) {
      deleteMutation.mutate(selectedApp.id);
    }
  };

  const handleCheckEligibility = (app: any) => {
    setSelectedApp(app);
    checkEligibilityMutation.mutate(app.id);
  };

  const getEligibleBanks = (loanType: string) => {
    return banks.filter(b => 
      b.isActive && (b.supportedLoanTypes || []).includes(loanType)
    );
  };

  const canEdit = (status: string) => ['draft', 'submitted', 'eligibility_check'].includes(status);
  const canDelete = (status: string) => ['draft', 'submitted'].includes(status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Loan Lead Submission</h1>
          <p className="text-muted-foreground">Submit loan applications for your clients</p>
        </div>
        <Badge variant="outline" className="text-sm">
          <TrendingUp className="h-4 w-4 mr-1" />
          DSA Portal
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="apply" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Submit New Lead
          </TabsTrigger>
          <TabsTrigger value="track" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            My Submissions ({applications.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="apply">
          {showRestorePrompt && (
            <RestorePrompt onRestore={restoreDraft} onDiscard={discardDraft} />
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Client Selection
                    </CardTitle>
                    <DraftIndicator lastSaved={formatLastSaved()} />
                  </div>
                  <CardDescription>Select an existing client or enter new lead details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="clientSource"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <RadioGroup
                            onValueChange={(value) => {
                              field.onChange(value);
                              setClientSource(value as "existing" | "new");
                              if (value === "new") {
                                form.setValue("applicantName", "");
                                form.setValue("applicantPhone", "");
                                form.setValue("applicantEmail", "");
                                form.setValue("applicantPan", "");
                              }
                            }}
                            value={field.value}
                            className="flex gap-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="new" id="new" />
                              <Label htmlFor="new">New Lead</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="existing" id="existing" />
                              <Label htmlFor="existing">Existing Client/Prospect</Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {clientSource === "existing" && (
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by name or phone..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      {loadingClients ? (
                        <div className="text-center py-4 text-muted-foreground">Loading clients...</div>
                      ) : filteredClients.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">No clients found</div>
                      ) : (
                        <div className="max-h-48 overflow-y-auto space-y-2 border rounded-md p-2">
                          {filteredClients.slice(0, 10).map((client) => (
                            <div
                              key={client.id}
                              className={`p-3 rounded-md cursor-pointer hover:bg-muted transition-colors ${
                                form.watch("existingClientId") === client.id ? "bg-primary/10 border-primary border" : "border"
                              }`}
                              onClick={() => handleClientSelect(client.id)}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium">{client.name}</div>
                                  <div className="text-sm text-muted-foreground">{client.mobile}</div>
                                </div>
                                <Badge variant="outline" className="text-xs capitalize">{client.type}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Applicant Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="applicantName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter full name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="applicantPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mobile Number *</FormLabel>
                        <FormControl>
                          <Input placeholder="10-digit mobile" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="applicantEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="email@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="applicantPan"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PAN Number</FormLabel>
                        <FormControl>
                          <Input placeholder="ABCDE1234F" {...field} className="uppercase" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="employmentType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employment Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select employment type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="salaried">Salaried</SelectItem>
                            <SelectItem value="self_employed">Self Employed</SelectItem>
                            <SelectItem value="business">Business Owner</SelectItem>
                            <SelectItem value="professional">Professional</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="monthlyIncome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monthly Income (₹) *</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="50000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="creditScore"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Credit Score (if known)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="750" min="300" max="900" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IndianRupee className="h-5 w-5" />
                    Loan Requirements
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="loanType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Loan Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select loan type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="personal">Personal Loan</SelectItem>
                            <SelectItem value="home">Home Loan</SelectItem>
                            <SelectItem value="car">Car Loan</SelectItem>
                            <SelectItem value="business">Business Loan</SelectItem>
                            <SelectItem value="education">Education Loan</SelectItem>
                            <SelectItem value="gold">Gold Loan</SelectItem>
                            <SelectItem value="lap">Loan Against Property</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                        <ProcessingTimeDisplay loanType={field.value} className="mt-2" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="requestedAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Loan Amount (₹) *</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="500000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="requestedTenure"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tenure (months) *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select tenure" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="12">12 months</SelectItem>
                            <SelectItem value="24">24 months</SelectItem>
                            <SelectItem value="36">36 months</SelectItem>
                            <SelectItem value="48">48 months</SelectItem>
                            <SelectItem value="60">60 months</SelectItem>
                            <SelectItem value="84">84 months</SelectItem>
                            <SelectItem value="120">120 months</SelectItem>
                            <SelectItem value="180">180 months (Home)</SelectItem>
                            <SelectItem value="240">240 months (Home)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="routingMode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bank Selection Mode</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select mode" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="auto">Auto (System selects banks)</SelectItem>
                            <SelectItem value="manual">Manual (Choose banks)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {form.watch("routingMode") === "auto" && (
                    <FormField
                      control={form.control}
                      name="routingStrategy"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Routing Strategy</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select routing" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="parallel">Parallel (All eligible banks)</SelectItem>
                              <SelectItem value="waterfall">Waterfall (One by one)</SelectItem>
                              <SelectItem value="priority_first">Priority First</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  {form.watch("routingMode") === "manual" && (
                    <div className="md:col-span-2">
                      <Label className="text-sm font-medium">Select Target Banks *</Label>
                      <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-3">
                        {banks.filter(b => b.isActive && b.supportedLoanTypes?.includes(form.watch("loanType"))).map((bank) => (
                          <label 
                            key={bank.bankCode} 
                            className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                              form.watch("targetBanks")?.includes(bank.bankCode) 
                                ? "bg-primary/10 border-primary" 
                                : "hover:bg-muted"
                            }`}
                          >
                            <Checkbox
                              checked={form.watch("targetBanks")?.includes(bank.bankCode)}
                              onCheckedChange={(checked) => {
                                const current = form.getValues("targetBanks") || [];
                                if (checked) {
                                  form.setValue("targetBanks", [...current, bank.bankCode]);
                                } else {
                                  form.setValue("targetBanks", current.filter(b => b !== bank.bankCode));
                                }
                              }}
                            />
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">{bank.bankName}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                      {banks.filter(b => b.isActive && b.supportedLoanTypes?.includes(form.watch("loanType"))).length === 0 && (
                        <p className="text-sm text-muted-foreground mt-2">No banks available for this loan type</p>
                      )}
                      {form.watch("targetBanks")?.length === 0 && form.watch("routingMode") === "manual" && (
                        <p className="text-sm text-destructive mt-2">Please select at least one bank</p>
                      )}
                    </div>
                  )}
                  <FormField
                    control={form.control}
                    name="loanPurpose"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Purpose of Loan</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Home renovation, Medical expenses, Business expansion" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <LoanDocumentUpload
                loanType={form.watch("loanType")}
                documents={uploadedDocuments}
                onDocumentsChange={setUploadedDocuments}
              />

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => form.reset()}>
                  Reset Form
                </Button>
                <Button type="submit" disabled={createApplicationMutation.isPending}>
                  {createApplicationMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Submit Loan Lead
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </TabsContent>

        <TabsContent value="track">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  My Loan Submissions
                </CardTitle>
                <CardDescription>Track the status of loan applications you've submitted</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetchApplications()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {loadingApplications ? (
                <LoadingState variant="list" count={3} />
              ) : applications.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No loan applications submitted yet</p>
                  <Button variant="link" onClick={() => setActiveTab("apply")}>
                    Submit your first loan lead
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {applications.map((app: any) => (
                    <div key={app.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{app.applicantName}</span>
                            <Badge variant="outline" className="text-xs">
                              {app.applicationNumber || app.id.slice(0, 8)}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {app.applicantPhone}
                            </span>
                            <span>{loanTypeLabels[app.loanType] || app.loanType}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={statusColors[app.status] || "bg-gray-100"}>
                            {app.status?.replace(/_/g, " ")}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openDetailsDialog(app)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              {canEdit(app.status) && (
                                <>
                                  <DropdownMenuItem 
                                    onClick={() => handleCheckEligibility(app)}
                                    disabled={checkEligibilityMutation.isPending}
                                  >
                                    {checkEligibilityMutation.isPending && selectedApp?.id === app.id ? (
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="h-4 w-4 mr-2" />
                                    )}
                                    {checkEligibilityMutation.isPending && selectedApp?.id === app.id ? "Checking..." : "Check Bank Eligibility"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openRouteDialog(app)}>
                                    <Send className="h-4 w-4 mr-2" />
                                    Assign Banks
                                  </DropdownMenuItem>
                                </>
                              )}
                              {canDelete(app.status) && (
                                <DropdownMenuItem 
                                  onClick={() => openDeleteDialog(app)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <Separator className="my-3" />
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Amount</span>
                          <div className="font-medium">{formatCurrency(app.requestedAmount)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Tenure</span>
                          <div className="font-medium">{app.requestedTenure} months</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Banks Routed</span>
                          <div className="font-medium">{app.routedBanks?.length || 0}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Submitted</span>
                          <div className="font-medium">{formatDate(app.createdAt)}</div>
                        </div>
                        <div className="flex items-end gap-2">
                          {canEdit(app.status) && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => openRouteDialog(app)}
                            >
                              <Send className="h-3 w-3 mr-1" />
                              Assign Banks
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs text-muted-foreground mb-3">Application Progress</p>
                        <LoanProgressStepper status={app.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={routeDialogOpen} onOpenChange={setRouteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Banks</DialogTitle>
            <DialogDescription>
              Select banks to route this loan application to
            </DialogDescription>
          </DialogHeader>
          {selectedApp && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedApp.applicantName}</p>
                <p className="text-sm text-muted-foreground">
                  {loanTypeLabels[selectedApp.loanType]} - {formatCurrency(selectedApp.requestedAmount)}
                </p>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm font-medium">Select Banks ({selectedBanks.length} selected)</p>
                <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-2">
                  {getEligibleBanks(selectedApp.loanType).map(bank => (
                    <div 
                      key={bank.bankCode}
                      className="flex items-center space-x-3 p-2 hover:bg-muted rounded-md cursor-pointer"
                      onClick={() => handleBankToggle(bank.bankCode)}
                    >
                      <Checkbox 
                        checked={selectedBanks.includes(bank.bankCode)}
                        onCheckedChange={() => handleBankToggle(bank.bankCode)}
                      />
                      <div className="flex-1">
                        <p className="font-medium">{bank.bankName}</p>
                        <p className="text-xs text-muted-foreground">{bank.bankCode}</p>
                      </div>
                    </div>
                  ))}
                  {getEligibleBanks(selectedApp.loanType).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No banks available for this loan type
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRouteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRouteSubmit}
              disabled={selectedBanks.length === 0 || routeMutation.isPending}
            >
              {routeMutation.isPending ? "Routing..." : `Route to ${selectedBanks.length} Bank(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Application</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this loan application? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedApp && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{selectedApp.applicantName}</p>
              <p className="text-sm text-muted-foreground">
                {selectedApp.applicationNumber} - {loanTypeLabels[selectedApp.loanType]}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Application Details</DialogTitle>
            <DialogDescription>
              View complete details of this loan application
            </DialogDescription>
          </DialogHeader>
          {selectedApp && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Application Number</p>
                  <p className="font-medium">{selectedApp.applicationNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={statusColors[selectedApp.status]}>
                    {selectedApp.status?.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Applicant Name</p>
                  <p className="font-medium">{selectedApp.applicantName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{selectedApp.applicantPhone}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Loan Type</p>
                  <p className="font-medium">{loanTypeLabels[selectedApp.loanType]}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="font-medium">{formatCurrency(selectedApp.requestedAmount)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tenure</p>
                  <p className="font-medium">{selectedApp.requestedTenure} months</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Income</p>
                  <p className="font-medium">{formatCurrency(selectedApp.monthlyIncome || 0)}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Bank Routing Status</p>
                {loadingHistory ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading bank responses...
                  </div>
                ) : routingHistory.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {routingHistory.map((history) => (
                      <div 
                        key={history.id}
                        className={`p-3 rounded-lg border ${
                          history.bankStatus === 'approved' ? 'bg-green-50 border-green-200' :
                          history.bankStatus === 'rejected' ? 'bg-red-50 border-red-200' :
                          history.bankStatus === 'in_review' ? 'bg-blue-50 border-blue-200' :
                          'bg-yellow-50 border-yellow-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{history.bankCode}</span>
                          <Badge className={bankStatusColors[history.bankStatus] || "bg-gray-100"}>
                            {history.bankStatus?.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Submitted: {formatDate(history.submittedAt)}
                          {history.responseReceivedAt && (
                            <span> | Response: {formatDate(history.responseReceivedAt)}</span>
                          )}
                        </div>
                        {history.bankStatus === 'approved' && history.offeredInterestRate && (
                          <div className="mt-1 text-xs">
                            <span className="text-green-700">
                              Rate: {history.offeredInterestRate}% p.a.
                              {history.approvedAmount && ` | Amount: ${formatCurrency(history.approvedAmount)}`}
                            </span>
                          </div>
                        )}
                        {history.bankStatus === 'rejected' && history.rejectionReason && (
                          <div className="mt-1 text-xs text-red-700">
                            Reason: {history.rejectionReason}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (selectedApp.routedBanks || []).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedApp.routedBanks.map((bank: string) => (
                      <Badge key={bank} variant="outline">{bank}</Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No banks routed yet</p>
                )}
              </div>
              {selectedApp.loanPurpose && (
                <div>
                  <p className="text-sm text-muted-foreground">Purpose</p>
                  <p className="font-medium">{selectedApp.loanPurpose}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
              Close
            </Button>
            {selectedApp && canEdit(selectedApp.status) && (
              <Button onClick={() => {
                setDetailsDialogOpen(false);
                openRouteDialog(selectedApp);
              }}>
                <Send className="h-4 w-4 mr-2" />
                Assign Banks
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={eligibilityDialogOpen} onOpenChange={setEligibilityDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bank Eligibility Results</DialogTitle>
            <DialogDescription>
              Based on the applicant's profile, here are the eligible banks
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {eligibilityResults.map(result => (
              <div 
                key={result.bankCode}
                className={`p-3 rounded-lg border ${result.eligible ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {result.eligible ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span className="font-medium">{result.bankName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={result.eligible ? "default" : "secondary"}>
                      Score: {result.matchScore}%
                    </Badge>
                    {result.estimatedRate && (
                      <Badge variant="outline">
                        {result.estimatedRate}% p.a.
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {result.reasons.join(", ")}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEligibilityDialogOpen(false)}>
              Close
            </Button>
            {selectedApp && eligibilityResults.filter(r => r.eligible).length > 0 && (
              <Button onClick={() => {
                setEligibilityDialogOpen(false);
                setSelectedBanks(eligibilityResults.filter(r => r.eligible).map(r => r.bankCode));
                setRouteDialogOpen(true);
              }}>
                <Send className="h-4 w-4 mr-2" />
                Route to Eligible Banks
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
