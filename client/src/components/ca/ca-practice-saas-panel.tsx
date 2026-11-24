/**
 * CA Practice SaaS Subscription & GST Invoicing Panel
 *
 * Provides CA/CS practitioners with:
 * - Transparent practice tiers (CA_STARTER, CA_PROFESSIONAL, CA_ENTERPRISE)
 * - Real-time GST-compliant proforma tax invoice preview (SAC 998315, 18% GST)
 * - Intra-State vs Inter-State tax breakup (CGST+SGST vs IGST) based on Place of Supply
 * - RBI 24-hour pre-debit notification disclosure & ICAI Code of Ethics compliance
 *
 * @engineVersion FINTEK-CA-SAAS-v1.0
 */

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Briefcase,
  CheckCircle2,
  ShieldCheck,
  Receipt,
  FileCheck2,
  Clock,
  Sparkles,
  Building2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
} from "lucide-react";

interface SaasTier {
  tierKey: "CA_STARTER" | "CA_PROFESSIONAL" | "CA_ENTERPRISE";
  name: string;
  monthlyFee: number;
  annualFee: number;
  maxActiveClients: number;
  maxTeamSeats: number;
  features: string[];
  recommended?: boolean;
}

interface InvoicePreview {
  tierKey: string;
  billingCycle: "MONTHLY" | "ANNUAL";
  baseFee: number;
  discount: number;
  taxableAmount: number;
  gstRate: number;
  sacCode: string;
  cgst: number;
  sgst: number;
  igst: number;
  totalGst: number;
  totalAmountPayable: number;
  placeOfSupply: string;
  isInterState: boolean;
  reverseChargeApplicable: boolean;
  preDebitNoticeHours: number;
  notes: string[];
}

const INDIAN_STATES = [
  { code: "27", name: "Maharashtra (27) - Primary Base" },
  { code: "07", name: "Delhi (07)" },
  { code: "29", name: "Karnataka (29)" },
  { code: "33", name: "Tamil Nadu (33)" },
  { code: "06", name: "Haryana (06)" },
  { code: "24", name: "Gujarat (24)" },
  { code: "19", name: "West Bengal (19)" },
  { code: "36", name: "Telangana (36)" },
  { code: "09", name: "Uttar Pradesh (09)" },
  { code: "08", name: "Rajasthan (08)" },
];

export function CAPracticeSaasPanel() {
  const { toast } = useToast();
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "ANNUAL">("ANNUAL");
  const [selectedTierKey, setSelectedTierKey] = useState<"CA_STARTER" | "CA_PROFESSIONAL" | "CA_ENTERPRISE">("CA_PROFESSIONAL");
  const [clientStateCode, setClientStateCode] = useState<string>("27");

  // Fetch available tiers
  const { data: tiersData, isLoading: tiersLoading } = useQuery<{
    success: boolean;
    data: SaasTier[];
  }>({
    queryKey: ["/api/admin/desks/ca-saas/tiers"],
  });

  const tiers = tiersData?.data || [
    {
      tierKey: "CA_STARTER",
      name: "CA Practice Starter",
      monthlyFee: 2999,
      annualFee: 29990,
      maxActiveClients: 50,
      maxTeamSeats: 2,
      features: [
        "Up to 50 active client portfolios",
        "Direct Tax (ITR 1-5) auto-computation",
        "GST 2B vs Purchase Register matching",
        "Advance Tax estimator & reminders",
        "Standard email & chat support",
      ],
    },
    {
      tierKey: "CA_PROFESSIONAL",
      name: "CA Professional Firm",
      monthlyFee: 7999,
      annualFee: 79990,
      maxActiveClients: 250,
      maxTeamSeats: 8,
      recommended: true,
      features: [
        "Up to 250 active client portfolios",
        "Form 3CD Tax Audit Scanner & Alert Radar",
        "Rule 11UA unlisted equity share valuation",
        "Section 43B(h) MSME 45-day payment tracker",
        "Iris AI Co-pilot for tax notices & appeals",
        "UDIN generation & tracking assistant",
        "Client white-labeled tax reports",
      ],
    },
    {
      tierKey: "CA_ENTERPRISE",
      name: "CA Enterprise & Multi-Branch",
      monthlyFee: 19999,
      annualFee: 199990,
      maxActiveClients: 10000,
      maxTeamSeats: 25,
      features: [
        "Unlimited client portfolios",
        "Up to 25 team member & article seats",
        "Multi-branch practice consolidation",
        "Custom ERP/Tally/Zoho data sync API",
        "Dedicated relationship manager & priority SLA",
        "Forensic audit trail & SEBI/MCA data backfills",
      ],
    },
  ];

  // Invoice Preview Mutation
  const invoiceMutation = useMutation({
    mutationFn: async (payload: {
      tierKey: string;
      billingCycle: string;
      clientStateCode: string;
    }) => {
      const res = await apiRequest("/api/admin/desks/ca-saas/invoice-preview", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return res.json() as Promise<{ success: boolean; data: InvoicePreview }>;
    },
  });

  // Calculate invoice on state/cycle/tier change
  const handlePreviewInvoice = (tierKey = selectedTierKey, cycle = billingCycle, state = clientStateCode) => {
    setSelectedTierKey(tierKey);
    invoiceMutation.mutate({
      tierKey,
      billingCycle: cycle,
      clientStateCode: state,
    });
  };

  const invoice = invoiceMutation.data?.data;

  return (
    <div className="space-y-6">
      {/* Header & Value Proposition */}
      <Card className="border-indigo-800/40 bg-gradient-to-r from-indigo-950/60 via-slate-900 to-indigo-950/40 text-foreground">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-indigo-500/40 bg-indigo-500/10 text-indigo-300">
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  B2B Practice SaaS
                </Badge>
                <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
                  SAC 998315 • 18% GST Compliant
                </Badge>
              </div>
              <CardTitle className="text-xl font-bold mt-2 text-white">
                CA & CS Practice Cockpit Subscription
              </CardTitle>
              <CardDescription className="text-indigo-200/80">
                Transparent software infrastructure for audit, statutory filing, and client intelligence. Fully compliant with CCPA zero-drip pricing guidelines.
              </CardDescription>
            </div>

            {/* Billing Cycle Toggle */}
            <div className="flex items-center bg-indigo-900/60 p-1.5 rounded-lg border border-indigo-700/50">
              <Button
                size="sm"
                variant={billingCycle === "MONTHLY" ? "default" : "ghost"}
                className={billingCycle === "MONTHLY" ? "bg-indigo-600 text-white" : "text-indigo-200 hover:text-white"}
                onClick={() => {
                  setBillingCycle("MONTHLY");
                  handlePreviewInvoice(selectedTierKey, "MONTHLY", clientStateCode);
                }}
              >
                Monthly
              </Button>
              <Button
                size="sm"
                variant={billingCycle === "ANNUAL" ? "default" : "ghost"}
                className={billingCycle === "ANNUAL" ? "bg-indigo-600 text-white" : "text-indigo-200 hover:text-white"}
                onClick={() => {
                  setBillingCycle("ANNUAL");
                  handlePreviewInvoice(selectedTierKey, "ANNUAL", clientStateCode);
                }}
              >
                Annual <span className="ml-1 text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-semibold">2 Mos Free</span>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tier Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tiers.map((tier) => {
          const isSelected = selectedTierKey === tier.tierKey;
          const displayPrice = billingCycle === "ANNUAL" ? Math.round(tier.annualFee / 12) : tier.monthlyFee;

          return (
            <Card
              key={tier.tierKey}
              className={`relative flex flex-col justify-between transition-all duration-200 ${
                tier.recommended
                  ? "border-indigo-500/80 shadow-lg shadow-indigo-950/40 bg-indigo-950/20"
                  : isSelected
                  ? "border-primary"
                  : "border-border/60 hover:border-border"
              }`}
            >
              {tier.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-indigo-600 text-white hover:bg-indigo-600 font-medium px-3 py-0.5 text-xs">
                    Most Popular for Growing Firms
                  </Badge>
                </div>
              )}

              <CardHeader className="pt-6">
                <CardTitle className="text-lg font-bold">{tier.name}</CardTitle>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold tracking-tight">
                    ₹{displayPrice.toLocaleString("en-IN")}
                  </span>
                  <span className="text-xs text-muted-foreground">/month</span>
                </div>
                {billingCycle === "ANNUAL" && (
                  <p className="text-xs text-emerald-400 font-medium mt-1">
                    Billed annually at ₹{tier.annualFee.toLocaleString("en-IN")} (Save 17%)
                  </p>
                )}
                <CardDescription className="text-xs mt-2">
                  Capacity: <strong className="text-foreground">{tier.maxActiveClients.toLocaleString("en-IN")}</strong> active clients • <strong className="text-foreground">{tier.maxTeamSeats}</strong> staff seats
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3 pb-6 flex-grow">
                <Separator />
                <ul className="space-y-2 text-xs">
                  {tier.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="text-foreground/90">{feat}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="pt-0">
                <Button
                  className="w-full"
                  variant={isSelected ? "default" : "outline"}
                  onClick={() => handlePreviewInvoice(tier.tierKey, billingCycle, clientStateCode)}
                >
                  {isSelected ? "Active / Selected Plan" : "Select & Preview Invoice"}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Itemized Proforma Tax Invoice Preview (CCPA Zero-Drip Compliant) */}
      <Card className="border-border/80">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-400" />
                Transparent Proforma Tax Invoice Preview
              </CardTitle>
              <CardDescription className="text-xs">
                Zero hidden fees. Itemized tax calculation under GST Rule 46 with SAC 998315.
              </CardDescription>
            </div>

            {/* Place of Supply State Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Place of Supply:</span>
              <Select
                value={clientStateCode}
                onValueChange={(val) => {
                  setClientStateCode(val);
                  handlePreviewInvoice(selectedTierKey, billingCycle, val);
                }}
              >
                <SelectTrigger className="w-[200px] h-8 text-xs">
                  <SelectValue placeholder="Select State" />
                </SelectTrigger>
                <SelectContent>
                  {INDIAN_STATES.map((s) => (
                    <SelectItem key={s.code} value={s.code} className="text-xs">
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {invoiceMutation.isPending ? (
            <div className="py-8 text-center text-xs text-muted-foreground animate-pulse">
              Calculating GST itemized invoice...
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/70 p-4 bg-muted/20 space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Selected Practice Plan</span>
                  <span className="font-semibold text-foreground">{selectedTierKey} ({billingCycle})</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Service Accounting Code (SAC)</span>
                  <span className="font-semibold text-foreground">{invoice?.sacCode || "998315 (IT & Accounting Software Services)"}</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Gross Base Fee</span>
                  <span className="font-semibold text-foreground">
                    ₹{(invoice?.baseFee || (billingCycle === "ANNUAL" ? 79990 : 7999)).toLocaleString("en-IN")}
                  </span>
                </div>
                {invoice && invoice.discount > 0 && (
                  <div className="flex justify-between items-center text-emerald-400">
                    <span>Annual Advance Commitment Discount</span>
                    <span>-₹{invoice.discount.toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Taxable Value of Supply</span>
                  <span className="font-semibold text-foreground">
                    ₹{(invoice?.taxableAmount || (billingCycle === "ANNUAL" ? 79990 : 7999)).toLocaleString("en-IN")}
                  </span>
                </div>

                <Separator />

                {/* Tax Breakdown */}
                {invoice?.isInterState ? (
                  <div className="flex justify-between items-center text-indigo-400 font-semibold">
                    <span>Integrated GST (IGST @ 18%)</span>
                    <span>₹{invoice.igst.toLocaleString("en-IN")}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center text-indigo-400">
                      <span>Central GST (CGST @ 9%)</span>
                      <span className="font-semibold">
                        ₹{(invoice?.cgst || Math.round((billingCycle === "ANNUAL" ? 79990 : 7999) * 0.09)).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-indigo-400">
                      <span>State GST (SGST @ 9%)</span>
                      <span className="font-semibold">
                        ₹{(invoice?.sgst || Math.round((billingCycle === "ANNUAL" ? 79990 : 7999) * 0.09)).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </>
                )}

                <Separator />

                <div className="flex justify-between items-center text-sm font-bold text-foreground pt-1">
                  <span>Total Amount Payable (Including 18% GST)</span>
                  <span className="text-emerald-400 text-base">
                    ₹{(invoice?.totalAmountPayable || Math.round((billingCycle === "ANNUAL" ? 79990 : 7999) * 1.18)).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              {/* Statutory Disclosures */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-muted-foreground">
                <div className="flex items-start gap-2 p-2.5 rounded border border-border/50 bg-background/50">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>RBI 24-Hour Mandate Rule:</strong> For auto-debit renewals, an e-mandate pre-debit advisory will be delivered via registered SMS and email exactly 24 hours prior to debit.
                  </span>
                </div>
                <div className="flex items-start gap-2 p-2.5 rounded border border-border/50 bg-background/50">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>ICAI Code of Ethics (2020):</strong> This invoice covers software platform infrastructure only. FintekPro does not share or receive commission on professional auditing or advisory fees.
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between items-center border-t border-border/60 py-3 bg-muted/10">
          <p className="text-xs text-muted-foreground">
            FintekPro Financial Services LLP • GSTIN: 27AABCF1234F1Z5 • Maharashtra
          </p>
          <Button
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={() => {
              toast({
                title: "Practice Subscription Initiated",
                description: `Invoice generated for ${selectedTierKey} (${billingCycle}). Proceeding to secure gateway.`,
              });
            }}
          >
            Confirm Plan & Subscribe
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
