import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, TrendingUp, TrendingDown, Star, Filter, Calculator } from "lucide-react";
import { useState } from "react";

export default function MutualFunds() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  const categories = [
    "All Categories",
    "Equity",
    "Debt", 
    "Hybrid",
    "ELSS",
    "Index",
    "Sectoral"
  ];

  return (
    <div className="min-h-screen bg-finance-light" data-testid="mutual-funds-page">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
        
        {/* Page Header */}
        <div className="mb-8" data-testid="mf-header">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Mutual Funds</h1>
          <p className="text-gray-600 text-lg">
            Invest in direct mutual funds with zero commission
          </p>
        </div>

        {/* Search and Filter */}
        <div className="mb-8 p-6 bg-white rounded-xl border border-gray-200" data-testid="search-filter">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Input
                type="text"
                placeholder="Search mutual funds..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="mf-search-input"
              />
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            </div>
            
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger data-testid="category-select">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select>
              <SelectTrigger data-testid="risk-select">
                <SelectValue placeholder="Risk Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low Risk</SelectItem>
                <SelectItem value="moderate">Moderate Risk</SelectItem>
                <SelectItem value="high">High Risk</SelectItem>
                <SelectItem value="very-high">Very High Risk</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              More Filters
            </Button>
          </div>
        </div>

        <Tabs defaultValue="explore" className="space-y-8">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="explore" data-testid="tab-explore">Explore Funds</TabsTrigger>
            <TabsTrigger value="sip" data-testid="tab-sip">Start SIP</TabsTrigger>
            <TabsTrigger value="portfolio" data-testid="tab-portfolio">My Portfolio</TabsTrigger>
            <TabsTrigger value="tools" data-testid="tab-tools">Tools</TabsTrigger>
          </TabsList>

          <TabsContent value="explore" className="space-y-6" data-testid="explore-funds">
            
            {/* Top Performing Funds */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Top Performing Funds</h2>
              <div className="space-y-4">
                <Card className="border-dashed border-2 border-gray-300">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <TrendingUp className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Fund Data Not Available</h3>
                    <p className="text-gray-500 text-center">
                      Mutual fund data will be displayed here when integrated with authorized fund sources
                    </p>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Fund Categories */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Fund Categories</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {categories.slice(1).map((category, index) => (
                  <Card key={category} className="hover:shadow-md transition-shadow cursor-pointer" data-testid={`category-${category.toLowerCase()}`}>
                    <CardContent className="p-6 text-center">
                      <div className={`w-12 h-12 mx-auto mb-4 rounded-lg flex items-center justify-center ${
                        index % 4 === 0 ? 'bg-blue-100' : 
                        index % 4 === 1 ? 'bg-green-100' :
                        index % 4 === 2 ? 'bg-purple-100' : 'bg-yellow-100'
                      }`}>
                        <TrendingUp className={`h-6 w-6 ${
                          index % 4 === 0 ? 'text-finance-blue' : 
                          index % 4 === 1 ? 'text-finance-green' :
                          index % 4 === 2 ? 'text-purple-600' : 'text-yellow-600'
                        }`} />
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-1">{category}</h3>
                      <p className="text-sm text-gray-600">0 Funds</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

          </TabsContent>

          <TabsContent value="sip" className="space-y-6" data-testid="start-sip">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-finance-blue" />
                    SIP Calculator
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Monthly Investment Amount
                    </label>
                    <Input type="number" placeholder="₹5,000" data-testid="sip-amount" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Investment Period (Years)
                    </label>
                    <Input type="number" placeholder="10" data-testid="sip-years" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Expected Returns (% p.a.)
                    </label>
                    <Input type="number" placeholder="12" data-testid="sip-returns" />
                  </div>
                  <Button className="w-full bg-finance-blue hover:bg-blue-700" data-testid="calculate-sip">
                    Calculate SIP Returns
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Start Your SIP Journey</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center py-8">
                    <TrendingUp className="h-12 w-12 text-finance-blue mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Build Wealth Systematically</h3>
                    <p className="text-gray-600 mb-4">
                      Start your SIP with as little as ₹500 per month
                    </p>
                    <Button className="bg-finance-green hover:bg-green-700" data-testid="start-sip-button">
                      Start SIP Now
                    </Button>
                  </div>
                </CardContent>
              </Card>

            </div>
          </TabsContent>

          <TabsContent value="portfolio" className="space-y-6" data-testid="mf-portfolio">
            <Card className="border-dashed border-2 border-gray-300">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Star className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Investments Yet</h3>
                <p className="text-gray-500 text-center mb-4">
                  Your mutual fund investments will appear here
                </p>
                <Button variant="outline">Invest Now</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tools" className="space-y-6" data-testid="mf-tools">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6 text-center">
                  <Calculator className="h-12 w-12 text-finance-blue mx-auto mb-4" />
                  <h3 className="font-bold text-gray-900 mb-2">SIP Calculator</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Calculate your SIP returns and plan investments
                  </p>
                  <Button variant="outline" size="sm">Use Calculator</Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6 text-center">
                  <TrendingUp className="h-12 w-12 text-finance-green mx-auto mb-4" />
                  <h3 className="font-bold text-gray-900 mb-2">Fund Comparison</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Compare mutual funds side by side
                  </p>
                  <Button variant="outline" size="sm">Compare Funds</Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6 text-center">
                  <Star className="h-12 w-12 text-purple-600 mx-auto mb-4" />
                  <h3 className="font-bold text-gray-900 mb-2">Goal Planner</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Plan your financial goals with SIP
                  </p>
                  <Button variant="outline" size="sm">Plan Goals</Button>
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
