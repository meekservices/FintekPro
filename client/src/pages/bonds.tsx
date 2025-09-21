import { EnhancedNavigation } from "@/components/layout/enhanced-navigation";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, TrendingUp, Calendar, IndianRupee, Building2, Calculator } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

// Bond Categories Component with Real-time Data
function BondCategoriesSection() {
  const { data: bondCategories, isLoading } = useQuery<Array<{
    id: string;
    name: string;
    icon: string;
    color: string;
    description: string;
    yieldRange: string;
    minInvestment: string;
    count: number;
    riskLevel: string;
  }>>({
    queryKey: ["/api/bonds/categories"],
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: liveRates } = useQuery({
    queryKey: ["/api/bonds/live-rates"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading || !bondCategories) {
    return (
      <section>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Bond Categories</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-48 bg-gray-200 rounded-lg"></div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const getIcon = (iconName: string) => {
    const icons = { Shield, TrendingUp, Building2, IndianRupee };
    return icons[iconName as keyof typeof icons] || Shield;
  };

  return (
    <section>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Bond Categories</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {bondCategories.map((category: any) => {
          const IconComponent = getIcon(category.icon);
          return (
            <Card key={category.id} className="hover:shadow-md transition-shadow cursor-pointer" data-testid={`${category.id}-bonds`}>
              <CardContent className="p-6">
                <div className={`w-12 h-12 bg-${category.color}-100 rounded-lg flex items-center justify-center mb-4`}>
                  <IconComponent className={`h-6 w-6 text-${category.color === 'blue' ? 'finance-blue' : category.color === 'green' ? 'finance-green' : category.color}-600`} />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{category.name}</h3>
                <p className="text-gray-600 text-sm mb-4">
                  {category.description}
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span>Yield:</span>
                    <span className="font-semibold text-finance-green">{category.yieldRange}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Min Investment:</span>
                    <span className="font-semibold">{category.minInvestment}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Available:</span>
                    <span className="font-semibold text-finance-blue">{category.count} bonds</span>
                  </div>
                  <Badge variant="outline" className="w-full justify-center mt-2">
                    {category.riskLevel} Risk
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

export default function Bonds() {
  // Navigation state for responsive layout
  const [isNavCollapsed, setIsNavCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('navigation-collapsed');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  // Listen for navigation state changes
  useEffect(() => {
    const handleNavChange = (event: CustomEvent) => {
      setIsNavCollapsed(event.detail.isCollapsed);
    };
    
    window.addEventListener('navigation-state-changed', handleNavChange as EventListener);
    return () => window.removeEventListener('navigation-state-changed', handleNavChange as EventListener);
  }, []);
  const [investmentAmount, setInvestmentAmount] = useState("");
  const [bondYield, setBondYield] = useState("");
  const [tenure, setTenure] = useState("");

  const calculateReturns = () => {
    const principal = parseFloat(investmentAmount) || 0;
    const rate = parseFloat(bondYield) / 100 || 0;
    const years = parseFloat(tenure) || 0;
    
    if (principal && rate && years) {
      const maturityAmount = principal * Math.pow(1 + rate, years);
      const interestEarned = maturityAmount - principal;
      return { maturityAmount, interestEarned };
    }
    return { maturityAmount: 0, interestEarned: 0 };
  };

  const { maturityAmount, interestEarned } = calculateReturns();

  return (
    <div className="min-h-screen bg-finance-light" data-testid="bonds-page">
      <EnhancedNavigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16 lg:pt-0">
        
        {/* Page Header */}
        <div className="mb-8" data-testid="bonds-header">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Bonds & NCDs</h1>
          <p className="text-gray-600 text-lg">
            Fixed income investments with guaranteed returns
          </p>
        </div>

        <Tabs defaultValue="explore" className="space-y-8">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="explore" data-testid="tab-explore">Explore Bonds</TabsTrigger>
            <TabsTrigger value="calculator" data-testid="tab-calculator">Bond Calculator</TabsTrigger>
            <TabsTrigger value="portfolio" data-testid="tab-portfolio">My Bonds</TabsTrigger>
            <TabsTrigger value="education" data-testid="tab-education">Learn</TabsTrigger>
          </TabsList>

          <TabsContent value="explore" className="space-y-6" data-testid="explore-bonds">
            
            {/* Filter Section */}
            <div className="p-6 bg-white rounded-xl border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Select>
                  <SelectTrigger data-testid="bond-type-select">
                    <SelectValue placeholder="Bond Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="government">Government Bonds</SelectItem>
                    <SelectItem value="corporate">Corporate Bonds</SelectItem>
                    <SelectItem value="ncd">NCDs</SelectItem>
                    <SelectItem value="tax-free">Tax Free Bonds</SelectItem>
                  </SelectContent>
                </Select>

                <Select>
                  <SelectTrigger data-testid="yield-range-select">
                    <SelectValue placeholder="Yield Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5-7">5% - 7%</SelectItem>
                    <SelectItem value="7-9">7% - 9%</SelectItem>
                    <SelectItem value="9-12">9% - 12%</SelectItem>
                    <SelectItem value="12+">12%+</SelectItem>
                  </SelectContent>
                </Select>

                <Select>
                  <SelectTrigger data-testid="tenure-select">
                    <SelectValue placeholder="Tenure" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1-2">1-2 Years</SelectItem>
                    <SelectItem value="2-5">2-5 Years</SelectItem>
                    <SelectItem value="5-10">5-10 Years</SelectItem>
                    <SelectItem value="10+">10+ Years</SelectItem>
                  </SelectContent>
                </Select>

                <Select>
                  <SelectTrigger data-testid="rating-select">
                    <SelectValue placeholder="Credit Rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aaa">AAA</SelectItem>
                    <SelectItem value="aa">AA+/AA/AA-</SelectItem>
                    <SelectItem value="a">A+/A/A-</SelectItem>
                    <SelectItem value="bbb">BBB+/BBB/BBB-</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Bond Categories - Real-time data */}
            <BondCategoriesSection />

            {/* Available Bonds */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Available Bonds</h2>
              <Card className="border-dashed border-2 border-gray-300">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Shield className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Bond Data Not Available</h3>
                  <p className="text-gray-500 text-center">
                    Live bond offerings will be displayed here when integrated with authorized bond platforms
                  </p>
                </CardContent>
              </Card>
            </section>

          </TabsContent>

          <TabsContent value="calculator" className="space-y-6" data-testid="bond-calculator">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-finance-blue" />
                    Bond Returns Calculator
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Investment Amount (₹)
                    </label>
                    <Input 
                      type="number" 
                      placeholder="1,00,000" 
                      value={investmentAmount}
                      onChange={(e) => setInvestmentAmount(e.target.value)}
                      data-testid="investment-amount"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Annual Yield (%)
                    </label>
                    <Input 
                      type="number" 
                      placeholder="8.5" 
                      value={bondYield}
                      onChange={(e) => setBondYield(e.target.value)}
                      data-testid="bond-yield"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Tenure (Years)
                    </label>
                    <Input 
                      type="number" 
                      placeholder="5" 
                      value={tenure}
                      onChange={(e) => setTenure(e.target.value)}
                      data-testid="bond-tenure"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Returns Projection</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="text-center p-6 bg-blue-50 rounded-lg">
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Maturity Amount</h3>
                      <p className="text-3xl font-bold text-finance-blue" data-testid="maturity-amount">
                        ₹{maturityAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-700 mb-1">Principal</h4>
                        <p className="text-lg font-bold text-finance-green" data-testid="principal-amount">
                          ₹{parseFloat(investmentAmount || "0").toLocaleString()}
                        </p>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-700 mb-1">Interest Earned</h4>
                        <p className="text-lg font-bold text-purple-600" data-testid="interest-earned">
                          ₹{interestEarned.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                      </div>
                    </div>

                    {investmentAmount && bondYield && tenure && (
                      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-semibold text-gray-900 mb-2">Investment Summary</h4>
                        <div className="space-y-1 text-sm text-gray-600">
                          <p>Monthly Interest: ₹{((parseFloat(investmentAmount) * parseFloat(bondYield)) / 100 / 12).toLocaleString()}</p>
                          <p>Annual Interest: ₹{((parseFloat(investmentAmount) * parseFloat(bondYield)) / 100).toLocaleString()}</p>
                          <p>Total Returns: {((interestEarned / parseFloat(investmentAmount)) * 100).toFixed(1)}%</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

            </div>
          </TabsContent>

          <TabsContent value="portfolio" className="space-y-6" data-testid="bonds-portfolio">
            <Card className="border-dashed border-2 border-gray-300">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Bond Holdings</h3>
                <p className="text-gray-500 text-center mb-4">
                  Your bond investments will appear here
                </p>
                <Button variant="outline">Invest in Bonds</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="education" className="space-y-6" data-testid="bonds-education">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-bold text-gray-900 mb-4">What are Bonds?</h3>
                  <p className="text-gray-600 mb-4">
                    Bonds are debt securities where you lend money to an issuer (government or corporation) 
                    for a defined period at a fixed interest rate.
                  </p>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li>• Fixed income with predictable returns</li>
                    <li>• Lower risk compared to equity investments</li>
                    <li>• Regular interest payments</li>
                    <li>• Principal amount returned at maturity</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <h3 className="font-bold text-gray-900 mb-4">Benefits of Bond Investment</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Shield className="h-5 w-5 text-finance-blue mt-0.5" />
                      <div>
                        <h4 className="font-medium text-gray-900">Capital Protection</h4>
                        <p className="text-sm text-gray-600">Your principal is protected</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <IndianRupee className="h-5 w-5 text-finance-green mt-0.5" />
                      <div>
                        <h4 className="font-medium text-gray-900">Regular Income</h4>
                        <p className="text-sm text-gray-600">Fixed periodic interest payments</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <TrendingUp className="h-5 w-5 text-purple-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-gray-900">Portfolio Diversification</h4>
                        <p className="text-sm text-gray-600">Reduce overall portfolio risk</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>
          </TabsContent>
        </Tabs>

      </main>

      <Footer />
    </div>
  );
}
