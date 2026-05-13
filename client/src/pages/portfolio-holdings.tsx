import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  PieChart, 
  Shield as LucideShield, 
  Landmark, 
  Coins,
  Globe,
  TrendingUp,
  TrendingDown,
  Briefcase
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePortfoliosByPan, useEnhancedPortfolioHoldings, useEpfHoldings, usePpfHoldings, useEpsHoldings, useInsuranceHoldings, useNpsAccounts, useApyAccounts } from "@/hooks/use-portfolio";
import { PortfolioSummary } from "@/components/dashboard/portfolio-summary";
import { AssetAllocationChart } from "@/components/portfolio/AssetAllocationChart";
import { CommodityTracker } from "@/components/portfolio/commodity-tracker";
import { PiChatSummaries } from "@/components/portfolio/pi-chat-summaries";
import { ConsentAwareSchemeTab } from "@/components/ConsentAwareSchemeTab";

export default function PortfolioHoldings() {
  const [activeTab, setActiveTab] = useState("overview");
  const { user } = useAuth();
  
  const { data: portfolios, isLoading: portfoliosLoading } = usePortfoliosByPan();
  const portfolioId = portfolios?.[0]?.id || '';
  
  const { data: holdings, isLoading: holdingsLoading } = useEnhancedPortfolioHoldings(portfolioId, !!portfolioId);
  const { data: epfHoldings } = useEpfHoldings();
  const { data: ppfHoldings } = usePpfHoldings();
  const { data: epsHoldings } = useEpsHoldings();
  const { data: insuranceHoldings } = useInsuranceHoldings();
  const { data: npsAccounts } = useNpsAccounts();
  const { data: apyAccounts } = useApyAccounts();

  const { data: globalHoldings } = useQuery({
    queryKey: ['/api/us-trading/positions'],
    enabled: !!user?.id,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const isLoading = portfoliosLoading || holdingsLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const totalDomesticValue = holdings?.reduce((sum: number, h: any) => sum + parseFloat(h.currentValue || '0'), 0) || 0;
  const totalGlobalValue = (globalHoldings as any)?.positions?.reduce((sum: number, p: any) => sum + (p.marketValue || 0), 0) || 0;
  const totalPortfolioValue = totalDomesticValue + totalGlobalValue;

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Holdings</h1>
          <p className="text-muted-foreground">Unified view of all your investments</p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          Total: {formatCurrency(totalPortfolioValue)}
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ScrollableTabsList className="grid w-full grid-cols-4 lg:grid-cols-8 gap-1">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <PieChart className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="global" data-testid="tab-global">
            <Globe className="w-4 h-4 mr-2" />
            Global
          </TabsTrigger>
          <TabsTrigger value="insurance" data-testid="tab-insurance">
            <LucideShield className="w-4 h-4 mr-2" />
            Insurance
          </TabsTrigger>
          <TabsTrigger value="epf" data-testid="tab-epf">
            <Landmark className="w-4 h-4 mr-2" />
            EPF
          </TabsTrigger>
          <TabsTrigger value="ppf" data-testid="tab-ppf">
            <Landmark className="w-4 h-4 mr-2" />
            PPF
          </TabsTrigger>
          <TabsTrigger value="nps" data-testid="tab-nps">
            <Briefcase className="w-4 h-4 mr-2" />
            NPS
          </TabsTrigger>
          <TabsTrigger value="commodities" data-testid="tab-commodities">
            <Coins className="w-4 h-4 mr-2" />
            Commodities
          </TabsTrigger>
          <TabsTrigger value="pi-chat" data-testid="tab-pi-chat">
            <TrendingUp className="w-4 h-4 mr-2" />
            PI Chat
          </TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Portfolio Summary</CardTitle>
                <CardDescription>Your complete investment overview</CardDescription>
              </CardHeader>
              <CardContent>
                <PortfolioSummary />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Asset Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <AssetAllocationChart />
              </CardContent>
            </Card>
          </div>

          {holdings && holdings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Holdings</CardTitle>
                <CardDescription>{holdings.length} investments across asset classes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {holdings.slice(0, 10).map((holding: any) => (
                    <div key={holding.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{holding.symbol || holding.name}</p>
                        <p className="text-sm text-muted-foreground">{holding.assetType}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(parseFloat(holding.currentValue || '0'))}</p>
                        <p className={`text-sm flex items-center justify-end ${parseFloat(holding.gainLossPercent || '0') >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {parseFloat(holding.gainLossPercent || '0') >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                          {parseFloat(holding.gainLossPercent || '0').toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="global" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Global Investments
              </CardTitle>
              <CardDescription>US stocks and international holdings</CardDescription>
            </CardHeader>
            <CardContent>
              {(globalHoldings as any)?.positions?.length > 0 ? (
                <div className="space-y-3">
                  {(globalHoldings as any).positions.map((position: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{position.symbol}</p>
                        <p className="text-sm text-muted-foreground">{position.quantity} shares</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">${position.marketValue?.toLocaleString()}</p>
                        <p className={`text-sm ${position.unrealizedPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {position.unrealizedPL >= 0 ? '+' : ''}{position.unrealizedPLPercent?.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No global investments yet</p>
                  <p className="text-sm">Start investing in US stocks to diversify globally</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insurance" className="mt-6">
          <ConsentAwareSchemeTab 
            schemeType="insurance"
            title="Insurance Holdings"
            description="Life, health, and general insurance policies"
            holdings={insuranceHoldings}
          />
        </TabsContent>

        <TabsContent value="epf" className="mt-6">
          <ConsentAwareSchemeTab 
            schemeType="epf"
            title="Employee Provident Fund"
            description="EPF balance and contribution history"
            holdings={epfHoldings}
          />
        </TabsContent>

        <TabsContent value="ppf" className="mt-6">
          <ConsentAwareSchemeTab 
            schemeType="ppf"
            title="Public Provident Fund"
            description="PPF account balance and maturity"
            holdings={ppfHoldings}
          />
        </TabsContent>

        <TabsContent value="nps" className="mt-6">
          <ConsentAwareSchemeTab 
            schemeType="nps"
            title="National Pension System"
            description="NPS tier 1 and tier 2 accounts"
            holdings={npsAccounts}
          />
        </TabsContent>

        <TabsContent value="commodities" className="mt-6">
          <CommodityTracker />
        </TabsContent>

        <TabsContent value="pi-chat" className="mt-6">
          <PiChatSummaries />
        </TabsContent>
      </Tabs>
    </div>
  );
}
