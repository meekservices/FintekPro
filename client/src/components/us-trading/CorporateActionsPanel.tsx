/**
 * Corporate Actions Panel
 * Shows upcoming and past Alpaca corporate action announcements:
 * dividends (DIV/DIVNRA), stock splits, spinoffs, mergers, name changes.
 * Filtered to focus on the user's current holdings when positions are available.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RefreshCw, DollarSign, TrendingUp, GitMerge, Scissors, ArrowLeftRight, Info } from "lucide-react";

interface CorporateAction {
  id: string;
  corporate_action_type: string;
  ca_type?: string;
  ca_sub_type?: string;
  initiating_symbol?: string;
  initiating_original_cusip?: string;
  target_symbol?: string;
  target_original_cusip?: string;
  declaration_date?: string;
  ex_date?: string;
  record_date?: string;
  payable_date?: string;
  cash?: string;
  old_rate?: number;
  new_rate?: number;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  dividend: { label: "Dividend", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  split: { label: "Stock Split", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  spinoff: { label: "Spinoff", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  merger: { label: "Merger", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  name_change: { label: "Name Change", color: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" },
  rights_distribution: { label: "Rights", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" },
  worth_event: { label: "Worth Event", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
};

function getActionType(a: CorporateAction): string {
  return a.corporate_action_type ?? a.ca_type ?? "unknown";
}

function ActionBadge({ action }: { action: CorporateAction }) {
  const type = getActionType(action);
  const info = ACTION_LABELS[type.toLowerCase()] ?? { label: type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()), color: "bg-gray-100 text-gray-600" };
  return <span className={`text-xs px-2 py-0.5 rounded font-medium ${info.color}`}>{info.label}</span>;
}

interface CorporateActionsPanelProps {
  accountId?: string;
}

export default function CorporateActionsPanel({ accountId }: CorporateActionsPanelProps) {
  const [filterType, setFilterType] = useState("all");
  const [filterSymbol, setFilterSymbol] = useState("all");

  const { data: holdingsData } = useQuery<{ holdings: { symbol: string }[] }>({
    queryKey: ["/api/us-trading/holdings"],
    staleTime: 120_000,
  });
  const userSymbols = holdingsData?.holdings?.map(h => h.symbol) ?? [];

  const today = new Date();
  const threeMonthsAgo = new Date(today);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const threeMonthsOut = new Date(today);
  threeMonthsOut.setMonth(threeMonthsOut.getMonth() + 3);

  const { data, isLoading, refetch } = useQuery<{ success: boolean; announcements: CorporateAction[] }>({
    queryKey: ["/api/us-trading/broker/corporate-actions/announcements", filterType],
    queryFn: () => {
      const params = new URLSearchParams({
        date_from: threeMonthsAgo.toISOString().split("T")[0],
        date_to: threeMonthsOut.toISOString().split("T")[0],
        limit: "100",
      });
      if (filterType !== "all") params.set("types", filterType);
      return fetch(`/api/us-trading/broker/corporate-actions/announcements?${params}`).then(r => r.json());
    },
    staleTime: 300_000,
    refetchInterval: 300_000,
  });

  const announcements = data?.announcements ?? [];

  const now = new Date().toISOString().split("T")[0];
  const upcoming = announcements.filter(a => (a.payable_date ?? a.ex_date ?? a.declaration_date ?? "") >= now);
  const past = announcements.filter(a => (a.payable_date ?? a.ex_date ?? a.declaration_date ?? "") < now);

  const holdingSymbols = new Set(userSymbols);
  const portfolioActions = announcements.filter(a =>
    holdingSymbols.has(a.initiating_symbol ?? "") || holdingSymbols.has(a.target_symbol ?? "")
  );

  function filterRows(rows: CorporateAction[]) {
    return rows.filter(a => {
      if (filterSymbol !== "all" && a.initiating_symbol !== filterSymbol && a.target_symbol !== filterSymbol) return false;
      return true;
    });
  }

  function renderTable(rows: CorporateAction[]) {
    const filtered = filterRows(rows);
    if (filtered.length === 0) {
      return <div className="py-8 text-center text-sm text-muted-foreground">No corporate actions found</div>;
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Symbol</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Ex Date</TableHead>
            <TableHead>Payable</TableHead>
            <TableHead className="text-right">Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map(a => (
            <TableRow key={a.id}>
              <TableCell><ActionBadge action={a} /></TableCell>
              <TableCell className="font-semibold">{a.initiating_symbol ?? "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{a.target_symbol ?? "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {a.ex_date ? new Date(a.ex_date).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }) : "—"}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {a.payable_date ? new Date(a.payable_date).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }) : "—"}
              </TableCell>
              <TableCell className="text-right text-xs">
                {a.cash ? `$${parseFloat(a.cash).toFixed(4)}/sh` :
                 (a.old_rate && a.new_rate) ? `${a.old_rate}:${a.new_rate}` : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <GitMerge className="h-4 w-4" />
                Corporate Actions
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Dividends, splits, spinoffs, mergers — past 3 months and next 3 months
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-8 w-[130px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="dividend">Dividends</SelectItem>
                  <SelectItem value="split">Splits</SelectItem>
                  <SelectItem value="spinoff">Spinoffs</SelectItem>
                  <SelectItem value="merger">Mergers</SelectItem>
                  <SelectItem value="name_change">Name Changes</SelectItem>
                  <SelectItem value="rights_distribution">Rights</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-8 px-2">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {userSymbols.length > 0 && (
          <div className="px-4 pb-2">
            <Select value={filterSymbol} onValueChange={setFilterSymbol}>
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue placeholder="Filter by symbol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Symbols</SelectItem>
                {userSymbols.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <Tabs defaultValue={portfolioActions.length > 0 ? "portfolio" : "upcoming"}>
              <div className="px-4 pt-2">
                <TabsList className="h-8">
                  {portfolioActions.length > 0 && (
                    <TabsTrigger value="portfolio" className="text-xs gap-1">
                      My Holdings
                      <Badge className="bg-amber-100 text-amber-700 text-[10px] h-4 px-1 ml-1">{portfolioActions.length}</Badge>
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="upcoming" className="text-xs gap-1">
                    Upcoming
                    <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-1">{upcoming.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="past" className="text-xs gap-1">
                    Past
                    <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-1">{past.length}</Badge>
                  </TabsTrigger>
                </TabsList>
              </div>
              {portfolioActions.length > 0 && (
                <TabsContent value="portfolio" className="mt-0">
                  {renderTable(portfolioActions)}
                </TabsContent>
              )}
              <TabsContent value="upcoming" className="mt-0">{renderTable(upcoming)}</TabsContent>
              <TabsContent value="past" className="mt-0">{renderTable(past)}</TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <Alert className="border-amber-200 bg-amber-50/50 py-2">
        <Info className="h-3.5 w-3.5 text-amber-600" />
        <AlertDescription className="text-xs text-amber-700">
          <strong>India Tax Note:</strong> Cash dividends from US stocks attract 25% withholding tax (DIVNRA) under IRS rules. Under India–US DTAA, you can claim credit for tax withheld — report via <strong>Schedule FSI</strong> (ITR-2/3) and claim Foreign Tax Credit. Reinvested dividends create a cost basis that must be tracked for Schedule FA.
        </AlertDescription>
      </Alert>
    </div>
  );
}
