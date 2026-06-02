// @ts-nocheck
/**
 * MPAL — AlpacaAdapter
 *
 * Purpose : Bridges the MPAL IBroker interface to FintekPro's existing
 *           Alpaca service layer (alpacaAccountCreator, orderManager, etc.)
 *           Capabilities: US equities (LRS route) + crypto.
 */

import {
  BrokerCapability,
  BrokerOrder,
  BrokerOrderResult,
  BrokerHealthStatus,
  NormalizedPosition,
  BrokerCapabilityError,
} from '../interfaces/IBroker';
import { BaseBroker } from '../core/BaseBroker';
import { alpacaAccountCreator } from '../../alpaca/onboarding/alpacaAccountCreator';
import { alpacaPortfolioSync } from '../../alpaca/portfolio/portfolioSync';
import { orderManager } from '../../alpaca/trading/orderManager';
import { alpacaBrokerService } from '../../alpaca-broker-service';

export class AlpacaAdapter extends BaseBroker {
  public readonly brokerId = 'ALPACA';
  public readonly capabilities: readonly BrokerCapability[] = ['EQUITY_US', 'NOTIONAL_ORDER'];

  /**
   * Returns true when Alpaca API keys are present.
   * Delegates to the existing alpacaBrokerService.isConfigured().
   */
  isConfigured(): boolean {
    return alpacaBrokerService.isConfigured();
  }

  /**
   * Pings Alpaca's /v1/accounts endpoint (broker API).
   * Safe — always resolves, never throws.
   */
  async healthCheck(timeoutMs = 3000): Promise<BrokerHealthStatus> {
    const checkedAt = new Date().toISOString();
    if (!this.isConfigured()) {
      return { brokerId: this.brokerId, configured: false, healthy: false, message: 'ALPACA_API_KEY not set', checkedAt };
    }
    const start = Date.now();
    try {
      // Lightweight call — fetch accounts list with limit=1
      await alpacaBrokerService.listAccounts({ limit: 1 });
      return { brokerId: this.brokerId, configured: true, healthy: true, latencyMs: Date.now() - start, checkedAt };
    } catch (err: any) {
      return { brokerId: this.brokerId, configured: true, healthy: false, latencyMs: Date.now() - start, message: err?.message, checkedAt };
    }
  }

  async createAccount(user: { id: string; referredByCode?: string; [key: string]: unknown }): Promise<any> {
    return alpacaAccountCreator.createAccountForUser(user.id, '127.0.0.1', user.referredByCode);
  }

  async getPositions(accountId: string): Promise<NormalizedPosition[]> {
    const raw = await alpacaPortfolioSync.getNormalizedPositions(accountId);
    // Map existing position shape to NormalizedPosition
    return (raw ?? []).map((p: any) => ({
      symbol: p.symbol ?? p.ticker,
      providerSymbol: p.symbol,
      assetClass: 'EQUITY_US' as BrokerCapability,
      name: p.name ?? p.symbol,
      quantity: parseFloat(p.qty ?? p.quantity ?? '0'),
      averageCost: parseFloat(p.avg_entry_price ?? p.averageCost ?? '0'),
      currentPrice: parseFloat(p.current_price ?? '0') || undefined,
      unrealizedPnl: parseFloat(p.unrealized_pl ?? '0') || undefined,
      currency: 'USD' as const,
      _raw: p,
    }));
  }

  async placeOrder(order: BrokerOrder): Promise<BrokerOrderResult> {
    const result = await orderManager.placeOrder(order.userId, {
      symbol: order.symbol,
      qty: order.qty,
      notional: order.notional,
      side: order.side,
      type: order.type,
      time_in_force: order.timeInForce ?? 'day',
      limit_price: order.limitPrice?.toString(),
    });
    return {
      brokerOrderId: result.id ?? result.orderId,
      status: result.status ?? 'submitted',
      filledQty: parseFloat(result.filled_qty ?? '0') || undefined,
      filledPrice: parseFloat(result.filled_avg_price ?? '0') || undefined,
      _raw: result,
    };
  }

  async placeNotionalOrder(
    userId: string,
    symbol: string,
    notional: number,
    side: 'buy' | 'sell',
    _currency?: 'INR' | 'USD',
  ): Promise<BrokerOrderResult> {
    const result = await orderManager.placeOrder(userId, {
      symbol,
      notional,
      side,
      type: 'market',
      time_in_force: 'day',
    });
    return {
      brokerOrderId: result.id ?? result.orderId,
      status: result.status ?? 'submitted',
      _raw: result,
    };
  }

  async cancelOrder(orderId: string): Promise<void> {
    await alpacaBrokerService.cancelOrder(orderId);
  }

  async getOrderStatus(orderId: string): Promise<BrokerOrderResult> {
    const result = await alpacaBrokerService.getOrder(orderId);
    return {
      brokerOrderId: result.id,
      status: result.status,
      filledQty: parseFloat(result.filled_qty ?? '0') || undefined,
      filledPrice: parseFloat(result.filled_avg_price ?? '0') || undefined,
      _raw: result,
    };
  }
}

export const alpacaAdapter = new AlpacaAdapter();
