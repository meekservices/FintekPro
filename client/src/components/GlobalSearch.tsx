import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Search, X, TrendingUp, Coins, FileText, Target, ShoppingCart } from "lucide-react";
import { useLocation } from "wouter";

interface SearchResult {
  stocks: Array<{ symbol: string; name: string; type: string }>;
  mutualFunds: Array<{ id: string; name: string; type: string }>;
  bonds: Array<{ id: string; name: string; type: string }>;
  goals: Array<{ id: string; name: string; type: string }>;
  orders: Array<{ id: string; symbol: string; type: string }>;
}

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery<{ success: boolean; results: SearchResult }>({
    queryKey: ["/api/features/search", { q: query }],
    queryFn: async () => {
      const res = await fetch(`/api/features/search?q=${encodeURIComponent(query)}`);
      return res.json();
    },
    enabled: query.length >= 2
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (event.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleResultClick = (type: string, id: string) => {
    setIsOpen(false);
    setQuery("");
    
    switch (type) {
      case "stock":
        navigate(`/domestic-trading?symbol=${id}`);
        break;
      case "mutual_fund":
        navigate(`/mutual-funds?fund=${id}`);
        break;
      case "bond":
        navigate(`/bonds?id=${id}`);
        break;
      case "goal":
        navigate(`/goals?id=${id}`);
        break;
      case "order":
        navigate(`/orders?id=${id}`);
        break;
    }
  };

  const results = data?.results;
  const hasResults = results && (
    results.stocks.length > 0 ||
    results.mutualFunds.length > 0 ||
    results.bonds.length > 0 ||
    results.goals.length > 0 ||
    results.orders.length > 0
  );

  return (
    <div ref={containerRef} className="relative w-full max-w-md" data-testid="global-search">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search stocks, funds, orders... (⌘K)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-10 pr-10"
          data-testid="search-input"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && query.length >= 2 && (
        <Card className="absolute top-full mt-2 w-full z-50 max-h-96 overflow-auto shadow-lg" data-testid="search-results">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">Searching...</div>
          ) : hasResults ? (
            <div className="p-2">
              {results.stocks.length > 0 && (
                <div className="mb-2">
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> Stocks
                  </div>
                  {results.stocks.map((stock) => (
                    <button
                      key={stock.symbol}
                      onClick={() => handleResultClick("stock", stock.symbol)}
                      className="w-full px-3 py-2 text-left hover:bg-muted rounded-md flex items-center justify-between"
                      data-testid={`search-result-stock-${stock.symbol}`}
                    >
                      <div>
                        <span className="font-medium">{stock.symbol}</span>
                        <span className="text-muted-foreground text-sm ml-2">{stock.name}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">Stock</Badge>
                    </button>
                  ))}
                </div>
              )}

              {results.mutualFunds.length > 0 && (
                <div className="mb-2">
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <Coins className="h-3 w-3" /> Mutual Funds
                  </div>
                  {results.mutualFunds.map((fund) => (
                    <button
                      key={fund.id}
                      onClick={() => handleResultClick("mutual_fund", fund.id)}
                      className="w-full px-3 py-2 text-left hover:bg-muted rounded-md flex items-center justify-between"
                      data-testid={`search-result-fund-${fund.id}`}
                    >
                      <span className="font-medium">{fund.name}</span>
                      <Badge variant="outline" className="text-xs">MF</Badge>
                    </button>
                  ))}
                </div>
              )}

              {results.goals.length > 0 && (
                <div className="mb-2">
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <Target className="h-3 w-3" /> Goals
                  </div>
                  {results.goals.map((goal) => (
                    <button
                      key={goal.id}
                      onClick={() => handleResultClick("goal", goal.id)}
                      className="w-full px-3 py-2 text-left hover:bg-muted rounded-md"
                      data-testid={`search-result-goal-${goal.id}`}
                    >
                      <span className="font-medium">{goal.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {results.orders.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <ShoppingCart className="h-3 w-3" /> Orders
                  </div>
                  {results.orders.map((order) => (
                    <button
                      key={order.id}
                      onClick={() => handleResultClick("order", order.id)}
                      className="w-full px-3 py-2 text-left hover:bg-muted rounded-md"
                      data-testid={`search-result-order-${order.id}`}
                    >
                      <span className="font-medium">{order.symbol}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              No results found for "{query}"
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
