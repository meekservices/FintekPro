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
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calculator, Home as HomeIcon, Percent, Umbrella } from "lucide-react";

export default function Home() {
  // Mock user ID for demo purposes
  const userId = "demo-user-1";
  const portfolioId = "demo-portfolio-1";
  const totalValue = 1250000; // ₹12.5 Lakhs

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
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8" data-testid="hero-section">
          <MarketChart symbol="^NSEI" />
          <PortfolioSummary userId={userId} />
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
