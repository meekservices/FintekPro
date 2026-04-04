import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  CheckCircle2, Circle, AlertTriangle, User, DollarSign, Shield, FileText,
  ClipboardCheck, ChevronRight, ChevronLeft, RefreshCw, Globe, Landmark,
  ExternalLink, Lock, Info, XCircle,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Prefill {
  firstName: string; middleName: string; lastName: string;
  email: string; phone: string; dateOfBirth: string;
  address: string; city: string; state: string; postalCode: string;
  country: string; panNumber: string; taxIdType: string;
  kycStatus: string; panVerified: boolean;
  pepStatus: string; occupation: string; annualIncome: string; sourceOfWealth: string;
}

interface PrefillResponse {
  success: boolean;
  prefill: Prefill;
  brokerAccount: any;
  compliance: { eligible: boolean; blockers: string[]; checks: Record<string, boolean>; lrsRemainingUsd?: number };
}

interface FormState {
  // Identity
  firstName: string; middleName: string; lastName: string;
  dateOfBirth: string; taxId: string; taxIdType: string;
  countryOfCitizenship: string; countryOfBirth: string; countryOfTaxResidence: string;
  // Contact
  email: string; phone: string; streetAddress: string;
  city: string; state: string; postalCode: string; country: string;
  // Financial
  fundingSource: string; annualIncomeMin: string; annualIncomeMax: string;
  liquidNetWorthMin: string; liquidNetWorthMax: string;
  totalNetWorthMin: string; totalNetWorthMax: string;
  // Disclosures
  isControlPerson: boolean; isAffiliatedExchangeOrFinra: boolean;
  isPoliticallyExposed: boolean; immediateFamilyExposed: boolean;
  // Agreements
  agreedCustomer: boolean; agreedMargin: boolean; agreedAccount: boolean;
}

const STEPS = [
  { id: "identity", label: "Identity", icon: User },
  { id: "financial", label: "Financial Profile", icon: DollarSign },
  { id: "disclosures", label: "Disclosures", icon: Shield },
  { id: "agreements", label: "Agreements", icon: FileText },
  { id: "review", label: "Review & Submit", icon: ClipboardCheck },
];

const INCOME_OPTIONS = [
  { min: "0", max: "25000", label: "Under $25,000" },
  { min: "25000", max: "50000", label: "$25,000 – $50,000" },
  { min: "50000", max: "100000", label: "$50,000 – $100,000" },
  { min: "100000", max: "200000", label: "$100,000 – $200,000" },
  { min: "200000", max: "300000", label: "$200,000 – $300,000" },
  { min: "300000", max: "500000", label: "$300,000 – $500,000" },
  { min: "500000", max: "1200000", label: "$500,000 – $1.2M" },
  { min: "1200000", max: "9999999", label: "Over $1.2M" },
];

const NW_OPTIONS = [
  { min: "0", max: "25000", label: "Under $25,000" },
  { min: "25000", max: "50000", label: "$25,000 – $50,000" },
  { min: "50000", max: "100000", label: "$50,000 – $100,000" },
  { min: "100000", max: "200000", label: "$100,000 – $200,000" },
  { min: "200000", max: "500000", label: "$200,000 – $500,000" },
  { min: "500000", max: "1000000", label: "$500,000 – $1M" },
  { min: "1000000", max: "5000000", label: "$1M – $5M" },
  { min: "5000000", max: "9999999", label: "Over $5M" },
];

const TAX_ID_TYPES = [
  { value: "NOT_SPECIFIED", label: "Not Specified" },
  { value: "USA_SSN", label: "US SSN" },
  { value: "ARG_AR_CUIT", label: "Argentina CUIT" },
  { value: "AUS_TFN", label: "Australia TFN" },
  { value: "IND_PAN", label: "India PAN" },
  { value: "IND_AADHAAR", label: "India Aadhaar" },
  { value: "GBR_UTR", label: "UK UTR" },
];

const FUNDING_SOURCES = [
  { value: "employment_income", label: "Employment Income" },
  { value: "investments", label: "Investments" },
  { value: "inheritance", label: "Inheritance" },
  { value: "business_income", label: "Business Income" },
  { value: "savings", label: "Savings" },
  { value: "family", label: "Family / Gift" },
];

// ─── Status Banner ──────────────────────────────────────────────────────────────

function StatusBanner({ status, accountNumber }: { status: string; accountNumber?: string }) {
  const config: Record<string, { color: string; icon: any; title: string; desc: string }> = {
    SUBMITTED: {
      color: "border-blue-300 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-700",
      icon: RefreshCw, title: "Application Submitted",
      desc: "Alpaca is reviewing your account. This usually takes 1-2 business days.",
    },
    APPROVAL_PENDING: {
      color: "border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700",
      icon: AlertTriangle, title: "Approval Pending",
      desc: "Your application needs additional review. We will notify you when it is approved.",
    },
    ACTION_REQUIRED: {
      color: "border-orange-300 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-700",
      icon: AlertTriangle, title: "Action Required",
      desc: "Additional documents or information are needed. Please check your email.",
    },
    APPROVED: {
      color: "border-green-300 bg-green-50 dark:bg-green-950/20 dark:border-green-700",
      icon: CheckCircle2, title: "Account Approved",
      desc: "Your account has been approved and will be active shortly.",
    },
    ACTIVE: {
      color: "border-green-300 bg-green-50 dark:bg-green-950/20 dark:border-green-700",
      icon: CheckCircle2, title: "Account Active",
      desc: `Your US trading account ${accountNumber ? `(${accountNumber})` : ""} is live and ready to trade.`,
    },
    REJECTED: {
      color: "border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-700",
      icon: XCircle, title: "Application Rejected",
      desc: "Unfortunately your account application was not approved. Contact support for details.",
    },
  };

  const cfg = config[status];
  if (!cfg) return null;
  const Icon = cfg.icon;

  return (
    <Alert className={`${cfg.color} mb-5`}>
      <Icon className={`h-4 w-4 ${status === "ACTIVE" || status === "APPROVED" ? "text-green-600" : status === "REJECTED" ? "text-red-500" : status === "SUBMITTED" ? "text-blue-500" : "text-amber-500"}`} />
      <AlertDescription>
        <strong>{cfg.title}</strong> — {cfg.desc}
      </AlertDescription>
    </Alert>
  );
}

// ─── Step Indicator ─────────────────────────────────────────────────────────────

function StepIndicator({ current, completed }: { current: number; completed: Set<number> }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((step, i) => {
        const done = completed.has(i);
        const active = i === current;
        const Icon = step.icon;
        return (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors ${
                done ? "bg-green-500 border-green-500 text-white" :
                active ? "bg-primary border-primary text-primary-foreground" :
                "bg-background border-muted-foreground/30 text-muted-foreground"
              }`}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span className={`text-xs mt-1 font-medium hidden md:block ${active ? "text-primary" : done ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 ${done ? "bg-green-500" : "bg-muted"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Identity ──────────────────────────────────────────────────────────

function IdentityStep({ form, setForm, prefill }: { form: FormState; setForm: any; prefill: Prefill }) {
  const f = (field: keyof FormState, val: string) => setForm((p: FormState) => ({ ...p, [field]: val }));

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold mb-1">Identity & Contact</h3>
        <p className="text-sm text-muted-foreground">Pre-filled from your verified KYC profile. Please review and complete any missing fields.</p>
      </div>

      {prefill.panVerified && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20 py-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
          <AlertDescription className="text-xs text-green-700 dark:text-green-300">
            PAN verified · KYC {prefill.kycStatus}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>First Name *</Label>
          <Input value={form.firstName} onChange={e => f("firstName", e.target.value)} placeholder="As per PAN" />
        </div>
        <div className="space-y-1.5">
          <Label>Middle Name</Label>
          <Input value={form.middleName} onChange={e => f("middleName", e.target.value)} placeholder="Optional" />
        </div>
        <div className="space-y-1.5">
          <Label>Last Name *</Label>
          <Input value={form.lastName} onChange={e => f("lastName", e.target.value)} placeholder="As per PAN" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Email Address *</Label>
          <Input type="email" value={form.email} onChange={e => f("email", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Phone Number *</Label>
          <Input value={form.phone} onChange={e => f("phone", e.target.value)} placeholder="+91XXXXXXXXXX" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Date of Birth *</Label>
          <Input type="date" value={form.dateOfBirth} onChange={e => f("dateOfBirth", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Country of Citizenship</Label>
          <Input value={form.countryOfCitizenship} onChange={e => f("countryOfCitizenship", e.target.value)} placeholder="IND" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Tax ID Type</Label>
          <Select value={form.taxIdType} onValueChange={v => f("taxIdType", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TAX_ID_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Tax ID / PAN</Label>
          <Input value={form.taxId} onChange={e => f("taxId", e.target.value)} placeholder="Your PAN or SSN" className="font-mono" />
        </div>
      </div>

      <Separator />

      <div className="space-y-1.5">
        <Label>Street Address *</Label>
        <Input value={form.streetAddress} onChange={e => f("streetAddress", e.target.value)} placeholder="House/Flat No., Street Name" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>City *</Label>
          <Input value={form.city} onChange={e => f("city", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>State</Label>
          <Input value={form.state} onChange={e => f("state", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Postal Code</Label>
          <Input value={form.postalCode} onChange={e => f("postalCode", e.target.value)} />
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Financial Profile ─────────────────────────────────────────────────

function FinancialStep({ form, setForm }: { form: FormState; setForm: any }) {
  const f = (field: keyof FormState, val: any) => setForm((p: FormState) => ({ ...p, [field]: val }));

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold mb-1">Financial Profile</h3>
        <p className="text-sm text-muted-foreground">Required by US regulators. This information is kept strictly confidential.</p>
      </div>

      <div className="space-y-1.5">
        <Label>Primary Source of Funds *</Label>
        <Select value={form.fundingSource} onValueChange={v => f("fundingSource", v)}>
          <SelectTrigger><SelectValue placeholder="Select funding source" /></SelectTrigger>
          <SelectContent>
            {FUNDING_SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Annual Income (USD) *</Label>
        <Select
          value={`${form.annualIncomeMin}|${form.annualIncomeMax}`}
          onValueChange={v => {
            const [min, max] = v.split("|");
            f("annualIncomeMin", min);
            setForm((p: FormState) => ({ ...p, annualIncomeMax: max }));
          }}
        >
          <SelectTrigger><SelectValue placeholder="Select income range" /></SelectTrigger>
          <SelectContent>
            {INCOME_OPTIONS.map(o => (
              <SelectItem key={o.min} value={`${o.min}|${o.max}`}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Liquid Net Worth (USD) *</Label>
        <Select
          value={`${form.liquidNetWorthMin}|${form.liquidNetWorthMax}`}
          onValueChange={v => {
            const [min, max] = v.split("|");
            setForm((p: FormState) => ({ ...p, liquidNetWorthMin: min, liquidNetWorthMax: max }));
          }}
        >
          <SelectTrigger><SelectValue placeholder="Select liquid net worth range" /></SelectTrigger>
          <SelectContent>
            {NW_OPTIONS.map(o => (
              <SelectItem key={o.min} value={`${o.min}|${o.max}`}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Cash, stocks, bonds — assets easily converted to cash within 5 years</p>
      </div>

      <div className="space-y-1.5">
        <Label>Total Net Worth (USD) *</Label>
        <Select
          value={`${form.totalNetWorthMin}|${form.totalNetWorthMax}`}
          onValueChange={v => {
            const [min, max] = v.split("|");
            setForm((p: FormState) => ({ ...p, totalNetWorthMin: min, totalNetWorthMax: max }));
          }}
        >
          <SelectTrigger><SelectValue placeholder="Select total net worth range" /></SelectTrigger>
          <SelectContent>
            {NW_OPTIONS.map(o => (
              <SelectItem key={o.min} value={`${o.min}|${o.max}`}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">All assets minus all liabilities</p>
      </div>

      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 py-3">
        <Info className="h-3.5 w-3.5 text-blue-500" />
        <AlertDescription className="text-xs text-blue-700 dark:text-blue-300">
          <strong>LRS Note:</strong> Indian residents can remit up to <strong>$250,000 USD per financial year</strong> under RBI's Liberalised Remittance Scheme. Your investments via this account will be tracked against this limit.
        </AlertDescription>
      </Alert>
    </div>
  );
}

// ─── Step 3: Disclosures ────────────────────────────────────────────────────────

function DisclosuresStep({ form, setForm }: { form: FormState; setForm: any }) {
  const f = (field: keyof FormState, val: boolean) => setForm((p: FormState) => ({ ...p, [field]: val }));

  const disclosures = [
    {
      field: "isControlPerson" as const,
      title: "Control Person / 10%+ Shareholder",
      description: "Are you a director, officer, or 10%+ shareholder of any publicly traded company?",
    },
    {
      field: "isAffiliatedExchangeOrFinra" as const,
      title: "Exchange / FINRA / SEBI Affiliation",
      description: "Are you or an immediate family member employed by, or associated with, a stock exchange, FINRA, or SEBI?",
    },
    {
      field: "isPoliticallyExposed" as const,
      title: "Politically Exposed Person (PEP)",
      description: "Are you a current or former senior political official, government leader, or head of state?",
    },
    {
      field: "immediateFamilyExposed" as const,
      title: "Immediate Family Member is PEP",
      description: "Is an immediate family member (spouse, parent, child, sibling) a politically exposed person?",
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold mb-1">Regulatory Disclosures</h3>
        <p className="text-sm text-muted-foreground">US FINRA and SEC regulations require us to ask these questions. Answer honestly — most clients answer No to all.</p>
      </div>

      <div className="space-y-4">
        {disclosures.map(d => (
          <Card key={d.field} className={`border ${form[d.field] ? "border-amber-300 bg-amber-50 dark:bg-amber-950/10" : ""}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="font-medium text-sm">{d.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{d.description}</p>
                </div>
                <div className="flex gap-4 mt-0.5">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name={d.field}
                      checked={form[d.field] === true}
                      onChange={() => f(d.field, true)}
                      className="accent-primary"
                    />
                    <span className="text-sm">Yes</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name={d.field}
                      checked={form[d.field] === false}
                      onChange={() => f(d.field, false)}
                      className="accent-primary"
                    />
                    <span className="text-sm">No</span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(form.isControlPerson || form.isAffiliatedExchangeOrFinra || form.isPoliticallyExposed || form.immediateFamilyExposed) && (
        <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
            You have indicated one or more disclosures. Your account application may require additional review. Alpaca will contact you if further documentation is needed.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// ─── Step 4: Agreements ─────────────────────────────────────────────────────────

function AgreementsStep({ form, setForm }: { form: FormState; setForm: any }) {
  const f = (field: keyof FormState, val: boolean) => setForm((p: FormState) => ({ ...p, [field]: val }));

  const agreements = [
    {
      field: "agreedCustomer" as const,
      key: "customer_agreement",
      title: "Alpaca Customer Agreement",
      description: "The Alpaca Customer Agreement governs your brokerage account relationship with Alpaca Securities LLC, including account opening, trading, and settlement terms.",
      url: "https://files.alpaca.markets/disclosures/library/AcctAppMarginAndCustAgmt.pdf",
    },
    {
      field: "agreedMargin" as const,
      key: "margin_agreement",
      title: "Margin Agreement",
      description: "The Margin Agreement authorizes Alpaca to extend credit for securities purchases and governs your obligations with respect to margin balances.",
      url: "https://files.alpaca.markets/disclosures/library/AcctAppMarginAndCustAgmt.pdf",
    },
    {
      field: "agreedAccount" as const,
      key: "account_agreement",
      title: "Account Agreement",
      description: "The Account Agreement covers account configuration, trading permissions, data sharing, and your rights as an account holder.",
      url: "https://files.alpaca.markets/disclosures/library/AcctAppMarginAndCustAgmt.pdf",
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold mb-1">Customer Agreements</h3>
        <p className="text-sm text-muted-foreground">Please read and agree to the following agreements required to open your Alpaca brokerage account.</p>
      </div>

      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 py-3">
        <Lock className="h-3.5 w-3.5 text-blue-500" />
        <AlertDescription className="text-xs text-blue-700 dark:text-blue-300">
          Your electronic signature will be recorded with a timestamp and your IP address as required by ESIGN Act and US regulations.
        </AlertDescription>
      </Alert>

      <div className="space-y-3">
        {agreements.map(a => (
          <Card key={a.field} className={`border transition-colors ${form[a.field] ? "border-green-300 bg-green-50 dark:bg-green-950/10" : ""}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id={a.field}
                  checked={form[a.field]}
                  onCheckedChange={v => f(a.field, Boolean(v))}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <label htmlFor={a.field} className="font-medium text-sm cursor-pointer flex items-center gap-2">
                    {a.title}
                    {form[a.field] && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                  </label>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Read Agreement
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        By checking the boxes above and submitting, you confirm that you have read, understood, and agree to be legally bound by these agreements. Your digital signature will be captured with the current timestamp.
      </p>
    </div>
  );
}

// ─── Step 5: Review ─────────────────────────────────────────────────────────────

function ReviewStep({ form }: { form: FormState }) {
  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between py-1.5 border-b border-dashed last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value || "—"}</span>
    </div>
  );

  const incomeLabel = INCOME_OPTIONS.find(o => o.min === form.annualIncomeMin)?.label || "—";
  const lwLabel = NW_OPTIONS.find(o => o.min === form.liquidNetWorthMin)?.label || "—";
  const nwLabel = NW_OPTIONS.find(o => o.min === form.totalNetWorthMin)?.label || "—";
  const fundingLabel = FUNDING_SOURCES.find(f => f.value === form.fundingSource)?.label || "—";

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold mb-1">Review Your Application</h3>
        <p className="text-sm text-muted-foreground">Please verify all information before submitting. Submitting sends your application to Alpaca for account creation.</p>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Identity</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <Row label="Full Name" value={`${form.firstName} ${form.middleName} ${form.lastName}`.trim()} />
          <Row label="Date of Birth" value={form.dateOfBirth} />
          <Row label="Tax ID Type" value={form.taxIdType} />
          <Row label="Citizenship" value={form.countryOfCitizenship} />
          <Row label="Tax Residence" value={form.countryOfTaxResidence} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Contact</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <Row label="Email" value={form.email} />
          <Row label="Phone" value={form.phone} />
          <Row label="Address" value={form.streetAddress} />
          <Row label="City / State" value={`${form.city}, ${form.state} ${form.postalCode}`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Financial Profile</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <Row label="Funding Source" value={fundingLabel} />
          <Row label="Annual Income" value={incomeLabel} />
          <Row label="Liquid Net Worth" value={lwLabel} />
          <Row label="Total Net Worth" value={nwLabel} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Disclosures & Agreements</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <Row label="Control Person" value={form.isControlPerson ? "Yes" : "No"} />
          <Row label="Exchange/FINRA Affiliated" value={form.isAffiliatedExchangeOrFinra ? "Yes" : "No"} />
          <Row label="Politically Exposed" value={form.isPoliticallyExposed ? "Yes" : "No"} />
          <Row label="Family PEP" value={form.immediateFamilyExposed ? "Yes" : "No"} />
          <Row label="Customer Agreement" value={form.agreedCustomer ? "✓ Agreed" : "Not agreed"} />
          <Row label="Margin Agreement" value={form.agreedMargin ? "✓ Agreed" : "Not agreed"} />
          <Row label="Account Agreement" value={form.agreedAccount ? "✓ Agreed" : "Not agreed"} />
        </CardContent>
      </Card>

      <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 py-3">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
        <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
          By submitting, you certify that all information provided is true and complete. False statements may result in account rejection or closure.
        </AlertDescription>
      </Alert>
    </div>
  );
}

// ─── Success State ──────────────────────────────────────────────────────────────

function SuccessCard({ alpacaStatus, accountNumber, onGoToTrading }: { alpacaStatus: string; accountNumber?: string; onGoToTrading: () => void }) {
  return (
    <div className="text-center py-8 space-y-5">
      <div className="flex justify-center">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center ${alpacaStatus === "ACTIVE" ? "bg-green-100 dark:bg-green-900/30" : "bg-blue-100 dark:bg-blue-900/30"}`}>
          {alpacaStatus === "ACTIVE"
            ? <CheckCircle2 className="h-10 w-10 text-green-500" />
            : <Globe className="h-10 w-10 text-blue-500" />
          }
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold">
          {alpacaStatus === "ACTIVE" ? "Account is Live!" : "Application Submitted!"}
        </h2>
        <p className="text-muted-foreground mt-2 max-w-md mx-auto">
          {alpacaStatus === "ACTIVE"
            ? `Your US trading account (${accountNumber}) is now active. You can start trading US stocks.`
            : "Your Alpaca brokerage account application has been submitted. Alpaca will review and notify you within 1-2 business days."}
        </p>
      </div>

      {accountNumber && (
        <Badge className="text-sm px-4 py-1 font-mono">{accountNumber}</Badge>
      )}

      <div className="flex gap-3 justify-center">
        <Button onClick={onGoToTrading} className="gap-2">
          <Landmark className="h-4 w-4" />
          Go to US Trading
        </Button>
      </div>

      {alpacaStatus !== "ACTIVE" && (
        <p className="text-xs text-muted-foreground">
          You will receive an email when your account is approved.
          <a href="https://broker-app.sandbox.alpaca.markets" target="_blank" rel="noopener noreferrer" className="underline ml-1">
            Check Alpaca Broker Portal
          </a>
        </p>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function OpenAccountPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [stepIdx, setStepIdx] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ alpacaStatus: string; accountNumber?: string } | null>(null);

  const { data, isLoading } = useQuery<PrefillResponse>({
    queryKey: ["/api/us-trading/account/prefill"],
    staleTime: 30000,
  });

  const [form, setForm] = useState<FormState>({
    firstName: "", middleName: "", lastName: "",
    dateOfBirth: "", taxId: "", taxIdType: "IND_PAN",
    countryOfCitizenship: "IND", countryOfBirth: "IND", countryOfTaxResidence: "IND",
    email: "", phone: "", streetAddress: "",
    city: "", state: "", postalCode: "", country: "IND",
    fundingSource: "employment_income",
    annualIncomeMin: "25000", annualIncomeMax: "50000",
    liquidNetWorthMin: "25000", liquidNetWorthMax: "50000",
    totalNetWorthMin: "50000", totalNetWorthMax: "100000",
    isControlPerson: false, isAffiliatedExchangeOrFinra: false,
    isPoliticallyExposed: false, immediateFamilyExposed: false,
    agreedCustomer: false, agreedMargin: false, agreedAccount: false,
  });

  // Pre-fill from KYC
  useEffect(() => {
    if (data?.prefill) {
      const p = data.prefill;
      setForm(prev => ({
        ...prev,
        firstName: p.firstName || prev.firstName,
        middleName: p.middleName || prev.middleName,
        lastName: p.lastName || prev.lastName,
        email: p.email || prev.email,
        phone: p.phone || prev.phone,
        dateOfBirth: p.dateOfBirth || prev.dateOfBirth,
        streetAddress: p.address || prev.streetAddress,
        city: p.city || prev.city,
        state: p.state || prev.state,
        postalCode: p.postalCode || prev.postalCode,
        taxId: p.panNumber || prev.taxId,
        taxIdType: p.panNumber ? "IND_PAN" : prev.taxIdType,
        isPoliticallyExposed: p.pepStatus?.includes("pep") && !p.pepStatus?.includes("not") ? true : false,
      }));
    }

    // If already submitted, jump to success
    if (data?.brokerAccount?.alpacaAccountId) {
      setSubmitted(true);
      setResult({
        alpacaStatus: data.brokerAccount.alpacaStatus || "SUBMITTED",
        accountNumber: data.brokerAccount.alpacaAccountNumber,
      });
    }
  }, [data]);

  const applyMutation = useMutation({
    mutationFn: () => apiRequest("/api/us-trading/account/apply", {
      method: "POST",
      body: JSON.stringify({
        identity: {
          firstName: form.firstName,
          middleName: form.middleName || undefined,
          lastName: form.lastName,
          dateOfBirth: form.dateOfBirth,
          taxId: form.taxId || undefined,
          taxIdType: form.taxIdType,
          countryOfCitizenship: form.countryOfCitizenship,
          countryOfBirth: form.countryOfBirth,
          countryOfTaxResidence: form.countryOfTaxResidence,
          fundingSource: form.fundingSource,
          annualIncomeMin: form.annualIncomeMin,
          annualIncomeMax: form.annualIncomeMax,
          liquidNetWorthMin: form.liquidNetWorthMin,
          liquidNetWorthMax: form.liquidNetWorthMax,
          totalNetWorthMin: form.totalNetWorthMin,
          totalNetWorthMax: form.totalNetWorthMax,
        },
        contact: {
          email: form.email,
          phone: form.phone,
          streetAddress: [form.streetAddress],
          city: form.city,
          state: form.state,
          postalCode: form.postalCode,
          country: form.country,
        },
        disclosures: {
          isControlPerson: form.isControlPerson,
          isAffiliatedExchangeOrFinra: form.isAffiliatedExchangeOrFinra,
          isPoliticallyExposed: form.isPoliticallyExposed,
          immediateFamilyExposed: form.immediateFamilyExposed,
        },
        agreements: [
          { agreement: "customer_agreement", signedAt: new Date().toISOString(), revision: "04.2021.10" },
          { agreement: "margin_agreement", signedAt: new Date().toISOString(), revision: "04.2021.10" },
          { agreement: "account_agreement", signedAt: new Date().toISOString(), revision: "04.2021.10" },
        ],
      }),
    }),
    onSuccess: (res: any) => {
      setSubmitted(true);
      setResult({ alpacaStatus: res.alpacaStatus || "SUBMITTED", accountNumber: res.alpacaAccountNumber });
      toast({ title: "Account application submitted!", description: `Status: ${res.alpacaStatus}` });
    },
    onError: (e: any) => {
      toast({ title: "Application failed", description: e.message, variant: "destructive" });
    },
  });

  const canAdvance = () => {
    switch (stepIdx) {
      case 0: return form.firstName && form.lastName && form.email && form.dateOfBirth && form.streetAddress && form.city;
      case 1: return form.fundingSource && form.annualIncomeMin && form.liquidNetWorthMin && form.totalNetWorthMin;
      case 2: return true;
      case 3: return form.agreedCustomer && form.agreedMargin && form.agreedAccount;
      case 4: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    setCompleted(prev => new Set([...prev, stepIdx]));
    setStepIdx(prev => Math.min(prev + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBack = () => {
    setStepIdx(prev => Math.max(prev - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto py-8 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const compliance = data?.compliance;
  const alpacaStatus = data?.brokerAccount?.alpacaStatus;

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Open US Trading Account</h1>
            <p className="text-sm text-muted-foreground">Alpaca Broker-Dealer · FINRA Member</p>
          </div>
        </div>
      </div>

      {/* Already submitted — show status */}
      {submitted && result ? (
        <>
          {alpacaStatus && <StatusBanner status={alpacaStatus} accountNumber={result.accountNumber} />}
          <SuccessCard
            alpacaStatus={result.alpacaStatus}
            accountNumber={result.accountNumber}
            onGoToTrading={() => navigate("/us-trading")}
          />
        </>
      ) : (
        <>
          {/* Compliance blockers */}
          {compliance && !compliance.eligible && (
            <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20 mb-5">
              <XCircle className="h-4 w-4 text-red-500" />
              <AlertDescription className="text-sm text-red-700 dark:text-red-300">
                <strong>You must resolve these before applying:</strong>
                <ul className="mt-1 list-disc list-inside">
                  {compliance.blockers?.map((b: string) => <li key={b}>{b}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Step indicator */}
          <StepIndicator current={stepIdx} completed={completed} />

          {/* Step content */}
          <Card>
            <CardContent className="p-6">
              {stepIdx === 0 && <IdentityStep form={form} setForm={setForm} prefill={data?.prefill!} />}
              {stepIdx === 1 && <FinancialStep form={form} setForm={setForm} />}
              {stepIdx === 2 && <DisclosuresStep form={form} setForm={setForm} />}
              {stepIdx === 3 && <AgreementsStep form={form} setForm={setForm} />}
              {stepIdx === 4 && <ReviewStep form={form} />}
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-4">
            <Button variant="outline" onClick={handleBack} disabled={stepIdx === 0} className="gap-2">
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>

            <span className="text-xs text-muted-foreground">Step {stepIdx + 1} of {STEPS.length}</span>

            {stepIdx < STEPS.length - 1 ? (
              <Button onClick={handleNext} disabled={!canAdvance()} className="gap-2">
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={() => applyMutation.mutate()}
                disabled={applyMutation.isPending || !compliance?.eligible}
                className="gap-2"
              >
                {applyMutation.isPending ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Submitting…</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4" /> Submit Application</>
                )}
              </Button>
            )}
          </div>

          {applyMutation.isError && (
            <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20 mt-4">
              <XCircle className="h-4 w-4 text-red-500" />
              <AlertDescription className="text-sm text-red-700 dark:text-red-300">
                {(applyMutation.error as any)?.message || "Submission failed. Please check your information and try again."}
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  );
}
