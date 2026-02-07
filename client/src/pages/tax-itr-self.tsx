import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle, 
  AlertTriangle,
  FileText,
  Calculator,
  Save,
  Send,
  Briefcase,
  Home,
  TrendingUp,
  Building2,
  Wallet,
  Receipt,
  HelpCircle,
  IndianRupee,
  Shield,
  Clock
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type PANType = "individual" | "huf" | "firm" | "company" | "trust" | "nri";

interface PANContext {
  pan: string;
  panType: PANType;
  name: string;
  isVerified: boolean;
  entityDescription?: string;
}

interface IncomeSource {
  hasSalary: boolean;
  hasHouseProperty: boolean;
  hasCapitalGains: boolean;
  hasBusinessIncome: boolean;
  hasForeignIncome: boolean;
  hasOtherIncome: boolean;
}

interface SalaryDetails {
  grossSalary: number;
  allowances: number;
  perquisites: number;
  profitInLieu: number;
  standardDeduction: number;
  professionalTax: number;
  employerPF: number;
}

interface HousePropertyDetails {
  propertyCount: number;
  rentalIncome: number;
  municipalTaxes: number;
  interestOnLoan: number;
  isSelfOccupied: boolean;
}

interface CapitalGainsDetails {
  shortTermGains: number;
  longTermGains: number;
  exemptionsApplied: number;
}

interface OtherIncomeDetails {
  interestIncome: number;
  dividendIncome: number;
  otherSources: number;
}

interface DeductionDetails {
  section80C: number;
  section80D: number;
  section80E: number;
  section80G: number;
  section80TTA: number;
  otherDeductions: number;
}

interface ITRDraft {
  id?: number;
  pan: string;
  assessmentYear: string;
  itrForm: string;
  status: "draft" | "preview" | "pending_payment" | "paid" | "submitted" | "verified";
  incomeSources: IncomeSource;
  salaryDetails?: SalaryDetails;
  housePropertyDetails?: HousePropertyDetails;
  capitalGainsDetails?: CapitalGainsDetails;
  otherIncomeDetails?: OtherIncomeDetails;
  deductionDetails?: DeductionDetails;
  grossTotalIncome: number;
  totalDeductions: number;
  taxableIncome: number;
  taxPayable: number;
  tdsCredits: number;
  advanceTax: number;
  selfAssessmentTax: number;
  refundDue: number;
}

const ASSESSMENT_YEARS = ["2024-25", "2023-24", "2022-23"];

const STEPS = [
  { id: "basic", title: "Basic Info", icon: FileText },
  { id: "sources", title: "Income Sources", icon: Wallet },
  { id: "salary", title: "Salary", icon: Briefcase },
  { id: "property", title: "House Property", icon: Home },
  { id: "capital", title: "Capital Gains", icon: TrendingUp },
  { id: "other", title: "Other Income", icon: Receipt },
  { id: "deductions", title: "Deductions", icon: Calculator },
  { id: "summary", title: "Summary", icon: CheckCircle }
];

export default function TaxITRSelfPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const [currentStepId, setCurrentStepId] = useState<string>("basic");
  const [assessmentYear, setAssessmentYear] = useState("2024-25");
  const [recommendedForm, setRecommendedForm] = useState("ITR-1");
  
  const [incomeSources, setIncomeSources] = useState<IncomeSource>({
    hasSalary: true,
    hasHouseProperty: false,
    hasCapitalGains: false,
    hasBusinessIncome: false,
    hasForeignIncome: false,
    hasOtherIncome: false
  });

  const [salaryDetails, setSalaryDetails] = useState<SalaryDetails>({
    grossSalary: 0,
    allowances: 0,
    perquisites: 0,
    profitInLieu: 0,
    standardDeduction: 50000,
    professionalTax: 0,
    employerPF: 0
  });

  const [housePropertyDetails, setHousePropertyDetails] = useState<HousePropertyDetails>({
    propertyCount: 1,
    rentalIncome: 0,
    municipalTaxes: 0,
    interestOnLoan: 0,
    isSelfOccupied: true
  });

  const [capitalGainsDetails, setCapitalGainsDetails] = useState<CapitalGainsDetails>({
    shortTermGains: 0,
    longTermGains: 0,
    exemptionsApplied: 0
  });

  const [otherIncomeDetails, setOtherIncomeDetails] = useState<OtherIncomeDetails>({
    interestIncome: 0,
    dividendIncome: 0,
    otherSources: 0
  });

  const [deductionDetails, setDeductionDetails] = useState<DeductionDetails>({
    section80C: 0,
    section80D: 0,
    section80E: 0,
    section80G: 0,
    section80TTA: 0,
    otherDeductions: 0
  });

  const { data: panContext, isLoading: panLoading } = useQuery<PANContext>({
    queryKey: ["/api/tax/pan-context"],
    enabled: isAuthenticated
  });

  const saveDraftMutation = useMutation({
    mutationFn: async (draft: Partial<ITRDraft>) => {
      return apiRequest("/api/tax/itr/draft", {
        method: "POST",
        body: JSON.stringify(draft)
      });
    },
    onSuccess: () => {
      toast({ title: "Draft Saved", description: "Your ITR draft has been saved successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/tax/itr/drafts"] });
    },
    onError: () => {
      toast({ title: "Save Failed", description: "Could not save draft. Please try again.", variant: "destructive" });
    }
  });

  useEffect(() => {
    let form = "ITR-1";
    const panType = panContext?.panType || "individual";
    
    if (panType === "firm") {
      form = "ITR-5";
    } else if (panType === "company") {
      form = "ITR-6";
    } else if (panType === "trust") {
      form = "ITR-7";
    } else if (panType === "huf") {
      if (incomeSources.hasBusinessIncome) {
        form = "ITR-3";
      } else if (incomeSources.hasCapitalGains || incomeSources.hasForeignIncome) {
        form = "ITR-2";
      } else if (housePropertyDetails.propertyCount > 1) {
        form = "ITR-2";
      } else {
        form = "ITR-2";
      }
    } else if (panType === "nri") {
      if (incomeSources.hasBusinessIncome) {
        form = "ITR-3";
      } else {
        form = "ITR-2";
      }
    } else {
      if (incomeSources.hasBusinessIncome && incomeSources.hasForeignIncome) {
        form = "ITR-3";
      } else if (incomeSources.hasBusinessIncome && incomeSources.hasCapitalGains) {
        form = "ITR-3";
      } else if (incomeSources.hasBusinessIncome) {
        form = "ITR-3";
      } else if (incomeSources.hasCapitalGains) {
        form = "ITR-2";
      } else if (incomeSources.hasForeignIncome) {
        form = "ITR-2";
      } else if (housePropertyDetails.propertyCount > 1) {
        form = "ITR-2";
      } else {
        const totalIncome = salaryDetails.grossSalary + housePropertyDetails.rentalIncome + 
          otherIncomeDetails.interestIncome + otherIncomeDetails.dividendIncome;
        
        const hasOtherSourcesExceedingLimit = otherIncomeDetails.otherSources > 5000;
        
        if (totalIncome > 5000000 || hasOtherSourcesExceedingLimit) {
          form = "ITR-2";
        } else {
          form = "ITR-1";
        }
      }
    }
    
    setRecommendedForm(form);
  }, [incomeSources, salaryDetails, housePropertyDetails, otherIncomeDetails, panContext]);

  useEffect(() => {
    const newSteps = getActiveSteps();
    const existsInNewSteps = newSteps.some(s => s.id === currentStepId);
    
    if (!existsInNewSteps) {
      const validSteps = newSteps.map(s => s.id);
      const fallbackStep = validSteps.includes("sources") ? "sources" : validSteps[0] || "basic";
      setCurrentStepId(fallbackStep);
    }
  }, [incomeSources, currentStepId]);

  const getActiveSteps = () => {
    const activeSteps = [STEPS[0], STEPS[1]];
    
    if (incomeSources.hasSalary) activeSteps.push(STEPS[2]);
    if (incomeSources.hasHouseProperty) activeSteps.push(STEPS[3]);
    if (incomeSources.hasCapitalGains) activeSteps.push(STEPS[4]);
    if (incomeSources.hasOtherIncome) activeSteps.push(STEPS[5]);
    
    activeSteps.push(STEPS[6]);
    activeSteps.push(STEPS[7]);
    
    return activeSteps;
  };

  const activeSteps = getActiveSteps();
  const currentStepIndex = activeSteps.findIndex(s => s.id === currentStepId);
  const safeCurrentStep = currentStepIndex >= 0 ? currentStepIndex : 0;
  const progress = ((safeCurrentStep + 1) / activeSteps.length) * 100;

  const calculateTotals = () => {
    const salaryIncome = salaryDetails.grossSalary + salaryDetails.allowances + 
      salaryDetails.perquisites + salaryDetails.profitInLieu - 
      salaryDetails.standardDeduction - salaryDetails.professionalTax;
    
    let housePropertyIncome = 0;
    if (incomeSources.hasHouseProperty) {
      if (housePropertyDetails.isSelfOccupied) {
        housePropertyIncome = -Math.min(housePropertyDetails.interestOnLoan, 200000);
      } else {
        const grossValue = housePropertyDetails.rentalIncome;
        const netAnnualValue = grossValue - housePropertyDetails.municipalTaxes;
        const standardDeduction = netAnnualValue * 0.30;
        housePropertyIncome = netAnnualValue - standardDeduction - housePropertyDetails.interestOnLoan;
      }
    }

    const capitalGains = capitalGainsDetails.shortTermGains + capitalGainsDetails.longTermGains - capitalGainsDetails.exemptionsApplied;
    const otherIncome = otherIncomeDetails.interestIncome + otherIncomeDetails.dividendIncome + otherIncomeDetails.otherSources;

    const grossTotalIncome = Math.max(0, salaryIncome) + housePropertyIncome + capitalGains + otherIncome;

    const totalDeductions = Math.min(deductionDetails.section80C, 150000) +
      Math.min(deductionDetails.section80D, 50000) +
      deductionDetails.section80E +
      deductionDetails.section80G +
      Math.min(deductionDetails.section80TTA, 10000) +
      deductionDetails.otherDeductions;

    const taxableIncome = Math.max(0, grossTotalIncome - totalDeductions);

    let taxPayable = 0;
    if (taxableIncome > 1500000) {
      taxPayable = 187500 + (taxableIncome - 1500000) * 0.30;
    } else if (taxableIncome > 1200000) {
      taxPayable = 112500 + (taxableIncome - 1200000) * 0.25;
    } else if (taxableIncome > 900000) {
      taxPayable = 52500 + (taxableIncome - 900000) * 0.20;
    } else if (taxableIncome > 600000) {
      taxPayable = 22500 + (taxableIncome - 600000) * 0.10;
    } else if (taxableIncome > 300000) {
      taxPayable = (taxableIncome - 300000) * 0.05;
    }

    const cessRate = 0.04;
    taxPayable = taxPayable * (1 + cessRate);

    return {
      salaryIncome,
      housePropertyIncome,
      capitalGains,
      otherIncome,
      grossTotalIncome,
      totalDeductions,
      taxableIncome,
      taxPayable: Math.round(taxPayable)
    };
  };

  const totals = calculateTotals();

  const handleSaveDraft = () => {
    saveDraftMutation.mutate({
      pan: panContext?.pan || "",
      assessmentYear,
      itrForm: recommendedForm,
      status: "draft",
      incomeSources,
      salaryDetails,
      housePropertyDetails,
      capitalGainsDetails,
      otherIncomeDetails,
      deductionDetails,
      grossTotalIncome: totals.grossTotalIncome,
      totalDeductions: totals.totalDeductions,
      taxableIncome: totals.taxableIncome,
      taxPayable: totals.taxPayable,
      tdsCredits: 0,
      advanceTax: 0,
      selfAssessmentTax: 0,
      refundDue: 0
    });
  };

  const handleProceedToPreview = () => {
    handleSaveDraft();
    navigate("/tax/itr/preview");
  };

  const nextStep = () => {
    if (safeCurrentStep < activeSteps.length - 1) {
      const newStepId = activeSteps[safeCurrentStep + 1]?.id || "basic";
      setCurrentStepId(newStepId);
    }
  };

  const prevStep = () => {
    if (safeCurrentStep > 0) {
      const newStepId = activeSteps[safeCurrentStep - 1]?.id || "basic";
      setCurrentStepId(newStepId);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR',
      maximumFractionDigits: 0 
    }).format(amount);
  };

  const renderBasicInfoStep = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>PAN</Label>
          <Input value={panContext?.pan || "Loading..."} disabled className="bg-muted" data-testid="input-pan" />
        </div>
        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={panContext?.name || "Loading..."} disabled className="bg-muted" data-testid="input-name" />
        </div>
        <div className="space-y-2">
          <Label>Entity Type</Label>
          <Input value={panContext?.entityDescription || panContext?.panType?.toUpperCase() || "Individual"} disabled className="bg-muted" data-testid="input-entity-type" />
        </div>
        <div className="space-y-2">
          <Label>Assessment Year</Label>
          <RadioGroup value={assessmentYear} onValueChange={setAssessmentYear} className="flex gap-4" data-testid="radio-assessment-year">
            {ASSESSMENT_YEARS.map(year => (
              <div key={year} className="flex items-center space-x-2">
                <RadioGroupItem value={year} id={year} />
                <Label htmlFor={year} className="cursor-pointer">{year}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      </div>
      
      <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Your data is encrypted and securely stored. We follow SEBI and IT department guidelines for data protection.
        </AlertDescription>
      </Alert>
    </div>
  );

  const renderIncomeSourcesStep = () => (
    <div className="space-y-6">
      <p className="text-muted-foreground">Select all sources of income you have for this assessment year:</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { key: "hasSalary", label: "Salary Income", icon: Briefcase, desc: "Income from employment" },
          { key: "hasHouseProperty", label: "House Property", icon: Home, desc: "Rental income or interest on home loan" },
          { key: "hasCapitalGains", label: "Capital Gains", icon: TrendingUp, desc: "Stocks, mutual funds, property sale" },
          { key: "hasBusinessIncome", label: "Business/Profession", icon: Building2, desc: "Self-employed or business (ITR-3 recommended)" },
          { key: "hasForeignIncome", label: "Foreign Income", icon: Receipt, desc: "Income from outside India" },
          { key: "hasOtherIncome", label: "Other Sources", icon: Wallet, desc: "Interest, dividends, etc." }
        ].map(source => {
          const Icon = source.icon;
          const isChecked = incomeSources[source.key as keyof IncomeSource];
          return (
            <Card 
              key={source.key} 
              className={`cursor-pointer transition-all ${isChecked ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground'}`}
              onClick={() => setIncomeSources(prev => ({ ...prev, [source.key]: !prev[source.key as keyof IncomeSource] }))}
              data-testid={`card-source-${source.key}`}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <Checkbox checked={isChecked} className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="font-medium">{source.label}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{source.desc}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
        <HelpCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Recommended Form: {recommendedForm}</strong> based on your selections. This may change as you provide more details.
        </AlertDescription>
      </Alert>
    </div>
  );

  const renderSalaryStep = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="grossSalary">Gross Salary (Annual)</Label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              id="grossSalary"
              type="number" 
              className="pl-9"
              value={salaryDetails.grossSalary || ""}
              onChange={(e) => setSalaryDetails(prev => ({ ...prev, grossSalary: Number(e.target.value) }))}
              placeholder="Enter gross salary"
              data-testid="input-gross-salary"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="allowances">Allowances (HRA, LTA, etc.)</Label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              id="allowances"
              type="number" 
              className="pl-9"
              value={salaryDetails.allowances || ""}
              onChange={(e) => setSalaryDetails(prev => ({ ...prev, allowances: Number(e.target.value) }))}
              placeholder="Enter allowances"
              data-testid="input-allowances"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="professionalTax">Professional Tax Paid</Label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              id="professionalTax"
              type="number" 
              className="pl-9"
              value={salaryDetails.professionalTax || ""}
              onChange={(e) => setSalaryDetails(prev => ({ ...prev, professionalTax: Number(e.target.value) }))}
              placeholder="Enter professional tax"
              data-testid="input-professional-tax"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="employerPF">Employer's PF Contribution</Label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              id="employerPF"
              type="number" 
              className="pl-9"
              value={salaryDetails.employerPF || ""}
              onChange={(e) => setSalaryDetails(prev => ({ ...prev, employerPF: Number(e.target.value) }))}
              placeholder="Enter employer PF"
              data-testid="input-employer-pf"
            />
          </div>
        </div>
      </div>

      <div className="p-4 bg-muted rounded-lg">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Standard Deduction (Auto-applied)</span>
          <span className="font-semibold">{formatCurrency(salaryDetails.standardDeduction)}</span>
        </div>
        <Separator className="my-2" />
        <div className="flex justify-between items-center">
          <span className="font-medium">Net Salary Income</span>
          <span className="font-bold text-lg">{formatCurrency(totals.salaryIncome)}</span>
        </div>
      </div>
    </div>
  );

  const renderHousePropertyStep = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Label>Property Type</Label>
          <RadioGroup 
            value={housePropertyDetails.isSelfOccupied ? "self" : "letout"} 
            onValueChange={(v) => setHousePropertyDetails(prev => ({ ...prev, isSelfOccupied: v === "self" }))}
            className="flex gap-4"
            data-testid="radio-property-type"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="self" id="self" />
              <Label htmlFor="self" className="cursor-pointer">Self Occupied</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="letout" id="letout" />
              <Label htmlFor="letout" className="cursor-pointer">Let Out / Deemed Let Out</Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {!housePropertyDetails.isSelfOccupied && (
          <div className="space-y-2">
            <Label htmlFor="rentalIncome">Annual Rental Income</Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                id="rentalIncome"
                type="number" 
                className="pl-9"
                value={housePropertyDetails.rentalIncome || ""}
                onChange={(e) => setHousePropertyDetails(prev => ({ ...prev, rentalIncome: Number(e.target.value) }))}
                placeholder="Enter rental income"
                data-testid="input-rental-income"
              />
            </div>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="interestOnLoan">Interest on Home Loan</Label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              id="interestOnLoan"
              type="number" 
              className="pl-9"
              value={housePropertyDetails.interestOnLoan || ""}
              onChange={(e) => setHousePropertyDetails(prev => ({ ...prev, interestOnLoan: Number(e.target.value) }))}
              placeholder="Enter interest on home loan"
              data-testid="input-interest-loan"
            />
          </div>
          {housePropertyDetails.isSelfOccupied && (
            <p className="text-xs text-muted-foreground">Maximum deduction of ₹2,00,000 for self-occupied property</p>
          )}
        </div>
      </div>

      <div className="p-4 bg-muted rounded-lg">
        <div className="flex justify-between items-center">
          <span className="font-medium">Income/Loss from House Property</span>
          <span className={`font-bold text-lg ${totals.housePropertyIncome < 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatCurrency(totals.housePropertyIncome)}
          </span>
        </div>
      </div>
    </div>
  );

  const renderCapitalGainsStep = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="shortTermGains">Short Term Capital Gains</Label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              id="shortTermGains"
              type="number" 
              className="pl-9"
              value={capitalGainsDetails.shortTermGains || ""}
              onChange={(e) => setCapitalGainsDetails(prev => ({ ...prev, shortTermGains: Number(e.target.value) }))}
              placeholder="Equity, debt funds (< 1/3 years)"
              data-testid="input-short-term-gains"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="longTermGains">Long Term Capital Gains</Label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              id="longTermGains"
              type="number" 
              className="pl-9"
              value={capitalGainsDetails.longTermGains || ""}
              onChange={(e) => setCapitalGainsDetails(prev => ({ ...prev, longTermGains: Number(e.target.value) }))}
              placeholder="Equity, property, etc."
              data-testid="input-long-term-gains"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="exemptions">Exemptions (54, 54EC, 54F)</Label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              id="exemptions"
              type="number" 
              className="pl-9"
              value={capitalGainsDetails.exemptionsApplied || ""}
              onChange={(e) => setCapitalGainsDetails(prev => ({ ...prev, exemptionsApplied: Number(e.target.value) }))}
              placeholder="Enter exemption amount"
              data-testid="input-exemptions"
            />
          </div>
        </div>
      </div>

      <div className="p-4 bg-muted rounded-lg">
        <div className="flex justify-between items-center">
          <span className="font-medium">Net Capital Gains</span>
          <span className="font-bold text-lg">{formatCurrency(totals.capitalGains)}</span>
        </div>
      </div>
    </div>
  );

  const renderOtherIncomeStep = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="interestIncome">Interest from Savings/FD</Label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              id="interestIncome"
              type="number" 
              className="pl-9"
              value={otherIncomeDetails.interestIncome || ""}
              onChange={(e) => setOtherIncomeDetails(prev => ({ ...prev, interestIncome: Number(e.target.value) }))}
              placeholder="Bank interest, FD interest"
              data-testid="input-interest-income"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="dividendIncome">Dividend Income</Label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              id="dividendIncome"
              type="number" 
              className="pl-9"
              value={otherIncomeDetails.dividendIncome || ""}
              onChange={(e) => setOtherIncomeDetails(prev => ({ ...prev, dividendIncome: Number(e.target.value) }))}
              placeholder="From stocks, mutual funds"
              data-testid="input-dividend-income"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="otherSources">Other Sources</Label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              id="otherSources"
              type="number" 
              className="pl-9"
              value={otherIncomeDetails.otherSources || ""}
              onChange={(e) => setOtherIncomeDetails(prev => ({ ...prev, otherSources: Number(e.target.value) }))}
              placeholder="Any other income"
              data-testid="input-other-sources"
            />
          </div>
        </div>
      </div>

      <div className="p-4 bg-muted rounded-lg">
        <div className="flex justify-between items-center">
          <span className="font-medium">Total Other Income</span>
          <span className="font-bold text-lg">{formatCurrency(totals.otherIncome)}</span>
        </div>
      </div>
    </div>
  );

  const renderDeductionsStep = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="section80C">Section 80C (Max ₹1.5L)</Label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              id="section80C"
              type="number" 
              className="pl-9"
              value={deductionDetails.section80C || ""}
              onChange={(e) => setDeductionDetails(prev => ({ ...prev, section80C: Number(e.target.value) }))}
              placeholder="PPF, ELSS, LIC, PF, etc."
              data-testid="input-section-80c"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="section80D">Section 80D - Health Insurance (Max ₹50K)</Label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              id="section80D"
              type="number" 
              className="pl-9"
              value={deductionDetails.section80D || ""}
              onChange={(e) => setDeductionDetails(prev => ({ ...prev, section80D: Number(e.target.value) }))}
              placeholder="Self + family premium"
              data-testid="input-section-80d"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="section80E">Section 80E - Education Loan Interest</Label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              id="section80E"
              type="number" 
              className="pl-9"
              value={deductionDetails.section80E || ""}
              onChange={(e) => setDeductionDetails(prev => ({ ...prev, section80E: Number(e.target.value) }))}
              placeholder="Interest on education loan"
              data-testid="input-section-80e"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="section80G">Section 80G - Donations</Label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              id="section80G"
              type="number" 
              className="pl-9"
              value={deductionDetails.section80G || ""}
              onChange={(e) => setDeductionDetails(prev => ({ ...prev, section80G: Number(e.target.value) }))}
              placeholder="Charitable donations"
              data-testid="input-section-80g"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="section80TTA">Section 80TTA - Savings Interest (Max ₹10K)</Label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              id="section80TTA"
              type="number" 
              className="pl-9"
              value={deductionDetails.section80TTA || ""}
              onChange={(e) => setDeductionDetails(prev => ({ ...prev, section80TTA: Number(e.target.value) }))}
              placeholder="Savings account interest"
              data-testid="input-section-80tta"
            />
          </div>
        </div>
      </div>

      <div className="p-4 bg-muted rounded-lg">
        <div className="flex justify-between items-center">
          <span className="font-medium">Total Deductions</span>
          <span className="font-bold text-lg text-green-600">{formatCurrency(totals.totalDeductions)}</span>
        </div>
      </div>
    </div>
  );

  const renderSummaryStep = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="dark:border-border">
          <CardHeader>
            <CardTitle className="text-lg">Income Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {incomeSources.hasSalary && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Salary Income</span>
                <span className="font-medium">{formatCurrency(totals.salaryIncome)}</span>
              </div>
            )}
            {incomeSources.hasHouseProperty && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">House Property</span>
                <span className={`font-medium ${totals.housePropertyIncome < 0 ? 'text-red-600' : 'dark:text-foreground'}`}>
                  {formatCurrency(totals.housePropertyIncome)}
                </span>
              </div>
            )}
            {incomeSources.hasCapitalGains && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Capital Gains</span>
                <span className="font-medium">{formatCurrency(totals.capitalGains)}</span>
              </div>
            )}
            {incomeSources.hasOtherIncome && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Other Income</span>
                <span className="font-medium">{formatCurrency(totals.otherIncome)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-semibold">
              <span className="dark:text-foreground">Gross Total Income</span>
              <span className="dark:text-foreground">{formatCurrency(totals.grossTotalIncome)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="dark:border-border">
          <CardHeader>
            <CardTitle className="text-lg">Tax Computation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gross Total Income</span>
              <span className="font-medium">{formatCurrency(totals.grossTotalIncome)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Deductions</span>
              <span className="font-medium text-green-600">- {formatCurrency(totals.totalDeductions)}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="font-medium">Taxable Income</span>
              <span className="font-semibold">{formatCurrency(totals.taxableIncome)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg">
              <span className="font-bold">Tax Payable</span>
              <span className="font-bold text-primary">{formatCurrency(totals.taxPayable)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary bg-primary/5 dark:border-primary/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-primary" />
              <div>
                <p className="font-semibold">Recommended Form: {recommendedForm}</p>
                <p className="text-sm text-muted-foreground">Based on your income sources and details</p>
              </div>
            </div>
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
              <CheckCircle className="h-3 w-3 mr-1" /> Ready
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Please review all details carefully. After proceeding, you'll see a detailed preview with computation. 
          Any changes after payment may require additional fees.
        </AlertDescription>
      </Alert>
    </div>
  );

  const renderCurrentStep = () => {
    const currentStepExists = activeSteps.some(s => s.id === currentStepId);
    
    if (!currentStepExists) {
      return (
        <div className="text-center py-8">
          <Clock className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Loading step...</p>
        </div>
      );
    }
    
    switch (currentStepId) {
      case "basic": return renderBasicInfoStep();
      case "sources": return renderIncomeSourcesStep();
      case "salary": return renderSalaryStep();
      case "property": return renderHousePropertyStep();
      case "capital": return renderCapitalGainsStep();
      case "other": return renderOtherIncomeStep();
      case "deductions": return renderDeductionsStep();
      case "summary": return renderSummaryStep();
      default: return null;
    }
  };

  if (panLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Loading your details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-itr-self">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/tax/itr")} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Self-File ITR</h1>
          <p className="text-muted-foreground">Assessment Year {assessmentYear} | Form {recommendedForm}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {activeSteps.map((step, idx) => {
          const Icon = step.icon;
          const isActive = idx === safeCurrentStep;
          const isCompleted = idx < safeCurrentStep;
          return (
            <div key={step.id} className="flex items-center">
              <Button
                variant={isActive ? "default" : isCompleted ? "secondary" : "ghost"}
                size="sm"
                className={`flex items-center gap-1 whitespace-nowrap ${isActive ? '' : 'opacity-70'}`}
                onClick={() => idx < safeCurrentStep && setCurrentStepId(step.id)}
                disabled={idx > safeCurrentStep}
                data-testid={`button-step-${step.id}`}
              >
                {isCompleted ? <CheckCircle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                <span className="hidden sm:inline">{step.title}</span>
              </Button>
              {idx < activeSteps.length - 1 && <ArrowRight className="h-4 w-4 mx-1 text-muted-foreground" />}
            </div>
          );
        })}
      </div>

      <Progress value={progress} className="h-2" />

      <Card className="dark:border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {(() => { const Icon = activeSteps[safeCurrentStep]?.icon || FileText; return <Icon className="h-5 w-5" />; })()}
            {activeSteps[safeCurrentStep]?.title}
          </CardTitle>
          <CardDescription className="dark:text-muted-foreground">
            Step {safeCurrentStep + 1} of {activeSteps.length}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderCurrentStep()}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={prevStep} disabled={safeCurrentStep === 0} data-testid="button-prev">
            <ArrowLeft className="h-4 w-4 mr-2" /> Previous
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSaveDraft} disabled={saveDraftMutation.isPending} data-testid="button-save-draft">
              <Save className="h-4 w-4 mr-2" /> Save Draft
            </Button>
            {safeCurrentStep === activeSteps.length - 1 ? (
              <Button onClick={handleProceedToPreview} data-testid="button-proceed-preview">
                <Send className="h-4 w-4 mr-2" /> Proceed to Preview
              </Button>
            ) : (
              <Button onClick={nextStep} data-testid="button-next">
                Next <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
