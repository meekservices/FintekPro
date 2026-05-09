import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import {
  Grid3x3, Plus, Trash2, Share2, Eye, ChevronDown, ChevronRight,
  MessageSquare, Mail, TrendingUp, Pencil, X, CheckCircle2
} from "lucide-react";

const THEMES = [
  { value: "Technology", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "Banking", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  { value: "ESG", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "Infrastructure", color: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200" },
  { value: "Consumption", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  { value: "Small Cap", color: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200" },
  { value: "Healthcare", color: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200" },
  { value: "Global", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200" },
  { value: "Dividend", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  { value: "Custom", color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200" },
];

const INSTRUMENT_TYPES = ["stock", "mutual_fund", "etf", "bond"];

function getThemeColor(theme: string) {
  return THEMES.find((t) => t.value === theme)?.color || THEMES[THEMES.length - 1].color;
}

interface Basket {
  id: string;
  name: string;
  theme: string;
  description: string | null;
  isPublic: boolean;
  itemCount: number;
  totalAllocation: number;
  createdAt: string;
  updatedAt: string;
}

interface BasketItem {
  id: string;
  basketId: string;
  instrumentType: string;
  symbol: string | null;
  isin: string | null;
  name: string;
  allocationPercent: string;
  addedAt: string;
}

interface BasketDetail extends Basket {
  items: BasketItem[];
}

export default function AgentInvestmentBaskets() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [detailBasketId, setDetailBasketId] = useState<string | null>(null);
  const [editBasket, setEditBasket] = useState<Basket | null>(null);
  const [shareDialogBasket, setShareDialogBasket] = useState<Basket | null>(null);

  // Create form state
  const [newBasket, setNewBasket] = useState({ name: "", theme: "Custom", description: "", isPublic: false });

  // Add item form state
  const [addItemForm, setAddItemForm] = useState({ instrumentType: "stock", symbol: "", isin: "", name: "", allocationPercent: "" });

  const { data: baskets = [], isLoading } = useQuery<Basket[]>({ queryKey: ["/api/agent/baskets"] });
  const { data: basketDetail, isLoading: detailLoading } = useQuery<BasketDetail>({
    queryKey: ["/api/agent/baskets", detailBasketId],
    enabled: !!detailBasketId,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof newBasket) => apiRequest("POST", "/api/agent/baskets", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/baskets"] });
      setCreateOpen(false);
      setNewBasket({ name: "", theme: "Custom", description: "", isPublic: false });
      toast({ title: "Basket created", description: "Your investment basket is ready." });
    },
    onError: () => toast({ title: "Error", description: "Failed to create basket", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; name: string; theme: string; description: string; isPublic: boolean }) =>
      apiRequest("PUT", `/api/agent/baskets/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/baskets"] });
      setEditBasket(null);
      toast({ title: "Basket updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/agent/baskets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/baskets"] });
      setDetailBasketId(null);
      toast({ title: "Basket deleted" });
    },
  });

  const addItemMutation = useMutation({
    mutationFn: (data: typeof addItemForm & { basketId: string }) =>
      apiRequest("POST", `/api/agent/baskets/${data.basketId}/items`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/baskets", detailBasketId] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/baskets"] });
      setAddItemForm({ instrumentType: "stock", symbol: "", isin: "", name: "", allocationPercent: "" });
      toast({ title: "Instrument added" });
    },
    onError: () => toast({ title: "Error", description: "Failed to add instrument", variant: "destructive" }),
  });

  const removeItemMutation = useMutation({
    mutationFn: ({ basketId, itemId }: { basketId: string; itemId: string }) =>
      apiRequest("DELETE", `/api/agent/baskets/${basketId}/items/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/baskets", detailBasketId] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/baskets"] });
    },
  });

  const shareMutation = useMutation({
    mutationFn: (basketId: string) => apiRequest("POST", `/api/agent/baskets/${basketId}/share`),
    onSuccess: async (res: any) => {
      const data = await res.json();
      window.open(data.whatsappUrl, "_blank");
    },
    onError: () => toast({ title: "Error", description: "Failed to generate share link", variant: "destructive" }),
  });

  const totalAllocation = basketDetail?.items.reduce((sum, i) => sum + parseFloat(i.allocationPercent), 0) || 0;

  return (
    <div className="container max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Grid3x3 className="h-6 w-6 text-primary" />
            Investment Baskets
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Curated thematic portfolios to share with clients</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Create Basket
        </Button>
      </div>

      {/* Basket Gallery */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse h-48" />
          ))}
        </div>
      ) : baskets.length === 0 ? (
        <Card className="py-16">
          <CardContent className="flex flex-col items-center gap-3 text-center">
            <Grid3x3 className="h-12 w-12 text-muted-foreground" />
            <h3 className="font-semibold text-lg">No baskets yet</h3>
            <p className="text-muted-foreground text-sm max-w-sm">
              Create your first investment basket — a curated collection of instruments with defined allocations
              that you can share with clients via WhatsApp.
            </p>
            <Button onClick={() => setCreateOpen(true)} className="mt-2 gap-2">
              <Plus className="h-4 w-4" /> Create First Basket
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {baskets.map((basket) => (
            <Card key={basket.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{basket.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge className={`text-xs ${getThemeColor(basket.theme)}`}>{basket.theme}</Badge>
                      {basket.isPublic && <Badge variant="outline" className="text-xs">Public</Badge>}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {basket.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{basket.description}</p>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{basket.itemCount} instruments</span>
                  <span className={`font-medium ${parseFloat(String(basket.totalAllocation)) === 100 ? "text-green-600" : "text-amber-600"}`}>
                    {parseFloat(String(basket.totalAllocation)).toFixed(0)}% allocated
                  </span>
                </div>
                <Progress value={Math.min(parseFloat(String(basket.totalAllocation)), 100)} className="h-1" />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => setDetailBasketId(basket.id)}>
                    <Eye className="h-3 w-3" /> View
                  </Button>
                  <Button size="sm" className="flex-1 gap-1" onClick={() => shareMutation.mutate(basket.id)}>
                    <Share2 className="h-3 w-3" /> Share
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Basket Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Investment Basket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Basket Name</Label>
              <Input
                placeholder="e.g., Nifty PSU Banks"
                value={newBasket.name}
                onChange={(e) => setNewBasket((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Theme</Label>
              <Select value={newBasket.theme} onValueChange={(v) => setNewBasket((p) => ({ ...p, theme: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THEMES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                placeholder="Brief description of the basket strategy..."
                value={newBasket.description}
                onChange={(e) => setNewBasket((p) => ({ ...p, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={newBasket.isPublic}
                onCheckedChange={(v) => setNewBasket((p) => ({ ...p, isPublic: v }))}
              />
              <Label>Make publicly visible to clients</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(newBasket)} disabled={!newBasket.name || createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Basket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Basket Detail Dialog */}
      <Dialog open={!!detailBasketId} onOpenChange={(o) => !o && setDetailBasketId(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          {detailLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : basketDetail ? (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <DialogTitle className="text-xl">{basketDetail.name}</DialogTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={`text-xs ${getThemeColor(basketDetail.theme)}`}>{basketDetail.theme}</Badge>
                      {basketDetail.isPublic && <Badge variant="outline" className="text-xs">Public</Badge>}
                      <span className={`text-xs font-medium ${totalAllocation === 100 ? "text-green-600" : "text-amber-600"}`}>
                        {totalAllocation.toFixed(0)}% / 100% allocated
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => setEditBasket(basketDetail)}>
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                    <Button size="sm" className="gap-1" onClick={() => shareMutation.mutate(basketDetail.id)}>
                      <MessageSquare className="h-3 w-3" /> Share via WhatsApp
                    </Button>
                  </div>
                </div>
              </DialogHeader>

              {basketDetail.description && (
                <p className="text-sm text-muted-foreground">{basketDetail.description}</p>
              )}

              {/* Add Instrument Form */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <h4 className="font-medium text-sm">Add Instrument</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Select value={addItemForm.instrumentType} onValueChange={(v) => setAddItemForm((p) => ({ ...p, instrumentType: v }))}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INSTRUMENT_TYPES.map((t) => (
                          <SelectItem key={t} value={t} className="text-xs">{t.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Allocation %</Label>
                    <Input
                      type="number"
                      className="h-8 text-xs"
                      placeholder="e.g. 20"
                      value={addItemForm.allocationPercent}
                      onChange={(e) => setAddItemForm((p) => ({ ...p, allocationPercent: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Symbol / Ticker</Label>
                    <Input
                      className="h-8 text-xs"
                      placeholder="e.g. SBIN"
                      value={addItemForm.symbol}
                      onChange={(e) => setAddItemForm((p) => ({ ...p, symbol: e.target.value.toUpperCase() }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">ISIN (optional)</Label>
                    <Input
                      className="h-8 text-xs"
                      placeholder="INE123A01011"
                      value={addItemForm.isin}
                      onChange={(e) => setAddItemForm((p) => ({ ...p, isin: e.target.value.toUpperCase() }))}
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Full Name</Label>
                    <Input
                      className="h-8 text-xs"
                      placeholder="e.g. State Bank of India"
                      value={addItemForm.name}
                      onChange={(e) => setAddItemForm((p) => ({ ...p, name: e.target.value }))}
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={!addItemForm.name || !addItemForm.allocationPercent || addItemMutation.isPending}
                  onClick={() => addItemMutation.mutate({ ...addItemForm, basketId: basketDetail.id })}
                >
                  {addItemMutation.isPending ? "Adding..." : "Add Instrument"}
                </Button>
              </div>

              {/* Items Table */}
              {basketDetail.items.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  No instruments yet. Add instruments above to build your basket.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Symbol</TableHead>
                      <TableHead className="text-right">Allocation</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {basketDetail.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-sm">{item.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {item.instrumentType.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.symbol || item.isin || "—"}</TableCell>
                        <TableCell className="text-right font-medium">{parseFloat(item.allocationPercent).toFixed(1)}%</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive"
                            onClick={() => removeItemMutation.mutate({ basketId: basketDetail.id, itemId: item.id })}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2">
                      <TableCell colSpan={3} className="font-semibold text-sm">Total</TableCell>
                      <TableCell className={`text-right font-bold ${totalAllocation === 100 ? "text-green-600" : totalAllocation > 100 ? "text-red-600" : "text-amber-600"}`}>
                        {totalAllocation.toFixed(1)}%
                        {totalAllocation === 100 && <CheckCircle2 className="inline ml-1 h-3 w-3" />}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              )}

              <DialogFooter>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteMutation.mutate(basketDetail.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3 w-3 mr-1" /> Delete Basket
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Edit Basket Dialog */}
      <Dialog open={!!editBasket} onOpenChange={(o) => !o && setEditBasket(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Basket</DialogTitle>
          </DialogHeader>
          {editBasket && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Basket Name</Label>
                <Input value={editBasket.name} onChange={(e) => setEditBasket((p) => p ? { ...p, name: e.target.value } : p)} />
              </div>
              <div className="space-y-1.5">
                <Label>Theme</Label>
                <Select value={editBasket.theme} onValueChange={(v) => setEditBasket((p) => p ? { ...p, theme: v } : p)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {THEMES.map((t) => <SelectItem key={t.value} value={t.value}>{t.value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea rows={3} value={editBasket.description || ""} onChange={(e) => setEditBasket((p) => p ? { ...p, description: e.target.value } : p)} />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={editBasket.isPublic} onCheckedChange={(v) => setEditBasket((p) => p ? { ...p, isPublic: v } : p)} />
                <Label>Public</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBasket(null)}>Cancel</Button>
            <Button
              onClick={() => editBasket && updateMutation.mutate(editBasket)}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
