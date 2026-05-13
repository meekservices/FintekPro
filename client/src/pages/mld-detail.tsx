import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { 
  ArrowLeft,
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Building2, 
  Shield as LucideShield, 
  AlertTriangle,
  Info,
  ChartLine,
  Calendar,
  Percent,
  IndianRupee,
  BarChart3,
  Layers,
  Target,
  Activity,
  LineChart,
  Calculator,
  Plus,
  CheckCircle,
  FileText
} from "lucide-react";
import { format, parseISO, differenceInDays, differenceInYears } from "date-fns";
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Legend,
  ReferenceLine
} from "recharts";

interface MldMaster {
  id: string;
  isin: string;
  name: string;
  issuer: string;
  issueDate: string;
  maturityDate: string;
  faceValue: string;
  issuePrice?: string;
  couponRate?: string;
  couponFrequency?: string;
  underlying: string;
  payoffType: string;
  barrierLevel?: string;
  participationRate?: string;
  capLevel?: string;
  floorLevel?: string;
  strikePrice?: string;
  knockInLevel?: string;
  knockOutLevel?: string;
  minInvestment?: string;
  lotSize?: number;
  creditRating?: string;
  ratingAgency?: string;
  listingType: string;
  exchange?: string;
  sector?: string;
  category?: string;
  status: string;
  riskScore?: number;
  description?: string;
  lastTradedPrice?: string;
  lastNavDate?: string;
  isPublished: boolean;
  createdAt: string;
  payoffFormula?: string;
  riskFactors?: string;
  documentUrl?: string;
}

interface ScenarioPayoff {
  scenario: string;
  indexChange: number;
  payoff: number;
  returnPercent: number;
  description: string;
}

interface MldDetailResponse {
  mld: MldMaster;
  priceHistory: Array<{ priceDate: string; price: string; nav?: string }>;
  monthlyPerformance: Array<{ monthYear: string; return: string }>;
  scenarioPayoffs: ScenarioPayoff[];
}

interface MldAnalytics {
  irr?: number;
  ytm?: number;
  durationYears?: number;
  riskScore: number;
  riskCategory: string;
  expectedReturn?: number;
  maxLoss?: number;
  breakeven?: number;
  payoffGraph: Array<{ indexLevel: number; payoff: number }>;
}

const PAYOFF_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  digital: { label: "Digital", color: "bg-blue-500" },
  barrier: { label: "Barrier", color: "bg-purple-500" },
  sharkfin: { label: "Shark Fin", color: "bg-indigo-500" },
  range: { label: "Range Accrual", color: "bg-cyan-500" },
  participation: { label: "Participation", color: "bg-green-500" },
  autocall: { label: "Autocall", color: "bg-orange-500" },
  snowball: { label: "Snowball", color: "bg-pink-500" },
};

const formatCurrency = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

const getRiskBadge = (riskScore?: number) => {
  if (!riskScore) return null;
  if (riskScore <= 3) return <Badge className="bg-green-600">Low Risk</Badge>;
  if (riskScore <= 6) return <Badge className="bg-yellow-500">Medium Risk</Badge>;
  return <Badge className="bg-red-600">High Risk</Badge>;
};

const getRatingBadge = (rating?: string) => {
  if (!rating) return null;
  const color = rating.startsWith("AAA") ? "bg-green-600" : 
                rating.startsWith("AA") ? "bg-blue-600" :
                rating.startsWith("A") ? "bg-yellow-500" : "bg-orange-500";
  return <Badge className={color}>{rating}</Badge>;
};

export default function MldDetailPage() {
  const [, params] = useRoute("/mld/:id");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [simulationValue, setSimulationValue] = useState([0]);
  
  const [portfolioForm, setPortfolioForm] = useState({
    units: "",
    purchasePrice: "",
    purchaseDate: format(new Date(), "yyyy-MM-dd"),
    notes: "",
  });

  const { data, isLoading, error } = useQuery<MldDetailResponse>({
    queryKey: ["/api/store/mld", params?.id],
    enabled: !!params?.id,
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery<MldAnalytics>({
    queryKey: ["/api/store/mld", params?.id, "analytics"],
    enabled: !!params?.id,
  });

  const addToPortfolioMutation = useMutation({
    mutationFn: async (formData: any) => {
      return apiRequest("/api/store/portfolio/mld", {
        method: "POST",
        body: JSON.stringify(formData),
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "MLD added to portfolio" });
      setShowAddDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/store/portfolio/mld"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to add to portfolio", variant: "destructive" });
    },
  });

  const handleAddToPortfolio = () => {
    if (!data?.mld || !portfolioForm.units || !portfolioForm.purchasePrice) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }
    
    const mld = data.mld;
    addToPortfolioMutation.mutate({
      mldId: mld.id,
      isin: mld.isin,
      mldName: mld.name,
      issuer: mld.issuer,
      underlying: mld.underlying,
      payoffType: mld.payoffType,
      quantity: portfolioForm.units,
      purchasePrice: portfolioForm.purchasePrice,
      purchaseDate: portfolioForm.purchaseDate,
      faceValue: mld.faceValue,
      maturityDate: mld.maturityDate,
      riskScore: mld.riskScore,
      notes: portfolioForm.notes,
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-64 md:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !data?.mld) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Failed to load MLD details. Please try again.</AlertDescription>
        </Alert>
        <Button className="mt-4" onClick={() => navigate("/mld")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to MLDs
        </Button>
      </div>
    );
  }

  const { mld, priceHistory = [], monthlyPerformance = [], scenarioPayoffs = [] } = data;
  const payoffInfo = PAYOFF_TYPE_LABELS[mld.payoffType] || { label: mld.payoffType, color: "bg-muted" };
  const daysToMaturity = mld.maturityDate ? differenceInDays(parseISO(mld.maturityDate), new Date()) : 0;
  const yearsToMaturity = mld.maturityDate ? differenceInYears(parseISO(mld.maturityDate), new Date()) : 0;

  const simulatedPayoff = analytics?.payoffGraph?.find(
    p => Math.abs(p.indexLevel - simulationValue[0]) < 3
  )?.payoff || 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate("/mld")} data-testid="btn-back">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{mld.name}</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Building2 className="w-4 h-4" /> {mld.issuer}
          </p>
        </div>
        {user && (
          <Button onClick={() => setShowAddDialog(true)} data-testid="btn-add-portfolio">
            <Plus className="w-4 h-4 mr-2" /> Add to Portfolio
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge className={`${payoffInfo.color} text-foreground`}>{payoffInfo.label}</Badge>
        {getRatingBadge(mld.creditRating)}
        {getRiskBadge(mld.riskScore)}
        <Badge variant="outline">{mld.listingType === "listed" ? "Listed" : "Unlisted"}</Badge>
        <Badge variant="outline" className="font-mono">{mld.isin}</Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5" /> Key Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-muted-foreground">Face Value</Label>
                <p className="text-lg font-semibold">{formatCurrency(mld.faceValue)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Issue Price</Label>
                <p className="text-lg font-semibold">{formatCurrency(mld.issuePrice) || "—"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Min Investment</Label>
                <p className="text-lg font-semibold">{formatCurrency(mld.minInvestment)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Lot Size</Label>
                <p className="text-lg font-semibold">{mld.lotSize || 1} units</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Issue Date</Label>
                <p className="font-medium">{format(parseISO(mld.issueDate), "dd MMM yyyy")}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Maturity Date</Label>
                <p className="font-medium">{format(parseISO(mld.maturityDate), "dd MMM yyyy")}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Time to Maturity</Label>
                <p className="font-medium flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {daysToMaturity > 0 ? `${yearsToMaturity} years (${daysToMaturity} days)` : "Matured"}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Underlying</Label>
                <p className="font-medium">{mld.underlying}</p>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {mld.barrierLevel && (
                <div>
                  <Label className="text-muted-foreground">Barrier Level</Label>
                  <p className="font-medium text-orange-600">{mld.barrierLevel}%</p>
                </div>
              )}
              {mld.participationRate && (
                <div>
                  <Label className="text-muted-foreground">Participation Rate</Label>
                  <p className="font-medium text-green-600">{mld.participationRate}%</p>
                </div>
              )}
              {mld.capLevel && (
                <div>
                  <Label className="text-muted-foreground">Cap Level</Label>
                  <p className="font-medium">{mld.capLevel}%</p>
                </div>
              )}
              {mld.floorLevel && (
                <div>
                  <Label className="text-muted-foreground">Floor Level</Label>
                  <p className="font-medium">{mld.floorLevel}%</p>
                </div>
              )}
              {mld.couponRate && (
                <div>
                  <Label className="text-muted-foreground">Coupon Rate</Label>
                  <p className="font-medium text-green-600">{mld.couponRate}% {mld.couponFrequency}</p>
                </div>
              )}
              {mld.creditRating && (
                <div>
                  <Label className="text-muted-foreground">Credit Rating</Label>
                  <p className="font-medium">{mld.creditRating} ({mld.ratingAgency})</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" /> Risk Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-5xl font-bold">{mld.riskScore || analytics?.riskScore || "—"}</div>
              <p className="text-muted-foreground">Risk Score (1-10)</p>
              <div className="mt-2">
                {getRiskBadge(mld.riskScore || analytics?.riskScore)}
              </div>
            </div>
            
            <Separator />
            
            {analytics && (
              <div className="space-y-3">
                {analytics.ytm && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">YTM</span>
                    <span className="font-semibold text-green-600">{analytics.ytm.toFixed(2)}%</span>
                  </div>
                )}
                {analytics.expectedReturn && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expected Return</span>
                    <span className="font-semibold">{analytics.expectedReturn.toFixed(2)}%</span>
                  </div>
                )}
                {analytics.maxLoss && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Potential Loss</span>
                    <span className="font-semibold text-red-600">{analytics.maxLoss.toFixed(2)}%</span>
                  </div>
                )}
                {analytics.breakeven && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Breakeven Level</span>
                    <span className="font-semibold">{analytics.breakeven.toFixed(2)}%</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ScrollableTabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <FileText className="w-4 h-4 mr-2" /> Overview
          </TabsTrigger>
          <TabsTrigger value="scenarios" data-testid="tab-scenarios">
            <Target className="w-4 h-4 mr-2" /> Scenario Analysis
          </TabsTrigger>
          <TabsTrigger value="payoff" data-testid="tab-payoff">
            <ChartLine className="w-4 h-4 mr-2" /> Payoff Graph
          </TabsTrigger>
          <TabsTrigger value="simulator" data-testid="tab-simulator">
            <Calculator className="w-4 h-4 mr-2" /> Simulator
          </TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          {mld.description && (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-line">{mld.description}</p>
              </CardContent>
            </Card>
          )}
          
          {mld.payoffFormula && (
            <Card>
              <CardHeader>
                <CardTitle>Payoff Formula</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-muted rounded-lg font-mono text-sm">
                  {mld.payoffFormula}
                </div>
              </CardContent>
            </Card>
          )}
          
          {mld.riskFactors && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" /> Risk Factors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-line">{mld.riskFactors}</p>
              </CardContent>
            </Card>
          )}

          {priceHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Price History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={priceHistory.slice(0, 30).reverse()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="priceDate" 
                        tickFormatter={(v) => format(parseISO(v), "MMM dd")}
                        fontSize={12}
                      />
                      <YAxis fontSize={12} />
                      <RechartsTooltip 
                        labelFormatter={(v) => format(parseISO(v as string), "dd MMM yyyy")}
                        formatter={(v: number) => [formatCurrency(v), "Price"]}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="price" 
                        stroke="#3b82f6" 
                        fill="#3b82f680" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="scenarios" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Scenario Analysis</CardTitle>
              <CardDescription>Estimated returns under different market conditions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {scenarioPayoffs.map((scenario) => (
                  <Card 
                    key={scenario.scenario}
                    className={`
                      ${scenario.scenario === "Bull" ? "border-green-500 bg-green-50 dark:bg-green-900/10" : ""}
                      ${scenario.scenario === "Base" ? "border-blue-500 bg-blue-50 dark:bg-blue-900/10" : ""}
                      ${scenario.scenario === "Bear" ? "border-red-500 bg-red-50 dark:bg-red-900/10" : ""}
                    `}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {scenario.scenario === "Bull" && <TrendingUp className="w-5 h-5 text-green-600" />}
                        {scenario.scenario === "Base" && <Activity className="w-5 h-5 text-blue-600" />}
                        {scenario.scenario === "Bear" && <TrendingDown className="w-5 h-5 text-red-600" />}
                        {scenario.scenario} Case
                      </CardTitle>
                      <CardDescription>
                        Index {scenario.indexChange >= 0 ? "+" : ""}{scenario.indexChange}%
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {scenario.returnPercent >= 0 ? "+" : ""}{scenario.returnPercent.toFixed(2)}%
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Payoff: {formatCurrency(scenario.payoff)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {scenario.description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payoff" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Payoff Diagram</CardTitle>
              <CardDescription>Expected payoff at different underlying levels</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics?.payoffGraph && analytics.payoffGraph.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart data={analytics.payoffGraph}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="indexLevel" 
                        label={{ value: "Underlying Change (%)", position: "bottom" }}
                        fontSize={12}
                      />
                      <YAxis 
                        label={{ value: "Payoff (%)", angle: -90, position: "insideLeft" }}
                        fontSize={12}
                      />
                      <RechartsTooltip 
                        formatter={(v: number) => [`${v.toFixed(2)}%`, "Payoff"]}
                        labelFormatter={(v) => `Index: ${v >= 0 ? "+" : ""}${v}%`}
                      />
                      <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
                      <ReferenceLine x={0} stroke="#666" strokeDasharray="3 3" />
                      {mld.barrierLevel && (
                        <ReferenceLine 
                          x={-parseFloat(mld.barrierLevel)} 
                          stroke="#ef4444" 
                          strokeDasharray="5 5"
                          label={{ value: "Barrier", fill: "#ef4444", fontSize: 10 }}
                        />
                      )}
                      <Line 
                        type="stepAfter" 
                        dataKey="payoff" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center text-muted-foreground">
                  Payoff graph data not available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="simulator" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Payoff Simulator</CardTitle>
              <CardDescription>
                Simulate your returns based on expected market movement
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label>Expected {mld.underlying} Change at Maturity</Label>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground w-12">-50%</span>
                  <Slider
                    value={simulationValue}
                    onValueChange={setSimulationValue}
                    min={-50}
                    max={50}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground w-12">+50%</span>
                </div>
                <div className="text-center">
                  <span className="text-2xl font-bold">
                    {simulationValue[0] >= 0 ? "+" : ""}{simulationValue[0]}%
                  </span>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-muted/50">
                  <CardContent className="pt-6">
                    <Label className="text-muted-foreground">Investment (1 Lot)</Label>
                    <p className="text-2xl font-bold">{formatCurrency(mld.faceValue)}</p>
                  </CardContent>
                </Card>
                <Card className={simulatedPayoff >= 0 ? "bg-green-50 dark:bg-green-900/10" : "bg-red-50 dark:bg-red-900/10"}>
                  <CardContent className="pt-6">
                    <Label className="text-muted-foreground">Estimated Return</Label>
                    <p className={`text-2xl font-bold ${simulatedPayoff >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {simulatedPayoff >= 0 ? "+" : ""}{simulatedPayoff.toFixed(2)}%
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/50">
                  <CardContent className="pt-6">
                    <Label className="text-muted-foreground">Estimated Value</Label>
                    <p className="text-2xl font-bold">
                      {formatCurrency(parseFloat(mld.faceValue) * (1 + simulatedPayoff / 100))}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  This is a simplified simulation. Actual returns may vary based on exact payoff terms, 
                  observation dates, and market conditions. Please read the offer document carefully.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Portfolio</DialogTitle>
            <DialogDescription>
              Record your existing holding of {mld.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Units *</Label>
              <Input
                type="number"
                min="1"
                step={mld.lotSize || 1}
                value={portfolioForm.units}
                onChange={(e) => setPortfolioForm({ ...portfolioForm, units: e.target.value })}
                placeholder={`Lot size: ${mld.lotSize || 1}`}
                data-testid="input-units"
              />
            </div>
            <div>
              <Label>Purchase Price (per unit) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={portfolioForm.purchasePrice}
                onChange={(e) => setPortfolioForm({ ...portfolioForm, purchasePrice: e.target.value })}
                placeholder="Enter purchase price"
                data-testid="input-price"
              />
            </div>
            <div>
              <Label>Purchase Date *</Label>
              <Input
                type="date"
                value={portfolioForm.purchaseDate}
                onChange={(e) => setPortfolioForm({ ...portfolioForm, purchaseDate: e.target.value })}
                data-testid="input-date"
              />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input
                value={portfolioForm.notes}
                onChange={(e) => setPortfolioForm({ ...portfolioForm, notes: e.target.value })}
                placeholder="Add any notes"
                data-testid="input-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddToPortfolio}
              disabled={addToPortfolioMutation.isPending}
              data-testid="btn-confirm-add"
            >
              {addToPortfolioMutation.isPending ? "Adding..." : "Add to Portfolio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
