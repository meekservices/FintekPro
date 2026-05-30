import axios, { AxiosInstance } from "axios";
import { v4 as uuidv4 } from "uuid";

const ALPACA_BROKER_SANDBOX_URL = "https://broker-api.sandbox.alpaca.markets";
const ALPACA_BROKER_LIVE_URL   = "https://broker-api.alpaca.markets";

/**
 * Resolve the Alpaca base URL from env vars.
 * Priority: ALPACA_BASE_URL (explicit) → ALPACA_ENV (sandbox|production) → sandbox default
 */
function resolveAlpacaBaseUrl(): string {
  if (process.env.ALPACA_BASE_URL) return process.env.ALPACA_BASE_URL;
  return process.env.ALPACA_ENV === "production"
    ? ALPACA_BROKER_LIVE_URL
    : ALPACA_BROKER_SANDBOX_URL;
}

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
  side: "buy" | "sell" | "sell_short" | "buy_to_cover";
  type: "market" | "limit" | "stop" | "stop_limit" | "trailing_stop";
  time_in_force: "day" | "gtc" | "ioc" | "fok" | "opg" | "cls";
  limit_price?: number;
  stop_price?: number;
  trail_price?: number;
  trail_percent?: number;
  extended_hours?: boolean;
  client_order_id?: string;
  account_id?: string;
  // Options
  order_class?: "simple" | "bracket" | "oco" | "oto";
  take_profit?: { limit_price: number };
  stop_loss?: { stop_price: number; limit_price?: number };
}

// ─── Funding Wallet ────────────────────────────────────────────────────────────
export interface AlpacaFundingWallet {
  id: string;
  account_id: string;
  status: string;
  currency: string;
  created_at: string;
}

export interface AlpacaFundingDetail {
  id: string;
  wallet_id: string;
  currency: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  routing_number?: string;
  swift_code?: string;
  bank_address?: string;
  reference?: string;
}

// ─── Recipient Bank ────────────────────────────────────────────────────────────
export interface AlpacaRecipientBank {
  id: string;
  account_id: string;
  name: string;
  status: string;
  country: string;
  currency: string;
  bank_name: string;
  bank_account_type: string;
  bank_account_number: string;
  bank_routing_number?: string;
  bank_swift_code?: string;
  bank_iban?: string;
  created_at: string;
}

// ─── Options ──────────────────────────────────────────────────────────────────
export interface AlpacaOptionContract {
  id: string;
  symbol: string;
  name: string;
  status: string;
  tradable: boolean;
  expiration_date: string;
  strike_price: string;
  type: "call" | "put";
  style: "american" | "european";
  underlying_symbol: string;
  underlying_asset_id: string;
  open_interest?: string;
  close_price?: string;
  open_price?: string;
}

// ─── Account Config ────────────────────────────────────────────────────────────
export interface AlpacaAccountConfig {
  dtbp_check: "both" | "entry" | "exit";
  trade_confirm_email: "all" | "none";
  suspend_trade: boolean;
  no_shorting: boolean;
  fractional_trading: boolean;
  max_margin_multiplier: string;
  pdt_check: "both" | "entry" | "exit" | "none";
  ptp_no_exception_entry: boolean;
  max_options_trading_level: number | null;
}

// ─── Rebalancing ───────────────────────────────────────────────────────────────
export interface AlpacaRebalancingPortfolio {
  id: string;
  name: string;
  description?: string;
  status: string;
  cooldown_days: number;
  market_conditions_look_back_days: number;
  weights: Array<{ symbol: string; percent: string; asset_id?: string }>;
  rebalance_conditions: Array<{ type: string; sub_type: string; percent?: string }>;
  created_at: string;
  updated_at: string;
}

export interface AlpacaRebalancingRun {
  id: string;
  portfolio_id: string;
  status: string;
  reason: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
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
    this.baseUrl = resolveAlpacaBaseUrl();
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



  configure(apiKey: string, secretKey: string, baseUrl?: string, env?: "sandbox" | "production"): void {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    if (env) process.env.ALPACA_ENV = env;
    this.baseUrl = baseUrl || resolveAlpacaBaseUrl();
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
    account_type: "trading";
    account_referrer?: string;
    risk_tolerance?: "conservative" | "moderate" | "significant_risk";
    investment_objective?: "growth_income" | "growth" | "capital_preservation" | "speculation" | "other";
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
      context?: Array<{ context_type: string; company_name?: string; company_street_address?: string[] }>;
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
    try {
      const response = await this.client.post("/v1/accounts", data);
      return response.data;
    } catch (error: any) {
      const alpacaMsg = error.response?.data?.message || error.response?.data?.code;
      throw new Error(alpacaMsg || error.message || "Alpaca account creation failed");
    }
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

  // ─── Real-time Payments (RTP) ─────────────────────────────────────────────

  async createRtpTransfer(accountId: string, data: {
    amount: string;
    direction: "INCOMING" | "OUTGOING";
    relationship_id: string;
  }): Promise<AlpacaTransfer> {
    const response = await this.client.post(`/v1/accounts/${accountId}/transfers`, {
      ...data,
      transfer_type: "rtp",
    });
    return response.data;
  }

  // ─── Bank Accounts (Unified) ─────────────────────────────────────────────

  async listBankAccounts(accountId: string): Promise<any[]> {
    try {
      const response = await this.client.get(`/v1/accounts/${accountId}/bank_accounts`);
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.error("Error listing bank accounts:", error.message);
      return [];
    }
  }

  async createWiredRelationship(accountId: string, data: {
    name: string;
    bank_name: string;
    bank_account_number: string;
    bank_routing_number?: string;
    bank_swift_code?: string;
    bank_address?: string;
    country: string;
    currency: string;
  }): Promise<any> {
    const response = await this.client.post(`/v1/accounts/${accountId}/recipient_banks`, {
      ...data,
      bank_account_type: "INTERNATIONAL"
    });
    return response.data;
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
    if (request.type === "trailing_stop") {
      if (request.trail_price) orderPayload.trail_price = request.trail_price.toString();
      else if (request.trail_percent) orderPayload.trail_percent = request.trail_percent.toString();
    }
    if (request.extended_hours) orderPayload.extended_hours = true;
    if (request.order_class && request.order_class !== "simple") {
      orderPayload.order_class = request.order_class;
      if (request.take_profit) orderPayload.take_profit = { limit_price: request.take_profit.limit_price.toString() };
      if (request.stop_loss) orderPayload.stop_loss = {
        stop_price: request.stop_loss.stop_price.toString(),
        ...(request.stop_loss.limit_price && { limit_price: request.stop_loss.limit_price.toString() }),
      };
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

  async getOrderByClientId(clientOrderId: string, accountId?: string): Promise<AlpacaOrder | null> {
    try {
      if (this._isBrokerApi() && accountId) {
        const response = await this.client.get(
          `/v1/trading/accounts/${accountId}/orders`,
          { params: { nested: true, client_order_id: clientOrderId } },
        );
        const orders = Array.isArray(response.data) ? response.data : [];
        return orders[0] ?? null;
      }
      const response = await this.client.get("/v2/orders:by_client_order_id", {
        params: { client_order_id: clientOrderId },
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status !== 404) console.error("Error fetching order by client ID:", error.message);
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

  /**
   * High-resolution portfolio history (e.g. for intraday charts)
   */
  async getPortfolioHistoryWithResolution(
    accountId: string,
    params: {
      period?: string;
      timeframe?: "1Min" | "5Min" | "15Min" | "1H" | "1D";
      date_start?: string;
      date_end?: string;
      extended_hours?: boolean;
    }
  ): Promise<AlpacaPortfolioHistory | null> {
    if (!this.isConfigured()) return null;
    try {
      const response = await this.client.get(`${this._tradingBase(accountId)}/account/portfolio/history`, { params });
      return response.data;
    } catch (error: any) {
      console.error("Error fetching high-res portfolio history:", error.message);
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

  // ─── Funding Wallets ─────────────────────────────────────────────────────────

  async createFundingWallet(accountId: string): Promise<AlpacaFundingWallet> {
    const response = await this.client.post(`/v1beta/accounts/${accountId}/funding_wallet`);
    return response.data;
  }

  async getFundingWallet(accountId: string): Promise<AlpacaFundingWallet | null> {
    try {
      const response = await this.client.get(`/v1beta/accounts/${accountId}/funding_wallet`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) return null;
      throw error;
    }
  }

  async getFundingWalletDetails(accountId: string, walletId: string): Promise<AlpacaFundingDetail[]> {
    try {
      const response = await this.client.get(`/v1beta/accounts/${accountId}/funding_wallet/${walletId}/details`);
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.error("Error fetching funding wallet details:", error.message);
      return [];
    }
  }

  async getFundingWalletTransfers(accountId: string, walletId: string): Promise<any[]> {
    try {
      const response = await this.client.get(`/v1beta/accounts/${accountId}/funding_wallet/${walletId}/transfers`);
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.error("Error fetching wallet transfers:", error.message);
      return [];
    }
  }

  /** Sandbox only — simulate a deposit to the funding wallet.
   *  THROWS in production to prevent accidentally hitting a non-existent endpoint.
   */
  async simulateFundingDeposit(accountId: string, walletId: string, amountUsd: number): Promise<any> {
    if (!this.isPaper) {
      throw new Error(
        "simulateFundingDeposit is only available in sandbox mode. " +
        "Set ALPACA_ENV=sandbox or ALPACA_BASE_URL to the sandbox URL."
      );
    }
    const response = await this.client.post(
      `/v1beta/accounts/${accountId}/funding_wallet/${walletId}/transfers/demo_deposit`,
      { amount: amountUsd.toString(), currency: "USD" },
    );
    return response.data;
  }

  // ─── Recipient Banks ─────────────────────────────────────────────────────────

  async listRecipientBanks(accountId: string): Promise<AlpacaRecipientBank[]> {
    try {
      const response = await this.client.get(`/v1beta/accounts/${accountId}/recipient_banks`);
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.error("Error listing recipient banks:", error.message);
      return [];
    }
  }

  async createRecipientBank(accountId: string, data: {
    name: string;
    bank_account_type: "CHECKING" | "SAVINGS" | "INTERNATIONAL";
    bank_account_number: string;
    bank_routing_number?: string;
    bank_name: string;
    bank_swift_code?: string;
    bank_iban?: string;
    country: string;
    currency: string;
    bank_address?: string;
    beneficiary_address?: string;
  }): Promise<AlpacaRecipientBank> {
    const response = await this.client.post(`/v1beta/accounts/${accountId}/recipient_banks`, data);
    return response.data;
  }

  async deleteRecipientBank(accountId: string, bankId: string): Promise<void> {
    await this.client.delete(`/v1beta/accounts/${accountId}/recipient_banks/${bankId}`);
  }

  async createWireWithdrawal(accountId: string, data: {
    amount: number;
    currency: string;
    recipient_bank_id: string;
    memo?: string;
  }): Promise<any> {
    const response = await this.client.post(`/v1beta/accounts/${accountId}/funding_wallet/withdrawals`, {
      amount: data.amount.toString(),
      currency: data.currency,
      recipient_bank_id: data.recipient_bank_id,
      memo: data.memo,
    });
    return response.data;
  }

  // ─── Options ─────────────────────────────────────────────────────────────────

  async listOptionContracts(params: {
    underlying_symbols: string;
    expiration_date?: string;
    expiration_date_gte?: string;
    expiration_date_lte?: string;
    type?: "call" | "put";
    strike_price_gte?: string;
    strike_price_lte?: string;
    limit?: number;
  }): Promise<AlpacaOptionContract[]> {
    try {
      const path = this._isBrokerApi() ? "/v1/options/contracts" : "/v2/options/contracts";
      const response = await this.client.get(path, { params });
      const data = response.data;
      return Array.isArray(data) ? data : (data?.option_contracts ?? []);
    } catch (error: any) {
      console.error("Error listing option contracts:", error.message);
      return [];
    }
  }

  async getOptionContract(symbolOrId: string): Promise<AlpacaOptionContract | null> {
    try {
      const path = this._isBrokerApi()
        ? `/v1/options/contracts/${symbolOrId}`
        : `/v2/options/contracts/${symbolOrId}`;
      const response = await this.client.get(path);
      return response.data;
    } catch (error: any) {
      if (error.response?.status !== 404) console.error("Error fetching option contract:", error.message);
      return null;
    }
  }

  async getOptionsPositions(accountId?: string): Promise<any[]> {
    try {
      const path = this._isBrokerApi() && accountId
        ? `/v1/trading/accounts/${accountId}/positions`
        : "/v2/positions";
      const response = await this.client.get(path, { params: { asset_class: "us_option" } });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.error("Error fetching options positions:", error.message);
      return [];
    }
  }

  // ─── Account Configuration ───────────────────────────────────────────────────

  async getAccountConfig(accountId?: string): Promise<AlpacaAccountConfig | null> {
    try {
      const path = this._isBrokerApi() && accountId
        ? `/v1/trading/accounts/${accountId}/account/configurations`
        : "/v2/account/configurations";
      const response = await this.client.get(path);
      return response.data;
    } catch (error: any) {
      console.error("Error fetching account config:", error.message);
      return null;
    }
  }

  async updateAccountConfig(updates: Partial<AlpacaAccountConfig>, accountId?: string): Promise<AlpacaAccountConfig> {
    const path = this._isBrokerApi() && accountId
      ? `/v1/trading/accounts/${accountId}/account/configurations`
      : "/v2/account/configurations";
    const response = await this.client.patch(path, updates);
    return response.data;
  }

  // ─── Batch Journals ───────────────────────────────────────────────────────────

  async createBatchJournals(journals: Array<{
    from_account: string;
    to_account: string;
    entry_type: "JNLC" | "JNLS";
    amount?: string;
    symbol?: string;
    qty?: string;
    description?: string;
  }>): Promise<{ success: any[]; failed: any[] }> {
    try {
      const response = await this.client.post("/v1/journals:batch", { journals });
      const results = Array.isArray(response.data) ? response.data : [];
      return {
        success: results.filter((r: any) => !r.error),
        failed: results.filter((r: any) => r.error),
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Batch journal failed");
    }
  }

  // ─── Alpaca Native Rebalancing ────────────────────────────────────────────────

  async listRebalancingPortfolios(): Promise<AlpacaRebalancingPortfolio[]> {
    try {
      const response = await this.client.get("/v1/rebalancing/portfolios");
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.error("Error listing rebalancing portfolios:", error.message);
      return [];
    }
  }

  async createRebalancingPortfolio(data: {
    name: string;
    description?: string;
    weights: Array<{ symbol: string; percent: string }>;
    rebalance_conditions: Array<{ type: "drift_band" | "calendar"; sub_type: string; percent?: string }>;
    cooldown_days?: number;
  }): Promise<AlpacaRebalancingPortfolio> {
    const response = await this.client.post("/v1/rebalancing/portfolios", data);
    return response.data;
  }

  async getRebalancingPortfolio(portfolioId: string): Promise<AlpacaRebalancingPortfolio | null> {
    try {
      const response = await this.client.get(`/v1/rebalancing/portfolios/${portfolioId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status !== 404) console.error("Error fetching portfolio:", error.message);
      return null;
    }
  }

  async updateRebalancingPortfolio(portfolioId: string, data: Partial<{
    name: string;
    description: string;
    weights: Array<{ symbol: string; percent: string }>;
    rebalance_conditions: Array<{ type: string; sub_type: string; percent?: string }>;
    cooldown_days: number;
  }>): Promise<AlpacaRebalancingPortfolio> {
    const response = await this.client.patch(`/v1/rebalancing/portfolios/${portfolioId}`, data);
    return response.data;
  }

  async listPortfolioSubscriptions(portfolioId: string): Promise<any[]> {
    try {
      const response = await this.client.get(`/v1/rebalancing/portfolios/${portfolioId}/subscriptions`);
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      return [];
    }
  }

  async subscribeAccountToPortfolio(portfolioId: string, accountId: string): Promise<any> {
    const response = await this.client.post(`/v1/rebalancing/portfolios/${portfolioId}/subscriptions`, {
      account_id: accountId,
    });
    return response.data;
  }

  async unsubscribeAccountFromPortfolio(portfolioId: string, subscriptionId: string): Promise<void> {
    await this.client.delete(`/v1/rebalancing/portfolios/${portfolioId}/subscriptions/${subscriptionId}`);
  }

  async createRebalancingRun(portfolioId: string, type: "full_rebalance" | "partial_rebalance" | "liquidation" = "full_rebalance"): Promise<AlpacaRebalancingRun> {
    const response = await this.client.post(`/v1/rebalancing/portfolios/${portfolioId}/runs`, { type });
    return response.data;
  }

  async listRebalancingRuns(portfolioId: string): Promise<AlpacaRebalancingRun[]> {
    try {
      const response = await this.client.get(`/v1/rebalancing/portfolios/${portfolioId}/runs`);
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      return [];
    }
  }

  // ─── Corporate Actions (new endpoint) ────────────────────────────────────────

  async getCorporateActionsNew(params?: {
    symbol?: string;
    types?: string;
    date_from?: string;
    date_to?: string;
    limit?: number;
  }): Promise<any[]> {
    try {
      const response = await this.client.get("/v1/corporate_actions/announcements", { params });
      const data = response.data;
      return Array.isArray(data) ? data : (data?.announcements ?? []);
    } catch (error: any) {
      console.error("Error fetching corporate actions:", error.message);
      return [];
    }
  }

  // ─── High-Yield Cash / Cash Interest Program ──────────────────────────────

  async getAprTiers(): Promise<any[]> {
    if (!this.isConfigured()) return [];
    try {
      const response = await this.client.get("/v1/cash_interest/apr_tiers");
      const data = response.data;
      return Array.isArray(data) ? data : (data?.apr_tiers ?? []);
    } catch (error: any) {
      console.error("[CashInterest] getAprTiers error:", error.message);
      return [];
    }
  }

  async enrollCashInterest(accountId: string, aprTierName: string): Promise<any> {
    const response = await this.client.patch(`/v1/accounts/${accountId}`, {
      cash_interest: { apr_tier_name: aprTierName },
    });
    return response.data;
  }

  async unenrollCashInterest(accountId: string): Promise<any> {
    const response = await this.client.patch(`/v1/accounts/${accountId}`, {
      cash_interest: { status: "TERMINATED" },
    });
    return response.data;
  }

  // ─── Fully Paid Securities Lending (FPSL) ───────────────────────────────────

  async getFpslStatus(accountId: string): Promise<any> {
    if (!this.isConfigured()) return null;
    try {
      const account = await this.getAccount(accountId);
      return (account as any)?.fpsl ?? null;
    } catch (error: any) {
      console.error("[FPSL] getFpslStatus error:", error.message);
      return null;
    }
  }

  async enrollFpsl(accountId: string, tierId: string): Promise<any> {
    const response = await this.client.patch(`/v1/accounts/${accountId}`, {
      fpsl: { us: { tier_id: tierId } },
    });
    return response.data;
  }

  async unenrollFpsl(accountId: string): Promise<any> {
    const response = await this.client.patch(`/v1/accounts/${accountId}`, {
      fpsl: { us: { status: "TERMINATED" } },
    });
    return response.data;
  }

  // ─── Corporate Action Elections ─────────────────────────────────────────────

  /**
   * Get a single corporate action announcement by ID.
   * GET /v1/corporate_actions/announcements/:id
   */
  async getCorporateActionAnnouncement(announcementId: string): Promise<any | null> {
    try {
      const response = await this.client.get(`/v1/corporate_actions/announcements/${announcementId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status !== 404) console.error("[CorpAction] getAnnouncement error:", error.message);
      return null;
    }
  }

  /**
   * Get corporate action announcements for a specific account (optional symbol filter).
   * GET /v1/accounts/:accountId/corporate_actions/announcements
   */
  async getAccountCorporateActions(accountId: string, params?: {
    symbol?: string;
    types?: string;
    date_from?: string;
    date_to?: string;
    limit?: number;
  }): Promise<any[]> {
    try {
      const response = await this.client.get(
        `/v1/accounts/${accountId}/corporate_actions/announcements`,
        { params }
      );
      const data = response.data;
      return Array.isArray(data) ? data : (data?.announcements ?? []);
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error("[CorpAction] getAccountCorporateActions error:", error.message);
      }
      return [];
    }
  }

  /**
   * Submit a voluntary corporate action election (e.g. cash vs stock choice for merger/tender).
   * POST /v1/accounts/:accountId/corporate_actions/announcements/:announcementId/elections
   * electionType: "cash" | "stock" | "mixed" | "none"
   */
  async submitCorporateActionElection(
    accountId: string,
    announcementId: string,
    electionType: "cash" | "stock" | "mixed" | "none",
    data?: Record<string, any>
  ): Promise<any> {
    const response = await this.client.post(
      `/v1/accounts/${accountId}/corporate_actions/announcements/${announcementId}/elections`,
      { election_type: electionType, ...data }
    );
    return response.data;
  }

  /**
   * Get all elections an account has submitted.
   * GET /v1/accounts/:accountId/corporate_actions/announcements/:announcementId/elections
   */
  async getCorporateActionElections(accountId: string, announcementId: string): Promise<any[]> {
    try {
      const response = await this.client.get(
        `/v1/accounts/${accountId}/corporate_actions/announcements/${announcementId}/elections`
      );
      const data = response.data;
      return Array.isArray(data) ? data : (data?.elections ?? []);
    } catch (error: any) {
      if (error.response?.status !== 404) console.error("[CorpAction] getElections error:", error.message);
      return [];
    }
  }

  // ─── Tax Lot Management ──────────────────────────────────────────────────────

  /**
   * Get tax lots for a specific position.
   * GET /v1beta1/trading/accounts/:accountId/positions/:symbol/tax_lots
   * Tax lots show individual purchase tranches: cost basis, acquisition date, unrealized P&L.
   * Used for India LTCG/STCG optimization (holding > 24 months = LTCG for US equity per FEMA rules).
   */
  async getPositionTaxLots(accountId: string, symbol: string): Promise<any[]> {
    try {
      const response = await this.client.get(
        `/v1beta1/trading/accounts/${accountId}/positions/${symbol.toUpperCase()}/tax_lots`
      );
      const data = response.data;
      return Array.isArray(data) ? data : (data?.tax_lots ?? []);
    } catch (error: any) {
      if (error.response?.status !== 404) console.error("[TaxLots] getPositionTaxLots error:", error.message);
      return [];
    }
  }

  /**
   * Get tax lots for all positions in an account.
   * GET /v1beta1/trading/accounts/:accountId/positions/tax_lots
   */
  async getAllPositionTaxLots(accountId: string): Promise<any[]> {
    try {
      const response = await this.client.get(
        `/v1beta1/trading/accounts/${accountId}/positions/tax_lots`
      );
      const data = response.data;
      return Array.isArray(data) ? data : (data?.tax_lots ?? []);
    } catch (error: any) {
      if (error.response?.status !== 404) console.error("[TaxLots] getAllPositionTaxLots error:", error.message);
      return [];
    }
  }

  // ─── Options Exercise ────────────────────────────────────────────────────────

  /**
   * Exercise one or more options contracts (early exercise or at expiry).
   * POST /v1beta1/trading/accounts/:accountId/options/exercises
   * Body: { type: "e" (exercise) or "a" (abandon), contracts: [{ symbol, qty }] }
   */
  async exerciseOptions(accountId: string, contracts: Array<{ symbol: string; qty: number }>, type: "e" | "a" = "e"): Promise<any> {
    const response = await this.client.post(
      `/v1beta1/trading/accounts/${accountId}/options/exercises`,
      { type, contracts }
    );
    return response.data;
  }



  /**
   * List options exercise requests for an account.
   * GET /v1beta1/trading/accounts/:accountId/options/exercises
   */
  async listOptionsExercises(accountId: string, params?: { symbol?: string; status?: string; limit?: number }): Promise<any[]> {
    try {
      const response = await this.client.get(
        `/v1beta1/trading/accounts/${accountId}/options/exercises`,
        { params }
      );
      const data = response.data;
      return Array.isArray(data) ? data : (data?.exercises ?? []);
    } catch (error: any) {
      if (error.response?.status !== 404) console.error("[Options] listExercises error:", error.message);
      return [];
    }
  }

  // ─── ACH Relationship Verification ──────────────────────────────────────────

  /**
   * Verify an ACH relationship via micro-deposit amounts.
   * POST /v1/accounts/:accountId/ach_relationships/:achRelationshipId/verify
   * Alpaca deposits two small amounts; user must confirm exact values.
   */
  async verifyAchRelationship(
    accountId: string,
    achRelationshipId: string,
    amount1: number,
    amount2: number
  ): Promise<any> {
    const response = await this.client.post(
      `/v1/accounts/${accountId}/ach_relationships/${achRelationshipId}/verify`,
      { amount1, amount2 }
    );
    return response.data;
  }

  // ─── Account Trading Restrictions ───────────────────────────────────────────

  /**
   * Get the current trading restrictions / account-level configurations.
   * GET /v1/accounts/:accountId/account_configurations
   */
  async getAccountRestrictions(accountId: string): Promise<any | null> {
    try {
      const response = await this.client.get(`/v1/accounts/${accountId}/account_configurations`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status !== 404) console.error("[Restrictions] getAccountRestrictions error:", error.message);
      return null;
    }
  }

  /**
   * Update trading restrictions on an account.
   * PATCH /v1/accounts/:accountId/account_configurations
   * Supports restricting/unrestricting trading, enabling/disabling margin, etc.
   */
  async updateAccountRestrictions(accountId: string, restrictions: {
    restrict_trading?: boolean;
    restrict_short_selling?: boolean;
    restrict_options_trading?: boolean;
    restrict_margin?: boolean;
    max_margin_multiplier?: number;
    suspend_trading?: boolean;
  }): Promise<any> {
    const response = await this.client.patch(
      `/v1/accounts/${accountId}/account_configurations`,
      restrictions
    );
    return response.data;
  }

  /**
   * Suspend all trading on an account (e.g. for compliance/AML breach).
   * Uses PATCH /v1/accounts/:accountId with status: "ACCOUNT_SUSPENDED"
   */
  async suspendAccount(accountId: string, reason: string): Promise<any> {
    const response = await this.client.patch(`/v1/accounts/${accountId}`, {
      status: "ACCOUNT_SUSPENDED",
      suspension_reason: reason,
    });
    return response.data;
  }

  /**
   * Reinstate a previously suspended account.
   * Uses PATCH /v1/accounts/:accountId with status: "ACTIVE"
   */
  async reinstateAccount(accountId: string): Promise<any> {
    const response = await this.client.patch(`/v1/accounts/${accountId}`, {
      status: "ACTIVE",
    });
    return response.data;
  }

  // ─── Order Replace ────────────────────────────────────────────────────────

  /**
   * Replace (modify) an open order for a broker account.
   * Supports changing qty, limit_price, stop_price, time_in_force, client_order_id.
   * PATCH /v1/trading/accounts/:accountId/orders/:orderId
   */
  async replaceOrder(accountId: string, orderId: string, updates: {
    qty?: string;
    limit_price?: string;
    stop_price?: string;
    trail?: string;
    time_in_force?: string;
    client_order_id?: string;
  }): Promise<any> {
    const response = await this.client.patch(
      `/v1/trading/accounts/${accountId}/orders/${orderId}`,
      updates,
    );
    return response.data;
  }

  /**
   * Get a single order for a broker account.
   * GET /v1/trading/accounts/:accountId/orders/:orderId
   */
  async getAccountOrder(accountId: string, orderId: string): Promise<any | null> {
    try {
      const response = await this.client.get(
        `/v1/trading/accounts/${accountId}/orders/${orderId}`,
      );
      return response.data;
    } catch (e: any) {
      if (e.response?.status === 404) return null;
      throw e;
    }
  }

  /**
   * Get a single open position for a broker account.
   * GET /v1/trading/accounts/:accountId/positions/:symbol
   */
  async getAccountPosition(accountId: string, symbol: string): Promise<any | null> {
    try {
      const response = await this.client.get(
        `/v1/trading/accounts/${accountId}/positions/${symbol}`,
      );
      return response.data;
    } catch (e: any) {
      if (e.response?.status === 404) return null;
      throw e;
    }
  }

  // ─── Trusted Contacts ─────────────────────────────────────────────────────

  /**
   * Get trusted contact for an account.
   * GET /v1/accounts/:accountId/trusted_contact
   */
  async getTrustedContact(accountId: string): Promise<any | null> {
    try {
      const response = await this.client.get(`/v1/accounts/${accountId}/trusted_contact`);
      return response.data;
    } catch (e: any) {
      if (e.response?.status === 404) return null;
      throw e;
    }
  }

  /**
   * Add or update trusted contact for an account.
   * POST /v1/accounts/:accountId/trusted_contact
   */
  async updateTrustedContact(accountId: string, data: {
    given_name: string;
    family_name: string;
    email_address?: string;
    phone_number?: string;
    street_address?: string[];
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  }): Promise<any> {
    const response = await this.client.post(`/v1/accounts/${accountId}/trusted_contact`, data);
    return response.data;
  }

  /**
   * Delete trusted contact for an account.
   * DELETE /v1/accounts/:accountId/trusted_contact
   */
  async deleteTrustedContact(accountId: string): Promise<void> {
    await this.client.delete(`/v1/accounts/${accountId}/trusted_contact`);
  }

  // ─── Reports Download ─────────────────────────────────────────────────────

  /**
   * Download the actual report file for a completed report.
   * GET /v1/reports/:reportId/download → returns signed URL or binary
   */
  async downloadReport(reportId: string): Promise<string | null> {
    try {
      const response = await this.client.get(`/v1/reports/${reportId}/download`);
      // Alpaca returns a signed S3 URL or redirect — capture URL from location header or body
      return response.data?.url || response.headers?.location || null;
    } catch (e: any) {
      if (e.response?.status === 404) return null;
      throw e;
    }
  }

  // ─── All Transfers (Admin) ────────────────────────────────────────────────

  /**
   * List transfers across ALL broker accounts (admin-level view).
   * GET /v1/transfers
   */
  async listAllTransfers(params?: {
    direction?: "INCOMING" | "OUTGOING";
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const response = await this.client.get("/v1/transfers", { params });
    return Array.isArray(response.data) ? response.data : response.data?.transfers ?? [];
  }

  // ─── Journal Reversal ─────────────────────────────────────────────────────

  /**
   * Cancel a PENDING journal entry.
   * DELETE /v1/journals/:journalId — only works while status is PENDING
   */
  async cancelJournalPending(journalId: string): Promise<void> {
    await this.client.delete(`/v1/journals/${journalId}`);
  }

  /**
   * Reverse a COMPLETED journal entry.
   * POST /v1/journals/:journalId/reversals — creates an offsetting journal
   * Returns the new reversal journal object.
   */
  async reverseJournal(journalId: string): Promise<AlpacaJournal> {
    const response = await this.client.post(`/v1/journals/${journalId}/reversals`);
    return response.data;
  }

  // ─── Rebalancing Portfolio Delete ─────────────────────────────────────────

  /**
   * Delete a rebalancing portfolio.
   * DELETE /v1/rebalancing/portfolios/:portfolioId
   */
  async deleteRebalancingPortfolio(portfolioId: string): Promise<void> {
    await this.client.delete(`/v1/rebalancing/portfolios/${portfolioId}`);
  }

  // ─── Cash Interest Status ─────────────────────────────────────────────────

  /**
   * Get current cash interest enrollment status and rate for an account.
   * GET /v1/accounts/:accountId/interest
   */
  async getCashInterestStatus(accountId: string): Promise<any | null> {
    try {
      const response = await this.client.get(`/v1/accounts/${accountId}/interest`);
      return response.data;
    } catch (e: any) {
      if (e.response?.status === 404) return null;
      throw e;
    }
  }

  /**
   * Get the primary Firm Account details (Equity, Cash, Commissions).
   * For FD BDs, this is the main account under the partner.
   */
  async getFirmAccount(): Promise<AlpacaAccount | null> {
    if (!this.isConfigured() || !this._isBrokerApi()) return null;
    try {
      // In Broker API, the first account in the list is typically the firm's main account
      // or we can fetch a specific account if the ID was known. 
      // Fetching max: 1 sorted by created_at asc usually gives the root account.
      const response = await this.client.get("/v1/accounts", { params: { max: 1, sort: "asc" } });
      return Array.isArray(response.data) ? response.data[0] : response.data;
    } catch (error: any) {
      console.error("[FirmAccount] getFirmAccount error:", error.message);
      return null;
    }
  }

  // ─── IP Allowlist (Security) ──────────────────────────────────────────────

  /**
   * List all IPs in the team's allowlist.
   * GET /v1/team/ip_allowlist
   */
  async getIpAllowlist(): Promise<string[]> {
    if (!this.isConfigured()) return [];
    try {
      const response = await this.client.get("/v1/team/ip_allowlist");
      // Alpaca returns { ips: ["1.2.3.4", ...] }
      return response.data?.ips || [];
    } catch (error: any) {
      // 403 usually means feature disabled (Sandbox)
      if (error.response?.status !== 403) console.error("[Security] getIpAllowlist error:", error.message);
      return [];
    }
  }

  /**
   * Add an IP to the allowlist.
   * POST /v1/team/ip_allowlist
   */
  async addIpToAllowlist(ip: string): Promise<void> {
    await this.client.post("/v1/team/ip_allowlist", { ips: [ip] });
  }

  /**
   * Remove an IP from the allowlist.
   * DELETE /v1/team/ip_allowlist
   */
  async removeIpFromAllowlist(ip: string): Promise<void> {
    await this.client.delete("/v1/team/ip_allowlist", { data: { ips: [ip] } });
  }

  // ─── Market Assets (Store / Product Discovery) ─────────────────────────────

  /**
   * Retrieve a list of assets available on Alpaca.
   *
   * Purpose: Used by the Store to surface US equity and ETF products.
   *
   * Inputs:
   *   - status       : 'active' | 'inactive' (default: 'active')
   *   - assetClass   : 'us_equity' | 'crypto' (default: 'us_equity')
   *   - exchange     : optional NYSE | NASDAQ | ARCA etc.
   *
   * Outputs: Array of AlpacaAsset objects (empty on failure/unconfigured).
   *
   * Edge cases: Returns [] when Alpaca is not configured or API is unreachable,
   *             so the store gracefully degrades to DB-only products.
   */
  async getAssets(params?: {
    status?: 'active' | 'inactive';
    assetClass?: 'us_equity' | 'crypto';
    exchange?: string;
  }): Promise<AlpacaAsset[]> {
    if (!this.isConfigured()) return [];
    try {
      const apiPath = this._isBrokerApi() ? '/v1/assets' : '/v2/assets';
      const queryParams: Record<string, string> = {
        status: params?.status ?? 'active',
      };
      if (params?.assetClass) queryParams['asset_class'] = params.assetClass;
      if (params?.exchange)   queryParams['exchange']    = params.exchange;
      const response = await this.client.get(apiPath, { params: queryParams });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.warn('[AlpacaBrokerService] getAssets failed (non-fatal):', error?.response?.data ?? error?.message);
      return [];
    }
  }
}

export const alpacaBrokerService = new AlpacaBrokerService();
