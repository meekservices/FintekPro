import axios, { AxiosInstance } from "axios";
import { v4 as uuidv4 } from "uuid";

const ALPACA_BROKER_SANDBOX_URL = "https://broker-api.sandbox.alpaca.markets";
const ALPACA_BROKER_LIVE_URL = "https://broker-api.alpaca.markets";

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface AlpacaOrder {
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
  legs?: AlpacaOrder[];
}

export interface AlpacaPosition {
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

export interface AlpacaAccount {
  id: string;
  account_number: string;
  status: string;
  currency?: string;
  cash?: string;
  portfolio_value?: string;
  buying_power?: string;
  equity?: string;
  long_market_value?: string;
  short_market_value?: string;
  unrealized_pl?: string;
  unrealized_plpc?: string;
  realized_pl?: string;
  daytrade_count?: number;
  daytrading_buying_power?: string;
  pattern_day_trader?: boolean;
  trading_blocked?: boolean;
  account_blocked?: boolean;
  created_at: string;
  // Broker-specific
  kyc_results?: any;
  identity?: any;
  contact?: any;
  disclosures?: any;
  agreements?: any;
  documents?: any;
  trusted_contact?: any;
  enabled_assets?: string[];
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

export interface AlpacaCipInfo {
  id: string;
  account_id: string;
  provider_name: string[];
  created_at: string;
  updated_at: string;
  kyc?: {
    id?: string;
    risk_level?: string;
    risk_score?: number;
    applicant_name?: string;
    email_address?: string;
    nationality?: string;
    date_of_birth?: string;
    age?: number;
    pep?: boolean;
    politically_exposed?: boolean;
    reasons?: string[];
    result?: string;
    status?: string;
  };
  document?: {
    id?: string;
    result?: string;
    status?: string;
    reason?: string;
  };
  photo?: {
    id?: string;
    result?: string;
    status?: string;
    reason?: string;
  };
  identity?: {
    id?: string;
    result?: string;
    status?: string;
    reason?: string;
  };
  watchlist?: {
    id?: string;
    result?: string;
    status?: string;
    provider_name?: string[];
  };
}

export interface AlpacaDocument {
  id: string;
  document_type: string;
  document_sub_type?: string;
  content?: string;
  mime_type?: string;
  created_at: string;
  date?: string;
}

export interface AlpacaAchRelationship {
  id: string;
  account_id: string;
  created_at: string;
  updated_at: string;
  status: string;
  account_owner_name: string;
  bank_account_type: string;
  bank_account_number: string;
  bank_routing_number: string;
  nickname?: string;
  processor_token?: string;
}

export interface AlpacaTransfer {
  id: string;
  relationship_id?: string;
  account_id: string;
  created_at: string;
  updated_at?: string;
  expires_at?: string;
  type: string;
  status: string;
  amount: string;
  direction: string;
  reason?: string;
  requested_amount?: string;
  fee?: string;
  fee_payment_method?: string;
}

export interface AlpacaJournal {
  id: string;
  to_account: string;
  entry_type: string;
  status: string;
  from_account?: string;
  symbol?: string;
  qty?: string;
  price?: string;
  net_amount?: string;
  currency?: string;
  settle_date?: string;
  system_date?: string;
  transmitter_ta?: string;
  transmitter_name?: string;
  description?: string;
  transmitter_account_number?: string;
  transmitter_address?: string;
  transmitter_financial_institution?: string;
  transmitter_timestamp?: string;
}

export interface AlpacaActivity {
  id: string;
  account_id: string;
  activity_type: string;
  date: string;
  net_amount?: string;
  symbol?: string;
  qty?: string;
  per_share_amount?: string;
  price?: string;
  side?: string;
  cum_qty?: string;
  leaves_qty?: string;
  avg_price?: string;
  order_id?: string;
  type?: string;
  description?: string;
}

export interface AlpacaAsset {
  id: string;
  class: string;
  exchange: string;
  symbol: string;
  name: string;
  status: string;
  tradable: boolean;
  marginable?: boolean;
  shortable?: boolean;
  easy_to_borrow?: boolean;
  fractionable?: boolean;
  min_order_size?: string;
  min_trade_increment?: string;
  price_increment?: string;
}

export interface AlpacaCorporateAction {
  id: string;
  corporate_action_type: string;
  ca_sub_type?: string;
  initiating_symbol: string;
  initiating_original_cusip?: string;
  target_symbol?: string;
  target_original_cusip?: string;
  declaration_date?: string;
  ex_date?: string;
  record_date?: string;
  payable_date?: string;
  cash: string;
  old_rate?: string;
  new_rate?: string;
}

export interface AlpacaReport {
  id: string;
  name: string;
  type: string;
  status: string;
  created_at: string;
  url?: string;
  date?: string;
  sub_type?: string;
}

export interface AlpacaWatchlist {
  id: string;
  account_id: string;
  created_at: string;
  updated_at: string;
  name: string;
  assets: AlpacaAsset[];
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
  account_id?: string;
}

// ─── Service ───────────────────────────────────────────────────────────────────

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
      const encoded = Buffer.from(`${this.apiKey}:${this.secretKey}`).toString("base64");
      headers["Authorization"] = `Basic ${encoded}`;
    } else {
      headers["APCA-API-KEY-ID"] = this.apiKey;
      headers["APCA-API-SECRET-KEY"] = this.secretKey;
    }
    return axios.create({ baseURL: this.baseUrl, timeout: 20000, headers });
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

  getBaseUrl(): string { return this.baseUrl; }
  isConfigured(): boolean { return !!(this.apiKey && this.secretKey); }
  isPaperTrading(): boolean { return this.isPaper; }
  isBrokerApi(): boolean { return this._isBrokerApi(); }

  // ─── Internal path helpers ─────────────────────────────────────────────────

  private _tradingBase(accountId: string): string {
    return `/v1/trading/accounts/${accountId}`;
  }

  // ─── Connection Test ───────────────────────────────────────────────────────

  async testConnection(): Promise<{ success: boolean; message: string; account?: AlpacaAccount }> {
    if (!this.isConfigured()) {
      return { success: false, message: "Alpaca API credentials not configured" };
    }
    try {
      const path = this._isBrokerApi() ? "/v1/accounts" : "/v2/account";
      const response = await this.client.get(path, { params: this._isBrokerApi() ? { max: 1 } : {} });
      const accountData = Array.isArray(response.data) ? response.data[0] : response.data;
      return {
        success: true,
        message: `Connected to Alpaca (${this._isBrokerApi() ? "Broker API" : "Trading API"} · ${this.isPaper ? "Sandbox" : "Live"})`,
        account: accountData,
      };
    } catch (error: any) {
      console.error("Alpaca connection test failed:", error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.code || error.message || "Failed to connect to Alpaca",
      };
    }
  }

  // ─── Account Management ───────────────────────────────────────────────────

  async listAccounts(params?: {
    query?: string;
    status?: string;
    created_after?: string;
    created_before?: string;
    sort?: "asc" | "desc";
    entities?: string;
    limit?: number;
  }): Promise<AlpacaAccount[]> {
    if (!this.isConfigured()) return [];
    try {
      const response = await this.client.get("/v1/accounts", { params });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.error("Error listing broker accounts:", error.response?.data || error.message);
      return [];
    }
  }

  async createBrokerAccount(data: {
    contact: {
      email_address: string;
      phone_number?: string;
      street_address: string[];
      city: string;
      state?: string;
      postal_code?: string;
      country: string;
    };
    identity: {
      given_name: string;
      family_name: string;
      middle_name?: string;
      date_of_birth: string;
      tax_id?: string;
      tax_id_type?: string;
      country_of_citizenship?: string;
      country_of_birth?: string;
      country_of_tax_residence: string;
      funding_source: string[];
      annual_income_min?: string;
      annual_income_max?: string;
      liquid_net_worth_min?: string;
      liquid_net_worth_max?: string;
      total_net_worth_min?: string;
      total_net_worth_max?: string;
    };
    disclosures: {
      is_control_person: boolean;
      is_affiliated_exchange_or_finra: boolean;
      is_politically_exposed: boolean;
      immediate_family_exposed: boolean;
      context?: any[];
    };
    agreements: Array<{
      agreement: string;
      signed_at: string;
      ip_address: string;
      revision?: string;
    }>;
    documents?: Array<{
      document_type: string;
      document_sub_type?: string;
      content: string;
      mime_type: string;
    }>;
    trusted_contact?: {
      given_name: string;
      family_name: string;
      email_address?: string;
    };
    enabled_assets?: string[];
  }): Promise<AlpacaAccount> {
    const response = await this.client.post("/v1/accounts", data);
    return response.data;
  }

  async getAccount(accountId?: string): Promise<AlpacaAccount | null> {
    if (!this.isConfigured()) return null;
    try {
      if (this._isBrokerApi() && accountId) {
        const response = await this.client.get(`/v1/accounts/${accountId}`);
        return response.data;
      } else if (this._isBrokerApi()) {
        const response = await this.client.get("/v1/accounts", { params: { max: 1 } });
        return Array.isArray(response.data) ? response.data[0] : response.data;
      } else {
        const response = await this.client.get("/v2/account");
        return response.data;
      }
    } catch (error: any) {
      console.error("Error fetching Alpaca account:", error.message);
      return null;
    }
  }

  async updateBrokerAccount(accountId: string, data: Partial<{
    contact: any;
    identity: any;
    disclosures: any;
    trusted_contact: any;
    trading_configurations: any;
    enabled_assets: string[];
  }>): Promise<AlpacaAccount> {
    const response = await this.client.patch(`/v1/accounts/${accountId}`, data);
    return response.data;
  }

  async closeBrokerAccount(accountId: string): Promise<void> {
    await this.client.delete(`/v1/accounts/${accountId}`);
  }

  // Alias for backward compat
  async listBrokerAccounts(): Promise<AlpacaAccount[]> {
    return this.listAccounts();
  }

  // ─── Trading Account Details (for a specific sub-account) ─────────────────

  async getTradingAccount(accountId: string): Promise<AlpacaAccount | null> {
    if (!this.isConfigured()) return null;
    try {
      const response = await this.client.get(`${this._tradingBase(accountId)}/account`);
      return response.data;
    } catch (error: any) {
      console.error("Error fetching trading account:", error.message);
      return null;
    }
  }

  // ─── CIP / KYC ────────────────────────────────────────────────────────────

  async submitCip(accountId: string, cipData: {
    provider_name: string[];
    kyc?: {
      id?: string;
      risk_level?: string;
      risk_score?: number;
      applicant_name?: string;
      email_address?: string;
      nationality?: string;
      date_of_birth?: string;
      pep?: boolean;
      politically_exposed?: boolean;
      result?: string;
      status?: string;
      created_at?: string;
    };
    document?: { id?: string; result?: string; status?: string; created_at?: string };
    photo?: { id?: string; result?: string; status?: string; created_at?: string };
    identity?: { id?: string; result?: string; status?: string; created_at?: string };
    watchlist?: { id?: string; result?: string; status?: string; provider_name?: string[] };
  }): Promise<AlpacaCipInfo> {
    const response = await this.client.post(`/v1/accounts/${accountId}/cip`, cipData);
    return response.data;
  }

  async getCip(accountId: string): Promise<AlpacaCipInfo | null> {
    try {
      const response = await this.client.get(`/v1/accounts/${accountId}/cip`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) return null;
      console.error("Error fetching CIP:", error.message);
      return null;
    }
  }

  // ─── Documents ────────────────────────────────────────────────────────────

  async listDocuments(accountId: string, params?: {
    documents_type?: string;
    start?: string;
    end?: string;
  }): Promise<AlpacaDocument[]> {
    try {
      const response = await this.client.get(`/v1/accounts/${accountId}/documents`, { params });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.error("Error listing documents:", error.message);
      return [];
    }
  }

  async uploadDocument(accountId: string, data: {
    document_type: string;
    document_sub_type?: string;
    content: string;
    mime_type: string;
  }): Promise<AlpacaDocument> {
    const response = await this.client.post(`/v1/accounts/${accountId}/documents/upload`, data);
    return response.data;
  }

  async downloadDocument(accountId: string, documentId: string): Promise<string | null> {
    try {
      const response = await this.client.get(`/v1/accounts/${accountId}/documents/${documentId}/download`);
      return response.data?.url || null;
    } catch (error: any) {
      console.error("Error downloading document:", error.message);
      return null;
    }
  }

  // ─── ACH Relationships ────────────────────────────────────────────────────

  async createAchRelationship(accountId: string, data: {
    account_owner_name: string;
    bank_account_type: "CHECKING" | "SAVINGS";
    bank_account_number: string;
    bank_routing_number: string;
    nickname?: string;
    processor_token?: string;
  }): Promise<AlpacaAchRelationship> {
    const response = await this.client.post(`/v1/accounts/${accountId}/ach_relationships`, data);
    return response.data;
  }

  async listAchRelationships(accountId: string, statuses?: string): Promise<AlpacaAchRelationship[]> {
    try {
      const response = await this.client.get(`/v1/accounts/${accountId}/ach_relationships`, {
        params: statuses ? { statuses } : {},
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.error("Error listing ACH relationships:", error.message);
      return [];
    }
  }

  async deleteAchRelationship(accountId: string, achRelationshipId: string): Promise<void> {
    await this.client.delete(`/v1/accounts/${accountId}/ach_relationships/${achRelationshipId}`);
  }

  // ─── Transfers / Funding ─────────────────────────────────────────────────

  async createTransfer(accountId: string, data: {
    transfer_type: "ach" | "wire";
    relationship_id?: string;
    bank_data?: any;
    amount: string;
    direction: "INCOMING" | "OUTGOING";
    timing?: "immediate";
    fee_payment_method?: string;
  }): Promise<AlpacaTransfer> {
    const response = await this.client.post(`/v1/accounts/${accountId}/transfers`, data);
    return response.data;
  }

  async listTransfers(accountId: string, params?: {
    direction?: string;
    limit?: number;
    offset?: number;
  }): Promise<AlpacaTransfer[]> {
    try {
      const response = await this.client.get(`/v1/accounts/${accountId}/transfers`, { params });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.error("Error listing transfers:", error.message);
      return [];
    }
  }

  async cancelTransfer(accountId: string, transferId: string): Promise<void> {
    await this.client.delete(`/v1/accounts/${accountId}/transfers/${transferId}`);
  }

  // ─── Journals ─────────────────────────────────────────────────────────────

  async createJournal(data: {
    from_account: string;
    to_account: string;
    entry_type: "JNLC" | "JNLS";
    amount?: string;
    symbol?: string;
    qty?: string;
    description?: string;
    transmitter_name?: string;
    transmitter_account_number?: string;
    transmitter_address?: string;
    transmitter_financial_institution?: string;
    transmitter_timestamp?: string;
  }): Promise<AlpacaJournal> {
    const response = await this.client.post("/v1/journals", data);
    return response.data;
  }

  async listJournals(params?: {
    after?: string;
    before?: string;
    status?: string;
    entry_type?: string;
    to_account?: string;
    from_account?: string;
  }): Promise<AlpacaJournal[]> {
    try {
      const response = await this.client.get("/v1/journals", { params });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.error("Error listing journals:", error.message);
      return [];
    }
  }

  async cancelJournal(journalId: string): Promise<void> {
    await this.client.delete(`/v1/journals/${journalId}`);
  }

  // ─── Activities ───────────────────────────────────────────────────────────

  async getAccountActivities(accountId: string, params?: {
    activity_type?: string;
    activity_types?: string;
    date?: string;
    until?: string;
    after?: string;
    direction?: string;
    pageSize?: number;
    pageToken?: string;
  }): Promise<AlpacaActivity[]> {
    try {
      const response = await this.client.get(`/v1/accounts/${accountId}/activities`, { params });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.error("Error fetching account activities:", error.message);
      return [];
    }
  }

  async getAllActivities(params?: {
    activity_type?: string;
    activity_types?: string;
    date?: string;
    until?: string;
    after?: string;
    direction?: string;
    account_id?: string;
    pageSize?: number;
    pageToken?: string;
  }): Promise<AlpacaActivity[]> {
    try {
      const response = await this.client.get("/v1/accounts/activities", { params });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.error("Error fetching all activities:", error.message);
      return [];
    }
  }

  // ─── Assets ───────────────────────────────────────────────────────────────

  async listAssets(params?: {
    status?: "active" | "inactive";
    asset_class?: "us_equity" | "crypto";
    exchange?: string;
    attributes?: string;
  }): Promise<AlpacaAsset[]> {
    try {
      const path = this._isBrokerApi() ? "/v1/assets" : "/v2/assets";
      const response = await this.client.get(path, { params });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.error("Error listing assets:", error.message);
      return [];
    }
  }

  async getAsset(symbolOrId: string): Promise<AlpacaAsset | null> {
    try {
      const path = this._isBrokerApi() ? `/v1/assets/${symbolOrId}` : `/v2/assets/${symbolOrId}`;
      const response = await this.client.get(path);
      return response.data;
    } catch (error: any) {
      if (error.response?.status !== 404) console.error("Error fetching asset:", error.message);
      return null;
    }
  }

  // ─── Corporate Actions ────────────────────────────────────────────────────

  async getCorporateActions(params?: {
    ca_types?: string;
    since?: string;
    until?: string;
    symbol?: string;
    cusip?: string;
    date_type?: string;
  }): Promise<AlpacaCorporateAction[]> {
    try {
      const response = await this.client.get("/v1/corporate_actions/announcements", { params });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.error("Error fetching corporate actions:", error.message);
      return [];
    }
  }

  // ─── Reports ──────────────────────────────────────────────────────────────

  async createReport(data: {
    type: "account_statement" | "trade_confirmation" | "tax_1099";
    sub_type?: string;
    start: string;
    end: string;
    account_ids?: string[];
    date?: string;
  }): Promise<AlpacaReport> {
    const response = await this.client.post("/v1/reports", data);
    return response.data;
  }

  async listReports(params?: {
    report_type?: string;
    date?: string;
    start?: string;
    end?: string;
  }): Promise<AlpacaReport[]> {
    try {
      const response = await this.client.get("/v1/reports", { params });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.error("Error listing reports:", error.message);
      return [];
    }
  }

  async getReport(reportId: string): Promise<AlpacaReport | null> {
    try {
      const response = await this.client.get(`/v1/reports/${reportId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status !== 404) console.error("Error fetching report:", error.message);
      return null;
    }
  }

  // ─── Watchlists ───────────────────────────────────────────────────────────

  async listWatchlists(accountId: string): Promise<AlpacaWatchlist[]> {
    try {
      const response = await this.client.get(`${this._tradingBase(accountId)}/watchlists`);
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.error("Error listing watchlists:", error.message);
      return [];
    }
  }

  async createWatchlist(accountId: string, name: string, symbols: string[]): Promise<AlpacaWatchlist> {
    const response = await this.client.post(`${this._tradingBase(accountId)}/watchlists`, { name, symbols });
    return response.data;
  }

  async getWatchlist(accountId: string, watchlistId: string): Promise<AlpacaWatchlist | null> {
    try {
      const response = await this.client.get(`${this._tradingBase(accountId)}/watchlists/${watchlistId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status !== 404) console.error("Error fetching watchlist:", error.message);
      return null;
    }
  }

  async updateWatchlist(accountId: string, watchlistId: string, data: { name?: string; symbols?: string[] }): Promise<AlpacaWatchlist> {
    const response = await this.client.put(`${this._tradingBase(accountId)}/watchlists/${watchlistId}`, data);
    return response.data;
  }

  async addToWatchlist(accountId: string, watchlistId: string, symbol: string): Promise<AlpacaWatchlist> {
    const response = await this.client.post(`${this._tradingBase(accountId)}/watchlists/${watchlistId}`, { symbol });
    return response.data;
  }

  async removeFromWatchlist(accountId: string, watchlistId: string, symbol: string): Promise<void> {
    await this.client.delete(`${this._tradingBase(accountId)}/watchlists/${watchlistId}/${symbol}`);
  }

  async deleteWatchlist(accountId: string, watchlistId: string): Promise<void> {
    await this.client.delete(`${this._tradingBase(accountId)}/watchlists/${watchlistId}`);
  }

  // ─── Trading: Orders ──────────────────────────────────────────────────────

  async placeOrder(request: OrderRequest): Promise<AlpacaOrder> {
    if (!this.isConfigured()) {
      throw new Error("Alpaca API not configured.");
    }
    const clientOrderId = request.client_order_id || uuidv4();
    const orderPayload: any = {
      symbol: request.symbol,
      side: request.side,
      type: request.type,
      time_in_force: request.time_in_force,
      client_order_id: clientOrderId,
    };
    if (request.qty) orderPayload.qty = request.qty.toString();
    else if (request.notional) orderPayload.notional = request.notional.toString();
    if (request.type === "limit" || request.type === "stop_limit") {
      orderPayload.limit_price = request.limit_price?.toString();
    }
    if (request.type === "stop" || request.type === "stop_limit") {
      orderPayload.stop_price = request.stop_price?.toString();
    }
    const path = this._isBrokerApi() && request.account_id
      ? `/v1/trading/accounts/${request.account_id}/orders`
      : "/v2/orders";
    try {
      const response = await this.client.post(path, orderPayload);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Failed to place order");
    }
  }

  async getOrder(orderId: string, accountId?: string): Promise<AlpacaOrder | null> {
    try {
      const path = this._isBrokerApi() && accountId
        ? `/v1/trading/accounts/${accountId}/orders/${orderId}`
        : `/v2/orders/${orderId}`;
      const response = await this.client.get(path);
      return response.data;
    } catch (error: any) {
      if (error.response?.status !== 404) console.error("Error fetching order:", error.message);
      return null;
    }
  }

  async getOrderByClientId(clientOrderId: string): Promise<AlpacaOrder | null> {
    try {
      const response = await this.client.get("/v2/orders:by_client_order_id", {
        params: { client_order_id: clientOrderId },
      });
      return response.data;
    } catch (error: any) {
      console.error("Error fetching order by client ID:", error.message);
      return null;
    }
  }

  async getOrders(status?: string, limit = 50, accountId?: string): Promise<AlpacaOrder[]> {
    if (!this.isConfigured()) return [];
    try {
      const path = this._isBrokerApi() && accountId
        ? `/v1/trading/accounts/${accountId}/orders`
        : "/v2/orders";
      const response = await this.client.get(path, { params: { status, limit } });
      return response.data;
    } catch (error: any) {
      console.error("Error fetching orders:", error.message);
      return [];
    }
  }

  async cancelOrder(orderId: string, accountId?: string): Promise<boolean> {
    if (!this.isConfigured()) return true;
    try {
      const path = this._isBrokerApi() && accountId
        ? `/v1/trading/accounts/${accountId}/orders/${orderId}`
        : `/v2/orders/${orderId}`;
      await this.client.delete(path);
      return true;
    } catch (error: any) {
      console.error("Error canceling order:", error.message);
      return false;
    }
  }

  async cancelAllOrders(accountId?: string): Promise<number> {
    if (!this.isConfigured()) return 0;
    try {
      const path = this._isBrokerApi() && accountId
        ? `/v1/trading/accounts/${accountId}/orders`
        : "/v2/orders";
      const response = await this.client.delete(path);
      return Array.isArray(response.data) ? response.data.length : 0;
    } catch (error: any) {
      console.error("Error canceling all orders:", error.message);
      return 0;
    }
  }

  // ─── Trading: Positions ───────────────────────────────────────────────────

  async getPositions(accountId?: string): Promise<AlpacaPosition[]> {
    if (!this.isConfigured()) {
      throw new Error("Alpaca API not configured.");
    }
    try {
      const path = this._isBrokerApi() && accountId
        ? `/v1/trading/accounts/${accountId}/positions`
        : "/v2/positions";
      const response = await this.client.get(path);
      return response.data;
    } catch (error: any) {
      throw new Error(`Alpaca positions fetch failed: ${error.message}`);
    }
  }

  async getPosition(symbol: string, accountId?: string): Promise<AlpacaPosition | null> {
    try {
      const path = this._isBrokerApi() && accountId
        ? `/v1/trading/accounts/${accountId}/positions/${symbol}`
        : `/v2/positions/${symbol}`;
      const response = await this.client.get(path);
      return response.data;
    } catch (error: any) {
      if (error.response?.status !== 404) console.error("Error fetching position:", error.message);
      return null;
    }
  }

  async closePosition(symbol: string, accountId?: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const path = this._isBrokerApi() && accountId
        ? `/v1/trading/accounts/${accountId}/positions/${symbol}`
        : `/v2/positions/${symbol}`;
      await this.client.delete(path);
      return true;
    } catch (error: any) {
      console.error("Error closing position:", error.message);
      return false;
    }
  }

  async closeAllPositions(accountId?: string, cancelOrders = true): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const path = this._isBrokerApi() && accountId
        ? `/v1/trading/accounts/${accountId}/positions`
        : "/v2/positions";
      await this.client.delete(path, { params: { cancel_orders: cancelOrders } });
      return true;
    } catch (error: any) {
      console.error("Error closing all positions:", error.message);
      return false;
    }
  }

  // ─── Portfolio History ─────────────────────────────────────────────────────

  async getPortfolioHistory(
    period: string = "1M",
    timeframe: string = "1D",
    accountId?: string,
  ): Promise<AlpacaPortfolioHistory | null> {
    if (!this.isConfigured()) return null;
    try {
      const path = this._isBrokerApi() && accountId
        ? `/v1/trading/accounts/${accountId}/account/portfolio/history`
        : "/v2/account/portfolio/history";
      const response = await this.client.get(path, { params: { period, timeframe, extended_hours: false } });
      return response.data;
    } catch (error: any) {
      console.error("Error fetching portfolio history:", error.message);
      return null;
    }
  }

  // ─── Market Clock & Calendar ───────────────────────────────────────────────

  async getMarketClock(): Promise<AlpacaMarketClock | null> {
    if (!this.isConfigured()) return null;
    try {
      const path = this._isBrokerApi() ? "/v1/clock" : "/v2/clock";
      const response = await this.client.get(path);
      return response.data;
    } catch (error: any) {
      console.error("Error fetching market clock:", error.message);
      return null;
    }
  }

  async getMarketCalendar(params?: { start?: string; end?: string }): Promise<any[]> {
    try {
      const path = this._isBrokerApi() ? "/v1/calendar" : "/v2/calendar";
      const response = await this.client.get(path, { params });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.error("Error fetching market calendar:", error.message);
      return [];
    }
  }
}

export const alpacaBrokerService = new AlpacaBrokerService();
