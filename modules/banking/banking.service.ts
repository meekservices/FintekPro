import { Injectable, Logger } from '@nestjs/common';
import { IBankingProvider, BankBalance, BankTransaction, TransferRequest, TransferResponse } from './providers/banking-provider.interface';
import { RazorpayXProvider } from './providers/razorpayx-provider';
import { CashfreeProvider } from './providers/cashfree-provider';
import { DecentroProvider } from './providers/decentro-provider';
import { SetuProvider } from './providers/setu-provider';

@Injectable()
export class BankingService {
  private readonly logger = new Logger(BankingService.name);
  private readonly providers: Map<string, IBankingProvider> = new Map();

  constructor() {
    // Initialize providers (in production, these would be injected or loaded from config)
    this.initializeProviders();
  }

  private initializeProviders() {
    // Mock initialization - in a real NestJS app, use ConfigService
    const rxApiKey = process.env.RAZORPAYX_API_KEY;
    const rxApiSecret = process.env.RAZORPAYX_API_SECRET;
    const rxAccountId = process.env.RAZORPAYX_ACCOUNT_ID;

    if (rxApiKey && rxApiSecret && rxAccountId) {
      this.providers.set('razorpayx', new RazorpayXProvider(rxApiKey, rxApiSecret, rxAccountId));
    }

    const cfClientId = process.env.CASHFREE_CLIENT_ID;
    const cfClientSecret = process.env.CASHFREE_CLIENT_SECRET;

    if (cfClientId && cfClientSecret) {
      this.providers.set('cashfree', new CashfreeProvider(cfClientId, cfClientSecret));
    }

    const dcClientId = process.env.DECENTRO_CLIENT_ID;
    const dcClientSecret = process.env.DECENTRO_CLIENT_SECRET;
    const dcModuleSecret = process.env.DECENTRO_MODULE_SECRET;

    if (dcClientId && dcClientSecret && dcModuleSecret) {
      this.providers.set('decentro', new DecentroProvider(dcClientId, dcClientSecret, dcModuleSecret));
    }

    const setuClientId = process.env.SETU_CLIENT_ID;
    const setuSecret = process.env.SETU_SECRET;

    if (setuClientId && setuSecret) {
      this.providers.set('setu', new SetuProvider(setuClientId, setuSecret));
    }
  }

  getProvider(providerId: string): IBankingProvider {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }
    return provider;
  }

  async getAllBalances(accounts: { provider: string; accountId: string }[]): Promise<BankBalance[]> {
    const balancePromises = accounts.map(acc => {
      const provider = this.getProvider(acc.provider);
      return provider.getBalances([acc.accountId]);
    });

    const results = await Promise.allSettled(balancePromises);
    const balances: BankBalance[] = [];

    results.forEach(result => {
      if (result.status === 'fulfilled') {
        balances.push(...result.value);
      } else {
        this.logger.error(`Failed to fetch balances: ${result.reason}`);
      }
    });

    return balances;
  }

  async syncTransactions(providerId: string, accountId: string, days: number = 30): Promise<BankTransaction[]> {
    const provider = this.getProvider(providerId);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    return provider.getTransactions(accountId, startDate, endDate);
  }

  async executeTransfer(providerId: string, request: TransferRequest): Promise<TransferResponse> {
    const provider = this.getProvider(providerId);
    this.logger.log(`Executing transfer of ${request.amount} ${request.currency} via ${providerId}`);
    return provider.initiateTransfer(request);
  }
}
