import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Calculator, FileText, Download, Upload, AlertTriangle, CheckCircle,
  Clock, TrendingUp, Building2, Users, Receipt, Shield as LucideShield, Info,
  Calendar, DollarSign, PieChart, BarChart3, ArrowRight, RefreshCw,
  FileCheck, AlertCircle, HelpCircle, Banknote, Plus
} from "lucide-react";

interface TDSCalculationResult {
  success: boolean;
  data?: {
    grossIncome: number;
    totalDeductions: number;
    taxableIncome: number;
    taxLiability: number;
    surcharge: number;
    educationCess: number;
    totalTax: number;
    monthlyTDS: number;
    effectiveRate: number;
    taxRegime: string;
    breakdown: {
      basicTax: number;
      surcharge: number;
      cess: number;
    };
    slabWise?: Array<{
      slab: string;
      rate: number;
      taxableAmount: number;
      tax: number;
    }>;
  };
  message: string;
}

interface TDSNonSalaryResult {
  success: boolean;
  data?: {
    amount: number;
    section: string;
    tdsRate: number;
    tdsAmount: number;
    surcharge: number;
    educationCess: number;
    totalTDS: number;
    netPayable: number;
    thresholdLimit: number;
    remarks: string;
  };
  message: string;
}

interface TDSAnalyticsData {
  totalTDSDeducted: number;
  totalTDSDeposited: number;
  pendingDeposit: number;
  potentialNotices: Array<{
    type: string;
    severity: string;
    description: string;
    section: string;
    amount: number;
    dueDate?: string;
  }>;
  compliance: {
    filedQuarters: string[];
    pendingQuarters: string[];
    lastFilingDate?: string;
    nextDueDate: string;
  };
  recommendations: string[];
}

const PAYMENT_TYPES = [
  { value: "contractor", label: "Contractor (194C)" },
  { value: "professional", label: "Professional/Technical (194J)" },
  { value: "rent", label: "Rent (194I)" },
  { value: "interest", label: "Interest (194A)" },
  { value: "dividend", label: "Dividend (194)" },
  { value: "commission", label: "Commission/Brokerage (194H)" },
  { value: "technical_services", label: "Technical Services (194J)" },
  { value: "sale_of_property", label: "Sale of Property (194IA)" },
  { value: "lottery", label: "Lottery (194B)" },
  { value: "insurance_commission", label: "Insurance Commission (194D)" },

];

const FINANCIAL_YEARS = ["2024-25", "2023-24", "2022-23"];

export default function TDSCompliancePage() {
  const [activeTab, setActiveTab] = useState("calculator");
  const { toast } = useToast();

  // Salary TDS Calculator State
  const [salaryForm, setSalaryForm] = useState({
    pan: "",
    financialYear: "2024-25",
    grossSalary: "",
    basicSalary: "",
    hra: "",
    specialAllowance: "",
    bonus: "",
    taxRegime: "new",
    section80C: "",
    section80D: "",
    nps80CCD1B: "",
    homeLoanInterest: "",
    rentPaid: "",
    metroCity: true,
  });

  // Non-Salary TDS Calculator State
  const [nonSalaryForm, setNonSalaryForm] = useState({
    deductorTAN: "",
    deducteePAN: "",
    paymentType: "professional",
    amount: "",
    paymentDate: new Date().toISOString().split("T")[0],
    isIndividualHUF: true,
    hasValidPAN: true,
  });

  // Form 16 Generator State
  const [form16Data, setForm16Data] = useState({
    deductorTAN: "",
    financialYear: "2024-25",
    employees: [{ pan: "", name: "", grossSalary: "", tdsDeducted: "" }],
  });

  // Form 12BB State
  const [form12bbData, setForm12bbData] = useState({
    employeeName: "",
    pan: "",
    employerName: "",
    employerTAN: "",
    financialYear: "2024-25",
    declarations: {
      designation: "",
      hra: { isApplicable: false, rentPaid: "", landlordName: "", landlordPAN: "", landlordAddress: "" },
      lta: { isApplicable: false, amount: "" },
      homeLoanInterest: { isApplicable: false, lenderName: "", lenderPAN: "", interestAmount: "" },
      section80C: "",
      section80CCD: "",
      section80D: "",
      section80E: "",
      section80G: "",
      otherDeductions: "",
      place: "",
    }
  });

  // Analytics State
  const [analyticsTAN, setAnalyticsTAN] = useState("");
  const [analyticsFY, setAnalyticsFY] = useState("2024-25");

  // Fetch TDS section rates
  const { data: sectionRates } = useQuery<{ success: boolean; data?: Record<string, any> }>({
    queryKey: ["/api/tds/section-rates"],
  });

  // Fetch TDS form types
  const { data: formTypes } = useQuery<{ success: boolean; data?: any[] }>({
    queryKey: ["/api/tds/form-types"],
  });

  // Fetch due dates for current FY
  const { data: dueDates } = useQuery<{ success: boolean; data?: any[] }>({
    queryKey: ["/api/tds/due-dates", analyticsFY],
    enabled: !!analyticsFY,
  });

  // Calculate Salary TDS Mutation
  const calculateSalaryMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/tds/calculate/salary", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (result: TDSCalculationResult) => {
      if (result.success) {
        toast({
          title: "TDS Calculated",
          description: `Monthly TDS: ₹${result.data?.monthlyTDS?.toLocaleString()}`,
        });
      }
    },
    onError: () => {
      toast({
        title: "Calculation Failed",
        description: "Unable to calculate TDS. Please check your inputs.",
        variant: "destructive",
      });
    },
  });

  // Calculate Non-Salary TDS Mutation
  const calculateNonSalaryMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/tds/calculate/non-salary", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (result: TDSNonSalaryResult) => {
      if (result.success) {
        toast({
          title: "TDS Calculated",
          description: `TDS Amount: ₹${result.data?.totalTDS?.toLocaleString()}`,
        });
      }
    },
  });

  // Generate Form 16 Mutation
  const generateForm16Mutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/tds/form16/generate", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Form 16 Generated",
        description: "Form 16 certificates have been generated successfully.",
      });
    },
  });

  // Fetch Analytics
  const { data: analyticsData, refetch: refetchAnalytics, isLoading: isLoadingAnalytics } = useQuery({
    queryKey: ["/api/tds/analytics", analyticsTAN, analyticsFY],
    enabled: !!analyticsTAN && analyticsTAN.length === 10,
  });

  // Fetch Clients (CA Practice Management)
  const { data: clientsData, isLoading: isLoadingClients } = useQuery<{ data: any[] }>({
    queryKey: ["/api/tax/practice/clients"],
    enabled: activeTab === "clients",
  });

  // Generate Form 12BB Mutation
  const generateForm12BBMutation = useMutation({
    mutationFn: async (data: any) => {
      const formattedData = {
        ...data,
        declarations: {
          ...data.declarations,
          section80C: parseFloat(data.declarations.section80C) || 0,
          section80D: parseFloat(data.declarations.section80D) || 0,
          section80E: parseFloat(data.declarations.section80E) || 0,
          section80G: parseFloat(data.declarations.section80G) || 0,
          hra: {
            ...data.declarations.hra,
            rentPaid: parseFloat(data.declarations.hra.rentPaid) || 0,
          },
          homeLoanInterest: {
            ...data.declarations.homeLoanInterest,
            interestAmount: parseFloat(data.declarations.homeLoanInterest.interestAmount) || 0,
          }
        }
      };
      return apiRequest("/api/tax/form12bb/generate", {
        method: "POST",
        body: JSON.stringify(formattedData),
      });
    },
    onSuccess: () => {
      toast({
        title: "Form 12BB Generated",
        description: "Your investment declaration has been generated.",
      });
    },
  });

  const handleSalarySubmit = () => {
    const numericData = {
      pan: salaryForm.pan,
      financialYear: salaryForm.financialYear,
      grossSalary: parseFloat(salaryForm.grossSalary) || 0,
      basicSalary: parseFloat(salaryForm.basicSalary) || 0,
      hra: parseFloat(salaryForm.hra) || 0,
      specialAllowance: parseFloat(salaryForm.specialAllowance) || 0,
      bonus: parseFloat(salaryForm.bonus) || 0,
      perquisites: 0,
      profitInLieu: 0,
      lta: 0,
      taxRegime: salaryForm.taxRegime,
      rentPaid: parseFloat(salaryForm.rentPaid) || 0,
      metroCity: salaryForm.metroCity,
      deductions: {
        section80C: parseFloat(salaryForm.section80C) || 0,
        section80D: parseFloat(salaryForm.section80D) || 0,
        section80E: 0,
        section80G: 0,
        section80TTA: 0,
        nps80CCD1B: parseFloat(salaryForm.nps80CCD1B) || 0,
        homeLoanInterest: parseFloat(salaryForm.homeLoanInterest) || 0,
        standardDeduction: 50000,
        professionalTax: 0,
        hraExemption: 0,
      },
    };

    calculateSalaryMutation.mutate(numericData);
  };

  const handleNonSalarySubmit = () => {
    const data = {
      deductorTAN: nonSalaryForm.deductorTAN,
      deducteePAN: nonSalaryForm.deducteePAN,
      paymentType: nonSalaryForm.paymentType,
      amount: parseFloat(nonSalaryForm.amount) || 0,
      paymentDate: nonSalaryForm.paymentDate,
      isIndividualHUF: nonSalaryForm.isIndividualHUF,
      hasValidPAN: nonSalaryForm.hasValidPAN,
      thresholdExceeded: true,
    };

    calculateNonSalaryMutation.mutate(data);
  };

  const handleForm16Submit = () => {
    const data = {
      deductorTAN: form16Data.deductorTAN,
      financialYear: form16Data.financialYear,
      employees: form16Data.employees.map((emp) => ({
        pan: emp.pan,
        name: emp.name,
        grossSalary: parseFloat(emp.grossSalary) || 0,
        tdsDeducted: parseFloat(emp.tdsDeducted) || 0,
      })),
    };

    generateForm16Mutation.mutate(data);
  };

  const addEmployee = () => {
    setForm16Data((prev) => ({
      ...prev,
      employees: [...prev.employees, { pan: "", name: "", grossSalary: "", tdsDeducted: "" }],
    }));
  };

  const updateEmployee = (index: number, field: string, value: string) => {
    setForm16Data((prev) => ({
      ...prev,
      employees: prev.employees.map((emp, i) =>
        i === index ? { ...emp, [field]: value } : emp
      ),
    }));
  };

  const salaryResult = calculateSalaryMutation.data as TDSCalculationResult | undefined;
  const nonSalaryResult = calculateNonSalaryMutation.data as TDSNonSalaryResult | undefined;
  const analytics = analyticsData as { success: boolean; data: TDSAnalyticsData } | undefined;

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-8 md:p-12 text-foreground overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-card/10 backdrop-blur-sm rounded-xl">
              <Receipt className="h-8 w-8" />
            </div>
            <Badge variant="secondary" className="bg-card/20 text-foreground border-white/30">
              Sandbox.co.in Integration
            </Badge>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            TDS Compliance Center
          </h1>
          <p className="text-xl mb-6 text-blue-100 max-w-3xl leading-relaxed">
            Complete TDS management with calculators, Form 16/16A generation, TDS return filing, and analytics. Powered by Sandbox.co.in APIs.
          </p>

          <div className="grid md:grid-cols-4 gap-4">
            <div className="bg-card/10 backdrop-blur-sm rounded-xl p-4">
              <Calculator className="h-6 w-6 mb-2" />
              <div className="text-2xl font-bold">Calculators</div>
              <div className="text-sm text-blue-100">Salary & Non-Salary TDS</div>
            </div>
            <div className="bg-card/10 backdrop-blur-sm rounded-xl p-4">
              <FileText className="h-6 w-6 mb-2" />
              <div className="text-2xl font-bold">Form 16/16A</div>
              <div className="text-sm text-blue-100">Certificate Generation</div>
            </div>
            <div className="bg-card/10 backdrop-blur-sm rounded-xl p-4">
              <Upload className="h-6 w-6 mb-2" />
              <div className="text-2xl font-bold">E-Filing</div>
              <div className="text-sm text-blue-100">24Q, 26Q, 27Q, 27EQ</div>
            </div>
            <div className="bg-card/10 backdrop-blur-sm rounded-xl p-4">
              <BarChart3 className="h-6 w-6 mb-2" />
              <div className="text-2xl font-bold">Analytics</div>
              <div className="text-sm text-blue-100">Compliance Tracking</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <ScrollableTabsList className="grid grid-cols-5 w-full max-w-3xl mx-auto">
          <TabsTrigger value="calculator" data-testid="tab-calculator">
            <Calculator className="h-4 w-4 mr-2" />
            Calculator
          </TabsTrigger>
          <TabsTrigger value="non-salary" data-testid="tab-non-salary">
            <Banknote className="h-4 w-4 mr-2" />
            Non-Salary
          </TabsTrigger>
          <TabsTrigger value="form16" data-testid="tab-form16">
            <FileText className="h-4 w-4 mr-2" />
            Form 16
          </TabsTrigger>
          <TabsTrigger value="form12bb" data-testid="tab-form12bb">
            <FileText className="h-4 w-4 mr-2" />
            Form 12BB
          </TabsTrigger>
          <TabsTrigger value="filing" data-testid="tab-filing">
            <Upload className="h-4 w-4 mr-2" />
            Return Filing
          </TabsTrigger>
          <TabsTrigger value="clients" data-testid="tab-clients">
            <Users className="h-4 w-4 mr-2" />
            Clients
          </TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
        </ScrollableTabsList>

        {/* Form 12BB Generator Tab */}
        <TabsContent value="form12bb" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Form 12BB Generator
              </CardTitle>
              <CardDescription>
                Generate investment declaration (Form 12BB) for your employer
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-muted-foreground">Employee & Employer Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="employeeName">Employee Name</Label>
                      <Input
                        id="employeeName"
                        placeholder="Full Name"
                        value={form12bbData.employeeName}
                        onChange={(e) => setForm12bbData(prev => ({ ...prev, employeeName: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employeePan">PAN</Label>
                      <Input
                        id="employeePan"
                        placeholder="ABCDE1234F"
                        value={form12bbData.pan}
                        onChange={(e) => setForm12bbData(prev => ({ ...prev, pan: e.target.value.toUpperCase() }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employerName">Employer Name</Label>
                      <Input
                        id="employerName"
                        placeholder="Company Name"
                        value={form12bbData.employerName}
                        onChange={(e) => setForm12bbData(prev => ({ ...prev, employerName: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employerTan">Employer TAN</Label>
                      <Input
                        id="employerTan"
                        placeholder="MUMT12345A"
                        value={form12bbData.employerTAN}
                        onChange={(e) => setForm12bbData(prev => ({ ...prev, employerTAN: e.target.value.toUpperCase() }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-muted-foreground">Investment Declarations</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="f12bb-80c">Section 80C</Label>
                      <Input
                        id="f12bb-80c"
                        type="number"
                        placeholder="₹0"
                        value={form12bbData.declarations.section80C}
                        onChange={(e) => setForm12bbData(prev => ({
                          ...prev,
                          declarations: { ...prev.declarations, section80C: e.target.value }
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="f12bb-80d">Section 80D</Label>
                      <Input
                        id="f12bb-80d"
                        type="number"
                        placeholder="₹0"
                        value={form12bbData.declarations.section80D}
                        onChange={(e) => setForm12bbData(prev => ({
                          ...prev,
                          declarations: { ...prev.declarations, section80D: e.target.value }
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="f12bb-hra">Rent Paid (HRA)</Label>
                      <Input
                        id="f12bb-hra"
                        type="number"
                        placeholder="₹0"
                        value={form12bbData.declarations.hra.rentPaid}
                        onChange={(e) => setForm12bbData(prev => ({
                          ...prev,
                          declarations: {
                            ...prev.declarations,
                            hra: { ...prev.declarations.hra, rentPaid: e.target.value, isApplicable: true }
                          }
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="f12bb-homeloan">Home Loan Interest</Label>
                      <Input
                        id="f12bb-homeloan"
                        type="number"
                        placeholder="₹0"
                        value={form12bbData.declarations.homeLoanInterest.interestAmount}
                        onChange={(e) => setForm12bbData(prev => ({
                          ...prev,
                          declarations: {
                            ...prev.declarations,
                            homeLoanInterest: { ...prev.declarations.homeLoanInterest, interestAmount: e.target.value, isApplicable: true }
                          }
                        }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => generateForm12BBMutation.mutate(form12bbData)}
                  disabled={generateForm12BBMutation.isPending}
                >
                  {generateForm12BBMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Generate Form 12BB
                </Button>
              </div>

              {generateForm12BBMutation.data?.success && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertTitle>Form 12BB Generated</AlertTitle>
                  <AlertDescription className="flex items-center justify-between">
                    <span>Your declaration for FY {form12bbData.financialYear} is ready.</span>
                    <Button variant="outline" size="sm" className="ml-4">
                      <Download className="h-4 w-4 mr-2" /> Download PDF
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CA Practice Management - Clients Tab */}
        <TabsContent value="clients" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  Client Management
                </CardTitle>
                <CardDescription>
                  Manage your tax practice clients and bulk upload data
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="gap-2">
                  <Upload className="h-4 w-4" /> Bulk Upload
                </Button>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" /> Add Client
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingClients ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-3 text-left font-medium">Name</th>
                        <th className="p-3 text-left font-medium">PAN</th>
                        <th className="p-3 text-left font-medium">ITR Form</th>
                        <th className="p-3 text-left font-medium">Status</th>
                        <th className="p-3 text-left font-medium">Last Updated</th>
                        <th className="p-3 text-right font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientsData?.data?.map((client: any) => (
                        <tr key={client.id} className="border-b hover:bg-muted/50">
                          <td className="p-3 font-medium">{client.name}</td>
                          <td className="p-3">{client.pan}</td>
                          <td className="p-3">
                            <Badge variant="outline">{client.itrForm}</Badge>
                          </td>
                          <td className="p-3">
                            <Badge className={
                              client.status === "filed" ? "bg-green-100 text-green-700" :
                              client.status === "review" ? "bg-yellow-100 text-yellow-700" :
                              "bg-blue-100 text-blue-700"
                            }>
                              {client.status.replace("_", " ")}
                            </Badge>
                          </td>
                          <td className="p-3 text-muted-foreground text-xs">
                            {new Date(client.updatedAt).toLocaleDateString()}
                          </td>
                          <td className="p-3 text-right">
                            <Button variant="ghost" size="sm">View</Button>
                          </td>
                        </tr>
                      ))}
                      {(!clientsData?.data || clientsData.data.length === 0) && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-muted-foreground">
                            No clients found. Start by adding a new client.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Salary TDS Calculator Tab */}
        <TabsContent value="calculator" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-blue-600" />
                  Salary TDS Calculator
                </CardTitle>
                <CardDescription>
                  Calculate TDS on salary income under Old or New tax regime
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pan">PAN Number</Label>
                    <Input
                      id="pan"
                      placeholder="ABCDE1234F"
                      value={salaryForm.pan}
                      onChange={(e) => setSalaryForm((prev) => ({ ...prev, pan: e.target.value.toUpperCase() }))}
                      data-testid="input-pan"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fy">Financial Year</Label>
                    <Select
                      value={salaryForm.financialYear}
                      onValueChange={(v) => setSalaryForm((prev) => ({ ...prev, financialYear: v }))}
                    >
                      <SelectTrigger data-testid="select-fy">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FINANCIAL_YEARS.map((fy) => (
                          <SelectItem key={fy} value={fy}>{fy}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-muted-foreground">Income Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="grossSalary">Gross Salary (Annual)</Label>
                      <Input
                        id="grossSalary"
                        type="number"
                        placeholder="₹0"
                        value={salaryForm.grossSalary}
                        onChange={(e) => setSalaryForm((prev) => ({ ...prev, grossSalary: e.target.value }))}
                        data-testid="input-gross-salary"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="basicSalary">Basic Salary</Label>
                      <Input
                        id="basicSalary"
                        type="number"
                        placeholder="₹0"
                        value={salaryForm.basicSalary}
                        onChange={(e) => setSalaryForm((prev) => ({ ...prev, basicSalary: e.target.value }))}
                        data-testid="input-basic-salary"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hra">HRA Received</Label>
                      <Input
                        id="hra"
                        type="number"
                        placeholder="₹0"
                        value={salaryForm.hra}
                        onChange={(e) => setSalaryForm((prev) => ({ ...prev, hra: e.target.value }))}
                        data-testid="input-hra"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bonus">Bonus/Incentives</Label>
                      <Input
                        id="bonus"
                        type="number"
                        placeholder="₹0"
                        value={salaryForm.bonus}
                        onChange={(e) => setSalaryForm((prev) => ({ ...prev, bonus: e.target.value }))}
                        data-testid="input-bonus"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm text-muted-foreground">Tax Regime</h4>
                    <div className="flex items-center gap-4">
                      <Label className={salaryForm.taxRegime === "old" ? "text-blue-600 font-medium" : "text-muted-foreground"}>
                        Old Regime
                      </Label>
                      <Switch
                        checked={salaryForm.taxRegime === "new"}
                        onCheckedChange={(checked) => setSalaryForm((prev) => ({ ...prev, taxRegime: checked ? "new" : "old" }))}
                        data-testid="switch-regime"
                      />
                      <Label className={salaryForm.taxRegime === "new" ? "text-blue-600 font-medium" : "text-muted-foreground"}>
                        New Regime
                      </Label>
                    </div>
                  </div>
                </div>

                {salaryForm.taxRegime === "old" && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm text-muted-foreground">Deductions (Old Regime Only)</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="section80C">Section 80C (Max ₹1.5L)</Label>
                          <Input
                            id="section80C"
                            type="number"
                            placeholder="₹0"
                            value={salaryForm.section80C}
                            onChange={(e) => setSalaryForm((prev) => ({ ...prev, section80C: e.target.value }))}
                            data-testid="input-80c"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="section80D">Section 80D Health (Max ₹1L)</Label>
                          <Input
                            id="section80D"
                            type="number"
                            placeholder="₹0"
                            value={salaryForm.section80D}
                            onChange={(e) => setSalaryForm((prev) => ({ ...prev, section80D: e.target.value }))}
                            data-testid="input-80d"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="nps">NPS 80CCD(1B) (Max ₹50K)</Label>
                          <Input
                            id="nps"
                            type="number"
                            placeholder="₹0"
                            value={salaryForm.nps80CCD1B}
                            onChange={(e) => setSalaryForm((prev) => ({ ...prev, nps80CCD1B: e.target.value }))}
                            data-testid="input-nps"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="homeLoan">Home Loan Interest (Max ₹2L)</Label>
                          <Input
                            id="homeLoan"
                            type="number"
                            placeholder="₹0"
                            value={salaryForm.homeLoanInterest}
                            onChange={(e) => setSalaryForm((prev) => ({ ...prev, homeLoanInterest: e.target.value }))}
                            data-testid="input-home-loan"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rentPaid">Rent Paid (Annual)</Label>
                          <Input
                            id="rentPaid"
                            type="number"
                            placeholder="₹0"
                            value={salaryForm.rentPaid}
                            onChange={(e) => setSalaryForm((prev) => ({ ...prev, rentPaid: e.target.value }))}
                            data-testid="input-rent"
                          />
                        </div>
                        <div className="flex items-center gap-2 pt-6">
                          <Switch
                            checked={salaryForm.metroCity}
                            onCheckedChange={(checked) => setSalaryForm((prev) => ({ ...prev, metroCity: checked }))}
                            data-testid="switch-metro"
                          />
                          <Label>Metro City (40% HRA)</Label>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <Button
                  className="w-full"
                  onClick={handleSalarySubmit}
                  disabled={calculateSalaryMutation.isPending}
                  data-testid="button-calculate-salary"
                >
                  {calculateSalaryMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Calculating...
                    </>
                  ) : (
                    <>
                      <Calculator className="h-4 w-4 mr-2" />
                      Calculate TDS
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Results Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-green-600" />
                  TDS Calculation Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                {salaryResult?.success && salaryResult.data ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                        <div className="text-sm text-muted-foreground">Gross Income</div>
                        <div className="text-2xl font-bold text-blue-600">
                          ₹{salaryResult.data.grossIncome.toLocaleString()}
                        </div>
                      </div>
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                        <div className="text-sm text-muted-foreground">Total Deductions</div>
                        <div className="text-2xl font-bold text-green-600">
                          ₹{salaryResult.data.totalDeductions.toLocaleString()}
                        </div>
                      </div>
                      <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                        <div className="text-sm text-muted-foreground">Taxable Income</div>
                        <div className="text-2xl font-bold text-purple-600">
                          ₹{salaryResult.data.taxableIncome.toLocaleString()}
                        </div>
                      </div>
                      <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
                        <div className="text-sm text-muted-foreground">Total Tax</div>
                        <div className="text-2xl font-bold text-orange-600">
                          ₹{salaryResult.data.totalTax.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="p-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl text-foreground">
                      <div className="text-sm opacity-80">Monthly TDS Deduction</div>
                      <div className="text-4xl font-bold">₹{salaryResult.data.monthlyTDS.toLocaleString()}</div>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="secondary" className="bg-card/20 text-foreground">
                          {salaryResult.data.taxRegime === "new" ? "New Regime" : "Old Regime"}
                        </Badge>
                        <span className="text-sm opacity-80">
                          Effective Rate: {salaryResult.data.effectiveRate}%
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm">Tax Breakdown</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Basic Tax</span>
                          <span>₹{salaryResult.data.breakdown.basicTax.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Surcharge</span>
                          <span>₹{salaryResult.data.breakdown.surcharge.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Education Cess (4%)</span>
                          <span>₹{Math.round(salaryResult.data.breakdown.cess).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {salaryResult.data.slabWise && salaryResult.data.slabWise.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm">Slab-wise Computation</h4>
                        <div className="space-y-2">
                          {salaryResult.data.slabWise.map((slab, idx) => (
                            <div key={idx} className="flex justify-between text-sm p-2 bg-muted rounded">
                              <span>
                                {slab.slab} @ {slab.rate}%
                              </span>
                              <span>₹{slab.tax.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Calculator className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>Enter your salary details and click Calculate to see TDS computation</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Non-Salary TDS Calculator Tab */}
        <TabsContent value="non-salary" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Banknote className="h-5 w-5 text-purple-600" />
                  Non-Salary TDS Calculator
                </CardTitle>
                <CardDescription>
                  Calculate TDS on contractor, professional, rent, interest, and other payments
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="deductorTAN">Deductor TAN</Label>
                    <Input
                      id="deductorTAN"
                      placeholder="ABCD12345E"
                      value={nonSalaryForm.deductorTAN}
                      onChange={(e) => setNonSalaryForm((prev) => ({ ...prev, deductorTAN: e.target.value.toUpperCase() }))}
                      data-testid="input-deductor-tan"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deducteePAN">Deductee PAN</Label>
                    <Input
                      id="deducteePAN"
                      placeholder="ABCDE1234F"
                      value={nonSalaryForm.deducteePAN}
                      onChange={(e) => setNonSalaryForm((prev) => ({ ...prev, deducteePAN: e.target.value.toUpperCase() }))}
                      data-testid="input-deductee-pan"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentType">Payment Type</Label>
                  <Select
                    value={nonSalaryForm.paymentType}
                    onValueChange={(v) => setNonSalaryForm((prev) => ({ ...prev, paymentType: v }))}
                  >
                    <SelectTrigger data-testid="select-payment-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Payment Amount</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="₹0"
                      value={nonSalaryForm.amount}
                      onChange={(e) => setNonSalaryForm((prev) => ({ ...prev, amount: e.target.value }))}
                      data-testid="input-payment-amount"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paymentDate">Payment Date</Label>
                    <Input
                      id="paymentDate"
                      type="date"
                      value={nonSalaryForm.paymentDate}
                      onChange={(e) => setNonSalaryForm((prev) => ({ ...prev, paymentDate: e.target.value }))}
                      data-testid="input-payment-date"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={nonSalaryForm.isIndividualHUF}
                      onCheckedChange={(checked) => setNonSalaryForm((prev) => ({ ...prev, isIndividualHUF: checked }))}
                      data-testid="switch-individual"
                    />
                    <Label>Individual/HUF</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={nonSalaryForm.hasValidPAN}
                      onCheckedChange={(checked) => setNonSalaryForm((prev) => ({ ...prev, hasValidPAN: checked }))}
                      data-testid="switch-valid-pan"
                    />
                    <Label>Valid PAN</Label>
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={handleNonSalarySubmit}
                  disabled={calculateNonSalaryMutation.isPending}
                  data-testid="button-calculate-non-salary"
                >
                  {calculateNonSalaryMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Calculating...
                    </>
                  ) : (
                    <>
                      <Calculator className="h-4 w-4 mr-2" />
                      Calculate TDS
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Non-Salary Results Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-green-600" />
                  TDS Calculation Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                {nonSalaryResult?.success && nonSalaryResult.data ? (
                  <div className="space-y-6">
                    <div className="p-6 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl text-foreground">
                      <div className="text-sm opacity-80">Total TDS Deductible</div>
                      <div className="text-4xl font-bold">₹{nonSalaryResult.data.totalTDS.toLocaleString()}</div>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="secondary" className="bg-card/20 text-foreground">
                          Section {nonSalaryResult.data.section}
                        </Badge>
                        <span className="text-sm opacity-80">@ {nonSalaryResult.data.tdsRate}%</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                        <div className="text-sm text-muted-foreground">Payment Amount</div>
                        <div className="text-xl font-bold text-blue-600">
                          ₹{nonSalaryResult.data.amount.toLocaleString()}
                        </div>
                      </div>
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                        <div className="text-sm text-muted-foreground">Net Payable</div>
                        <div className="text-xl font-bold text-green-600">
                          ₹{nonSalaryResult.data.netPayable.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm">Breakdown</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">TDS Amount</span>
                          <span>₹{nonSalaryResult.data.tdsAmount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Surcharge</span>
                          <span>₹{nonSalaryResult.data.surcharge.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Education Cess</span>
                          <span>₹{nonSalaryResult.data.educationCess.toLocaleString()}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-semibold">
                          <span>Total TDS</span>
                          <span>₹{nonSalaryResult.data.totalTDS.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        {nonSalaryResult.data.remarks}
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Banknote className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>Enter payment details and click Calculate to see TDS computation</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* TDS Section Rates Reference */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-blue-600" />
                TDS Section Rates Reference (FY 2024-25)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sectionRates?.data && (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(sectionRates.data as Record<string, any>).map(([section, info]) => (
                    <div key={section} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="font-mono">{section}</Badge>
                        <span className="text-lg font-bold text-blue-600">{info.rate}%</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{info.description}</p>
                      <div className="text-xs text-muted-foreground">
                        Threshold: ₹{info.thresholdIndividual.toLocaleString()} (Individual) / 
                        ₹{info.thresholdOther.toLocaleString()} (Others)
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Form 16 Generator Tab */}
        <TabsContent value="form16" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-green-600" />
                Form 16 Generator
              </CardTitle>
              <CardDescription>
                Generate Form 16 TDS certificates for employees
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="f16-tan">Deductor TAN</Label>
                  <Input
                    id="f16-tan"
                    placeholder="ABCD12345E"
                    value={form16Data.deductorTAN}
                    onChange={(e) => setForm16Data((prev) => ({ ...prev, deductorTAN: e.target.value.toUpperCase() }))}
                    data-testid="input-f16-tan"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="f16-fy">Financial Year</Label>
                  <Select
                    value={form16Data.financialYear}
                    onValueChange={(v) => setForm16Data((prev) => ({ ...prev, financialYear: v }))}
                  >
                    <SelectTrigger data-testid="select-f16-fy">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FINANCIAL_YEARS.map((fy) => (
                        <SelectItem key={fy} value={fy}>{fy}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Employee Details</h4>
                  <Button variant="outline" size="sm" onClick={addEmployee} data-testid="button-add-employee">
                    <Users className="h-4 w-4 mr-2" />
                    Add Employee
                  </Button>
                </div>

                {form16Data.employees.map((emp, idx) => (
                  <div key={idx} className="grid md:grid-cols-4 gap-4 p-4 border rounded-lg">
                    <div className="space-y-2">
                      <Label>PAN</Label>
                      <Input
                        placeholder="ABCDE1234F"
                        value={emp.pan}
                        onChange={(e) => updateEmployee(idx, "pan", e.target.value.toUpperCase())}
                        data-testid={`input-emp-pan-${idx}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        placeholder="Employee Name"
                        value={emp.name}
                        onChange={(e) => updateEmployee(idx, "name", e.target.value)}
                        data-testid={`input-emp-name-${idx}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Gross Salary</Label>
                      <Input
                        type="number"
                        placeholder="₹0"
                        value={emp.grossSalary}
                        onChange={(e) => updateEmployee(idx, "grossSalary", e.target.value)}
                        data-testid={`input-emp-salary-${idx}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>TDS Deducted</Label>
                      <Input
                        type="number"
                        placeholder="₹0"
                        value={emp.tdsDeducted}
                        onChange={(e) => updateEmployee(idx, "tdsDeducted", e.target.value)}
                        data-testid={`input-emp-tds-${idx}`}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <Button
                className="w-full"
                onClick={handleForm16Submit}
                disabled={generateForm16Mutation.isPending}
                data-testid="button-generate-form16"
              >
                {generateForm16Mutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileCheck className="h-4 w-4 mr-2" />
                    Generate Form 16
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Form 16A Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-600" />
                Form 16A Generator
              </CardTitle>
              <CardDescription>
                Generate Form 16A TDS certificates for non-salary deductions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Form 16A</AlertTitle>
                <AlertDescription>
                  Form 16A is the TDS certificate for non-salary payments like contractor fees, professional services, rent, etc.
                  It is issued quarterly by the deductor to the deductee.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TDS Return Filing Tab */}
        <TabsContent value="filing" className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Form Types */}
            {formTypes?.data?.map((form: any) => (
              <Card key={form.form} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{form.form}</span>
                    <Badge variant="outline">{form.description}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Applicable For:</h4>
                    <div className="flex flex-wrap gap-2">
                      {form.applicableFor.map((item: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button className="w-full" variant="outline" data-testid={`button-file-${form.form}`}>
                    <Upload className="h-4 w-4 mr-2" />
                    Prepare {form.form} Return
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Due Dates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-orange-600" />
                TDS Return Due Dates - FY {analyticsFY}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dueDates?.data && (
                <div className="grid md:grid-cols-4 gap-4">
                  {dueDates.data.map((quarter: any) => (
                    <div key={quarter.quarter} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant="outline" className="text-lg">{quarter.quarter}</Badge>
                        <span className="text-sm text-muted-foreground">{quarter.period}</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Deposit Due:</span>
                          <span className="font-medium">{quarter.depositDue}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Return Due:</span>
                          <span className="font-medium text-orange-600">{quarter.returnDue}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                TDS Compliance Analytics
              </CardTitle>
              <CardDescription>
                Get comprehensive TDS analytics, potential notices, and compliance recommendations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="analytics-tan">TAN Number</Label>
                  <Input
                    id="analytics-tan"
                    placeholder="ABCD12345E"
                    value={analyticsTAN}
                    onChange={(e) => setAnalyticsTAN(e.target.value.toUpperCase())}
                    data-testid="input-analytics-tan"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="analytics-fy">Financial Year</Label>
                  <Select value={analyticsFY} onValueChange={setAnalyticsFY}>
                    <SelectTrigger data-testid="select-analytics-fy">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FINANCIAL_YEARS.map((fy) => (
                        <SelectItem key={fy} value={fy}>{fy}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={() => refetchAnalytics()}
                    disabled={isLoadingAnalytics || analyticsTAN.length !== 10}
                    className="w-full"
                    data-testid="button-fetch-analytics"
                  >
                    {isLoadingAnalytics ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <BarChart3 className="h-4 w-4 mr-2" />
                    )}
                    Fetch Analytics
                  </Button>
                </div>
              </div>

              {analytics?.success && analytics.data && (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                      <div className="text-sm text-muted-foreground">Total TDS Deducted</div>
                      <div className="text-3xl font-bold text-blue-600">
                        ₹{analytics.data.totalTDSDeducted.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-xl">
                      <div className="text-sm text-muted-foreground">TDS Deposited</div>
                      <div className="text-3xl font-bold text-green-600">
                        ₹{analytics.data.totalTDSDeposited.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-xl">
                      <div className="text-sm text-muted-foreground">Pending Deposit</div>
                      <div className="text-3xl font-bold text-red-600">
                        ₹{analytics.data.pendingDeposit.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Compliance Status */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <LucideShield className="h-5 w-5 text-green-600" />
                        Compliance Status
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-semibold mb-3">Filed Quarters</h4>
                          <div className="flex flex-wrap gap-2">
                            {analytics.data.compliance.filedQuarters.map((q: string) => (
                              <Badge key={q} variant="outline" className="bg-green-50 dark:bg-green-950/30 text-green-600 border-green-200 dark:border-green-800">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                {q}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-3">Pending Quarters</h4>
                          <div className="flex flex-wrap gap-2">
                            {analytics.data.compliance.pendingQuarters.map((q: string) => (
                              <Badge key={q} variant="outline" className="bg-orange-50 dark:bg-orange-950/30 text-orange-600 border-orange-200 dark:border-orange-800">
                                <Clock className="h-3 w-3 mr-1" />
                                {q}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 p-4 bg-muted rounded-lg">
                        <div className="flex justify-between text-sm">
                          <span>Last Filing Date:</span>
                          <span className="font-medium">{analytics.data.compliance.lastFilingDate || "N/A"}</span>
                        </div>
                        <div className="flex justify-between text-sm mt-2">
                          <span>Next Due Date:</span>
                          <span className="font-medium text-orange-600">{analytics.data.compliance.nextDueDate}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Potential Notices */}
                  {analytics.data.potentialNotices.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-orange-600" />
                          Potential Notices
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {analytics.data.potentialNotices.map((notice, idx) => (
                            <Alert
                              key={idx}
                              variant={notice.severity === "high" ? "destructive" : "default"}
                            >
                              <AlertCircle className="h-4 w-4" />
                              <AlertTitle className="flex items-center gap-2">
                                {notice.type}
                                <Badge
                                  variant={
                                    notice.severity === "high" ? "destructive" :
                                    notice.severity === "medium" ? "outline" : "secondary"
                                  }
                                >
                                  {notice.severity.toUpperCase()}
                                </Badge>
                              </AlertTitle>
                              <AlertDescription>
                                <p>{notice.description}</p>
                                <div className="flex gap-4 mt-2 text-sm">
                                  <span>Section: {notice.section}</span>
                                  {notice.amount > 0 && <span>Penalty: ₹{notice.amount.toLocaleString()}</span>}
                                  {notice.dueDate && <span>Due: {notice.dueDate}</span>}
                                </div>
                              </AlertDescription>
                            </Alert>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Recommendations */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-blue-600" />
                        Recommendations
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {analytics.data.recommendations.map((rec, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                            <span className="text-sm">{rec}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
