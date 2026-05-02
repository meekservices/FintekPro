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
  async routeOrder(order: any): Promise<any> {
    const brokerId = this.resolveBrokerId(order.assetClass);
    const broker = providerRegistry.getBroker(brokerId);
    return broker.placeOrder(order);
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
