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
  Search
} from "lucide-react";

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
  routingStrategy: z.enum(["parallel", "waterfall", "priority_first"]).default("parallel"),
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

export default function AgentLoanApplyPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("apply");
  const [clientSource, setClientSource] = useState<"existing" | "new">("new");
  const [searchQuery, setSearchQuery] = useState("");

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
      routingStrategy: "parallel",
      loanPurpose: "",
    },
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

  const { data: myApplications, isLoading: loadingApplications } = useQuery<any>({
    queryKey: ["/api/dsa-loans/applications"],
  });

  const createApplicationMutation = useMutation({
    mutationFn: async (data: LoanApplicationForm) => {
      const payload = {
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
        routingStrategy: data.routingStrategy,
        loanPurpose: data.loanPurpose || undefined,
      };
      return apiRequest("/api/dsa-loans/applications", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast({ title: "Loan Lead Submitted", description: "The loan application has been submitted for processing." });
      queryClient.invalidateQueries({ queryKey: ["/api/dsa-loans/applications"] });
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
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Client Selection
                  </CardTitle>
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
                    name="routingStrategy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bank Routing Strategy</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select routing" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="parallel">Parallel (All banks at once)</SelectItem>
                            <SelectItem value="waterfall">Waterfall (One by one)</SelectItem>
                            <SelectItem value="priority_first">Priority First</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                My Loan Submissions
              </CardTitle>
              <CardDescription>Track the status of loan applications you've submitted</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingApplications ? (
                <LoadingState message="Loading applications..." />
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
                        <Badge className={statusColors[app.status] || "bg-gray-100"}>
                          {app.status?.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <Separator className="my-3" />
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
