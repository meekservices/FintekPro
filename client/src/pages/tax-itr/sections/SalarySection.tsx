import React from "react";
import { Globe, Upload, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FieldHint, CurrencyInput, ValidationBanner, formatCurrency } from "@/components/tax-itr/TaxITRHelpers";
import { useTax } from "../TaxContext";

export const SalarySection: React.FC = () => {
  const {
    panContext,
    aisLoading,
    handleFetchAIS,
    aisData,
    form16Uploading,
    handleForm16Upload,
    employerDetails,
    setEmployerDetails,
    salaryDetails,
    setSalaryDetails,
    totals,
    validateStep,
    currentStepId
  } = useTax();

  const currentValidation = validateStep(currentStepId);
  const salaryIncomeTotal = totals.grossSalary;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">Enter details from your Form 16 Part B, or upload it for auto-fill.</p>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleFetchAIS} disabled={aisLoading || !panContext?.pan} data-testid="btn-fetch-ais">
            <Globe className="h-4 w-4 mr-1" />
            {aisLoading ? "Fetching AIS..." : aisData?.loaded ? "AIS Loaded ✓" : "Fetch AIS"}
          </Button>
          <label htmlFor="form16-upload" className="cursor-pointer">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium transition-colors ${form16Uploading ? 'opacity-50 cursor-wait' : 'hover:bg-accent'}`}>
            <Upload className="h-4 w-4" />
            {form16Uploading ? "Parsing..." : "Upload Form 16"}
          </div>
          <input
            id="form16-upload"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            disabled={form16Uploading}
            onChange={(e: React.ChangeEvent<HTMLInputElement>): void => {
              const file = e.target.files?.[0];
              if (file) handleForm16Upload(file);
            }}
            data-testid="input-form16-upload"
          />
        </label>
        </div>
      </div>

      {aisData?.loaded && (
        <Alert className="bg-green-50 dark:bg-green-950 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-xs">
            <strong>AIS data pre-filled:</strong> {aisData.salaryIncome > 0 ? `Salary ₹${aisData.salaryIncome.toLocaleString('en-IN')}` : ''} 
            {aisData.interestIncome > 0 ? ` | Interest ₹${aisData.interestIncome.toLocaleString('en-IN')}` : ''} 
            {aisData.dividendIncome > 0 ? ` | Dividends ₹${aisData.dividendIncome.toLocaleString('en-IN')}` : ''} 
            {aisData.tdsEntries > 0 ? ` | ${aisData.tdsEntries} TDS entries` : ''} 
            {aisData.saleTransactions > 0 ? ` | ${aisData.saleTransactions} sale transactions` : ''}
          </AlertDescription>
        </Alert>
      )}

      <Card className="bg-blue-50/50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4 space-y-3">
          <p className="text-xs font-medium text-blue-700 dark:text-blue-300">Employer Details (as per Form 16 Part A)</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="employerName" className="text-xs">Employer Name</Label>
              <Input
                id="employerName"
                value={employerDetails.employerName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>): void => setEmployerDetails((prev: EmployerDetails) => ({ ...prev, employerName: e.target.value }))}
                placeholder="e.g. Tata Consultancy Services Ltd"
                data-testid="input-employer-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="employerTAN" className="text-xs">
                Employer TAN <FieldHint text="Tax Deduction Account Number of employer. 10-character alphanumeric. Found on Form 16 Part A." />
              </Label>
              <Input
                id="employerTAN"
                value={employerDetails.employerTAN}
                onChange={(e: React.ChangeEvent<HTMLInputElement>): void => setEmployerDetails((prev: EmployerDetails) => ({ ...prev, employerTAN: e.target.value.toUpperCase() }))}
                placeholder="e.g. MUMS12345E"
                className="font-mono tracking-wider uppercase"
                maxLength={10}
                data-testid="input-employer-tan"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <Label htmlFor="grossSalary">
            Gross Salary (Annual) <span className="text-red-500">*</span>
            <FieldHint text="Total salary before any deductions. Find in Part B of Form 16, row '1 - Gross Salary'." />
          </Label>
          <CurrencyInput
            id="grossSalary"
            value={salaryDetails.grossSalary}
            onChange={(v: number) => setSalaryDetails((prev: SalaryDetails) => ({ ...prev, grossSalary: v }))}
            placeholder="e.g. 12,00,000"
            data-testid="input-gross-salary"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="allowances">
            Exempt Allowances (HRA, LTA)
            <FieldHint text="Exempt portions of HRA, LTA, and other allowances. Available in Form 16 Part B." />
          </Label>
          <CurrencyInput
            id="allowances"
            value={salaryDetails.allowances}
            onChange={(v: number) => setSalaryDetails((prev: SalaryDetails) => ({ ...prev, allowances: v }))}
            placeholder="0 if none"
            data-testid="input-allowances"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="professionalTax">
            Professional Tax Paid
            <FieldHint text="Also called 'tax on employment'. Maximum ₹2,500/year in most states. Check your salary slip." />
          </Label>
          <CurrencyInput
            id="professionalTax"
            value={salaryDetails.professionalTax}
            onChange={(v: number) => setSalaryDetails((prev: SalaryDetails) => ({ ...prev, professionalTax: v }))}
            placeholder="Usually ₹2,400 or ₹2,500"
            max={2500}
            data-testid="input-professional-tax"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="employerPF">
            Employer's PF Contribution
            <FieldHint text="Your employer's contribution to EPF. This is 12% of basic salary. Check salary slip or Form 16." />
          </Label>
          <CurrencyInput
            id="employerPF"
            value={salaryDetails.employerPF}
            onChange={(v: number) => setSalaryDetails((prev: SalaryDetails) => ({ ...prev, employerPF: v }))}
            placeholder="12% of basic salary"
            data-testid="input-employer-pf"
          />
        </div>
      </div>

      <Card className="bg-muted/50">
        <CardContent className="p-4 space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Standard Deduction (Auto-applied for AY 2025-26)</span>
            <span className="font-medium">{formatCurrency(salaryDetails.standardDeduction)}</span>
          </div>
          <Separator />
          <div className="flex justify-between items-center">
            <span className="font-medium">Net Taxable Salary</span>
            <span className="font-bold text-lg">{formatCurrency(Math.max(0, salaryIncomeTotal))}</span>
          </div>
        </CardContent>
      </Card>

      <ValidationBanner validation={currentValidation} />
    </div>
  );
};
