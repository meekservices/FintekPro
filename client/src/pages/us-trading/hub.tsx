import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Home, 
  Briefcase, 
  BarChart3, 
  History, 
  Wallet, 
  Settings, 
  Globe, 
  ShieldCheck, 
  Info, 
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Clock,
  ExternalLink,
  ChevronRight,
  FileText,
  CreditCard,
  User,
  HelpCircle,
  Lock,
  Search,
  Plus,
  Building2,
  Copy,
  Terminal,
  Key,
  Zap,
  Sparkles,
  Star,
  Activity,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { useClientCapabilities } from "@/hooks/useClientCapabilities";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
// Component types live in a dedicated module — no interface declarations in component file
import type { AccountQueryResponse, NavItemProps, MarketInstrumentsResponse, BestBuysResponse, StockRecommendation, MarketInstrument } from "./hub-types";
import { USFundingCard } from "@/components/social/USFundingCard";
import { USTradingCard } from "@/components/social/USTradingCard";
import { AlgoSignalsView } from "./algo-signals";


// Mock data for initial design - will be replaced with real Alpaca API calls via usTradingService
const MOCK_ACCOUNT = {
  status: "active",
  currency: "USD",
  buying_power: "25000.00",
  cash: "10500.25",
  portfolio_value: "35450.75",
  equity: "35450.75",
  long_market_value: "24950.50",
  short_market_value: "0.00",
  initial_margin: "12475.25",
  maintenance_margin: "7485.15",
  last_equity: "34800.00",
  daytrading_buying_power: "100000.00",
  regt_buying_power: "50000.00",
};

const MOCK_POSITIONS = [
  { symbol: "AAPL", qty: "10", market_value: "1850.20", avg_entry_price: "175.50", unrealized_pl: "95.20", unrealized_plpc: "0.054", current_price: "185.02", change_today: "0.012" },
  { symbol: "MSFT", qty: "5", market_value: "2100.50", avg_entry_price: "410.00", unrealized_pl: "50.50", unrealized_plpc: "0.024", current_price: "420.10", change_today: "-0.005" },
  { symbol: "TSLA", qty: "15", market_value: "2950.00", avg_entry_price: "210.00", unrealized_pl: "-200.00", unrealized_plpc: "-0.063", current_price: "196.67", change_today: "0.031" },
  { symbol: "NVDA", qty: "2", market_value: "1800.00", avg_entry_price: "750.00", unrealized_pl: "300.00", unrealized_plpc: "0.20", current_price: "900.00", change_today: "0.045" },
];

const MOCK_ACTIVITIES = [
  { id: "1", type: "FILL", symbol: "AAPL", qty: "5", price: "184.50", side: "buy", date: "2024-04-15" },
  { id: "2", type: "DIV", symbol: "MSFT", amount: "12.50", date: "2024-04-12" },
  { id: "3", type: "JNLC", amount: "5000.00", description: "LRS Transfer Confirmation", date: "2024-04-10" },
  { id: "4", type: "FILL", symbol: "TSLA", qty: "10", price: "205.00", side: "buy", date: "2024-04-05" },
];

// ─── NavItem ─────────────────────────────────────────────────────────────────
// Defined at module level so it is a stable reference (not recreated per render)
// and satisfies strict typing rules — all props including state setters are explicit.
function NavItem({ id, icon: Icon, label, disabled = false, activeView, setActiveView }: NavItemProps) {
  return (
    <button
      onClick={() => !disabled && setActiveView(id)}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium",
        activeView === id
          ? "bg-primary/10 text-primary shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <Icon className={cn("h-4 w-4", activeView === id ? "text-primary" : "text-muted-foreground")} />
      {label}
    </button>
  );
}

export default function AlpacaClientHub() {
  const { user } = useAuth();
  const [activeView, setActiveView] = useState("home");
  const { canUseAi } = useClientCapabilities();


  const { data: accountData, isLoading: isLoadingAccount } = useQuery<AccountQueryResponse>({
    queryKey: ["/api/us-trading/account"],
    retry: 1,
  });

  // ── Live Market Data Queries ──────────────────────────────────────────────
  const { data: instrumentsData, isLoading: isLoadingInstruments, refetch: refetchInstruments } = useQuery<MarketInstrumentsResponse>({
    queryKey: ["/api/alpaca/market/instruments"],
    staleTime: 30_000,   // 30s — matches server cache TTL
    retry: 1,
  });

  const { data: bestBuysData, isLoading: isLoadingBestBuys } = useQuery<BestBuysResponse>({
    queryKey: ["/api/alpaca/market/best-buys", { riskProfile: "moderate", limit: 9 }],
    queryFn: () => fetch("/api/alpaca/market/best-buys?riskProfile=moderate&limit=9").then(r => r.json()),
    staleTime: 60_000,   // 1 min — screener is heavier
    retry: 1,
  });

  const account = accountData?.account ?? (accountData?.onboarding ? null : MOCK_ACCOUNT);
  const isPaper = accountData?.is_paper ?? false;
  const onboardingStatus = accountData?.onboarding_status ?? "not_started";


  // View: Onboarding (Empty State mirroring Alpaca Dashboard)
  const OnboardingView = () => (
    <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white p-10 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-600/20 via-transparent to-transparent" />
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute -left-8 -bottom-8 w-48 h-48 rounded-full bg-purple-600/10 blur-2xl" />

        <div className="relative z-10 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-xl">
              <Globe className="h-5 w-5 text-slate-900" />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.25em] text-indigo-300">Powered by Alpaca Broker API</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-tight">
            Modern Brokerage<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300">
              Infrastructure for India
            </span>
          </h1>

          <p className="text-slate-300 text-base leading-relaxed max-w-2xl font-medium">
            Alpaca Broker API provides a modern, <span className="text-white font-bold">API-first brokerage infrastructure</span> that enables you to launch and scale trading products globally. With seamless integration, offer US equities, ETFs, and other investment products through a single API — supported by clearing, custody, and settlement services.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            {[
              { label: 'US Equities', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
              { label: 'ETFs', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
              { label: 'Real-Time Trading', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
              { label: 'Account Management', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
              { label: 'Compliance-Ready', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
            ].map(tag => (
              <span key={tag.label} className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border ${tag.color}`}>
                {tag.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Infrastructure Pillars */}
      <div>
        <h2 className="text-lg font-black tracking-tight mb-4">What&apos;s included in your account</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: TrendingUp,  title: 'US Equities & ETFs',       desc: 'Trade NYSE, NASDAQ listed stocks and diversified ETFs. Fractional shares available from $1.',       color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 dark:text-indigo-400' },
            { icon: ShieldCheck, title: 'Clearing & Settlement',     desc: 'Alpaca handles clearing, custody, and T+1 settlement — no operational overhead on your end.',          color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400' },
            { icon: Globe,       title: '196 Countries Supported',   desc: 'Indian residents can invest under LRS (Liberalised Remittance Scheme) up to $250,000/year.',         color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-400' },
            { icon: Lock,        title: 'SIPC Protection $500k',     desc: 'Assets protected up to $500,000 in securities and cash through SIPC + Excess SIPC coverage.',         color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/50 dark:text-violet-400' },
            { icon: Zap,         title: 'Real-Time Account Mgmt',   desc: 'Live portfolio tracking, instant order fills, account statements, and corporate action processing.',    color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-400' },
            { icon: FileText,    title: 'Compliance-Ready',          desc: 'W-8BEN filing, TCS compliance, FBAR-ready account reports, and LRS utilization tracking built-in.',   color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/50 dark:text-rose-400' },
          ].map(({ icon: Icon, title, desc, color }) => (
            <div key={title} className="p-5 rounded-2xl border bg-card hover:-translate-y-1 transition-transform duration-300 shadow-sm hover:shadow-lg group">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-black mb-1">{title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Account Type + Trust Badges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Account selection */}
        <div className="space-y-4">
          <h2 className="text-lg font-black tracking-tight">Select an account type</h2>
          <div className="flex flex-col gap-3">
            <Card className="hover:ring-2 hover:ring-primary/20 cursor-pointer transition-all border-2 group">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-primary/5 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors shrink-0">
                  <User className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-sm">Individual Account</h3>
                  <p className="text-xs text-muted-foreground">For personal retail investors · LRS eligible</p>
                </div>
                <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground shrink-0" />
              </CardContent>
            </Card>

            <Card className="hover:ring-2 hover:ring-orange-200 cursor-pointer transition-all border-2 opacity-60">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-sm">Business Account</h3>
                  <p className="text-xs text-muted-foreground">For LLCs, Corporates and Partnerships</p>
                </div>
                <Badge variant="secondary" className="ml-auto text-[9px] shrink-0">COMING SOON</Badge>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end pt-4">
            <Button size="lg" className="rounded-full px-10 gap-2 shadow-xl shadow-primary/20 font-black">
              Open Account Now <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Trust badges */}
        <div className="space-y-4">
          <h2 className="text-lg font-black tracking-tight">Why trust Alpaca?</h2>
          <div className="space-y-3">
            {[
              { icon: ShieldCheck, label: 'SOC 2 Type 2 Certified',       sub: 'Annual third-party security audits',       color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' },
              { icon: Globe,       label: '196 Countries & Regions',       sub: 'Including India via LRS',                  color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40' },
              { icon: Lock,        label: 'SIPC Protected up to $500,000', sub: 'Securities + Excess SIPC coverage',        color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/40' },
              { icon: Zap,         label: 'Real-Time Order Execution',     sub: 'Institutional-grade matching engine',      color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' },
            ].map(({ icon: Icon, label, sub, color }) => (
              <div key={label} className="flex items-center gap-4 p-4 rounded-2xl border bg-card">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-black">{label}</p>
                  <p className="text-xs text-muted-foreground">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r bg-card flex flex-col p-4 gap-6 shrink-0 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="px-2 flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center shadow-lg group">
            <Globe className="h-5 w-5 text-white group-hover:rotate-12 transition-transform" />
          </div>
          <span className="font-black text-xl tracking-tighter">FintekPro <span className="text-primary italic">US</span></span>
        </div>

        <nav className="flex-1 flex flex-col gap-1">
          <div className="px-2 mb-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-50">General</div>
          <NavItem id="home" icon={Home} label="Home" activeView={activeView} setActiveView={setActiveView} />
          <NavItem id="account" icon={User} label="Account" activeView={activeView} setActiveView={setActiveView} />
          <NavItem id="positions" icon={Briefcase} label="Positions" activeView={activeView} setActiveView={setActiveView} />
          <NavItem id="orders" icon={BarChart3} label="Orders" activeView={activeView} setActiveView={setActiveView} />
          <NavItem id="activities" icon={History} label="Activities" activeView={activeView} setActiveView={setActiveView} />
          <NavItem id="balances" icon={Wallet} label="Balances" activeView={activeView} setActiveView={setActiveView} />
          
          <div className="px-2 mt-6 mb-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-50">AI Tools</div>
          <NavItem id="algo-signals" icon={Zap} label="Algo Signals" activeView={activeView} setActiveView={setActiveView} />
          <NavItem id="configure" icon={Settings} label="Configure" activeView={activeView} setActiveView={setActiveView} />
          <NavItem id="api" icon={ShieldCheck} label="API Keys" activeView={activeView} setActiveView={setActiveView} />
          
          <div className="px-2 mt-6 mb-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-50">Support</div>
          <NavItem id="help" icon={HelpCircle} label="Support" activeView={activeView} setActiveView={setActiveView} />
          <NavItem id="legal" icon={FileText} label="Legal" activeView={activeView} setActiveView={setActiveView} />
        </nav>

        <Card className="p-4 bg-muted/40 border-none rounded-2xl">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Compliance</span>
          </div>
          <p className="text-xs font-bold text-foreground">LRS Status: VERIFIED</p>
          <div className="h-1.5 w-full bg-muted rounded-full mt-2 overflow-hidden shadow-inner">
            <div className="h-full bg-gradient-to-r from-green-500 to-emerald-400 w-[85%]" />
          </div>
          <p className="text-[9px] text-muted-foreground mt-2 font-medium">$212,500 of $250k Limit utilized</p>
        </Card>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[slate-50/30] dark:bg-slate-950/40">
        {/* Top Header */}
        <header className="h-16 border-b bg-card/80 backdrop-blur-md px-8 flex items-center justify-between shadow-sm relative z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-base font-bold capitalize tracking-tight">{activeView.replace('-', ' ')}</h2>
            {isPaper && (
              <div className="flex items-center gap-2 px-3 py-1 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-full text-[10px] font-bold animate-pulse">
                <Info className="h-3 w-3" /> PAPER TRADING ACTIVE
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="relative w-64 hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input 
                placeholder="Search stocks by symbol..." 
                className="w-full bg-muted/50 border border-transparent rounded-full pl-9 pr-4 py-1.5 text-xs focus:ring-2 focus:ring-primary/20 focus:bg-background transition-all outline-none"
              />
            </div>
            <Separator orientation="vertical" className="h-6" />
            <Button size="sm" variant="default" className="rounded-full gap-2 px-5 py-5 font-bold shadow-lg shadow-primary/20">
              <Plus className="h-4 w-4" /> NEW ORDER
            </Button>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 p-[2px]">
              <div className="w-full h-full rounded-full bg-background flex items-center justify-center text-xs font-black shadow-inner">
                {user?.email?.[0].toUpperCase() || "U"}
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <ScrollArea className="flex-1">
          <div className="p-8 max-w-6xl mx-auto space-y-8">
            
            {/* Conditional Onboarding vs Main Content */}
            {(!account && activeView === "home") ? (
              <OnboardingView />
            ) : (
              <>
                {/* View: Home */}
                {activeView === "home" && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="flex items-center justify-between">
                      <div>
                        <h1 className="text-3xl font-black tracking-tighter">Namaste, {user?.firstName}!</h1>
                        <p className="text-muted-foreground text-sm font-medium">Your global investment command center.</p>
                      </div>
                      <div className="flex gap-2">
                        <Badge className="bg-green-500/10 text-green-600 border-none shadow-none uppercase font-black text-[10px] py-1">Market Open</Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <Card className="bg-gradient-to-br from-indigo-600 via-primary to-blue-500 text-white border-none shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform duration-700">
                          <Globe className="h-32 w-32" />
                        </div>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs font-black opacity-70 uppercase tracking-widest">Net Worth (USD)</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-4xl font-black">${parseFloat(account?.equity ?? "0").toLocaleString()}</div>
                          <div className="flex items-center gap-1 mt-2 text-white/90 text-sm font-bold bg-white/10 w-fit px-2 py-0.5 rounded-full">
                            <TrendingUp className="h-4 w-4" /> +1.4%
                          </div>
                        </CardContent>
                      </Card>

                      {/* Other Summary Cards */}
                      <Card className="shadow-xl shadow-slate-200/50 border-none rounded-2xl bg-card hover:-translate-y-1 transition-transform duration-300">
                        <CardHeader className="pb-1">
                          <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Buying Power</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-black text-foreground">${parseFloat(account?.buying_power ?? "0").toLocaleString()}</div>
                          <p className="text-[10px] font-bold text-muted-foreground/60 mt-1 uppercase">Cash: ${parseFloat(account?.cash ?? "0").toLocaleString()}</p>
                        </CardContent>
                      </Card>

                      <Card className="shadow-xl shadow-slate-200/50 border-none rounded-2xl bg-card hover:-translate-y-1 transition-transform duration-300">
                        <CardHeader className="pb-1">
                          <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">LRS Utilization</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-black text-foreground">85.0%</div>
                          <div className="h-2 w-full bg-muted rounded-full mt-2 overflow-hidden shadow-inner">
                            <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 w-[85%]" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="shadow-xl shadow-slate-200/50 border-none rounded-2xl bg-card hover:-translate-y-1 transition-transform duration-300">
                        <CardHeader className="pb-1">
                          <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Live USD/INR</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-black text-foreground">₹83.42</div>
                          <p className="text-[10px] font-bold text-green-500 mt-1 uppercase">+₹0.04 (0.05%)</p>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <Card className="md:col-span-2 border-none shadow-2xl rounded-3xl overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-white/20">
                        <CardHeader className="border-b bg-muted/10 pb-4 px-8 pt-8">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-lg font-black tracking-tight">Portfolio Value</CardTitle>
                              <CardDescription className="text-xs font-bold uppercase opacity-50">Last 24 Hours</CardDescription>
                            </div>
                            <div className="flex p-1 bg-muted rounded-xl gap-1">
                              {['1D', '1W', '1M', '1Y', 'ALL'].map(t => (
                                <button key={t} className={cn("px-3 py-1.5 rounded-lg text-[10px] font-black tracking-tighter transition-all", t === '1D' ? "bg-white dark:bg-slate-800 shadow-sm text-primary" : "text-muted-foreground hover:bg-white/50")}>
                                  {t}
                                </button>
                              ))}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0">
                           <div className="h-[300px] w-full p-8 flex items-center justify-center">
                              {/* Chart Placeholder */}
                              <div className="flex flex-col items-center gap-4 text-muted-foreground opacity-30">
                                 <BarChart3 className="h-16 w-16" />
                                 <span className="text-xs font-black uppercase tracking-widest">Interactive Charting Connection...</span>
                              </div>
                           </div>
                        </CardContent>
                      </Card>

                      <div className="space-y-6">
                        <Card className="border-none shadow-xl rounded-3xl bg-white dark:bg-slate-900 p-2">
                           <CardHeader className="pb-4 pt-6 px-6">
                              <CardTitle className="text-base font-black">Strategic Actions</CardTitle>
                           </CardHeader>
                           <CardContent className="space-y-3 px-4">
                              <Button className="w-full justify-between h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-foreground border-none shadow-sm px-6" variant="outline">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                    <Plus className="h-5 w-5 text-primary" />
                                  </div>
                                  <div className="text-left leading-none">
                                     <p className="text-sm font-black">Trade</p>
                                     <p className="text-[10px] text-muted-foreground font-bold">Market Order</p>
                                  </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </Button>

                              <Button className="w-full justify-between h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-foreground border-none shadow-sm px-6" variant="outline">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                                    <CreditCard className="h-5 w-5 text-orange-600" />
                                  </div>
                                  <div className="text-left leading-none">
                                     <p className="text-sm font-black">Fund Account</p>
                                     <p className="text-[10px] text-muted-foreground font-bold">LRS Transfer</p>
                                  </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </Button>

                              <Button className="w-full justify-between h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-foreground border-none shadow-sm px-6" variant="outline">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                                    <FileText className="h-5 w-5 text-green-600" />
                                  </div>
                                  <div className="text-left leading-none">
                                     <p className="text-sm font-black">Statements</p>
                                     <p className="text-[10px] text-muted-foreground font-bold">Tax & Trade</p>
                                  </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </Button>
                           </CardContent>
                        </Card>

                        <div className="p-6 rounded-[2rem] bg-indigo-600 text-white shadow-2xl overflow-hidden relative group">
                            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                               <ShieldCheck className="h-24 w-24" />
                            </div>
                            <h4 className="text-sm font-black mb-1">Investor Protection</h4>
                            <p className="text-[10px] text-indigo-100 leading-relaxed font-bold">
                               Protected by <span className="text-orange-300">SIPC up to $500,000</span> for securities and cash. 
                            </p>
                            <Button variant="link" className="p-0 h-auto mt-2 text-indigo-200 text-[10px] font-black hover:text-white uppercase transition-colors">Security Details</Button>
                        </div>
                      </div>
                    </div>

                    {/* Social & Alpaca Features */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
                      <USFundingCard />
                      <USTradingCard />
                    </div>

                    {/* ── Discover US Markets ──────────────────────────────── */}
                    <div className="space-y-6 mt-12">
                      {/* Section Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                            <Sparkles className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <h2 className="text-xl font-black tracking-tight">Discover US Markets</h2>
                            <p className="text-xs text-muted-foreground font-medium">
                              {instrumentsData?.data?.fxRate
                                ? `Live via Alpaca · USD/INR ₹${instrumentsData.data.fxRate.toFixed(2)}`
                                : "Powered by Alpaca Broker API"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {instrumentsData?.data?.marketStatus?.isOpen ? (
                            <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
                              <Activity className="h-3 w-3" /> NYSE OPEN
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
                              <Clock className="h-3 w-3" /> MARKET CLOSED
                            </span>
                          )}
                          <button
                            onClick={() => refetchInstruments()}
                            className="w-8 h-8 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors"
                            title="Refresh prices"
                          >
                            <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", isLoadingInstruments && "animate-spin")} />
                          </button>
                        </div>
                      </div>

                      {/* ── Best Buys AI Screener ─────────────────────────── */}
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                          <h3 className="text-base font-black">AI Best Buys Today</h3>
                          {bestBuysData?.data?.modelVersion && (
                            <span className="text-[10px] font-bold text-muted-foreground/60 bg-muted/50 px-2 py-0.5 rounded-full">
                              {bestBuysData.data.modelVersion}
                            </span>
                          )}
                        </div>

                        {isLoadingBestBuys ? (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[1,2,3,4,5,6].map(i => (
                              <div key={i} className="h-36 rounded-2xl bg-muted/40 animate-pulse" />
                            ))}
                          </div>
                        ) : bestBuysData?.data?.recommendations?.length ? (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {bestBuysData.data.recommendations.map((rec) => (
                                <div
                                  key={rec.symbol}
                                  className={cn(
                                    "rounded-2xl p-5 border transition-all hover:-translate-y-1 hover:shadow-lg cursor-pointer group",
                                    rec.signal === 'buy'
                                      ? "bg-emerald-50/80 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800"
                                      : rec.signal === 'hold'
                                      ? "bg-amber-50/80 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
                                      : "bg-rose-50/50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900"
                                  )}
                                >
                                  <div className="flex items-start justify-between mb-3">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-lg font-black tracking-tighter">{rec.symbol}</span>
                                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-black/10">{rec.type}</span>
                                      </div>
                                      <p className="text-[10px] text-muted-foreground font-medium truncate max-w-[140px]">{rec.name}</p>
                                    </div>
                                    <div className={cn(
                                      "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                                      rec.signal === 'buy' ? "bg-emerald-500 text-white"
                                        : rec.signal === 'hold' ? "bg-amber-500 text-white"
                                        : "bg-rose-500 text-white"
                                    )}>
                                      {rec.signal}
                                    </div>
                                  </div>

                                  <div className="flex items-end justify-between mb-3">
                                    <div>
                                      <p className="text-xl font-black">${rec.price?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                                      <p className="text-[10px] text-muted-foreground font-bold">₹{rec.priceInr?.toLocaleString('en-IN')}</p>
                                    </div>
                                    <div className={cn(
                                      "flex items-center gap-1 text-sm font-black",
                                      rec.changePercent >= 0 ? "text-emerald-600" : "text-rose-600"
                                    )}>
                                      {rec.changePercent >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                                      {rec.changePercent >= 0 ? "+" : ""}{rec.changePercent?.toFixed(2)}%
                                    </div>
                                  </div>

                                  {/* Confidence bar */}
                                  <div className="space-y-1">
                                    <div className="flex justify-between items-center">
                                      <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Confidence</span>
                                      <span className="text-[10px] font-black">{rec.confidenceScore}/100</span>
                                    </div>
                                    <div
                                      className={cn(
                                        "h-1.5 rounded-full overflow-hidden",
                                        `[--bar-w:${rec.confidenceScore}%]`
                                      )}
                                    >
                                      <div
                                        className={cn(
                                          "h-full rounded-full transition-all duration-700 w-[var(--bar-w)]",
                                          rec.signal === 'buy' ? "bg-emerald-500"
                                            : rec.signal === 'hold' ? "bg-amber-500"
                                            : "bg-rose-500"
                                        )}
                                      />
                                    </div>
                                  </div>

                                  {/* Top factor */}
                                  {rec.factorsConsidered?.[0] && (
                                    <p className="mt-2 text-[9px] text-muted-foreground leading-relaxed line-clamp-2">
                                      {rec.factorsConsidered[0]}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* Disclaimer */}
                            {bestBuysData.data.disclaimer && (
                              <div className="flex items-start gap-2 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl dark:bg-amber-950/20 dark:border-amber-800">
                                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                <p className="text-[10px] text-amber-800 dark:text-amber-300 font-medium leading-relaxed">
                                  {bestBuysData.data.disclaimer}
                                </p>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground/40">
                            <Sparkles className="h-8 w-8" />
                            <p className="text-xs font-bold">Screener results unavailable — market may be closed</p>
                          </div>
                        )}
                      </div>

                      {/* ── Stocks & ETFs Tables ──────────────────────────── */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Stocks */}
                        <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-card">
                          <CardHeader className="px-6 pt-6 pb-3 border-b">
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="text-sm font-black">Popular US Stocks</CardTitle>
                                <CardDescription className="text-[10px]">Live quotes · Fractional buying available</CardDescription>
                              </div>
                              <Globe className="h-4 w-4 text-muted-foreground/40" />
                            </div>
                          </CardHeader>
                          <CardContent className="p-0">
                            {isLoadingInstruments ? (
                              <div className="space-y-3 p-6">
                                {[1,2,3,4,5].map(i => <div key={i} className="h-10 rounded-xl bg-muted/40 animate-pulse" />)}
                              </div>
                            ) : (
                              <div className="divide-y">
                                {(instrumentsData?.data?.stocks ?? []).map((stock) => (
                                  <div key={stock.symbol} className="flex items-center justify-between px-6 py-3.5 hover:bg-muted/30 transition-colors group">
                                    <div className="flex items-center gap-3">
                                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center text-[10px] font-black shadow-sm">
                                        {stock.symbol.slice(0, 2)}
                                      </div>
                                      <div>
                                        <p className="text-sm font-black">{stock.symbol}</p>
                                        <p className="text-[10px] text-muted-foreground">{stock.name || stock.symbol}</p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-black">
                                        {stock.price ? `$${stock.price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '—'}
                                      </p>
                                      <p className={cn(
                                        "text-[10px] font-black",
                                        (stock.changePercent ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"
                                      )}>
                                        {stock.changePercent != null
                                          ? `${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%`
                                          : '—'}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* ETFs */}
                        <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-card">
                          <CardHeader className="px-6 pt-6 pb-3 border-b">
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="text-sm font-black">US ETFs</CardTitle>
                                <CardDescription className="text-[10px]">Diversified exposure · Expense ratio shown</CardDescription>
                              </div>
                              <BarChart3 className="h-4 w-4 text-muted-foreground/40" />
                            </div>
                          </CardHeader>
                          <CardContent className="p-0">
                            {isLoadingInstruments ? (
                              <div className="space-y-3 p-6">
                                {[1,2,3,4,5].map(i => <div key={i} className="h-10 rounded-xl bg-muted/40 animate-pulse" />)}
                              </div>
                            ) : (
                              <div className="divide-y">
                                {(instrumentsData?.data?.etfs ?? []).map((etf) => (
                                  <div key={etf.symbol} className="flex items-center justify-between px-6 py-3.5 hover:bg-muted/30 transition-colors group">
                                    <div className="flex items-center gap-3">
                                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50 flex items-center justify-center text-[10px] font-black text-indigo-700 dark:text-indigo-300 shadow-sm">
                                        ETF
                                      </div>
                                      <div>
                                        <p className="text-sm font-black">{etf.symbol}</p>
                                        <div className="flex items-center gap-1.5">
                                          <p className="text-[10px] text-muted-foreground truncate max-w-[100px]">{etf.name || etf.symbol}</p>
                                          {etf.expenseRatio != null && (
                                            <span className="text-[9px] font-bold text-muted-foreground/60 bg-muted/50 px-1 rounded">
                                              {(etf.expenseRatio * 100).toFixed(2)}% ER
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-black">
                                        {etf.price ? `$${etf.price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '—'}
                                      </p>
                                      <p className={cn(
                                        "text-[10px] font-black",
                                        (etf.changePercent ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"
                                      )}>
                                        {etf.changePercent != null
                                          ? `${etf.changePercent >= 0 ? '+' : ''}${etf.changePercent.toFixed(2)}%`
                                          : '—'}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>

                      {/* INR value note */}
                      {instrumentsData?.data?.fxRate && (
                        <p className="text-center text-[10px] text-muted-foreground/50 font-medium">
                          USD/INR rate: ₹{instrumentsData.data.fxRate.toFixed(2)} · Prices delayed up to 15 minutes · Not investment advice
                        </p>
                      )}
                    </div>
                    {/* ── End Discover US Markets ───────────────────────── */}

                  </div>
                )}


                {/* View: Algo Signals */}
                {activeView === "algo-signals" && (
                  <AlgoSignalsView />
                )}

                {/* View: Positions */}
                {activeView === "positions" && (
                   <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                      <div className="flex items-center justify-between">
                         <h1 className="text-3xl font-black tracking-tighter">Positions</h1>
                         <div className="flex gap-2">
                           <Button variant="outline" size="sm" className="rounded-xl border-none shadow-sm font-bold bg-white dark:bg-slate-900">
                             EXPORT CSV
                           </Button>
                         </div>
                      </div>

                      <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-card">
                         <div className="w-full overflow-x-auto">
                           <table className="w-full border-collapse">
                             <thead>
                               <tr className="bg-muted/10 border-b">
                                 <th className="px-8 py-5 text-left text-[10px] font-black text-muted-foreground uppercase tracking-widest">Instrument</th>
                                 <th className="px-8 py-5 text-right text-[10px] font-black text-muted-foreground uppercase tracking-widest">Qty</th>
                                 <th className="px-8 py-5 text-right text-[10px] font-black text-muted-foreground uppercase tracking-widest">Market Value</th>
                                 <th className="px-8 py-5 text-right text-[10px] font-black text-muted-foreground uppercase tracking-widest">Entry Price</th>
                                 <th className="px-8 py-5 text-right text-[10px] font-black text-muted-foreground uppercase tracking-widest">Last Quote</th>
                                 <th className="px-8 py-5 text-right text-[10px] font-black text-muted-foreground uppercase tracking-widest">P&L Status</th>
                               </tr>
                             </thead>
                             <tbody>
                               {MOCK_POSITIONS.map((pos) => (
                                 <tr key={pos.symbol} className="border-b last:border-0 hover:bg-muted/5 transition-all group">
                                   <td className="px-8 py-6 whitespace-nowrap">
                                     <div className="flex items-center gap-4">
                                       <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center font-black text-xs text-foreground shadow-sm group-hover:scale-110 transition-transform">
                                         {pos.symbol.slice(0, 2)}
                                       </div>
                                       <div>
                                          <p className="font-black text-sm tracking-tight">{pos.symbol}</p>
                                          <p className="text-[10px] font-black text-muted-foreground opacity-60 uppercase tracking-widest">Primary Exchange</p>
                                       </div>
                                     </div>
                                   </td>
                                   <td className="px-8 py-6 text-right text-sm font-black">{pos.qty}</td>
                                   <td className="px-8 py-6 text-right text-sm font-black text-primary">${parseFloat(pos.market_value).toLocaleString()}</td>
                                   <td className="px-8 py-6 text-right text-sm font-bold text-muted-foreground/50">${pos.avg_entry_price}</td>
                                   <td className="px-8 py-6 text-right text-sm font-black">${pos.current_price}</td>
                                   <td className="px-8 py-6 text-right">
                                     <div className={cn(
                                       "inline-flex flex-col items-end px-4 py-1.5 rounded-2xl font-black text-xs shadow-sm",
                                       parseFloat(pos.unrealized_pl) >= 0 
                                         ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10" 
                                         : "bg-rose-50 text-rose-600 dark:bg-rose-500/10"
                                     )}>
                                       <span>{parseFloat(pos.unrealized_pl) >= 0 ? "+" : ""}${pos.unrealized_pl}</span>
                                       <span className="text-[9px] opacity-70">{(parseFloat(pos.unrealized_plpc) * 100).toFixed(2)}%</span>
                                     </div>
                                   </td>
                                 </tr>
                               ))}
                             </tbody>
                           </table>
                         </div>
                      </Card>
                   </div>
                )}

                {/* View: Balances - New Section from Image */}
                {activeView === "balances" && (
                   <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                      <div className="flex flex-col gap-2">
                         <h1 className="text-4xl font-black tracking-tighter">Balances</h1>
                         <p className="text-muted-foreground text-sm font-bold uppercase tracking-widest opacity-60">Real-time Fund Tracking</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                         <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white dark:bg-slate-900 p-8 flex flex-col justify-between h-[320px]">
                            <div className="space-y-4">
                               <div className="w-14 h-14 bg-primary/10 rounded-3xl flex items-center justify-center">
                                  <Wallet className="h-7 w-7 text-primary" />
                               </div>
                               <div>
                                  <h3 className="text-xl font-black">Settled Cash</h3>
                                  <p className="text-sm text-muted-foreground font-medium">Funds available for immediate withdrawal or trading.</p>
                               </div>
                            </div>
                            <div className="text-5xl font-black tracking-tighter text-foreground">${parseFloat(account?.cash ?? "0").toLocaleString()}</div>
                         </Card>

                         <Card className="border-none shadow-2xl rounded-[2.5rem] bg-slate-900 text-white p-8 flex flex-col justify-between h-[320px] relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12 group-hover:rotate-0 transition-all duration-1000">
                               <TrendingUp className="h-64 w-64" />
                            </div>
                            <div className="space-y-4 relative z-10">
                               <div className="w-14 h-14 bg-white/10 rounded-3xl flex items-center justify-center">
                                  <BarChart3 className="h-7 w-7 text-white" />
                               </div>
                               <div>
                                  <h3 className="text-xl font-black">Buying Power</h3>
                                  <p className="text-sm text-white/50 font-medium">Total value available to open new positions.</p>
                                </div>
                            </div>
                            <div className="text-5xl font-black tracking-tighter relative z-10">${parseFloat(account?.buying_power ?? "0").toLocaleString()}</div>
                         </Card>
                      </div>

                      <Card className="border-none shadow-xl rounded-3xl bg-card">
                         <CardHeader>
                            <CardTitle className="text-lg font-black tracking-tight">Balance Breakdown</CardTitle>
                         </CardHeader>
                         <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                               <div className="space-y-4">
                                  <div className="flex justify-between items-center text-sm">
                                     <span className="font-bold text-muted-foreground opacity-60">Reg T Buying Power</span>
                                     <span className="font-black">${parseFloat(account?.regt_buying_power ?? "0").toLocaleString()}</span>
                                  </div>
                                  <Separator />
                                  <div className="flex justify-between items-center text-sm">
                                     <span className="font-bold text-muted-foreground opacity-60">Day Trading Power</span>
                                     <span className="font-black">${parseFloat(account?.daytrading_buying_power ?? "0").toLocaleString()}</span>
                                  </div>
                               </div>

                               <div className="space-y-4">
                                  <div className="flex justify-between items-center text-sm">
                                     <span className="font-bold text-muted-foreground opacity-60">Initial Margin</span>
                                     <span className="font-black font-mono">${parseFloat(account?.initial_margin ?? "0").toLocaleString()}</span>
                                  </div>
                                  <Separator />
                                  <div className="flex justify-between items-center text-sm">
                                     <span className="font-bold text-muted-foreground opacity-60">Maintenance Margin</span>
                                     <span className="font-black font-mono">${parseFloat(account?.maintenance_margin ?? "0").toLocaleString()}</span>
                                  </div>
                               </div>

                               <div className="space-y-4">
                                  <div className="flex justify-between items-center text-sm">
                                     <span className="font-bold text-muted-foreground opacity-60">LRS Annual Cap</span>
                                     <span className="font-black">$250,000</span>
                                  </div>
                                  <Separator />
                                  <div className="flex justify-between items-center text-sm">
                                     <span className="font-bold text-muted-foreground opacity-60">LRS Available</span>
                                     <span className="font-black text-green-500">$37,500</span>
                                  </div>
                               </div>
                            </div>
                         </CardContent>
                      </Card>
                   </div>
                )}

                {/* View: Configure */}
                {activeView === "configure" && (
                   <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
                      <div className="flex flex-col gap-2">
                         <h1 className="text-3xl font-black tracking-tighter">Trading Configuration</h1>
                         <p className="text-muted-foreground text-sm font-bold uppercase tracking-widest opacity-60">Customized US Investment Settings</p>
                      </div>

                      <Card className="border-none shadow-xl rounded-3xl bg-card p-6">
                         <div className="space-y-6">
                            <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-muted">
                               <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                                     <Terminal className="h-5 w-5 text-orange-600" />
                                  </div>
                                  <div>
                                     <p className="text-sm font-black">Trade Confirmations</p>
                                     <p className="text-[10px] text-muted-foreground font-bold">Receive instant emails for every trade fill.</p>
                                  </div>
                               </div>
                               <Button variant="outline" size="sm" className="rounded-full px-6 font-bold">ENABLED</Button>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-muted">
                               <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                                     <TrendingUp className="h-5 w-5 text-blue-600" />
                                  </div>
                                  <div>
                                     <p className="text-sm font-black">Fractional Trading</p>
                                     <p className="text-[10px] text-muted-foreground font-bold">Enable buying stocks in dollar amounts (less than 1 share).</p>
                                  </div>
                               </div>
                               <Button variant="outline" size="sm" className="rounded-full px-6 font-bold">ACTIVE</Button>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-muted">
                               <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                                     <ShieldCheck className="h-5 w-5 text-green-600" />
                                  </div>
                                  <div>
                                     <p className="text-sm font-black">Account Protection</p>
                                     <p className="text-[10px] text-muted-foreground font-bold">Auto-Liquidate if equity falls below 25% of margin.</p>
                                  </div>
                               </div>
                               <Button variant="outline" size="sm" className="rounded-full px-6 font-bold">CONFIGURED</Button>
                            </div>
                         </div>
                      </Card>

                      <div className="p-8 bg-black text-white rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                         <div className="absolute top-0 right-0 p-8 opacity-10 scale-150 rotate-45 group-hover:rotate-0 transition-all duration-700">
                            <Settings className="h-48 w-48" />
                         </div>
                         <h3 className="text-2xl font-black mb-4">LRS & Tax Settings</h3>
                         <div className="grid grid-cols-2 gap-8 relative z-10">
                            <div className="space-y-1">
                               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Resident Status</p>
                               <p className="text-sm font-bold">Indian Resident (Individual)</p>
                            </div>
                            <div className="space-y-1">
                               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">W-8BEN Status</p>
                               <p className="text-sm font-bold text-green-400">Valid until Dec 2026</p>
                            </div>
                            <div className="space-y-1">
                               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">TCS Applicability</p>
                               <p className="text-sm font-bold">20% Above ₹7,00,000</p>
                            </div>
                            <div className="space-y-1">
                               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Reporting Currency</p>
                               <p className="text-sm font-bold">USD (US Equity Only)</p>
                            </div>
                         </div>
                      </div>
                   </div>
                )}

                {/* View: API Keys */}
                {activeView === "api" && (
                   <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 max-w-4xl">
                      <div className="flex flex-col gap-2">
                         <h1 className="text-3xl font-black tracking-tighter">US Broker API</h1>
                         <p className="text-muted-foreground text-sm font-bold uppercase tracking-widest opacity-60">Programmatic Access to US Markets</p>
                      </div>

                      <Card className="border-none shadow-2xl rounded-3xl bg-slate-900 text-white p-8">
                         <div className="flex items-start justify-between mb-8">
                            <div className="flex items-center gap-4">
                               <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                                  <Key className="h-6 w-6 text-white" />
                               </div>
                               <div>
                                  <h3 className="text-xl font-black">Live API Credentials</h3>
                                  <p className="text-xs text-white/50 font-bold uppercase tracking-widest">Use these for your custom trading bots</p>
                               </div>
                            </div>
                            <Button className="bg-white text-black hover:bg-white/90 rounded-full font-black px-8">REGENERATE</Button>
                         </div>

                         <div className="space-y-4">
                            <div className="p-6 bg-white/5 rounded-2xl border border-white/10 space-y-4">
                               <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">API KEY ID</span>
                                  <Badge variant="outline" className="text-green-400 border-green-400/30 text-[9px]">ACTIVE</Badge>
                               </div>
                               <div className="flex items-center justify-between font-mono text-sm bg-black/40 p-4 rounded-xl">
                                  <span className="opacity-80">AKP_2938475520193847</span>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white/50 hover:text-white"><Copy className="h-4 w-4" /></Button>
                               </div>
                            </div>

                            <div className="p-6 bg-white/5 rounded-2xl border border-white/10 space-y-4">
                               <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">SECRET KEY</span>
                                  <span className="text-[10px] font-bold text-white/30 italic">Hidden for security</span>
                               </div>
                               <div className="flex items-center justify-between font-mono text-sm bg-black/40 p-4 rounded-xl">
                                  <span className="opacity-80">••••••••••••••••••••••••••••••••</span>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white/50 hover:text-white"><ExternalLink className="h-4 w-4" /></Button>
                               </div>
                            </div>
                         </div>
                      </Card>

                      <div className="p-6 rounded-3xl bg-muted/20 border-2 border-dashed border-muted text-center flex flex-col items-center gap-4">
                         <Terminal className="h-8 w-8 text-muted-foreground opacity-30" />
                         <p className="text-sm font-bold text-muted-foreground">Looking for API documentation? <span className="text-primary cursor-pointer hover:underline font-medium">View Alpaca API Docs</span></p>
                      </div>
                   </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
