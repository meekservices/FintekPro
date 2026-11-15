/**
 * @file dynamic-tax-calculator.tsx
 * @description Fully Dynamic Multi-Year Indian Income Tax Calculator & Regime Comparison Engine.
 * Compliant with FintekPro GCR v1.0 and Finance Act 2024 / Budget 2025 statutory standards.
 */

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Calculator,
  IndianRupee,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Download,
  Printer,
  Scale,
  Building,
  Briefcase,
  Home,
  Coins,
  FileCheck,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type {
  TaxCalculationRequest,
  TaxCalculationResponse,
  RegimeComparisonResponse,
  TaxYearConfigResponse,
  AssessmentYear,
  TaxRegime,
  TaxEntityType,
  AgeCategory,
} from "@shared/schema/tax-calculator";

export function DynamicTaxCalculator() {
  const { toast } = useToast();

  // ── Global Configuration State ──────────────────────────────────────────────
  const [assessmentYear, setAssessmentYear] = useState<AssessmentYear>("2025-26");
  const [selectedRegime, setSelectedRegime] = useState<TaxRegime>("new");
  const [entityType, setEntityType] = useState<TaxEntityType>("individual");
  const [ageCategory, setAgeCategory] = useState<AgeCategory>("below_60");
  const [viewMode, setViewMode] = useState<"comparison" | "detailed">("comparison");

  // ── 1. Salary Inputs ────────────────────────────────────────────────────────
  const [basicSalary, setBasicSalary] = useState<number>(1000000);
  const [dearnessAllowance, setDearnessAllowance] = useState<number>(0);
  const [hraReceived, setHraReceived] = useState<number>(180000);
  const [rentPaidPerYear, setRentPaidPerYear] = useState<number>(240000);
  const [isMetroCity, setIsMetroCity] = useState<boolean>(true);
  const [specialAllowance, setSpecialAllowance] = useState<number>(120000);
  const [employerNps80CCD2, setEmployerNps80CCD2] = useState<number>(50000);
  const [professionalTax, setProfessionalTax] = useState<number>(2500);

  // ── 2. House Property Inputs ────────────────────────────────────────────────
  const [hpIsSelfOccupied, setHpIsSelfOccupied] = useState<boolean>(true);
  const [hpGrossRent, setHpGrossRent] = useState<number>(0);
  const [hpMunicipalTaxes, setHpMunicipalTaxes] = useState<number>(0);
  const [hpHomeLoanInterest, setHpHomeLoanInterest] = useState<number>(150000);

  // ── 3. Capital Gains Inputs ─────────────────────────────────────────────────
  const [stcgEquity111A, setStcgEquity111A] = useState<number>(50000);
  const [ltcgEquity112A, setLtcgEquity112A] = useState<number>(150000);
  const [stcgSlabRate, setStcgSlabRate] = useState<number>(0);

  // ── 4. Business & Profession Inputs ─────────────────────────────────────────
  const [netBusinessProfit, setNetBusinessProfit] = useState<number>(0);

  // ── 5. Other Sources Inputs ─────────────────────────────────────────────────
  const [savingsInterest, setSavingsInterest] = useState<number>(15000);
  const [fdInterest, setFdInterest] = useState<number>(45000);
  const [dividendIncome, setDividendIncome] = useState<number>(12000);
  const [familyPension, setFamilyPension] = useState<number>(0);
  const [lotteryWinnings, setLotteryWinnings] = useState<number>(0);

  // ── 6. Chapter VI-A Deductions ──────────────────────────────────────────────
  const [sec80C, setSec80C] = useState<number>(150000);
  const [sec80DSelf, setSec80DSelf] = useState<number>(25000);
  const [sec80DParents, setSec80DParents] = useState<number>(25000);
  const [isParentsSenior, setIsParentsSenior] = useState<boolean>(true);
  const [sec80CCD1B_NPS, setSec80CCD1B_NPS] = useState<number>(50000);
  const [sec80E, setSec80E] = useState<number>(0);
  const [sec80G, setSec80G] = useState<number>(0);

  // ── 7. Taxes Paid & Advance Tax ─────────────────────────────────────────────
  const [tdsSalary, setTdsSalary] = useState<number>(0);
  const [tdsOther, setTdsOther] = useState<number>(0);
  const [advanceTaxQ1, setAdvanceTaxQ1] = useState<number>(0);
  const [advanceTaxQ2, setAdvanceTaxQ2] = useState<number>(0);
  const [advanceTaxQ3, setAdvanceTaxQ3] = useState<number>(0);
  const [advanceTaxQ4, setAdvanceTaxQ4] = useState<number>(0);

  // ── Fetch Dynamic Statutory Slabs & Config ──────────────────────────────────
  const { data: configData } = useQuery<{ success: boolean; data: TaxYearConfigResponse }>({
    queryKey: [`/api/tax/config?ay=${assessmentYear}`],
    staleTime: 60000,
  });

  // ── Build Request Payload ───────────────────────────────────────────────────
  const calculationPayload: TaxCalculationRequest = useMemo(
    () => ({
      assessmentYear,
      regime: selectedRegime,
      entityType,
      ageCategory,
      salary: {
        basicSalary,
        dearnessAllowance,
        hraReceived,
        rentPaidPerYear,
        isMetroCity,
        specialAllowance,
        ltaReceived: 0,
        employerNps80CCD2,
        otherAllowances: 0,
        perquisites: 0,
        professionalTax,
      },
      houseProperty: {
        isSelfOccupied: hpIsSelfOccupied,
        grossAnnualRent: hpGrossRent,
        municipalTaxesPaid: hpMunicipalTaxes,
        homeLoanInterestSec24b: hpHomeLoanInterest,
      },
      capitalGains: {
        stcgEquity111A,
        ltcgEquity112A,
        stcgSlabRate,
        ltcgNormal20: 0,
        ltcgNormal12_5: 0,
      },
      business: {
        netProfit: netBusinessProfit,
        presumptiveSection: "none",
        grossReceiptsOrTurnover: 0,
      },
      otherSources: {
        savingsBankInterest: savingsInterest,
        fixedDepositInterest: fdInterest,
        dividendIncome,
        familyPension,
        lotteryWinningsSec115BB: lotteryWinnings,
        vdaCryptoSec115BBH: 0,
        anyOtherIncome: 0,
      },
      deductions: {
        section80C: sec80C,
        section80DSelf: sec80DSelf,
        section80DParents: sec80DParents,
        isParentsSeniorCitizen: isParentsSenior,
        section80CCD1B_NPS: sec80CCD1B_NPS,
        section80E_EducationLoan: sec80E,
        section80G_Donations: sec80G,
        section80TTA_Savings: ageCategory === "below_60" ? Math.min(savingsInterest, 10000) : 0,
        section80TTB_SeniorSavings: ageCategory !== "below_60" ? Math.min(savingsInterest + fdInterest, 50000) : 0,
        otherDeductions: 0,
      },
      taxesPaid: {
        tdsSalary,
        tdsOtherThanSalary: tdsOther,
        tcsDeducted: 0,
        advanceTaxQ1,
        advanceTaxQ2,
        advanceTaxQ3,
        advanceTaxQ4,
        selfAssessmentTax: 0,
      },
    }),
    [
      assessmentYear,
      selectedRegime,
      entityType,
      ageCategory,
      basicSalary,
      dearnessAllowance,
      hraReceived,
      rentPaidPerYear,
      isMetroCity,
      specialAllowance,
      employerNps80CCD2,
      professionalTax,
      hpIsSelfOccupied,
      hpGrossRent,
      hpMunicipalTaxes,
      hpHomeLoanInterest,
      stcgEquity111A,
      ltcgEquity112A,
      stcgSlabRate,
      netBusinessProfit,
      savingsInterest,
      fdInterest,
      dividendIncome,
      familyPension,
      lotteryWinnings,
      sec80C,
      sec80DSelf,
      sec80DParents,
      isParentsSenior,
      sec80CCD1B_NPS,
      sec80E,
      sec80G,
      tdsSalary,
      tdsOther,
      advanceTaxQ1,
      advanceTaxQ2,
      advanceTaxQ3,
      advanceTaxQ4,
    ]
  );

  // ── Real-Time Dynamic Queries (Recalculates on Payload Change) ───────────────
  const { data: comparisonData, isLoading: isComparing, refetch: refetchComparison } = useQuery<RegimeComparisonResponse>({
    queryKey: ["/api/tax/compare-regimes", calculationPayload],
    queryFn: async () => {
      const res = await apiRequest("/api/tax/compare-regimes", "POST", calculationPayload);
      return res.json();
    },
    staleTime: 5000,
  });

  const { data: calculationData, isLoading: isCalculating } = useQuery<TaxCalculationResponse>({
    queryKey: ["/api/tax/calculate", calculationPayload],
    queryFn: async () => {
      const res = await apiRequest("/api/tax/calculate", "POST", calculationPayload);
      return res.json();
    },
    staleTime: 5000,
  });

  // ── Pre-fill from Portfolio Mutation ────────────────────────────────────────
  const prefillMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/tax/prefill-from-portfolio", "GET");
      return res.json();
    },
    onSuccess: (res: any) => {
      if (res?.data?.capitalGains) {
        setStcgEquity111A(res.data.capitalGains.stcgEquity111A || 0);
        setLtcgEquity112A(res.data.capitalGains.ltcgEquity112A || 0);
        setDividendIncome(res.data.capitalGains.dividendIncome || 0);
        if (res.data.deductions?.section80C_ELSS) {
          setSec80C((prev) => Math.min(150000, prev + res.data.deductions.section80C_ELSS));
        }
        toast({
          title: "Portfolio Data Synced",
          description: "Realized capital gains, dividend yields, and ELSS investments auto-populated.",
        });
      }
    },
  });

  const formatInr = (val: number) => `₹${Math.round(val || 0).toLocaleString("en-IN")}`;

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Deck */}
      <Card className="border-border/60 bg-card/60 backdrop-blur">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Calculator className="h-6 w-6 text-primary" />
                  Dynamic Indian Income Tax Calculator & Regime Planner
                </CardTitle>
                <Badge variant="outline" className="border-primary/40 text-primary text-xs">
                  AY {assessmentYear}
                </Badge>
              </div>
              <CardDescription className="mt-1">
                Unified 5-Heads tax calculation with Finance Act 2024 / Budget 2025 slabs, Section 87A rebate, and Advance Tax penalty tracking.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => prefillMutation.mutate()}
                disabled={prefillMutation.isPending}
                className="gap-2 border-primary/40 hover:bg-primary/10 text-primary"
              >
                <Sparkles className="h-4 w-4" />
                {prefillMutation.isPending ? "Syncing..." : "Auto-Import Portfolio"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="gap-2"
              >
                <Printer className="h-4 w-4" />
                Print ITR
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/40 p-3 rounded-lg border border-border/40">
            <div>
              <Label className="text-xs text-muted-foreground">Assessment Year</Label>
              <Select value={assessmentYear} onValueChange={(val: any) => setAssessmentYear(val)}>
                <SelectTrigger className="h-8 mt-1 text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2026-27">AY 2026-27 (Budget 2025 - ₹12L Rebate)</SelectItem>
                  <SelectItem value="2025-26">AY 2025-26 (Finance Act 2024 - Current)</SelectItem>
                  <SelectItem value="2024-25">AY 2024-25 (Previous FY)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Taxpayer Category</Label>
              <Select value={ageCategory} onValueChange={(val: any) => setAgeCategory(val)}>
                <SelectTrigger className="h-8 mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="below_60">Individual (&lt; 60 years)</SelectItem>
                  <SelectItem value="senior_60_to_80">Senior Citizen (60 – 80)</SelectItem>
                  <SelectItem value="super_senior_above_80">Super Senior (&gt; 80)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Entity Type</Label>
              <Select value={entityType} onValueChange={(val: any) => setEntityType(val)}>
                <SelectTrigger className="h-8 mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="huf">HUF (Hindu Undivided Family)</SelectItem>
                  <SelectItem value="partnership_firm">Partnership / LLP (30% Flat)</SelectItem>
                  <SelectItem value="domestic_company">Domestic Company (22% / 25%)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Regime Focus</Label>
              <div className="flex items-center gap-2 mt-2">
                <Button
                  size="sm"
                  variant={selectedRegime === "new" ? "default" : "outline"}
                  onClick={() => setSelectedRegime("new")}
                  className="h-7 text-xs flex-1"
                >
                  New (Default)
                </Button>
                <Button
                  size="sm"
                  variant={selectedRegime === "old" ? "default" : "outline"}
                  onClick={() => setSelectedRegime("old")}
                  className="h-7 text-xs flex-1"
                >
                  Old Regime
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Side-by-Side Regime Recommendation Banner */}
      {comparisonData?.recommendation && (
        <Card className={`border-2 ${
          comparisonData.recommendation.optimalRegime === "new"
            ? "border-emerald-500/50 bg-emerald-500/5"
            : "border-blue-500/50 bg-blue-500/5"
        }`}>
          <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge className={
                  comparisonData.recommendation.optimalRegime === "new"
                    ? "bg-emerald-600 text-white"
                    : "bg-blue-600 text-white"
                }>
                  Recommended: {comparisonData.recommendation.optimalRegime === "new" ? "New Tax Regime" : "Old Tax Regime"}
                </Badge>
                <span className="text-sm font-semibold text-foreground">
                  Save {formatInr(comparisonData.recommendation.savingsAmount)} ({comparisonData.recommendation.savingsPercentage}% tax reduction)
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {comparisonData.recommendation.advisoryNote}
              </p>
            </div>

            <div className="flex items-center gap-4 text-right">
              <div className="text-left md:text-right">
                <div className="text-xs text-muted-foreground">New Regime Tax</div>
                <div className="text-base font-bold text-foreground">
                  {formatInr(comparisonData.newRegime.totalTax)}
                </div>
              </div>
              <div className="text-muted-foreground">vs</div>
              <div className="text-left md:text-right">
                <div className="text-xs text-muted-foreground">Old Regime Tax</div>
                <div className="text-base font-bold text-foreground">
                  {formatInr(comparisonData.oldRegime.totalTax)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Grid: Left = Dynamic Input Accordion, Right = Live Calculation & Slabs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: 5 Heads of Income & Deductions Accordion */}
        <div className="lg:col-span-7 space-y-4">
          <Accordion type="multiple" defaultValue={["item-salary", "item-deductions"]} className="space-y-3">
            {/* 1. Salary Income */}
            <AccordionItem value="item-salary" className="border border-border/50 rounded-lg px-4 bg-card/40">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Briefcase className="h-4 w-4 text-blue-500" />
                  1. Income from Salary
                  <Badge variant="secondary" className="ml-2 text-xs">
                    Net: {formatInr(calculationData?.data?.netSalaryIncome || 0)}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Basic Salary (Annual)</Label>
                    <Input
                      type="number"
                      value={basicSalary || ""}
                      onChange={(e) => setBasicSalary(Number(e.target.value) || 0)}
                      className="h-8 mt-1 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Dearness Allowance (DA)</Label>
                    <Input
                      type="number"
                      value={dearnessAllowance || ""}
                      onChange={(e) => setDearnessAllowance(Number(e.target.value) || 0)}
                      className="h-8 mt-1 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">HRA Received</Label>
                    <Input
                      type="number"
                      value={hraReceived || ""}
                      onChange={(e) => setHraReceived(Number(e.target.value) || 0)}
                      className="h-8 mt-1 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Annual Rent Paid</Label>
                    <Input
                      type="number"
                      value={rentPaidPerYear || ""}
                      onChange={(e) => setRentPaidPerYear(Number(e.target.value) || 0)}
                      className="h-8 mt-1 text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <div className="text-xs">
                    <span className="font-medium">Metro City Residence</span>
                    <p className="text-[11px] text-muted-foreground">Delhi, Mumbai, Kolkata, or Chennai (50% HRA limit)</p>
                  </div>
                  <Switch checked={isMetroCity} onCheckedChange={setIsMetroCity} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Special & Other Allowances</Label>
                    <Input
                      type="number"
                      value={specialAllowance || ""}
                      onChange={(e) => setSpecialAllowance(Number(e.target.value) || 0)}
                      className="h-8 mt-1 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Employer NPS 80CCD(2)</Label>
                    <Input
                      type="number"
                      value={employerNps80CCD2 || ""}
                      onChange={(e) => setEmployerNps80CCD2(Number(e.target.value) || 0)}
                      className="h-8 mt-1 text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Eligible under BOTH regimes (up to 14%)</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 2. House Property */}
            <AccordionItem value="item-hp" className="border border-border/50 rounded-lg px-4 bg-card/40">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Home className="h-4 w-4 text-amber-500" />
                  2. Income from House Property
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {formatInr(calculationData?.data?.netHousePropertyIncome || 0)}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4 space-y-3 text-xs">
                <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <div>
                    <span className="font-medium text-xs">Property Type</span>
                    <p className="text-[11px] text-muted-foreground">Self-Occupied vs Let-Out (Rented)</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs">{hpIsSelfOccupied ? "Self-Occupied" : "Rented Out"}</span>
                    <Switch checked={hpIsSelfOccupied} onCheckedChange={setHpIsSelfOccupied} />
                  </div>
                </div>

                {!hpIsSelfOccupied && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Gross Annual Rent Received</Label>
                      <Input
                        type="number"
                        value={hpGrossRent || ""}
                        onChange={(e) => setHpGrossRent(Number(e.target.value) || 0)}
                        className="h-8 mt-1 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Municipal Taxes Paid</Label>
                      <Input
                        type="number"
                        value={hpMunicipalTaxes || ""}
                        onChange={(e) => setHpMunicipalTaxes(Number(e.target.value) || 0)}
                        className="h-8 mt-1 text-xs"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-xs">Home Loan Interest u/s 24(b)</Label>
                  <Input
                    type="number"
                    value={hpHomeLoanInterest || ""}
                    onChange={(e) => setHpHomeLoanInterest(Number(e.target.value) || 0)}
                    className="h-8 mt-1 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Max ₹2,00,000 deduction on self-occupied in Old Regime (Nil in New Regime).
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 3. Capital Gains */}
            <AccordionItem value="item-cg" className="border border-border/50 rounded-lg px-4 bg-card/40">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Coins className="h-4 w-4 text-emerald-500" />
                  3. Capital Gains (Finance Act 2024 Rates)
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {formatInr(calculationData?.data?.netCapitalGainsIncome || 0)}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">STCG Equity (Sec 111A - 20%)</Label>
                    <Input
                      type="number"
                      value={stcgEquity111A || ""}
                      onChange={(e) => setStcgEquity111A(Number(e.target.value) || 0)}
                      className="h-8 mt-1 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">LTCG Equity (Sec 112A - 12.5%)</Label>
                    <Input
                      type="number"
                      value={ltcgEquity112A || ""}
                      onChange={(e) => setLtcgEquity112A(Number(e.target.value) || 0)}
                      className="h-8 mt-1 text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {assessmentYear === "2024-25" ? "₹1,00,000 exemption limit" : "₹1,25,000 exemption limit"}
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 4. Other Sources */}
            <AccordionItem value="item-os" className="border border-border/50 rounded-lg px-4 bg-card/40">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Building className="h-4 w-4 text-purple-500" />
                  4. Income from Other Sources
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {formatInr(calculationData?.data?.netOtherSourcesIncome || 0)}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4 space-y-3 text-xs">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Savings Bank Interest</Label>
                    <Input
                      type="number"
                      value={savingsInterest || ""}
                      onChange={(e) => setSavingsInterest(Number(e.target.value) || 0)}
                      className="h-8 mt-1 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Fixed Deposit Interest</Label>
                    <Input
                      type="number"
                      value={fdInterest || ""}
                      onChange={(e) => setFdInterest(Number(e.target.value) || 0)}
                      className="h-8 mt-1 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Dividend Income</Label>
                    <Input
                      type="number"
                      value={dividendIncome || ""}
                      onChange={(e) => setDividendIncome(Number(e.target.value) || 0)}
                      className="h-8 mt-1 text-xs"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 5. Deductions (Chapter VI-A) */}
            <AccordionItem value="item-deductions" className="border border-border/50 rounded-lg px-4 bg-card/40">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="h-4 w-4 text-teal-500" />
                  5. Deductions (Old Regime Benefits)
                  <Badge variant="secondary" className="ml-2 text-xs">
                    Total: {formatInr(calculationData?.data?.totalEligibleDeductions || 0)}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Section 80C (PPF, ELSS, EPF, LIC)</Label>
                    <Input
                      type="number"
                      value={sec80C || ""}
                      onChange={(e) => setSec80C(Number(e.target.value) || 0)}
                      className="h-8 mt-1 text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Statutory cap: ₹1,50,000</p>
                  </div>
                  <div>
                    <Label className="text-xs">Section 80CCD(1B) Additional NPS</Label>
                    <Input
                      type="number"
                      value={sec80CCD1B_NPS || ""}
                      onChange={(e) => setSec80CCD1B_NPS(Number(e.target.value) || 0)}
                      className="h-8 mt-1 text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Additional cap: ₹50,000</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Section 80D (Self & Family Health)</Label>
                    <Input
                      type="number"
                      value={sec80DSelf || ""}
                      onChange={(e) => setSec80DSelf(Number(e.target.value) || 0)}
                      className="h-8 mt-1 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Section 80D (Parents Health)</Label>
                    <Input
                      type="number"
                      value={sec80DParents || ""}
                      onChange={(e) => setSec80DParents(Number(e.target.value) || 0)}
                      className="h-8 mt-1 text-xs"
                    />
                    <div className="flex items-center gap-1.5 mt-1">
                      <Switch checked={isParentsSenior} onCheckedChange={setIsParentsSenior} />
                      <span className="text-[10px] text-muted-foreground">Parents are Senior Citizens (₹50k limit)</span>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Right Column: Live Tax Breakdown & Slabs Visualizer */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-border/60 bg-card/60 backdrop-blur sticky top-4">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-primary" />
                  Tax Computation Summary
                </CardTitle>
                <Badge variant="outline" className="text-xs font-mono uppercase">
                  {selectedRegime} regime
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4 text-xs">
              {/* Summary Metrics */}
              <div className="space-y-2">
                <div className="flex justify-between py-1 border-b border-border/20">
                  <span className="text-muted-foreground">Gross Total Income</span>
                  <span className="font-semibold">{formatInr(calculationData?.data?.grossTotalIncome || 0)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/20 text-emerald-500">
                  <span>Standard Deduction</span>
                  <span>- {formatInr(calculationData?.data?.salaryStandardDeduction || 0)}</span>
                </div>
                {selectedRegime === "old" && (
                  <div className="flex justify-between py-1 border-b border-border/20 text-emerald-500">
                    <span>Chapter VI-A Deductions</span>
                    <span>- {formatInr(calculationData?.data?.totalEligibleDeductions || 0)}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 font-semibold border-b border-border/40 text-sm">
                  <span>Total Taxable Income</span>
                  <span>{formatInr(calculationData?.data?.totalTaxableIncome || 0)}</span>
                </div>
              </div>

              {/* Tax Computation Waterfall */}
              <div className="p-3 rounded-lg bg-muted/40 space-y-1.5 border border-border/30">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Normal Slab Tax</span>
                  <span>{formatInr(calculationData?.data?.normalSlabTax || 0)}</span>
                </div>
                {(calculationData?.data?.specialRateTax || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Special Rate Tax (CG/Lottery)</span>
                    <span>{formatInr(calculationData?.data?.specialRateTax || 0)}</span>
                  </div>
                )}
                {(calculationData?.data?.rebateSection87A || 0) > 0 && (
                  <div className="flex justify-between text-emerald-500">
                    <span>Section 87A Rebate</span>
                    <span>- {formatInr(calculationData?.data?.rebateSection87A || 0)}</span>
                  </div>
                )}
                {(calculationData?.data?.surchargeAmount || 0) > 0 && (
                  <div className="flex justify-between text-amber-500">
                    <span>Surcharge</span>
                    <span>+ {formatInr(calculationData?.data?.surchargeAmount || 0)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Health & Education Cess (4%)</span>
                  <span>+ {formatInr(calculationData?.data?.healthAndEducationCess || 0)}</span>
                </div>

                <div className="pt-2 border-t border-border/40 flex justify-between font-bold text-sm text-foreground">
                  <span>Net Tax Liability</span>
                  <span className="text-primary text-base">
                    {formatInr(calculationData?.data?.totalTaxLiability || 0)}
                  </span>
                </div>

                <div className="flex justify-between text-[11px] text-muted-foreground pt-1">
                  <span>Effective Tax Rate</span>
                  <span className="font-semibold text-foreground">
                    {calculationData?.data?.effectiveTaxRatePercent || 0}%
                  </span>
                </div>
              </div>

              {/* Dynamic Slab Breakdown Progress */}
              {calculationData?.data?.slabBreakdown && calculationData.data.slabBreakdown.length > 0 && (
                <div className="space-y-2 pt-1">
                  <Label className="text-xs font-semibold flex items-center justify-between">
                    <span>Slab Progression Breakdown</span>
                    <span className="text-[10px] text-muted-foreground font-normal">Income Tax Act</span>
                  </Label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {calculationData.data.slabBreakdown.map((slab, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded bg-card/80 border border-border/30 text-[11px]"
                      >
                        <div>
                          <div className="font-medium">{slab.slabRange}</div>
                          <div className="text-[10px] text-muted-foreground">
                            Taxed @ {slab.ratePercent}% ({formatInr(slab.taxableAmountInSlab)})
                          </div>
                        </div>
                        <div className="font-mono font-semibold text-foreground">
                          {formatInr(slab.taxAmount)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Advance Tax Penalty Status if any */}
              {(calculationData?.data?.totalInterestPenalties || 0) > 0 && (
                <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Advance Tax Interest Applicable: {formatInr(calculationData?.data?.totalInterestPenalties || 0)}
                  </div>
                  <div className="text-[11px] space-y-0.5">
                    {calculationData?.data?.interestSec234C ? <div>Sec 234C (Installment delay): {formatInr(calculationData.data.interestSec234C)}</div> : null}
                    {calculationData?.data?.interestSec234B ? <div>Sec 234B (Shortfall &lt; 90%): {formatInr(calculationData.data.interestSec234B)}</div> : null}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
export default DynamicTaxCalculator;
