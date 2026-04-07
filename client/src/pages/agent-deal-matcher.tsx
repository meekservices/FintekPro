import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Target,
  TrendingUp,
  Users,
  MapPin,
  Flame,
  Star,
  BarChart3,
  RefreshCw,
  Sparkles,
  ChevronRight,
  AlertCircle,
  IndianRupee,
  Building2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Deal {
  id: string;
  name: string;
  dealType: "aif" | "pms";
  category: string | null;
  minInvestment: string;
  return1Y: string | null;
  fundStatus: string;
  isPublished: boolean;
}

interface ProspectMatchResult {
  prospectId: string;
  companyName: string | null;
  city: string | null;
  state: string | null;
  industrySegment: string | null;
  leadQuality: string | null;
  estimatedNetworth: number;
  investableSurplus: number;
  compositeScore: number;
  wealthScore: number;
  matchScore: number;
  matchTier: "excellent" | "strong" | "good" | "possible";
  matchReasons: string[];
  surplus_cover: number;
}

interface DealMatchResponse {
  success: boolean;
  deal: {
    id: string;
    name: string;
    dealType: string;
    minInvestment: number;
    category?: string;
    strategy?: string;
    return1Y?: number;
  };
  matches: ProspectMatchResult[];
  totalEligible: number;
  totalInvestable: number;
  topCities: { city: string; count: number; avgScore: number }[];
  generatedAt: string;
}

interface GeoCity {
  city: string;
  state: string | null;
  count: number;
  avgComposite: number;
  avgNetworth: number;
  hotCount: number;
  totalInvestable: number;
}

const tierConfig = {
  excellent: { label: "Excellent", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300", dot: "bg-emerald-500" },
  strong: { label: "Strong", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", dot: "bg-blue-500" },
  good: { label: "Good", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", dot: "bg-amber-500" },
  possible: { label: "Possible", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", dot: "bg-gray-400" },
};

const qualityConfig = {
  hot: { icon: <Flame className="w-3 h-3" />, color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  warm: { icon: <Star className="w-3 h-3" />, color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  cold: { icon: <AlertCircle className="w-3 h-3" />, color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

function formatCrore(n: number) {
  if (!n) return "—";
  const cr = n / 1e7;
  if (cr >= 100) return `₹${(cr / 100).toFixed(1)}K Cr`;
  return `₹${cr.toFixed(2)} Cr`;
}

function formatMinTicket(n: number) {
  const cr = n / 1e7;
  if (cr >= 1) return `₹${cr.toFixed(0)} Cr`;
  const l = n / 1e5;
  return `₹${l.toFixed(0)} L`;
}

function PipelineStats() {
  const { data } = useQuery<any>({
    queryKey: ["/api/deals/pipeline-stats"],
  });

  const stats = data || {};
  const p = stats.prospects || {};
  const d = stats.deals || {};

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Card className="border-0 bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950/40 dark:to-violet-900/20">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-violet-600" />
            <span className="text-xs font-medium text-violet-700 dark:text-violet-300">Total Prospects</span>
          </div>
          <div className="text-2xl font-bold text-violet-900 dark:text-violet-100">{(p.total || 0).toLocaleString()}</div>
          <div className="text-xs text-violet-600 dark:text-violet-400 mt-1">{p.scored || 0} scored</div>
        </CardContent>
      </Card>
      <Card className="border-0 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/40 dark:to-orange-900/20">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <Flame className="w-4 h-4 text-red-500" />
            <span className="text-xs font-medium text-red-700 dark:text-red-300">Hot Prospects</span>
          </div>
          <div className="text-2xl font-bold text-red-900 dark:text-red-100">{(p.hot || 0).toLocaleString()}</div>
          <div className="text-xs text-red-600 dark:text-red-400 mt-1">{p.warm || 0} warm</div>
        </CardContent>
      </Card>
      <Card className="border-0 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-900/20">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <IndianRupee className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Total Investable</span>
          </div>
          <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
            {p.totalInvestableRupees ? formatCrore(p.totalInvestableRupees) : "—"}
          </div>
          <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">AUM potential</div>
        </CardContent>
      </Card>
      <Card className="border-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-900/20">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Deals Available</span>
          </div>
          <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{d.total || 0}</div>
          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">{d.aifCount || 0} AIF · {d.pmsCount || 0} PMS</div>
        </CardContent>
      </Card>
    </div>
  );
}

function GeoIntelligence() {
  const { data, isLoading } = useQuery<{ success: boolean; cities: GeoCity[] }>({
    queryKey: ["/api/deals/geo-intelligence"],
  });

  const cities = data?.cities || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Loading geo data…
      </div>
    );
  }

  if (!cities.length) {
    return (
      <div className="text-center text-muted-foreground py-10 text-sm">
        No city data available. Prospects need city information.
      </div>
    );
  }

  const maxCount = Math.max(...cities.map((c) => c.count));

  return (
    <div className="space-y-2">
      {cities.slice(0, 15).map((c) => (
        <div key={c.city} className="flex items-center gap-3 group">
          <div className="flex items-center gap-1.5 w-36 shrink-0">
            <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium truncate">{c.city}</span>
          </div>
          <div className="flex-1 relative h-5 bg-muted/50 rounded-full overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all"
              style={{ width: `${(c.count / maxCount) * 100}%` }}
            />
            <span className="absolute right-2 top-0 h-full flex items-center text-[10px] text-muted-foreground">
              {c.count}
            </span>
          </div>
          <div className="w-20 text-right shrink-0">
            <span className="text-xs text-muted-foreground">{formatCrore(c.totalInvestable)}</span>
          </div>
          {c.hotCount > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-300">
              🔥 {c.hotCount}
            </Badge>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AgentDealMatcher() {
  const { toast } = useToast();
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [limitStr, setLimitStr] = useState("50");
  const [filterTier, setFilterTier] = useState("all");
  const [filterQuality, setFilterQuality] = useState("all");
  const [searchText, setSearchText] = useState("");

  const { data: dealsData, isLoading: dealsLoading } = useQuery<{ success: boolean; deals: Deal[] }>({
    queryKey: ["/api/deals/list"],
  });

  const matchMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/deals/match-prospects", {
        method: "POST",
        body: JSON.stringify({
          dealId: selectedDeal!.id,
          dealType: selectedDeal!.dealType,
          limit: Math.min(parseInt(limitStr) || 50, 100),
        }),
      }),
    onError: (e: any) => {
      toast({ title: "Match failed", description: e.message, variant: "destructive" });
    },
  });

  const result = matchMutation.data as DealMatchResponse | undefined;
  const deals = dealsData?.deals || [];

  const filteredMatches = (result?.matches || []).filter((m) => {
    if (filterTier !== "all" && m.matchTier !== filterTier) return false;
    if (filterQuality !== "all" && m.leadQuality !== filterQuality) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      return (
        (m.companyName || "").toLowerCase().includes(q) ||
        (m.city || "").toLowerCase().includes(q) ||
        (m.industrySegment || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="w-6 h-6 text-violet-600" />
            AIF/PMS Deal Matcher
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Match AIF and PMS deals to the best-fit HNI prospects using wealth, engagement, and geography signals.
          </p>
        </div>
        <Badge className="bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200 border-0 text-xs px-2">
          <Sparkles className="w-3 h-3 mr-1" />
          Revenue Loop Engine
        </Badge>
      </div>

      <PipelineStats />

      <Tabs defaultValue="match">
        <TabsList className="mb-4">
          <TabsTrigger value="match">Deal → Prospect Match</TabsTrigger>
          <TabsTrigger value="geo">Geo Intelligence</TabsTrigger>
        </TabsList>

        <TabsContent value="match" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Select a Deal to Match</CardTitle>
              <CardDescription>Choose an AIF or PMS product and run the matching engine.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {dealsLoading ? (
                <div className="text-sm text-muted-foreground animate-pulse">Loading deals…</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
                  {deals.length === 0 ? (
                    <div className="col-span-3 text-sm text-muted-foreground text-center py-8">
                      No AIF or PMS products found. Add deals from the product catalogue.
                    </div>
                  ) : (
                    deals.map((deal) => (
                      <button
                        key={deal.id}
                        onClick={() => setSelectedDeal(deal)}
                        className={`text-left p-3 rounded-lg border-2 transition-all ${
                          selectedDeal?.id === deal.id
                            ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30"
                            : "border-muted hover:border-violet-300 hover:bg-muted/30"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium text-sm leading-tight">{deal.name}</div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] shrink-0 ${
                              deal.dealType === "aif"
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}
                          >
                            {deal.dealType.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs text-muted-foreground">
                            Min: {formatMinTicket(parseFloat(deal.minInvestment || "0"))}
                          </span>
                          {deal.return1Y && (
                            <span className="text-xs text-emerald-600 font-medium">
                              +{parseFloat(deal.return1Y).toFixed(1)}% 1Y
                            </span>
                          )}
                        </div>
                        {deal.category && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">{deal.category}</div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}

              <Separator />

              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground whitespace-nowrap">Top N:</label>
                  <Input
                    className="w-20 h-8 text-sm"
                    type="number"
                    min={1}
                    max={100}
                    value={limitStr}
                    onChange={(e) => setLimitStr(e.target.value)}
                  />
                </div>
                <Button
                  disabled={!selectedDeal || matchMutation.isPending}
                  onClick={() => matchMutation.mutate()}
                  className="bg-violet-600 hover:bg-violet-700"
                >
                  {matchMutation.isPending ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Matching…</>
                  ) : (
                    <><Target className="w-4 h-4 mr-2" />Run Matching Engine</>
                  )}
                </Button>
                {selectedDeal && (
                  <span className="text-sm text-muted-foreground">
                    Selected: <span className="font-medium text-foreground">{selectedDeal.name}</span>
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {matchMutation.isError && (
            <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
              <CardContent className="py-4 flex items-center gap-2 text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="text-sm">{(matchMutation.error as any)?.message || "Match failed. Please try again."}</span>
              </CardContent>
            </Card>
          )}

          {result && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="w-4 h-4 text-violet-500" />
                  <span className="text-muted-foreground">
                    Showing <span className="font-semibold text-foreground">{filteredMatches.length}</span> of{" "}
                    <span className="font-semibold text-foreground">{result.totalEligible}</span> eligible prospects
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Total investable pool:{" "}
                  <span className="font-semibold text-foreground">{formatCrore(result.totalInvestable)}</span>
                </div>
                <div className="ml-auto flex items-center gap-2 flex-wrap">
                  <Input
                    placeholder="Search company / city…"
                    className="w-48 h-8 text-xs"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                  />
                  <Select value={filterTier} onValueChange={setFilterTier}>
                    <SelectTrigger className="w-36 h-8 text-xs">
                      <SelectValue placeholder="All tiers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tiers</SelectItem>
                      <SelectItem value="excellent">Excellent</SelectItem>
                      <SelectItem value="strong">Strong</SelectItem>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="possible">Possible</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterQuality} onValueChange={setFilterQuality}>
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue placeholder="All quality" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Quality</SelectItem>
                      <SelectItem value="hot">Hot 🔥</SelectItem>
                      <SelectItem value="warm">Warm ⭐</SelectItem>
                      <SelectItem value="cold">Cold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {result.topCities.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground self-center">Top cities:</span>
                  {result.topCities.slice(0, 8).map((c) => (
                    <Badge key={c.city} variant="outline" className="text-xs gap-1 py-0.5">
                      <MapPin className="w-2.5 h-2.5" />
                      {c.city} ({c.count})
                    </Badge>
                  ))}
                </div>
              )}

              <Card>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Prospect / Company</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Lead Quality</TableHead>
                        <TableHead className="text-right">Net Worth</TableHead>
                        <TableHead className="text-right">Surplus Cover</TableHead>
                        <TableHead className="text-right">Composite</TableHead>
                        <TableHead className="text-right">Match Score</TableHead>
                        <TableHead>Tier</TableHead>
                        <TableHead>Why Matched</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMatches.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center text-muted-foreground py-8 text-sm">
                            No prospects match the current filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredMatches.map((m, i) => {
                          const tier = tierConfig[m.matchTier];
                          const qual = qualityConfig[m.leadQuality as keyof typeof qualityConfig] || qualityConfig.cold;
                          return (
                            <TableRow key={m.prospectId} className="hover:bg-muted/30">
                              <TableCell className="text-muted-foreground text-xs font-mono">{i + 1}</TableCell>
                              <TableCell>
                                <div className="font-medium text-sm">{m.companyName || `Prospect #${m.prospectId.slice(-6)}`}</div>
                                {m.industrySegment && (
                                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                    <Building2 className="w-2.5 h-2.5" />
                                    {m.industrySegment}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                {m.city ? (
                                  <div className="flex items-center gap-1 text-xs">
                                    <MapPin className="w-3 h-3 text-muted-foreground" />
                                    {m.city}{m.state ? `, ${m.state}` : ""}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge className={`text-[10px] gap-1 ${qual.color} border-0`}>
                                  {qual.icon}
                                  {(m.leadQuality || "cold").charAt(0).toUpperCase() + (m.leadQuality || "cold").slice(1)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right text-xs font-medium">
                                {formatCrore(m.estimatedNetworth)}
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={`text-xs font-semibold ${m.surplus_cover >= 1.5 ? "text-emerald-600" : m.surplus_cover >= 1 ? "text-amber-600" : "text-gray-500"}`}>
                                  {m.surplus_cover.toFixed(1)}×
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-violet-500 rounded-full"
                                      style={{ width: `${m.compositeScore}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-muted-foreground w-7">{m.compositeScore.toFixed(0)}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="text-sm font-bold tabular-nums">{m.matchScore}</span>
                                <span className="text-xs text-muted-foreground">/100</span>
                              </TableCell>
                              <TableCell>
                                <Badge className={`text-[10px] gap-1 border-0 ${tier.color}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${tier.dot}`} />
                                  {tier.label}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {m.matchReasons.slice(0, 2).map((r, ri) => (
                                    <span key={ri} className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                                      {r}
                                    </span>
                                  ))}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="geo">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="w-4 h-4 text-violet-500" />
                HNI City Intelligence
              </CardTitle>
              <CardDescription>
                Prospect concentration, average composite score, and investable capital by city.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GeoIntelligence />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
