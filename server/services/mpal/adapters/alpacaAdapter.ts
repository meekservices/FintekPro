import { IBroker } from '../interfaces/IBroker';
import { alpacaClient } from '../../alpaca/core/alpacaClient';
import { alpacaAccountService } from '../../alpaca/core/alpacaAccountService';
import { alpacaAccountCreator } from '../../alpaca/onboarding/alpacaAccountCreator';
import { alpacaPortfolioSync } from '../../alpaca/portfolio/portfolioSync';
import { orderManager } from '../../alpaca/trading/orderManager';

export class AlpacaAdapter implements IBroker {
  public readonly brokerId = 'ALPACA';

  async createAccount(user: any): Promise<any> {
    return alpacaAccountCreator.createAccountForUser(user.id);
  }

  async getPositions(accountId: string): Promise<any[]> {
    return alpacaPortfolioSync.getNormalizedPositions(accountId);
  }

  async placeOrder(order: any): Promise<any> {
    return orderManager.placeOrder(order.userId, {
      symbol: order.symbol,
      qty: order.qty,
      side: order.side,
      type: order.type,
      time_in_force: order.timeInForce
    });
  }

  async placeNotionalOrder(userId: string, symbol: string, notional: number, side: 'buy' | 'sell'): Promise<any> {
    return orderManager.placeOrder(userId, {
      symbol,
      notional,
      side,
      type: 'market',
      time_in_force: 'day'
    });
  }
}

export const alpacaAdapter = new AlpacaAdapter();
