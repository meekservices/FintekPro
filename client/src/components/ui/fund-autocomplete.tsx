import * as React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import { Check, ChevronsUpDown, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/hooks/use-debounce";

export interface FundOption {
  schemeCode: string;
  schemeName: string;
  fundHouse: string;
  category: string;
  nav: number;
  planType: string;
  isin: string;
}

interface FundAutocompleteProps {
  value?: FundOption | null;
  onSelect: (fund: FundOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function FundAutocomplete({
  value,
  onSelect,
  placeholder = "Search for a mutual fund...",
  disabled = false,
  className,
}: FundAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [funds, setFunds] = useState<FundOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const debouncedQuery = useDebounce(searchQuery, 300);
  
  const searchFunds = useCallback(async (query: string) => {
    if (query.length < 2) {
      setFunds([]);
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/mutual-funds/autocomplete?q=${encodeURIComponent(query)}&limit=15`);
      const data = await response.json();
      if (data.success) {
        setFunds(data.funds);
      }
    } catch (error) {
      console.error("Failed to search funds:", error);
      setFunds([]);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    if (debouncedQuery) {
      searchFunds(debouncedQuery);
    } else {
      setFunds([]);
    }
  }, [debouncedQuery, searchFunds]);
  
  const handleSelect = (fund: FundOption) => {
    onSelect(fund);
    setOpen(false);
    setSearchQuery("");
  };
  
  const handleClear = () => {
    onSelect(null);
    setSearchQuery("");
  };
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between text-left font-normal h-auto min-h-[2.5rem] py-2",
            !value && "text-muted-foreground",
            className
          )}
        >
          {value ? (
            <div className="flex flex-col items-start gap-1 overflow-hidden">
              <span className="truncate w-full text-sm font-medium">{value.schemeName}</span>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">{value.fundHouse}</Badge>
                {value.isin && value.isin !== '-' && (
                  <Badge variant="outline" className="text-xs font-mono">{value.isin}</Badge>
                )}
              </div>
            </div>
          ) : (
            <span>{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <div className="flex items-center border-b px-3 py-2">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            ref={inputRef}
            placeholder="Search by name or ISIN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-8"
          />
          {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {searchQuery.length < 2 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Search by fund name or ISIN (min 2 characters)
            </div>
          ) : funds.length === 0 && !isLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No funds found
            </div>
          ) : (
            <div className="p-1">
              {funds.map((fund) => (
                <div
                  key={fund.schemeCode}
                  onClick={() => handleSelect(fund)}
                  className={cn(
                    "flex flex-col gap-1 p-2 cursor-pointer rounded-sm hover:bg-accent",
                    value?.schemeCode === fund.schemeCode && "bg-accent"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        value?.schemeCode === fund.schemeCode ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="text-sm font-medium truncate flex-1">{fund.schemeName}</span>
                  </div>
                  <div className="flex gap-2 ml-6 flex-wrap">
                    <Badge variant="secondary" className="text-xs">{fund.fundHouse}</Badge>
                    <Badge variant="outline" className="text-xs">{fund.category}</Badge>
                    {fund.isin && fund.isin !== '-' && (
                      <Badge variant="outline" className="text-xs font-mono">{fund.isin}</Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">NAV: ₹{fund.nav?.toFixed(2) || 'N/A'}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {value && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="w-full text-muted-foreground"
            >
              Clear selection
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
