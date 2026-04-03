import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  IndianRupee,
  TrendingUp,
  Target,
  Wallet,
  Receipt,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  BarChart3,
  FileText,
  Banknote,
  AlertCircle,
} from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v || 0);

const formatCompact = (v: number) => {
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${Math.round(v)}`;
};

interface Case {
  id: string;
  date: string;
  clientName: string;
  productType: string;
  productCategory: string;
  transactionAmount: number;
  commissionRate: number;
  commissionAmount: number;
  status: string;
  paymentDate?: string;
  paymentRef?: string;
  claimNumber?: string;
}

interface Summary {
  totalCases: number;
  totalCommission: number;
  trailIncome: number;
  directCommission: number;
  pendingAmount: number;
  approvedAmount: number;
  paidAmount: number;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending:      { label: "Pending",      color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",    icon: Clock },
  under_review: { label: "Under Review", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",         icon: RefreshCw },
  approved:     { label: "Approved",     color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300", icon: CheckCircle },
  paid:         { label: "Paid",         color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",     icon: CheckCircle },
  rejected:     { label: "Rejected",     color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",             icon: XCircle },
};

const categoryColor: Record<string, string> = {
  loans:       "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  investments: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  insurance:   "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  mutual_fund: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
};

function MonthYearNav({
  month, year, onChange,
}: { month: number; year: number; onChange: (m: number, y: number) => void }) {
  const current = new Date(year, month - 1, 1);
  const prev = subMonths(current, 1);
  const next = addMonths(current, 1);
  const isNextFuture = next > new Date();

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="icon"
        onClick={() => onChange(prev.getMonth() + 1, prev.getFullYear())}
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <div className="min-w-[160px] text-center">
        <p className="text-lg font-bold">{MONTHS[month - 1]} {year}</p>
        <p className="text-xs text-muted-foreground">Monthly Revenue Sheet</p>
      </div>
      <Button
        variant="outline"
        size="icon"
        onClick={() => onChange(next.getMonth() + 1, next.getFullYear())}
        disabled={isNextFuture}
      >
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

function SummaryCard({
  label, value, sub, icon: Icon, color,
}: { label: string; value: string; sub?: string; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <Icon className={`w-8 h-8 opacity-30 ${color}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function MonthlyPlanner({ cases, summary, month, year }: { cases: Case[]; summary: Summary; month: number; year: number }) {
  const [targetCases, setTargetCases] = useState("20");
  const [targetCommission, setTargetCommission] = useState("50000");

  const tc = parseInt(targetCases) || 0;
  const tcom = parseFloat(targetCommission) || 0;
  const casesPct = tc > 0 ? Math.min(100, (summary.totalCases / tc) * 100) : 0;
  const commissionPct = tcom > 0 ? Math.min(100, (summary.totalCommission / tcom) * 100) : 0;

  const productBreakdown = useMemo(() => {
    const map: Record<string, { count: number; amount: number }> = {};
    for (const c of cases) {
      if (!map[c.productType]) map[c.productType] = { count: 0, amount: 0 };
      map[c.productType].count += 1;
      map[c.productType].amount += c.commissionAmount;
    }
    return Object.entries(map).map(([product, d]) => ({ product, ...d })).sort((a, b) => b.amount - a.amount);
  }, [cases]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="w-4 h-4 text-blue-600" />
              Set Monthly Targets
            </CardTitle>
            <CardDescription>Track your progress against your goals for {MONTHS[month - 1]} {year}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Target Cases (number)</Label>
              <Input
                type="number"
                value={targetCases}
                onChange={(e) => setTargetCases(e.target.value)}
                placeholder="e.g. 20"
                min="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Target Commission (₹)</Label>
              <Input
                type="number"
                value={targetCommission}
                onChange={(e) => setTargetCommission(e.target.value)}
                placeholder="e.g. 50000"
                min="0"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="w-4 h-4 text-green-600" />
              Progress vs Target
            </CardTitle>
            <CardDescription>Actual vs your set targets this month</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cases Closed</span>
                <span className="font-medium">{summary.totalCases} / {tc || "—"}</span>
              </div>
              <Progress value={casesPct} className="h-3" />
              <p className="text-xs text-right text-muted-foreground">{casesPct.toFixed(0)}% achieved</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Commission Earned</span>
                <span className="font-medium">{formatCompact(summary.totalCommission)} / {tcom ? formatCompact(tcom) : "—"}</span>
              </div>
              <Progress value={commissionPct} className="h-3" />
              <p className="text-xs text-right text-muted-foreground">{commissionPct.toFixed(0)}% achieved</p>
            </div>

            {commissionPct >= 100 && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                <p className="text-sm font-medium text-green-700 dark:text-green-300">🎉 Target achieved! Excellent work this month.</p>
              </div>
            )}
            {commissionPct >= 80 && commissionPct < 100 && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Almost there! Just {formatCompact(tcom - summary.totalCommission)} more to go.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="w-4 h-4 text-purple-600" />
            Product-wise Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {productBreakdown.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No cases yet for this month</p>
            </div>
          ) : (
            <div className="space-y-3">
              {productBreakdown.map((p) => {
                const pct = summary.totalCommission > 0 ? (p.amount / summary.totalCommission) * 100 : 0;
                return (
                  <div key={p.product} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{p.product}</span>
                      <span className="text-muted-foreground">
                        {p.count} {p.count === 1 ? "case" : "cases"} · {formatCompact(p.amount)}
                      </span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PayoutStatus({ summary }: { summary: Summary }) {
  const stages = [
    { label: "Pending Approval", amount: summary.pendingAmount, color: "bg-amber-500", textColor: "text-amber-600", icon: Clock },
    { label: "Approved", amount: summary.approvedAmount, color: "bg-indigo-500", textColor: "text-indigo-600", icon: CheckCircle },
    { label: "Paid Out", amount: summary.paidAmount, color: "bg-green-500", textColor: "text-green-600", icon: Banknote },
  ];
  const total = summary.pendingAmount + summary.approvedAmount + summary.paidAmount;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="w-4 h-4 text-green-600" />
            Payout Pipeline
          </CardTitle>
          <CardDescription>Status of your commissions for this month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {stages.map((s) => (
              <div key={s.label} className="p-4 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <s.icon className={`w-5 h-5 ${s.textColor}`} />
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                </div>
                <p className={`text-2xl font-bold ${s.textColor}`}>{formatCompact(s.amount)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {total > 0 ? `${((s.amount / total) * 100).toFixed(0)}% of total` : "0% of total"}
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-2">Commission Flow</p>
            <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
              {stages.map((s) => (
                <div
                  key={s.label}
                  className={`${s.color} transition-all`}
                  style={{ width: total > 0 ? `${(s.amount / total) * 100}%` : "0%" }}
                />
              ))}
            </div>
            <div className="flex gap-4 pt-1">
              {stages.map((s) => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payout Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Minimum Withdrawal: ₹500</p>
                <p className="text-muted-foreground">Payouts are processed every Tuesday and Friday</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Processing Time: 1–3 Business Days</p>
                <p className="text-muted-foreground">Amount credited to your registered bank account</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AgentRevenueSheet() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [activeTab, setActiveTab] = useState("cases");
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery<{
    success: boolean;
    data: { cases: Case[]; summary: Summary; month: number; year: number };
  }>({
    queryKey: [`/api/agent/revenue-sheet?month=${month}&year=${year}`],
  });

  const cases: Case[] = data?.data?.cases || [];
  const summary: Summary = data?.data?.summary || {
    totalCases: 0, totalCommission: 0, trailIncome: 0,
    directCommission: 0, pendingAmount: 0, approvedAmount: 0, paidAmount: 0,
  };

  const handleMonthChange = (m: number, y: number) => {
    setMonth(m);
    setYear(y);
  };

  const handleDownload = () => {
    toast({ title: "Preparing Statement", description: "Your revenue sheet is being prepared for download." });
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600">
            <IndianRupee className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Revenue Sheet</h1>
            <p className="text-muted-foreground text-sm">Case-wise payout tracker with monthly planner</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <MonthYearNav month={month} year={year} onChange={handleMonthChange} />
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Cases"
          value={String(summary.totalCases)}
          sub={summary.totalCases === 0 ? "No cases this month" : `${summary.totalCases} closed`}
          icon={Receipt}
          color="text-blue-600"
        />
        <SummaryCard
          label="Total Commission"
          value={formatCompact(summary.totalCommission)}
          sub="Gross earnings"
          icon={IndianRupee}
          color="text-green-600"
        />
        <SummaryCard
          label="Trail Income"
          value={formatCompact(summary.trailIncome)}
          sub="MF recurring"
          icon={TrendingUp}
          color="text-purple-600"
        />
        <SummaryCard
          label="Paid Out"
          value={formatCompact(summary.paidAmount)}
          sub={formatCompact(summary.pendingAmount) + " pending"}
          icon={Banknote}
          color="text-emerald-600"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-2">
          <TabsTrigger value="cases" className="flex items-center gap-2">
            <FileText className="w-4 h-4" /> Case-wise Sheet
          </TabsTrigger>
          <TabsTrigger value="planner" className="flex items-center gap-2">
            <Target className="w-4 h-4" /> Monthly Planner
          </TabsTrigger>
          <TabsTrigger value="payouts" className="flex items-center gap-2">
            <Wallet className="w-4 h-4" /> Payout Status
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cases">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Receipt className="w-4 h-4" />
                  All Cases — {MONTHS[month - 1]} {year}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => refetch()}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-12 flex items-center justify-center text-muted-foreground">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading cases…
                </div>
              ) : cases.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No cases found for {MONTHS[month - 1]} {year}</p>
                  <p className="text-sm mt-1">Cases will appear here once commissions are recorded</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Txn Amount</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead className="text-right">Commission</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cases.map((c) => {
                        const st = statusConfig[c.status] || statusConfig.pending;
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="whitespace-nowrap text-sm">
                              {c.date ? format(new Date(c.date), "dd MMM yyyy") : "—"}
                            </TableCell>
                            <TableCell className="font-medium max-w-[140px] truncate">{c.clientName}</TableCell>
                            <TableCell>
                              <Badge className={categoryColor[c.productCategory] || categoryColor.loans}>
                                {c.productType}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {c.transactionAmount > 0 ? formatCurrency(c.transactionAmount) : "—"}
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">
                              {c.commissionRate}%
                            </TableCell>
                            <TableCell className="text-right font-semibold text-green-600">
                              {formatCurrency(c.commissionAmount)}
                            </TableCell>
                            <TableCell>
                              <Badge className={st.color}>{st.label}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
              {cases.length > 0 && (
                <div className="mt-4 pt-4 border-t flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    {cases.length} {cases.length === 1 ? "case" : "cases"} · Total:
                    <span className="font-bold text-green-600 ml-1">{formatCurrency(summary.totalCommission)}</span>
                  </p>
                  <Button variant="outline" size="sm" onClick={handleDownload}>
                    <Download className="w-3.5 h-3.5 mr-1" /> Download CSV
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="planner">
          <MonthlyPlanner cases={cases} summary={summary} month={month} year={year} />
        </TabsContent>

        <TabsContent value="payouts">
          <PayoutStatus summary={summary} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
