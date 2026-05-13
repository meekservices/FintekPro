import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  CreditCard, Star, Gift, Plane, ShoppingBag, Fuel,
  DollarSign, Percent, LucideShield as LucideShield, Check, Search, Filter,
  AlertCircle, Wallet, Zap, ChevronRight, ExternalLink,
  Building2, Info, TrendingUp
} from "lucide-react";

interface M2PCardProduct {
  productId: string;
  name: string;
  issuerBank: string;
  network: "visa" | "mastercard" | "rupay";
  cardType: string;
  annualFee: number;
  joiningFee: number;
  feeWaiverSpend?: number;
  rewardRate: string;
  features: string[];
  benefits: string[];
  eligibility: { minIncome: number; minCreditScore: number };
  programId: string;
}

interface EligibilityResult {
  eligible: boolean;
  preApprovedLimit?: number;
  recommendedCards: M2PCardProduct[];
  reasons?: string[];
  referenceId: string;
}

function getNetworkBadgeColor(network: string) {
  switch (network) {
    case "visa":       return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200";
    case "mastercard": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200";
    case "rupay":      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200";
    default:           return "";
  }
}

function getCardTypeIcon(cardType: string) {
  const lower = cardType.toLowerCase();
  if (lower.includes("premium") || lower.includes("super")) return <Star className="h-5 w-5 text-yellow-500" />;
  if (lower.includes("cashback")) return <DollarSign className="h-5 w-5 text-green-500" />;
  if (lower.includes("travel"))   return <Plane className="h-5 w-5 text-blue-500" />;
  if (lower.includes("shop") || lower.includes("lifestyle")) return <ShoppingBag className="h-5 w-5 text-purple-500" />;
  if (lower.includes("wealth"))   return <Wallet className="h-5 w-5 text-indigo-500" />;
  return <CreditCard className="h-5 w-5 text-primary" />;
}

function CardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32 mt-1" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex gap-2">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 flex-1" />
        </div>
      </CardContent>
    </Card>
  );
}

function CardDetailDialog({ card, onClose, onEligibilityCheck }: {
  card: M2PCardProduct | null;
  onClose: () => void;
  onEligibilityCheck: (card: M2PCardProduct) => void;
}) {
  if (!card) return null;
  return (
    <Dialog open={!!card} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {getCardTypeIcon(card.cardType)}
            <div>
              <DialogTitle>{card.name}</DialogTitle>
              <DialogDescription>{card.issuerBank} · {card.network.toUpperCase()}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-muted-foreground text-xs">Joining Fee</p>
              <p className="font-bold text-lg">₹{card.joiningFee.toLocaleString("en-IN")}</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-muted-foreground text-xs">Annual Fee</p>
              <p className="font-bold text-lg">₹{card.annualFee.toLocaleString("en-IN")}</p>
            </div>
          </div>
          {card.feeWaiverSpend && (
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/30 p-3 rounded-lg">
              <Check className="h-4 w-4 flex-shrink-0" />
              Fee waived on annual spend of ₹{(card.feeWaiverSpend / 100000).toFixed(0)}L
            </div>
          )}
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Rewards</p>
            <p className="font-medium text-sm">{card.rewardRate}</p>
          </div>
          <div>
            <p className="text-sm font-semibold mb-2">Key Features</p>
            <ul className="space-y-1.5">
              {card.features.map((f, i) => (
                <li key={i} className="text-sm flex gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold mb-2">Benefits</p>
            <ul className="space-y-1.5">
              {card.benefits.map((b, i) => (
                <li key={i} className="text-sm flex gap-2">
                  <Zap className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm border rounded-lg p-3">
            <div>
              <p className="text-xs text-muted-foreground">Min. Annual Income</p>
              <p className="font-semibold">₹{(card.eligibility.minIncome / 100000).toFixed(1)}L</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Min. CIBIL Score</p>
              <p className="font-semibold">{card.eligibility.minCreditScore}</p>
            </div>
          </div>
        </div>
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Close</Button>
          <Button onClick={() => { onClose(); onEligibilityCheck(card); }} className="flex-1">
            Check Eligibility
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EligibilityDialog({ card, onClose }: { card: M2PCardProduct | null; onClose: () => void }) {
  const { toast } = useToast();
  const [pan, setPan] = useState("");
  const [mobile, setMobile] = useState("");
  const [income, setIncome] = useState("");
  const [employment, setEmployment] = useState("salaried");
  const [result, setResult] = useState<EligibilityResult | null>(null);

  const checkMutation = useMutation({
    mutationFn: () => apiRequest("/api/cards/eligibility", "POST", {
      pan: pan.toUpperCase(),
      mobile,
      annualIncome: Number(income),
      employmentType: employment,
    }),
    onSuccess: (data: any) => {
      setResult(data);
    },
    onError: (err: any) => {
      toast({ title: "Eligibility check failed", description: err.message, variant: "destructive" });
    },
  });

  const handleClose = () => {
    setResult(null);
    setPan(""); setMobile(""); setIncome(""); setEmployment("salaried");
    onClose();
  };

  return (
    <Dialog open={!!card} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {result ? (result.eligible ? "You're Eligible!" : "Not Eligible Yet") : "Check Eligibility"}
          </DialogTitle>
          <DialogDescription>
            {card ? `${card.name} · ${card.issuerBank}` : "Soft pull — no CIBIL impact"}
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>PAN Number</Label>
              <Input placeholder="ABCDE1234F" value={pan} onChange={e => setPan(e.target.value.toUpperCase())} maxLength={10} />
            </div>
            <div className="space-y-1">
              <Label>Mobile Number</Label>
              <Input placeholder="9876543210" value={mobile} onChange={e => setMobile(e.target.value)} maxLength={10} />
            </div>
            <div className="space-y-1">
              <Label>Annual Income (₹)</Label>
              <Input placeholder="600000" type="number" value={income} onChange={e => setIncome(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Employment Type</Label>
              <Select value={employment} onValueChange={setEmployment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="salaried">Salaried</SelectItem>
                  <SelectItem value="self_employed">Self Employed</SelectItem>
                  <SelectItem value="business">Business Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground flex gap-1.5">
              <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              This is a soft check only and will not impact your CIBIL score.
            </p>
            <DialogFooter>
              <Button
                className="w-full"
                onClick={() => checkMutation.mutate()}
                disabled={!pan || !mobile || !income || checkMutation.isPending}
              >
                {checkMutation.isPending ? "Checking…" : "Check Eligibility"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {result.eligible ? (
              <>
                <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg text-center">
                  <Check className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="font-semibold text-green-800 dark:text-green-200">Pre-Approved!</p>
                  {result.preApprovedLimit && (
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">
                      Up to ₹{result.preApprovedLimit.toLocaleString("en-IN")}
                    </p>
                  )}
                  <p className="text-xs text-green-700/70 dark:text-green-300/70 mt-1">Pre-approved credit limit</p>
                </div>
                <div>
                  <p className="text-sm font-semibold mb-2">Recommended Cards ({result.recommendedCards.length})</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {result.recommendedCards.map(c => (
                      <div key={c.productId} className="flex items-center justify-between p-2 border rounded-lg text-sm">
                        <div>
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.issuerBank}</p>
                        </div>
                        <Badge className={getNetworkBadgeColor(c.network)}>{c.network.toUpperCase()}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
                <Button className="w-full" onClick={() => {
                  toast({ title: "Application submitted", description: "Our team will contact you within 24 hours to complete your application." });
                  handleClose();
                }}>
                  Proceed to Apply
                </Button>
              </>
            ) : (
              <>
                <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-center">
                  <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                  <p className="font-semibold text-red-800 dark:text-red-200">Not eligible at this time</p>
                </div>
                {result.reasons && (
                  <ul className="space-y-1">
                    {result.reasons.map((r, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex gap-2">
                        <ChevronRight className="h-4 w-4 flex-shrink-0" />
                        {r}
                      </li>
                    ))}
                  </ul>
                )}
                <Button variant="outline" className="w-full" onClick={handleClose}>Close</Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function CreditCardsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery]           = useState("");
  const [networkFilter, setNetworkFilter]       = useState("all");
  const [feeFilter, setFeeFilter]               = useState("all");
  const [detailCard, setDetailCard]             = useState<M2PCardProduct | null>(null);
  const [eligibilityCard, setEligibilityCard]   = useState<M2PCardProduct | null>(null);

  const { data, isLoading, error } = useQuery<{
    success: boolean;
    configured: boolean;
    total: number;
    products: M2PCardProduct[];
  }>({
    queryKey: ["/api/cards/products"],
  });

  const allCards = data?.products ?? [];

  const filteredCards = allCards.filter(card => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || card.name.toLowerCase().includes(q) || card.issuerBank.toLowerCase().includes(q) || card.cardType.toLowerCase().includes(q);
    const matchesNetwork = networkFilter === "all" || card.network === networkFilter;
    const matchesFee =
      feeFilter === "all" ? true :
      feeFilter === "free" ? card.annualFee === 0 :
      feeFilter === "low"  ? card.annualFee > 0 && card.annualFee <= 1000 :
      feeFilter === "mid"  ? card.annualFee > 1000 && card.annualFee <= 5000 :
      card.annualFee > 5000;
    return matchesSearch && matchesNetwork && matchesFee;
  });

  const premiumCards  = allCards.filter(c => c.cardType.toLowerCase().includes("premium") || c.cardType.toLowerCase().includes("super") || c.cardType.toLowerCase().includes("wealth"));
  const cashbackCards = allCards.filter(c => c.cardType.toLowerCase().includes("cashback"));
  const lifestyleCards = allCards.filter(c => !premiumCards.includes(c) && !cashbackCards.includes(c));

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <CreditCard className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Credit Cards</h1>
            <p className="text-muted-foreground">Compare and apply for credit cards — powered by M2P Fintech</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <Badge variant="outline" className="text-xs gap-1">
            <Building2 className="h-3 w-3" />
            {allCards.length} cards available
          </Badge>
          {data && !data.configured && (
            <Badge variant="secondary" className="text-xs gap-1">
              <Info className="h-3 w-3" />
              Demo catalog · Partner with M2P to go live
            </Badge>
          )}
          {data?.configured && (
            <Badge className="text-xs gap-1 bg-green-600">
              <Check className="h-3 w-3" />
              Live via M2P Fintech
            </Badge>
          )}
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search card name or bank…"
            className="pl-10"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={networkFilter} onValueChange={setNetworkFilter}>
          <SelectTrigger className="w-40">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Network" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Networks</SelectItem>
            <SelectItem value="visa">Visa</SelectItem>
            <SelectItem value="mastercard">Mastercard</SelectItem>
            <SelectItem value="rupay">RuPay</SelectItem>
          </SelectContent>
        </Select>
        <Select value={feeFilter} onValueChange={setFeeFilter}>
          <SelectTrigger className="w-44">
            <Percent className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Annual Fee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any Fee</SelectItem>
            <SelectItem value="free">Free (₹0)</SelectItem>
            <SelectItem value="low">Low (≤ ₹1,000)</SelectItem>
            <SelectItem value="mid">Mid (₹1K–₹5K)</SelectItem>
            <SelectItem value="high">Premium (₹5K+)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="all-cards" className="space-y-6">
        <ScrollableTabsList>
          <TabsTrigger value="all-cards">
            <CreditCard className="h-4 w-4 mr-2" />
            All Cards
          </TabsTrigger>
          <TabsTrigger value="premium">
            <Star className="h-4 w-4 mr-2" />
            Premium
          </TabsTrigger>
          <TabsTrigger value="cashback">
            <DollarSign className="h-4 w-4 mr-2" />
            Cashback
          </TabsTrigger>
          <TabsTrigger value="lifestyle">
            <ShoppingBag className="h-4 w-4 mr-2" />
            Lifestyle
          </TabsTrigger>
          <TabsTrigger value="compare">
            <TrendingUp className="h-4 w-4 mr-2" />
            Compare
          </TabsTrigger>
          <TabsTrigger value="eligibility">
            <LucideShield className="h-4 w-4 mr-2" />
            Check Eligibility
          </TabsTrigger>
        </ScrollableTabsList>

        {/* ── ALL CARDS ─────────────────────────────────────────── */}
        <TabsContent value="all-cards">
          {isLoading ? (
            <div className="grid md:grid-cols-2 gap-6">
              {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-destructive p-4">
              <AlertCircle className="h-5 w-5" />
              <p>Failed to load cards. Please try again.</p>
            </div>
          ) : (
            <>
              {filteredCards.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No cards match your filters</p>
                </div>
              )}
              <div className="grid md:grid-cols-2 gap-6">
                {filteredCards.map(card => (
                  <Card key={card.productId} className="hover:shadow-lg transition-shadow group">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {getCardTypeIcon(card.cardType)}
                          <div>
                            <CardTitle className="text-lg leading-tight">{card.name}</CardTitle>
                            <CardDescription>{card.issuerBank}</CardDescription>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 items-end">
                          <Badge className={getNetworkBadgeColor(card.network)}>{card.network.toUpperCase()}</Badge>
                          <Badge variant="outline" className="text-xs">{card.cardType}</Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Joining Fee</p>
                          <p className="font-semibold">
                            {card.joiningFee === 0 ? <span className="text-green-600">Free</span> : `₹${card.joiningFee.toLocaleString("en-IN")}`}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Annual Fee</p>
                          <p className="font-semibold">
                            {card.annualFee === 0 ? <span className="text-green-600">Free</span> : `₹${card.annualFee.toLocaleString("en-IN")}`}
                          </p>
                        </div>
                      </div>

                      <div className="p-2.5 bg-primary/5 border border-primary/15 rounded-lg">
                        <p className="text-xs text-muted-foreground">Rewards</p>
                        <p className="text-sm font-medium text-primary">{card.rewardRate}</p>
                      </div>

                      <div className="space-y-1">
                        {card.features.slice(0, 3).map((f, i) => (
                          <div key={i} className="flex gap-2 text-xs text-muted-foreground">
                            <Check className="h-3.5 w-3.5 text-green-600 flex-shrink-0 mt-0.5" />
                            {f}
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs border rounded p-2">
                        <div>
                          <p className="text-muted-foreground">Min. Income</p>
                          <p className="font-medium">₹{(card.eligibility.minIncome / 100000).toFixed(0)}L/yr</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Min. CIBIL</p>
                          <p className="font-medium">{card.eligibility.minCreditScore}</p>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => setDetailCard(card)}
                        >
                          Details
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => setEligibilityCard(card)}
                        >
                          Apply Now
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* ── PREMIUM ───────────────────────────────────────────── */}
        <TabsContent value="premium">
          <div className="grid md:grid-cols-2 gap-6">
            {isLoading ? [...Array(3)].map((_, i) => <CardSkeleton key={i} />) :
            premiumCards.map(card => (
              <Card key={card.productId} className="border-yellow-200 dark:border-yellow-800 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Star className="h-6 w-6 text-yellow-500" />
                      <div>
                        <CardTitle>{card.name}</CardTitle>
                        <CardDescription>{card.issuerBank}</CardDescription>
                      </div>
                    </div>
                    <Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200">
                      {card.cardType}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-2.5 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground">Annual Fee</p>
                      <p className="font-bold">₹{card.annualFee.toLocaleString("en-IN")}</p>
                    </div>
                    <div className="p-2.5 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground">Min. CIBIL</p>
                      <p className="font-bold">{card.eligibility.minCreditScore}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {card.benefits.map((b, i) => (
                      <div key={i} className="flex gap-2 text-sm">
                        <Zap className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                        {b}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setDetailCard(card)}>Details</Button>
                    <Button size="sm" className="flex-1" onClick={() => setEligibilityCard(card)}>Apply</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── CASHBACK ──────────────────────────────────────────── */}
        <TabsContent value="cashback">
          <div className="grid md:grid-cols-2 gap-6">
            {isLoading ? [...Array(2)].map((_, i) => <CardSkeleton key={i} />) :
            cashbackCards.map(card => (
              <Card key={card.productId} className="border-green-200 dark:border-green-800 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <DollarSign className="h-6 w-6 text-green-500" />
                      <div>
                        <CardTitle>{card.name}</CardTitle>
                        <CardDescription>{card.issuerBank}</CardDescription>
                      </div>
                    </div>
                    <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">Cashback</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg text-center">
                    <p className="font-semibold text-green-900 dark:text-green-100">{card.rewardRate}</p>
                  </div>
                  {card.annualFee === 0 && (
                    <Badge className="bg-green-600 text-white">Lifetime Free</Badge>
                  )}
                  <div className="space-y-1">
                    {card.features.map((f, i) => (
                      <div key={i} className="flex gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setDetailCard(card)}>Details</Button>
                    <Button size="sm" className="flex-1" onClick={() => setEligibilityCard(card)}>Apply</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── LIFESTYLE ─────────────────────────────────────────── */}
        <TabsContent value="lifestyle">
          <div className="grid md:grid-cols-2 gap-6">
            {isLoading ? [...Array(3)].map((_, i) => <CardSkeleton key={i} />) :
            lifestyleCards.map(card => (
              <Card key={card.productId} className="border-purple-200 dark:border-purple-800 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {getCardTypeIcon(card.cardType)}
                      <div>
                        <CardTitle>{card.name}</CardTitle>
                        <CardDescription>{card.issuerBank}</CardDescription>
                      </div>
                    </div>
                    <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200">
                      {card.cardType}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                    <p className="font-semibold text-purple-900 dark:text-purple-100 text-sm">{card.rewardRate}</p>
                  </div>
                  <div className="space-y-1">
                    {card.features.slice(0, 3).map((f, i) => (
                      <div key={i} className="flex gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-purple-500 flex-shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setDetailCard(card)}>Details</Button>
                    <Button size="sm" className="flex-1" onClick={() => setEligibilityCard(card)}>Apply</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── COMPARE ───────────────────────────────────────────── */}
        <TabsContent value="compare">
          <Card>
            <CardHeader>
              <CardTitle>Credit Card Comparison</CardTitle>
              <CardDescription>All {allCards.length} cards side by side</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-semibold">Card</th>
                      <th className="text-center p-3 font-semibold">Network</th>
                      <th className="text-center p-3 font-semibold">Joining</th>
                      <th className="text-center p-3 font-semibold">Annual</th>
                      <th className="text-left p-3 font-semibold">Rewards</th>
                      <th className="text-center p-3 font-semibold">Min. Income</th>
                      <th className="text-center p-3 font-semibold">CIBIL</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">Loading…</td></tr>
                    ) : allCards.map(card => (
                      <tr key={card.productId} className="border-b hover:bg-accent transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {getCardTypeIcon(card.cardType)}
                            <div>
                              <p className="font-semibold leading-tight">{card.name}</p>
                              <p className="text-xs text-muted-foreground">{card.issuerBank}</p>
                            </div>
                          </div>
                        </td>
                        <td className="text-center p-3">
                          <Badge className={getNetworkBadgeColor(card.network)}>{card.network.toUpperCase()}</Badge>
                        </td>
                        <td className="text-center p-3 font-medium">
                          {card.joiningFee === 0 ? <span className="text-green-600">Free</span> : `₹${card.joiningFee.toLocaleString("en-IN")}`}
                        </td>
                        <td className="text-center p-3 font-medium">
                          {card.annualFee === 0 ? <span className="text-green-600">Free</span> : `₹${card.annualFee.toLocaleString("en-IN")}`}
                        </td>
                        <td className="p-3 max-w-[200px]">
                          <p className="text-xs truncate">{card.rewardRate}</p>
                        </td>
                        <td className="text-center p-3">₹{(card.eligibility.minIncome / 100000).toFixed(0)}L/yr</td>
                        <td className="text-center p-3">{card.eligibility.minCreditScore}</td>
                        <td className="p-3">
                          <Button size="sm" variant="outline" onClick={() => setEligibilityCard(card)}>
                            Apply
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ELIGIBILITY ───────────────────────────────────────── */}
        <TabsContent value="eligibility">
          <div className="max-w-xl mx-auto">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <LucideShield className="h-6 w-6 text-primary" />
                  <div>
                    <CardTitle>Credit Card Eligibility Check</CardTitle>
                    <CardDescription>Get matched to cards you qualify for — soft pull, no CIBIL impact</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <EligibilityInlineForm cards={allCards} onApply={card => setEligibilityCard(card)} />
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-base">How M2P Credit Card Distribution Works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                {[
                  ["Check Eligibility", "We do a soft pull against CIBIL — zero impact on your credit score."],
                  ["Card Selection", "Our engine matches you to the best-fit cards from our partner banks."],
                  ["Application", "Submit your application digitally with e-KYC and document upload."],
                  ["Issuance via M2P", "M2P Fintech processes the card issuance through their bank partnerships (HDFC, SBI, ICICI, Axis, RBL, IDFC, YES Bank)."],
                  ["Card Delivery", "Physical card dispatched within 7–10 working days. Virtual card instant."],
                ].map(([title, desc], i) => (
                  <div key={i} className="flex gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {i + 1}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{title}</p>
                      <p>{desc}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="mt-4 border-blue-200 dark:border-blue-800">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-blue-800 dark:text-blue-200">M2P Fintech Partnership</p>
                    <p className="text-muted-foreground mt-1">
                      This marketplace is powered by M2P Fintech's card issuance infrastructure.
                      To enable live card applications, contact{" "}
                      <a href="mailto:business@m2pfintech.com" className="text-primary underline">business@m2pfintech.com</a>
                      {" "}to sign a partnership agreement and receive API credentials.
                    </p>
                    <a
                      href="https://m2pfintech.com/connect"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary mt-2 text-xs hover:underline"
                    >
                      Visit M2P Connect <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CardDetailDialog
        card={detailCard}
        onClose={() => setDetailCard(null)}
        onEligibilityCheck={card => { setDetailCard(null); setEligibilityCard(card); }}
      />
      <EligibilityDialog
        card={eligibilityCard}
        onClose={() => setEligibilityCard(null)}
      />
    </div>
  );
}

function EligibilityInlineForm({ cards, onApply }: { cards: M2PCardProduct[]; onApply: (c: M2PCardProduct) => void }) {
  const { toast } = useToast();
  const [pan, setPan]           = useState("");
  const [mobile, setMobile]     = useState("");
  const [income, setIncome]     = useState("");
  const [employment, setEmployment] = useState("salaried");
  const [result, setResult]     = useState<EligibilityResult | null>(null);

  const checkMutation = useMutation({
    mutationFn: () => apiRequest("/api/cards/eligibility", "POST", {
      pan: pan.toUpperCase(),
      mobile,
      annualIncome: Number(income),
      employmentType: employment,
    }),
    onSuccess: (data: any) => setResult(data),
    onError:   (err: any) => toast({ title: "Check failed", description: err.message, variant: "destructive" }),
  });

  if (result) {
    return (
      <div className="space-y-4">
        {result.eligible ? (
          <>
            <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg text-center">
              <Check className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="font-bold text-green-800 dark:text-green-200">You qualify for {result.recommendedCards.length} cards</p>
              {result.preApprovedLimit && (
                <p className="text-xl font-bold text-green-700 dark:text-green-300 mt-1">
                  Up to ₹{result.preApprovedLimit.toLocaleString("en-IN")} pre-approved
                </p>
              )}
            </div>
            <div className="space-y-2">
              {result.recommendedCards.map(c => (
                <div key={c.productId} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.issuerBank} · {c.annualFee === 0 ? "Lifetime Free" : `₹${c.annualFee.toLocaleString("en-IN")}/yr`}</p>
                  </div>
                  <Button size="sm" onClick={() => onApply(c)}>Apply</Button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-center space-y-2">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
            <p className="font-semibold text-red-800 dark:text-red-200">Not eligible at this time</p>
            {result.reasons?.map((r, i) => (
              <p key={i} className="text-sm text-muted-foreground">{r}</p>
            ))}
          </div>
        )}
        <Button variant="outline" className="w-full" onClick={() => setResult(null)}>
          Check Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>PAN Number</Label>
        <Input placeholder="ABCDE1234F" value={pan} onChange={e => setPan(e.target.value.toUpperCase())} maxLength={10} />
      </div>
      <div className="space-y-1">
        <Label>Mobile Number</Label>
        <Input placeholder="9876543210" value={mobile} onChange={e => setMobile(e.target.value)} maxLength={10} />
      </div>
      <div className="space-y-1">
        <Label>Annual Income (₹)</Label>
        <Input placeholder="e.g. 1200000" type="number" value={income} onChange={e => setIncome(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>Employment Type</Label>
        <Select value={employment} onValueChange={setEmployment}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="salaried">Salaried</SelectItem>
            <SelectItem value="self_employed">Self Employed</SelectItem>
            <SelectItem value="business">Business Owner</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground flex gap-1.5">
        <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
        Soft check only — this will NOT impact your CIBIL score.
      </p>
      <Button
        className="w-full"
        onClick={() => checkMutation.mutate()}
        disabled={!pan || !mobile || !income || checkMutation.isPending}
      >
        {checkMutation.isPending ? "Checking eligibility…" : "Check My Eligibility"}
      </Button>
    </div>
  );
}
