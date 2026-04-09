/**
 * Corporate Actions Panel
 * Shows upcoming and past Alpaca corporate action announcements:
 * dividends (DIV/DIVNRA), stock splits, spinoffs, mergers, name changes, rights.
 * Filtered to focus on the user's current holdings when positions are available.
 *
 * Now includes voluntary election submission for eligible corporate actions
 * (mergers, tender offers, rights distributions) where the investor must choose
 * between cash, stock, or a combination.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import apiRequest from "@/lib/queryClient";
import { RefreshCw, DollarSign, TrendingUp, GitMerge, Scissors, ArrowLeftRight, Info, Vote, CheckCircle } from "lucide-react";

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
  // voluntary action fields
  election_deadline?: string;
  is_voluntary?: boolean;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  dividend: { label: "Dividend", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  split: { label: "Stock Split", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  spinoff: { label: "Spinoff", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  merger: { label: "Merger", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  name_change: { label: "Name Change", color: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" },
  rights_distribution: { label: "Rights", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" },
  worth_event: { label: "Worth Event", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  tender_offer: { label: "Tender Offer", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" },
};

const VOLUNTARY_TYPES = new Set(["merger", "rights_distribution", "tender_offer", "spinoff"]);

function getActionType(a: CorporateAction): string {
  return a.corporate_action_type ?? a.ca_type ?? "unknown";
}

function isVoluntary(a: CorporateAction): boolean {
  return a.is_voluntary === true || VOLUNTARY_TYPES.has(getActionType(a).toLowerCase());
}

function ActionBadge({ action }: { action: CorporateAction }) {
  const type = getActionType(action);
  const info = ACTION_LABELS[type.toLowerCase()] ?? { label: type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()), color: "bg-gray-100 text-gray-600" };
  return <span className={`text-xs px-2 py-0.5 rounded font-medium ${info.color}`}>{info.label}</span>;
}

// ─── Election Dialog ───────────────────────────────────────────────────────────

interface ElectionDialogProps {
  action: CorporateAction;
  accountId: string;
  onClose: () => void;
}

function ElectionDialog({ action, accountId, onClose }: ElectionDialogProps) {
  const [electionType, setElectionType] = useState<"cash" | "stock" | "mixed" | "none">("stock");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/us-trading/broker/accounts/${accountId}/corporate-actions/${action.id}/elections`, "POST", {
        election_type: electionType,
      }),
    onSuccess: () => {
      toast({ title: "Election submitted", description: `Your ${electionType} election for ${action.initiating_symbol ?? action.id} has been recorded.` });
      queryClient.invalidateQueries({ queryKey: ["/api/us-trading/broker/accounts", accountId, "corporate-actions", action.id, "elections"] });
      onClose();
    },
    onError: (e: any) => {
      toast({ title: "Election failed", description: e?.message ?? "Unable to submit election. Try again.", variant: "destructive" });
    },
  });

  const type = getActionType(action);
  const isRights = type.toLowerCase() === "rights_distribution";
  const isMerger = type.toLowerCase() === "merger" || type.toLowerCase() === "tender_offer";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Vote className="h-5 w-5 text-primary" />
            Submit Corporate Action Election
          </DialogTitle>
          <DialogDescription>
            <strong>{action.initiating_symbol ?? "Unknown"}</strong> — {ACTION_LABELS[type.toLowerCase()]?.label ?? type}
            {action.election_deadline && (
              <span className="ml-1 text-orange-600 font-medium">
                (Deadline: {new Date(action.election_deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })})
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <RadioGroup value={electionType} onValueChange={(v) => setElectionType(v as any)} className="space-y-3">
            <div className="flex items-start gap-3 p-3 border rounded-md hover:bg-muted/30 cursor-pointer">
              <RadioGroupItem value="cash" id="el-cash" className="mt-0.5" />
              <Label htmlFor="el-cash" className="cursor-pointer space-y-0.5">
                <p className="font-medium text-sm">Cash</p>
                <p className="text-xs text-muted-foreground">
                  Receive {action.cash ? `$${parseFloat(action.cash).toFixed(4)}/share` : "cash consideration"} for your shares.
                  {isMerger && " India: cash received = capital gain (LTCG/STCG based on holding period). Report on Schedule CG of ITR-2/3."}
                </p>
              </Label>
            </div>
            <div className="flex items-start gap-3 p-3 border rounded-md hover:bg-muted/30 cursor-pointer">
              <RadioGroupItem value="stock" id="el-stock" className="mt-0.5" />
              <Label htmlFor="el-stock" className="cursor-pointer space-y-0.5">
                <p className="font-medium text-sm">Stock</p>
                <p className="text-xs text-muted-foreground">
                  Receive new shares in exchange.
                  {isMerger && " India: stock exchange in a merger is generally treated as a deemed transfer — capital gains arise. DTAA relief may apply."}
                  {isRights && " India: rights allotment at a discount; cost basis = issue price; LTCG/STCG on later sale."}
                </p>
              </Label>
            </div>
            <div className="flex items-start gap-3 p-3 border rounded-md hover:bg-muted/30 cursor-pointer">
              <RadioGroupItem value="mixed" id="el-mixed" className="mt-0.5" />
              <Label htmlFor="el-mixed" className="cursor-pointer space-y-0.5">
                <p className="font-medium text-sm">Mixed (Cash + Stock)</p>
                <p className="text-xs text-muted-foreground">
                  Partial cash + partial stock consideration. Both legs are taxable separately under Indian income tax rules.
                </p>
              </Label>
            </div>
            <div className="flex items-start gap-3 p-3 border rounded-md hover:bg-muted/30 cursor-pointer">
              <RadioGroupItem value="none" id="el-none" className="mt-0.5" />
              <Label htmlFor="el-none" className="cursor-pointer space-y-0.5">
                <p className="font-medium text-sm">No Action / Default</p>
                <p className="text-xs text-muted-foreground">
                  Accept the default outcome set by the issuer. If you do not elect, this is automatically applied.
                </p>
              </Label>
            </div>
          </RadioGroup>

          <Alert className="border-amber-200 bg-amber-50/50 py-2">
            <Info className="h-3.5 w-3.5 text-amber-600" />
            <AlertDescription className="text-xs text-amber-700">
              <strong>India Tax:</strong> Both cash and stock elections may trigger capital gains under Section 45.
              Report under <strong>Schedule FA + Schedule CG</strong> of ITR-2/3. Consult a CA before electing on high-value corporate actions.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Submitting..." : "Submit Election"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Panel ────────────────────────────────────────────────────────────────

interface CorporateActionsPanelProps {
  accountId?: string;
}

export default function CorporateActionsPanel({ accountId }: CorporateActionsPanelProps) {
  const [filterType, setFilterType] = useState("all");
  const [filterSymbol, setFilterSymbol] = useState("all");
  const [electionTarget, setElectionTarget] = useState<CorporateAction | null>(null);

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
  const voluntary = announcements.filter(a => isVoluntary(a));

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

  function renderTable(rows: CorporateAction[], showElectionButton = false) {
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
            {showElectionButton && accountId && <TableHead className="text-right">Action</TableHead>}
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
              {showElectionButton && accountId && (
                <TableCell className="text-right">
                  {isVoluntary(a) ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1"
                      onClick={() => setElectionTarget(a)}
                    >
                      <Vote className="h-3 w-3" />
                      Elect
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Auto</span>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <div className="space-y-4">
      {electionTarget && accountId && (
        <ElectionDialog
          action={electionTarget}
          accountId={accountId}
          onClose={() => setElectionTarget(null)}
        />
      )}

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
                  <SelectItem value="tender_offer">Tender Offers</SelectItem>
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
            <Tabs defaultValue={voluntary.length > 0 ? "voluntary" : portfolioActions.length > 0 ? "portfolio" : "upcoming"}>
              <div className="px-4 pt-2">
                <TabsList className="h-8 flex-wrap">
                  {voluntary.length > 0 && (
                    <TabsTrigger value="voluntary" className="text-xs gap-1">
                      <Vote className="h-3 w-3" />
                      Elect
                      <Badge className="bg-amber-100 text-amber-700 text-[10px] h-4 px-1 ml-1">{voluntary.length}</Badge>
                    </TabsTrigger>
                  )}
                  {portfolioActions.length > 0 && (
                    <TabsTrigger value="portfolio" className="text-xs gap-1">
                      My Holdings
                      <Badge className="bg-blue-100 text-blue-700 text-[10px] h-4 px-1 ml-1">{portfolioActions.length}</Badge>
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
              {voluntary.length > 0 && (
                <TabsContent value="voluntary" className="mt-0">
                  {renderTable(voluntary, true)}
                </TabsContent>
              )}
              {portfolioActions.length > 0 && (
                <TabsContent value="portfolio" className="mt-0">
                  {renderTable(portfolioActions, true)}
                </TabsContent>
              )}
              <TabsContent value="upcoming" className="mt-0">{renderTable(upcoming, true)}</TabsContent>
              <TabsContent value="past" className="mt-0">{renderTable(past)}</TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <Alert className="border-amber-200 bg-amber-50/50 py-2">
        <Info className="h-3.5 w-3.5 text-amber-600" />
        <AlertDescription className="text-xs text-amber-700">
          <strong>India Tax Note:</strong> Cash dividends from US stocks attract 25% withholding (DIVNRA) under IRS rules.
          Claim credit in India under <strong>India–US DTAA</strong> via <strong>Schedule FSI</strong> (ITR-2/3) and Form 67.
          For voluntary corporate actions (mergers, rights, tender offers) — capital gains arise on the date of receipt/allotment under Section 45.
          Consult a CA before electing on significant corporate actions.
        </AlertDescription>
      </Alert>
    </div>
  );
}
