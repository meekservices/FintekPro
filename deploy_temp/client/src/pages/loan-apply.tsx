import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Building2, 
  FileText, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Upload,
  IndianRupee,
  Calendar,
  User,
  Phone,
  Mail,
  Briefcase,
  CreditCard,
  ArrowRight,
  Building,
  Loader2,
  TrendingUp
} from "lucide-react";
import { LoanProgressStepper, ProcessingTimeDisplay } from "@/components/loan/loan-progress-stepper";
import { DraftIndicator, RestorePrompt } from "@/components/loan/draft-indicator";
import { useFormAutosave } from "@/hooks/use-form-autosave";
import { LoanDocumentUpload, UploadedDocument } from "@/components/loan/document-upload";

const loanApplicationSchema = z.object({
  loanType: z.enum(["personal", "home", "car", "business"]),
  requestedAmount: z.string().min(1, "Amount is required"),
  requestedTenure: z.string().min(1, "Tenure is required"),
  applicantName: z.string().min(2, "Name is required"),
  applicantEmail: z.string().email("Valid email required"),
  applicantPhone: z.string().regex(/^[6-9]\d{9}$/, "Valid 10-digit phone required"),
  dateOfBirth: z.string().min(1, "Date of birth required"),
  applicantPan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format"),
  employmentType: z.enum(["salaried", "self_employed", "business"]),
  monthlyIncome: z.string().min(1, "Monthly income required"),
  creditScore: z.string().optional(),
  routingStrategy: z.enum(["parallel", "waterfall", "priority_first"]).default("parallel"),
});

type LoanApplicationForm = z.infer<typeof loanApplicationSchema>;

const statusColors: Record<string, string> = {
  draft: "bg-muted text-foreground",
  submitted: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
  eligibility_check: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200",
  routed: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200",
  pending_with_banks: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
  in_review: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200",
  approved: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
  rejected: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
  disbursed: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200",
};

const statusIcons: Record<string, any> = {
  draft: FileText,
  submitted: Clock,
  eligibility_check: AlertCircle,
  routed: ArrowRight,
  pending_with_banks: Building,
  in_review: Loader2,
  approved: CheckCircle2,
  rejected: XCircle,
  disbursed: CheckCircle2,
};

export default function LoanApplyPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("apply");
  const [selectedApplication, setSelectedApplication] = useState<string | null>(null);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);

  const form = useForm<LoanApplicationForm>({
    resolver: zodResolver(loanApplicationSchema),
    defaultValues: {
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
      routingStrategy: "parallel",
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
    storageKey: "fintekpro-loan-application-draft",
    debounceMs: 1000,
  });

  const { data: myApplications, isLoading: loadingApplications } = useQuery<any[]>({
    queryKey: ["/api/dsa-loans/my-applications"],
  });

  const createApplicationMutation = useMutation({
    mutationFn: async (data: LoanApplicationForm) => {
      const payload = {
        ...data,
        requestedAmount: parseInt(data.requestedAmount),
        requestedTenure: parseInt(data.requestedTenure),
        monthlyIncome: parseInt(data.monthlyIncome),
        creditScore: data.creditScore ? parseInt(data.creditScore) : undefined,
      };
      return apiRequest("/api/dsa-loans/applications", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast({ title: "Application Submitted", description: "Your loan application has been submitted for processing." });
      queryClient.invalidateQueries({ queryKey: ["/api/dsa-loans/my-applications"] });
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-background dark:to-card">
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Multi-Bank Loan Application
          </h1>
          <p className="text-muted-foreground">
            Apply once, get offers from multiple partner banks instantly
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="apply" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Apply for Loan
            </TabsTrigger>
            <TabsTrigger value="track" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Track Applications
            </TabsTrigger>
          </TabsList>

          <TabsContent value="apply">
            {showRestorePrompt && (
              <RestorePrompt onRestore={restoreDraft} onDiscard={discardDraft} />
            )}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-blue-600" />
                        Loan Application Form
                      </CardTitle>
                      <DraftIndicator lastSaved={formatLastSaved()} />
                    </div>
                    <CardDescription>
                      Fill in your details to check eligibility across 7+ partner banks
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="loanType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Loan Type</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                                <FormLabel>Loan Amount (₹)</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <IndianRupee className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input {...field} type="number" placeholder="500000" className="pl-10" />
                                  </div>
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
                                <FormLabel>Tenure (Months)</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select tenure" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="12">12 Months</SelectItem>
                                    <SelectItem value="24">24 Months</SelectItem>
                                    <SelectItem value="36">36 Months</SelectItem>
                                    <SelectItem value="48">48 Months</SelectItem>
                                    <SelectItem value="60">60 Months</SelectItem>
                                    <SelectItem value="84">84 Months</SelectItem>
                                    <SelectItem value="120">120 Months</SelectItem>
                                    <SelectItem value="180">180 Months</SelectItem>
                                    <SelectItem value="240">240 Months</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="routingStrategy"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Application Strategy</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select strategy" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="parallel">All Banks (Fastest)</SelectItem>
                                    <SelectItem value="waterfall">Sequential (Best Rate)</SelectItem>
                                    <SelectItem value="priority_first">Priority Banks First</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <Separator />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="applicantName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Full Name (as per PAN)</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input {...field} placeholder="John Doe" className="pl-10" />
                                  </div>
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
                                  <div className="relative">
                                    <CreditCard className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input {...field} placeholder="ABCDE1234F" className="pl-10 uppercase" />
                                  </div>
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
                                <FormLabel>Email Address</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input {...field} type="email" placeholder="john@example.com" className="pl-10" />
                                  </div>
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
                                <FormLabel>Mobile Number</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input {...field} placeholder="9876543210" className="pl-10" />
                                  </div>
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
                                  <div className="relative">
                                    <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input {...field} type="date" className="pl-10" />
                                  </div>
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
                                <FormLabel>Employment Type</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select employment" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="salaried">Salaried</SelectItem>
                                    <SelectItem value="self_employed">Self-Employed</SelectItem>
                                    <SelectItem value="business">Business Owner</SelectItem>
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
                                <FormLabel>Monthly Income (₹)</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Briefcase className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input {...field} type="number" placeholder="75000" className="pl-10" />
                                  </div>
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
                                <FormLabel>Credit Score (Optional)</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <TrendingUp className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input {...field} type="number" placeholder="750" className="pl-10" />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <LoanDocumentUpload
                          loanType={form.watch("loanType")}
                          documents={uploadedDocuments}
                          onDocumentsChange={setUploadedDocuments}
                        />

                        <Button 
                          type="submit" 
                          className="w-full" 
                          size="lg"
                          disabled={createApplicationMutation.isPending}
                        >
                          {createApplicationMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <ArrowRight className="mr-2 h-4 w-4" />
                              Submit Application
                            </>
                          )}
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building className="h-5 w-5 text-green-600" />
                      Partner Banks
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {["ICICI Bank", "HDFC Bank", "Axis Bank", "Kotak Mahindra", "SBI", "Bajaj Finance", "Tata Capital"].map((bank, i) => (
                      <div key={bank} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                        <span className="font-medium text-sm">{bank}</span>
                        <Badge variant="outline" className="text-xs">
                          {8.5 + i * 0.5}% - {12 + i * 0.5}%
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-blue-600" />
                      Benefits
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                      <span>Single application for multiple banks</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                      <span>Compare offers side-by-side</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                      <span>Best rates guaranteed</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                      <span>100% paperless process</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                      <span>RBI compliant & secure</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="track">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  Your Applications
                </CardTitle>
                <CardDescription>
                  Track the status of your loan applications across all banks
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingApplications ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                ) : myApplications && myApplications.length > 0 ? (
                  <div className="space-y-4">
                    {myApplications.map((app: any) => {
                      const StatusIcon = statusIcons[app.status] || FileText;
                      return (
                        <div 
                          key={app.id}
                          className="border rounded-lg p-4 hover:border-blue-300 dark:border-blue-700 transition-colors cursor-pointer"
                          onClick={() => setSelectedApplication(app.id)}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold capitalize">{app.loanType} Loan</h3>
                                <Badge className={statusColors[app.status]}>
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {app.status.replace(/_/g, " ")}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Application ID: {app.applicationNumber || app.id}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-lg">{formatCurrency(app.requestedAmount)}</p>
                              <p className="text-sm text-muted-foreground">{app.requestedTenure} months</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                            <div>
                              <p className="text-muted-foreground">Applied On</p>
                              <p className="font-medium">{formatDate(app.createdAt)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Banks Routed</p>
                              <p className="font-medium">{app.routedBanks?.length || 0} banks</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Strategy</p>
                              <p className="font-medium capitalize">{app.routingStrategy}</p>
                            </div>
                          </div>

                          {app.routedBanks && app.routedBanks.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {app.routedBanks.map((bank: string, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  <Building className="h-3 w-3 mr-1" />
                                  {bank}
                                </Badge>
                              ))}
                            </div>
                          )}

                          <div className="mt-4 pt-4 border-t">
                            <p className="text-xs text-muted-foreground mb-3">Application Progress</p>
                            <LoanProgressStepper status={app.status} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-1">
                      No Applications Yet
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Start by applying for a loan to see your applications here
                    </p>
                    <Button onClick={() => setActiveTab("apply")}>
                      Apply for Loan
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
