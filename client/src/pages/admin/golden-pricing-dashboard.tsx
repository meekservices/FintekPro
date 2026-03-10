import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Search,
  Activity,
  AlertTriangle,
  History,
  Play,
  Layers,
  CheckCircle,
  XCircle,
  RefreshCw,
  Clock,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface GoldenPrice {
  isin: string;
  symbol: string;
  date: string;
  assetClass: string;
  price: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  changePercent?: number;
  source: string;
  confidence: number;
  isValidated: boolean;
  isFlagged: boolean;
  flagReason?: string;
  previousPrice?: number;
  deviationPct?: number;
  currency: string;
  updatedAt: string;
}

interface PriceAudit {
  id: number;
  isin: string;
  price_date: string;
  old_price?: string;
  new_price: string;
  old_source?: string;
  new_source: string;
  change_reason: string;
  changed_by: string;
  confidence_score: number;
  created_at: string;
}

export default function GoldenPricingDashboard() {
  const { toast } = useToast();
  const [searchIsin, setSearchIsin] = useState("");
  const [auditIsin, setAuditIsin] = useState("");
  const [overrideData, setOverrideData] = useState<{
    isin: string;
    priceDate: string;
    price: string;
    reason: string;
  } | null>(null);

  // 1. Live Price Search
  const { data: searchResult, isLoading: isSearching, refetch: refetchSearch } = useQuery<GoldenPrice>({
    queryKey: ["/api/pricing", searchIsin],
    enabled: false,
  });

  // 2. Engine Stats
  const { data: stats, isLoading: isLoadingStats, refetch: refetchStats } = useQuery<{
    date: string;
    byAssetClass: any[];
    auditEntriesTotal: number;
  }>({
    queryKey: ["/api/pricing/stats"],
  });

  // 3. Flagged Prices
  const { data: flaggedData, isLoading: isLoadingFlagged, refetch: refetchFlagged } = useQuery<{
    count: number;
    flagged: any[];
  }>({
    queryKey: ["/api/pricing/flagged"],
  });

  // 4. Audit Trail
  const { data: auditData, isLoading: isLoadingAudit, refetch: refetchAudit } = useQuery<{
    isin: string;
    count: number;
    audit: PriceAudit[];
  }>({
    queryKey: ["/api/pricing/audit", auditIsin],
    enabled: false,
  });

  const runDailyMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/pricing/run-daily", {}),
    onSuccess: () => {
      toast({ title: "Pricing Run Started", description: "Daily golden pricing run has been initiated." });
    },
    onError: (e: any) => toast({ title: "Run Failed", description: e.message, variant: "destructive" }),
  });

  const overrideMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/pricing/override", data),
    onSuccess: () => {
      toast({ title: "Price Overridden", description: "The price has been manually updated and audited." });
      setOverrideData(null);
      refetchFlagged();
      if (searchIsin) refetchSearch();
    },
    onError: (e: any) => toast({ title: "Override Failed", description: e.message, variant: "destructive" }),
  });

  const batchFetchMutation = useMutation({
    mutationFn: async (isins: string[]) => apiRequest("POST", "/api/pricing/batch", { isins }),
    onSuccess: () => {
      toast({ title: "Batch Fetch Complete", description: "Price sync for selected ISINs is complete." });
    },
    onError: (e: any) => toast({ title: "Batch Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Golden Pricing Engine</h1>
          <p className="text-muted-foreground">Bloomberg-grade institutional pricing dashboard</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => batchFetchMutation.mutate(["INE001A01036"])}>
            <Layers className="mr-2 h-4 w-4" /> Batch Sync
          </Button>
          <Button onClick={() => runDailyMutation.mutate()} disabled={runDailyMutation.isPending}>
            <Play className="mr-2 h-4 w-4" /> Run Daily Engine
          </Button>
        </div>
      </div>

      <Tabs defaultValue="live" className="space-y-4">
        <TabsList>
          <TabsTrigger value="live">
            <Search className="mr-2 h-4 w-4" /> Live Prices
          </TabsTrigger>
          <TabsTrigger value="stats">
            <Activity className="mr-2 h-4 w-4" /> Engine Stats
          </TabsTrigger>
          <TabsTrigger value="flagged">
            <AlertTriangle className="mr-2 h-4 w-4" /> Flagged Prices
          </TabsTrigger>
          <TabsTrigger value="audit">
            <History className="mr-2 h-4 w-4" /> Audit Trail
          </TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>ISIN Lookup</CardTitle>
              <CardDescription>Search for the latest golden price of any instrument</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Input
                  placeholder="Enter ISIN (e.g. INE001A01036)"
                  value={searchIsin}
                  onChange={(e) => setSearchIsin(e.target.value.toUpperCase())}
                  className="max-w-xs"
                />
                <Button onClick={() => refetchSearch()} disabled={!searchIsin || isSearching}>
                  {isSearching ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  Fetch Price
                </Button>
              </div>

              {searchResult && (
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Latest Price (INR)</CardDescription>
                      <CardTitle className="text-3xl font-bold">₹{searchResult.price.toLocaleString()}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <Badge variant={searchResult.changePercent && searchResult.changePercent >= 0 ? "default" : "destructive"}>
                          {searchResult.changePercent}%
                        </Badge>
                        <span className="text-xs text-muted-foreground">vs previous</span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Source & Confidence</CardDescription>
                      <CardTitle className="text-xl">{searchResult.source}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span>Confidence Score</span>
                          <span>{searchResult.confidence}/100</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full"
                            style={{ width: `${searchResult.confidence}%` }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Status</CardDescription>
                      <div className="flex gap-2 items-center">
                        {searchResult.isValidated ? (
                          <Badge className="bg-green-500"><CheckCircle className="mr-1 h-3 w-3" /> Validated</Badge>
                        ) : (
                          <Badge variant="outline"><Clock className="mr-1 h-3 w-3" /> Pending</Badge>
                        )}
                        {searchResult.isFlagged && (
                          <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" /> Flagged</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">Last Updated: {new Date(searchResult.updatedAt).toLocaleString()}</p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Covered</CardDescription>
                <CardTitle className="text-2xl font-bold">
                  {stats?.byAssetClass.reduce((acc, curr) => acc + parseInt(curr.total), 0) || 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Validated</CardDescription>
                <CardTitle className="text-2xl font-bold text-green-600">
                  {stats?.byAssetClass.reduce((acc, curr) => acc + parseInt(curr.validated), 0) || 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Flagged</CardDescription>
                <CardTitle className="text-2xl font-bold text-red-600">
                  {stats?.byAssetClass.reduce((acc, curr) => acc + parseInt(curr.flagged), 0) || 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Audit Trail Entries</CardDescription>
                <CardTitle className="text-2xl font-bold">{stats?.auditEntriesTotal || 0}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Source Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset Class</TableHead>
                    <TableHead>NSE</TableHead>
                    <TableHead>AMFI</TableHead>
                    <TableHead>FMP</TableHead>
                    <TableHead>Model/Broker</TableHead>
                    <TableHead>Avg Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingStats ? (
                    <TableRow><TableCell colSpan={6}><Skeleton className="h-20 w-full" /></TableCell></TableRow>
                  ) : stats?.byAssetClass.map((row: any) => (
                    <TableRow key={row.asset_class}>
                      <TableCell className="font-medium uppercase">{row.asset_class}</TableCell>
                      <TableCell>{row.from_nse}</TableCell>
                      <TableCell>{row.from_amfi}</TableCell>
                      <TableCell>{row.from_fmp}</TableCell>
                      <TableCell>{parseInt(row.from_model) + parseInt(row.from_broker_quote)}</TableCell>
                      <TableCell>{row.avg_confidence}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flagged" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Flagged Prices</CardTitle>
              <CardDescription>Instruments with price deviations {">"} 20% or unusual data patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ISIN</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Prev Price</TableHead>
                    <TableHead>Deviation</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingFlagged ? (
                    <TableRow><TableCell colSpan={6}><Skeleton className="h-20 w-full" /></TableCell></TableRow>
                  ) : flaggedData?.flagged.map((row: any) => (
                    <TableRow key={row.isin}>
                      <TableCell className="font-mono text-xs">{row.isin}</TableCell>
                      <TableCell>₹{row.price}</TableCell>
                      <TableCell>₹{row.previous_price || 'N/A'}</TableCell>
                      <TableCell className="text-red-500 font-bold">{row.deviation_pct}%</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate" title={row.flag_reason}>
                        {row.flag_reason}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setOverrideData({
                            isin: row.isin,
                            priceDate: row.price_date,
                            price: row.price.toString(),
                            reason: ""
                          })}
                        >
                          Override
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Regulatory Audit Trail</CardTitle>
              <CardDescription>Full price provenance history for SEBI/RBI compliance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-6">
                <Input
                  placeholder="Enter ISIN"
                  value={auditIsin}
                  onChange={(e) => setAuditIsin(e.target.value.toUpperCase())}
                  className="max-w-xs"
                />
                <Button onClick={() => refetchAudit()} disabled={!auditIsin || isLoadingAudit}>
                  View Audit History
                </Button>
              </div>

              {auditData && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Old Price</TableHead>
                      <TableHead>New Price</TableHead>
                      <TableHead>Old Source</TableHead>
                      <TableHead>New Source</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>User</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditData.audit.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-xs">{new Date(entry.created_at).toLocaleString()}</TableCell>
                        <TableCell>₹{entry.old_price || '—'}</TableCell>
                        <TableCell className="font-bold">₹{entry.new_price}</TableCell>
                        <TableCell className="text-xs">{entry.old_source || '—'}</TableCell>
                        <TableCell className="text-xs font-medium">{entry.new_source}</TableCell>
                        <TableCell className="text-xs italic max-w-[150px] truncate" title={entry.change_reason}>
                          {entry.change_reason}
                        </TableCell>
                        <TableCell className="text-xs">{entry.changed_by}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!overrideData} onOpenChange={() => setOverrideData(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual Price Override</DialogTitle>
          </DialogHeader>
          {overrideData && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>ISIN</Label>
                <Input value={overrideData.isin} disabled />
              </div>
              <div className="space-y-2">
                <Label>Correct Price (INR)</Label>
                <Input
                  type="number"
                  value={overrideData.price}
                  onChange={(e) => setOverrideData({ ...overrideData, price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Reason for Override (Regulatory Mandatory)</Label>
                <Textarea
                  placeholder="e.g. Verified with Bloomberg terminal due to NSE feed anomaly"
                  value={overrideData.reason}
                  onChange={(e) => setOverrideData({ ...overrideData, reason: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideData(null)}>Cancel</Button>
            <Button
              onClick={() => overrideMutation.mutate(overrideData)}
              disabled={!overrideData?.reason || overrideMutation.isPending}
            >
              Submit Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
