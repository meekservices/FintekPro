import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import {
  Trophy,
  TrendingUp,
  IndianRupee,
  Users,
  Target,
  Search,
  RefreshCw,
  ArrowUpRight,
  Star,
  Zap,
  Crown,
  Medal,
  ChevronRight,
  Building2,
  MapPin,
  Briefcase,
  Flame,
} from "lucide-react";

interface ScoredProspect {
  id: string;
  companyName: string | null;
  cin: string | null;
  city: string | null;
  state: string | null;
  industrySegment: string | null;
  compositeScore: number;
  wealthScore: number;
  activityScore: number;
  relationshipScore: number;
  estimatedNetworth: number;
  investableSurplus: number;
  leadQuality: string | null;
  status: string | null;
  scoreTier: "platinum" | "gold" | "silver" | "bronze";
}

const TIER_CONFIG = {
  platinum: {
    label: "Platinum",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    ring: "ring-purple-400",
    icon: Crown,
    minScore: 80,
  },
  gold: {
    label: "Gold",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    ring: "ring-yellow-400",
    icon: Trophy,
    minScore: 60,
  },
  silver: {
    label: "Silver",
    color: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
    ring: "ring-slate-400",
    icon: Medal,
    minScore: 40,
  },
  bronze: {
    label: "Bronze",
    color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200",
    ring: "ring-orange-400",
    icon: Star,
    minScore: 0,
  },
};

const QUALITY_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive"; icon: any }> = {
  hot: { label: "Hot", variant: "destructive", icon: Flame },
  warm: { label: "Warm", variant: "default", icon: TrendingUp },
  cold: { label: "Cold", variant: "secondary", icon: Target },
};

function fmt(n: number) {
  if (!n) return "—";
  if (n >= 1e9) return `₹${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function AgentHniLeaderboard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [qualityFilter, setQualityFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"compositeScore" | "wealthScore" | "investableSurplus" | "estimatedNetworth">("compositeScore");
  const [limit, setLimit] = useState(50);

  const { data, isLoading, refetch } = useQuery<{ success: boolean; prospects: ScoredProspect[] }>({
    queryKey: ["/api/agent-wizard/prospects/top-ranked", { limit }],
    queryFn: () => apiRequest(`/api/agent-wizard/prospects/top-ranked?limit=${limit}`),
  });

  const scoreMutation = useMutation({
    mutationFn: () => apiRequest("/api/agent-wizard/prospects/bulk-score", { method: "POST", body: JSON.stringify({}) }),
    onSuccess: (res: any) => {
      toast({ title: "Scoring triggered", description: `${res.scored ?? 0} prospects rescored` });
      qc.invalidateQueries({ queryKey: ["/api/agent-wizard/prospects/top-ranked"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to trigger scoring", variant: "destructive" }),
  });

  const prospects = (data?.prospects ?? [])
    .filter((p) => {
      const name = (p.companyName || "").toLowerCase();
      if (search && !name.includes(search.toLowerCase()) && !(p.city || "").toLowerCase().includes(search.toLowerCase())) return false;
      if (tierFilter !== "all" && p.scoreTier !== tierFilter) return false;
      if (qualityFilter !== "all" && p.leadQuality !== qualityFilter) return false;
      return true;
    })
    .sort((a, b) => b[sortBy] - a[sortBy]);

  const stats = {
    total: data?.prospects.length ?? 0,
    platinum: data?.prospects.filter((p) => p.scoreTier === "platinum").length ?? 0,
    gold: data?.prospects.filter((p) => p.scoreTier === "gold").length ?? 0,
    hot: data?.prospects.filter((p) => p.leadQuality === "hot").length ?? 0,
    avgComposite: data?.prospects.length
      ? Math.round(data.prospects.reduce((s, p) => s + p.compositeScore, 0) / data.prospects.length)
      : 0,
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            HNI Prospect Leaderboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Prospects ranked by AI-computed wealth + composite score
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={() => scoreMutation.mutate()} disabled={scoreMutation.isPending}>
            <Zap className="h-4 w-4 mr-1" />
            {scoreMutation.isPending ? "Scoring..." : "Re-score All"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Scored</p>
                <p className="text-2xl font-bold">{isLoading ? "—" : stats.total}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Platinum Tier</p>
                <p className="text-2xl font-bold text-purple-600">{isLoading ? "—" : stats.platinum}</p>
              </div>
              <Crown className="h-8 w-8 text-purple-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Hot Leads</p>
                <p className="text-2xl font-bold text-red-600">{isLoading ? "—" : stats.hot}</p>
              </div>
              <Flame className="h-8 w-8 text-red-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Avg Score</p>
                <p className="text-2xl font-bold">{isLoading ? "—" : stats.avgComposite}</p>
              </div>
              <Target className="h-8 w-8 text-emerald-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or city…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="platinum">Platinum (80+)</SelectItem>
                <SelectItem value="gold">Gold (60+)</SelectItem>
                <SelectItem value="silver">Silver (40+)</SelectItem>
                <SelectItem value="bronze">Bronze</SelectItem>
              </SelectContent>
            </Select>
            <Select value={qualityFilter} onValueChange={setQualityFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Quality" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Quality</SelectItem>
                <SelectItem value="hot">Hot</SelectItem>
                <SelectItem value="warm">Warm</SelectItem>
                <SelectItem value="cold">Cold</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compositeScore">Composite Score</SelectItem>
                <SelectItem value="wealthScore">Wealth Score</SelectItem>
                <SelectItem value="investableSurplus">Investable Surplus</SelectItem>
                <SelectItem value="estimatedNetworth">Est. Net Worth</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : prospects.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No scored prospects yet</p>
              <p className="text-sm mt-1">Click "Re-score All" to compute wealth scores</p>
            </div>
          ) : (
            <div className="divide-y">
              {prospects.map((p, idx) => {
                const tier = TIER_CONFIG[p.scoreTier];
                const TierIcon = tier.icon;
                const quality = p.leadQuality ? QUALITY_CONFIG[p.leadQuality] : null;
                const QualityIcon = quality?.icon;
                return (
                  <div key={p.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`flex-shrink-0 w-9 h-9 rounded-full ring-2 ${tier.ring} flex items-center justify-center font-bold text-sm ${idx < 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        {idx < 3 ? ["🥇", "🥈", "🥉"][idx] : idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm truncate">{p.companyName || "Unknown Company"}</p>
                          <Badge className={`text-xs py-0 px-1.5 ${tier.color}`}>
                            <TierIcon className="h-3 w-3 mr-0.5" />
                            {tier.label}
                          </Badge>
                          {quality && QualityIcon && (
                            <Badge variant={quality.variant} className="text-xs py-0 px-1.5">
                              <QualityIcon className="h-3 w-3 mr-0.5" />
                              {quality.label}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                          {p.city && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />{p.city}{p.state ? `, ${p.state}` : ""}
                            </span>
                          )}
                          {p.industrySegment && (
                            <span className="flex items-center gap-1">
                              <Briefcase className="h-3 w-3" />{p.industrySegment}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 sm:gap-6">
                      <div className="w-36">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Composite</span>
                          <span className="font-bold">{p.compositeScore.toFixed(1)}</span>
                        </div>
                        <Progress value={p.compositeScore} className="h-1.5" />
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Net Worth</p>
                        <p className="font-semibold text-sm">{fmt(p.estimatedNetworth)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Investable</p>
                        <p className="font-semibold text-sm text-emerald-600">{fmt(p.investableSurplus)}</p>
                      </div>
                      <Link href={`/agent/prospects/${p.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {!isLoading && prospects.length > 0 && (
            <div className="p-4 border-t flex justify-center">
              <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + 50)}>
                Load more
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Score Breakdown Legend</CardTitle>
          <CardDescription>Composite = 30% Wealth + 20% Activity + 30% Relationship + 20% Financial Health</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Object.entries(TIER_CONFIG).map(([key, cfg]) => {
              const Icon = cfg.icon;
              return (
                <div key={key} className={`rounded-lg p-3 ${cfg.color} flex items-center gap-3`}>
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">{cfg.label}</p>
                    <p className="text-xs opacity-75">{cfg.minScore}+ score</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
