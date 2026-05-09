import { db } from "../db";
import { currencyRates } from "@shared/schema";
import { eq, and } from "drizzle-orm";

interface ExchangeRateResponse {
  base: string;
  rates: Record<string, number>;
  date: string;
}

export class CurrencyExchangeService {
  private static instance: CurrencyExchangeService;
  private supportedCurrencies = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'AED'];
  private refreshInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): CurrencyExchangeService {
    if (!CurrencyExchangeService.instance) {
      CurrencyExchangeService.instance = new CurrencyExchangeService();
    }
    return CurrencyExchangeService.instance;
  }

  getSupportedCurrencies(): string[] {
    return [...this.supportedCurrencies];
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async fetchExchangeRates(baseCurrency: string = 'INR'): Promise<Record<string, number>> {
    const apiKey = process.env.EXCHANGE_RATE_API_KEY;
    const url = apiKey
      ? `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${baseCurrency}`
      : `https://api.exchangerate-api.com/v4/latest/${baseCurrency}`;

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch exchange rates: ${response.statusText}`);
    }

    const data = await response.json();
    const rates = apiKey ? data.conversion_rates : data.rates;
    return rates;
  }

  async updateCurrencyRates(baseCurrency: string = 'INR'): Promise<void> {
    try {
      const rates = await this.fetchExchangeRates(baseCurrency);
      
      for (const [targetCurrency, rate] of Object.entries(rates)) {
        if (this.supportedCurrencies.includes(targetCurrency)) {
          await db
            .insert(currencyRates)
            .values({
              baseCurrency,
              targetCurrency,
              exchangeRate: rate.toString(),
              dataSource: 'exchangerate-api',
            })
            .onConflictDoUpdate({
              target: [currencyRates.baseCurrency, currencyRates.targetCurrency],
              set: {
                exchangeRate: rate.toString(),
                lastUpdated: new Date(),
              },
            });
        }
      }

    } catch (error) {
      throw error;
    }
  }

  async convertAmount(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    if (fromCurrency === toCurrency) {
      return amount;
    }

    try {
      // Fetch the exchange rate from database
      const rate = await db.query.currencyRates.findFirst({
        where: and(
          eq(currencyRates.baseCurrency, fromCurrency),
          eq(currencyRates.targetCurrency, toCurrency)
        ),
      });

      if (rate) {
        return amount * parseFloat(rate.exchangeRate);
      }

      // If not found, try inverse rate
      const inverseRate = await db.query.currencyRates.findFirst({
        where: and(
          eq(currencyRates.baseCurrency, toCurrency),
          eq(currencyRates.targetCurrency, fromCurrency)
        ),
      });

      if (inverseRate) {
        return amount / parseFloat(inverseRate.exchangeRate);
      }

      // If still not found, fetch fresh rates
      await this.updateCurrencyRates(fromCurrency);
      
      const freshRate = await db.query.currencyRates.findFirst({
        where: and(
          eq(currencyRates.baseCurrency, fromCurrency),
          eq(currencyRates.targetCurrency, toCurrency)
        ),
      });

      if (freshRate) {
        return amount * parseFloat(freshRate.exchangeRate);
      }

      throw new Error(`Unable to find exchange rate from ${fromCurrency} to ${toCurrency}`);
    } catch (error) {
      console.error(`Error converting amount from ${fromCurrency} to ${toCurrency}:`, error);
      throw error;
    }
  }

  async initializeRates(): Promise<void> {
    console.log('🔄 Initializing currency exchange rates...');
    
    let successCount = 0;
    let failCount = 0;
    
    for (const currency of this.supportedCurrencies) {
      try {
        await this.updateCurrencyRates(currency);
        successCount++;
      } catch (err: any) {
        failCount++;
        if (failCount === 1) {
          console.warn(`⚠️ Currency rate fetch limited (${err.message || 'rate limited'}). Using cached rates for remaining currencies.`);
        }
      }
      if (failCount === 0) {
        await this.delay(1500);
      } else {
        break;
      }
    }

    console.log(`✅ Currency exchange rates initialized (${successCount} updated, ${failCount > 0 ? failCount + ' using cached' : 'all fresh'})`);
  }

  startAutoRefresh(): void {
    this.refreshInterval = setInterval(async () => {
      console.log('🔄 Auto-refreshing currency exchange rates...');
      for (const currency of this.supportedCurrencies) {
        try {
          await this.updateCurrencyRates(currency);
        } catch {
          // Silently continue - rates will use cached values
        }
        await this.delay(2000);
      }
    }, 24 * 60 * 60 * 1000);

    console.log('✅ Currency auto-refresh started (24-hour interval)');
  }

  stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      console.log('Currency auto-refresh stopped');
    }
  }
}

export const currencyExchangeService = CurrencyExchangeService.getInstance();
