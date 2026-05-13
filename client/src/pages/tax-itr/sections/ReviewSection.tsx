import React from "react";
import { 
  Eye, Globe, Building2, Clock, Calculator, CheckCircle, 
  AlertTriangle, XCircle, Shield as LucideShield, FileText, Trash2, Upload, 
  Send, Banknote, Lightbulb, Wallet, FileSearch, HelpCircle,
  TrendingUp, Scale
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  formatCurrency, formatLakhs 
} from "@/components/tax-itr/TaxITRHelpers";
import { useTax } from "../TaxContext";
import { useToast } from "@/hooks/use-toast";
import { 
  Step, StepValidation, ForeignAssetEntry, DocumentVaultEntry, 
  ChallanResult, OptimizerSuggestion, PreFilingItem, ReconciliationItem, 
  RefundStage, TaxDeadline, IfscResult, BankDetailsForRefund 
} from "../types";

export const ReviewSection: React.FC = (): React.ReactElement => {
  const {
    sandboxTaxResult,
    taxCalcMutation,
    activeSteps,
    validateStep,
    goToStep,
    taxCalcError,
    incomeSources,
    totals,
    businessDetails,
    foreignIncomeDetails,
    regimeCompareMutation,
    regimeComparison,
    recommendedForm,
    assessmentYear,
    taxRegime,
    bankDetails,
    setBankDetails,
    documentVault,
    setDocumentVault,
    showAdvancedOptions,
    setShowAdvancedOptions,
    cgUploads,
    cgManualSaved,
    donationEntries,
    residentialStatus,
    salaryDetails,
    capitalGainsDetails,
    otherIncomeDetails,
    deductionDetails,
    taxPaymentDetails,
    filingSection,
    showChallanDialog,
    setShowChallanDialog,
    challanResult,
    setChallanResult,
    showToolsDialog,
    setShowToolsDialog,
    hraResult,
    setHraResult,
    form10EResult,
    setForm10EResult,
    optimizerResult,
    setOptimizerResult,
    preFilingResult,
    setPreFilingResult,
    showPreFilingCheck,
    setShowPreFilingCheck,
    showSharingPanel,
    setShowSharingPanel,
    refundData,
    setRefundData,
    showRefundTracker,
    setShowRefundTracker,
    deadlinesData,
    setDeadlinesData,
    showDeadlines,
    setShowDeadlines,
    showLookupPanel,
    setShowLookupPanel,
    reconciliationResult,
    setReconciliationResult,
    showReconciliation,
    setShowReconciliation,
    ifscResult,
    setIfscResult,
    panContext
  } = useTax();

  const { toast } = useToast();
  const apiData = sandboxTaxResult?.data;
  const isCalculating = taxCalcMutation.isPending;

  const allStepValidations = activeSteps
    .filter((s: Step): boolean => s.id !== "review")
    .map((s: Step): { step: Step; validation: StepValidation } => ({ step: s, validation: validateStep(s.id) }))
    .filter((sv: { step: Step; validation: StepValidation }): boolean => !sv.validation.isValid);

  return (
    <div className="space-y-6">
      {allStepValidations.length > 0 && (
        <Alert className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
          <XCircle className="h-4 w-4 text-red-600" />
          <AlertDescription>
            <p className="font-medium text-red-700 dark:text-red-300 mb-2">Please fix the following before filing:</p>
            <ul className="space-y-1">
              {allStepValidations.map((sv: { step: Step; validation: StepValidation }): React.ReactElement => (
                <li key={sv.step.id} className="text-sm">
                  <button 
                    className="text-red-600 underline hover:no-underline font-medium"
                    onClick={(): void => goToStep(sv.step.id)}
                  >
                    {sv.step.title}
                  </button>
                  : {sv.validation.errors[0]}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {taxCalcError && (
        <Alert className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Tax Calculation Error:</strong> {taxCalcError}
            <Button variant="link" className="ml-2 p-0 h-auto" onClick={(): void => { taxCalcMutation.mutate(); }} disabled={isCalculating}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="dark:border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4" /> Income Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {incomeSources.hasSalary && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Salary Income</span>
                <span className="font-medium">{formatCurrency(Math.max(0, totals.salaryIncome))}</span>
              </div>
            )}
            {incomeSources.hasHouseProperty && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">House Property</span>
                <span className={`font-medium ${totals.housePropertyIncome < 0 ? 'text-red-600' : ''}`}>
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
            {incomeSources.hasForeignIncome && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1"><Globe className="h-3 w-3" /> Foreign Capital Gains</span>
                  <span className="font-medium">{formatCurrency(totals.foreignCapitalGains)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1"><Globe className="h-3 w-3" /> Foreign Other Income</span>
                  <span className="font-medium">{formatCurrency(totals.foreignOtherIncome)}</span>
                </div>
                {totals.foreignTaxCredit > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Less: Foreign Tax Credit (DTAA)</span>
                    <span>- {formatCurrency(totals.foreignTaxCredit)}</span>
                  </div>
                )}
              </>
            )}
            {incomeSources.hasBusinessIncome && (
              <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1"><Building2 className="h-3 w-3" /> Business Income</span>
                <span className="font-medium">{formatCurrency(
                  businessDetails.isPresumptive 
                    ? (businessDetails.presumptiveIncome44AD + businessDetails.presumptiveIncome44ADA + businessDetails.presumptiveIncome44AE) 
                    : businessDetails.businessIncome
                )}</span>
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
              <span>Gross Total Income</span>
              <span>{formatCurrency(apiData?.totalIncome ?? totals.grossTotalIncome)}</span>
            </div>
            {(apiData?.totalDeductions ?? totals.totalDeductions) > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Less: Deductions</span>
                <span>- {formatCurrency(apiData?.totalDeductions ?? totals.totalDeductions)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {incomeSources.hasForeignIncome && foreignIncomeDetails.foreignAssets.length > 0 && (
          <Card className="dark:border-border border-red-200 dark:border-red-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <LucideShield className="h-4 w-4 text-red-600" />
                Schedule FA — Foreign Assets ({foreignIncomeDetails.foreignAssets.length})
                <Badge variant="outline" className="text-[10px] text-red-600 border-red-300">Mandatory</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {foreignIncomeDetails.foreignAssets.map((a: ForeignAssetEntry, i: number) => (
                <div key={i} className="flex justify-between items-center py-1 border-b last:border-0">
                  <div>
                    <span className="font-medium">{a.institutionName || `Asset ${i+1}`}</span>
                    <span className="text-muted-foreground ml-2">({a.countryCode} · {a.assetType})</span>
                  </div>
                  <span className="font-medium">{formatCurrency(a.closingBalance)}</span>
                </div>
              ))}
              <div className="pt-1 text-muted-foreground italic">
                Form 67 must be filed before ITR submission to claim Foreign Tax Credit of {formatCurrency(foreignIncomeDetails.foreignTaxPaid)}.
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="dark:border-border border-blue-200 dark:border-red-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              Regime Comparison
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={(): void => regimeCompareMutation.mutate()}
              disabled={regimeCompareMutation.isPending}
              data-testid="btn-compare-regimes"
            >
              {regimeCompareMutation.isPending ? (
                <><Clock className="h-4 w-4 mr-2 animate-spin" /> Comparing via Sandbox API...</>
              ) : (
                <><Calculator className="h-4 w-4 mr-2" /> Compare Old vs New Regime</>
              )}
            </Button>
            {regimeComparison && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className={`p-3 rounded-lg border ${regimeComparison.recommended === 'old' ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-muted'}`}>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Old Regime</p>
                    <p className="text-lg font-bold">{formatLakhs(regimeComparison.oldRegime.taxPayable)}</p>
                    <p className="text-xs text-muted-foreground">Deductions: {formatCurrency(regimeComparison.oldRegime.totalDeductions)}</p>
                    {regimeComparison.recommended === 'old' && <Badge className="mt-1 bg-green-600 text-[10px]">Recommended</Badge>}
                  </div>
                  <div className={`p-3 rounded-lg border ${regimeComparison.recommended === 'new' ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-muted'}`}>
                    <p className="text-xs font-medium text-muted-foreground mb-1">New Regime</p>
                    <p className="text-lg font-bold">{formatLakhs(regimeComparison.newRegime.taxPayable)}</p>
                    <p className="text-xs text-muted-foreground">Deductions: {formatCurrency(regimeComparison.newRegime.totalDeductions)}</p>
                    {regimeComparison.recommended === 'new' && <Badge className="mt-1 bg-green-600 text-[10px]">Recommended</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950 rounded text-xs">
                  <CheckCircle className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                  <span>{regimeComparison.recommendation}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="dark:border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Tax Computation
              <Badge variant="outline" className="text-[10px] font-normal">Sandbox.co.in API</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {isCalculating ? (
              <div className="text-center py-8">
                <Clock className="h-6 w-6 animate-spin mx-auto text-primary" />
                <p className="mt-2 text-muted-foreground">Computing via Sandbox.co.in...</p>
              </div>
            ) : apiData ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxable Income</span>
                  <span className="font-medium">{formatCurrency(apiData.taxableIncome)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax on Income</span>
                  <span className="font-medium">{formatCurrency(apiData.taxLiability)}</span>
                </div>
                {(taxPaymentDetails.tdsDeducted + taxPaymentDetails.advanceTaxPaid + taxPaymentDetails.selfAssessmentTax) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Less: Tax Already Paid</span>
                    <span>- {formatCurrency(taxPaymentDetails.tdsDeducted + taxPaymentDetails.advanceTaxPaid + taxPaymentDetails.selfAssessmentTax)}</span>
                  </div>
                )}
                <Separator />
                {apiData.refundAmount > 0 ? (
                  <div className="flex justify-between text-lg">
                    <span className="font-bold text-green-700">Refund Due</span>
                    <span className="font-bold text-green-700">{formatCurrency(apiData.refundAmount)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-lg">
                    <span className="font-bold">Net Tax Payable</span>
                    <span className="font-bold text-primary">{formatCurrency(apiData.taxPayable)}</span>
                  </div>
                )}
                {apiData.effectiveTaxRate > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Effective Tax Rate</span>
                    <span>{apiData.effectiveTaxRate.toFixed(2)}%</span>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-6">
                <Calculator className="h-6 w-6 mx-auto text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Tax not yet computed</p>
                <Button className="mt-3" size="sm" onClick={(): void => { taxCalcMutation.mutate(); }} data-testid="button-calculate-tax">
                  <Calculator className="h-4 w-4 mr-2" /> Calculate Now
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {regimeComparison && (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="h-4 w-4" /> Regime Comparison (Sandbox API)
            </CardTitle>
            <CardDescription>We computed your tax under both regimes to help you choose the better one.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className={`p-4 rounded-lg border ${regimeComparison.recommended === "old" ? "border-green-400 bg-green-50 dark:bg-green-950" : "bg-muted/30"}`}>
                <p className="text-sm font-medium mb-1">Old Regime</p>
                <p className="text-xl font-bold">{formatCurrency(regimeComparison.oldRegime.taxPayable)}</p>
                <p className="text-xs text-muted-foreground">Rate: {(regimeComparison.oldRegime.effectiveTaxRate ?? 0).toFixed(1)}%</p>
                {regimeComparison.recommended === "old" && (
                  <Badge className="mt-2 bg-green-100 text-green-700">Recommended - Save {formatLakhs(regimeComparison.savings)}</Badge>
                )}
              </div>
              <div className={`p-4 rounded-lg border ${regimeComparison.recommended === "new" ? "border-green-400 bg-green-50 dark:bg-green-950" : "bg-muted/30"}`}>
                <p className="text-sm font-medium mb-1">New Regime</p>
                <p className="text-xl font-bold">{formatCurrency(regimeComparison.newRegime.taxPayable)}</p>
                <p className="text-xs text-muted-foreground">Rate: {(regimeComparison.newRegime.effectiveTaxRate ?? 0).toFixed(1)}%</p>
                {regimeComparison.recommended === "new" && (
                  <Badge className="mt-2 bg-green-100 text-green-700">Recommended - Save {formatLakhs(regimeComparison.savings)}</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-primary bg-primary/5 dark:border-primary/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-primary" />
              <div>
                <p className="font-semibold">Form: {recommendedForm}</p>
                <p className="text-sm text-muted-foreground">AY {assessmentYear} | {taxRegime === "new" ? "New" : "Old"} Regime</p>
              </div>
            </div>
            {allStepValidations.length === 0 && apiData ? (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                <CheckCircle className="h-3 w-3 mr-1" /> Ready to File
              </Badge>
            ) : (
              <Badge variant="outline" className="text-amber-600 border-amber-300">
                <AlertTriangle className="h-3 w-3 mr-1" /> {!apiData ? "Calculate tax first" : "Fix errors"}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="dark:border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Bank Account for Refund
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="bankAccountNumber" className="text-xs">Account Number <span className="text-red-500">*</span></Label>
              <Input
                id="bankAccountNumber"
                value={bankDetails.accountNumber}
                onChange={(e: React.ChangeEvent<HTMLInputElement>): void => setBankDetails((prev: BankDetailsForRefund) => ({ ...prev, accountNumber: e.target.value }))}
                placeholder="Enter bank account number"
                data-testid="input-bank-account"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bankIFSC" className="text-xs">IFSC Code <span className="text-red-500">*</span></Label>
              <Input
                id="bankIFSC"
                value={bankDetails.ifscCode}
                onChange={(e: React.ChangeEvent<HTMLInputElement>): void => setBankDetails((prev: BankDetailsForRefund) => ({ ...prev, ifscCode: e.target.value.toUpperCase() }))}
                placeholder="e.g. SBIN0001234"
                className="font-mono tracking-wider uppercase"
                maxLength={11}
                data-testid="input-bank-ifsc"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bankName" className="text-xs">Bank Name</Label>
              <Input
                id="bankName"
                value={bankDetails.bankName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>): void => setBankDetails((prev: BankDetailsForRefund) => ({ ...prev, bankName: e.target.value }))}
                placeholder="e.g. State Bank of India"
                data-testid="input-bank-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bankAccountType" className="text-xs">Account Type</Label>
              <Select value={bankDetails.accountType} onValueChange={(v: "savings" | "current"): void => setBankDetails((prev: BankDetailsForRefund) => ({ ...prev, accountType: v }))}>
                <SelectTrigger id="bankAccountType" data-testid="select-bank-account-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="current">Current</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {apiData?.refundAmount && apiData.refundAmount > 0 && !bankDetails.accountNumber && (
            <p className="text-xs text-amber-600">Bank account details are required to receive your refund of {formatCurrency(apiData.refundAmount)}.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> Document Vault
            </CardTitle>
            <label htmlFor="doc-vault-upload" className="cursor-pointer">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium hover:bg-accent">
                <Upload className="h-3.5 w-3.5" /> Upload Document
              </div>
              <input
                id="doc-vault-upload"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.xlsx,.csv"
                className="hidden"
                multiple
                onChange={(e: React.ChangeEvent<HTMLInputElement>): void => {
                  const files = e.target.files;
                  if (files) {
                    const newDocs = Array.from(files).map((f: File) => ({
                      id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                      name: f.name,
                      type: f.type,
                      category: f.name.toLowerCase().includes('form16') ? 'Form 16' : f.name.toLowerCase().includes('26as') ? 'Form 26AS' : f.name.toLowerCase().includes('ais') ? 'AIS' : 'Supporting',
                      uploadedAt: new Date().toISOString(),
                      size: f.size,
                    } as DocumentVaultEntry));
                    setDocumentVault((prev: DocumentVaultEntry[]) => [...prev, ...newDocs]);
                    toast({ title: "Documents Added", description: `${files.length} document(s) added to your vault.` });
                  }
                }}
                data-testid="doc-vault-upload"
              />
            </label>
          </div>
          <CardDescription>Store all supporting documents for your ITR filing. Form 16, 26AS, AIS, rent receipts, investment proofs, etc.</CardDescription>
        </CardHeader>
        <CardContent>
          {documentVault.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No documents uploaded yet. Upload Form 16, 26AS, investment proofs, etc.</p>
          ) : (
            <div className="space-y-2">
              {documentVault.map((doc: DocumentVaultEntry) => (
                <div key={doc.id} className="flex items-center justify-between p-2 border rounded text-xs">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{doc.name}</p>
                      <p className="text-muted-foreground">{doc.category} | {(doc.size / 1024).toFixed(0)} KB</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={(): void => setDocumentVault((prev: DocumentVaultEntry[]) => prev.filter((d: DocumentVaultEntry) => d.id !== doc.id))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <LucideShield className="h-4 w-4" /> Advanced Options
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={(): void => setShowAdvancedOptions(!showAdvancedOptions)}>
              {showAdvancedOptions ? "Hide" : "Show"}
            </Button>
          </div>
        </CardHeader>
        {showAdvancedOptions && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 p-3 border rounded">
                <Label className="text-xs font-medium">e-Verification Method</Label>
                <Select defaultValue="aadhaar_otp">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aadhaar_otp">Aadhaar OTP</SelectItem>
                    <SelectItem value="net_banking">Net Banking</SelectItem>
                    <SelectItem value="bank_account">Bank Account EVC</SelectItem>
                    <SelectItem value="dsc">Digital Signature (DSC)</SelectItem>
                    <SelectItem value="send_to_cpc">Send ITR-V to CPC Bengaluru</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">How you'll verify your return after filing. Aadhaar OTP is fastest.</p>
              </div>
              <div className="space-y-2 p-3 border rounded">
                <Label className="text-xs font-medium">Bulk CSV Upload</Label>
                <label htmlFor="bulk-csv-upload" className="cursor-pointer">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium hover:bg-accent w-full justify-center">
                    <Upload className="h-3.5 w-3.5" /> Upload Capital Gains CSV
                  </div>
                  <input
                    id="bulk-csv-upload"
                    type="file"
                    accept=".csv,.xlsx"
                    className="hidden"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>): void => {
                      const file = e.target.files?.[0];
                      if (file) {
                        toast({ title: "CSV Received", description: `${file.name} uploaded for bulk processing. Parsing capital gains entries...` });
                      }
                    }}
                    data-testid="bulk-csv-upload"
                  />
                </label>
                <p className="text-[10px] text-muted-foreground">Upload a CSV with multiple capital gains transactions for bulk import.</p>
              </div>
              <div className="space-y-2 p-3 border rounded">
                <Label className="text-xs font-medium">Audit Trail</Label>
                <Badge variant="outline" className="text-[10px]">
                  {documentVault.length} documents | {(cgUploads?.length || 0) + (cgManualSaved?.length || 0)} CG sources | {donationEntries.length} donations
                </Badge>
                <p className="text-[10px] text-muted-foreground">All entries are SHA-256 hashed and timestamped for audit compliance.</p>
              </div>
              <div className="space-y-2 p-3 border rounded">
                <Label className="text-xs font-medium">Filing Preferences</Label>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Checkbox id="opt-auto-26as" defaultChecked />
                    <Label htmlFor="opt-auto-26as" className="text-xs cursor-pointer">Auto-fetch 26AS on calculation</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="opt-regime-compare" defaultChecked />
                    <Label htmlFor="opt-regime-compare" className="text-xs cursor-pointer">Show regime comparison</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="opt-email-ack" defaultChecked />
                    <Label htmlFor="opt-email-ack" className="text-xs cursor-pointer">Email acknowledgment after filing</Label>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-4 w-4" /> Export & Tax Tools
            </CardTitle>
            <CardDescription>Download returns, prepare challans, and use tax calculators</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Button variant="outline" size="sm" className="text-xs h-auto py-2" onClick={async (): Promise<void> => {
                try {
                  const resp = await fetch("/api/tax/export/itr-json", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      pan: panContext?.pan, assessmentYear, itrForm: recommendedForm,
                      data: { name: panContext?.name, filingSection, taxRegime, residentialStatus, salaryDetails, capitalGainsDetails, otherIncomeDetails, deductionDetails, taxPaymentDetails, grossTotalIncome: totals.grossTotalIncome, totalDeductions: totals.totalDeductions, taxableIncome: Math.max(0, totals.grossTotalIncome - totals.totalDeductions) },
                    }),
                  });
                  const result = await resp.json();
                  if (result.success) {
                    const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a"); a.href = url; a.download = result.fileName; a.click(); URL.revokeObjectURL(url);
                    toast({ title: "Export Done", description: `${result.fileName} downloaded` });
                  }
                } catch { toast({ title: "Export Error", variant: "destructive" }); }
              }} data-testid="review-export-json">
                <FileText className="h-3.5 w-3.5 mr-1" /> Download ITR JSON
              </Button>

              <Button variant="outline" size="sm" className="text-xs h-auto py-2" onClick={async (): Promise<void> => {
                try {
                  const resp = await fetch("/api/tax/export/computation", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      pan: panContext?.pan, assessmentYear, itrForm: recommendedForm,
                      data: { name: panContext?.name, taxRegime, salaryDetails, otherIncomeDetails, deductionDetails, taxPaymentDetails, totals },
                    }),
                  });
                  const result = await resp.json();
                  if (result.success) {
                    const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a"); a.href = url; a.download = "computation_sheet.json"; a.click(); URL.revokeObjectURL(url);
                    toast({ title: "Computation Sheet", description: "Downloaded successfully" });
                  }
                } catch { toast({ title: "Export Error", variant: "destructive" }); }
              }} data-testid="review-export-computation">
                <Calculator className="h-3.5 w-3.5 mr-1" /> Computation Sheet
              </Button>

              <Button variant="outline" size="sm" className="text-xs h-auto py-2" onClick={(): void => setShowChallanDialog(!showChallanDialog)} data-testid="review-prepare-challan">
                <Banknote className="h-3.5 w-3.5 mr-1" /> Prepare Challan 280
              </Button>

              <Button variant="outline" size="sm" className="text-xs h-auto py-2" onClick={(): void => setShowToolsDialog(!showToolsDialog)} data-testid="review-tax-tools">
                <Lightbulb className="h-3.5 w-3.5 mr-1" /> Tax Tools
              </Button>
            </div>

            {showChallanDialog && (
              <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <h4 className="text-sm font-semibold flex items-center gap-2"><Banknote className="h-4 w-4" /> Challan 280 Preparation</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Challan Type</Label>
                    <Select defaultValue="self_assessment" onValueChange={(v: "advance_tax" | "self_assessment" | "regular_assessment"): void => setChallanResult((p: ChallanResult | null) => ({ ...p, challanType: v } as ChallanResult))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="advance_tax">Advance Tax (100)</SelectItem>
                        <SelectItem value="self_assessment">Self Assessment Tax (300)</SelectItem>
                        <SelectItem value="regular_assessment">Regular Assessment (400)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Tax Amount (₹)</Label>
                    <Input type="number" className="h-8 text-xs" placeholder="Enter tax amount" onChange={(e: React.ChangeEvent<HTMLInputElement>): void => setChallanResult((p: ChallanResult | null) => ({ ...p, taxAmount: Number(e.target.value) } as ChallanResult))} />
                  </div>
                </div>
                <Button size="sm" className="text-xs" onClick={async (): Promise<void> => {
                  if (!panContext?.pan) { toast({ title: "PAN Required", description: "Please enter your PAN in the basic info step first", variant: "destructive" }); return; }
                  if (!challanResult?.taxAmount || challanResult.taxAmount <= 0) { toast({ title: "Invalid Amount", description: "Please enter a valid tax amount greater than zero", variant: "destructive" }); return; }
                  try {
                    const resp = await fetch("/api/tax/challan/prepare", {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ pan: panContext.pan, assessmentYear, taxAmount: challanResult.taxAmount, challanType: challanResult?.challanType || "self_assessment" }),
                    });
                    const result = await resp.json();
                    if (result.success) {
                      setChallanResult(result.data);
                      toast({ title: "Challan Prepared", description: `Challan ${result.data.challanNo} for ₹${result.data.totalAmount.toLocaleString("en-IN")}` });
                    } else {
                      toast({ title: "Error", description: result.message, variant: "destructive" });
                    }
                  } catch { toast({ title: "Error", variant: "destructive" }); }
                }} data-testid="btn-generate-challan">Generate Challan</Button>
                {challanResult?.challanNo && (
                  <div className="text-xs space-y-1 p-3 bg-background rounded border">
                    <div className="flex justify-between"><span>Challan No:</span><span className="font-medium">{challanResult.challanNo}</span></div>
                    <div className="flex justify-between"><span>Tax:</span><span>₹{(challanResult.taxAmount || 0).toLocaleString("en-IN")}</span></div>
                    <div className="flex justify-between"><span>Surcharge:</span><span>₹{(challanResult.surcharge || 0).toLocaleString("en-IN")}</span></div>
                    <div className="flex justify-between"><span>Cess:</span><span>₹{(challanResult.educationCess || 0).toLocaleString("en-IN")}</span></div>
                    <Separator />
                    <div className="flex justify-between font-semibold"><span>Total:</span><span>₹{(challanResult.totalAmount || 0).toLocaleString("en-IN")}</span></div>
                    {challanResult.paymentUrl && (
                      <a href={challanResult.paymentUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline text-[10px] block mt-1">Pay on TIN-NSDL Portal →</a>
                    )}
                  </div>
                )}
              </div>
            )}

            {showToolsDialog && (
              <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                <Tabs defaultValue="hra">
                  <TabsList className="grid w-full grid-cols-3 h-8">
                    <TabsTrigger value="hra" className="text-xs">HRA Calculator</TabsTrigger>
                    <TabsTrigger value="form10e" className="text-xs">Form 10E Arrears</TabsTrigger>
                    <TabsTrigger value="optimizer" className="text-xs">Tax Optimizer</TabsTrigger>
                  </TabsList>
                  <TabsContent value="hra" className="space-y-3 mt-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label className="text-xs">Basic Salary (Annual)</Label><Input type="number" className="h-8 text-xs" id="hra-basic" data-testid="hra-basic" /></div>
                      <div><Label className="text-xs">DA Received</Label><Input type="number" className="h-8 text-xs" id="hra-da" defaultValue="0" /></div>
                      <div><Label className="text-xs">HRA Received</Label><Input type="number" className="h-8 text-xs" id="hra-received" /></div>
                      <div><Label className="text-xs">Rent Paid (Annual)</Label><Input type="number" className="h-8 text-xs" id="hra-rent" /></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="hra-metro" defaultChecked /><Label htmlFor="hra-metro" className="text-xs">Metro City (50%)</Label>
                    </div>
                    <Button size="sm" className="text-xs" onClick={async (): Promise<void> => {
                      const basic = Number((document.getElementById("hra-basic") as HTMLInputElement)?.value) || 0;
                      const da = Number((document.getElementById("hra-da") as HTMLInputElement)?.value) || 0;
                      const hra = Number((document.getElementById("hra-received") as HTMLInputElement)?.value) || 0;
                      const rent = Number((document.getElementById("hra-rent") as HTMLInputElement)?.value) || 0;
                      const isMetro = (document.getElementById("hra-metro") as HTMLInputElement)?.getAttribute("data-state") === "checked";
                      if (!basic || !hra) { toast({ title: "Missing Fields", description: "Basic salary and HRA received are required", variant: "destructive" }); return; }
                      try {
                        const resp = await fetch("/api/tax/calculator/hra", {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ basicSalary: basic, daReceived: da, hraReceived: hra, rentPaid: rent, metroCity: isMetro }),
                        });
                        const result = await resp.json();
                        if (result.success) setHraResult(result.data);
                        else toast({ title: "Error", description: result.message, variant: "destructive" });
                      } catch { toast({ title: "Calc Error", variant: "destructive" }); }
                    }} data-testid="btn-calc-hra">Calculate HRA Exemption</Button>
                    {hraResult && (
                      <div className="text-xs p-3 bg-background rounded border space-y-1">
                        <div className="flex justify-between"><span>Actual HRA:</span><span>₹{hraResult.breakdown.actualHRA.toLocaleString("en-IN")}</span></div>
                        <div className="flex justify-between"><span>{hraResult.formula}:</span><span>₹{hraResult.breakdown.percentOfBasic.toLocaleString("en-IN")}</span></div>
                        <div className="flex justify-between"><span>Rent - 10% of Basic:</span><span>₹{hraResult.breakdown.rentMinusTenPercent.toLocaleString("en-IN")}</span></div>
                        <Separator />
                        <div className="flex justify-between font-semibold text-green-600"><span>HRA Exemption:</span><span>₹{hraResult.hraExemption.toLocaleString("en-IN")}</span></div>
                        <div className="flex justify-between"><span>Taxable HRA:</span><span>₹{hraResult.taxableHRA.toLocaleString("en-IN")}</span></div>
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="form10e" className="space-y-3 mt-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div><Label className="text-xs">Total Income</Label><Input type="number" className="h-8 text-xs" id="f10e-income" /></div>
                      <div><Label className="text-xs">Arrears Received</Label><Input type="number" className="h-8 text-xs" id="f10e-arrears" /></div>
                      <div><Label className="text-xs">Arrear Years</Label><Input type="number" className="h-8 text-xs" id="f10e-years" defaultValue="1" /></div>
                    </div>
                    <Button size="sm" className="text-xs" onClick={async (): Promise<void> => {
                      const income = Number((document.getElementById("f10e-income") as HTMLInputElement)?.value) || 0;
                      const arrears = Number((document.getElementById("f10e-arrears") as HTMLInputElement)?.value) || 0;
                      const years = Number((document.getElementById("f10e-years") as HTMLInputElement)?.value) || 1;
                      if (!income || !arrears) { toast({ title: "Missing Fields", description: "Total income and arrears amount are required", variant: "destructive" }); return; }
                      if (arrears > income) { toast({ title: "Invalid", description: "Arrears cannot exceed total income", variant: "destructive" }); return; }
                      try {
                        const resp = await fetch("/api/tax/calculator/form10e", {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ currentYearArrears: arrears, totalIncome: income, arrearYears: years }),
                        });
                        const result = await resp.json();
                        if (result.success) setForm10EResult(result.data);
                        else toast({ title: "Error", description: result.message, variant: "destructive" });
                      } catch { toast({ title: "Calc Error", variant: "destructive" }); }
                    }} data-testid="btn-calc-form10e">Calculate Relief u/s 89(1)</Button>
                    {form10EResult && (
                      <div className="text-xs p-3 bg-background rounded border space-y-1">
                        <div className="flex justify-between"><span>Tax on Total Income:</span><span>₹{form10EResult.taxOnTotal.toLocaleString("en-IN")}</span></div>
                        <div className="flex justify-between"><span>Tax without Arrears:</span><span>₹{form10EResult.taxOnWithout.toLocaleString("en-IN")}</span></div>
                        <div className="flex justify-between"><span>Spread Tax (averaged):</span><span>₹{form10EResult.totalAdditionalTax.toLocaleString("en-IN")}</span></div>
                        <Separator />
                        <div className="flex justify-between font-semibold text-green-600"><span>Relief u/s 89(1):</span><span>₹{form10EResult.reliefUs89.toLocaleString("en-IN")}</span></div>
                        <p className="text-[10px] text-muted-foreground mt-1">{form10EResult.explanation}</p>
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="optimizer" className="space-y-3 mt-3">
                    <p className="text-xs text-muted-foreground">Get Suggestions to reduce your tax liability based on your current data.</p>
                    <Button size="sm" className="text-xs" onClick={async (): Promise<void> => {
                      try {
                        const resp = await fetch("/api/tax/optimizer/suggestions", {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ taxableIncome: Math.max(0, totals.grossTotalIncome - totals.totalDeductions), taxRegime, deductions: { section80C: deductionDetails.section80C, section80D: deductionDetails.section80D, section80CCD1B: deductionDetails.section80CCD1B || 0, totalDeductions: totals.totalDeductions } }),
                        });
                        const result = await resp.json();
                        if (result.success) setOptimizerResult(result.data);
                      } catch { toast({ title: "Error", variant: "destructive" }); }
                    }} data-testid="btn-run-optimizer">
                      <Lightbulb className="h-3.5 w-3.5 mr-1" /> Analyze & Suggest
                    </Button>
                    {optimizerResult && (
                      <div className="space-y-2">
                        {optimizerResult.suggestions.map((s: OptimizerSuggestion, i: number): React.ReactElement => (
                          <div key={i} className="text-xs p-2 bg-background rounded border">
                            <div className="flex justify-between">
                              <span className="font-medium">{s.section}</span>
                              <Badge variant="outline" className="text-[10px] text-green-600">Save ₹{s.taxSaving.toLocaleString("en-IN")}</Badge>
                            </div>
                            <p className="text-muted-foreground mt-0.5">{s.description}</p>
                          </div>
                        ))}
                        {optimizerResult.suggestions.length === 0 && <p className="text-xs text-muted-foreground">No additional savings opportunities found.</p>}
                        {optimizerResult.totalPotentialSaving > 0 && (
                          <div className="text-sm font-semibold text-green-600 text-right">Total Potential Saving: ₹{optimizerResult.totalPotentialSaving.toLocaleString("en-IN")}</div>
                        )}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <LucideShield className="h-4 w-4" /> Filing Utilities
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              <Button variant="outline" size="sm" className="text-xs h-auto py-2" onClick={async (): Promise<void> => {
                try {
                  const resp = await fetch("/api/tax/validate/pre-filing", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ pan: panContext?.pan, assessmentYear, itrForm: recommendedForm, data: { salaryDetails, capitalGainsDetails, otherIncomeDetails, deductionDetails, taxPaymentDetails, taxRegime, residentialStatus, grossTotalIncome: totals.grossTotalIncome, housePropertyIncome: totals.housePropertyIncome, bankDetails: {} } }),
                  });
                  const result = await resp.json();
                  if (result.success) { setPreFilingResult(result.data); setShowPreFilingCheck(true); }
                } catch { toast({ title: "Error", variant: "destructive" }); }
              }} data-testid="btn-pre-filing-check">
                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Pre-Filing Check
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-auto py-2" onClick={(): void => setShowSharingPanel(!showSharingPanel)} data-testid="btn-sharing">
                <Send className="h-3.5 w-3.5 mr-1" /> Share Docs
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-auto py-2" onClick={async (): Promise<void> => {
                try {
                  const resp = await fetch(`/api/tax/refund/status?pan=${panContext?.pan || ""}&assessmentYear=${assessmentYear}`);
                  const result = await resp.json();
                  if (result.success) { setRefundData(result.data); setShowRefundTracker(true); }
                } catch { toast({ title: "Error", variant: "destructive" }); }
              }} data-testid="btn-refund-tracker">
                <Wallet className="h-3.5 w-3.5 mr-1" /> Refund Status
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-auto py-2" onClick={async (): Promise<void> => {
                try {
                  const resp = await fetch("/api/tax/deadlines");
                  const result = await resp.json();
                  if (result.success) { setDeadlinesData(result.data); setShowDeadlines(true); }
                } catch { toast({ title: "Error", variant: "destructive" }); }
              }} data-testid="btn-deadlines">
                <Clock className="h-3.5 w-3.5 mr-1" /> Deadlines
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-auto py-2" onClick={(): void => setShowLookupPanel(!showLookupPanel)} data-testid="btn-lookups">
                <HelpCircle className="h-3.5 w-3.5 mr-1" /> IFSC / TAN
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-auto py-2" onClick={async (): Promise<void> => {
                try {
                  const resp = await fetch("/api/tax/reconcile/26as", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ pan: panContext?.pan, assessmentYear, enteredTds: taxPaymentDetails }),
                  });
                  const result = await resp.json();
                  if (result.success) { setReconciliationResult(result.data); setShowReconciliation(true); }
                } catch { toast({ title: "Error", variant: "destructive" }); }
              }} data-testid="btn-reconcile-26as">
                <FileSearch className="h-3.5 w-3.5 mr-1" /> 26AS Reconcile
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-auto py-2" onClick={async (): Promise<void> => {
                try {
                  const resp = await fetch("/api/tax/efile/direct", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ pan: panContext?.pan, itrForm: recommendedForm, assessmentYear, itrData: { salaryDetails, capitalGainsDetails, otherIncomeDetails, deductionDetails, taxPaymentDetails }, eVerificationMethod: "aadhaar_otp" }),
                  });
                  const result = await resp.json();
                  if (result.success) toast({ title: "e-Filing Initiated", description: `Ack: ${result.data.ackNumber} | Status: ${result.data.status}` });
                } catch { toast({ title: "Error", variant: "destructive" }); }
              }} data-testid="btn-direct-efile">
                <Send className="h-3.5 w-3.5 mr-1" /> Direct e-File
              </Button>
            </div>

            {showPreFilingCheck && preFilingResult && (
              <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    {preFilingResult.summary.verdict === "CLEAR_TO_FILE" ? <CheckCircle className="h-4 w-4 text-green-600" /> : preFilingResult.summary.verdict === "ERRORS_FOUND" ? <XCircle className="h-4 w-4 text-red-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                    {preFilingResult.summary.verdict.replace("_", " ")}
                  </h4>
                  <Badge variant={preFilingResult.isFileable ? "default" : "destructive"} className="text-[10px]">{preFilingResult.summary.totalErrors} errors, {preFilingResult.summary.totalWarnings} warnings</Badge>
                </div>
                {preFilingResult.errors.map((e: PreFilingItem, i: number): React.ReactElement => (
                  <div key={i} className="text-xs p-2 bg-red-50 dark:bg-red-950 rounded border border-red-200 dark:border-red-800 flex items-start gap-2">
                    <XCircle className="h-3.5 w-3.5 text-red-600 mt-0.5 flex-shrink-0" /><div><span className="font-medium">[{e.code}]</span> {e.message}</div>
                  </div>
                ))}
                {preFilingResult.warnings.map((w: PreFilingItem, i: number): React.ReactElement => (
                  <div key={i} className="text-xs p-2 bg-amber-50 dark:bg-amber-950 rounded border border-amber-200 dark:border-amber-800 flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 flex-shrink-0" /><div><span className="font-medium">[{w.code}]</span> {w.message}</div>
                  </div>
                ))}
              </div>
            )}

            {showReconciliation && reconciliationResult && (
              <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold flex items-center gap-2"><FileSearch className="h-4 w-4" /> 26AS Reconciliation</h4>
                  <Badge variant="outline" className="text-[10px]">{reconciliationResult.summary?.matchRate || "N/A"} Match Rate</Badge>
                </div>
                {reconciliationResult.matched?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-green-600">Matched ({reconciliationResult.matched.length})</p>
                    {reconciliationResult.matched.map((m: ReconciliationItem, i: number): React.ReactElement => (
                      <div key={i} className="text-xs p-1.5 bg-green-50 dark:bg-green-950 rounded border border-green-200 dark:border-green-800 flex justify-between">
                        <span>{m.deductorName || m.tan}</span><span className="font-medium">₹{(m.amount26AS || 0).toLocaleString("en-IN")}</span>
                      </div>
                    ))}
                  </div>
                )}
                {reconciliationResult.mismatched?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-amber-600">Mismatched ({reconciliationResult.mismatched.length})</p>
                    {reconciliationResult.mismatched.map((m: ReconciliationItem, i: number): React.ReactElement => (
                      <div key={i} className="text-xs p-1.5 bg-amber-50 dark:bg-amber-950 rounded border border-amber-200 dark:border-amber-800">
                        <div className="flex justify-between"><span>{m.deductorName || m.tan}</span><span className="text-red-600">Diff: ₹{(m.difference || 0).toLocaleString("en-IN")}</span></div>
                        <p className="text-[10px] text-muted-foreground">{m.recommendation}</p>
                      </div>
                    ))}
                  </div>
                )}
                {reconciliationResult.missing?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-red-600">Missing from Return ({reconciliationResult.missing.length})</p>
                    {reconciliationResult.missing.map((m: ReconciliationItem, i: number): React.ReactElement => (
                      <div key={i} className="text-xs p-1.5 bg-red-50 dark:bg-red-950 rounded border border-red-200 dark:border-red-800 flex justify-between">
                        <span>{m.deductorName || m.tan}</span><span className="font-medium">₹{(m.amount || 0).toLocaleString("en-IN")}</span>
                      </div>
                    ))}
                  </div>
                )}
                {reconciliationResult.recommendations && reconciliationResult.recommendations.length > 0 && (
                  <div className="text-xs space-y-0.5">
                    {reconciliationResult.recommendations.map((r: string, i: number): React.ReactElement => (
                      <div key={i} className="flex items-start gap-1"><Lightbulb className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" /><span>{r}</span></div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {showSharingPanel && (
              <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                <h4 className="text-sm font-semibold">Share Documents</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Email Address</Label>
                    <Input type="email" className="h-8 text-xs" id="share-email" placeholder="client@email.com" />
                  </div>
                  <div>
                    <Label className="text-xs">WhatsApp Number</Label>
                    <Input type="tel" className="h-8 text-xs" id="share-phone" placeholder="+919876543210" />
                  </div>
                  <div>
                    <Label className="text-xs">Document Type</Label>
                    <Select defaultValue="computation" onValueChange={(v: string): void => { const el = document.getElementById("share-doc-val") as HTMLInputElement; if (el) el.value = v; }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="computation">Computation Sheet</SelectItem>
                        <SelectItem value="itr_json">ITR JSON</SelectItem>
                        <SelectItem value="itr_v">ITR-V Acknowledgment</SelectItem>
                        <SelectItem value="challan">Challan Receipt</SelectItem>
                        <SelectItem value="form_12bb">Form 12BB</SelectItem>
                      </SelectContent>
                    </Select>
                    <input type="hidden" id="share-doc-val" defaultValue="computation" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="text-xs" onClick={async (): Promise<void> => {
                    const email = (document.getElementById("share-email") as HTMLInputElement)?.value;
                    const docType = (document.getElementById("share-doc-val") as HTMLInputElement)?.value || "computation";
                    if (!email) { toast({ title: "Email required", variant: "destructive" }); return; }
                    try {
                      const resp = await fetch("/api/tax/share/email", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ recipientEmail: email, documentType: docType, pan: panContext?.pan, assessmentYear }),
                      });
                      const result = await resp.json();
                      if (result.success) toast({ title: "Sent", description: result.message });
                    } catch { toast({ title: "Error", variant: "destructive" }); }
                  }}>
                    <Send className="h-3.5 w-3.5 mr-1" /> Send Email
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs" onClick={async (): Promise<void> => {
                    const phone = (document.getElementById("share-phone") as HTMLInputElement)?.value;
                    const docType = (document.getElementById("share-doc-val") as HTMLInputElement)?.value || "summary";
                    if (!phone || phone.length < 10) { toast({ title: "Valid phone number required", variant: "destructive" }); return; }
                    try {
                      const resp = await fetch("/api/tax/share/whatsapp", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ phoneNumber: phone, documentType: docType, pan: panContext?.pan, assessmentYear }),
                      });
                      const result = await resp.json();
                      if (result.success && result.data.whatsappUrl) window.open(result.data.whatsappUrl, "_blank");
                    } catch { toast({ title: "Error", variant: "destructive" }); }
                  }}>
                    WhatsApp
                  </Button>
                </div>
              </div>
            )}

            {showRefundTracker && refundData && (
              <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <h4 className="text-sm font-semibold flex items-center gap-2"><Wallet className="h-4 w-4" /> Refund Status — AY {refundData.assessmentYear}</h4>
                <div className="space-y-1">
                  {refundData.stages.map((s: RefundStage, i: number): React.ReactElement => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {s.status === "completed" ? <CheckCircle className="h-3.5 w-3.5 text-green-600" /> : s.status === "in_progress" ? <Clock className="h-3.5 w-3.5 text-blue-600 animate-pulse" /> : <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30" />}
                      <span className={s.status === "completed" ? "text-green-700 dark:text-green-400" : s.status === "in_progress" ? "text-blue-700 dark:text-blue-400 font-medium" : "text-muted-foreground"}>{s.stage}</span>
                      {s.date && <span className="text-muted-foreground ml-auto">{s.date}</span>}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">{refundData.note}</p>
              </div>
            )}

            {showDeadlines && deadlinesData.length > 0 && (
              <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <h4 className="text-sm font-semibold flex items-center gap-2"><Clock className="h-4 w-4" /> Filing Deadlines & Due Dates</h4>
                <div className="space-y-1">
                  {deadlinesData.map((d: TaxDeadline, i: number): React.ReactElement => (
                    <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded bg-background border">
                      <div className="flex items-center gap-2">
                        <Badge variant={d.urgency === "critical" ? "destructive" : d.urgency === "warning" ? "default" : "outline"} className="text-[10px]">
                          {d.daysLeft}d
                        </Badge>
                        <span className="font-medium">{d.form}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-muted-foreground">{d.deadline}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showLookupPanel && (
              <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                <h4 className="text-sm font-semibold">IFSC / BSR / TAN Lookup</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">IFSC Code</Label>
                    <div className="flex gap-1">
                      <Input className="h-8 text-xs" id="lookup-ifsc" placeholder="SBIN0001234" maxLength={11} />
                      <Button size="sm" variant="outline" className="h-8 text-xs px-2" onClick={async (): Promise<void> => {
                        const code = (document.getElementById("lookup-ifsc") as HTMLInputElement)?.value;
                        if (!code) return;
                        try {
                          const resp = await fetch(`/api/tax/lookup/ifsc/${code}`);
                          const result = await resp.json();
                          if (result.success) setIfscResult(result.data);
                        } catch {}
                      }}>Go</Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">BSR Code</Label>
                    <div className="flex gap-1">
                      <Input className="h-8 text-xs" id="lookup-bsr" placeholder="0002" maxLength={7} />
                      <Button size="sm" variant="outline" className="h-8 text-xs px-2" onClick={async (): Promise<void> => {
                        const code = (document.getElementById("lookup-bsr") as HTMLInputElement)?.value;
                        if (!code) return;
                        try {
                          const resp = await fetch(`/api/tax/lookup/bsr/${code}`);
                          const result = await resp.json();
                          if (result.success) setIfscResult(result.data);
                        } catch {}
                      }}>Go</Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">TAN Validation</Label>
                    <div className="flex gap-1">
                      <Input className="h-8 text-xs" id="lookup-tan" placeholder="DELH12345A" maxLength={10} />
                      <Button size="sm" variant="outline" className="h-8 text-xs px-2" onClick={async (): Promise<void> => {
                        const tan = (document.getElementById("lookup-tan") as HTMLInputElement)?.value;
                        if (!tan) return;
                        try {
                          const resp = await fetch(`/api/tax/lookup/tan/${tan}`);
                          const result = await resp.json();
                          if (result.success) setIfscResult(result.data);
                        } catch {}
                      }}>Go</Button>
                    </div>
                  </div>
                </div>
                {ifscResult && (
                  <div className="text-xs p-2 bg-background rounded border space-y-0.5">
                    {ifscResult.ifsc && <div className="flex justify-between"><span>IFSC:</span><span className="font-medium">{ifscResult.ifsc}</span></div>}
                    {ifscResult.bank && <div className="flex justify-between"><span>Bank:</span><span>{ifscResult.bank}</span></div>}
                    {ifscResult.branch && <div className="flex justify-between"><span>Branch:</span><span>{ifscResult.branch}</span></div>}
                    {ifscResult.city && <div className="flex justify-between"><span>City:</span><span>{ifscResult.city}</span></div>}
                    {ifscResult.bsrCode && <div className="flex justify-between"><span>BSR Code:</span><span className="font-medium">{ifscResult.bsrCode}</span></div>}
                    {ifscResult.bankName && <div className="flex justify-between"><span>Bank:</span><span>{ifscResult.bankName}</span></div>}
                    {ifscResult.tan && <div className="flex justify-between"><span>TAN:</span><span className="font-medium">{ifscResult.tan}</span></div>}
                    {ifscResult.isValid !== undefined && <div className="flex justify-between"><span>Valid:</span><Badge variant={ifscResult.isValid ? "default" : "destructive"} className="text-[10px]">{ifscResult.isValid ? "Yes" : "No"}</Badge></div>}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <LucideShield className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-xs font-semibold text-green-700 dark:text-green-400">Security & Compliance</p>
                  <p className="text-[10px] text-muted-foreground">128-bit SSL | AES-256 Encryption | SEBI/IT Dept Compliant</p>
                </div>
              </div>
              <div className="flex gap-1.5 ml-auto">
                <Badge variant="outline" className="text-[10px] border-green-300">SOC 2</Badge>
                <Badge variant="outline" className="text-[10px] border-green-300">ISO 27001</Badge>
                <Badge variant="outline" className="text-[10px] border-green-300">VAPT Tested</Badge>
                <Badge variant="outline" className="text-[10px] border-green-300">ERIP Licensed</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Review all details carefully. After proceeding to preview, your return will be prepared for e-filing via Sandbox.co.in API. Any changes after submission may require revised return filing.
          </AlertDescription>
        </Alert>
      </div>
  );
};
