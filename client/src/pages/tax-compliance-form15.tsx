import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  FileText, Plus, Eye, CheckCircle2, Clock, AlertTriangle, 
  Upload, Download, Send, ArrowRight, LucideShield as LucideShield, User, Building2,
  Globe, FileCheck, Stamp, History, ChevronRight, Loader2
} from "lucide-react";

// Status colors and labels
const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: FileText },
  pending_documents: { label: "Pending Documents", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300", icon: Upload },
  pending_ca_review: { label: "Pending CA Review", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300", icon: Clock },
  ca_reviewing: { label: "CA Reviewing", color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300", icon: Eye },
  sent_back_to_agent: { label: "Sent Back", color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300", icon: AlertTriangle },
  approved: { label: "CA Approved", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300", icon: CheckCircle2 },
  "15cb_signed": { label: "15CB Signed", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300", icon: Stamp },
  "15ca_filed": { label: "15CA Filed", color: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300", icon: FileCheck },
  everified: { label: "E-Verified", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300", icon: LucideShield },
  completed: { label: "Completed", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300", icon: CheckCircle2 },
};

// RBI Purpose Codes
const rbiPurposeCodes = [
  { code: "S0301", description: "Royalty and technical fees" },
  { code: "S0302", description: "Dividend income" },
  { code: "S0303", description: "Interest income" },
  { code: "S0304", description: "Commission and brokerage" },
  { code: "S0305", description: "Legal services" },
  { code: "S0306", description: "Accounting, auditing, bookkeeping" },
  { code: "S0307", description: "Business and management consultancy" },
  { code: "S1301", description: "Maintenance of close relatives abroad" },
  { code: "S1302", description: "Education expenses" },
  { code: "S1303", description: "Medical treatment abroad" },
  { code: "S1304", description: "Gift remittances" },
  { code: "S0101", description: "Trade credits for goods" },
  { code: "S0102", description: "Advance payment for import of goods" },
  { code: "S0103", description: "Import payments" },
];

const natureOfPayments = [
  { value: "royalty", label: "Royalty" },
  { value: "technical_fees", label: "Technical / Professional Fees" },
  { value: "dividend", label: "Dividend" },
  { value: "interest", label: "Interest" },
  { value: "commission", label: "Commission / Brokerage" },
  { value: "consultancy", label: "Consultancy Services" },
  { value: "education", label: "Education Expenses" },
  { value: "medical", label: "Medical Treatment" },
  { value: "gift", label: "Gift to Relatives" },
  { value: "import_payment", label: "Import Payment" },
  { value: "other", label: "Other" },
];

const countries = [
  "United States", "United Kingdom", "Singapore", "UAE", "Germany", "France", 
  "Australia", "Canada", "Japan", "Hong Kong", "Switzerland", "Netherlands"
];

const currencies = ["USD", "GBP", "EUR", "SGD", "AED", "AUD", "CAD", "JPY", "CHF", "HKD"];

export default function TaxComplianceForm15Page() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("cases");

  // Form state for new case
  const [formData, setFormData] = useState({
    clientPan: "",
    clientName: "",
    clientResidentialStatus: "resident",
    clientAddress: "",
    clientEmail: "",
    clientPhone: "",
    remittanceAmount: "",
    remittanceCurrency: "USD",
    beneficiaryName: "",
    beneficiaryCountry: "",
    beneficiaryAddress: "",
    rbiPurposeCode: "",
    rbiPurposeDescription: "",
    natureOfPayment: "",
    dtaaApplicable: false,
    dtaaCountry: "",
    trcAvailable: false,
  });

  // Fetch cases
  const { data: cases, isLoading: casesLoading, refetch: refetchCases } = useQuery<any[]>({
    queryKey: ["/api/tax-compliance/form15/cases"],
  });

  // Fetch stats
  const { data: stats } = useQuery<any>({
    queryKey: ["/api/tax-compliance/form15/stats"],
  });

  // Create case mutation
  const createCaseMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/tax-compliance/form15/cases", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: (data: any) => {
      toast({ title: "Success", description: `Case ${data.case_number} created successfully` });
      queryClient.invalidateQueries({ queryKey: ["/api/tax-compliance/form15/cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tax-compliance/form15/stats"] });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create case", variant: "destructive" });
    },
  });

  // Submit for review mutation
  const submitForReviewMutation = useMutation({
    mutationFn: async (caseId: string) => {
      return apiRequest(`/api/tax-compliance/form15/cases/${caseId}/submit-for-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      toast({ title: "Submitted", description: "Case submitted for CA review" });
      refetchCases();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit for review", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      clientPan: "",
      clientName: "",
      clientResidentialStatus: "resident",
      clientAddress: "",
      clientEmail: "",
      clientPhone: "",
      remittanceAmount: "",
      remittanceCurrency: "USD",
      beneficiaryName: "",
      beneficiaryCountry: "",
      beneficiaryAddress: "",
      rbiPurposeCode: "",
      rbiPurposeDescription: "",
      natureOfPayment: "",
      dtaaApplicable: false,
      dtaaCountry: "",
      trcAvailable: false,
    });
  };

  const formatCurrency = (value: number | string, currency: string = "INR") => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num || 0);
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.draft;
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getCaseProgress = (status: string) => {
    const stages = ["draft", "pending_ca_review", "ca_reviewing", "approved", "15cb_signed", "15ca_filed", "completed"];
    const currentIndex = stages.indexOf(status);
    return ((currentIndex + 1) / stages.length) * 100;
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Form 15CA / 15CB</h1>
          <p className="text-muted-foreground">International Remittance Tax Compliance</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-case">
              <Plus className="h-4 w-4 mr-2" />
              New Case
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Form 15CA/15CB Case</DialogTitle>
              <DialogDescription>Enter remittance details for tax compliance certification</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Client Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>PAN Number *</Label>
                    <Input
                      placeholder="ABCDE1234F"
                      value={formData.clientPan}
                      onChange={(e) => setFormData({ ...formData, clientPan: e.target.value.toUpperCase() })}
                      maxLength={10}
                      data-testid="input-client-pan"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Full Name *</Label>
                    <Input
                      placeholder="As per PAN"
                      value={formData.clientName}
                      onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                      data-testid="input-client-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Residential Status</Label>
                    <Select
                      value={formData.clientResidentialStatus}
                      onValueChange={(v) => setFormData({ ...formData, clientResidentialStatus: v })}
                    >
                      <SelectTrigger data-testid="select-residential-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="resident">Resident</SelectItem>
                        <SelectItem value="non_resident">Non-Resident</SelectItem>
                        <SelectItem value="not_ordinarily_resident">Not Ordinarily Resident</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      value={formData.clientEmail}
                      onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                      data-testid="input-client-email"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Remittance Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Amount *</Label>
                    <Input
                      type="number"
                      placeholder="10000"
                      value={formData.remittanceAmount}
                      onChange={(e) => setFormData({ ...formData, remittanceAmount: e.target.value })}
                      data-testid="input-remittance-amount"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select
                      value={formData.remittanceCurrency}
                      onValueChange={(v) => setFormData({ ...formData, remittanceCurrency: v })}
                    >
                      <SelectTrigger data-testid="select-currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Beneficiary Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Beneficiary Name *</Label>
                    <Input
                      placeholder="Beneficiary company/person name"
                      value={formData.beneficiaryName}
                      onChange={(e) => setFormData({ ...formData, beneficiaryName: e.target.value })}
                      data-testid="input-beneficiary-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Country *</Label>
                    <Select
                      value={formData.beneficiaryCountry}
                      onValueChange={(v) => setFormData({ ...formData, beneficiaryCountry: v })}
                    >
                      <SelectTrigger data-testid="select-beneficiary-country">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {countries.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  RBI Purpose & Nature of Payment
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>RBI Purpose Code *</Label>
                    <Select
                      value={formData.rbiPurposeCode}
                      onValueChange={(v) => {
                        const purpose = rbiPurposeCodes.find((p) => p.code === v);
                        setFormData({
                          ...formData,
                          rbiPurposeCode: v,
                          rbiPurposeDescription: purpose?.description || "",
                        });
                      }}
                    >
                      <SelectTrigger data-testid="select-rbi-purpose">
                        <SelectValue placeholder="Select purpose code" />
                      </SelectTrigger>
                      <SelectContent>
                        {rbiPurposeCodes.map((p) => (
                          <SelectItem key={p.code} value={p.code}>
                            {p.code} - {p.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nature of Payment *</Label>
                    <Select
                      value={formData.natureOfPayment}
                      onValueChange={(v) => setFormData({ ...formData, natureOfPayment: v })}
                    >
                      <SelectTrigger data-testid="select-nature-payment">
                        <SelectValue placeholder="Select nature" />
                      </SelectTrigger>
                      <SelectContent>
                        {natureOfPayments.map((n) => (
                          <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <LucideShield className="h-4 w-4" />
                  DTAA Details
                </h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="dtaa"
                      checked={formData.dtaaApplicable}
                      onCheckedChange={(v) => setFormData({ ...formData, dtaaApplicable: !!v })}
                      data-testid="checkbox-dtaa"
                    />
                    <Label htmlFor="dtaa">DTAA Applicable</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="trc"
                      checked={formData.trcAvailable}
                      onCheckedChange={(v) => setFormData({ ...formData, trcAvailable: !!v })}
                      data-testid="checkbox-trc"
                    />
                    <Label htmlFor="trc">TRC Available</Label>
                  </div>
                </div>
                {formData.dtaaApplicable && (
                  <div className="space-y-2">
                    <Label>DTAA Country</Label>
                    <Select
                      value={formData.dtaaCountry}
                      onValueChange={(v) => setFormData({ ...formData, dtaaCountry: v })}
                    >
                      <SelectTrigger data-testid="select-dtaa-country">
                        <SelectValue placeholder="Select DTAA country" />
                      </SelectTrigger>
                      <SelectContent>
                        {countries.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button
                onClick={() => createCaseMutation.mutate(formData)}
                disabled={createCaseMutation.isPending || !formData.clientPan || !formData.clientName || !formData.remittanceAmount || !formData.beneficiaryName || !formData.beneficiaryCountry || !formData.rbiPurposeCode || !formData.natureOfPayment}
                data-testid="button-create-case"
              >
                {createCaseMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Create Case
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_cases || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Draft</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{stats?.draft || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats?.pending_review || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600">{stats?.approved || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">15CB Signed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{stats?.cb_signed || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.completed || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="cases" data-testid="tab-cases">
            <FileText className="h-4 w-4 mr-2" />
            Cases
          </TabsTrigger>
          <TabsTrigger value="pending-review" data-testid="tab-pending">
            <Clock className="h-4 w-4 mr-2" />
            Pending Review
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Completed
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cases" className="mt-4">
          {casesLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !cases || cases.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No Cases Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start by creating a new Form 15CA/15CB case for international remittance
                </p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Case
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {cases.map((c: any) => (
                <Card key={c.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono text-sm text-muted-foreground">{c.case_number}</span>
                          {getStatusBadge(c.status)}
                          {c.form_15cb_required && (
                            <Badge variant="outline" className="text-xs">15CB Required</Badge>
                          )}
                          <Badge variant="outline" className="text-xs">Part {c.form_15ca_part}</Badge>
                        </div>
                        <h3 className="font-semibold text-lg">{c.client_name}</h3>
                        <p className="text-sm text-muted-foreground">PAN: {c.client_pan}</p>
                        <div className="flex items-center gap-6 mt-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">Amount: </span>
                            <span className="font-medium">{formatCurrency(c.remittance_amount, c.remittance_currency)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">To: </span>
                            <span className="font-medium">{c.beneficiary_country}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Purpose: </span>
                            <span className="font-medium">{c.rbi_purpose_code}</span>
                          </div>
                        </div>
                        <Progress value={getCaseProgress(c.status)} className="h-1 mt-4" />
                      </div>
                      <div className="flex gap-2 ml-4">
                        {c.status === "draft" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => submitForReviewMutation.mutate(c.id)}
                            disabled={submitForReviewMutation.isPending}
                            data-testid={`button-submit-${c.id}`}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Submit for Review
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedCase(c)}
                          data-testid={`button-view-${c.id}`}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pending-review" className="mt-4">
          {cases?.filter((c: any) => ["pending_ca_review", "ca_reviewing"].includes(c.status)).length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No Pending Reviews</h3>
                <p className="text-muted-foreground">All cases have been reviewed</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {cases?.filter((c: any) => ["pending_ca_review", "ca_reviewing"].includes(c.status)).map((c: any) => (
                <Card key={c.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm">{c.case_number}</span>
                          {getStatusBadge(c.status)}
                        </div>
                        <h3 className="font-medium">{c.client_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(c.remittance_amount, c.remittance_currency)} to {c.beneficiary_country}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setSelectedCase(c)}>
                        <Eye className="h-3 w-3 mr-1" />
                        Review
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {cases?.filter((c: any) => c.status === "completed").length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No Completed Cases</h3>
                <p className="text-muted-foreground">Completed cases will appear here</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {cases?.filter((c: any) => c.status === "completed").map((c: any) => (
                <Card key={c.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm">{c.case_number}</span>
                          {getStatusBadge(c.status)}
                        </div>
                        <h3 className="font-medium">{c.client_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          15CB: {c.form_15cb_number || "N/A"} | 15CA: {c.form_15ca_acknowledgement_number || "N/A"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Download className="h-3 w-3 mr-1" />
                          Compliance Pack
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedCase(c)}>
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Case Detail Dialog */}
      <Dialog open={!!selectedCase} onOpenChange={() => setSelectedCase(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Case: {selectedCase?.case_number}
              {selectedCase && getStatusBadge(selectedCase.status)}
            </DialogTitle>
            <DialogDescription>
              {selectedCase?.client_name} - {selectedCase?.beneficiary_country}
            </DialogDescription>
          </DialogHeader>
          {selectedCase && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Client Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span className="font-medium">{selectedCase.client_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">PAN:</span>
                      <span className="font-medium">{selectedCase.client_pan}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <span className="font-medium capitalize">{selectedCase.client_residential_status?.replace(/_/g, " ")}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-3">Remittance Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount:</span>
                      <span className="font-medium">{formatCurrency(selectedCase.remittance_amount, selectedCase.remittance_currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Beneficiary:</span>
                      <span className="font-medium">{selectedCase.beneficiary_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Country:</span>
                      <span className="font-medium">{selectedCase.beneficiary_country}</span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-3">Rule 37BB Determination</h4>
                <div className="grid grid-cols-3 gap-4">
                  <Card className="bg-muted/50">
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-muted-foreground">Form 15CA</p>
                      <p className="font-bold text-lg">{selectedCase.form_15ca_required ? "Required" : "Not Required"}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-muted-foreground">Part</p>
                      <p className="font-bold text-lg">{selectedCase.form_15ca_part || "N/A"}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-muted-foreground">Form 15CB</p>
                      <p className="font-bold text-lg">{selectedCase.form_15cb_required ? "Required" : "Not Required"}</p>
                    </CardContent>
                  </Card>
                </div>
                {selectedCase.rule_37bb_justification && (
                  <p className="text-sm text-muted-foreground mt-3">{selectedCase.rule_37bb_justification}</p>
                )}
              </div>

              {selectedCase.form_15cb_number && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-3">Form 15CB Certificate</h4>
                    <div className="flex items-center gap-4 p-4 bg-emerald-50 dark:bg-emerald-950 rounded-lg">
                      <Stamp className="h-8 w-8 text-emerald-600" />
                      <div>
                        <p className="font-medium">Certificate No: {selectedCase.form_15cb_number}</p>
                        <p className="text-sm text-muted-foreground">
                          Signed by ICAI: {selectedCase.form_15cb_signed_by_icai}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {selectedCase.form_15ca_acknowledgement_number && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-3">Form 15CA Filing</h4>
                    <div className="flex items-center gap-4 p-4 bg-teal-50 dark:bg-teal-950 rounded-lg">
                      <FileCheck className="h-8 w-8 text-teal-600" />
                      <div>
                        <p className="font-medium">Acknowledgement: {selectedCase.form_15ca_acknowledgement_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedCase.form_15ca_everified ? "E-Verified" : "Pending E-Verification"}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedCase(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disclaimer */}
      <Card className="mt-6 border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-200">Important Disclaimer</p>
              <p className="text-amber-700 dark:text-amber-300">
                Form 15CB certification is issued by a Chartered Accountant. FintekPro acts as a facilitation platform only. 
                The CA assumes full legal responsibility for the certification. All filings are subject to Income Tax Department verification.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
