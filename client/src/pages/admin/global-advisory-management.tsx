import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  Globe, 
  Settings, 
  Shield as LucideShield, 
  ToggleLeft, 
  ToggleRight, 
  AlertTriangle, 
  Check, 
  X,
  ChevronDown,
  ChevronRight,
  Power,
  BarChart3,
  FileText
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { type Market, type MarketProduct, type FeatureFlag } from "@/hooks/use-global-advisory";

export default function GlobalAdvisoryManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [killSwitchOpen, setKillSwitchOpen] = useState(false);
  const [killSwitchReason, setKillSwitchReason] = useState("");
  const [expandedMarkets, setExpandedMarkets] = useState<Set<string>>(new Set());
  
  const { data: marketsData, isLoading: marketsLoading } = useQuery<{ success: boolean; markets: Market[] }>({
    queryKey: ["/api/global-advisory/markets", "all"],
    queryFn: async () => {
      const response = await fetch("/api/global-advisory/markets?all=true", { credentials: "include" });
      return response.json();
    },
  });
  
  const { data: productsData } = useQuery<{ success: boolean; products: MarketProduct[] }>({
    queryKey: ["/api/global-advisory/market-products"],
    queryFn: async () => {
      const response = await fetch("/api/global-advisory/market-products", { credentials: "include" });
      return response.json();
    },
  });
  
  const { data: flagsData } = useQuery<{ success: boolean; flags: FeatureFlag[] }>({
    queryKey: ["/api/global-advisory/feature-flags"],
  });
  
  const toggleMarketMutation = useMutation({
    mutationFn: async ({ marketCode, isEnabled }: { marketCode: string; isEnabled: boolean }) => {
      return apiRequest(`/api/global-advisory/markets/${marketCode}/toggle`, {
        method: "POST",
        body: JSON.stringify({ isEnabled }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/global-advisory/markets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/global-advisory/markets", "all"] });
      toast({ title: "Market Updated", description: "Market status has been updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  const toggleProductMutation = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) => {
      return apiRequest(`/api/global-advisory/market-products/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isEnabled }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/global-advisory/market-products"] });
      toast({ title: "Product Updated", description: "Product availability has been updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  const updateFlagMutation = useMutation({
    mutationFn: async ({ flagKey, updates }: { flagKey: string; updates: Partial<FeatureFlag> }) => {
      return apiRequest(`/api/global-advisory/feature-flags/${flagKey}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/global-advisory/feature-flags"] });
      toast({ title: "Feature Flag Updated", description: "Feature flag has been updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  const activateKillSwitchMutation = useMutation({
    mutationFn: async ({ flagKey, reason }: { flagKey: string; reason: string }) => {
      return apiRequest(`/api/global-advisory/feature-flags/${flagKey}/kill`, {
        method: "POST",
        body: JSON.stringify({ reason }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/global-advisory/feature-flags"] });
      setKillSwitchOpen(false);
      setKillSwitchReason("");
      toast({ 
        title: "Kill Switch Activated", 
        description: "Global Advisory features have been disabled",
        variant: "destructive"
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  const markets = marketsData?.markets || [];
  const products = productsData?.products || [];
  const flags = flagsData?.flags || [];
  
  const groupedMarkets = markets.reduce((acc, market) => {
    const phase = `Phase ${market.rolloutPhase}`;
    if (!acc[phase]) acc[phase] = [];
    acc[phase].push(market);
    return acc;
  }, {} as Record<string, Market[]>);
  
  const getProductsForMarket = (marketCode: string) => {
    return products.filter(p => p.marketCode === marketCode);
  };
  
  const toggleMarketExpanded = (marketCode: string) => {
    setExpandedMarkets(prev => {
      const next = new Set(prev);
      if (next.has(marketCode)) {
        next.delete(marketCode);
      } else {
        next.add(marketCode);
      }
      return next;
    });
  };
  
  const killSwitch = flags.find(f => f.flagKey === "GLOBAL_ADVISORY_KILL_SWITCH");
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Global Advisory Management</h1>
            <p className="text-muted-foreground">Manage markets, products, and feature flags</p>
          </div>
        </div>
        
        <Button 
          variant="destructive" 
          onClick={() => setKillSwitchOpen(true)}
          disabled={killSwitch?.killSwitchActivatedAt !== null}
          data-testid="button-kill-switch"
        >
          <Power className="h-4 w-4 mr-2" />
          Emergency Kill Switch
        </Button>
      </div>
      
      {killSwitch?.killSwitchActivatedAt && (
        <Card className="border-destructive dark:border-red-700 bg-destructive/10 dark:bg-red-950/30">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-6 w-6 text-destructive dark:text-red-400" />
            <div>
              <div className="font-semibold text-destructive dark:text-red-300">Global Advisory is DISABLED</div>
              <div className="text-sm text-muted-foreground dark:text-red-200/70">
                Reason: {killSwitch.killSwitchReason || "No reason provided"}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <Tabs defaultValue="markets" data-testid="admin-tabs">
        <TabsList>
          <TabsTrigger value="markets" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Markets
          </TabsTrigger>
          <TabsTrigger value="flags" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Feature Flags
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Audit Logs
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="markets" className="space-y-4">
          {Object.entries(groupedMarkets).map(([phase, phaseMarkets]) => (
            <Card key={phase}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge variant={phase === "Phase 1" ? "default" : "secondary"}>{phase}</Badge>
                  <span>{phaseMarkets.length} Markets</span>
                </CardTitle>
                <CardDescription>
                  {phase === "Phase 1" ? "Initial rollout markets" : "Upcoming expansion markets"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {phaseMarkets.map((market) => {
                    const marketProducts = getProductsForMarket(market.marketCode);
                    const isExpanded = expandedMarkets.has(market.marketCode);
                    
                    return (
                      <Collapsible key={market.marketCode} open={isExpanded} onOpenChange={() => toggleMarketExpanded(market.marketCode)}>
                        <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30/20">
                          <div className="flex items-center gap-4">
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" data-testid={`expand-${market.marketCode}`}>
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </Button>
                            </CollapsibleTrigger>
                            <span className="text-2xl">{market.flagEmoji}</span>
                            <div>
                              <div className="font-medium">{market.marketName}</div>
                              <div className="text-sm text-muted-foreground">
                                {market.marketCode} | {market.baseCurrency} | {market.regulatoryBody}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <Badge variant={market.advisoryLevel === "FULL" ? "default" : "secondary"}>
                              {market.advisoryLevel === "FULL" ? (
                                <><LucideShield className="h-3 w-3 mr-1" /> Full</>
                              ) : (
                                <><BarChart3 className="h-3 w-3 mr-1" /> Analytics</>
                              )}
                            </Badge>
                            
                            <Badge variant={market.executionAllowed ? "default" : "outline"}>
                              {market.executionAllowed ? "Execution" : "No Execution"}
                            </Badge>
                            
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={market.isEnabled}
                                onCheckedChange={(checked) => toggleMarketMutation.mutate({ marketCode: market.marketCode, isEnabled: checked })}
                                disabled={toggleMarketMutation.isPending}
                                data-testid={`toggle-market-${market.marketCode}`}
                              />
                              <Label className="text-sm">
                                {market.isEnabled ? "Enabled" : "Disabled"}
                              </Label>
                            </div>
                          </div>
                        </div>
                        
                        <CollapsibleContent className="mt-2 ml-12">
                          <Card>
                            <CardHeader className="py-3">
                              <CardTitle className="text-sm">Product Availability</CardTitle>
                            </CardHeader>
                            <CardContent>
                              {marketProducts.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No products configured</p>
                              ) : (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Category</TableHead>
                                      <TableHead>Sub-Category</TableHead>
                                      <TableHead>Advisory Level</TableHead>
                                      <TableHead>Risk</TableHead>
                                      <TableHead>Restrictions</TableHead>
                                      <TableHead className="text-right">Enabled</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {marketProducts.map((product) => (
                                      <TableRow key={product.id}>
                                        <TableCell className="capitalize">{product.productCategory.replace("_", " ")}</TableCell>
                                        <TableCell>{product.productSubCategory || "-"}</TableCell>
                                        <TableCell>
                                          <Badge variant={product.advisoryLevel === "FULL" ? "default" : "secondary"} className="text-xs">
                                            {product.advisoryLevel}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="capitalize">{product.riskCategory || "-"}</TableCell>
                                        <TableCell>
                                          {product.etfOnlyRestriction && <Badge variant="outline" className="text-xs">ETF Only</Badge>}
                                          {product.requiresAccreditedInvestor && <Badge variant="outline" className="text-xs ml-1">Accredited</Badge>}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          <Switch
                                            checked={product.isEnabled}
                                            onCheckedChange={(checked) => toggleProductMutation.mutate({ id: product.id, isEnabled: checked })}
                                            disabled={toggleProductMutation.isPending}
                                            data-testid={`toggle-product-${product.id}`}
                                          />
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              )}
                            </CardContent>
                          </Card>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
        
        <TabsContent value="flags" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Feature Flags</CardTitle>
              <CardDescription>Control Global Advisory features</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Flag</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Environments</TableHead>
                    <TableHead>Kill Switch</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flags.map((flag) => (
                    <TableRow key={flag.id}>
                      <TableCell className="font-mono text-sm text-foreground">{flag.flagKey}</TableCell>
                      <TableCell className="max-w-xs truncate text-foreground">{flag.description || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{flag.category || "general"}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {flag.enabledEnvironments?.map(env => (
                            <Badge key={env} variant="secondary" className="text-xs">{env}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {flag.isKillSwitch ? (
                          flag.killSwitchActivatedAt ? (
                            <Badge variant="destructive">ACTIVATED</Badge>
                          ) : (
                            <Badge variant="outline">Ready</Badge>
                          )
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Switch
                          checked={flag.isEnabled}
                          onCheckedChange={(checked) => updateFlagMutation.mutate({ flagKey: flag.flagKey, updates: { isEnabled: checked } })}
                          disabled={updateFlagMutation.isPending || (flag.isKillSwitch && flag.killSwitchActivatedAt !== null)}
                          data-testid={`toggle-flag-${flag.flagKey}`}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="audit" className="space-y-4">
          <AuditLogsSection />
        </TabsContent>
      </Tabs>
      
      <Dialog open={killSwitchOpen} onOpenChange={setKillSwitchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Activate Kill Switch
            </DialogTitle>
            <DialogDescription>
              This will immediately disable all Global Advisory features. This action is logged and requires justification.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Reason for activation *</Label>
              <Textarea
                placeholder="Provide a detailed reason for activating the kill switch..."
                value={killSwitchReason}
                onChange={(e) => setKillSwitchReason(e.target.value)}
                className="mt-2"
                data-testid="input-kill-switch-reason"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setKillSwitchOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => activateKillSwitchMutation.mutate({ flagKey: "GLOBAL_ADVISORY_KILL_SWITCH", reason: killSwitchReason })}
              disabled={!killSwitchReason.trim() || activateKillSwitchMutation.isPending}
              data-testid="button-confirm-kill-switch"
            >
              {activateKillSwitchMutation.isPending ? "Activating..." : "Activate Kill Switch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AuditLogsSection() {
  const [filters, setFilters] = useState({ userId: "", marketCode: "", eventType: "" });
  
  const { data: logsData, isLoading } = useQuery({
    queryKey: ["/api/global-advisory/audit-logs", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.userId) params.set("userId", filters.userId);
      if (filters.marketCode) params.set("marketCode", filters.marketCode);
      if (filters.eventType) params.set("eventType", filters.eventType);
      params.set("limit", "50");
      
      const response = await fetch(`/api/global-advisory/audit-logs?${params}`, { credentials: "include" });
      return response.json();
    },
  });
  
  const logs = logsData?.logs || [];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Logs</CardTitle>
        <CardDescription>View Global Advisory activity for SEBI compliance</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <Input
            placeholder="User ID"
            value={filters.userId}
            onChange={(e) => setFilters(f => ({ ...f, userId: e.target.value }))}
            className="max-w-xs"
            data-testid="filter-user-id"
          />
          <Input
            placeholder="Market Code"
            value={filters.marketCode}
            onChange={(e) => setFilters(f => ({ ...f, marketCode: e.target.value }))}
            className="max-w-xs"
            data-testid="filter-market-code"
          />
          <Input
            placeholder="Event Type"
            value={filters.eventType}
            onChange={(e) => setFilters(f => ({ ...f, eventType: e.target.value }))}
            className="max-w-xs"
            data-testid="filter-event-type"
          />
        </div>
        
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading audit logs...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No audit logs found</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Market</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm text-foreground">
                    {new Date(log.eventTimestamp).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.eventType}</Badge>
                    {log.eventSubType && (
                      <span className="ml-2 text-xs text-muted-foreground">{log.eventSubType}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-foreground">{log.marketCode || "-"}</TableCell>
                  <TableCell className="font-mono text-xs text-foreground">{log.userId || "Anonymous"}</TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                    {log.eventData ? JSON.stringify(log.eventData) : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
