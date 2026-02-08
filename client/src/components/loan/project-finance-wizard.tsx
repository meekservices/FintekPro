import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Building2,
  MapPin,
  FileText,
  ShieldCheck,
  TrendingUp,
  DollarSign,
  Calculator,
  ClipboardCheck,
  Landmark,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Loader2,
  RefreshCw,
  ChevronRight,
  Banknote,
  Info,
} from "lucide-react";

const STEPS = [
  { key: "developer", label: "Developer Info", icon: Building2 },
  { key: "project", label: "Project Details", icon: MapPin },
  { key: "land", label: "Land Details", icon: FileText },
  { key: "approvals", label: "Approvals", icon: ShieldCheck },
  { key: "financials", label: "Financials", icon: TrendingUp },
  { key: "cashflow", label: "Cashflow", icon: DollarSign },
  { key: "funding", label: "Funding Structure", icon: Calculator },
  { key: "credit", label: "Credit Summary", icon: ClipboardCheck },
  { key: "disbursement", label: "Disbursement Plan", icon: Banknote },
  { key: "banks", label: "Bank Selection", icon: Landmark },
] as const;

const PROJECT_STAGES = [
  "LAND_ACQUISITION",
  "APPROVALS",
  "CONSTRUCTION_EARLY",
  "CONSTRUCTION_MID",
  "CONSTRUCTION_ADVANCED",
  "NEAR_COMPLETION",
  "COMPLETED",
  "POSSESSION",
] as const;

const PROJECT_TYPES = ["Residential", "Commercial", "Mixed-Use", "Township"] as const;

const APPROVAL_TYPES = [
  "RERA",
  "COMMENCEMENT_CERTIFICATE",
  "IOD",
  "CC",
  "ENVIRONMENTAL_CLEARANCE",
  "FIRE_NOC",
  "BUILDING_PLAN",
  "ESCROW_AGREEMENT",
  "CA_CERTIFICATE",
  "ENGINEER_CERTIFICATE",
  "OTHER",
] as const;

const APPROVAL_STATUSES = ["OBTAINED", "APPLIED", "PENDING", "NOT_REQUIRED", "REJECTED"] as const;

const ENCUMBRANCE_STATUSES = ["CLEAR", "ENCUMBERED", "PARTIALLY_CLEAR", "UNDER_VERIFICATION"] as const;
const TITLE_STATUSES = ["CLEAR", "DISPUTED", "UNDER_LITIGATION", "UNDER_VERIFICATION"] as const;
const LAND_UNITS = ["sqft", "acres", "hectares"] as const;

const developerSchema = z.object({
  developerCompanyName: z.string().min(1, "Developer company name is required"),
  cin: z.string().optional(),
  pan: z.string().optional(),
  promoterName: z.string().optional(),
  din: z.string().optional(),
  contactEmail: z.string().email("Valid email required").optional().or(z.literal("")),
  contactPhone: z.string().optional(),
});

const projectSchema = z.object({
  projectName: z.string().min(1, "Project name is required"),
  reraNumber: z.string().optional(),
  reraState: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  address: z.string().optional(),
  projectStage: z.string().optional(),
  projectType: z.string().optional(),
  totalUnits: z.coerce.number().optional(),
  totalSalableArea: z.coerce.number().optional(),
  expectedCompletionDate: z.string().optional(),
  tenureMonths: z.coerce.number().optional(),
});

const landSchema = z.object({
  surveyNumber: z.string().optional(),
  plotNumber: z.string().optional(),
  totalLandArea: z.coerce.number().optional(),
  unit: z.string().optional(),
  landUseZone: z.string().optional(),
  encumbranceStatus: z.string().optional(),
  titleStatus: z.string().optional(),
  landOwnership: z.string().optional(),
  registrationNumber: z.string().optional(),
  registrationDate: z.string().optional(),
  marketValue: z.coerce.number().optional(),
  guidanceValue: z.coerce.number().optional(),
  purchaseValue: z.coerce.number().optional(),
});

const approvalItemSchema = z.object({
  approvalType: z.string().min(1, "Type required"),
  authority: z.string().optional(),
  number: z.string().optional(),
  date: z.string().optional(),
  expiry: z.string().optional(),
  status: z.string().optional(),
  isMandatory: z.boolean().optional(),
});

const financialSchema = z.object({
  financialYear: z.string().min(1, "FY required"),
  revenue: z.coerce.number().optional(),
  pat: z.coerce.number().optional(),
  netWorth: z.coerce.number().optional(),
  totalDebt: z.coerce.number().optional(),
  totalAssets: z.coerce.number().optional(),
  currentRatio: z.coerce.number().optional(),
  deRatio: z.coerce.number().optional(),
  dscr: z.coerce.number().optional(),
  interestCoverage: z.coerce.number().optional(),
  promoterContributionAmount: z.coerce.number().optional(),
  promoterContributionPercent: z.coerce.number().optional(),
  escrowBalance: z.coerce.number().optional(),
  auditedBy: z.string().optional(),
  itrFilingDate: z.string().optional(),
});

const cashflowRowSchema = z.object({
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2020).max(2040),
  label: z.string().optional(),
  inflowSales: z.coerce.number().optional(),
  inflowDisbursement: z.coerce.number().optional(),
  inflowOther: z.coerce.number().optional(),
  outflowConstruction: z.coerce.number().optional(),
  outflowLand: z.coerce.number().optional(),
  outflowInterest: z.coerce.number().optional(),
  outflowAdmin: z.coerce.number().optional(),
  outflowOther: z.coerce.number().optional(),
});

const trancheSchema = z.object({
  trancheNumber: z.coerce.number().min(1),
  milestoneName: z.string().min(1, "Milestone required"),
  description: z.string().optional(),
  completionPercent: z.coerce.number().min(0).max(100).optional(),
  amount: z.coerce.number().optional(),
  percentage: z.coerce.number().min(0).max(100).optional(),
});

interface ProjectFinanceWizardProps {
  applicationId: string;
  loanSubType?: string;
  onComplete: () => void;
  agentId?: string;
}

function formatCurrency(val: number | undefined): string {
  if (val === undefined || val === null || isNaN(val)) return "₹0";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);
}

function formatLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ProjectFinanceWizard({ applicationId, loanSubType, onComplete, agentId }: ProjectFinanceWizardProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const [approvals, setApprovals] = useState<z.infer<typeof approvalItemSchema>[]>([]);
  const [financials, setFinancials] = useState<z.infer<typeof financialSchema>[]>([]);
  const [cashflows, setCashflows] = useState<z.infer<typeof cashflowRowSchema>[]>([]);
  const [tranches, setTranches] = useState<z.infer<typeof trancheSchema>[]>([]);
  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);

  const [fundingInputs, setFundingInputs] = useState({
    totalProjectCost: 0,
    seniorDebt: 0,
    mezzanineDebt: 0,
    equity: 0,
    customerAdvances: 0,
    interestRate: 12,
    tenure: 60,
  });

  const developerForm = useForm({ resolver: zodResolver(developerSchema), defaultValues: { developerCompanyName: "", cin: "", pan: "", promoterName: "", din: "", contactEmail: "", contactPhone: "" } });
  const projectForm = useForm({ resolver: zodResolver(projectSchema), defaultValues: { projectName: "", reraNumber: "", reraState: "", city: "", state: "", address: "", projectStage: "", projectType: "", totalUnits: undefined, totalSalableArea: undefined, expectedCompletionDate: "", tenureMonths: undefined } });
  const landForm = useForm({ resolver: zodResolver(landSchema), defaultValues: { surveyNumber: "", plotNumber: "", totalLandArea: undefined, unit: "sqft", landUseZone: "", encumbranceStatus: "", titleStatus: "", landOwnership: "", registrationNumber: "", registrationDate: "", marketValue: undefined, guidanceValue: undefined, purchaseValue: undefined } });

  const { data: projectData, isLoading: loadingProject } = useQuery<any>({
    queryKey: ["/api/developer-finance/projects", projectId],
    enabled: !!projectId,
  });

  useEffect(() => {
    if (projectData?.success && projectData.data) {
      const p = projectData.data;
      developerForm.reset({
        developerCompanyName: p.developerName || "",
        cin: p.developerCin || "",
        pan: p.developerPan || "",
        promoterName: p.promoterName || "",
        din: p.promoterDin || "",
        contactEmail: p.contactEmail || "",
        contactPhone: p.contactPhone || "",
      });
      projectForm.reset({
        projectName: p.projectName || "",
        reraNumber: p.reraNumber || "",
        reraState: p.reraState || "",
        city: p.projectCity || "",
        state: p.projectState || "",
        address: p.projectAddress || "",
        projectStage: p.projectStage || "",
        projectType: p.projectType || "",
        totalUnits: p.totalUnits,
        totalSalableArea: p.totalSalableArea ? Number(p.totalSalableArea) : undefined,
        expectedCompletionDate: p.expectedCompletionDate || "",
        tenureMonths: p.projectTenureMonths,
      });
      if (p.landDetails) {
        landForm.reset({
          surveyNumber: p.landDetails.surveyNumber || "",
          plotNumber: p.landDetails.plotNumber || "",
          totalLandArea: p.landDetails.totalLandArea ? Number(p.landDetails.totalLandArea) : undefined,
          unit: p.landDetails.landAreaUnit || "sqft",
          landUseZone: p.landDetails.landUseZone || "",
          encumbranceStatus: p.landDetails.encumbranceStatus || "",
          titleStatus: p.landDetails.titleStatus || "",
          landOwnership: p.landDetails.landOwnership || "",
          registrationNumber: p.landDetails.registrationNumber || "",
          registrationDate: p.landDetails.registrationDate || "",
          marketValue: p.landDetails.marketValue ? Number(p.landDetails.marketValue) : undefined,
          guidanceValue: p.landDetails.guidanceValue ? Number(p.landDetails.guidanceValue) : undefined,
          purchaseValue: p.landDetails.purchaseValue ? Number(p.landDetails.purchaseValue) : undefined,
        });
      }
      if (p.approvals?.length) setApprovals(p.approvals);
      if (p.financials?.length) setFinancials(p.financials);
      if (p.cashflows?.length) setCashflows(p.cashflows);
    }
  }, [projectData]);

  const createProjectMutation = useMutation({
    mutationFn: async (data: any) => {
      const mapped = {
        developerName: data.developerCompanyName,
        developerCin: data.cin,
        developerPan: data.pan,
        promoterName: data.promoterName,
        promoterDin: data.din,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        projectName: `${data.developerCompanyName || "New"} Project`,
        applicationId,
        agentId,
      };
      return apiRequest("/api/developer-finance/projects", { method: "POST", body: JSON.stringify(mapped) });
    },
    onSuccess: (res) => {
      if (res?.data?.id) {
        setProjectId(res.data.id);
        toast({ title: "Project Created", description: "Developer project has been created." });
        markStepComplete(0);
      }
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateProjectMutation = useMutation({
    mutationFn: async (data: any) => {
      const mapped: Record<string, any> = {};
      if (data.developerCompanyName !== undefined) mapped.developerName = data.developerCompanyName;
      if (data.cin !== undefined) mapped.developerCin = data.cin;
      if (data.pan !== undefined) mapped.developerPan = data.pan;
      if (data.promoterName !== undefined) mapped.promoterName = data.promoterName;
      if (data.din !== undefined) mapped.promoterDin = data.din;
      if (data.contactEmail !== undefined) mapped.contactEmail = data.contactEmail;
      if (data.contactPhone !== undefined) mapped.contactPhone = data.contactPhone;
      if (data.projectName !== undefined) mapped.projectName = data.projectName;
      if (data.reraNumber !== undefined) mapped.reraNumber = data.reraNumber;
      if (data.reraState !== undefined) mapped.reraState = data.reraState;
      if (data.city !== undefined) mapped.projectCity = data.city;
      if (data.state !== undefined) mapped.projectState = data.state;
      if (data.address !== undefined) mapped.projectAddress = data.address;
      if (data.projectStage !== undefined) mapped.projectStage = data.projectStage;
      if (data.projectType !== undefined) mapped.projectType = data.projectType;
      if (data.totalUnits !== undefined) mapped.totalUnits = data.totalUnits;
      if (data.totalSalableArea !== undefined) mapped.totalSalableArea = data.totalSalableArea;
      if (data.expectedCompletionDate !== undefined) mapped.expectedCompletionDate = data.expectedCompletionDate;
      if (data.tenureMonths !== undefined) mapped.projectTenureMonths = data.tenureMonths;
      return apiRequest(`/api/developer-finance/projects/${projectId}`, { method: "PATCH", body: JSON.stringify(mapped) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer-finance/projects", projectId] });
      toast({ title: "Saved", description: "Project details updated." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const saveLandMutation = useMutation({
    mutationFn: async (data: any) => {
      const mapped = { ...data, landAreaUnit: data.unit };
      delete mapped.unit;
      return apiRequest(`/api/developer-finance/projects/${projectId}/land`, { method: "POST", body: JSON.stringify(mapped) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer-finance/projects", projectId] });
      toast({ title: "Saved", description: "Land details saved." });
      markStepComplete(2);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const saveApprovalMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/developer-finance/projects/${projectId}/approvals`, { method: "POST", body: JSON.stringify(data) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer-finance/projects", projectId] });
      toast({ title: "Saved", description: "Approval saved." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const saveFinancialMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/developer-finance/projects/${projectId}/financials`, { method: "POST", body: JSON.stringify(data) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer-finance/projects", projectId] });
      toast({ title: "Saved", description: "Financial data saved." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const saveCashflowsMutation = useMutation({
    mutationFn: async (data: any[]) => {
      return apiRequest(`/api/developer-finance/projects/${projectId}/cashflows/bulk`, { method: "POST", body: JSON.stringify({ cashflows: data }) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer-finance/projects", projectId] });
      toast({ title: "Saved", description: "Cashflow data saved." });
      markStepComplete(5);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const calculateFundingMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/developer-finance/calculate-funding", { method: "POST", body: JSON.stringify(data) });
    },
  });

  const saveTrancheMutation = useMutation({
    mutationFn: async (data: any[]) => {
      return apiRequest(`/api/developer-finance/applications/${applicationId}/tranches/bulk`, { method: "POST", body: JSON.stringify({ tranches: data }) });
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Disbursement tranches saved." });
      markStepComplete(8);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const { data: creditSummary, isLoading: loadingCredit, refetch: refetchCredit } = useQuery<any>({
    queryKey: ["/api/developer-finance/projects", projectId, "credit-summary"],
    enabled: currentStep === 7 && !!projectId,
  });

  const [lenderMatchResults, setLenderMatchResults] = useState<any>(null);
  const [loadingLenderMatch, setLoadingLenderMatch] = useState(false);
  const [showDisqualified, setShowDisqualified] = useState(false);

  const fetchLenderMatches = useCallback(async () => {
    setLoadingLenderMatch(true);
    try {
      const projectValues = projectForm.getValues();
      const totalCost = fundingInputs.totalProjectCost;
      const rules = creditSummary?.data?.creditRules || [];
      const extractNumeric = (rulePrefix: string) => {
        const found = rules.find((r: any) => r.rule?.startsWith(rulePrefix));
        if (!found) return undefined;
        const num = parseFloat(String(found.value).replace(/[%x,]/g, ''));
        return isNaN(num) ? undefined : num;
      };
      const res = await fetch("/api/developer-finance/match-lenders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          loanSubType: loanSubType || "PROJECT_FUNDING",
          projectStage: projectValues.projectStage || undefined,
          ticketSize: totalCost || undefined,
          city: projectValues.city || undefined,
          dscr: extractNumeric("DSCR"),
          ltv: extractNumeric("LTV"),
          promoterContribution: extractNumeric("Promoter Contribution"),
          trackRecordProjects: undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setLenderMatchResults(data.data);
      } else {
        toast({ title: "Matching failed", description: data.error || "Could not match lenders", variant: "destructive" });
      }
    } catch (err) {
      console.error("Lender match error:", err);
      toast({ title: "Error", description: "Failed to run lender matching engine", variant: "destructive" });
    } finally {
      setLoadingLenderMatch(false);
    }
  }, [loanSubType, projectForm, fundingInputs, creditSummary, toast]);

  useEffect(() => {
    if (currentStep === 9 && !lenderMatchResults && !loadingLenderMatch) {
      fetchLenderMatches();
    }
  }, [currentStep]);

  const markStepComplete = useCallback((step: number) => {
    setCompletedSteps((prev) => new Set([...prev, step]));
  }, []);

  const handleStepChange = useCallback(async (newStep: number) => {
    if (newStep === currentStep) return;

    try {
      if (currentStep === 0) {
        const valid = await developerForm.trigger();
        if (valid) {
          const data = developerForm.getValues();
          if (!projectId) {
            createProjectMutation.mutate(data);
          } else {
            updateProjectMutation.mutate(data);
            markStepComplete(0);
          }
        }
      } else if (currentStep === 1 && projectId) {
        const valid = await projectForm.trigger();
        if (valid) {
          updateProjectMutation.mutate(projectForm.getValues());
          markStepComplete(1);
        }
      } else if (currentStep === 2 && projectId) {
        const valid = await landForm.trigger();
        if (valid) {
          saveLandMutation.mutate(landForm.getValues());
        }
      } else if (currentStep === 3 && projectId && approvals.length > 0) {
        for (const a of approvals) {
          saveApprovalMutation.mutate(a);
        }
        markStepComplete(3);
      } else if (currentStep === 4 && projectId && financials.length > 0) {
        for (const f of financials) {
          saveFinancialMutation.mutate(f);
        }
        markStepComplete(4);
      } else if (currentStep === 5 && projectId && cashflows.length > 0) {
        saveCashflowsMutation.mutate(cashflows);
      } else if (currentStep === 6) {
        markStepComplete(6);
      } else if (currentStep === 8 && tranches.length > 0) {
        saveTrancheMutation.mutate(tranches);
      }
    } catch (err) {
      // silent
    }

    setCurrentStep(newStep);
  }, [currentStep, projectId, approvals, financials, cashflows, tranches]);

  const fundingMetrics = useMemo(() => {
    const { totalProjectCost, seniorDebt, mezzanineDebt, equity, customerAdvances, interestRate, tenure } = fundingInputs;
    const totalDebt = seniorDebt + mezzanineDebt;
    const totalFunding = totalDebt + equity + customerAdvances;
    const ltc = totalProjectCost > 0 ? (totalDebt / totalProjectCost) * 100 : 0;
    const ltv = totalProjectCost > 0 ? (totalDebt / (totalProjectCost * 1.1)) * 100 : 0;
    const equityPercent = totalFunding > 0 ? (equity / totalFunding) * 100 : 0;
    const leverage = equity > 0 ? totalDebt / equity : 0;
    const annualInterest = totalDebt * (interestRate / 100);
    const monthlyRate = interestRate / 100 / 12;
    const monthlyEmi = monthlyRate > 0 && tenure > 0 ? (totalDebt * monthlyRate * Math.pow(1 + monthlyRate, tenure)) / (Math.pow(1 + monthlyRate, tenure) - 1) : 0;
    const totalInterest = monthlyEmi * tenure - totalDebt;

    return { ltc, ltv, equityPercent, leverage, annualInterest, monthlyEmi: isNaN(monthlyEmi) ? 0 : monthlyEmi, totalInterest: isNaN(totalInterest) ? 0 : totalInterest, totalFunding, totalDebt };
  }, [fundingInputs]);

  const cashflowComputed = useMemo(() => {
    let cumulative = 0;
    return cashflows.map((row) => {
      const totalInflow = (row.inflowSales || 0) + (row.inflowDisbursement || 0) + (row.inflowOther || 0);
      const totalOutflow = (row.outflowConstruction || 0) + (row.outflowLand || 0) + (row.outflowInterest || 0) + (row.outflowAdmin || 0) + (row.outflowOther || 0);
      const net = totalInflow - totalOutflow;
      cumulative += net;
      return { ...row, totalInflow, totalOutflow, net, cumulative };
    });
  }, [cashflows]);

  const renderStepIndicator = (stepIndex: number) => {
    if (completedSteps.has(stepIndex)) {
      return <CheckCircle2 className="h-3 w-3 text-green-600" />;
    }
    return null;
  };

  const isSaving = createProjectMutation.isPending || updateProjectMutation.isPending || saveLandMutation.isPending || saveApprovalMutation.isPending || saveFinancialMutation.isPending || saveCashflowsMutation.isPending || saveTrancheMutation.isPending;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Project Finance Wizard
              </CardTitle>
              <CardDescription>Complete all steps to submit your Developer/Project Finance application</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <Badge variant="outline">{completedSteps.size}/{STEPS.length} steps completed</Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs value={STEPS[currentStep].key} onValueChange={(val) => { const idx = STEPS.findIndex((s) => s.key === val); if (idx >= 0) handleStepChange(idx); }}>
        <ScrollableTabsList>
          {STEPS.map((step, idx) => (
            <TabsTrigger key={step.key} value={step.key} className="flex items-center gap-1.5 text-xs whitespace-nowrap">
              <step.icon className="h-3.5 w-3.5" />
              {step.label}
              {renderStepIndicator(idx)}
            </TabsTrigger>
          ))}
        </ScrollableTabsList>

        {/* Step 1: Developer Info */}
        <TabsContent value="developer">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Developer Information</CardTitle>
              <CardDescription>Enter the developer/builder company details</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...developerForm}>
                <form className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={developerForm.control} name="developerCompanyName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Developer Company Name *</FormLabel>
                        <FormControl><Input placeholder="Enter company name" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={developerForm.control} name="cin" render={({ field }) => (
                      <FormItem>
                        <FormLabel>CIN</FormLabel>
                        <FormControl><Input placeholder="Corporate Identity Number" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={developerForm.control} name="pan" render={({ field }) => (
                      <FormItem>
                        <FormLabel>PAN</FormLabel>
                        <FormControl><Input placeholder="PAN number" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={developerForm.control} name="promoterName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Promoter Name</FormLabel>
                        <FormControl><Input placeholder="Promoter full name" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={developerForm.control} name="din" render={({ field }) => (
                      <FormItem>
                        <FormLabel>DIN</FormLabel>
                        <FormControl><Input placeholder="Director Identification Number" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={developerForm.control} name="contactEmail" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Email</FormLabel>
                        <FormControl><Input placeholder="email@example.com" type="email" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={developerForm.control} name="contactPhone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Phone</FormLabel>
                        <FormControl><Input placeholder="Phone number" {...field} /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Step 2: Project Details */}
        <TabsContent value="project">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Project Details</CardTitle>
              <CardDescription>Provide project specifications and timeline</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...projectForm}>
                <form className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={projectForm.control} name="projectName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Name *</FormLabel>
                        <FormControl><Input placeholder="Project name" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={projectForm.control} name="reraNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel>RERA Number</FormLabel>
                        <FormControl><Input placeholder="RERA registration number" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={projectForm.control} name="reraState" render={({ field }) => (
                      <FormItem>
                        <FormLabel>RERA State</FormLabel>
                        <FormControl><Input placeholder="State of RERA registration" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={projectForm.control} name="city" render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl><Input placeholder="City" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={projectForm.control} name="state" render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl><Input placeholder="State" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={projectForm.control} name="address" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl><Input placeholder="Full project address" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={projectForm.control} name="projectStage" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Stage</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {PROJECT_STAGES.map((s) => <SelectItem key={s} value={s}>{formatLabel(s)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={projectForm.control} name="projectType" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {PROJECT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={projectForm.control} name="totalUnits" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Units</FormLabel>
                        <FormControl><Input type="number" placeholder="Number of units" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={projectForm.control} name="totalSalableArea" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Salable Area (sqft)</FormLabel>
                        <FormControl><Input type="number" placeholder="Salable area in sqft" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={projectForm.control} name="expectedCompletionDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expected Completion Date</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={projectForm.control} name="tenureMonths" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tenure (months)</FormLabel>
                        <FormControl><Input type="number" placeholder="Loan tenure in months" {...field} /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Step 3: Land Details */}
        <TabsContent value="land">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Land Details</CardTitle>
              <CardDescription>Provide land information, ownership and valuation details</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...landForm}>
                <form className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <FormField control={landForm.control} name="surveyNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Survey Number</FormLabel>
                        <FormControl><Input placeholder="Survey number" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={landForm.control} name="plotNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Plot Number</FormLabel>
                        <FormControl><Input placeholder="Plot number" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={landForm.control} name="totalLandArea" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Land Area</FormLabel>
                        <FormControl><Input type="number" placeholder="Total area" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={landForm.control} name="unit" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {LAND_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={landForm.control} name="landUseZone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Land Use Zone</FormLabel>
                        <FormControl><Input placeholder="Zone classification" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={landForm.control} name="encumbranceStatus" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Encumbrance Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {ENCUMBRANCE_STATUSES.map((s) => <SelectItem key={s} value={s}>{formatLabel(s)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={landForm.control} name="titleStatus" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {TITLE_STATUSES.map((s) => <SelectItem key={s} value={s}>{formatLabel(s)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={landForm.control} name="landOwnership" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Land Ownership</FormLabel>
                        <FormControl><Input placeholder="Owner name/entity" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={landForm.control} name="registrationNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Registration Number</FormLabel>
                        <FormControl><Input placeholder="Registration number" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={landForm.control} name="registrationDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Registration Date</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                  <Separator />
                  <h4 className="font-medium text-sm">Valuation Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={landForm.control} name="marketValue" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Market Value (₹)</FormLabel>
                        <FormControl><Input type="number" placeholder="Market value" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={landForm.control} name="guidanceValue" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Guidance Value (₹)</FormLabel>
                        <FormControl><Input type="number" placeholder="Guidance value" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={landForm.control} name="purchaseValue" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Value (₹)</FormLabel>
                        <FormControl><Input type="number" placeholder="Purchase value" {...field} /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Step 4: Approvals */}
        <TabsContent value="approvals">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Approvals & Clearances</CardTitle>
                  <CardDescription>Add all regulatory approvals for this project</CardDescription>
                </div>
                <Button size="sm" onClick={() => setApprovals([...approvals, { approvalType: "", authority: "", number: "", date: "", expiry: "", status: "PENDING", isMandatory: false }])}>
                  <Plus className="h-4 w-4 mr-1" /> Add Approval
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {approvals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShieldCheck className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>No approvals added yet. Click "Add Approval" to begin.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {approvals.map((approval, idx) => (
                    <div key={idx} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Approval #{idx + 1}</span>
                        <Button variant="ghost" size="sm" onClick={() => setApprovals(approvals.filter((_, i) => i !== idx))}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="text-sm font-medium">Type *</label>
                          <Select value={approval.approvalType} onValueChange={(v) => { const a = [...approvals]; a[idx] = { ...a[idx], approvalType: v }; setApprovals(a); }}>
                            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                            <SelectContent>
                              {APPROVAL_TYPES.map((t) => <SelectItem key={t} value={t}>{formatLabel(t)}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Authority</label>
                          <Input value={approval.authority || ""} onChange={(e) => { const a = [...approvals]; a[idx] = { ...a[idx], authority: e.target.value }; setApprovals(a); }} placeholder="Issuing authority" />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Number</label>
                          <Input value={approval.number || ""} onChange={(e) => { const a = [...approvals]; a[idx] = { ...a[idx], number: e.target.value }; setApprovals(a); }} placeholder="Approval number" />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Date</label>
                          <Input type="date" value={approval.date || ""} onChange={(e) => { const a = [...approvals]; a[idx] = { ...a[idx], date: e.target.value }; setApprovals(a); }} />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Expiry</label>
                          <Input type="date" value={approval.expiry || ""} onChange={(e) => { const a = [...approvals]; a[idx] = { ...a[idx], expiry: e.target.value }; setApprovals(a); }} />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Status</label>
                          <Select value={approval.status || ""} onValueChange={(v) => { const a = [...approvals]; a[idx] = { ...a[idx], status: v }; setApprovals(a); }}>
                            <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                            <SelectContent>
                              {APPROVAL_STATUSES.map((s) => <SelectItem key={s} value={s}>{formatLabel(s)}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox checked={approval.isMandatory || false} onCheckedChange={(checked) => { const a = [...approvals]; a[idx] = { ...a[idx], isMandatory: !!checked }; setApprovals(a); }} />
                        <label className="text-sm">Is Mandatory</label>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Step 5: Financials */}
        <TabsContent value="financials">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Developer Financials</CardTitle>
                  <CardDescription>Add financial year data for the developer entity</CardDescription>
                </div>
                <Button size="sm" onClick={() => setFinancials([...financials, { financialYear: "", revenue: undefined, pat: undefined, netWorth: undefined, totalDebt: undefined, totalAssets: undefined, currentRatio: undefined, deRatio: undefined, dscr: undefined, interestCoverage: undefined, promoterContributionAmount: undefined, promoterContributionPercent: undefined, escrowBalance: undefined, auditedBy: "", itrFilingDate: "" }])}>
                  <Plus className="h-4 w-4 mr-1" /> Add FY
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {financials.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>No financial data added yet.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {financials.map((fin, idx) => (
                    <div key={idx} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Financial Year #{idx + 1}</span>
                        <Button variant="ghost" size="sm" onClick={() => setFinancials(financials.filter((_, i) => i !== idx))}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="text-sm font-medium">Financial Year *</label>
                          <Input value={fin.financialYear} onChange={(e) => { const f = [...financials]; f[idx] = { ...f[idx], financialYear: e.target.value }; setFinancials(f); }} placeholder="e.g. FY2024-25" />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Revenue (₹)</label>
                          <Input type="number" value={fin.revenue ?? ""} onChange={(e) => { const f = [...financials]; f[idx] = { ...f[idx], revenue: e.target.value ? Number(e.target.value) : undefined }; setFinancials(f); }} />
                        </div>
                        <div>
                          <label className="text-sm font-medium">PAT (₹)</label>
                          <Input type="number" value={fin.pat ?? ""} onChange={(e) => { const f = [...financials]; f[idx] = { ...f[idx], pat: e.target.value ? Number(e.target.value) : undefined }; setFinancials(f); }} />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Net Worth (₹)</label>
                          <Input type="number" value={fin.netWorth ?? ""} onChange={(e) => { const f = [...financials]; f[idx] = { ...f[idx], netWorth: e.target.value ? Number(e.target.value) : undefined }; setFinancials(f); }} />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Total Debt (₹)</label>
                          <Input type="number" value={fin.totalDebt ?? ""} onChange={(e) => { const f = [...financials]; f[idx] = { ...f[idx], totalDebt: e.target.value ? Number(e.target.value) : undefined }; setFinancials(f); }} />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Total Assets (₹)</label>
                          <Input type="number" value={fin.totalAssets ?? ""} onChange={(e) => { const f = [...financials]; f[idx] = { ...f[idx], totalAssets: e.target.value ? Number(e.target.value) : undefined }; setFinancials(f); }} />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Current Ratio</label>
                          <Input type="number" step="0.01" value={fin.currentRatio ?? ""} onChange={(e) => { const f = [...financials]; f[idx] = { ...f[idx], currentRatio: e.target.value ? Number(e.target.value) : undefined }; setFinancials(f); }} />
                        </div>
                        <div>
                          <label className="text-sm font-medium">D/E Ratio</label>
                          <Input type="number" step="0.01" value={fin.deRatio ?? ""} onChange={(e) => { const f = [...financials]; f[idx] = { ...f[idx], deRatio: e.target.value ? Number(e.target.value) : undefined }; setFinancials(f); }} />
                        </div>
                        <div>
                          <label className="text-sm font-medium">DSCR</label>
                          <Input type="number" step="0.01" value={fin.dscr ?? ""} onChange={(e) => { const f = [...financials]; f[idx] = { ...f[idx], dscr: e.target.value ? Number(e.target.value) : undefined }; setFinancials(f); }} />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Interest Coverage</label>
                          <Input type="number" step="0.01" value={fin.interestCoverage ?? ""} onChange={(e) => { const f = [...financials]; f[idx] = { ...f[idx], interestCoverage: e.target.value ? Number(e.target.value) : undefined }; setFinancials(f); }} />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Promoter Contribution (₹)</label>
                          <Input type="number" value={fin.promoterContributionAmount ?? ""} onChange={(e) => { const f = [...financials]; f[idx] = { ...f[idx], promoterContributionAmount: e.target.value ? Number(e.target.value) : undefined }; setFinancials(f); }} />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Promoter Contribution (%)</label>
                          <Input type="number" step="0.01" value={fin.promoterContributionPercent ?? ""} onChange={(e) => { const f = [...financials]; f[idx] = { ...f[idx], promoterContributionPercent: e.target.value ? Number(e.target.value) : undefined }; setFinancials(f); }} />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Escrow Balance (₹)</label>
                          <Input type="number" value={fin.escrowBalance ?? ""} onChange={(e) => { const f = [...financials]; f[idx] = { ...f[idx], escrowBalance: e.target.value ? Number(e.target.value) : undefined }; setFinancials(f); }} />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Audited By</label>
                          <Input value={fin.auditedBy || ""} onChange={(e) => { const f = [...financials]; f[idx] = { ...f[idx], auditedBy: e.target.value }; setFinancials(f); }} placeholder="Auditor name" />
                        </div>
                        <div>
                          <label className="text-sm font-medium">ITR Filing Date</label>
                          <Input type="date" value={fin.itrFilingDate || ""} onChange={(e) => { const f = [...financials]; f[idx] = { ...f[idx], itrFilingDate: e.target.value }; setFinancials(f); }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Step 6: Cashflow */}
        <TabsContent value="cashflow">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Monthly Cashflow Projections</CardTitle>
                  <CardDescription>Add monthly inflow and outflow projections</CardDescription>
                </div>
                <Button size="sm" onClick={() => {
                  const now = new Date();
                  setCashflows([...cashflows, { month: now.getMonth() + 1, year: now.getFullYear(), label: "", inflowSales: 0, inflowDisbursement: 0, inflowOther: 0, outflowConstruction: 0, outflowLand: 0, outflowInterest: 0, outflowAdmin: 0, outflowOther: 0 }]);
                }}>
                  <Plus className="h-4 w-4 mr-1" /> Add Row
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {cashflows.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>No cashflow data. Click "Add Row" to start projecting.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[60px]">Month</TableHead>
                        <TableHead className="min-w-[60px]">Year</TableHead>
                        <TableHead className="min-w-[100px]">Label</TableHead>
                        <TableHead className="min-w-[90px]">Sales</TableHead>
                        <TableHead className="min-w-[90px]">Disbursement</TableHead>
                        <TableHead className="min-w-[90px]">Other In</TableHead>
                        <TableHead className="min-w-[90px]">Construction</TableHead>
                        <TableHead className="min-w-[90px]">Land</TableHead>
                        <TableHead className="min-w-[90px]">Interest</TableHead>
                        <TableHead className="min-w-[90px]">Admin</TableHead>
                        <TableHead className="min-w-[90px]">Other Out</TableHead>
                        <TableHead className="min-w-[90px]">Net</TableHead>
                        <TableHead className="min-w-[90px]">Cumulative</TableHead>
                        <TableHead className="w-[40px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cashflowComputed.map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell><Input type="number" min={1} max={12} className="w-16" value={row.month} onChange={(e) => { const c = [...cashflows]; c[idx] = { ...c[idx], month: Number(e.target.value) }; setCashflows(c); }} /></TableCell>
                          <TableCell><Input type="number" className="w-20" value={row.year} onChange={(e) => { const c = [...cashflows]; c[idx] = { ...c[idx], year: Number(e.target.value) }; setCashflows(c); }} /></TableCell>
                          <TableCell><Input className="w-24" value={row.label || ""} onChange={(e) => { const c = [...cashflows]; c[idx] = { ...c[idx], label: e.target.value }; setCashflows(c); }} /></TableCell>
                          <TableCell><Input type="number" className="w-20" value={row.inflowSales ?? 0} onChange={(e) => { const c = [...cashflows]; c[idx] = { ...c[idx], inflowSales: Number(e.target.value) }; setCashflows(c); }} /></TableCell>
                          <TableCell><Input type="number" className="w-20" value={row.inflowDisbursement ?? 0} onChange={(e) => { const c = [...cashflows]; c[idx] = { ...c[idx], inflowDisbursement: Number(e.target.value) }; setCashflows(c); }} /></TableCell>
                          <TableCell><Input type="number" className="w-20" value={row.inflowOther ?? 0} onChange={(e) => { const c = [...cashflows]; c[idx] = { ...c[idx], inflowOther: Number(e.target.value) }; setCashflows(c); }} /></TableCell>
                          <TableCell><Input type="number" className="w-20" value={row.outflowConstruction ?? 0} onChange={(e) => { const c = [...cashflows]; c[idx] = { ...c[idx], outflowConstruction: Number(e.target.value) }; setCashflows(c); }} /></TableCell>
                          <TableCell><Input type="number" className="w-20" value={row.outflowLand ?? 0} onChange={(e) => { const c = [...cashflows]; c[idx] = { ...c[idx], outflowLand: Number(e.target.value) }; setCashflows(c); }} /></TableCell>
                          <TableCell><Input type="number" className="w-20" value={row.outflowInterest ?? 0} onChange={(e) => { const c = [...cashflows]; c[idx] = { ...c[idx], outflowInterest: Number(e.target.value) }; setCashflows(c); }} /></TableCell>
                          <TableCell><Input type="number" className="w-20" value={row.outflowAdmin ?? 0} onChange={(e) => { const c = [...cashflows]; c[idx] = { ...c[idx], outflowAdmin: Number(e.target.value) }; setCashflows(c); }} /></TableCell>
                          <TableCell><Input type="number" className="w-20" value={row.outflowOther ?? 0} onChange={(e) => { const c = [...cashflows]; c[idx] = { ...c[idx], outflowOther: Number(e.target.value) }; setCashflows(c); }} /></TableCell>
                          <TableCell className={row.net >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>{formatCurrency(row.net)}</TableCell>
                          <TableCell className={row.cumulative >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>{formatCurrency(row.cumulative)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => setCashflows(cashflows.filter((_, i) => i !== idx))}>
                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Step 7: Funding Structure */}
        <TabsContent value="funding">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Funding Structure Calculator</CardTitle>
              <CardDescription>Configure the funding mix and review key financial metrics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium">Total Project Cost (₹)</label>
                  <Input type="number" value={fundingInputs.totalProjectCost || ""} onChange={(e) => setFundingInputs({ ...fundingInputs, totalProjectCost: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Senior Debt (₹)</label>
                  <Input type="number" value={fundingInputs.seniorDebt || ""} onChange={(e) => setFundingInputs({ ...fundingInputs, seniorDebt: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Mezzanine Debt (₹)</label>
                  <Input type="number" value={fundingInputs.mezzanineDebt || ""} onChange={(e) => setFundingInputs({ ...fundingInputs, mezzanineDebt: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Equity (₹)</label>
                  <Input type="number" value={fundingInputs.equity || ""} onChange={(e) => setFundingInputs({ ...fundingInputs, equity: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Customer Advances (₹)</label>
                  <Input type="number" value={fundingInputs.customerAdvances || ""} onChange={(e) => setFundingInputs({ ...fundingInputs, customerAdvances: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Interest Rate (%)</label>
                  <Input type="number" step="0.25" value={fundingInputs.interestRate || ""} onChange={(e) => setFundingInputs({ ...fundingInputs, interestRate: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Tenure (months)</label>
                  <Input type="number" value={fundingInputs.tenure || ""} onChange={(e) => setFundingInputs({ ...fundingInputs, tenure: Number(e.target.value) })} />
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-3">Calculated Metrics</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="p-3">
                    <p className="text-xs text-muted-foreground">Total Funding</p>
                    <p className="text-lg font-bold">{formatCurrency(fundingMetrics.totalFunding)}</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-muted-foreground">Annual Interest</p>
                    <p className="text-lg font-bold">{formatCurrency(fundingMetrics.annualInterest)}</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-muted-foreground">Monthly EMI</p>
                    <p className="text-lg font-bold">{formatCurrency(fundingMetrics.monthlyEmi)}</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-muted-foreground">Total Interest</p>
                    <p className="text-lg font-bold">{formatCurrency(fundingMetrics.totalInterest)}</p>
                  </Card>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-3">Validation Checks</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="flex items-center gap-2 p-3 border rounded-lg">
                    {fundingMetrics.ltc <= 75 ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
                    <div>
                      <p className="text-xs text-muted-foreground">LTC ≤ 75%</p>
                      <p className="font-semibold">{fundingMetrics.ltc.toFixed(1)}%</p>
                    </div>
                    <Badge variant={fundingMetrics.ltc <= 75 ? "default" : "destructive"} className="ml-auto text-xs">
                      {fundingMetrics.ltc <= 75 ? "PASS" : "FAIL"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 p-3 border rounded-lg">
                    {fundingMetrics.ltv <= 80 ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
                    <div>
                      <p className="text-xs text-muted-foreground">LTV ≤ 80%</p>
                      <p className="font-semibold">{fundingMetrics.ltv.toFixed(1)}%</p>
                    </div>
                    <Badge variant={fundingMetrics.ltv <= 80 ? "default" : "destructive"} className="ml-auto text-xs">
                      {fundingMetrics.ltv <= 80 ? "PASS" : "FAIL"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 p-3 border rounded-lg">
                    {fundingMetrics.equityPercent >= 20 ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
                    <div>
                      <p className="text-xs text-muted-foreground">Equity ≥ 20%</p>
                      <p className="font-semibold">{fundingMetrics.equityPercent.toFixed(1)}%</p>
                    </div>
                    <Badge variant={fundingMetrics.equityPercent >= 20 ? "default" : "destructive"} className="ml-auto text-xs">
                      {fundingMetrics.equityPercent >= 20 ? "PASS" : "FAIL"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 p-3 border rounded-lg">
                    {fundingMetrics.leverage <= 3 ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
                    <div>
                      <p className="text-xs text-muted-foreground">Leverage ≤ 3x</p>
                      <p className="font-semibold">{fundingMetrics.leverage.toFixed(2)}x</p>
                    </div>
                    <Badge variant={fundingMetrics.leverage <= 3 ? "default" : "destructive"} className="ml-auto text-xs">
                      {fundingMetrics.leverage <= 3 ? "PASS" : "FAIL"}
                    </Badge>
                  </div>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => calculateFundingMutation.mutate(fundingInputs)}
                disabled={calculateFundingMutation.isPending}
              >
                {calculateFundingMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Calculator className="h-4 w-4 mr-2" />
                Calculate via API
              </Button>

              {calculateFundingMutation.data?.data && (
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <h5 className="font-medium text-sm">API Calculation Results</h5>
                  <pre className="text-xs overflow-auto">{JSON.stringify(calculateFundingMutation.data.data, null, 2)}</pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Step 8: Credit Summary */}
        <TabsContent value="credit">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Credit Summary & Assessment</CardTitle>
                  <CardDescription>Automated credit analysis based on project data</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchCredit()} disabled={loadingCredit}>
                  <RefreshCw className={`h-4 w-4 mr-1 ${loadingCredit ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!projectId ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Info className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>Create a project first to view credit summary.</p>
                </div>
              ) : loadingCredit ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : creditSummary?.data ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">Credit Verdict:</span>
                    <Badge
                      variant={creditSummary.data.creditVerdict === "APPROVE" ? "default" : creditSummary.data.creditVerdict === "REJECT" ? "destructive" : "secondary"}
                      className="text-sm px-3 py-1"
                    >
                      {creditSummary.data.creditVerdict}
                    </Badge>
                    <span className="text-sm text-muted-foreground ml-auto">
                      {creditSummary.data.passCount}/{creditSummary.data.totalRules} rules passed
                    </span>
                  </div>

                  <Separator />

                  {creditSummary.data.metrics && (
                    <div>
                      <h4 className="font-medium mb-3">Key Metrics</h4>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {[
                          { label: "DSCR", value: creditSummary.data.metrics.dscr?.toFixed(2) || "N/A" },
                          { label: "LTV", value: creditSummary.data.metrics.ltv ? `${creditSummary.data.metrics.ltv.toFixed(1)}%` : "N/A" },
                          { label: "LTC", value: creditSummary.data.metrics.ltc ? `${creditSummary.data.metrics.ltc.toFixed(1)}%` : "N/A" },
                          { label: "IRR", value: creditSummary.data.metrics.irr ? `${creditSummary.data.metrics.irr.toFixed(1)}%` : "N/A" },
                          { label: "Promoter %", value: creditSummary.data.metrics.promoterContribution ? `${creditSummary.data.metrics.promoterContribution.toFixed(1)}%` : "N/A" },
                        ].map((m) => (
                          <Card key={m.label} className="p-3 text-center">
                            <p className="text-xs text-muted-foreground">{m.label}</p>
                            <p className="text-xl font-bold">{m.value}</p>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {creditSummary.data.creditRules?.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3">Credit Rules</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Rule</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {creditSummary.data.creditRules.map((rule: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{rule.name || rule.rule}</TableCell>
                              <TableCell>
                                {rule.passed ? (
                                  <Badge variant="default" className="bg-green-100 text-green-800">
                                    <CheckCircle2 className="h-3 w-3 mr-1" /> Pass
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive">
                                    <XCircle className="h-3 w-3 mr-1" /> Fail
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{rule.detail || rule.message || "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {creditSummary.data.riskFlags?.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        Risk Flags
                      </h4>
                      <div className="space-y-2">
                        {creditSummary.data.riskFlags.map((flag: string, idx: number) => (
                          <div key={idx} className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-200 dark:border-amber-800">
                            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                            <span className="text-sm">{flag}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardCheck className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>No credit summary available. Add project data first and then refresh.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Step 9: Disbursement Plan */}
        <TabsContent value="disbursement">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Disbursement Plan</CardTitle>
                  <CardDescription>Define milestone-based disbursement tranches</CardDescription>
                </div>
                <Button size="sm" onClick={() => setTranches([...tranches, { trancheNumber: tranches.length + 1, milestoneName: "", description: "", completionPercent: 0, amount: 0, percentage: 0 }])}>
                  <Plus className="h-4 w-4 mr-1" /> Add Tranche
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {tranches.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Banknote className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>No disbursement tranches defined. Click "Add Tranche" to begin.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">#</TableHead>
                      <TableHead>Milestone</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Completion %</TableHead>
                      <TableHead>Amount (₹)</TableHead>
                      <TableHead>Percentage</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tranches.map((tranche, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Input type="number" className="w-14" value={tranche.trancheNumber} onChange={(e) => { const t = [...tranches]; t[idx] = { ...t[idx], trancheNumber: Number(e.target.value) }; setTranches(t); }} />
                        </TableCell>
                        <TableCell>
                          <Input value={tranche.milestoneName} onChange={(e) => { const t = [...tranches]; t[idx] = { ...t[idx], milestoneName: e.target.value }; setTranches(t); }} placeholder="Milestone name" />
                        </TableCell>
                        <TableCell>
                          <Input value={tranche.description || ""} onChange={(e) => { const t = [...tranches]; t[idx] = { ...t[idx], description: e.target.value }; setTranches(t); }} placeholder="Description" />
                        </TableCell>
                        <TableCell>
                          <Input type="number" className="w-20" value={tranche.completionPercent ?? 0} onChange={(e) => { const t = [...tranches]; t[idx] = { ...t[idx], completionPercent: Number(e.target.value) }; setTranches(t); }} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={tranche.amount ?? 0} onChange={(e) => { const t = [...tranches]; t[idx] = { ...t[idx], amount: Number(e.target.value) }; setTranches(t); }} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" className="w-20" value={tranche.percentage ?? 0} onChange={(e) => { const t = [...tranches]; t[idx] = { ...t[idx], percentage: Number(e.target.value) }; setTranches(t); }} />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => setTranches(tranches.filter((_, i) => i !== idx))}>
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Step 10: Intelligent Bank Selection */}
        <TabsContent value="banks">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Intelligent Lender Matching</CardTitle>
                  <CardDescription>Auto-shortlist lenders based on project profile, credit metrics & deal structure</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchLenderMatches} disabled={loadingLenderMatch}>
                  {loadingLenderMatch ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  {lenderMatchResults ? "Re-Match" : "Find Lenders"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingLenderMatch ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Running credit-desk matching engine...</p>
                </div>
              ) : lenderMatchResults ? (
                <div className="space-y-5">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg border bg-card">
                      <p className="text-xs text-muted-foreground">Total Lenders</p>
                      <p className="text-2xl font-bold">{lenderMatchResults.summary.totalLenders}</p>
                    </div>
                    <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                      <p className="text-xs text-green-700 dark:text-green-400">Qualified</p>
                      <p className="text-2xl font-bold text-green-700 dark:text-green-400">{lenderMatchResults.summary.qualifiedCount}</p>
                    </div>
                    <div className="p-3 rounded-lg border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                      <p className="text-xs text-blue-700 dark:text-blue-400">Strong Match</p>
                      <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{lenderMatchResults.summary.strongMatches}</p>
                    </div>
                    <div className="p-3 rounded-lg border bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800">
                      <p className="text-xs text-orange-700 dark:text-orange-400">Disqualified</p>
                      <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">{lenderMatchResults.summary.disqualifiedCount}</p>
                    </div>
                  </div>

                  {/* Qualified Lenders by Category */}
                  {Object.entries(lenderMatchResults.categoryGroups as Record<string, any[]>).map(([category, lenders]) => {
                    const catLabels: Record<string, { label: string; color: string }> = {
                      PSU_BANK: { label: "PSU Banks", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300" },
                      PRIVATE_BANK: { label: "Private Banks", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
                      HFC: { label: "Housing Finance Companies", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
                      NBFC: { label: "NBFCs - RE Specialists", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
                      AIF_PLATFORM: { label: "Private Credit / AIF", color: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300" },
                    };
                    const cat = catLabels[category] || { label: category, color: "bg-gray-100 text-gray-800" };
                    return (
                      <div key={category} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge className={`${cat.color} text-xs font-medium`}>{cat.label}</Badge>
                          <span className="text-xs text-muted-foreground">{(lenders as any[]).length} lender(s)</span>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[40px]">Select</TableHead>
                              <TableHead>Lender</TableHead>
                              <TableHead>Product</TableHead>
                              <TableHead>Match</TableHead>
                              <TableHead>Rate</TableHead>
                              <TableHead>Ticket Range</TableHead>
                              <TableHead>DSCR</TableHead>
                              <TableHead>Flags</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(lenders as any[]).map((m: any, idx: number) => {
                              const bankId = m.bank?.bankCode || m.appetite?.bankCode || `lender-${idx}`;
                              const isSelected = selectedBanks.includes(bankId);
                              const matchColor = m.matchLevel === 'STRONG' ? 'text-green-600 bg-green-50 dark:bg-green-950/20' :
                                m.matchLevel === 'MODERATE' ? 'text-blue-600 bg-blue-50 dark:bg-blue-950/20' :
                                'text-orange-600 bg-orange-50 dark:bg-orange-950/20';
                              return (
                                <TableRow key={`${bankId}-${m.appetite?.loanSubType}-${idx}`} className={isSelected ? "bg-blue-50 dark:bg-blue-950/20" : ""}>
                                  <TableCell>
                                    <Checkbox checked={isSelected} onCheckedChange={(checked) => {
                                      if (checked) setSelectedBanks([...selectedBanks, bankId]);
                                      else setSelectedBanks(selectedBanks.filter((b) => b !== bankId));
                                    }} />
                                  </TableCell>
                                  <TableCell className="font-medium text-sm">{m.bank?.bankName || "Unknown"}</TableCell>
                                  <TableCell><Badge variant="outline" className="text-xs">{formatLabel(m.appetite?.loanSubType || "")}</Badge></TableCell>
                                  <TableCell>
                                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${matchColor}`}>
                                      {m.matchScore}%
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm">{m.appetite?.interestRateMin && m.appetite?.interestRateMax ? `${m.appetite.interestRateMin}–${m.appetite.interestRateMax}%` : "N/A"}</TableCell>
                                  <TableCell className="text-xs">{m.appetite?.minTicketSize && m.appetite?.maxTicketSize ? `${formatCurrency(m.appetite.minTicketSize)} – ${formatCurrency(m.appetite.maxTicketSize)}` : "N/A"}</TableCell>
                                  <TableCell className="text-sm">{m.appetite?.minDscr ? `≥ ${m.appetite.minDscr}` : "Flex"}</TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                      {m.flags.slice(0, 2).map((f: string, fi: number) => (
                                        <Badge key={fi} variant="outline" className="text-[10px] text-orange-600 border-orange-300">{f}</Badge>
                                      ))}
                                      {m.appetite?.specialConditions && m.flags.length === 0 && (
                                        <Badge variant="outline" className="text-[10px]">{m.appetite.specialConditions.length > 40 ? m.appetite.specialConditions.slice(0, 40) + "..." : m.appetite.specialConditions}</Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })}

                  {/* Selection Summary */}
                  {selectedBanks.length > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <CheckCircle2 className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium">{selectedBanks.length} lender(s) selected for submission</span>
                    </div>
                  )}

                  {/* Disqualified Toggle */}
                  {lenderMatchResults.disqualified.length > 0 && (
                    <div className="space-y-2">
                      <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setShowDisqualified(!showDisqualified)}>
                        <ChevronRight className={`h-4 w-4 mr-1 transition-transform ${showDisqualified ? "rotate-90" : ""}`} />
                        {showDisqualified ? "Hide" : "Show"} {lenderMatchResults.disqualified.length} disqualified lender(s)
                      </Button>
                      {showDisqualified && (
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead>Lender</TableHead>
                                <TableHead>Product</TableHead>
                                <TableHead>Reason</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {lenderMatchResults.disqualified.map((m: any, idx: number) => (
                                <TableRow key={idx} className="opacity-60">
                                  <TableCell className="text-sm">{m.bank?.bankName || "Unknown"}</TableCell>
                                  <TableCell><Badge variant="outline" className="text-xs">{formatLabel(m.appetite?.loanSubType || "")}</Badge></TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                      {m.disqualified.map((d: string, di: number) => (
                                        <Badge key={di} variant="destructive" className="text-[10px]">{d}</Badge>
                                      ))}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground space-y-3">
                  <Landmark className="h-12 w-12 mx-auto opacity-30" />
                  <p className="font-medium">Click "Find Lenders" to run the matching engine</p>
                  <p className="text-xs max-w-sm mx-auto">The engine analyzes your project profile, credit metrics, city, stage, and ticket size to auto-shortlist eligible lenders like a real credit desk.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Separator />

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => handleStepChange(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>

        <div className="flex items-center gap-1">
          {STEPS.map((_, idx) => (
            <div
              key={idx}
              className={`h-2 w-2 rounded-full transition-colors cursor-pointer ${
                idx === currentStep ? "bg-primary" : completedSteps.has(idx) ? "bg-green-500" : "bg-muted"
              }`}
              onClick={() => handleStepChange(idx)}
            />
          ))}
        </div>

        {currentStep < STEPS.length - 1 ? (
          <Button onClick={() => handleStepChange(currentStep + 1)}>
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={() => { markStepComplete(9); onComplete(); }} className="bg-green-600 hover:bg-green-700">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Complete Application
          </Button>
        )}
      </div>
    </div>
  );
}
