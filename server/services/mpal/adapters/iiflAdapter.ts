/**
 * MPAL — IIFLAdapter
 *
 * Purpose : Connects FintekPro to IIFL Securities for Indian equity (NSE/BSE)
 *           and F&O execution.
 *
 * Status  : PRODUCTION STUB — fully typed and safe for deployment.
 *           All methods return structured IIFL_NOT_LIVE errors until
 *           IIFL_API_KEY + IIFL_CLIENT_ID env vars are set AND
 *           the TODO bodies are completed with IIFL's Trader Terminal API.
 *
 * To go live:
 *   1. Obtain IIFL Trader Terminal / IIFL Markets API credentials
 *   2. Set IIFL_API_KEY and IIFL_CLIENT_ID in environment
 *   3. Replace each TODO block with real API calls using this.callWithRetry()
 *
 * API reference: https://ttblaze.iifl.com/doc/interactive/
 *
 * Edge cases:
 *   - isConfigured() false  → router skips this broker, returns 503
 *   - healthCheck() timeout → marked unhealthy, router skips
 *   - placeNotionalOrder()  → not supported (IIFL uses qty-based orders)
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

const IIFL_BASE_URL = 'https://ttblaze.iifl.com/interactive';

export class IIFLAdapter extends BaseBroker {
  public readonly brokerId = 'IIFL';

  /**
   * Capabilities: Indian cash equity + F&O.
   * Add 'EQUITY_IN' only when live — currently safe because isConfigured()
   * returns false unless env vars are set.
   */
  public readonly capabilities: readonly BrokerCapability[] = ['EQUITY_IN', 'FNO'];

  /** Lazy-initialized Axios client (only created when configured) */
  private _client: AxiosInstance | null = null;

  /**
   * Returns true only when both IIFL_API_KEY and IIFL_CLIENT_ID are set.
   * Safe to call any number of times — never throws.
   */
  isConfigured(): boolean {
    return !!(process.env.IIFL_API_KEY && process.env.IIFL_CLIENT_ID);
  }

  private get client(): AxiosInstance {
    if (!this._client) {
      this._client = axios.create({
        baseURL: IIFL_BASE_URL,
        timeout: 10_000,
        headers: {
          'authorization': process.env.IIFL_API_KEY ?? '',
          'Content-Type': 'application/json',
        },
      });
    }
    return this._client;
  }

  /**
   * Health probe: pings IIFL's session endpoint.
   * Returns { healthy: false } if unconfigured — never throws.
   *
   * @param timeoutMs  max wait before marking unhealthy (default 3000ms)
   */
  async healthCheck(timeoutMs = 3000): Promise<BrokerHealthStatus> {
    const checkedAt = new Date().toISOString();
    if (!this.isConfigured()) {
      return { brokerId: this.brokerId, configured: false, healthy: false, message: 'IIFL_API_KEY or IIFL_CLIENT_ID not set', checkedAt };
    }
    const start = Date.now();
    try {
      // TODO: Replace with IIFL's actual session/ping endpoint
      await this.client.get('/user/profile', { timeout: timeoutMs });
      return { brokerId: this.brokerId, configured: true, healthy: true, latencyMs: Date.now() - start, checkedAt };
    } catch (err: any) {
      return {
        brokerId: this.brokerId,
        configured: true,
        healthy: false,
        latencyMs: Date.now() - start,
        message: err?.message ?? 'Health check failed',
        checkedAt,
      };
    }
  }

  /**
   * Creates/links a user account at IIFL.
   * In IIFL's flow this typically means onboarding via their partner portal
   * and storing the resulting clientCode.
   *
   * TODO: Implement IIFL account creation API call.
   */
  async createAccount(user: { id: string; email?: string; mobile?: string; [key: string]: unknown }): Promise<any> {
    logger.info(`[IIFLAdapter] createAccount requested`, { event: 'IIFL_CREATE_ACCOUNT', user_id: user.id, status: 'stub' });
    if (!this.isConfigured()) {
      return { status: 'IIFL_NOT_LIVE', providerId: null, message: 'IIFL not configured' };
    }
    // TODO: POST /user/register or IIFL partner onboarding flow
    throw new BrokerError(this.brokerId, 'IIFL_NOT_LIVE', 'IIFL account creation not yet implemented. Set IIFL credentials and complete TODO.', false);
  }

  /**
   * Returns normalised equity positions for the given IIFL client code.
   *
   * TODO: GET /portfolio/positions with Authorization header
   */
  async getPositions(clientCode: string): Promise<NormalizedPosition[]> {
    if (!this.isConfigured()) return [];
    return this.callWithRetry(async () => {
      // TODO: Replace with real IIFL positions API
      // const res = await this.client.get('/portfolio/positions', { params: { clientCode } });
      // return res.data.result.map(p => normalizeIIFLPosition(p));
      logger.info(`[IIFLAdapter] getPositions stub`, { event: 'IIFL_GET_POSITIONS', user_id: clientCode, status: 'stub' });
      throw new BrokerError(this.brokerId, 'IIFL_NOT_LIVE', 'IIFL positions not yet implemented.', false);
    }, 'getPositions');
  }

  /**
   * Places a quantity-based order on NSE/BSE via IIFL.
   *
   * TODO: POST /orders/regular with order payload
   * Reference: https://ttblaze.iifl.com/doc/interactive/#tag/Order-APIs
   */
  async placeOrder(order: BrokerOrder): Promise<BrokerOrderResult> {
    if (!this.isConfigured()) {
      throw new BrokerError(this.brokerId, 'IIFL_NOT_CONFIGURED', 'IIFL_API_KEY and IIFL_CLIENT_ID must be set to place orders.', false);
    }
    return this.callWithRetry(async () => {
      // TODO: Map BrokerOrder → IIFL order payload
      // const payload = {
      //   exchangeInstrumentID: order.symbol,
      //   orderSide: order.side === 'buy' ? 'BUY' : 'SELL',
      //   orderType: 'MARKET',
      //   productType: 'NRML',
      //   timeInForce: 'DAY',
      //   orderQuantity: order.qty,
      //   clientID: order.userId,
      // };
      // const res = await this.client.post('/orders/regular', payload);
      // return { brokerOrderId: res.data.result.AppOrderID, status: 'submitted' };
      logger.warn(`[IIFLAdapter] placeOrder stub called`, {
        event: 'IIFL_PLACE_ORDER',
        user_id: order.userId,
        symbol: order.symbol,
        status: 'stub',
      });
      throw new BrokerError(this.brokerId, 'IIFL_NOT_LIVE', 'IIFL order placement not yet implemented. Complete TODO in iiflAdapter.ts.', false);
    }, 'placeOrder');
  }

  /**
   * Notional orders are not supported by IIFL — always use qty-based orders.
   */
  async placeNotionalOrder(
    _userId: string,
    symbol: string,
    _notional: number,
    _side: 'buy' | 'sell',
  ): Promise<BrokerOrderResult> {
    throw new BrokerCapabilityError(this.brokerId, 'NOTIONAL_ORDER');
  }

  /**
   * Cancels an open IIFL order.
   *
   * TODO: DELETE /orders/regular/{AppOrderID}
   */
  async cancelOrder(orderId: string): Promise<void> {
    if (!this.isConfigured()) throw new BrokerError(this.brokerId, 'IIFL_NOT_CONFIGURED', 'IIFL not configured.', false);
    return this.callWithRetry(async () => {
      // TODO: await this.client.delete(`/orders/regular/${orderId}`);
      throw new BrokerError(this.brokerId, 'IIFL_NOT_LIVE', 'IIFL cancel order not yet implemented.', false);
    }, 'cancelOrder');
  }

  /**
   * Polls IIFL for the live status of an order.
   *
   * TODO: GET /orders/{AppOrderID}
   */
  async getOrderStatus(orderId: string): Promise<BrokerOrderResult> {
    if (!this.isConfigured()) throw new BrokerError(this.brokerId, 'IIFL_NOT_CONFIGURED', 'IIFL not configured.', false);
    return this.callWithRetry(async () => {
      // TODO: const res = await this.client.get(`/orders/${orderId}`);
      // return normalizeIIFLOrderResult(res.data.result);
      throw new BrokerError(this.brokerId, 'IIFL_NOT_LIVE', 'IIFL order status not yet implemented.', false);
    }, 'getOrderStatus');
  }
}

export const iiflAdapter = new IIFLAdapter();
