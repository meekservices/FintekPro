/**
 * @file smallcase-gateway.d.ts
 * @description TypeScript ambient type declarations for the Smallcase Gateway SDK.
 *
 * The SDK is loaded via CDN (<script src="…/scdk.min.js">) and attaches itself
 * to window.scDK. There is no npm package — these declarations provide full
 * type-safety when consuming the CDN-loaded SDK from React/TypeScript code.
 *
 * Reference: https://developers.gateway.smallcase.com/
 * SDK Version: 2.0.0 (pinned in client/index.html)
 */

// ── Enums & Constants ──────────────────────────────────────────────────────────

/** Supported Smallcase Gateway environments */
export type SmallcaseEnvironment = "production" | "development";

/** Transaction intents supported by the Gateway */
export type SmallcaseIntent =
  | "LOGIN"         // Broker authentication only
  | "TRANSACTION"   // Basket order placement
  | "CONNECT";      // Account linking

/** Status codes returned in a completed transaction response */
export type SmallcaseTransactionStatus =
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "SMALLCASE_AUTH_REQUIRED";

// ── Init Options ───────────────────────────────────────────────────────────────

export interface SmallcaseInitOptions {
  /** Gateway name provided by Smallcase — maps to your SMALLCASE_GATEWAY_NAME env var */
  gatewayName: string;
  /**
   * Auth token (JWT) generated on the server using SMALLCASE_SECRET.
   * Guest token: generate with no user claim.
   * Connected token: generate with user's smallcaseAuthId claim.
   */
  authToken: string;
  /** Defaults to "production". Use "development" for sc-sandbox testing. */
  environment?: SmallcaseEnvironment;
  /** SDK behaviour config */
  config?: {
    amo?: boolean;        // After-market orders
    showLogo?: boolean;   // Show broker logo in chooser
  };
}

// ── Transaction Trigger ────────────────────────────────────────────────────────

export interface SmallcaseTriggerOptions {
  /** transactionId obtained from your server's /api/smallcase/transaction/create */
  transactionId: string;
}

// ── Response Shapes ────────────────────────────────────────────────────────────

export interface SmallcaseOrderDetail {
  broker: string;
  orderId: string;
  orderType: string;
  quantity: number;
  price: number;
  tradingsymbol: string;
  isin: string;
  status: "COMPLETE" | "REJECTED" | "PENDING";
}

export interface SmallcaseTransactionResponse {
  /** Status of the overall transaction */
  transactionStatus: SmallcaseTransactionStatus;
  /**
   * Signed JWT containing broker identity.
   * Decode to extract smallcaseAuthId — store in DB for future sessions.
   */
  smallcaseAuthToken?: string;
  /** Resolved broker account identifier (decoded from smallcaseAuthToken) */
  smallcaseAuthId?: string;
  /** Individual order details for each basket leg */
  orderDetails?: SmallcaseOrderDetail[];
  /** Error message if status is FAILED */
  error?: string;
}

export interface SmallcaseInitResponse {
  /** User's broker display name, if already connected */
  brokerName?: string;
  /** Indicates an existing linked broker session */
  isConnected: boolean;
}

// ── Error Shape ────────────────────────────────────────────────────────────────

export interface SmallcaseError {
  message: string;
  code?: string;
  /** true = transient (retry safe), false = requires user action */
  retryable?: boolean;
}

// ── Window Extension ───────────────────────────────────────────────────────────

export interface SmallcaseGatewaySDK {
  /**
   * Initialise the SDK. Must be called before triggerTransaction.
   *
   * @param options - Gateway name, authToken, environment
   * @returns Promise resolving to broker connection status
   */
  init(options: SmallcaseInitOptions): Promise<SmallcaseInitResponse>;

  /**
   * Open the Gateway UI to execute a pre-created transaction.
   * Handles broker chooser, login, and order confirmation natively.
   *
   * @param options - transactionId from your server
   * @returns Promise resolving to order result and smallcaseAuthToken
   */
  triggerTransaction(
    options: SmallcaseTriggerOptions,
  ): Promise<SmallcaseTransactionResponse>;
}

declare global {
  interface Window {
    /**
     * Smallcase Gateway SDK — injected by CDN script in index.html.
     * Check window.scDK !== undefined before calling.
     * The useSmallcaseGateway hook handles this polling automatically.
     */
    scDK: SmallcaseGatewaySDK | undefined;
  }
}
