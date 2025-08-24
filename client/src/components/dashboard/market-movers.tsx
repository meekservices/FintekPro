import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";

interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

// Mock data for market movers - In production, this would come from Finnhub API
const mockGainers: Stock[] = [
  { symbol: "RELIANCE", name: "Reliance Industries", price: 2847.65, change: 89.45, changePercent: 3.24 },
  { symbol: "TCS", name: "Tata Consultancy Services", price: 4156.30, change: 116.20, changePercent: 2.87 },
  { symbol: "HDFCBANK", name: "HDFC Bank Limited", price: 1743.85, change: 33.35, changePercent: 1.95 },
  { symbol: "INFY", name: "Infosys Limited", price: 1856.40, change: 28.90, changePercent: 1.58 },
  { symbol: "ICICIBANK", name: "ICICI Bank Limited", price: 1287.55, change: 18.75, changePercent: 1.48 },
];

const mockLosers: Stock[] = [
  { symbol: "BAJFINANCE", name: "Bajaj Finance Limited", price: 6789.25, change: -156.30, changePercent: -2.26 },
  { symbol: "MARUTI", name: "Maruti Suzuki India", price: 11245.80, change: -198.65, changePercent: -1.74 },
  { symbol: "ASIANPAINT", name: "Asian Paints Limited", price: 2943.15, change: -48.90, changePercent: -1.63 },
  { symbol: "NESTLEIND", name: "Nestle India Limited", price: 24567.35, change: -389.25, changePercent: -1.56 },
  { symbol: "ULTRACEMCO", name: "UltraTech Cement", price: 10876.40, change: -156.85, changePercent: -1.42 },
];

export function MarketMovers() {
  const [activeTab, setActiveTab] = useState<"gainers" | "losers">("gainers");
  const [isLoading] = useState(false); // Would be managed by actual API calls

  const currentData = activeTab === "gainers" ? mockGainers : mockLosers;

  if (isLoading) {
    return (
      <Card data-testid="market-movers-loading">
        <CardHeader>
          <div className="flex justify-between items-center">
            <Skeleton className="h-6 w-32" />
            <div className="flex space-x-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <div className="text-right">
                  <Skeleton className="h-4 w-16 mb-2" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="market-movers">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl font-bold text-gray-900" data-testid="movers-title">
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
              className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              data-testid={`stock-${stock.symbol}`}
            >
              <div>
                <p className="font-semibold text-gray-900" data-testid={`stock-symbol-${stock.symbol}`}>
                  {stock.symbol}
                </p>
                <p className="text-sm text-gray-600" data-testid={`stock-name-${stock.symbol}`}>
                  {stock.name}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-900" data-testid={`stock-price-${stock.symbol}`}>
                  ₹{stock.price.toLocaleString()}
                </p>
                <p 
                  className={`text-sm ${stock.change >= 0 ? 'text-finance-green' : 'text-finance-red'}`}
                  data-testid={`stock-change-${stock.symbol}`}
                >
                  {stock.change >= 0 ? '+' : ''}₹{Math.abs(stock.change).toFixed(2)} ({stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%)
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
