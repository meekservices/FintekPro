import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { MarketTicker } from "@/components/dashboard/market-ticker";
import { MarketChart } from "@/components/dashboard/market-chart";
import { MarketMovers } from "@/components/dashboard/market-movers";
import { MarketNews } from "@/components/dashboard/market-news";
import { NSEData } from "@/components/dashboard/nse-data";
import { BSEData } from "@/components/dashboard/bse-data";
import { MCXData } from "@/components/dashboard/mcx-data";
import { NCDEXData } from "@/components/dashboard/ncdex-data";
import { MSEIData } from "@/components/dashboard/msei-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMarketQuote, useMarketIndices } from "@/hooks/use-market-data";
import { GLOBAL_INDICES } from "@/lib/constants";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { StoryViewer, type MarketStoryData } from "@/components/market/story-viewer";
import { useToast } from "@/hooks/use-toast";
import { Search, TrendingUp, TrendingDown, Activity, Sparkles, Zap } from "lucide-react";

export default function Markets() {
  const [searchSymbol, setSearchSymbol] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState("^NSEI");
  const [currentStory, setCurrentStory] = useState<MarketStoryData | null>(null);
  
  const { data: indices } = useMarketIndices();
  const { data: symbolQuote } = useMarketQuote(searchSymbol.toUpperCase());
  const { toast } = useToast();

  // Mutation for generating AI market stories
  const generateStoryMutation = useMutation({
    mutationFn: async ({ symbols, useCurrentData = true }: { symbols?: string[], useCurrentData?: boolean }) => {
      const response = await apiRequest("POST", "/api/market/story/generate", {
        symbols: symbols || GLOBAL_INDICES.map(idx => idx.symbol),
        useCurrentData
      });
      return response.json();
    },
    onSuccess: (storyData: MarketStoryData) => {
      setCurrentStory(storyData);
      toast({
        title: "Market Story Generated!",
        description: "AI has analyzed the market trends and created your story."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Story Generation Failed",
        description: error.message || "Failed to generate market story. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleGenerateStory = () => {
    generateStoryMutation.mutate({ 
      symbols: GLOBAL_INDICES.map(idx => idx.symbol),
      useCurrentData: true 
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchSymbol.trim()) {
      setSelectedSymbol(searchSymbol.toUpperCase());
    }
  };

  return (
    <div className="min-h-screen bg-finance-light" data-testid="markets-page">
      <Header />
      <MarketTicker />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Page Header */}
        <div className="mb-8" data-testid="markets-header">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Global, NSE, BSE, MCX, NCDEX & MSEI Markets</h1>
            
            {/* AI Story Generation Button */}
            <Button
              onClick={handleGenerateStory}
              disabled={generateStoryMutation.isPending}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg"
              data-testid="generate-story-button"
            >
              {generateStoryMutation.isPending ? (
                <>
                  <Zap className="h-4 w-4 mr-2 animate-spin" />
                  Generating Story...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI Market Story
                </>
              )}
            </Button>
          </div>
          
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="flex gap-4 max-w-md">
            <Input
              type="text"
              placeholder="Search stocks (e.g., AAPL, TSLA)..."
              value={searchSymbol}
              onChange={(e) => setSearchSymbol(e.target.value)}
              className="flex-1"
              data-testid="stock-search-input"
            />
            <Button type="submit" data-testid="search-button">
              <Search className="h-4 w-4" />
            </Button>
          </form>
        </div>

        {/* Global Indices Grid */}
        <section className="mb-8" data-testid="global-indices">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Global Indices</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {GLOBAL_INDICES.map((index) => {
              const indexData = indices?.find(i => i.symbol === index.symbol);
              const isPositive = (indexData?.changePercent || 0) >= 0;
              
              return (
                <Card 
                  key={index.symbol}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedSymbol(index.symbol)}
                  data-testid={`index-card-${index.symbol}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-sm text-gray-900">{index.name}</h3>
                      {isPositive ? (
                        <TrendingUp className="h-4 w-4 text-finance-green" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-finance-red" />
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mb-2">{index.region}</p>
                    <div className="space-y-1">
                      <p className="font-bold text-lg" data-testid={`index-price-${index.symbol}`}>
                        {indexData?.price?.toLocaleString(undefined, { 
                          minimumFractionDigits: 2, 
                          maximumFractionDigits: 2 
                        }) || 'Loading...'}
                      </p>
                      <p 
                        className={`text-sm font-medium ${isPositive ? 'text-finance-green' : 'text-finance-red'}`}
                        data-testid={`index-change-${index.symbol}`}
                      >
                        {indexData ? (
                          <>
                            {isPositive ? '+' : ''}{indexData.changePercent?.toFixed(2)}%
                            <span className="ml-1">
                              ({isPositive ? '+' : ''}{indexData.change?.toFixed(2)})
                            </span>
                          </>
                        ) : (
                          'Loading...'
                        )}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* AI Generated Market Story */}
        {currentStory && (
          <section className="mb-8" data-testid="ai-story-section">
            <StoryViewer 
              story={currentStory} 
              onClose={() => setCurrentStory(null)} 
            />
          </section>
        )}

        {/* Market Overview */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8" data-testid="market-overview">
          <MarketChart symbol={selectedSymbol} />
          
          {/* Stock Quote Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-finance-blue" />
                Stock Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              {searchSymbol && symbolQuote ? (
                <div className="space-y-4" data-testid="stock-quote-details">
                  <div>
                    <h3 className="font-bold text-xl text-gray-900">{searchSymbol.toUpperCase()}</h3>
                    <p className="text-2xl font-bold text-finance-blue">
                      ${symbolQuote.c?.toFixed(2)}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Change</p>
                      <p className={`font-semibold ${symbolQuote.d >= 0 ? 'text-finance-green' : 'text-finance-red'}`}>
                        {symbolQuote.d >= 0 ? '+' : ''}${symbolQuote.d?.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Change %</p>
                      <p className={`font-semibold ${symbolQuote.dp >= 0 ? 'text-finance-green' : 'text-finance-red'}`}>
                        {symbolQuote.dp >= 0 ? '+' : ''}{symbolQuote.dp?.toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">High</p>
                      <p className="font-semibold">${symbolQuote.h?.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Low</p>
                      <p className="font-semibold">${symbolQuote.l?.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Open</p>
                      <p className="font-semibold">${symbolQuote.o?.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Prev Close</p>
                      <p className="font-semibold">${symbolQuote.pc?.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>Search for a stock symbol to view details</p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Indian Stock Exchanges Data Section */}
        <section className="mb-8" data-testid="indian-exchanges-section">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Indian Stock Exchanges Live Data</h2>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">NSE (National Stock Exchange)</h3>
              <NSEData />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">BSE (Bombay Stock Exchange)</h3>
              <BSEData />
            </div>
          </div>
        </section>

        {/* MCX Commodities Data Section */}
        <section className="mb-8" data-testid="mcx-data-section">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">MCX Commodities Live Data</h2>
          <MCXData />
        </section>

        {/* NCDEX Agricultural Commodities Data Section */}
        <section className="mb-8" data-testid="ncdex-data-section">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">NCDEX Agricultural Commodities Live Data</h2>
          <NCDEXData />
        </section>

        {/* MSEI Metropolitan Stock Exchange Data Section */}
        <section className="mb-8" data-testid="msei-data-section">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">MSEI Metropolitan Stock Exchange Live Data</h2>
          <MSEIData />
        </section>

        {/* Market Data */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8" data-testid="market-data">
          <MarketMovers />
          <MarketNews />
        </section>

      </main>

      <Footer />
    </div>
  );
}
