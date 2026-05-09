import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  AlertTriangle,
  Globe,
  ChevronLeft,
  RefreshCw,
  Clock,
  BarChart3,
  Newspaper,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

interface MarketBrief {
  id: string;
  date: string;
  region: string;
  marketSnapshot: string;
  whatChanged: string;
  topMovers: {
    name: string;
    symbol?: string;
    change: number;
    direction: "up" | "down";
  }[];
  sectorHighlights: {
    sector: string;
    trend: string;
    outlook: string;
  }[];
  keyRisks?: string;
  agentTips?: string;
  sources?: string[];
  publishedAt?: string;
  version: number;
}

export default function AgentKnowledgeMarketBrief() {
  const [selectedRegion, setSelectedRegion] = useState("india");

  const { data: todaysBrief, isLoading: todayLoading, refetch } = useQuery<MarketBrief>({
    queryKey: ["/api/knowledge-hub/market-brief/today", selectedRegion],
    queryFn: async () => {
      const response = await fetch(`/api/knowledge-hub/market-brief/today?region=${selectedRegion}`);
      if (!response.ok) throw new Error("Failed to fetch brief");
      return response.json();
    },
  });

  const { data: previousBriefs } = useQuery<MarketBrief[]>({
    queryKey: ["/api/knowledge-hub/market-briefs", selectedRegion],
    queryFn: async () => {
      const response = await fetch(`/api/knowledge-hub/market-briefs?region=${selectedRegion}&status=published&limit=5`);
      if (!response.ok) throw new Error("Failed to fetch briefs");
      return response.json();
    },
  });

  const regions = [
    { id: "india", name: "India", flag: "🇮🇳" },
    { id: "us", name: "US Markets", flag: "🇺🇸" },
    { id: "global", name: "Global", flag: "🌍" },
  ];

  const hasTodaysBrief = todaysBrief && !("fallback" in todaysBrief);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/agent/knowledge-hub">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="h-7 w-7 text-blue-500" />
              Daily Market Brief
            </h1>
            <p className="text-muted-foreground mt-1">AI-generated market intelligence</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="border-border">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="flex gap-2">
        {regions.map((region) => (
          <Button
            key={region.id}
            variant={selectedRegion === region.id ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedRegion(region.id)}
            className={selectedRegion === region.id ? "bg-blue-600 hover:bg-blue-700" : "border-border"}
            data-testid={`region-${region.id}`}
          >
            <span className="mr-1">{region.flag}</span>
            {region.name}
          </Button>
        ))}
      </div>

      {todayLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 bg-card" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-32 bg-card" />
            <Skeleton className="h-32 bg-card" />
          </div>
        </div>
      ) : hasTodaysBrief && todaysBrief ? (
        <div className="space-y-6">
          <Card className="bg-background border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-500" />
                    {format(new Date(todaysBrief.date), "EEEE, MMMM d, yyyy")}
                  </CardTitle>
                  <CardDescription className="text-muted-foreground flex items-center gap-2 mt-1">
                    <Clock className="h-3 w-3" />
                    {todaysBrief.publishedAt
                      ? `Published at ${format(new Date(todaysBrief.publishedAt), "HH:mm")}`
                      : "Latest update"}
                  </CardDescription>
                </div>
                <Badge className="bg-blue-500/20 text-blue-400 border-0">
                  v{todaysBrief.version}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-emerald-500" />
                  Market Snapshot
                </h3>
                <div className="prose prose-invert prose-sm max-w-none">
                  <p className="text-muted-foreground whitespace-pre-line">{todaysBrief.marketSnapshot}</p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Newspaper className="h-5 w-5 text-amber-500" />
                  What Changed
                </h3>
                <div className="prose prose-invert prose-sm max-w-none">
                  <p className="text-muted-foreground whitespace-pre-line">{todaysBrief.whatChanged}</p>
                </div>
              </div>

              {todaysBrief.topMovers && todaysBrief.topMovers.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-3">Top Movers</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {todaysBrief.topMovers.map((mover, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border ${
                          mover.direction === "up"
                            ? "bg-emerald-500/10 border-emerald-500/30"
                            : "bg-red-500/10 border-red-500/30"
                        }`}
                      >
                        <p className="font-medium text-foreground text-sm">{mover.name}</p>
                        {mover.symbol && <p className="text-xs text-muted-foreground">{mover.symbol}</p>}
                        <div className="flex items-center gap-1 mt-1">
                          {mover.direction === "up" ? (
                            <TrendingUp className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          )}
                          <span
                            className={`font-semibold ${
                              mover.direction === "up" ? "text-emerald-400" : "text-red-400"
                            }`}
                          >
                            {mover.change > 0 ? "+" : ""}
                            {mover.change.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {todaysBrief.sectorHighlights && todaysBrief.sectorHighlights.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-3">Sector Highlights</h3>
                  <div className="space-y-2">
                    {todaysBrief.sectorHighlights.map((sector, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-card/50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-foreground">{sector.sector}</span>
                          <Badge variant="outline" className="text-xs border-border">
                            {sector.trend}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{sector.outlook}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {todaysBrief.keyRisks && (
                <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                  <h3 className="text-lg font-semibold text-red-400 mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Key Risks to Watch
                  </h3>
                  <p className="text-muted-foreground">{todaysBrief.keyRisks}</p>
                </div>
              )}

              {todaysBrief.agentTips && (
                <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
                  <h3 className="text-lg font-semibold text-emerald-400 mb-2">Agent Tips</h3>
                  <p className="text-muted-foreground">{todaysBrief.agentTips}</p>
                </div>
              )}

              {todaysBrief.sources && todaysBrief.sources.length > 0 && (
                <div className="pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Sources: {todaysBrief.sources.join(", ")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="bg-background border-border">
          <CardContent className="p-8 text-center">
            <RefreshCw className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No Brief Available Today</h3>
            <p className="text-muted-foreground mb-4">
              The market brief for today hasn't been generated yet. Check back later or view previous briefs below.
            </p>
          </CardContent>
        </Card>
      )}

      {previousBriefs && previousBriefs.length > 0 && (
        <Card className="bg-background border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Previous Briefs</CardTitle>
            <CardDescription className="text-muted-foreground">
              Recent market briefs for reference
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {previousBriefs.map((brief) => (
                  <div
                    key={brief.id}
                    className="p-3 rounded-lg bg-card/50 hover:bg-card cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">
                          {format(new Date(brief.date), "EEEE, MMM d")}
                        </p>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {brief.marketSnapshot}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs border-border">
                        v{brief.version}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <div className="text-xs text-muted-foreground text-center p-4 border-t border-border">
        <p>
          This market brief is generated using AI and is for informational purposes only. 
          It should not be construed as investment advice. Past performance is not indicative of future results.
        </p>
      </div>
    </div>
  );
}
