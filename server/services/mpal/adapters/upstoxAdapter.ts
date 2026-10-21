/**
 * MPAL — UpstoxAdapter
 *
 * Purpose : Connects FintekPro to Upstox for Indian equity (NSE/BSE)
 *           and F&O order execution.
 *
 * API Specs: https://upstox.com/developer/api-documentation/api-overview
 * Sandbox  : https://sandbox.upstox.com/v2/order/place
 * Live     : https://api.upstox.com/v2/order/place
 *
 * Compliance:
 *   - FASP-AI v1.0 & GCR v1.0: Strict confirmation, LIMIT-by-default, idempotent.
 *   - Auto-detects Sandbox mode when UPSTOX_SANDBOX=true.
 */

import axios, { type AxiosInstance } from "axios";
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
import { upstoxMarketDataService, toNseKey } from "../../upstox-market-data-service";

const LIVE_BASE_URL = "https://api.upstox.com/v2";
const SANDBOX_BASE_URL = "https://sandbox.upstox.com/v2";

export class UpstoxAdapter extends BaseBroker {
  public readonly brokerId = "UPSTOX";

  public readonly capabilities: readonly BrokerCapability[] = [
    "EQUITY_IN",
    "FNO",
  ];

  private _client: AxiosInstance | null = null;

  /**
   * Returns true if either UPSTOX_TRADING_ACCESS_TOKEN or UPSTOX_ACCESS_TOKEN is configured.
   */
  isConfigured(): boolean {
    return !!(
      process.env.UPSTOX_TRADING_ACCESS_TOKEN ||
      process.env.UPSTOX_SANDBOX_ACCESS_TOKEN ||
      process.env.UPSTOX_ACCESS_TOKEN
    );
  }

  private isSandbox(): boolean {
    return process.env.UPSTOX_SANDBOX === "true";
  }

  private getToken(): string {
    if (this.isSandbox()) {
      return (
        process.env.UPSTOX_SANDBOX_ACCESS_TOKEN ||
        process.env.UPSTOX_TRADING_ACCESS_TOKEN ||
        process.env.UPSTOX_ACCESS_TOKEN ||
        ""
      );
    }
    return (
      process.env.UPSTOX_TRADING_ACCESS_TOKEN ||
      process.env.UPSTOX_ACCESS_TOKEN ||
      ""
    );
  }

  /**
   * Retrieves an Axios instance configured with either the custom user token or the default system token.
   */
  public getClient(customToken?: string): AxiosInstance {
    const baseURL = this.isSandbox() ? SANDBOX_BASE_URL : LIVE_BASE_URL;
    const token = customToken || this.getToken();

    if (!customToken) {
      if (!this._client || this._client.defaults.baseURL !== baseURL) {
        this._client = axios.create({
          baseURL,
          timeout: 10_000,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
            "Api-Version": "2.0",
          },
        });
      }
      return this._client;
    }

    // Return dedicated instance for client-specific OAuth token
    return axios.create({
      baseURL,
      timeout: 10_000,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "Api-Version": "2.0",
      },
    });
  }

  private get client(): AxiosInstance {
    return this.getClient();
  }

  /**
   * Health probe: checks token probe via Upstox market quote / user endpoint.
   */
  async healthCheck(timeoutMs = 3000): Promise<BrokerHealthStatus> {
    const checkedAt = new Date().toISOString();
    if (!this.isConfigured()) {
      return {
        brokerId: this.brokerId,
        configured: false,
        healthy: false,
        message: "Upstox access token not configured",
        checkedAt,
      };
    }

    const t0 = Date.now();
    try {
      const probe = await upstoxMarketDataService.probeToken();
      const isHealthy = probe === "ok";
      return {
        brokerId: this.brokerId,
        configured: true,
        healthy: isHealthy,
        latencyMs: Date.now() - t0,
        message: isHealthy
          ? `Upstox ${this.isSandbox() ? "Sandbox" : "Live"} connected`
          : "Upstox token probe unconfirmed",
        checkedAt,
      };
    } catch (err: any) {
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
   * Account creation stub for Upstox (managed via Upstox onboarding flow).
   */
  async createAccount(user: {
    id: string;
    email?: string;
    mobile?: string;
    [key: string]: unknown;
  }): Promise<any> {
    logger.info(`[UpstoxAdapter] createAccount requested`, {
      event: "UPSTOX_CREATE_ACCOUNT",
      user_id: user.id,
      status: "stub",
    });
    return {
      status: "UPSTOX_ONBOARDING_REDIRECT",
      providerId: this.brokerId,
      message: "Please link your Upstox UCC account via OAuth.",
    };
  }

  /**
   * Place an order on Upstox (v3 PlaceOrderRequest format).
   * Supports client-specific OAuth multi-tenancy via order.meta.userToken or order.meta.clientToken.
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
    const product = (order.meta?.product as string) || "D"; // 'D' = Delivery, 'I' = Intraday
    const validity = order.timeInForce === "ioc" ? "IOC" : "DAY";

    // Symbol to instrument token format: NSE_EQ|{ISIN}
    const isinOrSym = toNseKey(order.symbol);

    const payload = {
      quantity: qty,
      product,
      validity,
      price,
      tag: order.idempotencyKey || `fp-${Date.now()}`,
      instrument_token: isinOrSym,
      order_type: orderType,
      transaction_type: transactionType,
      disclosed_quantity: 0,
      trigger_price: order.stopPrice ?? 0,
      is_amo: false,
    };

    const customToken =
      (order.meta?.userToken as string) ||
      (order.meta?.clientToken as string) ||
      (order.meta?.token as string);

    const activeClient = this.getClient(customToken);

    logger.info(`[UpstoxAdapter] Submitting order`, {
      event: "UPSTOX_ORDER_SUBMIT",
      symbol: order.symbol,
      qty,
      side: order.side,
      is_sandbox: this.isSandbox(),
      user_id: order.userId,
      is_custom_token: Boolean(customToken),
    });

    try {
      const endpoint = "/order/place";
      const resp = await activeClient.post(endpoint, payload);
      const resData = resp.data?.data;
      const orderId = resData?.order_id || resData?.order_ids?.[0] || `UP-${Date.now()}`;

      return {
        internalOrderId: order.idempotencyKey,
        brokerOrderId: orderId,
        status: "submitted",
        filledQty: 0,
        filledPrice: price,
        brokerTimestamp: new Date().toISOString(),
        _raw: resp.data,
      };
    } catch (err: any) {
      const errCode = err?.response?.data?.errors?.[0]?.errorCode || err?.response?.status;
      const errMsg = err?.response?.data?.errors?.[0]?.message || err?.message || "Order placement failed";
      
      logger.error(`[UpstoxAdapter] Order rejected`, {
        event: "UPSTOX_ORDER_FAILED",
        error_code: errCode,
        message: errMsg,
        latency_ms: Date.now() - t0,
      });

      throw new BrokerError(
        this.brokerId,
        String(errCode),
        `Upstox order rejected: ${errMsg}`,
        err?.response?.status === 429
      );
    }
  }

  /**
   * Cancel an open order on Upstox.
   */
  async cancelOrder(orderId: string, customToken?: string): Promise<void> {
    try {
      const activeClient = this.getClient(customToken);
      await activeClient.delete("/order/cancel", {
        params: { order_id: orderId },
      });
    } catch (err: any) {
      throw new BrokerError(
        this.brokerId,
        "CANCEL_FAILED",
        `Upstox order cancellation failed: ${err.message}`,
        false
      );
    }
  }

  /**
   * Poll Upstox for live order status with deterministic status mapping.
   */
  async getOrderStatus(orderId: string, customToken?: string): Promise<BrokerOrderResult> {
    try {
      const activeClient = this.getClient(customToken);
      const resp = await activeClient.get("/order/history", {
        params: { order_id: orderId },
      });
      const orderData = resp.data?.data?.[0];
      const rawStatus = (orderData?.status || "").toLowerCase();

      let status: BrokerOrderResult["status"] = "submitted";
      if (rawStatus === "complete") {
        status = "filled";
      } else if (rawStatus === "rejected") {
        status = "rejected";
      } else if (rawStatus === "cancelled") {
        status = "cancelled";
      } else if (rawStatus.includes("partially")) {
        status = "partially_filled";
      } else if (rawStatus === "pending" || rawStatus === "validation pending") {
        status = "pending";
      } else if (rawStatus === "open" || rawStatus === "trigger pending") {
        status = "submitted";
      }

      return {
        brokerOrderId: orderId,
        status,
        filledQty: Number(orderData?.filled_quantity ?? 0),
        filledPrice: Number(orderData?.average_price ?? 0),
        brokerTimestamp: orderData?.order_timestamp || new Date().toISOString(),
        _raw: resp.data,
      };
    } catch (err: any) {
      throw new BrokerError(
        this.brokerId,
        "GET_STATUS_FAILED",
        `Failed to get Upstox order status: ${err.message}`,
        false
      );
    }
  }

  /**
   * Fetch open positions.
   */
  async getPositions(userId?: string, customToken?: string): Promise<NormalizedPosition[]> {
    try {
      const activeClient = this.getClient(customToken);
      const resp = await activeClient.get("/portfolio/short-term-positions");
      const positions = resp.data?.data || [];
      return positions.map((p: any) => ({
        symbol: p.trading_symbol || p.symbol,
        providerSymbol: p.instrument_token,
        assetClass: "EQUITY_IN",
        name: p.trading_symbol || p.symbol,
        quantity: Number(p.quantity ?? 0),
        averageCost: Number(p.average_price ?? 0),
        currentPrice: Number(p.last_price ?? 0),
        unrealizedPnl: Number(p.pnl ?? 0),
        currency: "INR",
        _raw: p,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Fetch long-term portfolio holdings (Demat holdings).
   */
  async getHoldings(_userId?: string, customToken?: string): Promise<NormalizedPosition[]> {
    try {
      const activeClient = this.getClient(customToken);
      const resp = await activeClient.get("/portfolio/long-term-holdings");
      const holdings = resp.data?.data || [];
      return holdings.map((h: any) => ({
        symbol: h.trading_symbol || h.symbol || h.isin,
        providerSymbol: h.instrument_token || h.isin,
        assetClass: "EQUITY_IN",
        name: h.company_name || h.trading_symbol,
        quantity: Number(h.quantity ?? 0),
        averageCost: Number(h.avg_price ?? h.average_price ?? 0),
        currentPrice: Number(h.last_price ?? 0),
        unrealizedPnl: Number(h.pnl ?? 0),
        currency: "INR",
        _raw: h,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Upstox does not support fractional/notional cash orders.
   */
  async placeNotionalOrder(
    _userId: string,
    _symbol: string,
    _notional: number,
    _side: "buy" | "sell"
  ): Promise<BrokerOrderResult> {
    throw new BrokerCapabilityError(this.brokerId, "NOTIONAL_ORDER");
  }

  // ─── 1. Getting Started: Auth & Config Helpers ─────────────────────────────

  /**
   * Generates Upstox OAuth login authorization dialog URL.
   */
  getLoginDialogUrl(clientId: string, redirectUri: string, state = "fintekpro"): string {
    return `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${encodeURIComponent(
      clientId
    )}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
  }

  /**
   * Exchanges authorization code for Upstox access token.
   */
  async exchangeAuthCode(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string
  ): Promise<{ access_token: string; user_id?: string; user_name?: string }> {
    const params = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });

    const resp = await axios.post("https://api.upstox.com/v2/login/authorization/token", params.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
    });

    return resp.data;
  }

  /**
   * Returns hosted Upstox Model Context Protocol (MCP) configuration.
   */
  getMcpConfig() {
    return {
      serverName: "Upstox MCP",
      endpoint: "https://mcp.upstox.com/mcp",
      clientCommand: "npx -y mcp-remote https://mcp.upstox.com/mcp",
      capabilities: ["holdings", "orders", "positions", "funds", "profile", "mutual-funds"],
    };
  }

  // ─── 2. Accounts & Funds ───────────────────────────────────────────────────

  /**
   * Fetches the user profile (UCC, client name, enabled exchanges).
   */
  async getProfile(customToken?: string): Promise<any> {
    const activeClient = this.getClient(customToken);
    const resp = await activeClient.get("/user/profile");
    return resp.data?.data;
  }

  /**
   * Fetches available funds, cash balance, and margin utilization.
   */
  async getFundsAndMargin(segment?: "SEC" | "COM", customToken?: string): Promise<any> {
    const activeClient = this.getClient(customToken);
    const resp = await activeClient.get("/user/get-funds-and-margin", {
      params: segment ? { segment } : undefined,
    });
    return resp.data?.data;
  }

  /**
   * Computes brokerage and exchange transaction charges before placing order.
   */
  async calculateBrokerage(
    params: {
      symbol: string;
      quantity: number;
      price: number;
      transactionType: "BUY" | "SELL";
      product?: "D" | "I";
    },
    customToken?: string
  ): Promise<any> {
    const activeClient = this.getClient(customToken);
    const isinKey = toNseKey(params.symbol);
    const resp = await activeClient.get("/charges/brokerage", {
      params: {
        instrument_token: isinKey,
        quantity: params.quantity,
        product: params.product || "D",
        transaction_type: params.transactionType,
        price: params.price,
      },
    });
    return resp.data?.data;
  }

  /**
   * Computes upfront margin required for one or more order instruments.
   */
  async calculateOrderMargin(
    instruments: Array<{
      symbol: string;
      quantity: number;
      transactionType: "BUY" | "SELL";
      price: number;
      product?: "D" | "I";
    }>,
    customToken?: string
  ): Promise<any> {
    const activeClient = this.getClient(customToken);
    const payload = {
      instruments: instruments.map((inst) => ({
        instrument_key: toNseKey(inst.symbol),
        quantity: inst.quantity,
        product: inst.product || "D",
        transaction_type: inst.transactionType,
        price: inst.price,
      })),
    };
    const resp = await activeClient.post("/charges/margin", payload);
    return resp.data?.data;
  }

  /**
   * Retrieves kill-switch segment lock status.
   */
  async getKillSwitch(customToken?: string): Promise<any> {
    const activeClient = this.getClient(customToken);
    const resp = await activeClient.get("/user/kill-switch");
    return resp.data?.data;
  }

  // ─── 3. Orders & Trading ───────────────────────────────────────────────────

  /**
   * Modifies an existing open/pending order.
   */
  async modifyOrder(
    orderId: string,
    updates: {
      quantity?: number;
      price?: number;
      orderType?: "LIMIT" | "MARKET";
      validity?: "DAY" | "IOC";
      triggerPrice?: number;
      disclosedQuantity?: number;
    },
    customToken?: string
  ): Promise<any> {
    const activeClient = this.getClient(customToken);
    const payload: Record<string, any> = { order_id: orderId };
    if (updates.quantity !== undefined) payload.quantity = updates.quantity;
    if (updates.price !== undefined) payload.price = updates.price;
    if (updates.orderType !== undefined) payload.order_type = updates.orderType;
    if (updates.validity !== undefined) payload.validity = updates.validity;
    if (updates.triggerPrice !== undefined) payload.trigger_price = updates.triggerPrice;
    if (updates.disclosedQuantity !== undefined) payload.disclosed_quantity = updates.disclosedQuantity;

    const resp = await activeClient.put("/order/modify", payload);
    return resp.data?.data;
  }

  /**
   * Retrieves the complete order book for the current trading day.
   */
  async getOrderBook(customToken?: string): Promise<any[]> {
    const activeClient = this.getClient(customToken);
    const resp = await activeClient.get("/order/retrieve-all");
    return resp.data?.data || [];
  }

  /**
   * Exits all open positions across segments or matching a tag filter.
   */
  async exitAllPositions(tag?: string, segment?: string, customToken?: string): Promise<any> {
    const activeClient = this.getClient(customToken);
    const payload: Record<string, any> = {};
    if (tag) payload.tag = tag;
    if (segment) payload.segment = segment;
    const resp = await activeClient.post("/order/positions/exit", payload);
    return resp.data?.data;
  }

  // ─── 4. Portfolio ──────────────────────────────────────────────────────────

  /**
   * Converts open position margin product (e.g. Intraday 'I' -> Delivery 'D').
   */
  async convertPosition(params: {
    symbol: string;
    quantity: number;
    newProduct: "D" | "I";
    oldProduct: "D" | "I";
    transactionType: "BUY" | "SELL";
  }): Promise<any> {
    const payload = {
      instrument_token: toNseKey(params.symbol),
      new_product: params.newProduct,
      old_product: params.oldProduct,
      transaction_type: params.transactionType,
      quantity: params.quantity,
    };
    const resp = await this.client.put("/portfolio/positions/convert", payload);
    return resp.data?.data;
  }

  // ─── 5. Market Data ────────────────────────────────────────────────────────

  /**
   * Retrieves full Put/Call option chain with strike Greeks and IV.
   */
  async getOptionChain(symbol = "Nifty 50", expiryDate?: string): Promise<any[]> {
    const instrumentKey = symbol.toUpperCase().includes("|")
      ? symbol
      : symbol.toUpperCase().includes("NIFTY")
      ? `NSE_INDEX|${symbol}`
      : toNseKey(symbol);

    const params: Record<string, string> = { instrument_key: instrumentKey };
    if (expiryDate) params.expiry_date = expiryDate;

    const resp = await this.client.get("/option/chain", { params });
    return resp.data?.data || [];
  }

  // ─── 6. Realtime & Streaming ───────────────────────────────────────────────

  /**
   * Authorizes WebSocket streaming endpoint for live Market Data Feed (V3).
   */
  async getMarketDataWsAuth(): Promise<{ authorizedRedirectUri: string }> {
    const resp = await axios.get("https://api.upstox.com/v3/feed/market-data-feed/authorize", {
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
        Accept: "application/json",
      },
      timeout: 10_000,
    });
    const data = resp.data?.data;
    const uri = data?.authorizedRedirectUri || data?.authorized_redirect_uri || "";
    return { authorizedRedirectUri: uri };
  }

  /**
   * Authorizes WebSocket streaming endpoint for live Portfolio / Order Updates.
   */
  async getPortfolioStreamWsAuth(customToken?: string): Promise<{ authorizedRedirectUri: string }> {
    const activeClient = this.getClient(customToken);
    const resp = await activeClient.get("/feed/portfolio-stream-feed/authorize");
    const data = resp.data?.data;
    const uri = data?.authorizedRedirectUri || data?.authorized_redirect_uri || "";
    return { authorizedRedirectUri: uri };
  }

  // ─── 7. Partner & Advanced Demat Features ───────────────────────────────────

  /**
   * Submits an atomic basket / multi-order in a single API trip (POST /v2/order/multi/place).
   * Essential for Model Portfolio rebalancing across multiple constituents.
   */
  async placeMultiOrder(
    orders: Array<{
      symbol: string;
      qty: number;
      side: "buy" | "sell";
      type?: "market" | "limit";
      limitPrice?: number;
      tag?: string;
      product?: "D" | "I";
    }>,
    customToken?: string
  ): Promise<{ success: boolean; orderIds: string[]; raw?: any }> {
    const t0 = Date.now();
    const activeClient = this.getClient(customToken);

    const payload = orders.map((o) => ({
      quantity: Math.max(1, Math.round(o.qty)),
      product: o.product || "D",
      validity: "DAY",
      price: o.type === "market" ? 0 : (o.limitPrice ?? 0),
      tag: o.tag || `fp-basket-${Date.now()}`,
      instrument_token: toNseKey(o.symbol),
      order_type: o.type === "market" ? "MARKET" : "LIMIT",
      transaction_type: o.side.toUpperCase() as "BUY" | "SELL",
      disclosed_quantity: 0,
      trigger_price: 0,
      is_amo: false,
    }));

    try {
      const resp = await activeClient.post("/order/multi/place", payload);
      const resData = resp.data?.data || [];
      const orderIds: string[] = Array.isArray(resData)
        ? resData.map((r: any) => r.order_id || r.id).filter(Boolean)
        : resData.order_ids || [];

      logger.info("[UpstoxAdapter] Placed multi-order basket", {
        event: "UPSTOX_MULTI_ORDER_SUCCESS",
        count: orders.length,
        orderIds,
        latency_ms: Date.now() - t0,
      });

      return { success: true, orderIds, raw: resp.data };
    } catch (err: any) {
      logger.error("[UpstoxAdapter] Multi-order basket failure", {
        event: "UPSTOX_MULTI_ORDER_FAILED",
        error: err.response?.data || err.message,
        latency_ms: Date.now() - t0,
      });
      throw new BrokerError(
        this.brokerId,
        "MULTI_ORDER_FAILED",
        `Upstox basket order placement failed: ${err.message}`,
        err?.response?.status === 429
      );
    }
  }

  /**
   * Fetches active CDSL/NSDL EDIS pre-trade authorization status for Demat holdings.
   */
  async getEdisDetails(customToken?: string): Promise<any> {
    const activeClient = this.getClient(customToken);
    try {
      const resp = await activeClient.get("/edis/details");
      return resp.data?.data;
    } catch (err: any) {
      logger.warn(`[UpstoxAdapter] Failed to fetch EDIS details: ${err.message}`);
      return null;
    }
  }

  /**
   * Generates a CDSL TPIN EDIS authorization request for selling holdings.
   */
  async requestEdis(
    params: { isin: string; quantity: number },
    customToken?: string
  ): Promise<{ redirectUrl?: string; htmlForm?: string; raw?: any }> {
    const activeClient = this.getClient(customToken);
    try {
      const resp = await activeClient.post("/edis/request", {
        isin: params.isin,
        quantity: Math.max(1, Math.round(params.quantity)),
      });
      return {
        redirectUrl: resp.data?.data?.redirect_url,
        htmlForm: resp.data?.data?.html,
        raw: resp.data?.data,
      };
    } catch (err: any) {
      throw new BrokerError(
        this.brokerId,
        "EDIS_REQUEST_FAILED",
        `Failed to request EDIS authorization: ${err.message}`,
        false
      );
    }
  }

  /**
   * Places a Good-Till-Triggered (GTT) conditional stop-loss / target order (POST /v3/order/gtt/place).
   */
  async placeGttOrder(
    params: {
      symbol: string;
      transactionType: "BUY" | "SELL";
      quantity: number;
      triggerPrice: number;
      limitPrice: number;
      product?: "D" | "I";
    },
    customToken?: string
  ): Promise<any> {
    const activeClient = this.getClient(customToken);
    const payload = {
      type: "SINGLE",
      quantity: Math.max(1, Math.round(params.quantity)),
      product: params.product || "D",
      rules: [
        {
          strategy: params.transactionType === "BUY" ? "ENTRY" : "STOPLOSS",
          trigger_type: params.transactionType === "BUY" ? "ABOVE" : "BELOW",
          trigger_price: params.triggerPrice,
        },
      ],
      instrument_token: toNseKey(params.symbol),
      transaction_type: params.transactionType,
      order_type: "LIMIT",
      price: params.limitPrice,
    };

    try {
      const resp = await activeClient.post("/order/gtt/place", payload);
      return resp.data?.data;
    } catch (err: any) {
      throw new BrokerError(
        this.brokerId,
        "GTT_ORDER_FAILED",
        `Failed to place Upstox GTT order: ${err.message}`,
        false
      );
    }
  }
}

export const upstoxAdapter = new UpstoxAdapter();
