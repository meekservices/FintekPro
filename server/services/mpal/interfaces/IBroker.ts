/**
 * MPAL — Multi-Provider Abstraction Layer
 * IBroker.ts — Canonical broker interface contract
 *
 * Purpose  : Defines the single contract every broker adapter must satisfy.
 *            Consumers (investmentRouter, API routes) program to this interface;
 *            adding a new broker (Zerodha, Angel One, Groww, etc.) requires
 *            only a new file that implements IBroker — zero routing changes.
 *
 * Rule     : Never use `any` in the hot path. All shared shapes are typed here.
 */

// ─── Capability Enum ──────────────────────────────────────────────────────────

/**
 * Every broker declares which capabilities it supports.
 * The InvestmentRouter uses this to pick the right broker at runtime —
 * no hardcoded if-else per asset class.
 */
export type BrokerCapability =
  | 'EQUITY_IN'       // Indian equities (cash segment, NSE/BSE)
  | 'FNO'             // Indian futures & options (F&O segment)
  | 'EQUITY_US'       // US equities via LRS / Alpaca
  | 'CRYPTO'          // Crypto assets
  | 'MF'              // Mutual fund purchase / redemption / SIP
  | 'NFO'             // New Fund Offer subscription
  | 'FD'              // Fixed deposit
  | 'PMS'             // Portfolio management service
  | 'AIF'             // Alternative investment fund
  | 'BOND'            // Bond / NCD / G-Sec
  | 'NOTIONAL_ORDER'; // Fractional / notional (dollar/rupee-value) order

// ─── Shared domain types ──────────────────────────────────────────────────────

/** Risk level tied to SEBI's riskometer */
export type RiskLevel = 'low' | 'moderate' | 'moderately_high' | 'high' | 'very_high';

/** Normalised position returned by any broker's getPositions() */
export interface NormalizedPosition {
  /** FintekPro internal symbol (e.g. "RELIANCE.NS", "AAPL", "INF200K01RK2") */
  symbol: string;
  /** Exchange / ISIN / Scheme code at the provider */
  providerSymbol: string;
  assetClass: BrokerCapability;
  /** Full name of the holding */
  name: string;
  quantity: number;
  averageCost: number;
  currentPrice?: number;
  unrealizedPnl?: number;
  currency: 'INR' | 'USD';
  /** Raw broker response — for debugging; do NOT log in production */
  _raw?: unknown;
}

/** Typed order payload sent to placeOrder() */
export interface BrokerOrder {
  /** FintekPro internal user ID — used for account lookup */
  userId: string;
  /** Canonical FintekPro symbol */
  symbol: string;
  capability: BrokerCapability;
  side: 'buy' | 'sell';
  /** Quantity-based order (mutually exclusive with notional) */
  qty?: number;
  /** Notional amount-based order (mutually exclusive with qty) */
  notional?: number;
  currency?: 'INR' | 'USD';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  timeInForce?: 'day' | 'gtc' | 'ioc' | 'fok';
  limitPrice?: number;
  stopPrice?: number;
  /** Client-supplied idempotency key — safe to retry if network failure */
  idempotencyKey?: string;
  /** Additional broker-specific fields (e.g. exchange, product code) */
  meta?: Record<string, unknown>;
}

/** Typed order result returned by any broker */
export interface BrokerOrderResult {
  /** FintekPro order row ID (if persisted before calling broker) */
  internalOrderId?: string;
  /** The broker's own order ID */
  brokerOrderId: string;
  status: 'pending' | 'submitted' | 'partially_filled' | 'filled' | 'rejected' | 'cancelled' | 'queued';
  filledQty?: number;
  filledPrice?: number;
  errorCode?: string;
  errorMessage?: string;
  /** ISO timestamp from the broker */
  brokerTimestamp?: string;
  _raw?: unknown;
}

/** Health probe result for admin dashboards */
export interface BrokerHealthStatus {
  brokerId: string;
  configured: boolean;
  healthy: boolean;
  latencyMs?: number;
  message?: string;
  checkedAt: string; // ISO 8601
}

// ─── IBroker contract ─────────────────────────────────────────────────────────

/**
 * Every broker adapter MUST implement this interface.
 *
 * Design contract:
 *  - isConfigured()  → sync, reads env vars, never throws
 *  - healthCheck()   → async, pings the provider; returns status, never throws
 *  - All order methods → throw structured errors (BrokerError) on failure
 */
export interface IBroker {
  // ─── Identity ───────────────────────────────────────────────────────────────

  /** Unique string identifier, e.g. 'IIFL', 'ALPACA', 'IRIS' */
  readonly brokerId: string;

  /**
   * Asset classes this broker can execute orders for.
   * InvestmentRouter uses this for capability-based routing — no hardcoded map.
   */
  readonly capabilities: readonly BrokerCapability[];

  // ─── Config & Health ─────────────────────────────────────────────────────────

  /**
   * Returns true if all required env vars are present.
   * MUST be synchronous — never throws.
   * If false, the router skips this broker and either falls back or returns 503.
   */
  isConfigured(): boolean;

  /**
   * Pings the broker's health endpoint (or a lightweight read call).
   * Always resolves — never rejects. Failures are encoded in the result.
   *
   * @param timeoutMs  max time before marking unhealthy (default 3000)
   */
  healthCheck(timeoutMs?: number): Promise<BrokerHealthStatus>;

  // ─── Account Lifecycle ───────────────────────────────────────────────────────

  /**
   * Creates or links a brokerage account for the given FintekPro user.
   * Inputs  : user — must include at least `{ id, email, mobile }`
   * Outputs : provider-specific account reference
   * Edge cases: idempotent — safe to call multiple times for same user
   */
  createAccount(user: { id: string; email?: string; mobile?: string; [key: string]: unknown }): Promise<{ status: string; providerAccountId?: string; [key: string]: unknown }>;

  // ─── Market Data ─────────────────────────────────────────────────────────────

  /**
   * Returns normalised positions for the given provider account ID.
   * Returns [] (not throws) if account not found or no positions.
   */
  getPositions(accountId: string): Promise<NormalizedPosition[]>;

  // ─── Order Execution ─────────────────────────────────────────────────────────

  /**
   * Places a typed order.
   * Inputs  : order — see BrokerOrder
   * Outputs : BrokerOrderResult
   * Edge cases: If idempotencyKey is set and already used, return prior result.
   */
  placeOrder(order: BrokerOrder): Promise<BrokerOrderResult>;

  /**
   * Places a notional (rupee/dollar-value) order — used for fractional shares.
   * Not all brokers support this; unsupported brokers MUST throw BrokerCapabilityError.
   */
  placeNotionalOrder(
    userId: string,
    symbol: string,
    notional: number,
    side: 'buy' | 'sell',
    currency?: 'INR' | 'USD',
  ): Promise<BrokerOrderResult>;

  /**
   * Cancels an open order at the broker.
   * Inputs  : orderId — the broker's own order ID (brokerOrderId from placeOrder result)
   * Edge cases: Safe to call on already-cancelled orders (idempotent).
   */
  cancelOrder(orderId: string): Promise<void>;

  /**
   * Fetches live status of an order from the broker.
   * Use this to reconcile after webhook delivery failures.
   */
  getOrderStatus(orderId: string): Promise<BrokerOrderResult>;
}

// ─── Typed errors ─────────────────────────────────────────────────────────────

/**
 * Base error for all MPAL broker failures.
 * Follows FintekPro GCR: { error_code, message, retryable }
 */
export class BrokerError extends Error {
  constructor(
    public readonly brokerId: string,
    public readonly error_code: string,
    message: string,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'BrokerError';
  }
}

/** Thrown when the requested broker ID is not in the registry */
export class BrokerNotFoundError extends BrokerError {
  constructor(brokerId: string) {
    super(brokerId, 'BROKER_NOT_FOUND', `Broker '${brokerId}' is not registered in ProviderRegistry.`, false);
  }
}

/** Thrown when the broker is registered but env vars are missing */
export class BrokerNotConfiguredError extends BrokerError {
  constructor(brokerId: string) {
    super(brokerId, 'BROKER_NOT_CONFIGURED', `Broker '${brokerId}' is registered but not configured (missing env vars). Set the required credentials to enable it.`, false);
  }
}

/** Thrown when no configured+capable broker is available for a capability */
export class BrokerUnavailableError extends BrokerError {
  constructor(capability: BrokerCapability) {
    super('NONE', 'BROKER_UNAVAILABLE', `No configured broker supports capability '${capability}'.`, false);
  }
}

/** Thrown when a broker is asked to do something outside its capabilities */
export class BrokerCapabilityError extends BrokerError {
  constructor(brokerId: string, capability: BrokerCapability) {
    super(brokerId, 'BROKER_CAPABILITY_NOT_SUPPORTED', `Broker '${brokerId}' does not support capability '${capability}'.`, false);
  }
}
