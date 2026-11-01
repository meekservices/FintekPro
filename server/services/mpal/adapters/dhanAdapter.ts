/**
 * MPAL — DhanAdapter
 *
 * Purpose : Connects FintekPro to Dhan (DhanHQ Partner API v2) for Indian equity
 *           (NSE/BSE), F&O, and MCX Commodity order execution, basket orders,
 *           order slicing, and Demat portfolio synchronization.
 *
 * API Specs: https://dhanhq.co/docs/v2/
 * Live Base: https://api.dhan.co/v2
 * Feed Base: wss://api-feed.dhan.co
 *
 * Compliance:
 *   - FASP-AI v1.0 & GCR v1.0: Strict confirmation, LIMIT-by-default, idempotent.
 *   - Auto-detects Sandbox mode when DHAN_SANDBOX=true.
 *   - Emits structured telemetry: { event, brokerId, latency_ms, status }.
 *
 * @module server/services/mpal/adapters/dhanAdapter
 */

import axios, { type AxiosInstance } from "axios";
import crypto from "crypto";
import {
  type BrokerCapability,
  type BrokerOrder,
  type BrokerOrderResult,
  type BrokerHealthStatus,
  type NormalizedPosition,
  BrokerCapabilityError,
  BrokerError,
} from "../interfaces/IBroker";
import { BaseBroker } from "../core/BaseBroker";
import { logger } from "../../../logger";

const LIVE_BASE_URL = "https://api.dhan.co/v2";
const SANDBOX_BASE_URL = "https://api.dhan.co/v2"; // Dhan uses standard base with sandbox partner/client profiles

export interface DhanSliceOrderLeg {
  dhanClientId: string;
  correlationId?: string;
  transactionType: "BUY" | "SELL";
  exchangeSegment: "NSE_EQ" | "BSE_EQ" | "NSE_FNO" | "BSE_FNO" | "MCX_COMM";
  productType: "CNC" | "INTRADAY" | "MARGIN" | "CO" | "BO";
  orderType: "LIMIT" | "MARKET" | "STOP_LOSS" | "STOP_LOSS_MARKET";
  validity: "DAY" | "IOC";
  securityId: string;
  quantity: number;
  disclosedQuantity?: number;
  price: number;
  triggerPrice?: number;
  afterMarketOrder?: boolean;
}

export class DhanAdapter extends BaseBroker {
  public readonly brokerId = "DHAN";

  public readonly capabilities: readonly BrokerCapability[] = [
    "EQUITY_IN",
    "FNO",
    "COMMODITY",
  ];

  private _client: AxiosInstance | null = null;

  /**
   * Returns true if partner credentials or trading token is configured.
   */
  isConfigured(): boolean {
    return !!(
      process.env.DHAN_CLIENT_ID ||
      process.env.DHAN_ACCESS_TOKEN ||
      process.env.DHAN_TRADING_ACCESS_TOKEN ||
      process.env.DHAN_SANDBOX_ACCESS_TOKEN ||
      process.env.DHAN_PARTNER_ID
    );
  }

  public isSandbox(): boolean {
    return (
      process.env.DHAN_SANDBOX === "true" ||
      process.env.NODE_ENV === "test" ||
      !process.env.DHAN_ACCESS_TOKEN
    );
  }

  private getToken(): string {
    if (this.isSandbox()) {
      return (
        process.env.DHAN_SANDBOX_ACCESS_TOKEN ||
        process.env.DHAN_TRADING_ACCESS_TOKEN ||
        process.env.DHAN_ACCESS_TOKEN ||
        ""
      );
    }
    return (
      process.env.DHAN_TRADING_ACCESS_TOKEN ||
      process.env.DHAN_ACCESS_TOKEN ||
      ""
    );
  }

  private getDefaultClientId(): string {
    return (
      process.env.DHAN_CLIENT_ID ||
      process.env.DHAN_PARTNER_CLIENT_ID ||
      "DHAN_PARTNER"
    );
  }

  /**
   * Retrieves an Axios instance configured with either client-specific token or default system token.
   */
  public getClient(customToken?: string, customClientId?: string): AxiosInstance {
    const baseURL = this.isSandbox() ? SANDBOX_BASE_URL : LIVE_BASE_URL;
    const token = customToken || this.getToken();
    const clientId = customClientId || this.getDefaultClientId();

    if (!customToken) {
      if (!this._client || this._client.defaults.baseURL !== baseURL) {
        this._client = axios.create({
          baseURL,
          timeout: 10_000,
          headers: {
            "access-token": token,
            "client-id": clientId,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        });
      }
      return this._client;
    }

    // Return dedicated instance for client-specific OAuth session
    return axios.create({
      baseURL,
      timeout: 10_000,
      headers: {
        "access-token": token,
        "client-id": clientId,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
  }

  private get client(): AxiosInstance {
    return this.getClient();
  }

  /**
   * Health probe: checks Dhan account fund limits or profile endpoint.
   */
  async healthCheck(timeoutMs = 3000): Promise<BrokerHealthStatus> {
    const checkedAt = new Date().toISOString();
    if (!this.isConfigured()) {
      return {
        brokerId: this.brokerId,
        configured: false,
        healthy: false,
        message: "DhanHQ Partner API credentials not configured",
        checkedAt,
      };
    }

    const t0 = Date.now();
    try {
      const activeClient = this.getClient();
      const token = this.getToken();

      if (!token && this.isSandbox()) {
        return {
          brokerId: this.brokerId,
          configured: true,
          healthy: true,
          latencyMs: Date.now() - t0,
          message: "DhanHQ Sandbox Mock Mode ready (awaiting live credentials)",
          checkedAt,
        };
      }

      const res = await activeClient.get("/fundlimit", { timeout: timeoutMs });
      const isHealthy = res.status >= 200 && res.status < 300;

      return {
        brokerId: this.brokerId,
        configured: true,
        healthy: isHealthy,
        latencyMs: Date.now() - t0,
        message: isHealthy
          ? `DhanHQ ${this.isSandbox() ? "Sandbox" : "Live"} operational`
          : "DhanHQ fundlimit probe returned non-200",
        checkedAt,
      };
    } catch (err: any) {
      if (this.isSandbox() || !this.getToken()) {
        return {
          brokerId: this.brokerId,
          configured: true,
          healthy: true,
          latencyMs: Date.now() - t0,
          message: `DhanHQ Sandbox Mode active (local simulation): ${err.message}`,
          checkedAt,
        };
      }
      return {
        brokerId: this.brokerId,
        configured: true,
        healthy: false,
        latencyMs: Date.now() - t0,
        message: err.message,
        checkedAt,
      };
    }
  }

  /**
   * Account onboarding redirect stub for Dhan.
   */
  async createAccount(user: {
    id: string;
    email?: string;
    mobile?: string;
    [key: string]: unknown;
  }): Promise<any> {
    logger.info(`[DhanAdapter] createAccount requested`, {
      event: "DHAN_CREATE_ACCOUNT",
      user_id: user.id,
      status: "lead_onboarding",
    });

    const partnerId = process.env.DHAN_PARTNER_ID || "FINTEKPRO";
    const leadUrl = `https://invite.dhan.co/?join=${encodeURIComponent(partnerId)}`;

    return {
      status: "DHAN_ONBOARDING_REDIRECT",
      providerId: this.brokerId,
      leadUrl,
      message: "Please open or link your Dhan Demat account using FintekPro Partner Connect.",
    };
  }

  /**
   * Resolve exchange segment from canonical symbol and capability.
   */
  private resolveExchangeSegment(
    symbol: string,
    capability: BrokerCapability,
    meta?: Record<string, unknown>
  ): "NSE_EQ" | "BSE_EQ" | "NSE_FNO" | "BSE_FNO" | "MCX_COMM" {
    if (meta?.exchangeSegment) {
      return meta.exchangeSegment as any;
    }
    if (capability === "COMMODITY") return "MCX_COMM";
    if (capability === "FNO") return "NSE_FNO";
    if (symbol.endsWith(".BO") || meta?.exchange === "BSE") return "BSE_EQ";
    return "NSE_EQ";
  }

  /**
   * Place an order on DhanHQ (v2 /orders API).
   */
  async placeOrder(order: BrokerOrder): Promise<BrokerOrderResult> {
    const t0 = Date.now();
    const qty = order.qty ?? 1;

    if (qty <= 0) {
      throw new BrokerError(
        this.brokerId,
        "INVALID_QUANTITY",
        "Order quantity must be at least 1",
        false
      );
    }

    const transactionType = order.side.toUpperCase() as "BUY" | "SELL";
    const orderType = order.type === "market" ? "MARKET" : "LIMIT";
    const price = orderType === "MARKET" ? 0 : (order.limitPrice ?? 0);
    const validity = order.timeInForce === "ioc" ? "IOC" : "DAY";
    const exchangeSegment = this.resolveExchangeSegment(order.symbol, order.capability, order.meta);
    const productType = (order.meta?.productType as any) || (order.meta?.product as any) || "CNC";

    // Security ID: Can be passed via order.meta.securityId or resolved from symbol
    const securityId = (order.meta?.securityId as string) || (order.meta?.instrumentKey as string) || order.symbol.replace(/\.NS|\.BO/g, "");

    const customToken =
      (order.meta?.userToken as string) ||
      (order.meta?.clientToken as string) ||
      (order.meta?.accessToken as string);

    const customClientId =
      (order.meta?.brokerClientId as string) ||
      (order.meta?.dhanClientId as string) ||
      this.getDefaultClientId();

    const correlationId = order.idempotencyKey || `fp-dhan-${Date.now()}`;

    const payload = {
      dhanClientId: customClientId,
      correlationId,
      transactionType,
      exchangeSegment,
      productType,
      orderType,
      validity,
      securityId: String(securityId),
      quantity: qty,
      disclosedQuantity: 0,
      price,
      triggerPrice: order.stopPrice ?? 0,
      afterMarketOrder: !!order.meta?.afterMarketOrder,
    };

    logger.info("[DhanAdapter] Placing order", {
      event: "DHAN_ORDER_DISPATCH",
      user_id: order.userId,
      symbol: order.symbol,
      side: order.side,
      qty,
      orderType,
      price,
      correlationId,
    });

    const activeToken = customToken || this.getToken();
    const isMock =
      !activeToken ||
      activeToken.startsWith("MOCK_") ||
      activeToken.includes("mock") ||
      (this.isSandbox() && process.env.DHAN_MOCK_SANDBOX !== "false");

    if (isMock) {
      const mockOrderId = `DHAN_MOCK_${Date.now()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      logger.info("[DhanAdapter] Simulated sandbox order response", {
        event: "DHAN_MOCK_ORDER_SUCCESS",
        orderId: mockOrderId,
      });

      return {
        brokerOrderId: mockOrderId,
        status: orderType === "MARKET" ? "filled" : "submitted",
        filledQty: orderType === "MARKET" ? qty : 0,
        filledPrice: orderType === "MARKET" ? (price || 100) : 0,
        brokerTimestamp: new Date().toISOString(),
        _raw: { mock: true, payload },
      };
    }

    try {
      const activeClient = this.getClient(customToken, customClientId);
      const res = await this.callWithRetry(
        () => activeClient.post("/orders", payload),
        "placeOrder"
      );

      const data = res.data;
      const brokerOrderId = data?.orderId || data?.data?.orderId || `DHAN_${Date.now()}`;
      const statusStr = (data?.orderStatus || data?.data?.orderStatus || "SUBMITTED").toUpperCase();

      let status: BrokerOrderResult["status"] = "submitted";
      if (statusStr === "TRADED" || statusStr === "FILLED") status = "filled";
      else if (statusStr === "REJECTED") status = "rejected";
      else if (statusStr === "CANCELLED") status = "cancelled";
      else if (statusStr === "PARTIALLY_TRADED") status = "partially_filled";

      logger.info("[DhanAdapter] Order successfully placed on Dhan", {
        event: "DHAN_ORDER_PLACED_SUCCESS",
        brokerOrderId,
        status,
        latency_ms: Date.now() - t0,
      });

      return {
        brokerOrderId,
        status,
        filledQty: data?.filledQty ?? 0,
        filledPrice: data?.avgPrice ?? data?.price ?? 0,
        brokerTimestamp: new Date().toISOString(),
        _raw: data,
      };
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || err?.response?.data?.errorMessage || err.message;
      const errorCode = err?.response?.data?.errorCode || "DHAN_ORDER_FAILED";

      logger.error("[DhanAdapter] Order placement failed on Dhan", {
        event: "DHAN_ORDER_ERROR",
        errorCode,
        message: errorMsg,
        user_id: order.userId,
      });

      throw new BrokerError(this.brokerId, errorCode, errorMsg, false);
    }
  }

  /**
   * Dhan Slice Order: Automatically slices orders exceeding exchange freeze limits.
   * Native to DhanHQ v2 (/orders/slicing).
   */
  async placeSliceOrder(order: BrokerOrder): Promise<BrokerOrderResult[]> {
    const t0 = Date.now();
    const qty = order.qty ?? 1;
    const transactionType = order.side.toUpperCase() as "BUY" | "SELL";
    const orderType = order.type === "market" ? "MARKET" : "LIMIT";
    const price = orderType === "MARKET" ? 0 : (order.limitPrice ?? 0);
    const validity = order.timeInForce === "ioc" ? "IOC" : "DAY";
    const exchangeSegment = this.resolveExchangeSegment(order.symbol, order.capability, order.meta);
    const productType = (order.meta?.productType as any) || "CNC";
    const securityId = (order.meta?.securityId as string) || order.symbol.replace(/\.NS|\.BO/g, "");

    const customToken = (order.meta?.userToken as string) || (order.meta?.accessToken as string);
    const customClientId = (order.meta?.brokerClientId as string) || this.getDefaultClientId();

    const payload = {
      dhanClientId: customClientId,
      correlationId: order.idempotencyKey || `fp-slice-${Date.now()}`,
      transactionType,
      exchangeSegment,
      productType,
      orderType,
      validity,
      securityId: String(securityId),
      quantity: qty,
      disclosedQuantity: 0,
      price,
      triggerPrice: order.stopPrice ?? 0,
      afterMarketOrder: false,
    };

    const activeToken = customToken || this.getToken();
    const isMock =
      !activeToken ||
      activeToken.startsWith("MOCK_") ||
      activeToken.includes("mock") ||
      (this.isSandbox() && process.env.DHAN_MOCK_SANDBOX !== "false");

    if (isMock) {
      return [
        {
          brokerOrderId: `DHAN_SLICE_${Date.now()}_1`,
          status: "submitted",
          filledQty: qty,
          brokerTimestamp: new Date().toISOString(),
          _raw: { mock: true, sliced: true },
        },
      ];
    }

    try {
      const activeClient = this.getClient(customToken, customClientId);
      const res = await this.callWithRetry(
        () => activeClient.post("/orders/slicing", payload),
        "placeSliceOrder"
      );

      const results = Array.isArray(res.data) ? res.data : [res.data];
      return results.map((r: any) => ({
        brokerOrderId: r?.orderId || `DHAN_${Date.now()}`,
        status: "submitted",
        brokerTimestamp: new Date().toISOString(),
        _raw: r,
      }));
    } catch (err: any) {
      throw new BrokerError(
        this.brokerId,
        "DHAN_SLICING_FAILED",
        err?.response?.data?.message || err.message,
        false
      );
    }
  }

  /**
   * Cancel an open order on DhanHQ.
   */
  async cancelOrder(orderId: string, customToken?: string, customClientId?: string): Promise<void> {
    const activeToken = customToken || this.getToken();
    const isMock =
      !activeToken ||
      activeToken.startsWith("MOCK_") ||
      activeToken.includes("mock") ||
      (this.isSandbox() && process.env.DHAN_MOCK_SANDBOX !== "false");

    if (isMock) {
      logger.info("[DhanAdapter] Simulated sandbox cancelOrder", { orderId });
      return;
    }

    const activeClient = this.getClient(customToken, customClientId);
    await this.callWithRetry(
      () => activeClient.delete(`/orders/${orderId}`),
      "cancelOrder"
    );
  }

  /**
   * Modify an existing pending order on DhanHQ.
   */
  async modifyOrder(
    orderId: string,
    updates: {
      orderType?: "LIMIT" | "MARKET" | "STOP_LOSS";
      quantity?: number;
      price?: number;
      triggerPrice?: number;
      validity?: "DAY" | "IOC";
    },
    customToken?: string,
    customClientId?: string
  ): Promise<BrokerOrderResult> {
    const activeToken = customToken || this.getToken();
    const isMock =
      !activeToken ||
      activeToken.startsWith("MOCK_") ||
      activeToken.includes("mock") ||
      (this.isSandbox() && process.env.DHAN_MOCK_SANDBOX !== "false");

    if (isMock) {
      return {
        brokerOrderId: orderId,
        status: "submitted",
        filledQty: 0,
        brokerTimestamp: new Date().toISOString(),
      };
    }

    const activeClient = this.getClient(customToken, customClientId);
    const res = await this.callWithRetry(
      () => activeClient.put(`/orders/${orderId}`, updates),
      "modifyOrder"
    );

    return {
      brokerOrderId: orderId,
      status: "submitted",
      _raw: res.data,
    };
  }

  /**
   * Query live status of an order on DhanHQ.
   */
  async getOrderStatus(
    orderId: string,
    customToken?: string,
    customClientId?: string
  ): Promise<BrokerOrderResult> {
    const activeToken = customToken || this.getToken();
    const isMock =
      !activeToken ||
      activeToken.startsWith("MOCK_") ||
      activeToken.includes("mock") ||
      (this.isSandbox() && process.env.DHAN_MOCK_SANDBOX !== "false");

    if (isMock) {
      return {
        brokerOrderId: orderId,
        status: "filled",
        filledQty: 1,
        filledPrice: 150.0,
        brokerTimestamp: new Date().toISOString(),
      };
    }

    const activeClient = this.getClient(customToken, customClientId);
    const res = await this.callWithRetry(
      () => activeClient.get(`/orders/${orderId}`),
      "getOrderStatus"
    );

    const d = res.data?.data || res.data;
    const statusStr = (d?.orderStatus || "").toUpperCase();

    let status: BrokerOrderResult["status"] = "submitted";
    if (statusStr === "TRADED" || statusStr === "FILLED") status = "filled";
    else if (statusStr === "REJECTED") status = "rejected";
    else if (statusStr === "CANCELLED") status = "cancelled";
    else if (statusStr === "PARTIALLY_TRADED") status = "partially_filled";

    return {
      brokerOrderId: orderId,
      status,
      filledQty: Number(d?.filledQty ?? 0),
      filledPrice: Number(d?.avgPrice ?? d?.price ?? 0),
      brokerTimestamp: d?.updateTime || new Date().toISOString(),
      _raw: d,
    };
  }

  /**
   * Fetch open intraday/derivatives positions.
   */
  async getPositions(
    _accountId?: string,
    customToken?: string,
    customClientId?: string
  ): Promise<NormalizedPosition[]> {
    const activeToken = customToken || this.getToken();
    const isMock =
      !activeToken ||
      activeToken.startsWith("MOCK_") ||
      activeToken.includes("mock") ||
      (this.isSandbox() && process.env.DHAN_MOCK_SANDBOX !== "false");

    if (isMock) {
      return [];
    }

    try {
      const activeClient = this.getClient(customToken, customClientId);
      const res = await activeClient.get("/positions");
      const list = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];

      return list.map((p: any) => ({
        symbol: p.tradingSymbol || p.securityId,
        providerSymbol: p.securityId,
        assetClass: p.exchangeSegment?.includes("COMM") ? "COMMODITY" : p.exchangeSegment?.includes("FNO") ? "FNO" : "EQUITY_IN",
        name: p.tradingSymbol || p.securityId,
        quantity: Number(p.netQty ?? 0),
        averageCost: Number(p.buyAvg ?? 0),
        currentPrice: Number(p.lastPrice ?? 0),
        unrealizedPnl: Number(p.unrealizedProfit ?? 0),
        currency: "INR",
        _raw: p,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Fetch long-term Demat holdings from Dhan.
   */
  async getHoldings(
    _userId?: string,
    customToken?: string,
    customClientId?: string
  ): Promise<NormalizedPosition[]> {
    const activeToken = customToken || this.getToken();
    const isMock =
      !activeToken ||
      activeToken.startsWith("MOCK_") ||
      activeToken.includes("mock") ||
      (this.isSandbox() && process.env.DHAN_MOCK_SANDBOX !== "false");

    if (isMock) {
      return [];
    }

    try {
      const activeClient = this.getClient(customToken, customClientId);
      const res = await activeClient.get("/holdings");
      const list = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];

      return list.map((h: any) => ({
        symbol: h.tradingSymbol || h.isin,
        providerSymbol: h.securityId || h.isin,
        assetClass: "EQUITY_IN",
        name: h.tradingSymbol || h.isin,
        quantity: Number(h.totalQty ?? 0),
        averageCost: Number(h.avgCostPrice ?? 0),
        currentPrice: Number(h.lastPrice ?? 0),
        unrealizedPnl: Number(h.unrealizedProfit ?? 0),
        currency: "INR",
        _raw: h,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Fetch cash balance, utilized margin, and collateral limits.
   */
  async getFundLimits(
    customToken?: string,
    customClientId?: string
  ): Promise<{
    availableBalance: number;
    utilizedAmount: number;
    collateralAmount: number;
  }> {
    const activeToken = customToken || this.getToken();
    const isMock =
      !activeToken ||
      activeToken.startsWith("MOCK_") ||
      activeToken.includes("mock") ||
      (this.isSandbox() && process.env.DHAN_MOCK_SANDBOX !== "false");

    if (isMock) {
      return { availableBalance: 500000, utilizedAmount: 0, collateralAmount: 0 };
    }

    const activeClient = this.getClient(customToken, customClientId);
    const res = await activeClient.get("/fundlimit");
    const d = res.data?.data || res.data;

    return {
      availableBalance: Number(d?.availabelBalance ?? d?.availableBalance ?? 0),
      utilizedAmount: Number(d?.utilizedAmount ?? 0),
      collateralAmount: Number(d?.collateralAmount ?? 0),
    };
  }

  /**
   * Calculate required margin before placing an order or basket.
   */
  async calculateMargin(
    items: Array<{
      dhanClientId: string;
      exchangeSegment: string;
      transactionType: "BUY" | "SELL";
      quantity: number;
      productType: string;
      securityId: string;
      price: number;
    }>,
    customToken?: string,
    customClientId?: string
  ): Promise<{ totalMargin: number; spanMargin?: number; exposureMargin?: number }> {
    const activeToken = customToken || this.getToken();
    const isMock =
      !activeToken ||
      activeToken.startsWith("MOCK_") ||
      activeToken.includes("mock") ||
      (this.isSandbox() && process.env.DHAN_MOCK_SANDBOX !== "false");

    if (isMock) {
      return { totalMargin: 5000 };
    }

    const activeClient = this.getClient(customToken, customClientId);
    const res = await activeClient.post("/margincalculator", items);
    const d = res.data?.data || res.data;

    return {
      totalMargin: Number(d?.totalMargin ?? 0),
      spanMargin: Number(d?.spanMargin ?? 0),
      exposureMargin: Number(d?.exposureMargin ?? 0),
    };
  }

  /**
   * Dhan does not support fractional / notional cash orders.
   */
  async placeNotionalOrder(
    _userId: string,
    _symbol: string,
    _notional: number,
    _side: "buy" | "sell"
  ): Promise<BrokerOrderResult> {
    throw new BrokerCapabilityError(this.brokerId, "NOTIONAL_ORDER");
  }

  // ─── OAuth & Partner Consent Helpers ────────────────────────────────────────

  /**
   * Generates Dhan login/consent authorization URL for linking client accounts.
   */
  getLoginDialogUrl(clientId: string, redirectUri: string, state = "fintekpro"): string {
    const partnerId = process.env.DHAN_PARTNER_ID || clientId;
    // Dhan Partner Consent flow:
    return `https://auth.dhan.co/login/consent-login?partner_id=${encodeURIComponent(
      partnerId
    )}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
  }

  /**
   * Exchanges authorization code or consent ID for Dhan access token.
   */
  async exchangeAuthCode(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string
  ): Promise<{ access_token: string; client_id?: string; user_name?: string }> {
    if (code.startsWith("MOCK_") || (!clientSecret && this.isSandbox())) {
      return {
        access_token: `dhan_token_${Date.now()}_mock`,
        client_id: "DHAN_CLIENT_TEST",
        user_name: "Dhan Test Investor",
      };
    }

    const resp = await axios.post(
      "https://auth.dhan.co/auth/token",
      {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      },
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    return resp.data;
  }

  /**
   * Fetches user profile (UCC, client name, demat status).
   */
  async getProfile(customToken?: string, customClientId?: string): Promise<any> {
    const activeToken = customToken || this.getToken();
    const isMock =
      !activeToken ||
      activeToken.startsWith("MOCK_") ||
      activeToken.includes("mock") ||
      (this.isSandbox() && process.env.DHAN_MOCK_SANDBOX !== "false");

    if (isMock) {
      return {
        client_id: "DHAN_TEST_UCC",
        user_name: "Dhan Sandbox Investor",
        exchanges: ["NSE", "BSE", "MCX"],
      };
    }

    const activeClient = this.getClient(customToken, customClientId);
    const res = await activeClient.get("/profile");
    return res.data?.data || res.data;
  }

  /**
   * Generates digital referral onboarding URL for new clients.
   */
  getPartnerLeadUrl(partnerId?: string): string {
    const pId = partnerId || process.env.DHAN_PARTNER_ID || "FINTEKPRO";
    return `https://invite.dhan.co/?join=${encodeURIComponent(pId)}`;
  }

  /**
   * Verifies Dhan Postback webhook HMAC signature.
   */
  verifyWebhookSignature(payload: string | object, signature: string, secret?: string): boolean {
    const webhookSecret = secret || process.env.DHAN_WEBHOOK_SECRET;
    if (!webhookSecret) return true; // Accept if no secret is configured (dev/sandbox)

    const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
    const expected = crypto.createHmac("sha256", webhookSecret).update(raw).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }
}

export const dhanAdapter = new DhanAdapter();
