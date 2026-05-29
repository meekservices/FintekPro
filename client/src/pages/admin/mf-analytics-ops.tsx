import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import {
  Database, RefreshCw, Play, CheckCircle, AlertCircle,
  TrendingUp, BarChart3, Activity, Clock, Layers,
  ArrowRight, Info,
} from "lucide-react";

interface CoverageData {
  mutualFundMetrics: Record<string, number>;
  mutualFunds: Record<string, number>;
  navDepth: Record<string, number>;
  monthlyReturns: Record<string, number>;
  historicalNav: Record<string, number>;
  generatedAt: string;
}

interface JobResult {
  job: string;
  elapsedMs: number;
  result: Record<string, any>;
}

const JOBS = [
  {
    id: "nav-backfill",
    name: "NAV Backfill Bridge",
    description: "Copies 15.6M rows from historical_nav_data → mf_nav_history. Unlocks all multi-year analytics.",
    icon: Database,
    color: "text-red-600",
    badgeColor: "bg-red-100 text-red-700",
    priority: "critical",
    defaultBody: { limit: 500, minRows: 10 },
    note: "Run first — all other MF analytics depend on NAV depth.",
  },
  {
    id: "amfi-enrich",
    name: "AMFI Enrichment",
    description: "Fetches AMFI NAVAll.txt to fill scheme_sub_category, amc_name, launch_date, change_percent for all 14K+ funds.",
    icon: RefreshCw,
    color: "text-orange-600",
    badgeColor: "bg-orange-100 text-orange-700",
    priority: "high",
    defaultBody: {},
    note: "Fills 5 zero-coverage columns in mutual_funds table.",
  },
  {
    id: "bulk-compute-db",
    name: "Bulk Analytics Compute",
    description: "Runs full MF analytics (Sharpe, CAGR, Beta, SIP XIRR, Calmar) for all schemes with sufficient NAV history.",
    icon: BarChart3,
    color: "text-blue-600",
    badgeColor: "bg-blue-100 text-blue-700",
    priority: "high",
    defaultBody: { limit: 500, minDays: 30, fiscalYear: "FY25-26" },
    note: "Run after nav-backfill for best coverage.",
  },
  {
    id: "monthly-pipeline",
    name: "Monthly Return Pipeline",
    description: "Full chain: generates mf_monthly_returns → cross-sectional ranking → VaR/CVaR/consistency risk metrics.",
    icon: Layers,
    color: "text-purple-600",
    badgeColor: "bg-purple-100 text-purple-700",
    priority: "high",
    defaultBody: { fiscalYear: "FY25-26", minDays: 30, minMonths: 6, limit: 2000 },
    note: "Chains 3 steps in one call. Recommended after bulk-compute-db.",
  },
  {
    id: "cross-sectional-rank",
    name: "Cross-Sectional Ranking",
    description: "Fills category_rank, category_size, percentile_rank for all schemes with 1Y return data.",
    icon: TrendingUp,
    color: "text-green-600",
    badgeColor: "bg-green-100 text-green-700",
    priority: "medium",
    defaultBody: { fiscalYear: "FY25-26" },
    note: "Uses pandas groupby rank within SEBI categories.",
  },
  {
    id: "risk-from-monthly",
    name: "Risk Metrics from Monthly",
    description: "Fills VaR 95%, CVaR 95%, semi-deviation, consistency_score, upside/downside capture ratios.",
    icon: Activity,
    color: "text-indigo-600",
    badgeColor: "bg-indigo-100 text-indigo-700",
    priority: "medium",
    defaultBody: { fiscalYear: "FY25-26", minMonths: 6 },
    note: "Requires mf_monthly_returns data (run monthly-pipeline first).",
  },
  {
    id: "sync-change-pct",
    name: "Sync Change Percent",
    description: "Computes and updates mutual_funds.change_percent and change from latest 2 NAV rows using SQL LAG.",
    icon: RefreshCw,
    color: "text-cyan-600",
    badgeColor: "bg-cyan-100 text-cyan-700",
    priority: "medium",
    defaultBody: {},
    note: "Quick job — fills daily price change for the MF listing page.",
  },
  {
    id: "derived-metrics",
    name: "Derived Metrics",
    description: "Computes Treynor ratio, Jensen alpha, and syncs volatility ↔ standard_deviation from existing data.",
    icon: BarChart3,
    color: "text-yellow-600",
    badgeColor: "bg-yellow-100 text-yellow-700",
    priority: "medium",
    defaultBody: { fiscalYear: "FY25-26", defaultMarketReturn: 0.12 },
    note: "Requires beta and return_1y to be populated first.",
  },
];

function CoverageBar({ label, value, threshold = 80 }: { label: string; value: number; threshold?: number }) {
  const color = value >= threshold ? "bg-green-500" : value >= 50 ? "bg-yellow-500" : value > 0 ? "bg-orange-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-36 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className={`text-xs font-mono w-10 text-right ${value === 0 ? "text-red-500 font-bold" : value >= threshold ? "text-green-600" : "text-yellow-600"}`}>
        {value}%
      </span>
    </div>
  );
}

function JobCard({ job, onRun }: { job: typeof JOBS[0]; onRun: (id: string, body: any) => void }) {
  const [lastResult, setLastResult] = useState<JobResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const Icon = job.icon;

  const handleRun = async () => {
    setIsRunning(true);
    setError(null);
    setLastResult(null);
    try {
      const result = await apiRequest(`/api/admin/mf-analytics/run/${job.id}`, {
        method: 'POST',
        body: JSON.stringify(job.defaultBody),
      }) as JobResult;
      setLastResult(result);
    } catch (e: any) {
      setError(e.message || "Job failed");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card className="border hover:border-primary/40 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg bg-muted ${job.color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">{job.name}</CardTitle>
              <Badge variant="outline" className={`text-xs mt-0.5 ${job.badgeColor} border-0`}>
                {job.priority}
              </Badge>
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleRun}
            disabled={isRunning}
            className="shrink-0"
          >
            {isRunning ? (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5 mr-1.5" />
            )}
            {isRunning ? "Running..." : "Run Now"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        <p className="text-xs text-muted-foreground">{job.description}</p>
        <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
          <Info className="h-3 w-3 shrink-0" />
          <span>{job.note}</span>
        </div>

        {error && (
          <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 rounded px-2 py-1.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        {lastResult && (
          <div className="bg-muted/60 rounded p-2 space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                <CheckCircle className="h-3.5 w-3.5" />
                Completed
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {(lastResult.elapsedMs / 1000).toFixed(1)}s
              </div>
            </div>
            <ScrollArea className="max-h-28">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                {JSON.stringify(lastResult.result, null, 2)}
              </pre>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MFAnalyticsOps() {
  const { data: coverage, isLoading, refetch, isFetching } = useQuery<CoverageData>({
    queryKey: ["/api/admin/mf-analytics/coverage"],
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">MF Analytics Operations</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Populate null columns in mutual_fund_metrics and mutual_funds via Python analytics pipeline.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh Stats
        </Button>
      </div>

      {/* Coverage Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* mutual_fund_metrics */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-600" />
              mutual_fund_metrics
              {coverage && (
                <Badge variant="outline" className="ml-auto text-xs">
                  {coverage.mutualFundMetrics.total?.toLocaleString()} rows
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Loading...</div>
            ) : coverage ? (
              <>
                <CoverageBar label="return_1y" value={Number(coverage.mutualFundMetrics.return1y)} />
                <CoverageBar label="return_3y" value={Number(coverage.mutualFundMetrics.return3y)} />
                <CoverageBar label="return_5y" value={Number(coverage.mutualFundMetrics.return5y)} />
                <CoverageBar label="sharpe_ratio" value={Number(coverage.mutualFundMetrics.sharpe)} />
                <CoverageBar label="alpha" value={Number(coverage.mutualFundMetrics.alpha)} />
                <CoverageBar label="beta" value={Number(coverage.mutualFundMetrics.beta)} />
                <CoverageBar label="category_rank" value={Number(coverage.mutualFundMetrics.categoryRank)} />
                <CoverageBar label="var_95" value={Number(coverage.mutualFundMetrics.var95)} />
                <CoverageBar label="treynor_ratio" value={Number(coverage.mutualFundMetrics.treynor)} />
                <CoverageBar label="consistency_score" value={Number(coverage.mutualFundMetrics.consistency)} />
                <CoverageBar label="volatility" value={Number(coverage.mutualFundMetrics.volatility)} />
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* mutual_funds */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="h-4 w-4 text-green-600" />
              mutual_funds
              {coverage && (
                <Badge variant="outline" className="ml-auto text-xs">
                  {coverage.mutualFunds.total?.toLocaleString()} rows
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Loading...</div>
            ) : coverage ? (
              <>
                <CoverageBar label="change_percent" value={Number(coverage.mutualFunds.changePercent)} />
                <CoverageBar label="scheme_sub_category" value={Number(coverage.mutualFunds.schemeSubCategory)} />
                <CoverageBar label="amc_code" value={Number(coverage.mutualFunds.amcCode)} />
                <CoverageBar label="launch_date" value={Number(coverage.mutualFunds.launchDate)} />
                <CoverageBar label="benchmark_index_code" value={Number(coverage.mutualFunds.benchmark)} />
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* NAV Depth */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-600" />
              NAV Data Depth
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Loading...</div>
            ) : coverage ? (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-muted rounded p-2 text-center">
                    <div className="text-lg font-bold">{coverage.navDepth.schemes?.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Schemes in mf_nav_history</div>
                  </div>
                  <div className="bg-muted rounded p-2 text-center">
                    <div className="text-lg font-bold">{Number(coverage.navDepth.avgDays).toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground">Avg NAV days/scheme</div>
                  </div>
                  <div className="bg-muted rounded p-2 text-center">
                    <div className="text-lg font-bold">{coverage.navDepth.schemes100Plus?.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Schemes ≥100 days</div>
                  </div>
                  <div className="bg-muted rounded p-2 text-center">
                    <div className="text-lg font-bold">{coverage.navDepth.schemes365Plus?.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Schemes ≥365 days</div>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-muted rounded p-2 text-center">
                    <div className="text-lg font-bold">{coverage.monthlyReturns.schemes?.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Monthly return schemes</div>
                  </div>
                  <div className="bg-muted rounded p-2 text-center">
                    <div className="text-lg font-bold">{(coverage.historicalNav.rows / 1e6).toFixed(1)}M</div>
                    <div className="text-xs text-muted-foreground">Rows in historical_nav_data</div>
                  </div>
                </div>
                {coverage.navDepth.avgDays < 50 && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    NAV depth is shallow — run <strong>NAV Backfill Bridge</strong> first to unlock multi-year analytics.
                  </div>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Recommended Run Order */}
      <Card className="border-dashed border-primary/50 bg-primary/5">
        <CardContent className="pt-4 pb-3">
          <p className="text-xs font-medium text-primary mb-2">Recommended execution order:</p>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {["nav-backfill", "amfi-enrich", "bulk-compute-db", "monthly-pipeline", "sync-change-pct", "derived-metrics"].map((j, i, arr) => (
              <span key={j} className="flex items-center gap-1.5">
                <code className="bg-background border rounded px-1.5 py-0.5 font-mono">{j}</code>
                {i < arr.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Job Cards */}
      <div>
        <h2 className="text-base font-semibold mb-3">Analytics Jobs</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
          {JOBS.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onRun={(id, body) => {}}
            />
          ))}
        </div>
      </div>

      {coverage && (
        <p className="text-xs text-muted-foreground text-right">
          Stats as of {new Date(coverage.generatedAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
