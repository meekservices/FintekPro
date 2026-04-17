import React from "react";
import { Plus, Trash2, CheckCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  FieldHint, CurrencyInput, ValidationBanner, formatCurrency 
} from "@/components/tax-itr/TaxITRHelpers";
import { useTax } from "../TaxContext";
import { DeductionDetails, DonationEntry } from "../types";

export const DeductionsSection: React.FC = (): React.ReactElement => {
  const {
    taxRegime,
    deductionDetails,
    setDeductionDetails,
    donationEntries,
    setDonationEntries,
    totals,
    validateStep,
    currentStepId
  } = useTax();

  const isNewRegime = taxRegime === "new";
  const currentValidation = validateStep(currentStepId);
  const totalDeductions = totals.totalDeductions;
  
  return (
    <div className="space-y-6">
      {isNewRegime && (
        <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>New Tax Regime selected.</strong> Most Chapter VI-A deductions (80C, 80D, 80G, etc.) are <strong>not available</strong>. Only standard deduction of ₹75,000 and employer NPS (80CCD2) apply. 
            Switch to Old Regime in Basic Info to claim these deductions.
          </AlertDescription>
        </Alert>
      )}

      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Section 80C / 80CCC / 80CCD — Combined Limit ₹1.5 Lakh</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <Label htmlFor="section80C" className={isNewRegime ? "text-muted-foreground" : ""}>
            80C — Investments (Max ₹1.5L combined)
            <FieldHint text="PPF, ELSS, life insurance, PF, tuition fees, home loan principal, NSC, tax-saving FD, Sukanya Samriddhi. Combined limit with 80CCC and 80CCD(1)." />
          </Label>
          <CurrencyInput id="section80C" value={deductionDetails.section80C} onChange={(v: number): void => setDeductionDetails((prev: DeductionDetails) => ({ ...prev, section80C: v }))} placeholder="PPF, ELSS, LIC, PF" max={150000} disabled={isNewRegime} data-testid="input-section-80c" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="section80CCC" className={isNewRegime ? "text-muted-foreground" : ""}>
            80CCC — Pension Fund (within ₹1.5L)
            <FieldHint text="Contribution to annuity plan of LIC or other insurer. Falls within the overall ₹1.5L limit of 80C+80CCC+80CCD(1)." />
          </Label>
          <CurrencyInput id="section80CCC" value={deductionDetails.section80CCC} onChange={(v: number): void => setDeductionDetails((prev: DeductionDetails) => ({ ...prev, section80CCC: v }))} placeholder="Pension fund contributions" max={150000} disabled={isNewRegime} data-testid="input-section-80ccc" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="section80CCD1" className={isNewRegime ? "text-muted-foreground" : ""}>
            80CCD(1) — NPS Employee (within ₹1.5L)
            <FieldHint text="Your own contribution to NPS (National Pension System). Limited to 10% of salary (14% for govt). Within overall ₹1.5L cap." />
          </Label>
          <CurrencyInput id="section80CCD1" value={deductionDetails.section80CCD1} onChange={(v: number): void => setDeductionDetails((prev: DeductionDetails) => ({ ...prev, section80CCD1: v }))} placeholder="NPS self-contribution" max={150000} disabled={isNewRegime} data-testid="input-section-80ccd1" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="section80CCD1B" className={isNewRegime ? "text-muted-foreground" : ""}>
            80CCD(1B) — NPS Additional (Extra ₹50K)
            <FieldHint text="Additional deduction of ₹50,000 for NPS. This is OVER AND ABOVE the ₹1.5L limit — a powerful tax saver." />
          </Label>
          <CurrencyInput id="section80CCD1B" value={deductionDetails.section80CCD1B} onChange={(v: number): void => setDeductionDetails((prev: DeductionDetails) => ({ ...prev, section80CCD1B: v }))} placeholder="Additional NPS ₹50K" max={50000} disabled={isNewRegime} data-testid="input-section-80ccd1b" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="section80CCD2">
            80CCD(2) — Employer NPS Contribution
            <FieldHint text="Employer's NPS contribution — up to 10% of salary (14% for central govt). Available in BOTH old and new regimes. Check salary slip." />
          </Label>
          <CurrencyInput id="section80CCD2" value={deductionDetails.section80CCD2} onChange={(v: number): void => setDeductionDetails((prev: DeductionDetails) => ({ ...prev, section80CCD2: v }))} placeholder="Employer NPS (check payslip)" data-testid="input-section-80ccd2" />
          <p className="text-xs text-green-600">Available in both Old and New regime</p>
        </div>
      </div>

      <Separator />
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Health, Disability & Education</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <Label htmlFor="section80D" className={isNewRegime ? "text-muted-foreground" : ""}>
            80D — Health Insurance (Max ₹1L)
            <FieldHint text="Self + family: ₹25K (₹50K if senior). Parents: additional ₹25K (₹50K if senior). Max total: ₹1,00,000." />
          </Label>
          <CurrencyInput id="section80D" value={deductionDetails.section80D} onChange={(v: number): void => setDeductionDetails((prev: DeductionDetails) => ({ ...prev, section80D: v }))} placeholder="Self + family + parents" max={100000} disabled={isNewRegime} data-testid="input-section-80d" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="section80DD" className={isNewRegime ? "text-muted-foreground" : ""}>
            80DD — Disabled Dependent (₹75K/₹1.25L)
            <FieldHint text="Maintenance/medical treatment of disabled dependent. ₹75,000 for 40-80% disability, ₹1,25,000 for severe (>80%)." />
          </Label>
          <CurrencyInput id="section80DD" value={deductionDetails.section80DD} onChange={(v: number): void => setDeductionDetails((prev: DeductionDetails) => ({ ...prev, section80DD: v }))} placeholder="₹75K or ₹1.25L" max={125000} disabled={isNewRegime} data-testid="input-section-80dd" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="section80DDB" className={isNewRegime ? "text-muted-foreground" : ""}>
            80DDB — Medical Treatment (Max ₹40K/₹1L)
            <FieldHint text="Treatment of specified diseases (cancer, AIDS, etc.). ₹40,000 for below 60; ₹1,00,000 for senior citizens. Need Form 10-I." />
          </Label>
          <CurrencyInput id="section80DDB" value={deductionDetails.section80DDB} onChange={(v: number): void => setDeductionDetails((prev: DeductionDetails) => ({ ...prev, section80DDB: v }))} placeholder="Specified disease treatment" max={100000} disabled={isNewRegime} data-testid="input-section-80ddb" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="section80U" className={isNewRegime ? "text-muted-foreground" : ""}>
            80U — Self Disability (₹75K/₹1.25L)
            <FieldHint text="For persons with disability (self). ₹75,000 for 40-80% disability, ₹1,25,000 for severe disability (>80%). Need medical certificate." />
          </Label>
          <CurrencyInput id="section80U" value={deductionDetails.section80U} onChange={(v: number): void => setDeductionDetails((prev: DeductionDetails) => ({ ...prev, section80U: v }))} placeholder="₹75K or ₹1.25L" max={125000} disabled={isNewRegime} data-testid="input-section-80u" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="section80E" className={isNewRegime ? "text-muted-foreground" : ""}>
            80E — Education Loan Interest
            <FieldHint text="Interest on education loan for higher studies. No upper limit. Available for 8 years from start of repayment." />
          </Label>
          <CurrencyInput id="section80E" value={deductionDetails.section80E} onChange={(v: number): void => setDeductionDetails((prev: DeductionDetails) => ({ ...prev, section80E: v }))} placeholder="No upper limit" disabled={isNewRegime} data-testid="input-section-80e" />
        </div>
      </div>

      <Separator />
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Housing, Donations & Savings Interest</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <Label htmlFor="section80EEA" className={isNewRegime ? "text-muted-foreground" : ""}>
            80EEA — Affordable Housing Interest (₹1.5L)
            <FieldHint text="Additional interest deduction up to ₹1.5L for affordable housing (stamp duty ≤₹45L). Loan sanctioned between 1 Apr 2019 – 31 Mar 2022." />
          </Label>
          <CurrencyInput id="section80EEA" value={deductionDetails.section80EEA} onChange={(v: number): void => setDeductionDetails((prev: DeductionDetails) => ({ ...prev, section80EEA: v }))} placeholder="Affordable housing loan" max={150000} disabled={isNewRegime} data-testid="input-section-80eea" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="section80EEB" className={isNewRegime ? "text-muted-foreground" : ""}>
            80EEB — EV Loan Interest (₹1.5L)
            <FieldHint text="Interest on loan for electric vehicle purchase. Max ₹1,50,000. Loan sanctioned between 1 Apr 2019 – 31 Mar 2023." />
          </Label>
          <CurrencyInput id="section80EEB" value={deductionDetails.section80EEB} onChange={(v: number): void => setDeductionDetails((prev: DeductionDetails) => ({ ...prev, section80EEB: v }))} placeholder="Electric vehicle loan" max={150000} disabled={isNewRegime} data-testid="input-section-80eeb" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="section80GG" className={isNewRegime ? "text-muted-foreground" : ""}>
            80GG — Rent Paid (No HRA) (Max ₹5K/m)
            <FieldHint text="For those NOT receiving HRA from employer. Least of: rent paid - 10% of total income, ₹5,000/month, or 25% of total income. File Form 10BA." />
          </Label>
          <CurrencyInput id="section80GG" value={deductionDetails.section80GG} onChange={(v: number): void => setDeductionDetails((prev: DeductionDetails) => ({ ...prev, section80GG: v }))} placeholder="Rent if no HRA" max={60000} disabled={isNewRegime} data-testid="input-section-80gg" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="section80G" className={isNewRegime ? "text-muted-foreground" : ""}>
            80G — Charitable Donations (Total)
            <FieldHint text="Donations to specified funds/charities. 100% or 50% deduction depending on the organization. Auto-calculated from entries below, or override manually." />
          </Label>
          <CurrencyInput id="section80G" value={deductionDetails.section80G} onChange={(v: number): void => setDeductionDetails((prev: DeductionDetails) => ({ ...prev, section80G: v }))} placeholder="Charitable donations" disabled={isNewRegime} data-testid="input-section-80g" />
        </div>

        {!isNewRegime && (
          <div className="col-span-full space-y-3 border rounded-lg p-4 bg-muted/30">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Schedule 80G — Donation Details</Label>
              <Button variant="outline" size="sm" onClick={(): void => setDonationEntries((prev: DonationEntry[]) => [...prev, {
                doneeName: "", doneePAN: "", doneeAddress: "", donationAmount: 0,
                qualifyingPercentage: 100, qualifyingLimit: "without_limit", donationDate: "",
                donationType: "cash", section80GCertificateNo: "", eligibleAmount: 0,
              }])} data-testid="btn-add-donation">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Donation
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Add each donation separately for ITR Schedule 80G. The total eligible deduction is auto-calculated and applied to the 80G field above.</p>

            {donationEntries.map((d, idx) => (
              <Card key={idx} className="border-dashed">
                <CardContent className="p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Donation #{idx + 1}</span>
                    <Button variant="ghost" size="sm" onClick={(): void => setDonationEntries((prev: DonationEntry[]) => prev.filter((_: DonationEntry, i: number): boolean => i !== idx))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Donee Name <span className="text-red-500">*</span></Label>
                      <Input value={d.doneeName} onChange={(e: React.ChangeEvent<HTMLInputElement>): void => { const n = [...donationEntries]; n[idx] = { ...n[idx], doneeName: e.target.value }; setDonationEntries(n); }} placeholder="e.g. PM National Relief Fund" data-testid={`donation-name-${idx}`} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Donee PAN</Label>
                      <Input value={d.doneePAN} onChange={(e: React.ChangeEvent<HTMLInputElement>): void => { const n = [...donationEntries]; n[idx] = { ...n[idx], doneePAN: e.target.value.toUpperCase() }; setDonationEntries(n); }} placeholder="AAAPN0000A" maxLength={10} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Donation Amount <span className="text-red-500">*</span></Label>
                      <CurrencyInput id={`donation-amt-${idx}`} value={d.donationAmount} onChange={(v: number): void => { const n = [...donationEntries]; const pct = n[idx].qualifyingPercentage; n[idx] = { ...n[idx], donationAmount: v, eligibleAmount: v * pct / 100 }; setDonationEntries(n); }} data-testid={`donation-amount-${idx}`} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Donation Date</Label>
                      <Input type="date" value={d.donationDate} onChange={(e: React.ChangeEvent<HTMLInputElement>): void => { const n = [...donationEntries]; n[idx] = { ...n[idx], donationDate: e.target.value }; setDonationEntries(n); }} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Qualifying %</Label>
                      <Select value={String(d.qualifyingPercentage)} onValueChange={(v: string): void => { const n = [...donationEntries]; const pct = parseInt(v) as 100 | 50; n[idx] = { ...n[idx], qualifyingPercentage: pct, eligibleAmount: n[idx].donationAmount * pct / 100 }; setDonationEntries(n); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="100">100% Deduction</SelectItem>
                          <SelectItem value="50">50% Deduction</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Limit Type</Label>
                      <Select value={d.qualifyingLimit} onValueChange={(v: "with_limit" | "without_limit"): void => { const n = [...donationEntries]; n[idx] = { ...n[idx], qualifyingLimit: v }; setDonationEntries(n); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="with_limit">With Limit (10% of Adjusted GTI)</SelectItem>
                          <SelectItem value="without_limit">Without Limit (e.g. PM Relief Fund)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Mode of Payment</Label>
                      <Select value={d.donationType} onValueChange={(v: "cash" | "kind" | "other"): void => { const n = [...donationEntries]; n[idx] = { ...n[idx], donationType: v }; setDonationEntries(n); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash / Cheque / UPI</SelectItem>
                          <SelectItem value="kind">In Kind</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">80G Certificate No.</Label>
                      <Input value={d.section80GCertificateNo} onChange={(e: React.ChangeEvent<HTMLInputElement>): void => { const n = [...donationEntries]; n[idx] = { ...n[idx], section80GCertificateNo: e.target.value }; setDonationEntries(n); }} placeholder="Certificate reference" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs bg-green-50 dark:bg-green-950/30 p-2 rounded">
                    <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                    <span>Eligible Deduction: <strong>{formatCurrency(d.eligibleAmount)}</strong> ({d.qualifyingPercentage}% of {formatCurrency(d.donationAmount)})</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {donationEntries.length > 0 && (
              <div className="flex justify-between items-center p-2 bg-green-100 dark:bg-green-950 rounded text-sm font-medium">
                <span>Total 80G Eligible Deduction</span>
                <span className="text-green-700 dark:text-green-400">{formatCurrency(donationEntries.reduce((sum: number, d: DonationEntry) => sum + d.eligibleAmount, 0))}</span>
              </div>
            )}
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="section80TTA" className={isNewRegime ? "text-muted-foreground" : ""}>
            80TTA — Savings Interest (Max ₹10K)
            <FieldHint text="Deduction on interest from savings account. Max ₹10,000. FD/RD interest NOT eligible. Cannot claim both 80TTA and 80TTB." />
          </Label>
          <CurrencyInput id="section80TTA" value={deductionDetails.section80TTA} onChange={(v: number): void => setDeductionDetails((prev: DeductionDetails) => ({ ...prev, section80TTA: v }))} placeholder="Savings account interest" max={10000} disabled={isNewRegime} data-testid="input-section-80tta" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="section80TTB" className={isNewRegime ? "text-muted-foreground" : ""}>
            80TTB — Senior Citizen Interest (Max ₹50K)
            <FieldHint text="For senior citizens (60+). Deduction on interest from savings, FD, RD — up to ₹50,000. Cannot claim both 80TTA and 80TTB." />
          </Label>
          <CurrencyInput id="section80TTB" value={deductionDetails.section80TTB} onChange={(v: number): void => setDeductionDetails((prev: DeductionDetails) => ({ ...prev, section80TTB: v }))} placeholder="Senior citizen interest" max={50000} disabled={isNewRegime} data-testid="input-section-80ttb" />
        </div>
      </div>

      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <span className="font-medium">Total Deductions (Chapter VI-A)</span>
            <span className="font-bold text-lg text-green-600">
              {isNewRegime ? formatCurrency(deductionDetails.section80CCD2) + " (New Regime — only 80CCD2)" : formatCurrency(totalDeductions)}
            </span>
          </div>
        </CardContent>
      </Card>

      <ValidationBanner validation={currentValidation} />
    </div>
  );
};
