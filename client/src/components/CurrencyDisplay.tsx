import { cn } from "@/lib/utils";

interface CurrencyDisplayProps {
  amount: number;
  currency: string;
  showSymbol?: boolean;
  className?: string;
}

const CURRENCY_LOCALES: Record<string, string> = {
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
  INR: "en-IN",
  JPY: "ja-JP",
  AUD: "en-AU",
  CAD: "en-CA",
  SGD: "en-SG",
  AED: "ar-AE",
};

export function CurrencyDisplay({ 
  amount, 
  currency, 
  showSymbol = true, 
  className 
}: CurrencyDisplayProps) {
  const locale = CURRENCY_LOCALES[currency] || "en-US";
  
  const formattedAmount = new Intl.NumberFormat(locale, {
    style: showSymbol ? "currency" : "decimal",
    currency: currency,
    minimumFractionDigits: currency === "JPY" ? 0 : 2,
    maximumFractionDigits: currency === "JPY" ? 0 : 2,
  }).format(amount);

  return (
    <span className={cn("font-medium", className)} data-testid="currency-display">
      {formattedAmount}
    </span>
  );
}
