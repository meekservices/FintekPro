import { Globe, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useEnabledMarkets, useUserMarketPreferences, useSelectMarket, getAdvisoryBadgeConfig } from "@/hooks/use-global-advisory";
import { useToast } from "@/hooks/use-toast";

interface MarketSelectorProps {
  compact?: boolean;
  onMarketChange?: (marketCode: string) => void;
}

export function MarketSelector({ compact = false, onMarketChange }: MarketSelectorProps) {
  const { toast } = useToast();
  const { data: marketsData, isLoading: marketsLoading } = useEnabledMarkets();
  const { data: preferencesData, isLoading: preferencesLoading } = useUserMarketPreferences();
  const selectMarketMutation = useSelectMarket();
  
  const markets = marketsData?.markets || [];
  const preferences = preferencesData?.preferences;
  const selectedMarket = markets.find(m => m.marketCode === preferences?.selectedMarket) || markets.find(m => m.marketCode === "IN");
  
  const handleSelectMarket = async (marketCode: string) => {
    try {
      await selectMarketMutation.mutateAsync(marketCode);
      onMarketChange?.(marketCode);
      toast({
        title: "Market Changed",
        description: `Switched to ${markets.find(m => m.marketCode === marketCode)?.marketName || marketCode}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to change market",
        variant: "destructive",
      });
    }
  };
  
  if (marketsLoading || preferencesLoading) {
    return (
      <Button variant="outline" size={compact ? "sm" : "default"} disabled data-testid="market-selector-loading">
        <Globe className="h-4 w-4 mr-2 animate-pulse" />
        Loading...
      </Button>
    );
  }
  
  if (markets.length <= 1) {
    return null;
  }
  
  const groupedMarkets = markets.reduce((acc, market) => {
    const group = market.region || "Other";
    if (!acc[group]) acc[group] = [];
    acc[group].push(market);
    return acc;
  }, {} as Record<string, typeof markets>);
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size={compact ? "sm" : "default"} 
          className="gap-2"
          data-testid="market-selector-trigger"
        >
          <span className="text-lg">{selectedMarket?.flagEmoji || "🌐"}</span>
          {!compact && (
            <span className="hidden sm:inline">{selectedMarket?.marketName || "Select Market"}</span>
          )}
          <span className="sm:hidden">{selectedMarket?.marketCode || "..."}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64" data-testid="market-selector-menu">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          Select Market
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {Object.entries(groupedMarkets).map(([region, regionMarkets]) => (
          <div key={region}>
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              {region}
            </DropdownMenuLabel>
            {regionMarkets.map((market) => {
              const badgeConfig = getAdvisoryBadgeConfig(market.advisoryLevel);
              const isSelected = selectedMarket?.marketCode === market.marketCode;
              
              return (
                <DropdownMenuItem
                  key={market.marketCode}
                  onClick={() => handleSelectMarket(market.marketCode)}
                  className="flex items-center justify-between cursor-pointer"
                  data-testid={`market-option-${market.marketCode}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{market.flagEmoji || "🌐"}</span>
                    <div>
                      <div className="font-medium">{market.marketName}</div>
                      <div className="text-xs text-muted-foreground">
                        {market.baseCurrency}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={badgeConfig.variant} className="text-xs">
                      {market.advisoryLevel === "FULL" ? "Full" : "Analytics"}
                    </Badge>
                    {isSelected && <Check className="h-4 w-4 text-primary" />}
                  </div>
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
