import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface CurrencySelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const CURRENCY_FLAGS: Record<string, string> = {
  USD: "🇺🇸",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
  INR: "🇮🇳",
  JPY: "🇯🇵",
  AUD: "🇦🇺",
  CAD: "🇨🇦",
  SGD: "🇸🇬",
  AED: "🇦🇪",
};

export function CurrencySelector({ value, onChange, className }: CurrencySelectorProps) {
  const { data: currencies, isLoading } = useQuery<string[]>({
    queryKey: ["/api/currencies/supported"],
  });

  if (isLoading) {
    return <Skeleton className="h-10 w-32" data-testid="currency-selector-loading" />;
  }

  const supportedCurrencies = currencies || ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'AED'];

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className} data-testid="currency-selector">
        <SelectValue placeholder="Select currency" />
      </SelectTrigger>
      <SelectContent>
        {supportedCurrencies.map((currency) => (
          <SelectItem 
            key={currency} 
            value={currency}
            data-testid={`currency-option-${currency}`}
          >
            <span className="flex items-center gap-2">
              <span className="text-lg">{CURRENCY_FLAGS[currency] || "🌐"}</span>
              <span>{currency}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
