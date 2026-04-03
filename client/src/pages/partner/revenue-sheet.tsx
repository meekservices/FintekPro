import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  IndianRupee,
  TrendingUp,
  Target,
  Wallet,
  Receipt,
  Users,
  CheckCircle,
  Clock,
  RefreshCw,
  BarChart3,
  FileText,
  Banknote,
  ArrowUpRight,
} from "lucide-react";
import { addMonths, subMonths } from "date-fns";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const fmt = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v || 0);

const compact = (v: number) => {
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${Math.round(v)}`;
};

interface AgentNetworkRow {
  agentId: string;
  agentName: string;
  casesCount: number;
  agentCommission: number;
  uplineRate: number;
  uplineEarned: number;
  status: string;
}

interface PartnerSummary {
  totalAgents: number;
  activeCases: number;
  networkCommission: number;
  uplineIncome: number;
  totalPayout: number;
  pendingAmount: number;
  paidAmount: number;
}

function MonthYearNav({
  month, year, onChange,
}: { month: number; year: number; onChange: (m: number, y: number) => void }) {
  const current = new Date(year, month - 1, 1);
  const prev = subMonths(current, 1);
  const next = addMonths(current, 1);
  const isNextFuture = next > new Date();
  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="icon" onClick={() => onChange(prev.getMonth() + 1, prev.getFullYear())}>
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <div className="min-w-[160px] text-center">
        <p className="text-lg font-bold">{MONTHS[month - 1]} {year}</p>
        <p className="text-xs text-muted-foreground">Partner Revenue Sheet</p>
      </div>
      <Button variant="outline" size="icon" onClick={() => onChange(next.getMonth() + 1, next.getFullYear())} disabled={isNextFuture}>
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

function SCard({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub?: string; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div>
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

function NetworkTable({ rows }: { rows: AgentNetworkRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">No agent activity this month</p>
        <p className="text-sm mt-1">Your agents' cases will appear here once commissions are recorded</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Agent</TableHead>
            <TableHead className="text-right">Cases</TableHead>
            <TableHead className="text-right">Agent Commission</TableHead>
            <TableHead className="text-right">Upline Rate</TableHead>
            <TableHead className="text-right">Your Earning</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.agentId}>
              <TableCell className="font-medium">{r.agentName}</TableCell>
              <TableCell className="text-right">{r.casesCount}</TableCell>
              <TableCell className="text-right">{compact(r.agentCommission)}</TableCell>
              <TableCell className="text-right text-muted-foreground">{(r.uplineRate * 100).toFixed(1)}%</TableCell>
              <TableCell className="text-right font-semibold text-green-600">{compact(r.uplineEarned)}</TableCell>
              <TableCell>
                <Badge className={
                  r.status === "paid"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30"
                    : r.status === "approved"
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30"
                }>
                  {r.status === "paid" ? "Paid" : r.status === "approved" ? "Approved" : "Pending"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PartnerPlanner({ summary, month, year, agentNetwork }: {
  summary: PartnerSummary; month: number; year: number; agentNetwork: AgentNetworkRow[];
}) {
  const [targetAgents, setTargetAgents] = useState("10");
  const [targetIncome, setTargetIncome] = useState("100000");

  const ta = parseInt(targetAgents) || 0;
  const ti = parseFloat(targetIncome) || 0;

  const agentsPct = ta > 0 ? Math.min(100, (summary.totalAgents / ta) * 100) : 0;
  const incomePct = ti > 0 ? Math.min(100, (summary.uplineIncome / ti) * 100) : 0;

  const topAgents = [...agentNetwork].sort((a, b) => b.agentCommission - a.agentCommission).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="w-4 h-4 text-blue-600" /> Set Partner Targets
            </CardTitle>
            <CardDescription>Goals for {MONTHS[month - 1]} {year}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Active Agents Target</Label>
              <Input type="number" value={targetAgents} onChange={(e) => setTargetAgents(e.target.value)} placeholder="e.g. 10" min="0" />
            </div>
            <div className="space-y-2">
              <Label>Upline Income Target (₹)</Label>
              <Input type="number" value={targetIncome} onChange={(e) => setTargetIncome(e.target.value)} placeholder="e.g. 100000" min="0" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="w-4 h-4 text-green-600" /> Progress vs Target
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Active Agents</span>
                <span className="font-medium">{summary.totalAgents} / {ta || "—"}</span>
              </div>
              <Progress value={agentsPct} className="h-3" />
              <p className="text-xs text-right text-muted-foreground">{agentsPct.toFixed(0)}%</p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Upline Income</span>
                <span className="font-medium">{compact(summary.uplineIncome)} / {ti ? compact(ti) : "—"}</span>
              </div>
              <Progress value={incomePct} className="h-3" />
              <p className="text-xs text-right text-muted-foreground">{incomePct.toFixed(0)}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {topAgents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowUpRight className="w-4 h-4 text-amber-600" /> Top Performing Agents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topAgents.map((a, i) => {
                const maxCommission = topAgents[0]?.agentCommission || 1;
                return (
                  <div key={a.agentId} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-bold">{i + 1}</span>
                        <span className="font-medium">{a.agentName}</span>
                      </span>
                      <span className="text-muted-foreground">{a.casesCount} cases · {compact(a.agentCommission)}</span>
                    </div>
                    <Progress value={(a.agentCommission / maxCommission) * 100} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PartnerPayoutStatus({ summary }: { summary: PartnerSummary }) {
  const stages = [
    { label: "Pending", amount: summary.pendingAmount, color: "bg-amber-500", textColor: "text-amber-600", icon: Clock },
    { label: "Paid Out", amount: summary.paidAmount, color: "bg-green-500", textColor: "text-green-600", icon: Banknote },
  ];
  const total = summary.pendingAmount + summary.paidAmount;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="w-4 h-4 text-green-600" /> Upline Income Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {stages.map((s) => (
              <div key={s.label} className="p-4 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <s.icon className={`w-5 h-5 ${s.textColor}`} />
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                </div>
                <p className={`text-2xl font-bold ${s.textColor}`}>{compact(s.amount)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {total > 0 ? `${((s.amount / total) * 100).toFixed(0)}% of total` : "0%"}
                </p>
              </div>
            ))}
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <div className="flex justify-between items-center mb-3">
              <p className="font-medium">Total Upline Income</p>
              <p className="text-xl font-bold text-green-600">{compact(summary.uplineIncome)}</p>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Network Commission Generated</p>
              <p className="font-medium">{compact(summary.networkCommission)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Commission Structure</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between p-3 bg-muted rounded-lg">
              <span className="text-muted-foreground">Agent earns on each case</span>
              <span className="font-medium">Base Commission Rate</span>
            </div>
            <div className="flex justify-between p-3 bg-muted rounded-lg">
              <span className="text-muted-foreground">Your upline incentive</span>
              <span className="font-medium">0.5% on agent commission</span>
            </div>
            <div className="flex justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <span className="font-medium text-blue-800 dark:text-blue-200">Payout frequency</span>
              <span className="font-medium text-blue-800 dark:text-blue-200">Every Tuesday & Friday</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PartnerRevenueSheet() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [activeTab, setActiveTab] = useState("network");

  const { data, isLoading, refetch } = useQuery<{
    success: boolean;
    data: { agentNetwork: AgentNetworkRow[]; summary: PartnerSummary; month: number; year: number };
  }>({
    queryKey: [`/api/partner/revenue-sheet?month=${month}&year=${year}`],
  });

  const agentNetwork: AgentNetworkRow[] = data?.data?.agentNetwork || [];
  const summary: PartnerSummary = data?.data?.summary || {
    totalAgents: 0, activeCases: 0, networkCommission: 0,
    uplineIncome: 0, totalPayout: 0, pendingAmount: 0, paidAmount: 0,
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600">
            <IndianRupee className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Partner Revenue Sheet</h1>
            <p className="text-muted-foreground text-sm">Agent network commissions and your upline income</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <MonthYearNav month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SCard label="Active Agents" value={String(summary.totalAgents)} sub="with cases this month" icon={Users} color="text-blue-600" />
        <SCard label="Network Cases" value={String(summary.activeCases)} sub="total across team" icon={Receipt} color="text-indigo-600" />
        <SCard label="Network Commission" value={compact(summary.networkCommission)} sub="agent earnings" icon={TrendingUp} color="text-green-600" />
        <SCard label="Your Upline Income" value={compact(summary.uplineIncome)} sub="from agent network" icon={Banknote} color="text-emerald-600" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-2">
          <TabsTrigger value="network" className="flex items-center gap-2">
            <Users className="w-4 h-4" /> Agent Network
          </TabsTrigger>
          <TabsTrigger value="planner" className="flex items-center gap-2">
            <Target className="w-4 h-4" /> Monthly Planner
          </TabsTrigger>
          <TabsTrigger value="payouts" className="flex items-center gap-2">
            <Wallet className="w-4 h-4" /> Payout Status
          </TabsTrigger>
        </TabsList>

        <TabsContent value="network">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="w-4 h-4" />
                  Agent Network — {MONTHS[month - 1]} {year}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => refetch()}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-12 flex items-center justify-center text-muted-foreground">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading…
                </div>
              ) : (
                <NetworkTable rows={agentNetwork} />
              )}
              {agentNetwork.length > 0 && (
                <div className="mt-4 pt-4 border-t flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    {agentNetwork.length} agents · Your upline:
                    <span className="font-bold text-green-600 ml-1">{compact(summary.uplineIncome)}</span>
                  </p>
                  <Button variant="outline" size="sm">
                    <Download className="w-3.5 h-3.5 mr-1" /> Download CSV
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="planner">
          <PartnerPlanner summary={summary} month={month} year={year} agentNetwork={agentNetwork} />
        </TabsContent>

        <TabsContent value="payouts">
          <PartnerPayoutStatus summary={summary} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
