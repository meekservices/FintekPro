/**
 * MarketNewsWidget
 *
 * Dashboard widget displaying live market news from the ET Markets aggregator.
 * Features:
 *  - Scrolling headline ticker (auto-advances every 5s)
 *  - Expandable news card list with source badges
 *  - NSE announcements tab
 *  - Auto-refresh every 5 minutes
 *  - Category filter chips
 *  - External link opens in new tab with rel="noopener noreferrer"
 *
 * FASP-AI: No advisory outputs — news display only. No autonomous actions.
 */

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Newspaper,
  ExternalLink,
  RefreshCw,
  TrendingUp,
  Building2,
  Radio,
  ChevronRight,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types (mirror server/services/et-markets-service.ts) ────────────────────

type NewsSource = "et_markets" | "financial_express" | "nse" | "aggregated";

interface MarketNewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: NewsSource;
  sourceLabel: string;
  publishedAt: string;
  category?: string;
}

interface NseAnnouncement {
  symbol: string;
  companyName: string;
  subject: string;
  broadcastDate: string;
  attachmentUrl?: string;
  category: string;
}

interface MarketSummary {
  headlines: MarketNewsItem[];
  latestNews: MarketNewsItem[];
  nseAnnouncements: NseAnnouncement[];
  fetchedAt: string;
  engine_version: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCE_CONFIG: Record<NewsSource, { label: string; color: string; bg: string }> = {
  et_markets:        { label: "ET Markets",       color: "text-orange-700", bg: "bg-orange-100 dark:bg-orange-900/30" },
  financial_express: { label: "Financial Express", color: "text-blue-700",   bg: "bg-blue-100 dark:bg-blue-900/30" },
  nse:               { label: "NSE",              color: "text-green-700",  bg: "bg-green-100 dark:bg-green-900/30" },
  aggregated:        { label: "Aggregated",       color: "text-gray-700",   bg: "bg-gray-100 dark:bg-gray-800" },
};

const CATEGORY_COLORS: Record<string, string> = {
  Markets:       "border-blue-500   text-blue-600   bg-blue-50   dark:bg-blue-950/40",
  Stocks:        "border-indigo-500 text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40",
  "Mutual Funds":"border-teal-500   text-teal-600   bg-teal-50   dark:bg-teal-950/40",
  IPO:           "border-violet-500 text-violet-600 bg-violet-50 dark:bg-violet-950/40",
  Bonds:         "border-green-500  text-green-600  bg-green-50  dark:bg-green-950/40",
  Economy:       "border-amber-500  text-amber-600  bg-amber-50  dark:bg-amber-950/40",
  Commodities:   "border-orange-500 text-orange-600 bg-orange-50 dark:bg-orange-950/40",
  Forex:         "border-cyan-500   text-cyan-600   bg-cyan-50   dark:bg-cyan-950/40",
};

const ALL_CATEGORIES = ["All", "Markets", "Stocks", "Mutual Funds", "IPO", "Bonds", "Economy"];

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000)    return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: NewsSource }) {
  const cfg = SOURCE_CONFIG[source] ?? SOURCE_CONFIG.aggregated;
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold", cfg.bg, cfg.color)}>
      {cfg.label}
    </span>
  );
}

function CategoryBadge({ category }: { category?: string }) {
  if (!category) return null;
  const cls = CATEGORY_COLORS[category] ?? "border-gray-300 text-gray-500 bg-gray-50";
  return (
    <span className={cn("inline-flex items-center border px-1.5 py-0.5 rounded text-[10px] font-medium", cls)}>
      {category}
    </span>
  );
}

function NewsCardSkeleton() {
  return (
    <div className="p-3 border-b last:border-b-0 space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-4 w-16 rounded" />
        <Skeleton className="h-4 w-12 rounded" />
      </div>
    </div>
  );
}

function NewsCard({ item }: { item: MarketNewsItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors group"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug group-hover:text-primary line-clamp-2 flex-1">
          {item.title}
        </p>
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        <SourceBadge source={item.source} />
        <CategoryBadge category={item.category} />
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {timeAgo(item.publishedAt)}
        </span>
      </div>
    </a>
  );
}

function HeadlineTicker({ headlines }: { headlines: MarketNewsItem[] }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (headlines.length === 0) return;
    const timer = setInterval(() => setIdx((i) => (i + 1) % headlines.length), 5000);
    return () => clearInterval(timer);
  }, [headlines.length]);

  if (headlines.length === 0) return null;
  const current = headlines[idx];

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border-b text-xs overflow-hidden">
      <span className="flex items-center gap-1 shrink-0 font-semibold text-primary">
        <Radio className="h-3 w-3 animate-pulse" />
        LIVE
      </span>
      <div className="flex-1 truncate">
        <a
          href={current.url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-primary hover:underline truncate"
        >
          {current.title}
        </a>
      </div>
      <span className="shrink-0 text-muted-foreground">
        {idx + 1}/{headlines.length}
      </span>
    </div>
  );
}

// ─── Main Widget ──────────────────────────────────────────────────────────────

interface MarketNewsWidgetProps {
  className?: string;
  /** Compact mode — fewer items, no NSE tab */
  compact?: boolean;
}

export function MarketNewsWidget({ className, compact = false }: MarketNewsWidgetProps) {
  const [activeCategory, setActiveCategory] = useState("All");

  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } = useQuery<{
    success: boolean;
    data: MarketSummary;
  }>({
    queryKey: ["market-news-summary"],
    queryFn: async () => {
      const res = await fetch("/api/market-news/summary");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000,  // auto-refresh every 5 min
    staleTime:       4 * 60 * 1000,
    retry: 2,
  });

  const summary  = data?.data;
  const news     = summary?.latestNews ?? [];
  const filtered = activeCategory === "All"
    ? news
    : news.filter((n) => n.category === activeCategory);

  const lastUpdated = useCallback(() => {
    if (!dataUpdatedAt) return "";
    return timeAgo(new Date(dataUpdatedAt).toISOString());
  }, [dataUpdatedAt]);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-0 pt-3 px-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <Newspaper className="h-4 w-4 text-primary" />
            Market News
          </CardTitle>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {dataUpdatedAt && <span>Updated {lastUpdated()}</span>}
            <Button
              variant="ghost" size="sm"
              className="h-6 w-6 p-0"
              onClick={() => refetch()}
              disabled={isFetching}
              title="Refresh news"
            >
              <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Live Headline Ticker */}
      {!isLoading && summary && (
        <HeadlineTicker headlines={summary.headlines} />
      )}

      <Tabs defaultValue="news">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-8 px-3 gap-1">
          <TabsTrigger value="news" className="h-7 text-xs px-2 rounded-sm data-[state=active]:bg-primary/10">
            <TrendingUp className="h-3 w-3 mr-1" />
            Feed
          </TabsTrigger>
          {!compact && (
            <TabsTrigger value="nse" className="h-7 text-xs px-2 rounded-sm data-[state=active]:bg-primary/10">
              <Building2 className="h-3 w-3 mr-1" />
              NSE
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── News Feed Tab ── */}
        <TabsContent value="news" className="mt-0">
          {/* Category filter chips */}
          <div className="flex gap-1 px-3 py-2 overflow-x-auto border-b scrollbar-none">
            {ALL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "shrink-0 text-[10px] px-2 py-1 rounded-full border transition-colors",
                  activeCategory === cat
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-border hover:border-primary hover:text-primary",
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          <ScrollArea className={compact ? "h-72" : "h-96"}>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <NewsCardSkeleton key={i} />)
            ) : isError ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <Newspaper className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>Unable to load market news</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
                  Retry
                </Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No news in this category
              </div>
            ) : (
              filtered.map((item) => <NewsCard key={item.id} item={item} />)
            )}
          </ScrollArea>

          {!compact && (
            <div className="px-3 py-2 border-t">
              <a
                href="https://economictimes.indiatimes.com/markets"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary flex items-center gap-1 hover:underline"
              >
                View all on ET Markets
                <ChevronRight className="h-3 w-3" />
              </a>
            </div>
          )}
        </TabsContent>

        {/* ── NSE Announcements Tab ── */}
        {!compact && (
          <TabsContent value="nse" className="mt-0">
            <ScrollArea className="h-96">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <NewsCardSkeleton key={i} />)
              ) : (summary?.nseAnnouncements ?? []).length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No NSE announcements available
                </div>
              ) : (
                (summary?.nseAnnouncements ?? []).map((a, i) => (
                  <div key={i} className="p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-bold font-mono text-primary">{a.symbol}</span>
                          <Badge variant="outline" className="text-[10px] h-4 px-1">{a.category}</Badge>
                        </div>
                        <p className="text-xs font-medium leading-snug">{a.subject}</p>
                        <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {a.broadcastDate}
                        </p>
                      </div>
                      {a.attachmentUrl && (
                        <a
                          href={a.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Download announcement"
                        >
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
            <div className="px-3 py-2 border-t">
              <a
                href="https://www.nseindia.com/companies-listing/corporate-filings-announcements"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary flex items-center gap-1 hover:underline"
              >
                View all NSE announcements
                <ChevronRight className="h-3 w-3" />
              </a>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </Card>
  );
}

export default MarketNewsWidget;
