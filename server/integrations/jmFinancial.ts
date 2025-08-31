import axios from 'axios';
import crypto from 'crypto';

// JM Financial Symphony XTS API Integration
export class JMFinancialAPI {
  private baseUrl: string;
  private marketDataApiKey: string;
  private marketDataSecret: string;
  private interactiveApiKey: string;
  private interactiveSecret: string;
  private authToken?: string;

  constructor(config: {
    marketDataApiKey: string;
    marketDataSecret: string;
    interactiveApiKey: string;
    interactiveSecret: string;
    baseUrl?: string;
  }) {
    this.marketDataApiKey = config.marketDataApiKey;
    this.marketDataSecret = config.marketDataSecret;
    this.interactiveApiKey = config.interactiveApiKey;
    this.interactiveSecret = config.interactiveSecret;
    this.baseUrl = config.baseUrl || 'https://developers.symphonyfintech.in';
  }

  // Generate authentication token
  private async authenticate(apiType: 'marketdata' | 'interactive'): Promise<string> {
    try {
      const endpoint = `${this.baseUrl}/session`;
      const apiKey = apiType === 'marketdata' ? this.marketDataApiKey : this.interactiveApiKey;
      const secret = apiType === 'marketdata' ? this.marketDataSecret : this.interactiveSecret;
      
      const payload = {
        appKey: apiKey,
        secretKey: secret,
        source: 'WEBAPI'
      };

      const response = await axios.post(endpoint, payload, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data.type === 'success') {
        this.authToken = response.data.result.token;
        return this.authToken!;
      } else {
        throw new Error(`Authentication failed: ${response.data.description}`);
      }
    } catch (error) {
      throw new Error(`JM Financial authentication error: ${error}`);
    }
  }

  // Get market data
  async getMarketData(symbols: string[]): Promise<any> {
    try {
      if (!this.authToken) {
        await this.authenticate('marketdata');
      }

      const endpoint = `${this.baseUrl}/marketdata/instruments/quotes`;
      
      const response = await axios.post(endpoint, {
        instruments: symbols.map(symbol => ({
          exchangeSegment: this.getExchangeSegment(symbol),
          exchangeInstrumentID: symbol
        }))
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch market data: ${error}`);
    }
  }

  // Get historical data
  async getHistoricalData(symbol: string, resolution: string, from: string, to: string): Promise<any> {
    try {
      if (!this.authToken) {
        await this.authenticate('marketdata');
      }

      const endpoint = `${this.baseUrl}/marketdata/instruments/ohlc`;
      
      const response = await axios.post(endpoint, {
        exchangeSegment: this.getExchangeSegment(symbol),
        exchangeInstrumentID: symbol,
        startTime: from,
        endTime: to,
        compressionValue: resolution
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch historical data: ${error}`);
    }
  }

  // Place order
  async placeOrder(orderData: {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    orderType: 'MARKET' | 'LIMIT';
    price?: number;
    product: 'NRML' | 'CNC' | 'MIS';
  }): Promise<any> {
    try {
      if (!this.authToken) {
        await this.authenticate('interactive');
      }

      const endpoint = `${this.baseUrl}/interactive/orders`;
      
      const payload = {
        exchangeSegment: this.getExchangeSegment(orderData.symbol),
        exchangeInstrumentID: orderData.symbol,
        orderSide: orderData.side,
        orderQuantity: orderData.quantity,
        orderType: orderData.orderType,
        productType: orderData.product,
        timeInForce: 'DAY',
        orderUniqueIdentifier: `JM_${Date.now()}`,
        ...(orderData.orderType === 'LIMIT' && { limitPrice: orderData.price })
      };

      const response = await axios.post(endpoint, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to place order: ${error}`);
    }
  }

  // Get positions
  async getPositions(): Promise<any> {
    try {
      if (!this.authToken) {
        await this.authenticate('interactive');
      }

      const endpoint = `${this.baseUrl}/interactive/portfolio/positions`;
      
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch positions: ${error}`);
    }
  }

  // Get holdings
  async getHoldings(): Promise<any> {
    try {
      if (!this.authToken) {
        await this.authenticate('interactive');
      }

      const endpoint = `${this.baseUrl}/interactive/portfolio/holdings`;
      
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch holdings: ${error}`);
    }
  }

  // Helper method to determine exchange segment
  private getExchangeSegment(symbol: string): number {
    if (symbol.endsWith('.NS') || symbol.includes('NSE')) {
      return 1; // NSE_EQ
    } else if (symbol.endsWith('.BO') || symbol.includes('BSE')) {
      return 11; // BSE_EQ
    } else if (symbol.includes('MCX')) {
      return 4; // MCX_FO
    } else if (symbol.includes('NCDEX')) {
      return 13; // NCDEX_FO
    }
    return 1; // Default to NSE
  }

  // Logout and invalidate token
  async logout(): Promise<void> {
    try {
      if (this.authToken) {
        const endpoint = `${this.baseUrl}/session/logout`;
        await axios.delete(endpoint, {
          headers: {
            'Authorization': `Bearer ${this.authToken}`
          }
        });
        this.authToken = undefined;
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
}

// Factory function to create JM Financial API instance
export function createJMFinancialAPI(config: {
  marketDataApiKey: string;
  marketDataSecret: string;
  interactiveApiKey: string;
  interactiveSecret: string;
}): JMFinancialAPI {
  return new JMFinancialAPI(config);
}

// Types for JM Financial API responses
export interface JMQuote {
  symbol: string;
  ltp: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  close: number;
}

export interface JMOrder {
  orderID: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  status: string;
  orderType: string;
  timestamp: string;
}

export interface JMPosition {
  symbol: string;
  quantity: number;
  avgPrice: number;
  ltp: number;
  pnl: number;
  product: string;
}

export interface JMHolding {
  symbol: string;
  quantity: number;
  avgPrice: number;
  ltp: number;
  value: number;
  pnl: number;
}