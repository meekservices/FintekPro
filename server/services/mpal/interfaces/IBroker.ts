export type AssetClass = "EQUITY_US" | "EQUITY_IN" | "MF" | "PMS" | "AIF" | "FD";

export interface Instrument {
  id: string;
  symbol: string;
  assetClass: AssetClass;
  exchange: string;
  currency: "USD" | "INR";
}

export interface IBroker {
  /**
   * Identifies the broker implementation
   */
  readonly brokerId: string;

  /**
   * Initializes or links a user account with the broker
   */
  createAccount(user: any): Promise<any>;

  /**
   * Fetches the unified normalized positions for an account
   */
  getPositions(accountId: string): Promise<any[]>;

  /**
   * Submits a normalized order payload to the broker
   */
  placeOrder(order: any): Promise<any>;

  /**
   * Submits a notional (dollar/rupee based) order
   */
  placeNotionalOrder(userId: string, symbol: string, notional: number, side: 'buy' | 'sell'): Promise<any>;
}
