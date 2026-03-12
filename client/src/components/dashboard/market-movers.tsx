import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MarketMoversSkeleton } from "@/components/ui/market-data-skeleton";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

interface MarketMoversResponse {
  gainers: Stock[];
  losers: Stock[];
}

export function MarketMovers() {
  const [activeTab, setActiveTab] = useState<"gainers" | "losers">("gainers");

  // Fetch real-time market movers from API
  const { data: marketMovers, isLoading, error } = useQuery<MarketMoversResponse>({
    queryKey: ["/api/market/movers"],
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    refetchOnWindowFocus: true,
    staleTime: 0, // Always consider data stale for frequent updates
  });

  // Fallback data if API fails
  const fallbackGainers: Stock[] = [
    { symbol: "RELIANCE", name: "Reliance Industries", price: 2847.65, change: 89.45, changePercent: 3.24 },
    { symbol: "TCS", name: "Tata Consultancy Services", price: 4156.30, change: 116.20, changePercent: 2.87 },
    { symbol: "HDFCBANK", name: "HDFC Bank Limited", price: 1743.85, change: 33.35, changePercent: 1.95 },
    { symbol: "INFY", name: "Infosys Limited", price: 1856.40, change: 28.90, changePercent: 1.58 },
    { symbol: "ICICIBANK", name: "ICICI Bank Limited", price: 1287.55, change: 18.75, changePercent: 1.48 },
  ];

  const fallbackLosers: Stock[] = [
    { symbol: "BAJFINANCE", name: "Bajaj Finance Limited", price: 6789.25, change: -156.30, changePercent: -2.26 },
    { symbol: "MARUTI", name: "Maruti Suzuki India", price: 11245.80, change: -198.65, changePercent: -1.74 },
    { symbol: "ASIANPAINT", name: "Asian Paints Limited", price: 2943.15, change: -48.90, changePercent: -1.63 },
    { symbol: "NESTLEIND", name: "Nestle India Limited", price: 24567.35, change: -389.25, changePercent: -1.56 },
    { symbol: "ULTRACEMCO", name: "UltraTech Cement", price: 10876.40, change: -156.85, changePercent: -1.42 },
  ];

  const currentData = marketMovers 
    ? (activeTab === "gainers" ? marketMovers.gainers : marketMovers.losers)
    : (activeTab === "gainers" ? fallbackGainers : fallbackLosers);

  if (isLoading) {
    return <MarketMoversSkeleton rows={5} />;
  }

  return (
    <Card data-testid="market-movers">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl font-bold text-foreground" data-testid="movers-title">
            Market Movers
          </CardTitle>
          <div className="flex space-x-2">
            <Button
              variant={activeTab === "gainers" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("gainers")}
              className={activeTab === "gainers" ? "bg-finance-green text-white" : ""}
              data-testid="gainers-tab"
            >
              Gainers
            </Button>
            <Button
              variant={activeTab === "losers" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("losers")}
              className={activeTab === "losers" ? "bg-finance-red text-white" : ""}
              data-testid="losers-tab"
            >
              Losers
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4" data-testid="movers-list">
          {currentData.map((stock) => (
            <div 
              key={stock.symbol} 
              className="flex justify-between items-center p-3 bg-muted rounded-lg hover:bg-muted transition-colors cursor-pointer"
              data-testid={`stock-${stock.symbol}`}
            >
              <div>
                <p className="font-semibold text-foreground" data-testid={`stock-symbol-${stock.symbol}`}>
                  {stock.symbol}
                </p>
                <p className="text-sm text-muted-foreground" data-testid={`stock-name-${stock.symbol}`}>
                  {stock.name}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-foreground" data-testid={`stock-price-${stock.symbol}`}>
                  ₹{(stock.price ?? 0).toLocaleString()}
                </p>
                <p 
                  className={`text-sm ${(stock.change ?? 0) >= 0 ? 'text-finance-green' : 'text-finance-red'}`}
                  data-testid={`stock-change-${stock.symbol}`}
                >
                  {(stock.change ?? 0) >= 0 ? '+' : ''}₹{Math.abs(stock.change ?? 0).toFixed(2)} ({(stock.changePercent ?? 0) >= 0 ? '+' : ''}{(stock.changePercent ?? 0).toFixed(2)}%)
                </p>
              </div>
            </div>
          ))}
        </div>

        <Button 
          variant="link" 
          className="w-full mt-4 text-finance-blue font-medium hover:underline"
          data-testid="view-all-movers"
        >
          View All Movers →
        </Button>
      </CardContent>
    </Card>
  );
}
