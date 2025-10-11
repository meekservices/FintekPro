import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { TrendingUp, Shield, Calendar, DollarSign, BarChart3, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function MLDs() {
  const { data: mldProducts, isLoading } = useQuery({
    queryKey: ['/api/products', { category: 'mld' }],
    refetchInterval: 60000,
  });

  return (
    <div className="space-y-8" data-testid="mlds-page">
      <div className="space-y-6">
        <div className="mb-8" data-testid="mlds-header">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Market Linked Debentures (MLDs)</h1>
          <p className="text-gray-600 text-lg">
            Structured debt instruments linked to market indices with capital protection options
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-finance-blue" />
                <CardTitle className="text-lg">Market Linked Returns</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Returns based on underlying index performance (NIFTY, SENSEX, etc.)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-finance-green" />
                <CardTitle className="text-lg">Capital Protection</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Options with 100%, 90%, or 80% principal protection at maturity
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-finance-purple" />
                <CardTitle className="text-lg">Structured Payoffs</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Digital, range accrual, or step-up payoff structures
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <ScrollableTabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all" data-testid="tab-all">All MLDs</TabsTrigger>
            <TabsTrigger value="capital-protected" data-testid="tab-protected">Capital Protected</TabsTrigger>
            <TabsTrigger value="high-participation" data-testid="tab-high-participation">High Participation</TabsTrigger>
            <TabsTrigger value="exotic" data-testid="tab-exotic">Exotic Structures</TabsTrigger>
          </ScrollableTabsList>

          <TabsContent value="all" className="space-y-4">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-64 bg-gray-200 rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {mldProducts && mldProducts.length > 0 ? (
                  mldProducts.map((product: any) => (
                    <Card key={product.id} className="hover:shadow-lg transition-shadow" data-testid={`mld-${product.id}`}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg">{product.name}</CardTitle>
                          {product.badge && <Badge variant="secondary">{product.badge}</Badge>}
                        </div>
                        <p className="text-sm text-gray-600">{product.issuer || product.provider}</p>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Underlying Index:</span>
                            <span className="font-semibold">{product.benchmarkIndex || 'NIFTY 50'}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Capital Protection:</span>
                            <span className="font-semibold text-finance-green">
                              {product.capitalProtection || '100%'}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Participation Rate:</span>
                            <span className="font-semibold">{product.participationRate || '80%'}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Tenure:</span>
                            <span className="font-semibold">{product.tenure || '3 years'}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Min Investment:</span>
                            <span className="font-semibold">₹{product.minInvestment?.toLocaleString() || '100,000'}</span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button className="flex-1" size="sm" data-testid={`button-invest-${product.id}`}>
                            Invest Now
                          </Button>
                          <Button variant="outline" size="sm" data-testid={`button-details-${product.id}`}>
                            <Info className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="col-span-full text-center py-12">
                    <p className="text-gray-500">No MLDs available at the moment. Check back soon!</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="capital-protected">
            <div className="text-center py-12">
              <p className="text-gray-500">Loading capital protected MLDs...</p>
            </div>
          </TabsContent>

          <TabsContent value="high-participation">
            <div className="text-center py-12">
              <p className="text-gray-500">Loading high participation MLDs...</p>
            </div>
          </TabsContent>

          <TabsContent value="exotic">
            <div className="text-center py-12">
              <p className="text-gray-500">Loading exotic structure MLDs...</p>
            </div>
          </TabsContent>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle>Understanding Market Linked Debentures</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">What are MLDs?</h3>
              <p className="text-sm text-gray-600">
                Market Linked Debentures are structured debt securities where returns are linked to the performance of 
                underlying market indices like NIFTY 50, SENSEX, or sectoral indices. They offer a blend of debt security 
                with equity-like upside potential.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Key Features:</h3>
              <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li>Capital protection options (100%, 90%, or 80% of principal)</li>
                <li>Participation in index upside with defined participation rate</li>
                <li>Fixed tenure with no early redemption</li>
                <li>Tax efficiency - held as debt for tax purposes</li>
                <li>Listed on stock exchanges for transparency</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Who should invest?</h3>
              <p className="text-sm text-gray-600">
                MLDs are suitable for conservative investors seeking equity market exposure with downside protection. 
                Ideal for those with medium to long-term investment horizons who can lock in funds for 3-5 years.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
