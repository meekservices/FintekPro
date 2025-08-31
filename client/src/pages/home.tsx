import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { MarketTicker } from "@/components/dashboard/market-ticker";
import { MarketChart } from "@/components/dashboard/market-chart";
import { PortfolioSummary } from "@/components/dashboard/portfolio-summary";
import { MarketMovers } from "@/components/dashboard/market-movers";
import { MarketNews } from "@/components/dashboard/market-news";
import { ServicesGrid } from "@/components/dashboard/services-grid";
import { AssetAllocation } from "@/components/dashboard/asset-allocation";
import { RebalanceDashboard } from "@/components/dashboard/rebalance-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calculator, Home as HomeIcon, Percent, Umbrella, CheckCircle, Shield, Database, TrendingUp, Banknote, BarChart3, Coins, Wheat, Building2, CreditCard, PiggyBank, FileText, Building, Briefcase, Target, PieChart, Landmark, Receipt, BookOpen, Activity } from "lucide-react";
import { AgriculturalTooltip } from "@/components/agricultural-tooltip";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

export default function Home() {
  // Get authenticated user data
  const { data: user } = useQuery({ queryKey: ["/api/user"], retry: false });
  const userId = (user as any)?.id || "demo-user-1";
  const portfolioId = `portfolio-${userId}`;
  
  // Fetch real-time portfolio value
  const { data: portfolios } = useQuery({
    queryKey: ["/api/portfolios", userId],
    enabled: !!userId,
  });
  
  const { data: holdings } = useQuery({
    queryKey: ["/api/portfolios", portfolioId, "holdings"],
    enabled: !!portfolioId,
  });
  
  // Calculate total value from actual holdings
  const totalValue = Array.isArray(holdings) ? holdings.reduce((sum: number, holding: any) => {
    return sum + (holding.currentValue || 0);
  }, 0) : 1250000; // Default fallback
  

  const calculators = [
    {
      id: "sip",
      name: "SIP Calculator",
      description: "Calculate your SIP returns and plan investments",
      icon: Calculator,
      color: "blue"
    },
    {
      id: "emi",
      name: "EMI Calculator", 
      description: "Calculate loan EMI for home, car, personal loans",
      icon: HomeIcon,
      color: "green"
    },
    {
      id: "retirement",
      name: "Retirement Calculator",
      description: "Plan your retirement corpus and goals",
      icon: Umbrella,
      color: "purple"
    },
    {
      id: "tax",
      name: "Tax Calculator",
      description: "Calculate income tax and plan savings", 
      icon: Percent,
      color: "orange"
    }
  ];

  const colorClasses = {
    blue: "text-finance-blue",
    green: "text-finance-green", 
    purple: "text-purple-600",
    orange: "text-orange-600"
  };

  return (
    <div className="min-h-screen bg-finance-light" data-testid="home-page">
      <Header />
      <MarketTicker />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Hero Section */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8" data-testid="hero-section">
          <MarketChart symbol="^NSEI" />
          <PortfolioSummary userId={userId} />
        </section>

        {/* Active Endpoints Based on Client Profile */}
        <section className="mb-8" data-testid="client-endpoints-section">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Your Active Services</h2>
            <Badge className="bg-finance-green text-white text-base px-3 py-1">12+ Services Enabled</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Portfolio Management */}
            <Link href="/portfolio" data-testid="link-portfolio">
              <Card className="border-l-4 border-l-blue-500 hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-lg">
                    <PieChart className="h-5 w-5 mr-2 text-blue-500 group-hover:scale-110 transition-transform" />
                    Portfolio Tracking
                    <Badge className="ml-2 bg-finance-green text-white text-xs">Active</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">✓ Real-time portfolio value</p>
                    <p className="text-sm text-gray-600">✓ Asset allocation analysis</p>
                    <p className="text-sm text-gray-600">✓ Performance tracking</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Market Data */}
            <Link href="/markets" data-testid="link-markets">
              <Card className="border-l-4 border-l-green-500 hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-lg">
                    <TrendingUp className="h-5 w-5 mr-2 text-green-500 group-hover:scale-110 transition-transform" />
                    Market Data
                    <Badge className="ml-2 bg-finance-green text-white text-xs">Live</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">✓ NSE & BSE live quotes</p>
                    <p className="text-sm text-gray-600">✓ Market indices tracking</p>
                    <p className="text-sm text-gray-600">✓ Real-time price updates</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Mutual Funds */}
            <Link href="/mutual-funds" data-testid="link-mutual-funds">
              <Card className="border-l-4 border-l-purple-500 hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-lg">
                    <Target className="h-5 w-5 mr-2 text-purple-500 group-hover:scale-110 transition-transform" />
                    Mutual Funds
                    <Badge className="ml-2 bg-finance-green text-white text-xs">AMFI</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">✓ Live NAV data</p>
                    <p className="text-sm text-gray-600">✓ SIP calculator</p>
                    <p className="text-sm text-gray-600">✓ Scheme comparison</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Financial Calculators */}
            <Link href="/calculators" data-testid="link-calculators">
              <Card className="border-l-4 border-l-orange-500 hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-lg">
                    <Calculator className="h-5 w-5 mr-2 text-orange-500 group-hover:scale-110 transition-transform" />
                    Calculators
                    <Badge className="ml-2 bg-finance-green text-white text-xs">Tools</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">✓ SIP & EMI calculators</p>
                    <p className="text-sm text-gray-600">✓ Tax planning tools</p>
                    <p className="text-sm text-gray-600">✓ Retirement planning</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Bonds & Fixed Income */}
            <Link href="/unlisted" data-testid="link-unlisted">
              <Card className="border-l-4 border-l-indigo-500 hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-lg">
                    <Receipt className="h-5 w-5 mr-2 text-indigo-500 group-hover:scale-110 transition-transform" />
                    Unlisted Securities
                    <Badge className="ml-2 bg-finance-green text-white text-xs">Multi-Exchange</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">✓ Pre-IPO shares</p>
                    <p className="text-sm text-gray-600">✓ Startup equity</p>
                    <p className="text-sm text-gray-600">✓ Unicorn stakes</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* IPO Services */}
            <Link href="/ipo" data-testid="link-ipo">
              <Card className="border-l-4 border-l-red-500 hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-lg">
                    <Building className="h-5 w-5 mr-2 text-red-500 group-hover:scale-110 transition-transform" />
                    IPO Center
                    <Badge className="ml-2 bg-finance-green text-white text-xs">NSE/BSE</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">✓ Current IPO listings</p>
                    <p className="text-sm text-gray-600">✓ Application tracking</p>
                    <p className="text-sm text-gray-600">✓ Allotment status</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Loan Services */}
            <Link href="/loans" data-testid="link-loans">
              <Card className="border-l-4 border-l-yellow-500 hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-lg">
                    <CreditCard className="h-5 w-5 mr-2 text-yellow-500 group-hover:scale-110 transition-transform" />
                    Loan Services
                    <Badge className="ml-2 bg-finance-green text-white text-xs">Partner</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">✓ Personal loans</p>
                    <p className="text-sm text-gray-600">✓ Home loans</p>
                    <p className="text-sm text-gray-600">✓ Loan against securities</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* CAMS Integration */}
            <Link href="/cams" data-testid="link-cams">
              <Card className="border-l-4 border-l-teal-500 hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-lg">
                    <Landmark className="h-5 w-5 mr-2 text-teal-500 group-hover:scale-110 transition-transform" />
                    CAMS Registry
                    <Badge className="ml-2 bg-finance-green text-white text-xs">Active</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">✓ Mutual fund operations</p>
                    <p className="text-sm text-gray-600">✓ Account statements</p>
                    <p className="text-sm text-gray-600">✓ Investor services</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* KFintech Integration */}
            <Link href="/kfintech" data-testid="link-kfintech">
              <Card className="border-l-4 border-l-violet-500 hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-lg">
                    <Database className="h-5 w-5 mr-2 text-violet-500 group-hover:scale-110 transition-transform" />
                    KFintech Registry
                    <Badge className="ml-2 bg-finance-green text-white text-xs">Live</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">✓ MF portfolio tracking</p>
                    <p className="text-sm text-gray-600">✓ Transaction processing</p>
                    <p className="text-sm text-gray-600">✓ Investor validation</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Interactive Brokers Trading */}
            <Link href="/ib-trading" data-testid="link-ib-trading">
              <Card className="border-l-4 border-l-cyan-500 hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-lg">
                    <Activity className="h-5 w-5 mr-2 text-cyan-500 group-hover:scale-110 transition-transform" />
                    IB Trading
                    <Badge className="ml-2 bg-finance-green text-white text-xs">API</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">✓ Real-time trading</p>
                    <p className="text-sm text-gray-600">✓ Advanced orders</p>
                    <p className="text-sm text-gray-600">✓ Global markets</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </section>

        {/* Quick Access Services Navigation */}
        <section className="mb-8" data-testid="services-navigation">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Financial Services</h2>
            <Badge className="bg-finance-blue text-white text-base px-3 py-1">All Services</Badge>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            <Link href="/mutual-funds">
              <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group border-l-4 border-l-blue-500">
                <CardContent className="p-4 text-center">
                  <PieChart className="h-8 w-8 mx-auto mb-3 text-blue-500 group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold text-sm text-gray-900 mb-1">Mutual Funds</h3>
                  <p className="text-xs text-gray-600">AMFI integrated</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/bonds">
              <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group border-l-4 border-l-green-500">
                <CardContent className="p-4 text-center">
                  <Receipt className="h-8 w-8 mx-auto mb-3 text-green-500 group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold text-sm text-gray-900 mb-1">Bonds Trading</h3>
                  <p className="text-xs text-gray-600">Multi-exchange</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/ipo">
              <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group border-l-4 border-l-purple-500">
                <CardContent className="p-4 text-center">
                  <Building className="h-8 w-8 mx-auto mb-3 text-purple-500 group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold text-sm text-gray-900 mb-1">IPO Center</h3>
                  <p className="text-xs text-gray-600">NSE/BSE IPOs</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/loans">
              <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group border-l-4 border-l-orange-500">
                <CardContent className="p-4 text-center">
                  <CreditCard className="h-8 w-8 mx-auto mb-3 text-orange-500 group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold text-sm text-gray-900 mb-1">Loans</h3>
                  <p className="text-xs text-gray-600">Personal & Home</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/nsdl-services">
              <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group border-l-4 border-l-red-500">
                <CardContent className="p-4 text-center">
                  <Shield className="h-8 w-8 mx-auto mb-3 text-red-500 group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold text-sm text-gray-900 mb-1">NSDL Services</h3>
                  <p className="text-xs text-gray-600">Demat & holdings</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/cdsl-services">
              <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group border-l-4 border-l-yellow-500">
                <CardContent className="p-4 text-center">
                  <Database className="h-8 w-8 mx-auto mb-3 text-yellow-500 group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold text-sm text-gray-900 mb-1">CDSL Services</h3>
                  <p className="text-xs text-gray-600">BO management</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/calculators">
              <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group border-l-4 border-l-indigo-500">
                <CardContent className="p-4 text-center">
                  <Calculator className="h-8 w-8 mx-auto mb-3 text-indigo-500 group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold text-sm text-gray-900 mb-1">Calculators</h3>
                  <p className="text-xs text-gray-600">SIP, EMI, Tax</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/agricultural-insights">
              <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group border-l-4 border-l-emerald-500">
                <CardContent className="p-4 text-center">
                  <Wheat className="h-8 w-8 mx-auto mb-3 text-emerald-500 group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold text-sm text-gray-900 mb-1">Agricultural</h3>
                  <p className="text-xs text-gray-600">NCDEX insights</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/capital-gains">
              <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group border-l-4 border-l-teal-500">
                <CardContent className="p-4 text-center">
                  <FileText className="h-8 w-8 mx-auto mb-3 text-teal-500 group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold text-sm text-gray-900 mb-1">Capital Gains</h3>
                  <p className="text-xs text-gray-600">Tax reports</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/achievements">
              <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group border-l-4 border-l-pink-500">
                <CardContent className="p-4 text-center">
                  <Target className="h-8 w-8 mx-auto mb-3 text-pink-500 group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold text-sm text-gray-900 mb-1">Achievements</h3>
                  <p className="text-xs text-gray-600">Learning goals</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/partner">
              <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group border-l-4 border-l-cyan-500">
                <CardContent className="p-4 text-center">
                  <Briefcase className="h-8 w-8 mx-auto mb-3 text-cyan-500 group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold text-sm text-gray-900 mb-1">Partner Portal</h3>
                  <p className="text-xs text-gray-600">Business tools</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/whatsapp-login">
              <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group border-l-4 border-l-lime-500">
                <CardContent className="p-4 text-center">
                  <BookOpen className="h-8 w-8 mx-auto mb-3 text-lime-500 group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold text-sm text-gray-900 mb-1">WhatsApp Auth</h3>
                  <p className="text-xs text-gray-600">Phone login</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/cams">
              <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group border-l-4 border-l-amber-500">
                <CardContent className="p-4 text-center">
                  <Landmark className="h-8 w-8 mx-auto mb-3 text-amber-500 group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold text-sm text-gray-900 mb-1">CAMS Registry</h3>
                  <p className="text-xs text-gray-600">MF operations</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/kfintech">
              <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group border-l-4 border-l-violet-500">
                <CardContent className="p-4 text-center">
                  <Database className="h-8 w-8 mx-auto mb-3 text-violet-500 group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold text-sm text-gray-900 mb-1">KFintech</h3>
                  <p className="text-xs text-gray-600">MF registry</p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </section>

        {/* Services Grid */}
        <ServicesGrid />

        {/* Market Data Section */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8" data-testid="market-data-section">
          <MarketMovers />
          <MarketNews />
        </section>

        {/* Asset Allocation Dashboard */}
        <AssetAllocation portfolioId={portfolioId} />

        {/* Rebalance Dashboard */}
        <RebalanceDashboard portfolioId={portfolioId} totalValue={totalValue} />

        {/* Financial Calculators Section */}
        <section className="mb-8" data-testid="calculators-section">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Financial Calculators</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {calculators.map((calculator) => {
              const IconComponent = calculator.icon;
              return (
                <Card 
                  key={calculator.id}
                  className="hover:shadow-md transition-shadow cursor-pointer group"
                  data-testid={`calculator-${calculator.id}`}
                >
                  <CardContent className="p-6">
                    <IconComponent 
                      className={`h-8 w-8 mb-4 ${colorClasses[calculator.color as keyof typeof colorClasses]}`}
                    />
                    <h3 className="font-bold text-gray-900 mb-2">
                      {calculator.name}
                    </h3>
                    <p className="text-gray-600 text-sm mb-4">
                      {calculator.description}
                    </p>
                    <Button 
                      variant="link" 
                      className="p-0 text-finance-blue font-medium hover:underline group-hover:text-blue-700 transition-colors"
                      data-testid={`calculator-cta-${calculator.id}`}
                    >
                      Calculate →
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
