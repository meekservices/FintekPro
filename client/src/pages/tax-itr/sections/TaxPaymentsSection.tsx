import React from "react";
import { FileText, Clock, Calculator, HelpCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  FieldHint, CurrencyInput, ValidationBanner, formatCurrency 
} from "@/components/tax-itr/TaxITRHelpers";
import { useTax } from "../TaxContext";
import { TaxPaymentDetails, Interest234Details, AdvanceTaxInstallment } from "../types";

export const TaxPaymentsSection: React.FC = () => {
  const {
    taxPaymentDetails,
    setTaxPaymentDetails,
    interest234,
    setInterest234,
    panContext,
    form26ASLoading,
    handleFetch26AS,
    compute234Interest,
    totals,
    assessmentYear,
    validateStep,
    currentStepId
  } = useTax();

  const currentValidation = validateStep(currentStepId);
  const totalTaxPaid = totals.totalTaxPaid;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Enter taxes already paid or deducted. These reduce your final tax liability. Verify from your Form 26AS on the Income Tax e-filing portal.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleFetch26AS}
          disabled={form26ASLoading || !panContext?.pan}
          data-testid="btn-fetch-26as"
        >
          {form26ASLoading ? <><Clock className="h-4 w-4 mr-2 animate-spin" /> Fetching 26AS...</> : <><FileText className="h-4 w-4 mr-2" /> Auto-fill from 26AS</>}
        </Button>
      </div>

      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">TDS Breakdown (Schedule TDS)</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <Label htmlFor="tdsSalary">
            TDS on Salary (Part A) <FieldHint text="Tax deducted by your employer from salary. Check Form 16 Part A or 26AS Part A, section 192." />
          </Label>
          <CurrencyInput
            id="tdsSalary"
            value={taxPaymentDetails.tdsSalary}
            onChange={(v: number) => {
              setTaxPaymentDetails((prev: TaxPaymentDetails) => {
                const updated = { ...prev, tdsSalary: v };
                updated.tdsDeducted = updated.tdsSalary + updated.tdsOtherThanSalary + updated.tdsOnProperty;
                return updated;
              });
            }}
            placeholder="TDS from employer"
            data-testid="input-tds-salary"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tdsOtherThanSalary">
            TDS Other Than Salary (Part A1) <FieldHint text="TDS by banks on FD interest (194A), TDS on rent receipts (194I), commission (194H), etc. Check 26AS Part A." />
          </Label>
          <CurrencyInput
            id="tdsOtherThanSalary"
            value={taxPaymentDetails.tdsOtherThanSalary}
            onChange={(v: number) => {
              setTaxPaymentDetails((prev: TaxPaymentDetails) => {
                const updated = { ...prev, tdsOtherThanSalary: v };
                updated.tdsDeducted = updated.tdsSalary + updated.tdsOtherThanSalary + updated.tdsOnProperty;
                return updated;
              });
            }}
            placeholder="Bank TDS, rent TDS, etc."
            data-testid="input-tds-other"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tdsOnProperty">
            TDS on Sale of Property (26QB) <FieldHint text="TDS deducted by buyer on purchase of property ≥₹50 lakh. Rate: 1% of sale consideration. Check Form 26QB." />
          </Label>
          <CurrencyInput
            id="tdsOnProperty"
            value={taxPaymentDetails.tdsOnProperty}
            onChange={(v: number) => {
              setTaxPaymentDetails((prev: TaxPaymentDetails) => {
                const updated = { ...prev, tdsOnProperty: v };
                updated.tdsDeducted = updated.tdsSalary + updated.tdsOtherThanSalary + updated.tdsOnProperty;
                return updated;
              });
            }}
            placeholder="Property sale TDS (26QB)"
            data-testid="input-tds-property"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tcsCollected">
            TCS Collected (Part A2) <FieldHint text="Tax Collected at Source — on foreign remittances (LRS), car purchases above ₹10L, etc. Check 26AS Part A2." />
          </Label>
          <CurrencyInput
            id="tcsCollected"
            value={taxPaymentDetails.tcsCollected}
            onChange={(v: number) => setTaxPaymentDetails((prev: TaxPaymentDetails) => ({ ...prev, tcsCollected: v }))}
            placeholder="Foreign remittance TCS, etc."
            data-testid="input-tcs-collected"
          />
        </div>
      </div>

      <Card className="bg-muted/50">
        <CardContent className="p-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Total TDS + TCS</span>
            <span className="font-medium">{formatCurrency(taxPaymentDetails.tdsDeducted + taxPaymentDetails.tcsCollected)}</span>
          </div>
        </CardContent>
      </Card>

      <Separator />
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Advance Tax & Self-Assessment</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <Label htmlFor="tdsDeducted">
            Total TDS (Auto-calculated) <FieldHint text="Sum of TDS on salary + TDS other than salary + TDS on property. Auto-calculated from breakdown above." />
          </Label>
          <CurrencyInput
            id="tdsDeducted"
            value={taxPaymentDetails.tdsDeducted}
            disabled
            onChange={(v: number) => setTaxPaymentDetails((prev: TaxPaymentDetails) => ({ ...prev, tdsDeducted: v }))}
            placeholder="From Form 26AS / AIS"
            data-testid="input-tds-deducted"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="advanceTaxPaid">
            Advance Tax Paid <FieldHint text="Quarterly advance tax paid via challans (15 Jun, 15 Sep, 15 Dec, 15 Mar). Check Form 26AS Part C." />
          </Label>
          <CurrencyInput
            id="advanceTaxPaid"
            value={taxPaymentDetails.advanceTaxPaid}
            onChange={(v: number) => setTaxPaymentDetails((prev: TaxPaymentDetails) => ({ ...prev, advanceTaxPaid: v }))}
            placeholder="Advance tax challans"
            data-testid="input-advance-tax"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="selfAssessmentTax">
            Self Assessment Tax Paid <FieldHint text="Tax paid after computing total liability, typically before filing ITR. Challan 280, code 300." />
          </Label>
          <CurrencyInput
            id="selfAssessmentTax"
            value={taxPaymentDetails.selfAssessmentTax}
            onChange={(v: number) => setTaxPaymentDetails((prev: TaxPaymentDetails) => ({ ...prev, selfAssessmentTax: v }))}
            placeholder="Paid before filing"
            data-testid="input-self-assessment-tax"
          />
        </div>
      </div>

      <Separator />
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Relief & Adjustments</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <Label htmlFor="reliefUs89">
            Relief u/s 89 (Arrear Salary) <FieldHint text="Relief for salary received in arrears or in advance. Calculate using Form 10E on the e-filing portal before claiming." />
          </Label>
          <CurrencyInput
            id="reliefUs89"
            value={taxPaymentDetails.reliefUs89}
            onChange={(v: number) => setTaxPaymentDetails((prev: TaxPaymentDetails) => ({ ...prev, reliefUs89: v }))}
            placeholder="File Form 10E first"
            data-testid="input-relief-89"
          />
        </div>
      </div>

      <Card className="bg-muted/50">
        <CardContent className="p-4 space-y-1">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">TDS + TCS</span>
            <span>{formatCurrency(taxPaymentDetails.tdsDeducted + taxPaymentDetails.tcsCollected)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Advance Tax + Self-Assessment</span>
            <span>{formatCurrency(taxPaymentDetails.advanceTaxPaid + taxPaymentDetails.selfAssessmentTax)}</span>
          </div>
          {taxPaymentDetails.reliefUs89 > 0 && (
            <div className="flex justify-between items-center text-sm text-green-600">
              <span>Relief u/s 89</span>
              <span>{formatCurrency(taxPaymentDetails.reliefUs89)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between items-center">
            <span className="font-medium">Total Tax Credits</span>
            <span className="font-bold text-lg text-green-600">{formatCurrency(totalTaxPaid)}</span>
          </div>
        </CardContent>
      </Card>

      <Separator />
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Interest u/s 234A / 234B / 234C (Auto-calculated)</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
         <div className="space-y-1.5">
          <Label className="text-xs">Filing Due Date <FieldHint text="Standard due date is 31st July. Extended to 31st Oct for audit cases. Belated filing allowed until 31st Dec of AY." /></Label>
          <Input type="date" value={interest234.filingDueDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInterest234((p: Interest234Details) => ({ ...p, filingDueDate: e.target.value }))} data-testid="input-filing-due-date" />
        </div>
         <div className="space-y-1.5">
          <Label className="text-xs">Actual / Expected Filing Date <FieldHint text="Date when you file (or plan to file) the ITR. Used to compute months of delay for 234A interest." /></Label>
          <Input type="date" value={interest234.filingDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInterest234((p: Interest234Details) => ({ ...p, filingDate: e.target.value }))} data-testid="input-filing-date" />
        </div>
      </div>

      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Advance Tax Installments (for 234C calculation)</CardTitle>
          <CardDescription className="text-xs">Enter quarter-wise advance tax paid. Required if tax liability exceeds ₹10,000.</CardDescription>
        </CardHeader>
        <CardContent>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {interest234.advanceTaxDetails.map((inst: AdvanceTaxInstallment, idx: number) => (
              <div key={idx} className="border rounded p-2 space-y-1">
                <p className="text-xs font-medium">{inst.quarter} — Due: {inst.dueDate}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px]">Amount Paid (₹)</Label>
                    <Input type="number" className="h-8 text-xs" value={inst.amountPaid || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const u = [...interest234.advanceTaxDetails]; u[idx] = { ...u[idx], amountPaid: Number(e.target.value) };
                      setInterest234((p: Interest234Details) => ({ ...p, advanceTaxDetails: u }));
                    }} />
                  </div>
                  <div>
                    <Label className="text-[10px]">Date Paid</Label>
                    <Input type="date" className="h-8 text-xs" value={inst.paidDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const u = [...interest234.advanceTaxDetails]; u[idx] = { ...u[idx], paidDate: e.target.value };
                      setInterest234((p: Interest234Details) => ({ ...p, advanceTaxDetails: u }));
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button variant="outline" size="sm" onClick={compute234Interest} className="w-full" data-testid="btn-compute-234-interest">
        <Calculator className="h-4 w-4 mr-2" /> Compute Interest u/s 234A / 234B / 234C
      </Button>

      {interest234.totalInterest > 0 && (
        <Card className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
          <CardContent className="p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">234A — Late Filing Interest</span>
              <span className="text-red-600 font-medium">{formatCurrency(interest234.interest234A)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">234B — Default in Advance Tax</span>
              <span className="text-red-600 font-medium">{formatCurrency(interest234.interest234B)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">234C — Deferment of Advance Tax</span>
              <span className="text-red-600 font-medium">{formatCurrency(interest234.interest234C)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Total Interest Payable</span>
              <span className="text-red-600">{formatCurrency(interest234.totalInterest)}</span>
            </div>
            <p className="text-xs text-muted-foreground">This interest is added to your tax liability. Pay along with self-assessment tax before filing.</p>
          </CardContent>
        </Card>
      )}

      <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <HelpCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>Where to find these?</strong> Log in to <span className="font-mono text-xs">incometax.gov.in</span> → My Account → View Form 26AS or Annual Information Statement (AIS).
        </AlertDescription>
      </Alert>

      <ValidationBanner validation={currentValidation} />
    </div>
  );
};
