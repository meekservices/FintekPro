/**
 * MPAL — BrokerTemplate
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HOW TO ADD A NEW BROKER TO FINTEKPRO
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Step 1: Copy this file → `adapters/zerodhaAdapter.ts` (or your broker name)
 * Step 2: Replace every TODO with real API calls
 * Step 3: Add one line in `core/providerRegistry.ts`:
 *           this.brokers.set(zerodhaAdapter.brokerId, zerodhaAdapter);
 * Step 4: Add a `case 'ZERODHA':` in `events/webhookDispatcher.ts`
 * Step 5: Set environment variables (see isConfigured() below)
 * Step 6: Done. The router, routes, and health API all work automatically.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * This template is for: [BROKER NAME]
 * API docs: [BROKER API URL]
 * ─────────────────────────────────────────────────────────────────────────────
 */

import axios, { AxiosInstance } from 'axios';
import {
  BrokerCapability,
  BrokerOrder,
  BrokerOrderResult,
  BrokerHealthStatus,
  NormalizedPosition,
  BrokerCapabilityError,
  BrokerError,
} from '../interfaces/IBroker';
import { BaseBroker } from '../core/BaseBroker';
import { logger } from '../../../logger';

/** Change this to your broker's API base URL */
const BROKER_BASE_URL = 'https://api.yourbroker.com';

export class BrokerTemplate extends BaseBroker {

  // ─── Step 1: Set broker ID and capabilities ──────────────────────────────
  /** Unique uppercase ID — will appear in broker_orders.brokerId and logs */
  public readonly brokerId = 'BROKER_NAME'; // e.g. 'ZERODHA', 'ANGEL_ONE'

  /**
   * List ONLY the capabilities this broker actually supports.
   * The router will route orders here ONLY for these asset classes.
   * Options: 'EQUITY_IN' | 'FNO' | 'EQUITY_US' | 'MF' | 'NFO' | 'FD' | 'PMS' | 'AIF' | 'BOND' | 'NOTIONAL_ORDER'
   */
  public readonly capabilities: readonly BrokerCapability[] = [
    'EQUITY_IN', // Indian cash equities
    'FNO',       // F&O derivatives
    // Add more as needed
  ];

  private _client: AxiosInstance | null = null;

  // ─── Step 2: Configure env vars ──────────────────────────────────────────
  /**
   * Returns true ONLY if all required environment variables are set.
   * Never throws — the router calls this before every order.
   * If false, this broker is skipped in capability-based routing.
   */
  isConfigured(): boolean {
    return !!(
      process.env.BROKER_API_KEY &&   // TODO: change to your env var name
      process.env.BROKER_CLIENT_ID    // TODO: add/remove env vars as needed
    );
  }

  private get client(): AxiosInstance {
    if (!this._client) {
      this._client = axios.create({
        baseURL: BROKER_BASE_URL,
        timeout: 10_000,
        headers: {
          'Authorization': `Bearer ${process.env.BROKER_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });
    }
    return this._client;
  }

  // ─── Step 3: Health check ─────────────────────────────────────────────────
  /**
   * Pings the broker's health/session endpoint.
   * Replace GET /health with the actual lightweight endpoint.
   */
  async healthCheck(timeoutMs = 3000): Promise<BrokerHealthStatus> {
    const checkedAt = new Date().toISOString();
    if (!this.isConfigured()) {
      return { brokerId: this.brokerId, configured: false, healthy: false, message: 'Env vars not set', checkedAt };
    }
    const start = Date.now();
    try {
      // TODO: Replace with your broker's actual health/session endpoint
      await this.client.get('/health', { timeout: timeoutMs });
      return { brokerId: this.brokerId, configured: true, healthy: true, latencyMs: Date.now() - start, checkedAt };
    } catch (err: any) {
      return { brokerId: this.brokerId, configured: true, healthy: false, latencyMs: Date.now() - start, message: err?.message, checkedAt };
    }
  }

  // ─── Step 4: Account creation ─────────────────────────────────────────────
  async createAccount(user: { id: string; email?: string; mobile?: string; [key: string]: unknown }): Promise<any> {
    if (!this.isConfigured()) return { status: 'NOT_CONFIGURED' };
    // TODO: Call your broker's user registration / account linking API
    throw new BrokerError(this.brokerId, 'NOT_IMPLEMENTED', 'createAccount not yet implemented.', false);
  }

  // ─── Step 5: Positions ───────────────────────────────────────────────────
  async getPositions(accountId: string): Promise<NormalizedPosition[]> {
    if (!this.isConfigured()) return [];
    return this.callWithRetry(async () => {
      // TODO: GET /positions from your broker
      // const res = await this.client.get('/positions', { params: { clientId: accountId } });
      // return res.data.map(normalizePosition);
      throw new BrokerError(this.brokerId, 'NOT_IMPLEMENTED', 'getPositions not yet implemented.', false);
    }, 'getPositions');
  }

  // ─── Step 6: Place order ─────────────────────────────────────────────────
  async placeOrder(order: BrokerOrder): Promise<BrokerOrderResult> {
    if (!this.isConfigured()) throw new BrokerError(this.brokerId, 'NOT_CONFIGURED', 'Set env vars first.', false);
    return this.callWithRetry(async () => {
      // TODO: Map BrokerOrder → your broker's order payload format
      // TODO: POST to your broker's order endpoint
      // const res = await this.client.post('/orders', { ... });
      // return { brokerOrderId: res.data.orderId, status: 'submitted' };
      throw new BrokerError(this.brokerId, 'NOT_IMPLEMENTED', 'placeOrder not yet implemented.', false);
    }, 'placeOrder');
  }

  // ─── Step 7: Notional order (optional) ───────────────────────────────────
  async placeNotionalOrder(userId: string, symbol: string, notional: number, side: 'buy' | 'sell'): Promise<BrokerOrderResult> {
    // Remove this method if your broker doesn't support notional/fractional orders
    throw new BrokerCapabilityError(this.brokerId, 'NOTIONAL_ORDER');
  }

  // ─── Step 8: Cancel order ─────────────────────────────────────────────────
  async cancelOrder(orderId: string): Promise<void> {
    if (!this.isConfigured()) throw new BrokerError(this.brokerId, 'NOT_CONFIGURED', 'Set env vars first.', false);
    return this.callWithRetry(async () => {
      // TODO: DELETE /orders/{orderId}
      throw new BrokerError(this.brokerId, 'NOT_IMPLEMENTED', 'cancelOrder not yet implemented.', false);
    }, 'cancelOrder');
  }

  // ─── Step 9: Get order status ─────────────────────────────────────────────
  async getOrderStatus(orderId: string): Promise<BrokerOrderResult> {
    if (!this.isConfigured()) throw new BrokerError(this.brokerId, 'NOT_CONFIGURED', 'Set env vars first.', false);
    return this.callWithRetry(async () => {
      // TODO: GET /orders/{orderId}
      throw new BrokerError(this.brokerId, 'NOT_IMPLEMENTED', 'getOrderStatus not yet implemented.', false);
    }, 'getOrderStatus');
  }
}

// Export singleton — used in providerRegistry.ts
export const brokerTemplate = new BrokerTemplate();
