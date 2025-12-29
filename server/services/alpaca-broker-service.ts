import axios, { AxiosInstance } from "axios";
import { v4 as uuidv4 } from "uuid";

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
    this.baseUrl = process.env.ALPACA_BASE_URL || ALPACA_PAPER_URL;
    this.isPaper = this.baseUrl.includes("paper");

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        "APCA-API-KEY-ID": this.apiKey,
        "APCA-API-SECRET-KEY": this.secretKey,
        "Content-Type": "application/json",
      },
    });
  }

  isConfigured(): boolean {
    return !!(this.apiKey && this.secretKey);
  }

  isPaperTrading(): boolean {
    return this.isPaper;
  }

  async testConnection(): Promise<{ success: boolean; message: string; account?: AlpacaAccount }> {
    if (!this.isConfigured()) {
      return { success: false, message: "Alpaca API credentials not configured" };
    }

    try {
      const response = await this.client.get("/v2/account");
      return { 
        success: true, 
        message: `Connected to Alpaca (${this.isPaper ? "Paper" : "Live"})`,
        account: response.data,
      };
    } catch (error: any) {
      console.error("Alpaca connection test failed:", error.response?.data || error.message);
      return { 
        success: false, 
        message: error.response?.data?.message || "Failed to connect to Alpaca",
      };
    }
  }

  async getAccount(): Promise<AlpacaAccount | null> {
    if (!this.isConfigured()) {
      return this.getMockAccount();
    }

    try {
      const response = await this.client.get("/v2/account");
      return response.data;
    } catch (error: any) {
      console.error("Error fetching Alpaca account:", error.message);
      return this.getMockAccount();
    }
  }

  async placeOrder(request: OrderRequest): Promise<AlpacaOrder | null> {
    const clientOrderId = request.client_order_id || uuidv4();

    if (!this.isConfigured()) {
      console.log("Alpaca not configured - returning mock order");
      return this.getMockOrder(request, clientOrderId);
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

  async getOrders(status?: string, limit = 50): Promise<AlpacaOrder[]> {
    if (!this.isConfigured()) {
      return [];
    }

    try {
      const response = await this.client.get("/v2/orders", {
        params: { status, limit },
      });
      return response.data;
    } catch (error: any) {
      console.error("Error fetching Alpaca orders:", error.message);
      return [];
    }
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    if (!this.isConfigured()) {
      return true;
    }

    try {
      await this.client.delete(`/v2/orders/${orderId}`);
      return true;
    } catch (error: any) {
      console.error("Error canceling Alpaca order:", error.message);
      return false;
    }
  }

  async getPositions(): Promise<AlpacaPosition[]> {
    if (!this.isConfigured()) {
      return this.getMockPositions();
    }

    try {
      const response = await this.client.get("/v2/positions");
      return response.data;
    } catch (error: any) {
      console.error("Error fetching Alpaca positions:", error.message);
      return this.getMockPositions();
    }
  }

  async getPosition(symbol: string): Promise<AlpacaPosition | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const response = await this.client.get(`/v2/positions/${symbol}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error("Error fetching Alpaca position:", error.message);
      }
      return null;
    }
  }

  private getMockAccount(): AlpacaAccount {
    return {
      id: "mock-account-id",
      account_number: "MOCK123456",
      status: "ACTIVE",
      cash: "10000.00",
      portfolio_value: "10000.00",
      buying_power: "10000.00",
      equity: "10000.00",
      currency: "USD",
    };
  }

  private getMockOrder(request: OrderRequest, clientOrderId: string): AlpacaOrder {
    const mockPrice = this.getMockPrice(request.symbol);
    return {
      id: `mock-${uuidv4()}`,
      client_order_id: clientOrderId,
      status: "filled",
      symbol: request.symbol,
      qty: request.qty?.toString(),
      notional: request.notional?.toString(),
      filled_qty: request.qty?.toString() || "1",
      filled_avg_price: mockPrice.toString(),
      order_type: request.type,
      side: request.side,
      time_in_force: request.time_in_force,
      created_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
      filled_at: new Date().toISOString(),
    };
  }

  private getMockPositions(): AlpacaPosition[] {
    return [
      {
        asset_id: "mock-spy",
        symbol: "SPY",
        qty: "10",
        avg_entry_price: "590.00",
        market_value: "5950.00",
        current_price: "595.00",
        unrealized_pl: "50.00",
        unrealized_plpc: "0.0085",
        side: "long",
      },
      {
        asset_id: "mock-qqq",
        symbol: "QQQ",
        qty: "5",
        avg_entry_price: "515.00",
        market_value: "2600.00",
        current_price: "520.00",
        unrealized_pl: "25.00",
        unrealized_plpc: "0.0097",
        side: "long",
      },
    ];
  }

  private getMockPrice(symbol: string): number {
    const prices: Record<string, number> = {
      SPY: 595.50,
      QQQ: 520.25,
      VOO: 548.75,
      AAPL: 195.50,
      MSFT: 425.30,
    };
    return prices[symbol] || 100;
  }
}

export const alpacaBrokerService = new AlpacaBrokerService();
