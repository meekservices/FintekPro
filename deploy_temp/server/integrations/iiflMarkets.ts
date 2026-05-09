import axios, { AxiosInstance, AxiosError } from 'axios';
import crypto from 'crypto';

// IIFL Markets API Integration (api.iiflcapital.com/v1)
// Based on IIFL Markets API Documentation v1

// Type definitions
export type IIFLExchange = 
  | 'NSEEQ' | 'NSEFO' | 'NSECURR' | 'NSECOMM'
  | 'BSEEQ' | 'BSEFO' | 'BSECURR' | 'BSECOMM'
  | 'MCXCOMM' | 'NCDEXCOMM';

export type IIFLTransactionType = 'BUY' | 'SELL';
export type IIFLOrderComplexity = 'REGULAR' | 'AMO' | 'BO' | 'CO';
export type IIFLProduct = 'NORMAL' | 'INTRADAY' | 'DELIVERY' | 'BNPL';
export type IIFLOrderType = 'LIMIT' | 'MARKET' | 'SL' | 'SLM';
export type IIFLValidity = 'DAY' | 'IOC';
export type IIFLInterval = '1 minute' | '5 minutes' | '10 minutes' | '15 minutes' | '30 minutes' | '60 minutes' | '1 day';

export interface IIFLConfig {
  appKey: string;
  appSecret: string;
  baseUrl?: string;
  bridgeHost?: string;
  bridgePort?: number;
}

export interface IIFLUserProfile {
  clientId: string;
  clientName: string;
  isTotpEnabled: string;
  isPoaProvided: string;
  accountStatus: string;
  exchanges: string[];
  products: string[];
  orderComplexity: string[];
  email: string;
  phoneNumber: string;
}

export interface IIFLLimits {
  tradingLimit: number;
  openingCashLimit: number;
  intradayPayin: number;
  collateralMargin: number;
  creditForSell: number;
  adhocMargin: number;
  utilizedMargin: number;
  blockedForPayout: number;
  utilizedSpanMargin: number;
  utilizedExposureMargin: number;
}

export interface IIFLOrderRequest {
  instrumentId: string;
  exchange: IIFLExchange;
  transactionType: IIFLTransactionType;
  quantity: number;
  orderComplexity: IIFLOrderComplexity;
  product: IIFLProduct;
  orderType: IIFLOrderType;
  validity?: IIFLValidity;
  price?: number;
  slTriggerPrice?: number;
  slLegPrice?: number;
  targetLegPrice?: number;
  disclosedQuantity?: number;
  marketProtectionPercent?: number;
  apiOrderSource?: string;
  algoId?: string;
  orderTag?: string;
}

export interface IIFLOrderResult {
  status: string;
  message: string;
  brokerOrderId?: string;
  requestTime?: string;
}

export interface IIFLOrderBookEntry {
  clientId: string;
  placedBy: string;
  brokerOrderId: string;
  exchangeOrderId: string;
  orderStatus: string;
  formattedInstrumentName: string;
  tradingSymbol: string;
  instrumentId: string;
  exchange: string;
  transactionType: string;
  quantity: number;
  product: string;
  orderComplexity: string;
  orderType: string;
  price: number;
  averageTradedPrice: number;
  slTriggerPrice: number;
  validity: string;
  disclosedQuantity: number;
  marketProtectionPercent: number;
  exchangeTimestamp: string;
  exchangeUpdateTime: string;
  rejectionReason: string;
  mainLegOrderId: string;
  pendingQuantity: number;
  filledQuantity: number;
  appKey: string;
  apiOrderSource: string;
  algoId: string;
  source: string;
  orderTag: string;
  brokerUpdateTime: string;
}

export interface IIFLTradeBookEntry {
  clientId: string;
  placedBy: string;
  brokerOrderId: string;
  exchangeOrderId: string;
  exchangeTradeId: string;
  formattedInstrumentName: string;
  tradingSymbol: string;
  instrumentId: string;
  exchange: string;
  transactionType: string;
  product: string;
  orderComplexity: string;
  orderType: string;
  validity: string;
  tradedPrice: number;
  filledQuantity: number;
  fillTimestamp: string;
  algoId: string;
  orderTag: string;
}

export interface IIFLHolding {
  isin: string;
  nseInstrumentId: string;
  bseInstrumentId: string;
  nseTradingSymbol: string;
  bseTradingSymbol: string;
  formattedInstrumentName: string;
  product: string;
  totalQuantity: number;
  dpQuantity: number;
  collateralQuantity: number;
  t1Quantity: number;
  authorizedQuantity: string;
  averageTradedPrice: string;
  previousDayClose: string | null;
}

export interface IIFLPosition {
  instrumentId: string;
  tradingSymbol: string;
  formattedInstrumentName: string;
  exchange: string;
  product: string;
  netQuantity: number;
  netAveragePrice: string;
  overnightQuantity: number;
  overnightPrice: string;
  buyQuantity: number;
  buyPrice: number;
  sellQuantity: number;
  sellPrice: number;
  dayBuyQuantity: string;
  dayBuyPrice: number;
  dayBuyValue: string;
  daySellQuantity: string;
  daySellPrice: string;
  daySellValue: string;
  multiplier: string;
  lotSize: string;
  tickSize: string;
  previousDayClose: string;
  realizedPnl?: number;
}

export interface IIFLMarginRequest {
  instrumentId: string;
  exchange: IIFLExchange;
  transactionType: IIFLTransactionType;
  quantity: number;
  orderComplexity?: IIFLOrderComplexity;
  product?: IIFLProduct;
  orderType?: IIFLOrderType;
  validity?: IIFLValidity;
  price?: number;
  slTriggerPrice?: number;
  slLegPrice?: number;
  targetLegPrice?: number;
}

export interface IIFLPreOrderMargin {
  totalCashAvailable: string;
  preOrderMargin: string;
  postOrderMargin: string;
  currentOrderMargin: string;
  rmsvalidationMessage: string;
  fundShort: string;
}

export interface IIFLSpanExposure {
  span: string;
  exposureMargin: string;
  totalMargin: string;
}

export interface IIFLMarketQuote {
  exchange: string;
  instrumentId: number;
  ltp: number;
  lastTradedQuantity: number;
  averageTradedPrice: number;
  tradedVolume: number;
  open: number;
  high: number;
  low: number;
  close: number;
  bestBidPrice: number;
  bestBidQuantity: number;
  bestAskPrice: number;
  bestAskQuantity: number;
  totalBidQuantity: number;
  totalAskQuantity: number;
  tickTimestamp: string;
}

export interface IIFLMarketDepth {
  exchange: string;
  instrumentId: number;
  totalBidQuantity: number;
  totalAskQuantity: number;
  marketDepth: {
    bids: Array<{ price: number; quantity: number; orders: number }>;
    asks: Array<{ price: number; quantity: number; orders: number }>;
  };
}

export interface IIFLHistoricalData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IIFLOpenInterest {
  exchange: string;
  instrumentId: string;
  openInterest: number;
  dayHighOi: number;
  dayLowOi: number;
  previousOi: number;
}

export interface IIFLInstrument {
  instrumentId: string;
  exchange: string;
  tradingSymbol: string;
  formattedInstrumentName: string;
  isin?: string;
  lotSize?: number;
  tickSize?: number;
  expiryDate?: string;
  strikePrice?: number;
  optionType?: string;
}

// API Response wrapper
interface IIFLResponse<T> {
  status: 'Ok' | 'Not_Ok';
  message?: string;
  result?: T;
  userSession?: string;
}

export class IIFLMarketsAPI {
  private baseUrl: string;
  private appKey: string;
  private appSecret: string;
  private bridgeHost: string;
  private bridgePort: number;
  private userSession?: string;
  private clientId?: string;
  private httpClient: AxiosInstance;
  private instrumentCache: Map<string, IIFLInstrument[]> = new Map();

  constructor(config: IIFLConfig) {
    this.appKey = config.appKey;
    this.appSecret = config.appSecret;
    this.baseUrl = config.baseUrl || 'https://api.iiflcapital.com/v1';
    this.bridgeHost = config.bridgeHost || 'bridge.iiflcapital.com';
    this.bridgePort = config.bridgePort || 9906;

    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for authentication
    this.httpClient.interceptors.request.use((config) => {
      if (this.userSession && config.url !== '/getusersession') {
        config.headers.Authorization = `Bearer ${this.userSession}`;
      }
      return config;
    });

    // Add response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const errorMessage = error.response?.data || error.message;
        console.error('[IIFL Markets API Error]', errorMessage);
        throw new Error(`IIFL Markets API Error: ${JSON.stringify(errorMessage)}`);
      }
    );
  }

  // ===== AUTHENTICATION =====

  /**
   * Generate OAuth login URL for user authentication
   * User must be redirected to this URL to login
   */
  getLoginUrl(redirectUrl?: string): string {
    let url = `https://markets.iiflcapital.com/?v=1&appkey=${this.appKey}`;
    if (redirectUrl) {
      url += `&redirecturl=${encodeURIComponent(redirectUrl)}`;
    }
    return url;
  }

  /**
   * Generate SHA-256 checksum for authentication
   * checkSum = SHA256(clientId + authCode + appSecret)
   */
  private generateChecksum(clientId: string, authCode: string): string {
    const data = `${clientId}${authCode}${this.appSecret}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Get user session (access token) after OAuth callback
   * POST /getusersession
   */
  async getUserSession(clientId: string, authCode: string): Promise<string> {
    const checkSum = this.generateChecksum(clientId, authCode);
    
    const response = await this.httpClient.post<IIFLResponse<void>>('/getusersession', {
      checkSum,
    });

    if (response.data.status === 'Ok' && response.data.userSession) {
      this.userSession = response.data.userSession;
      this.clientId = clientId;
      return this.userSession;
    }
    
    throw new Error(`Failed to get user session: ${response.data.message || 'Unknown error'}`);
  }

  /**
   * Set user session directly (useful when session is stored/cached)
   */
  setUserSession(userSession: string, clientId?: string): void {
    this.userSession = userSession;
    if (clientId) {
      this.clientId = clientId;
    }
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return !!this.userSession;
  }

  /**
   * Get client profile
   * GET /profile
   */
  async getProfile(): Promise<IIFLUserProfile> {
    this.ensureAuthenticated();
    
    const response = await this.httpClient.get<IIFLResponse<IIFLUserProfile>>('/profile');
    
    if (response.data.status === 'Ok' && response.data.result) {
      return response.data.result;
    }
    
    throw new Error(`Failed to get profile: ${response.data.message || 'Unknown error'}`);
  }

  /**
   * Get trading limits and margins
   * GET /limits
   */
  async getLimits(): Promise<IIFLLimits> {
    this.ensureAuthenticated();
    
    const response = await this.httpClient.get<IIFLResponse<IIFLLimits>>('/limits');
    
    if (response.data.status === 'Ok' && response.data.result) {
      return response.data.result;
    }
    
    throw new Error(`Failed to get limits: ${response.data.message || 'Unknown error'}`);
  }

  /**
   * Logout and terminate session
   * POST /profile/logout
   */
  async logout(): Promise<void> {
    this.ensureAuthenticated();
    
    const response = await this.httpClient.post<IIFLResponse<{ status: string; message: string }>>('/profile/logout');
    
    if (response.data.status === 'Ok') {
      this.userSession = undefined;
      this.clientId = undefined;
    } else {
      throw new Error(`Failed to logout: ${response.data.message || 'Unknown error'}`);
    }
  }

  // ===== MARGIN CALCULATION =====

  /**
   * Calculate pre-order margin considering existing positions
   * POST /preordermargin
   * Note: Pre-order margin API returns data directly without standard wrapper
   */
  async getPreOrderMargin(request: IIFLMarginRequest): Promise<IIFLPreOrderMargin> {
    this.ensureAuthenticated();
    
    const response = await this.httpClient.post<IIFLPreOrderMargin | IIFLResponse<IIFLPreOrderMargin>>('/preordermargin', {
      instrumentId: request.instrumentId,
      exchange: request.exchange,
      transactionType: request.transactionType,
      quantity: String(request.quantity),
      orderComplexity: request.orderComplexity || 'REGULAR',
      product: request.product || 'NORMAL',
      orderType: request.orderType || 'MARKET',
      validity: request.validity || 'DAY',
      ...(request.price && { price: String(request.price) }),
      ...(request.slTriggerPrice && { slTriggerPrice: String(request.slTriggerPrice) }),
      ...(request.slLegPrice && { slLegPrice: String(request.slLegPrice) }),
      ...(request.targetLegPrice && { targetLegPrice: String(request.targetLegPrice) }),
    });

    // Handle both wrapped and direct response formats
    const data = response.data as any;
    if (data.status === 'Not_Ok') {
      throw new Error(`Failed to get pre-order margin: ${data.message || 'Unknown error'}`);
    }
    if (data.result) {
      return data.result;
    }
    return data;
  }

  /**
   * Calculate SPAN and exposure margin without considering existing positions
   * POST /spanexposure
   * Note: SPAN/Exposure API returns data directly without standard wrapper
   */
  async getSpanExposureMargin(requests: Array<{
    instrumentId: string;
    exchange: IIFLExchange;
    transactionType: IIFLTransactionType;
    quantity: number;
  }>): Promise<IIFLSpanExposure> {
    this.ensureAuthenticated();
    
    const response = await this.httpClient.post<IIFLSpanExposure | IIFLResponse<IIFLSpanExposure>>('/spanexposure', requests);
    
    // Handle both wrapped and direct response formats
    const data = response.data as any;
    if (data.status === 'Not_Ok') {
      throw new Error(`Failed to get SPAN/exposure margin: ${data.message || 'Unknown error'}`);
    }
    if (data.result) {
      return data.result;
    }
    return data;
  }

  // ===== ORDER MANAGEMENT =====

  /**
   * Place one or more orders
   * POST /orders
   */
  async placeOrder(orders: IIFLOrderRequest | IIFLOrderRequest[]): Promise<IIFLOrderResult[]> {
    this.ensureAuthenticated();
    
    const orderArray = Array.isArray(orders) ? orders : [orders];
    
    const payload = orderArray.map(order => ({
      instrumentId: order.instrumentId,
      exchange: order.exchange,
      transactionType: order.transactionType,
      quantity: String(order.quantity),
      orderComplexity: order.orderComplexity,
      product: order.product,
      orderType: order.orderType,
      validity: order.validity || 'DAY',
      ...(order.price && { price: String(order.price) }),
      ...(order.slTriggerPrice && { slTriggerPrice: String(order.slTriggerPrice) }),
      ...(order.slLegPrice && { slLegPrice: String(order.slLegPrice) }),
      ...(order.targetLegPrice && { targetLegPrice: String(order.targetLegPrice) }),
      ...(order.disclosedQuantity && { disclosedQuantity: String(order.disclosedQuantity) }),
      ...(order.marketProtectionPercent && { marketProtectionPercent: String(order.marketProtectionPercent) }),
      ...(order.apiOrderSource && { apiOrderSource: order.apiOrderSource }),
      ...(order.algoId && { algoId: order.algoId }),
      ...(order.orderTag && { orderTag: order.orderTag }),
    }));

    const response = await this.httpClient.post<IIFLResponse<IIFLOrderResult[]>>('/orders', payload);
    
    if (response.data.status === 'Ok' && response.data.result) {
      return response.data.result;
    }
    
    throw new Error(`Failed to place order: ${response.data.message || 'Unknown error'}`);
  }

  /**
   * Modify a pending order
   * PUT /orders/{brokerOrderId}
   */
  async modifyOrder(brokerOrderId: string, modifications: Partial<{
    quantity: number;
    price: number;
    orderType: IIFLOrderType;
    slTriggerPrice: number;
    disclosedQuantity: number;
    validity: IIFLValidity;
  }>): Promise<IIFLOrderResult> {
    this.ensureAuthenticated();
    
    const payload: Record<string, string> = {};
    if (modifications.quantity !== undefined) payload.quantity = String(modifications.quantity);
    if (modifications.price !== undefined) payload.price = String(modifications.price);
    if (modifications.orderType) payload.orderType = modifications.orderType;
    if (modifications.slTriggerPrice !== undefined) payload.slTriggerPrice = String(modifications.slTriggerPrice);
    if (modifications.disclosedQuantity !== undefined) payload.disclosedQuantity = String(modifications.disclosedQuantity);
    if (modifications.validity) payload.validity = modifications.validity;

    const response = await this.httpClient.put<IIFLResponse<IIFLOrderResult>>(`/orders/${brokerOrderId}`, payload);
    
    if (response.data.status === 'Ok' && response.data.result) {
      return response.data.result;
    }
    
    throw new Error(`Failed to modify order: ${response.data.message || 'Unknown error'}`);
  }

  /**
   * Cancel a pending order
   * DELETE /orders/{brokerOrderId}
   */
  async cancelOrder(brokerOrderId: string): Promise<IIFLOrderResult> {
    this.ensureAuthenticated();
    
    const response = await this.httpClient.delete<IIFLResponse<IIFLOrderResult>>(`/orders/${brokerOrderId}`);
    
    if (response.data.status === 'Ok' && response.data.result) {
      return response.data.result;
    }
    
    throw new Error(`Failed to cancel order: ${response.data.message || 'Unknown error'}`);
  }

  /**
   * Get all orders for today (Order Book)
   * GET /orders
   */
  async getOrderBook(): Promise<IIFLOrderBookEntry[]> {
    this.ensureAuthenticated();
    
    const response = await this.httpClient.get<IIFLResponse<IIFLOrderBookEntry[]>>('/orders');
    
    if (response.data.status === 'Ok') {
      return response.data.result || [];
    }
    
    throw new Error(`Failed to get order book: ${response.data.message || 'Unknown error'}`);
  }

  /**
   * Get order history for a specific order
   * GET /orders/{brokerOrderId}
   */
  async getOrderHistory(brokerOrderId: string): Promise<IIFLOrderBookEntry[]> {
    this.ensureAuthenticated();
    
    const response = await this.httpClient.get<IIFLOrderBookEntry[] | IIFLResponse<IIFLOrderBookEntry[]>>(`/orders/${brokerOrderId}`);
    
    // Handle both wrapped and direct response formats
    const data = response.data as any;
    if (data.status === 'Not_Ok') {
      throw new Error(`Failed to get order history: ${data.message || 'Unknown error'}`);
    }
    if (data.result) {
      return data.result || [];
    }
    return Array.isArray(data) ? data : [];
  }

  /**
   * Get all executed trades for today (Trade Book)
   * GET /trades
   */
  async getTradeBook(): Promise<IIFLTradeBookEntry[]> {
    this.ensureAuthenticated();
    
    const response = await this.httpClient.get<IIFLTradeBookEntry[] | IIFLResponse<IIFLTradeBookEntry[]>>('/trades');
    
    // Handle both wrapped and direct response formats
    const data = response.data as any;
    if (data.status === 'Not_Ok') {
      throw new Error(`Failed to get trade book: ${data.message || 'Unknown error'}`);
    }
    if (data.result) {
      return data.result || [];
    }
    return Array.isArray(data) ? data : [];
  }

  // ===== PORTFOLIO =====

  /**
   * Get holdings (DEMAT holdings)
   * GET /holdings
   */
  async getHoldings(): Promise<IIFLHolding[]> {
    this.ensureAuthenticated();
    
    const response = await this.httpClient.get<IIFLHolding[] | IIFLResponse<IIFLHolding[]>>('/holdings');
    
    // Handle both wrapped and direct response formats
    const data = response.data as any;
    if (data.status === 'Not_Ok') {
      throw new Error(`Failed to get holdings: ${data.message || 'Unknown error'}`);
    }
    if (data.result) {
      return data.result || [];
    }
    return Array.isArray(data) ? data : [];
  }

  /**
   * Get positions (open positions including F&O carryforward)
   * GET /positions
   */
  async getPositions(): Promise<IIFLPosition[]> {
    this.ensureAuthenticated();
    
    const response = await this.httpClient.get<IIFLPosition[] | IIFLResponse<IIFLPosition[]>>('/positions');
    
    // Handle both wrapped and direct response formats
    const data = response.data as any;
    if (data.status === 'Not_Ok') {
      throw new Error(`Failed to get positions: ${data.message || 'Unknown error'}`);
    }
    if (data.result) {
      return data.result || [];
    }
    return Array.isArray(data) ? data : [];
  }

  // ===== MARKET DATA =====

  /**
   * Get historical candlestick data
   * POST /marketdata/historicaldata
   */
  async getHistoricalData(
    exchange: IIFLExchange,
    instrumentId: string,
    interval: IIFLInterval,
    fromDate: string,
    toDate: string
  ): Promise<IIFLHistoricalData[]> {
    this.ensureAuthenticated();
    
    const response = await this.httpClient.post<IIFLResponse<any[]>>('/marketdata/historicaldata', {
      exchange,
      instrumentId,
      interval,
      fromDate,
      toDate,
    });

    if (response.data.status === 'Ok' && response.data.result) {
      // Parse the response - IIFL returns array of arrays
      return response.data.result.map((item: any) => ({
        timestamp: item[0] || item.timestamp,
        open: parseFloat(item[1]) || item.open,
        high: parseFloat(item[2]) || item.high,
        low: parseFloat(item[3]) || item.low,
        close: parseFloat(item[4]) || item.close,
        volume: parseInt(item[5]) || item.volume,
      }));
    }
    
    throw new Error(`Failed to get historical data: ${response.data.message || 'Unknown error'}`);
  }

  /**
   * Get real-time market quotes
   * POST /marketdata/marketquotes
   */
  async getMarketQuotes(instruments: Array<{
    exchange: IIFLExchange;
    instrumentId: string;
  }>): Promise<IIFLMarketQuote[]> {
    this.ensureAuthenticated();
    
    const response = await this.httpClient.post<IIFLResponse<IIFLMarketQuote[]>>('/marketdata/marketquotes', instruments);
    
    if (response.data.status === 'Ok' && response.data.result) {
      return response.data.result;
    }
    
    throw new Error(`Failed to get market quotes: ${response.data.message || 'Unknown error'}`);
  }

  /**
   * Get market depth (Level 2 order book)
   * POST /marketdata/marketdepth
   */
  async getMarketDepth(
    exchange: IIFLExchange,
    instrumentId: string
  ): Promise<IIFLMarketDepth> {
    this.ensureAuthenticated();
    
    const response = await this.httpClient.post<IIFLResponse<IIFLMarketDepth>>('/marketdata/marketdepth', {
      exchange,
      instrumentId,
    });
    
    if (response.data.status === 'Ok' && response.data.result) {
      return response.data.result;
    }
    
    throw new Error(`Failed to get market depth: ${response.data.message || 'Unknown error'}`);
  }

  /**
   * Get open interest for F&O instruments
   * POST /marketdata/openinterest
   */
  async getOpenInterest(
    exchange: IIFLExchange,
    instrumentId: string
  ): Promise<IIFLOpenInterest> {
    this.ensureAuthenticated();
    
    const response = await this.httpClient.post<IIFLResponse<IIFLOpenInterest>>('/marketdata/openinterest', {
      exchange,
      instrumentId,
    });
    
    if (response.data.status === 'Ok' && response.data.result) {
      return response.data.result;
    }
    
    throw new Error(`Failed to get open interest: ${response.data.message || 'Unknown error'}`);
  }

  // ===== INSTRUMENT LOOKUP =====

  /**
   * Get instruments for a given exchange segment
   * These are publicly accessible without authentication
   */
  async getInstruments(exchange: IIFLExchange): Promise<IIFLInstrument[]> {
    // Check cache first
    if (this.instrumentCache.has(exchange)) {
      return this.instrumentCache.get(exchange)!;
    }

    try {
      const response = await axios.get<any[]>(
        `${this.baseUrl}/contractfiles/${exchange}.json`
      );
      
      const instruments: IIFLInstrument[] = response.data.map((item: any) => ({
        instrumentId: item.instrumentId || item.token,
        exchange: item.exchange || exchange,
        tradingSymbol: item.tradingSymbol || item.symbol,
        formattedInstrumentName: item.formattedInstrumentName || item.name,
        isin: item.isin,
        lotSize: item.lotSize,
        tickSize: item.tickSize,
        expiryDate: item.expiryDate,
        strikePrice: item.strikePrice,
        optionType: item.optionType,
      }));

      // Cache the instruments
      this.instrumentCache.set(exchange, instruments);
      
      return instruments;
    } catch (error) {
      console.error(`Failed to fetch instruments for ${exchange}:`, error);
      throw new Error(`Failed to get instruments for ${exchange}`);
    }
  }

  /**
   * Search instruments by symbol or name
   */
  async searchInstruments(
    query: string,
    exchange?: IIFLExchange
  ): Promise<IIFLInstrument[]> {
    const exchanges = exchange ? [exchange] : ['NSEEQ', 'BSEEQ', 'NSEFO', 'BSEFO'] as IIFLExchange[];
    const results: IIFLInstrument[] = [];
    const queryLower = query.toLowerCase();

    for (const exch of exchanges) {
      try {
        const instruments = await this.getInstruments(exch);
        const matches = instruments.filter(
          (inst) =>
            inst.tradingSymbol?.toLowerCase().includes(queryLower) ||
            inst.formattedInstrumentName?.toLowerCase().includes(queryLower) ||
            inst.isin?.toLowerCase() === queryLower
        );
        results.push(...matches.slice(0, 20)); // Limit per exchange
      } catch {
        // Skip exchanges that fail
      }
    }

    return results.slice(0, 50); // Total limit
  }

  /**
   * Get instrument by ISIN
   */
  async getInstrumentByISIN(isin: string): Promise<IIFLInstrument | null> {
    const exchanges: IIFLExchange[] = ['NSEEQ', 'BSEEQ'];
    
    for (const exchange of exchanges) {
      try {
        const instruments = await this.getInstruments(exchange);
        const match = instruments.find(inst => inst.isin === isin);
        if (match) return match;
      } catch {
        // Continue to next exchange
      }
    }
    
    return null;
  }

  /**
   * Get instrument by trading symbol
   */
  async getInstrumentBySymbol(
    tradingSymbol: string,
    exchange: IIFLExchange
  ): Promise<IIFLInstrument | null> {
    try {
      const instruments = await this.getInstruments(exchange);
      return instruments.find(
        inst => inst.tradingSymbol?.toUpperCase() === tradingSymbol.toUpperCase()
      ) || null;
    } catch {
      return null;
    }
  }

  // ===== HELPER METHODS =====

  /**
   * Ensure user is authenticated before making API calls
   */
  private ensureAuthenticated(): void {
    if (!this.userSession) {
      throw new Error('Not authenticated. Please call getUserSession() first or setUserSession().');
    }
  }

  /**
   * Get current client ID
   */
  getClientId(): string | undefined {
    return this.clientId;
  }

  /**
   * Get bridge connection details for real-time streaming
   */
  getBridgeConfig(): { host: string; port: number; token: string | undefined } {
    return {
      host: this.bridgeHost,
      port: this.bridgePort,
      token: this.userSession,
    };
  }

  /**
   * Map internal order status to standardized status
   */
  static mapOrderStatus(iiflStatus: string): 'open' | 'complete' | 'rejected' | 'cancelled' | 'pending' {
    const status = iiflStatus.toLowerCase();
    if (status === 'complete' || status === 'filled') return 'complete';
    if (status === 'rejected') return 'rejected';
    if (status === 'cancelled' || status === 'canceled') return 'cancelled';
    if (status === 'open' || status === 'pending' || status === 'trigger pending') return 'open';
    return 'pending';
  }

  /**
   * Map exchange segment from symbol
   */
  static getExchangeFromSymbol(symbol: string): IIFLExchange {
    if (symbol.endsWith('.NS') || symbol.includes('NSE')) return 'NSEEQ';
    if (symbol.endsWith('.BO') || symbol.includes('BSE')) return 'BSEEQ';
    if (symbol.includes('NFO') || symbol.includes('FUT') || symbol.includes('CE') || symbol.includes('PE')) return 'NSEFO';
    return 'NSEEQ';
  }

  /**
   * Format date for IIFL API (DD-MMM-YYYY format)
   */
  static formatDate(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  /**
   * Clear instrument cache
   */
  clearInstrumentCache(): void {
    this.instrumentCache.clear();
  }
}

// Singleton factory for the API client
let iiflMarketsInstance: IIFLMarketsAPI | null = null;

export function getIIFLMarketsAPI(): IIFLMarketsAPI {
  if (!iiflMarketsInstance) {
    const appKey = process.env.IIFL_APP_KEY;
    const appSecret = process.env.IIFL_APP_SECRET;

    if (!appKey || !appSecret) {
      throw new Error('IIFL Markets API credentials not configured. Please set IIFL_APP_KEY and IIFL_APP_SECRET environment variables.');
    }

    iiflMarketsInstance = new IIFLMarketsAPI({
      appKey,
      appSecret,
    });
  }

  return iiflMarketsInstance;
}

export function resetIIFLMarketsAPI(): void {
  iiflMarketsInstance = null;
}
