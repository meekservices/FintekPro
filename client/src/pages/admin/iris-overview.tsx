import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  TrendingUp,
  Landmark,
  FileText,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

interface IrisStatusData {
  configured: boolean;
  authenticated?: boolean;
  baseUrl?: string;
}

interface IrisStatusResponse {
  success: boolean;
  data: IrisStatusData;
}

interface UniqueInvestorsData {
  uniqueInvestors?: number;
  count?: number;
}

interface UniqueInvestorsResponse {
  success: boolean;
  data: UniqueInvestorsData;
}

interface SipSummaryData {
  activeSips?: number;
  totalSips?: number;
}

interface SipSummaryResponse {
  success: boolean;
  data: SipSummaryData;
}

interface MandateItem {
  status?: string;
  mandateId?: string;
  amount?: number;
}

interface MandatesResponse {
  success: boolean;
  data: MandateItem[];
}

interface OnboardingApplication {
  applicationId?: string;
  status?: string;
}

interface OnboardingData {
  applications?: OnboardingApplication[];
  total?: number;
}

interface OnboardingResponse {
  success: boolean;
  data: OnboardingData;
}

interface InvestorItem {
  pan?: string;
  PAN?: string;
  name?: string;
  investorName?: string;
  fullName?: string;
  status?: string;
  planType?: string;
  category?: string;
  email?: string;
  investorId?: string;
}

interface InvestorsData {
  investors?: InvestorItem[];
  data?: InvestorItem[];
}

interface InvestorsResponse {
  success: boolean;
  data: InvestorsData;
}

function normalizeInvestorCount(data: UniqueInvestorsData | undefined): number | "—" {
  if (!data) return "—";
  return data.uniqueInvestors ?? data.count ?? "—";
}

function normalizeSipCount(data: SipSummaryData | undefined): number | "—" {
  if (!data) return "—";
  return data.activeSips ?? data.totalSips ?? "—";
}

function countActiveMandates(mandates: MandateItem[] | undefined): number | "—" {
  if (!Array.isArray(mandates)) return "—";
  return mandates.filter(m => m.status === "APPROVED" || m.status === "ACTIVE").length;
}

function normalizeOnboardingTotal(data: OnboardingData | undefined): number | "—" {
  if (!data) return "—";
  if (typeof data.total === "number") return data.total;
  if (Array.isArray(data.applications)) return data.applications.length;
  return "—";
}

function normalizeInvestorList(data: InvestorsData | undefined): InvestorItem[] {
  if (!data) return [];
  if (Array.isArray(data.investors)) return data.investors;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

interface KPICardProps {
  title: string;
  value: number | "—";
  icon: LucideIcon;
  colorClass: string;
  isLoading: boolean;
}

function KPICard({ title, value, icon: Icon, colorClass, isLoading }: KPICardProps) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`p-3 rounded-lg bg-opacity-10 ${colorClass.replace("text-", "bg-").replace("-500", "-100")} dark:${colorClass.replace("text-", "bg-").replace("-500", "-900/20")}`}>
          <Icon className={`h-5 w-5 ${colorClass}`} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          {isLoading ? (
            <Skeleton className="h-7 w-16 mt-1" />
          ) : (
            <p className="text-2xl font-bold">{value}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function investorStatusClass(status: string | undefined): string {
  if (status === "ACTIVE") return "text-green-600 border-green-300";
  if (status === "PENDING") return "text-amber-600 border-amber-300";
  return "text-muted-foreground";
}

export default function AdminIrisOverview() {
  const { data: statusData } = useQuery<IrisStatusResponse>({
    queryKey: ["/api/iris/status"],
  });

  const { data: uniqueInvestors, isLoading: loadingInvestors } =
    useQuery<UniqueInvestorsResponse>({
      queryKey: ["/api/iris/dashboard/unique-investors"],
    });

  const { data: sipSummary, isLoading: loadingSip } =
    useQuery<SipSummaryResponse>({
      queryKey: ["/api/iris/dashboard/sip-summary"],
    });

  const { data: mandates, isLoading: loadingMandates } =
    useQuery<MandatesResponse>({
      queryKey: ["/api/iris/transactions/mandates"],
    });

  const { data: onboardingApps, isLoading: loadingOnboarding } =
    useQuery<OnboardingResponse>({
      queryKey: ["/api/iris/onboarding/applications"],
    });

  const { data: investors, isLoading: loadingInvestorList } =
    useQuery<InvestorsResponse>({
      queryKey: ["/api/iris/investors"],
    });

  const isConfigured = statusData?.data?.configured ?? false;
  const investorCount = normalizeInvestorCount(uniqueInvestors?.data);
  const activeSips = normalizeSipCount(sipSummary?.data);
  const activeMandates = countActiveMandates(mandates?.data);
  const onboardingTotal = normalizeOnboardingTotal(onboardingApps?.data);

  const recentInvestors = normalizeInvestorList(investors?.data).slice(0, 10);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Landmark className="h-6 w-6 text-blue-500" />
            KFintech / IRIS Overview
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Admin oversight of investor onboardings, SIPs, and mandates via IRIS
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isConfigured ? (
            <Badge
              variant="outline"
              className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950/20"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> IRIS Connected
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/20"
            >
              <AlertCircle className="h-3.5 w-3.5 mr-1" /> Not Configured
            </Badge>
          )}
        </div>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Total Investors"
          value={investorCount}
          icon={Users}
          colorClass="text-blue-500"
          isLoading={loadingInvestors}
        />
        <KPICard
          title="Active SIPs"
          value={activeSips}
          icon={TrendingUp}
          colorClass="text-green-500"
          isLoading={loadingSip}
        />
        <KPICard
          title="Active Mandates"
          value={activeMandates}
          icon={Landmark}
          colorClass="text-purple-500"
          isLoading={loadingMandates}
        />
        <KPICard
          title="Onboarding Applications"
          value={onboardingTotal}
          icon={FileText}
          colorClass="text-amber-500"
          isLoading={loadingOnboarding}
        />
      </div>

      {/* Quick-action links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href="/agent/iris">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open IRIS Hub (Agent View)
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/agent/iris?tab=investors">
              <Users className="h-4 w-4 mr-2" />
              Investor Lookup
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/agent/iris?tab=onboarding">
              <FileText className="h-4 w-4 mr-2" />
              Onboarding List
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/agent/iris?tab=portal-links">
              <ExternalLink className="h-4 w-4 mr-2" />
              Portal Link Status
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Recent Investor Onboardings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Recent Investor Onboardings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingInvestorList ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : recentInvestors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">
                {isConfigured
                  ? "No investor data available"
                  : "Configure IRIS API credentials to view investor data"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PAN</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plan Type</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentInvestors.map((inv, i) => (
                  <TableRow key={inv.pan ?? inv.PAN ?? inv.investorId ?? String(i)}>
                    <TableCell className="font-mono text-sm">
                      {inv.pan ?? inv.PAN ?? "—"}
                    </TableCell>
                    <TableCell>
                      {inv.name ?? inv.investorName ?? inv.fullName ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={investorStatusClass(inv.status)}
                      >
                        {inv.status ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>{inv.planType ?? inv.category ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {inv.email ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
