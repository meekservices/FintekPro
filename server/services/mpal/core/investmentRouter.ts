import { providerRegistry } from './providerRegistry';
import { AssetClass } from '../interfaces/IBroker';

export class InvestmentRouter {
  
  /**
   * Resolves the correct Broker ID based on the requested Asset Class.
   */
  resolveBrokerId(assetClass: AssetClass): string {
    if (assetClass === 'EQUITY_US') return 'ALPACA';
    if (assetClass === 'EQUITY_IN') return 'IIFL';
    return 'IRIS'; // Default to IRIS for MF, PMS, AIF, FD
  }

  /**
   * Routes an order to the appropriate broker.
   */
  async executeOrder(assetClass: string, orderPayload: any, user: any): Promise<any> {
    const brokerId = this.resolveBrokerId(assetClass as AssetClass);
    const broker = providerRegistry.getBroker(brokerId);
    return broker.placeOrder({ ...orderPayload, userId: user.id });
  }

  async getPositions(assetClass: string, user: any): Promise<any> {
    const brokerId = this.resolveBrokerId(assetClass as AssetClass);
    const broker = providerRegistry.getBroker(brokerId);
    // Assuming user has a property to identify their account at the broker
    return broker.getPositions(user.id); 
  }

  async getQuote(assetClass: string, symbol: string): Promise<any> {
    const brokerId = this.resolveBrokerId(assetClass as AssetClass);
    // We might need a separate MarketDataProvider registry, but for now assuming broker handles it
    const broker = providerRegistry.getBroker(brokerId);
    if (brokerId === 'ALPACA') {
      const { quoteService } = await import('../../alpaca/market/quoteService');
      return quoteService.getQuotes([symbol]);
    }
    return { symbol, price: 0, error: 'Quote service not implemented for this broker' };
  }

  /**
   * Dispatches account creation to the appropriate broker.
   */
  async routeAccountCreation(assetClass: AssetClass, user: any): Promise<any> {
    const brokerId = this.resolveBrokerId(assetClass);
    const broker = providerRegistry.getBroker(brokerId);
    return broker.createAccount(user);
  }
}

export const investmentRouter = new InvestmentRouter();
