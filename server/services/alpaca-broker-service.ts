import axios, { AxiosInstance } from "axios";
import { v4 as uuidv4 } from "uuid";

const ALPACA_BROKER_SANDBOX_URL = "https://broker-api.sandbox.alpaca.markets";
const ALPACA_BROKER_LIVE_URL = "https://broker-api.alpaca.markets";
const ALPACA_PAPER_URL = "https://paper-api.alpaca.markets";
const ALPACA_LIVE_URL = "https://api.alpaca.markets";

interface AlpacaOrder {
  id: string;
  client_order_id: string;
  status: string;
  symbol: string;
  qty?: string;
  notional?: string;
  filled_qty: string;
  filled_avg_price: string | null;
  order_type: string;
  side: string;
  time_in_force: string;
  created_at: string;
  submitted_at: string;
  filled_at: string | null;
}

interface AlpacaPosition {
  asset_id: string;
  symbol: string;
  qty: string;
  avg_entry_price: string;
  market_value: string;
  current_price: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  side: string;
}

interface AlpacaAccount {
  id: string;
  account_number: string;
  status: string;
  cash: string;
  portfolio_value: string;
  buying_power: string;
  equity: string;
  currency: string;
  long_market_value: string;
  short_market_value: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  realized_pl: string;
  daytrade_count: number;
  daytrading_buying_power: string;
  pattern_day_trader: boolean;
  trading_blocked: boolean;
  account_blocked: boolean;
  created_at: string;
}

export interface AlpacaPortfolioHistory {
  timestamp: number[];
  equity: number[];
  profit_loss: number[];
  profit_loss_pct: number[];
  base_value: number;
  timeframe: string;
}

export interface AlpacaMarketClock {
  timestamp: string;
  is_open: boolean;
  next_open: string;
  next_close: string;
}

interface OrderRequest {
  symbol: string;
  qty?: number;
  notional?: number;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop" | "stop_limit";
  time_in_force: "day" | "gtc" | "ioc" | "fok";
  limit_price?: number;
  stop_price?: number;
  client_order_id?: string;
}

class AlpacaBrokerService {
  private apiKey: string;
  private secretKey: string;
  private baseUrl: string;
  private client: AxiosInstance;
  private isPaper: boolean;

  constructor() {
    this.apiKey = process.env.ALPACA_API_KEY || "";
    this.secretKey = process.env.ALPACA_SECRET_KEY || "";
    this.baseUrl = process.env.ALPACA_BASE_URL || ALPACA_BROKER_SANDBOX_URL;
    this.isPaper = this.baseUrl.includes("sandbox") || this.baseUrl.includes("paper");
    this.client = this._buildClient();
  }

  private _isBrokerApi(): boolean {
    return this.baseUrl.includes("broker-api");
  }

  private _buildClient(): AxiosInstance {
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (this._isBrokerApi()) {
      // Broker API uses HTTP Basic auth: Authorization: Basic base64(key:secret)
      const encoded = Buffer.from(`${this.apiKey}:${this.secretKey}`).toString("base64");
      headers["Authorization"] = `Basic ${encoded}`;
    } else {
      // Trading API uses APCA header auth
      headers["APCA-API-KEY-ID"] = this.apiKey;
      headers["APCA-API-SECRET-KEY"] = this.secretKey;
    }

    return axios.create({
      baseURL: this.baseUrl,
      timeout: 15000,
      headers,
    });
  }

  configure(apiKey: string, secretKey: string, baseUrl?: string): void {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.baseUrl = baseUrl || ALPACA_BROKER_SANDBOX_URL;
    this.isPaper = this.baseUrl.includes("sandbox") || this.baseUrl.includes("paper");
    this.client = this._buildClient();
    process.env.ALPACA_API_KEY = apiKey;
    process.env.ALPACA_SECRET_KEY = secretKey;
    process.env.ALPACA_BASE_URL = this.baseUrl;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  isConfigured(): boolean {
    return !!(this.apiKey && this.secretKey);
  }

  isPaperTrading(): boolean {
    return this.isPaper;
  }

  isBrokerApi(): boolean {
    return this._isBrokerApi();
  }

  private _accountPath(): string {
    return this._isBrokerApi() ? "/v1/accounts" : "/v2/account";
  }

  private _ordersPath(accountId?: string): string {
    return this._isBrokerApi() && accountId
      ? `/v1/trading/accounts/${accountId}/orders`
      : "/v2/orders";
  }

  private _positionsPath(accountId?: string): string {
    return this._isBrokerApi() && accountId
      ? `/v1/trading/accounts/${accountId}/positions`
      : "/v2/positions";
  }

  private _portfolioHistoryPath(accountId?: string): string {
    return this._isBrokerApi() && accountId
      ? `/v1/trading/accounts/${accountId}/account/portfolio/history`
      : "/v2/account/portfolio/history";
  }

  async testConnection(): Promise<{ success: boolean; message: string; account?: AlpacaAccount }> {
    if (!this.isConfigured()) {
      return { success: false, message: "Alpaca API credentials not configured" };
    }

    try {
      const response = await this.client.get(this._accountPath());
      // Broker API returns an array of accounts; trading API returns a single object
      const accountData = Array.isArray(response.data) ? response.data[0] : response.data;
      return {
        success: true,
        message: `Connected to Alpaca (${this._isBrokerApi() ? "Broker" : "Trading"} · ${this.isPaper ? "Sandbox" : "Live"})`,
        account: accountData,
      };
    } catch (error: any) {
      console.error("Alpaca connection test failed:", error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.code || "Failed to connect to Alpaca",
      };
    }
  }

  async getAccount(accountId?: string): Promise<AlpacaAccount | null> {
    if (!this.isConfigured()) {
      throw new Error('Alpaca API not configured. Set ALPACA_API_KEY and ALPACA_API_SECRET for US trading.');
    }

    try {
      if (this._isBrokerApi() && accountId) {
        const response = await this.client.get(`/v1/accounts/${accountId}`);
        return response.data;
      } else if (this._isBrokerApi()) {
        // Return list of accounts for broker dashboard
        const response = await this.client.get("/v1/accounts");
        return Array.isArray(response.data) ? response.data[0] : response.data;
      } else {
        const response = await this.client.get("/v2/account");
        return response.data;
      }
    } catch (error: any) {
      console.error("Error fetching Alpaca account:", error.message);
      throw new Error(`Alpaca API call failed: ${error.message}`);
    }
  }

  async listBrokerAccounts(): Promise<AlpacaAccount[]> {
    if (!this.isConfigured() || !this._isBrokerApi()) return [];
    try {
      const response = await this.client.get("/v1/accounts");
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.error("Error listing broker accounts:", error.message);
      return [];
    }
  }

  async placeOrder(request: OrderRequest): Promise<AlpacaOrder | null> {
    const clientOrderId = request.client_order_id || uuidv4();

    if (!this.isConfigured()) {
      throw new Error('Alpaca API not configured. Set ALPACA_API_KEY and ALPACA_API_SECRET for US trading.');
    }

    try {
      const orderPayload: any = {
        symbol: request.symbol,
        side: request.side,
        type: request.type,
        time_in_force: request.time_in_force,
        client_order_id: clientOrderId,
      };

      if (request.qty) {
        orderPayload.qty = request.qty.toString();
      } else if (request.notional) {
        orderPayload.notional = request.notional.toString();
      }

      if (request.type === "limit" || request.type === "stop_limit") {
        orderPayload.limit_price = request.limit_price?.toString();
      }
      if (request.type === "stop" || request.type === "stop_limit") {
        orderPayload.stop_price = request.stop_price?.toString();
      }

      const response = await this.client.post("/v2/orders", orderPayload);
      return response.data;
    } catch (error: any) {
      console.error("Alpaca order placement failed:", error.response?.data || error.message);
      throw new Error(error.response?.data?.message || "Failed to place order");
    }
  }

  async getOrder(orderId: string): Promise<AlpacaOrder | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const response = await this.client.get(`/v2/orders/${orderId}`);
      return response.data;
    } catch (error: any) {
      console.error("Error fetching Alpaca order:", error.message);
      return null;
    }
  }

  async getOrderByClientId(clientOrderId: string): Promise<AlpacaOrder | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const response = await this.client.get(`/v2/orders:by_client_order_id`, {
        params: { client_order_id: clientOrderId },
      });
      return response.data;
    } catch (error: any) {
      console.error("Error fetching Alpaca order by client ID:", error.message);
      return null;
    }
  }

  async getOrders(status?: string, limit = 50, accountId?: string): Promise<AlpacaOrder[]> {
    if (!this.isConfigured()) {
      return [];
    }
    try {
      const path = this._isBrokerApi() && accountId
        ? `/v1/trading/accounts/${accountId}/orders`
        : "/v2/orders";
      const response = await this.client.get(path, { params: { status, limit } });
      return response.data;
    } catch (error: any) {
      console.error("Error fetching Alpaca orders:", error.message);
      return [];
    }
  }

  async cancelOrder(orderId: string, accountId?: string): Promise<boolean> {
    if (!this.isConfigured()) {
      return true;
    }
    try {
      const path = this._isBrokerApi() && accountId
        ? `/v1/trading/accounts/${accountId}/orders/${orderId}`
        : `/v2/orders/${orderId}`;
      await this.client.delete(path);
      return true;
    } catch (error: any) {
      console.error("Error canceling Alpaca order:", error.message);
      return false;
    }
  }

  async getPositions(accountId?: string): Promise<AlpacaPosition[]> {
    if (!this.isConfigured()) {
      throw new Error('Alpaca API not configured. Set ALPACA_API_KEY and ALPACA_API_SECRET for US trading.');
    }
    try {
      const path = this._isBrokerApi() && accountId
        ? `/v1/trading/accounts/${accountId}/positions`
        : "/v2/positions";
      const response = await this.client.get(path);
      return response.data;
    } catch (error: any) {
      console.error("Error fetching Alpaca positions:", error.message);
      throw new Error(`Alpaca API call failed: ${error.message}`);
    }
  }

  async getPosition(symbol: string, accountId?: string): Promise<AlpacaPosition | null> {
    if (!this.isConfigured()) {
      return null;
    }
    try {
      const path = this._isBrokerApi() && accountId
        ? `/v1/trading/accounts/${accountId}/positions/${symbol}`
        : `/v2/positions/${symbol}`;
      const response = await this.client.get(path);
      return response.data;
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error("Error fetching Alpaca position:", error.message);
      }
      return null;
    }
  }

  async closePosition(symbol: string, accountId?: string): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }
    try {
      const path = this._isBrokerApi() && accountId
        ? `/v1/trading/accounts/${accountId}/positions/${symbol}`
        : `/v2/positions/${symbol}`;
      await this.client.delete(path);
      return true;
    } catch (error: any) {
      console.error("Error closing Alpaca position:", error.message);
      return false;
    }
  }

  async cancelAllOrders(accountId?: string): Promise<number> {
    if (!this.isConfigured()) {
      return 0;
    }
    try {
      const path = this._isBrokerApi() && accountId
        ? `/v1/trading/accounts/${accountId}/orders`
        : "/v2/orders";
      const response = await this.client.delete(path);
      return Array.isArray(response.data) ? response.data.length : 0;
    } catch (error: any) {
      console.error("Error canceling all Alpaca orders:", error.message);
      return 0;
    }
  }

  async getPortfolioHistory(
    period: string = "1M",
    timeframe: string = "1D",
    accountId?: string,
  ): Promise<AlpacaPortfolioHistory | null> {
    if (!this.isConfigured()) {
      return null;
    }
    try {
      const path = this._isBrokerApi() && accountId
        ? `/v1/trading/accounts/${accountId}/account/portfolio/history`
        : "/v2/account/portfolio/history";
      const response = await this.client.get(path, {
        params: { period, timeframe, extended_hours: false },
      });
      return response.data;
    } catch (error: any) {
      console.error("Error fetching Alpaca portfolio history:", error.message);
      return null;
    }
  }

  async getMarketClock(): Promise<AlpacaMarketClock | null> {
    if (!this.isConfigured()) {
      return null;
    }
    try {
      // Market clock is at /v1/clock for broker API, /v2/clock for trading API
      const path = this._isBrokerApi() ? "/v1/clock" : "/v2/clock";
      const response = await this.client.get(path);
      return response.data;
    } catch (error: any) {
      console.error("Error fetching Alpaca market clock:", error.message);
      return null;
    }
  }

}

export const alpacaBrokerService = new AlpacaBrokerService();
