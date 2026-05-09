import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Landmark, CreditCard, PiggyBank, TrendingUp, Shield, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

export default function BankingProducts() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const { data: bankingProducts, isLoading } = useQuery({
    queryKey: ['/api/products', 'banking', selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams({ category: 'banking' });
      if (selectedCategory !== 'all') params.append('subcategory', selectedCategory);
      const res = await fetch(`/api/products?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch products');
      return res.json();
    },
    refetchInterval: 120000,
  });

  const productCategories = [
    {
      id: "savings",
      name: "Savings Accounts",
      icon: PiggyBank,
      description: "High-interest savings and salary accounts",
      color: "blue",
      avgRate: "3.5% - 7%"
    },
    {
      id: "fixed-deposits",
      name: "Fixed Deposits",
      icon: Landmark,
      description: "Guaranteed returns with flexible tenures",
      color: "green",
      avgRate: "6.5% - 8.5%"
    },
    {
      id: "credit-cards",
      name: "Credit Cards",
      icon: CreditCard,
      description: "Rewards, cashback, and premium cards",
      color: "purple",
      avgRate: "Cashback up to 5%"
    },
    {
      id: "loans",
      name: "Loans",
      icon: TrendingUp,
      description: "Personal, home, and business loans",
      color: "orange",
      avgRate: "8.5% - 15%"
    }
  ];

  return (
    <div className="space-y-8" data-testid="banking-products-page">
      <div className="space-y-6">
        <div className="mb-8" data-testid="banking-header">
          <h1 className="text-3xl font-bold text-foreground mb-4">Banking Products</h1>
          <p className="text-muted-foreground text-lg">
            Compare and apply for best banking products from leading banks
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {productCategories.map((category) => {
            const IconComponent = category.icon;
            return (
              <Card 
                key={category.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedCategory(category.id)}
                data-testid={`card-${category.id}`}
              >
                <CardContent className="p-6">
                  <div className={`w-12 h-12 bg-${category.color}-100 rounded-lg flex items-center justify-center mb-4`}>
                    <IconComponent className={`h-6 w-6 text-finance-${category.color}`} />
                  </div>
                  <h3 className="font-bold text-foreground mb-2">{category.name}</h3>
                  <p className="text-muted-foreground text-sm mb-3">{category.description}</p>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Interest/Rewards: </span>
                    <span className="font-semibold text-finance-green">{category.avgRate}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
          <ScrollableTabsList>
            <TabsTrigger value="all" data-testid="tab-all" className="flex-shrink-0">All Products</TabsTrigger>
            <TabsTrigger value="savings" data-testid="tab-savings" className="flex-shrink-0">Savings</TabsTrigger>
            <TabsTrigger value="fixed-deposits" data-testid="tab-fd" className="flex-shrink-0">Fixed Deposits</TabsTrigger>
            <TabsTrigger value="credit-cards" data-testid="tab-cards" className="flex-shrink-0">Credit Cards</TabsTrigger>
            <TabsTrigger value="loans" data-testid="tab-loans" className="flex-shrink-0">Loans</TabsTrigger>
          </ScrollableTabsList>

          <TabsContent value={selectedCategory} className="space-y-4">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-72 bg-muted rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {bankingProducts && bankingProducts.length > 0 ? (
                  bankingProducts.map((product: any) => (
                    <Card key={product.id} className="hover:shadow-lg transition-shadow" data-testid={`product-${product.id}`}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">{product.name}</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">{product.issuer || product.provider}</p>
                          </div>
                          {product.isFeatured && (
                            <Badge className="bg-finance-gold text-white">
                              <Star className="h-3 w-3 mr-1" />
                              Featured
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">{product.description}</p>
                        
                        <div className="space-y-2">
                          {product.interestRate && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Interest Rate:</span>
                              <span className="font-semibold text-finance-green">{product.interestRate}% p.a.</span>
                            </div>
                          )}
                          {product.minDeposit && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Min Deposit:</span>
                              <span className="font-semibold">₹{product.minDeposit.toLocaleString()}</span>
                            </div>
                          )}
                          {product.tenure && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Tenure:</span>
                              <span className="font-semibold">{product.tenure}</span>
                            </div>
                          )}
                          {product.annualFee !== undefined && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Annual Fee:</span>
                              <span className="font-semibold">
                                {product.annualFee === 0 ? 'FREE' : `₹${product.annualFee.toLocaleString()}`}
                              </span>
                            </div>
                          )}
                          {product.rewards && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Rewards:</span>
                              <Badge variant="outline" className="text-xs">{product.rewards}</Badge>
                            </div>
                          )}
                          {product.features && product.features.length > 0 && (
                            <div className="pt-2">
                              <p className="text-xs text-muted-foreground mb-1">Key Features:</p>
                              <ul className="text-xs text-muted-foreground space-y-1">
                                {product.features.slice(0, 3).map((feature: string, idx: number) => (
                                  <li key={idx}>• {feature}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Button className="flex-1" size="sm" data-testid={`button-apply-${product.id}`}>
                            Apply Now
                          </Button>
                          <Button variant="outline" size="sm" data-testid={`button-details-${product.id}`}>
                            Details
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="col-span-full text-center py-12">
                    <Landmark className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No banking products available in this category.</p>
                    <p className="text-muted-foreground text-sm mt-2">Please check other categories or try again later.</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-gradient-to-br from-blue-50 dark:from-blue-950/30 to-blue-100 dark:to-blue-900/30">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-6 w-6 text-finance-blue" />
                <CardTitle>Why Choose Through FintekPro?</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-finance-blue mt-2"></div>
                <p className="text-sm">Compare offers from 20+ leading banks in real-time</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-finance-blue mt-2"></div>
                <p className="text-sm">Instant eligibility check without affecting credit score</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-finance-blue mt-2"></div>
                <p className="text-sm">End-to-end digital application with minimal documentation</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-finance-blue mt-2"></div>
                <p className="text-sm">Dedicated relationship manager for premium customers</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 dark:from-green-950/30 to-green-100 dark:to-green-900/30">
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-finance-green" />
                <CardTitle>Best Rate Guarantee</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">
                We continuously monitor and negotiate with partner banks to ensure you get the best rates available in the market.
              </p>
              <div className="bg-card rounded-lg p-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-finance-green">8.5%</p>
                  <p className="text-xs text-muted-foreground mt-1">Best FD Rate Today</p>
                  <p className="text-xs text-muted-foreground mt-1">Senior Citizens: Up to 9.0%</p>
                </div>
              </div>
              <Button className="w-full" size="sm" data-testid="button-check-rates">
                Check Latest Rates
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
