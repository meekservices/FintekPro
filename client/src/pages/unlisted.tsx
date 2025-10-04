import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gem, TrendingUp, Calendar, IndianRupee, Building2, Calculator, Star, Eye, Lock } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

// Unlisted Securities Categories Component
function UnlistedCategoriesSection() {
  const [selectedCategory, setSelectedCategory] = useState("all");

  const unlistedCategories = [
    {
      id: "pre-ipo",
      name: "Pre-IPO Shares",
      description: "Exclusive access to companies before they go public",
      icon: "TrendingUp",
      color: "blue",
      yieldRange: "15-40% p.a.",
      minInvestment: "₹1,00,000",
      count: 45,
      riskLevel: "High",
      companies: ["Flipkart", "OYO", "Paytm Mall", "Swiggy"]
    },
    {
      id: "startup-equity",
      name: "Startup Equity",
      description: "Early-stage startup investments with high growth potential",
      icon: "Building2", 
      color: "green",
      yieldRange: "20-100% p.a.",
      minInvestment: "₹2,50,000",
      count: 32,
      riskLevel: "Very High",
      companies: ["Zerodha", "Razorpay", "CRED", "Meesho"]
    },
    {
      id: "unicorn-stakes",
      name: "Unicorn Stakes",
      description: "Secondary market trading in unicorn company shares",
      icon: "Star",
      color: "purple",
      yieldRange: "10-30% p.a.",
      minInvestment: "₹5,00,000",
      count: 18,
      riskLevel: "High",
      companies: ["Byju's", "Dream11", "Unacademy", "Vedantu"]
    },
    {
      id: "esop-buybacks",
      name: "ESOP Buybacks",
      description: "Employee stock option buyback opportunities",
      icon: "Gem",
      color: "yellow",
      yieldRange: "5-25% p.a.",
      minInvestment: "₹50,000",
      count: 67,
      riskLevel: "Medium",
      companies: ["Flipkart", "Zomato", "PolicyBazaar", "Freshworks"]
    }
  ];

  const getIcon = (iconName: string) => {
    const icons = { TrendingUp, Building2, Star, Gem };
    return icons[iconName as keyof typeof icons] || Gem;
  };

  return (
    <section>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Unlisted Securities Categories</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {unlistedCategories.map((category) => {
          const IconComponent = getIcon(category.icon);
          return (
            <Card key={category.id} className="hover:shadow-md transition-shadow cursor-pointer" data-testid={`${category.id}-unlisted`}>
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
                    <span>Expected Return:</span>
                    <span className="font-semibold text-finance-green">{category.yieldRange}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Min Investment:</span>
                    <span className="font-semibold">{category.minInvestment}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Available:</span>
                    <span className="font-semibold text-finance-blue">{category.count} opportunities</span>
                  </div>
                  <Badge variant="outline" className="w-full justify-center mt-2">
                    {category.riskLevel} Risk
                  </Badge>
                </div>
                <div className="mt-4">
                  <p className="text-xs text-gray-500 mb-2">Featured Companies:</p>
                  <div className="flex flex-wrap gap-1">
                    {category.companies.slice(0, 3).map((company, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">{company}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

// Main Unlisted Securities Page
export default function Unlisted() {
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
  const [selectedTab, setSelectedTab] = useState("explore");

  return (
    <div className="min-h-screen bg-finance-light" data-testid="unlisted-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8" data-testid="unlisted-header">
          <div className="flex items-center gap-3 mb-4">
            <Gem className="w-8 h-8 text-finance-blue" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Unlisted Securities</h1>
              <p className="text-gray-600">Exclusive access to pre-IPO and unlisted equity investments</p>
            </div>
          </div>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="explore" data-testid="tab-explore">Explore</TabsTrigger>
            <TabsTrigger value="portfolio" data-testid="tab-portfolio">My Investments</TabsTrigger>
            <TabsTrigger value="watchlist" data-testid="tab-watchlist">Watchlist</TabsTrigger>
            <TabsTrigger value="education" data-testid="tab-education">Learn</TabsTrigger>
          </TabsList>

          <TabsContent value="explore" className="space-y-6" data-testid="explore-unlisted">
            <UnlistedCategoriesSection />
            
            {/* Featured Opportunities */}
            <Card data-testid="card-featured-opportunities">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  Featured Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    {
                      name: "Flipkart Pre-IPO",
                      sector: "E-commerce",
                      valuation: "₹3.7L Cr",
                      minInvestment: "₹2,00,000",
                      expectedReturn: "25-35%",
                      timeFrame: "12-18 months",
                      badge: "Hot Deal"
                    },
                    {
                      name: "Zerodha Secondary",
                      sector: "Fintech",
                      valuation: "₹58,000 Cr",
                      minInvestment: "₹5,00,000",
                      expectedReturn: "15-25%",
                      timeFrame: "6-12 months",
                      badge: "Limited Slots"
                    },
                    {
                      name: "OYO ESOP Buyback",
                      sector: "Hospitality",
                      valuation: "₹45,000 Cr",
                      minInvestment: "₹1,00,000",
                      expectedReturn: "10-20%",
                      timeFrame: "3-6 months",
                      badge: "New"
                    }
                  ].map((opportunity, index) => (
                    <Card key={index} className="border-l-4 border-l-finance-blue">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold">{opportunity.name}</h4>
                          <Badge variant="secondary">{opportunity.badge}</Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{opportunity.sector}</p>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>Valuation:</span>
                            <span className="font-medium">{opportunity.valuation}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Min Investment:</span>
                            <span className="font-medium">{opportunity.minInvestment}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Expected Return:</span>
                            <span className="font-medium text-green-600">{opportunity.expectedReturn}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Time Frame:</span>
                            <span className="font-medium">{opportunity.timeFrame}</span>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button size="sm" className="flex-1">
                            <Eye className="w-4 h-4 mr-1" />
                            View Details
                          </Button>
                          <Button size="sm" variant="outline">
                            <Lock className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Investment Calculator */}
            <Card data-testid="card-unlisted-calculator">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-finance-blue" />
                  Unlisted Investment Calculator
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Investment Amount</label>
                    <Input placeholder="₹1,00,000" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Expected Return (%)</label>
                    <Input placeholder="25" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Time Period (Years)</label>
                    <Input placeholder="2" />
                  </div>
                </div>
                <Button className="mt-4">Calculate Returns</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="portfolio" className="space-y-6" data-testid="unlisted-portfolio">
            <Card>
              <CardHeader>
                <CardTitle>My Unlisted Investments</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Start investing in unlisted securities to track your portfolio here.</p>
                <Button className="mt-4">Explore Opportunities</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="watchlist" className="space-y-6" data-testid="unlisted-watchlist">
            <Card>
              <CardHeader>
                <CardTitle>My Watchlist</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Add unlisted securities to your watchlist to get updates on pricing and availability.</p>
                <Button className="mt-4">Browse Securities</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="education" className="space-y-6" data-testid="unlisted-education">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Understanding Unlisted Securities</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">
                    Learn about the risks and opportunities in unlisted securities investing.
                  </p>
                  <Button variant="outline">Read Guide</Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Pre-IPO Investment Strategy</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">
                    Discover how to evaluate pre-IPO opportunities and build a diversified portfolio.
                  </p>
                  <Button variant="outline">Learn More</Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}