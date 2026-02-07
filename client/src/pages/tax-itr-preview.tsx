import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { 
  ArrowLeft,
  ArrowRight,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  Download,
  Lock,
  Unlock,
  IndianRupee,
  Calculator,
  FileCheck,
  Shield,
  Eye,
  Printer,
  AlertCircle,
  XCircle,
  Info
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ITRDraft {
  id: number;
  pan: string;
  assessmentYear: string;
  itrForm: string;
  status: string;
  incomeSources?: {
    hasSalary: boolean;
    hasHouseProperty: boolean;
    hasCapitalGains: boolean;
    hasBusinessIncome: boolean;
    hasForeignIncome: boolean;
    hasOtherIncome: boolean;
  };
  salaryDetails?: {
    grossSalary: number;
    allowances: number;
    perquisites: number;
    profitInLieu: number;
    standardDeduction: number;
    professionalTax: number;
    employerPF: number;
  };
  housePropertyDetails?: {
    propertyCount: number;
    rentalIncome: number;
    municipalTaxes: number;
    interestOnLoan: number;
    isSelfOccupied: boolean;
  };
  capitalGainsDetails?: {
    shortTermGains: number;
    longTermGains: number;
    exemptionsApplied: number;
  };
  otherIncomeDetails?: {
    interestIncome: number;
    dividendIncome: number;
    otherSources: number;
  };
  deductionDetails?: {
    section80C: number;
    section80D: number;
    section80E: number;
    section80G: number;
    section80TTA: number;
    otherDeductions: number;
  };
  grossTotalIncome?: number;
  totalDeductions?: number;
  taxableIncome?: number;
  taxPayable?: number;
  tdsCredits?: number;
  advanceTax?: number;
  selfAssessmentTax?: number;
  refundDue?: number;
}

interface ValidationError {
  field: string;
  message: string;
  severity: "error" | "warning" | "info";
}


export default function TaxITRPreviewPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/tax/itr/preview/:draftId");
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("summary");
  const [isLocked, setIsLocked] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  const draftId = params?.draftId ? parseInt(params.draftId) : 1;

  const { data: draft, isLoading, error: draftError } = useQuery<ITRDraft>({
    queryKey: ["/api/tax/itr/draft", draftId],
    enabled: !!draftId
  });

  const lockDraftMutation = useMutation({
    mutationFn: async () => {
      if (!draftId) throw new Error("No draft ID");
      return await apiRequest(`/api/tax/itr/draft/${draftId}/lock`, {
        method: "POST"
      });
    },
    onSuccess: () => {
      setIsLocked(true);
      toast({
        title: "Draft Locked",
        description: "Your return has been locked for filing."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tax/itr/draft", draftId] });
      navigate(`/tax/itr/payment/${draftId}`);
    },
    onError: (error) => {
      console.error("Lock error:", error);
      toast({
        title: "Lock Failed",
        description: "Unable to lock the draft. Please try again.",
        variant: "destructive"
      });
    }
  });

  const validationErrors: ValidationError[] = [
    ...(draft?.tdsCredits && draft.tdsCredits > 0 && !draft.salaryDetails?.grossSalary ? 
      [{ field: "TDS", message: "TDS credits claimed but no income declared", severity: "warning" as const }] : []),
    ...(draft?.deductionDetails?.section80C && draft.deductionDetails.section80C > 150000 ? 
      [{ field: "80C", message: "Section 80C deduction exceeds limit of ₹1,50,000", severity: "error" as const }] : []),
    ...(draft?.deductionDetails?.section80TTA && draft.deductionDetails.section80TTA > 10000 ? 
      [{ field: "80TTA", message: "Section 80TTA deduction exceeds limit of ₹10,000", severity: "error" as const }] : [])
  ];

  const hasErrors = validationErrors.some(e => e.severity === "error");
  const hasWarnings = validationErrors.some(e => e.severity === "warning");

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined) return "₹0";
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  const handleProceedToPayment = () => {
    if (!disclaimerAccepted) {
      toast({
        title: "Disclaimer Required",
        description: "Please accept the disclaimer before proceeding.",
        variant: "destructive"
      });
      return;
    }
    
    if (hasErrors) {
      toast({
        title: "Errors Found",
        description: "Please fix all errors before proceeding to payment.",
        variant: "destructive"
      });
      return;
    }
    
    lockDraftMutation.mutate();
  };

  const renderSummaryTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Gross Total Income</p>
            <p className="text-2xl font-bold text-primary">{formatCurrency(draft?.grossTotalIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Total Deductions</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(draft?.totalDeductions)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Taxable Income</p>
            <p className="text-2xl font-bold">{formatCurrency(draft?.taxableIncome)}</p>
          </CardContent>
        </Card>
        <Card className={draft?.refundDue && draft.refundDue > 0 ? "bg-green-50 dark:bg-green-950" : "bg-red-50 dark:bg-red-950"}>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">
              {draft?.refundDue && draft.refundDue > 0 ? "Refund Due" : "Tax Payable"}
            </p>
            <p className={`text-2xl font-bold ${draft?.refundDue && draft.refundDue > 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(draft?.refundDue && draft.refundDue > 0 ? draft.refundDue : draft?.taxPayable)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Tax Computation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Income from Salary</span>
              <span className="font-medium">
                {formatCurrency((draft?.salaryDetails?.grossSalary || 0) - (draft?.salaryDetails?.standardDeduction || 0) - (draft?.salaryDetails?.professionalTax || 0))}
              </span>
            </div>
            {draft?.housePropertyDetails && (
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Income from House Property</span>
                <span className="font-medium">
                  {formatCurrency((draft.housePropertyDetails.rentalIncome || 0) - (draft.housePropertyDetails.municipalTaxes || 0) - (draft.housePropertyDetails.interestOnLoan || 0))}
                </span>
              </div>
            )}
            {draft?.capitalGainsDetails && (
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Capital Gains</span>
                <span className="font-medium">
                  {formatCurrency((draft.capitalGainsDetails.shortTermGains || 0) + (draft.capitalGainsDetails.longTermGains || 0) - (draft.capitalGainsDetails.exemptionsApplied || 0))}
                </span>
              </div>
            )}
            {draft?.otherIncomeDetails && (
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Income from Other Sources</span>
                <span className="font-medium">
                  {formatCurrency((draft.otherIncomeDetails.interestIncome || 0) + (draft.otherIncomeDetails.dividendIncome || 0) + (draft.otherIncomeDetails.otherSources || 0))}
                </span>
              </div>
            )}
            <div className="flex justify-between py-2 border-b font-medium">
              <span className="dark:text-foreground">Gross Total Income</span>
              <span className="text-primary">{formatCurrency(draft?.grossTotalIncome)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Less: Deductions under Chapter VI-A</span>
              <span className="font-medium text-green-600">-{formatCurrency(draft?.totalDeductions)}</span>
            </div>
            <div className="flex justify-between py-2 border-b font-medium">
              <span className="dark:text-foreground">Total Taxable Income</span>
              <span className="dark:text-foreground">{formatCurrency(draft?.taxableIncome)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Tax on Total Income</span>
              <span className="font-medium">{formatCurrency(draft?.taxPayable)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Less: TDS Credits</span>
              <span className="font-medium text-green-600">-{formatCurrency(draft?.tdsCredits)}</span>
            </div>
            <div className="flex justify-between py-3 bg-muted px-3 rounded-lg font-bold">
              <span className="dark:text-foreground">{draft?.refundDue && draft.refundDue > 0 ? "Refund Due" : "Tax Payable"}</span>
              <span className={draft?.refundDue && draft.refundDue > 0 ? "text-green-600" : "text-red-600"}>
                {formatCurrency(draft?.refundDue && draft.refundDue > 0 ? draft.refundDue : (draft?.taxPayable || 0) - (draft?.tdsCredits || 0))}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderIncomeTab = () => (
    <div className="space-y-4">
      {draft?.salaryDetails && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Salary Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gross Salary</span>
                <span className="dark:text-foreground">{formatCurrency(draft.salaryDetails.grossSalary)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Allowances</span>
                <span className="dark:text-foreground">{formatCurrency(draft.salaryDetails.allowances)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Standard Deduction</span>
                <span className="text-green-600">-{formatCurrency(draft.salaryDetails.standardDeduction)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Professional Tax</span>
                <span className="text-green-600">-{formatCurrency(draft.salaryDetails.professionalTax)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {draft?.otherIncomeDetails && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Other Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Interest Income</span>
                <span className="dark:text-foreground">{formatCurrency(draft.otherIncomeDetails.interestIncome)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dividend Income</span>
                <span className="dark:text-foreground">{formatCurrency(draft.otherIncomeDetails.dividendIncome)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderDeductionsTab = () => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Chapter VI-A Deductions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 text-sm">
          {draft?.deductionDetails && Object.entries(draft.deductionDetails).map(([key, value]) => {
            if (!value || value === 0) return null;
            const label = key.replace("section", "Section ").replace(/([A-Z])/g, " $1");
            return (
              <div key={key} className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium text-green-600">{formatCurrency(value)}</span>
              </div>
            );
          })}
          <div className="flex justify-between py-2 font-bold">
            <span className="dark:text-foreground">Total Deductions</span>
            <span className="text-green-600">{formatCurrency(draft?.totalDeductions)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderValidationTab = () => (
    <div className="space-y-4">
      {validationErrors.length === 0 ? (
        <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription>
            No validation errors found. Your return is ready for filing.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {validationErrors.filter(e => e.severity === "error").length > 0 && (
            <Alert className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
              <XCircle className="h-4 w-4 text-red-600" />
              <AlertDescription>
                <p className="font-medium mb-2">Errors that must be fixed:</p>
                <ul className="list-disc list-inside space-y-1">
                  {validationErrors.filter(e => e.severity === "error").map((err, idx) => (
                    <li key={idx}>{err.field}: {err.message}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          {validationErrors.filter(e => e.severity === "warning").length > 0 && (
            <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription>
                <p className="font-medium mb-2">Warnings to review:</p>
                <ul className="list-disc list-inside space-y-1">
                  {validationErrors.filter(e => e.severity === "warning").map((err, idx) => (
                    <li key={idx}>{err.field}: {err.message}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Loading preview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-itr-preview">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/tax/itr/self")} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">ITR Preview</h1>
            <p className="text-muted-foreground">
              {draft?.itrForm} | AY {draft?.assessmentYear} | PAN: {draft?.pan}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isLocked ? "default" : "secondary"} className="gap-1">
            {isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
            {isLocked ? "Locked" : "Unlocked"}
          </Badge>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" /> Download PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      {hasErrors && (
        <Alert className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription>
            There are {validationErrors.filter(e => e.severity === "error").length} error(s) that must be fixed before filing.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <ScrollableTabsList>
          <TabsTrigger value="summary" className="gap-2">
            <Calculator className="h-4 w-4" /> Summary
          </TabsTrigger>
          <TabsTrigger value="income" className="gap-2">
            <IndianRupee className="h-4 w-4" /> Income
          </TabsTrigger>
          <TabsTrigger value="deductions" className="gap-2">
            <FileCheck className="h-4 w-4" /> Deductions
          </TabsTrigger>
          <TabsTrigger value="validation" className="gap-2 relative">
            <Shield className="h-4 w-4" /> Validation
            {hasErrors && (
              <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full" />
            )}
          </TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value="summary" className="mt-4">
          {renderSummaryTab()}
        </TabsContent>
        <TabsContent value="income" className="mt-4">
          {renderIncomeTab()}
        </TabsContent>
        <TabsContent value="deductions" className="mt-4">
          {renderDeductionsTab()}
        </TabsContent>
        <TabsContent value="validation" className="mt-4">
          {renderValidationTab()}
        </TabsContent>
      </Tabs>

      <Card className="border-primary">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Checkbox 
              id="disclaimer" 
              checked={disclaimerAccepted}
              onCheckedChange={(checked) => setDisclaimerAccepted(checked as boolean)}
              data-testid="checkbox-disclaimer"
            />
            <Label htmlFor="disclaimer" className="text-sm text-muted-foreground cursor-pointer">
              I have reviewed all the details in this return and confirm that the information provided is true, correct, and complete to the best of my knowledge. I understand that filing incorrect information may attract penalties under the Income Tax Act.
            </Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate("/tax/itr/self")} data-testid="button-edit">
          <ArrowLeft className="h-4 w-4 mr-2" /> Edit Return
        </Button>
        <Button 
          onClick={handleProceedToPayment}
          disabled={hasErrors || !disclaimerAccepted}
          data-testid="button-proceed-payment"
        >
          Proceed to Payment <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
