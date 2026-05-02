import { IBroker } from '../interfaces/IBroker';
import { alpacaClient } from '../../alpaca/core/alpacaClient';
import { alpacaAccountService } from '../../alpaca/core/alpacaAccountService';
import { portfolioSync } from '../../alpaca/portfolio/portfolioSync';
import { orderManager } from '../../alpaca/trading/orderManager';

export class AlpacaAdapter implements IBroker {
  public readonly brokerId = 'ALPACA';

  async createAccount(user: any): Promise<any> {
    return alpacaAccountService.createAccount(user.id);
  }

  async getPositions(accountId: string): Promise<any[]> {
    return portfolioSync.fetchNormalizedPositions(accountId);
  }

  async placeOrder(order: any): Promise<any> {
    // Adapter logic bridging canonical MPAL order object to Alpaca's OrderManager
    return orderManager.submitOrder(order.userId, order.symbol, order.qty, order.side, order.type, order.timeInForce);
  }
}

export const alpacaAdapter = new AlpacaAdapter();
