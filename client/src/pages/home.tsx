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
import { TutorialOverlay, TutorialTrigger, useTutorial } from "@/components/tutorial";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calculator, Home as HomeIcon, Percent, Umbrella, CheckCircle, Shield, Database, TrendingUp, Banknote, BarChart3, Coins, Wheat } from "lucide-react";

export default function Home() {
  // Mock user ID for demo purposes
  const userId = "demo-user-1";
  const portfolioId = "demo-portfolio-1";
  const totalValue = 1250000; // ₹12.5 Lakhs
  
  // Tutorial management
  const {
    isActive: isTutorialActive,
    currentStep,
    isCompleted: isTutorialCompleted,
    steps: tutorialSteps,
    startTutorial,
    closeTutorial,
    completeTutorial,
    goToStep
  } = useTutorial();

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
      <Header onStartTutorial={startTutorial} />
      <MarketTicker />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Tutorial Section */}
        {!isTutorialCompleted && (
          <section className="mb-8" data-testid="tutorial-section">
            <TutorialTrigger 
              onStart={startTutorial} 
              isCompleted={isTutorialCompleted} 
            />
          </section>
        )}

        {/* Hero Section */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8" data-testid="hero-section">
          <MarketChart symbol="^NSEI" />
          <PortfolioSummary userId={userId} />
        </section>

        {/* API Integration Status */}
        <section className="mb-8" data-testid="api-status-section">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Comprehensive Financial API Integration</h2>
            <Badge className="bg-finance-green text-white text-base px-3 py-1">90+ Endpoints Active</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="border-l-4 border-l-yellow-500">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  <Coins className="h-5 w-5 mr-2 text-yellow-500" />
                  MCX Commodities
                  <Badge className="ml-2 bg-finance-green text-white">Live</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">✓ Real-time commodity prices</p>
                  <p className="text-sm text-gray-600">✓ Gold, Silver & Energy</p>
                  <p className="text-sm text-gray-600">✓ Base metals tracking</p>
                  <p className="text-sm text-gray-600">✓ Market status & timings</p>
                  <p className="text-sm text-gray-600">✓ Open interest data</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-l-4 border-l-green-600">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  <Wheat className="h-5 w-5 mr-2 text-green-600" />
                  NCDEX Agricultural
                  <Badge className="ml-2 bg-finance-green text-white">Live</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">✓ Agricultural commodity prices</p>
                  <p className="text-sm text-gray-600">✓ Spices, Pulses & Grains</p>
                  <p className="text-sm text-gray-600">✓ Oilseeds & Cotton futures</p>
                  <p className="text-sm text-gray-600">✓ Market timings & status</p>
                  <p className="text-sm text-gray-600">✓ Volume & open interest</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  <TrendingUp className="h-5 w-5 mr-2 text-green-500" />
                  NSE India API
                  <Badge className="ml-2 bg-finance-green text-white">Live</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">✓ Real-time NSE quotes</p>
                  <p className="text-sm text-gray-600">✓ Live indices data</p>
                  <p className="text-sm text-gray-600">✓ Gainers & losers</p>
                  <p className="text-sm text-gray-600">✓ Historical price data</p>
                  <p className="text-sm text-gray-600">✓ Market status updates</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  <BarChart3 className="h-5 w-5 mr-2 text-orange-500" />
                  BSE India API
                  <Badge className="ml-2 bg-finance-green text-white">Live</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">✓ Real-time BSE quotes</p>
                  <p className="text-sm text-gray-600">✓ Live indices data</p>
                  <p className="text-sm text-gray-600">✓ Top gainers & losers</p>
                  <p className="text-sm text-gray-600">✓ Top turnovers</p>
                  <p className="text-sm text-gray-600">✓ Stock search & details</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-finance-blue">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  <Database className="h-5 w-5 mr-2 text-finance-blue" />
                  Finnhub Market Data
                  <Badge className="ml-2 bg-finance-green text-white">Premium</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">✓ Real-time stock prices</p>
                  <p className="text-sm text-gray-600">✓ Earnings & financial metrics</p>
                  <p className="text-sm text-gray-600">✓ Analyst recommendations</p>
                  <p className="text-sm text-gray-600">✓ Insider trading data</p>
                  <p className="text-sm text-gray-600">✓ Financial news & sentiment</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-finance-purple">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  <TrendingUp className="h-5 w-5 mr-2 text-finance-purple" />
                  MF Central API
                  <Badge className="ml-2 bg-finance-green text-white">Enhanced</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">✓ SIP & lumpsum calculators</p>
                  <p className="text-sm text-gray-600">✓ Portfolio analytics & comparison</p>
                  <p className="text-sm text-gray-600">✓ Goal planning tools</p>
                  <p className="text-sm text-gray-600">✓ Holdings import & tracking</p>
                  <p className="text-sm text-gray-600">✓ NAV history & performance</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-finance-red">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  <Shield className="h-5 w-5 mr-2 text-finance-red" />
                  NSDL Services
                  <Badge className="ml-2 bg-finance-green text-white">Complete</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">✓ Demat account management</p>
                  <p className="text-sm text-gray-600">✓ Corporate actions tracking</p>
                  <p className="text-sm text-gray-600">✓ Portfolio analytics dashboard</p>
                  <p className="text-sm text-gray-600">✓ eDIS & margin facilities</p>
                  <p className="text-sm text-gray-600">✓ LAS & transaction history</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  <Database className="h-5 w-5 mr-2 text-orange-500" />
                  CDSL Services
                  <Badge className="ml-2 bg-finance-green text-white">Advanced</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">✓ DESTAT statement generation</p>
                  <p className="text-sm text-gray-600">✓ Repledge & unpledge services</p>
                  <p className="text-sm text-gray-600">✓ Easiest portal integration</p>
                  <p className="text-sm text-gray-600">✓ BO account & eDIS services</p>
                  <p className="text-sm text-gray-600">✓ eLAS & transaction tracking</p>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Detailed API Features Breakdown */}
          <div className="bg-white rounded-lg border p-6 mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Complete Feature Coverage</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <h4 className="font-semibold text-finance-blue mb-3 flex items-center">
                  <Database className="h-4 w-4 mr-2" />
                  Finnhub Premium
                </h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• Market quotes & indices</li>
                  <li>• Earnings calendar</li>
                  <li>• Analyst recommendations</li>
                  <li>• Insider trading alerts</li>
                  <li>• Financial news sentiment</li>
                  <li>• Historical price data</li>
                  <li>• Company fundamentals</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold text-finance-purple mb-3 flex items-center">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  MF Central Pro
                </h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• SIP calculator</li>
                  <li>• Lumpsum planner</li>
                  <li>• Scheme comparison</li>
                  <li>• Goal-based planning</li>
                  <li>• NAV tracking</li>
                  <li>• Holdings import</li>
                  <li>• Performance analytics</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold text-finance-red mb-3 flex items-center">
                  <Shield className="h-4 w-4 mr-2" />
                  NSDL Complete
                </h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• Demat account services</li>
                  <li>• Corporate actions</li>
                  <li>• Portfolio analytics</li>
                  <li>• eDIS transactions</li>
                  <li>• Margin pledge</li>
                  <li>• LAS (Loan against Securities)</li>
                  <li>• Transaction history</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold text-orange-500 mb-3 flex items-center">
                  <Banknote className="h-4 w-4 mr-2" />
                  CDSL Advanced
                </h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• DESTAT generation</li>
                  <li>• Repledge services</li>
                  <li>• Unpledge requests</li>
                  <li>• Easiest portal</li>
                  <li>• BO account management</li>
                  <li>• eDIS & e-voting</li>
                  <li>• eLAS facilities</li>
                </ul>
              </div>
            </div>
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
      
      {/* Tutorial Overlay */}
      <TutorialOverlay
        isActive={isTutorialActive}
        onClose={closeTutorial}
        onComplete={completeTutorial}
        steps={tutorialSteps}
        currentStep={currentStep}
        onStepChange={goToStep}
      />
    </div>
  );
}
