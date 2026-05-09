import { EventEmitter } from 'events';

interface IBConfig {
  host: string;
  port: number;
  clientId: number;
  paperTrading: boolean;
}

interface IBPosition {
  symbol: string;
  position: number;
  marketPrice: number;
  marketValue: number;
  averageCost: number;
  unrealizedPNL: number;
  realizedPNL: number;
  accountName: string;
}

interface IBOrder {
  orderId: number;
  clientId: number;
  symbol: string;
  action: 'BUY' | 'SELL';
  totalQuantity: number;
  orderType: 'MKT' | 'LMT' | 'STP';
  lmtPrice?: number;
  auxPrice?: number;
  status: string;
  filled: number;
  remaining: number;
  avgFillPrice: number;
  whyHeld?: string;
}

interface IBAccountSummary {
  account: string;
  tag: string;
  value: string;
  currency: string;
}

interface MarketDataSnapshot {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  lastSize: number;
  bidSize: number;
  askSize: number;
  volume: number;
  high: number;
  low: number;
  close: number;
}

class IBApiService extends EventEmitter {
  private ib: any;
  private isConnected: boolean = false;
  private config: IBConfig;
  private nextOrderId: number = 1;
  private accountSummary: Map<string, IBAccountSummary> = new Map();
  private positions: Map<string, IBPosition> = new Map();
  private orders: Map<number, IBOrder> = new Map();

  constructor(config: IBConfig) {
    super();
    this.config = config;
    
    // Initialize IB connection
    try {
      const IB = require('ib');
      this.ib = new IB({
        clientId: config.clientId,
        host: config.host,
        port: config.port
      });
      
      this.setupEventHandlers();
    } catch (error) {
      console.error('Failed to initialize IB API:', error);
      throw new Error('IB API initialization failed');
    }
  }

  private setupEventHandlers(): void {
    if (!this.ib) return;

    // Connection events
    this.ib.on('connected', () => {
      this.isConnected = true;
      console.log('✅ Connected to Interactive Brokers TWS/Gateway');
      this.emit('connected');
      
      // Request initial data
      this.requestAccountSummary();
      this.requestPositions();
      this.requestOpenOrders();
    });

    this.ib.on('disconnected', () => {
      this.isConnected = false;
      console.log('❌ Disconnected from Interactive Brokers');
      this.emit('disconnected');
    });

    this.ib.on('error', (error: any) => {
      console.error('IB API Error:', error);
      this.emit('error', error);
    });

    // Order management events
    this.ib.on('nextValidId', (orderId: number) => {
      this.nextOrderId = orderId;
      console.log('Next valid order ID:', orderId);
    });

    this.ib.on('orderStatus', (orderId: number, status: string, filled: number, remaining: number, avgFillPrice: number, permId: number, parentId: number, lastFillPrice: number, clientId: number, whyHeld: string) => {
      const order = this.orders.get(orderId);
      if (order) {
        order.status = status;
        order.filled = filled;
        order.remaining = remaining;
        order.avgFillPrice = avgFillPrice;
        order.whyHeld = whyHeld;
        this.orders.set(orderId, order);
        this.emit('orderStatus', order);
      }
    });

    this.ib.on('openOrder', (orderId: number, contract: any, order: any, orderState: any) => {
      const ibOrder: IBOrder = {
        orderId,
        clientId: order.clientId,
        symbol: contract.symbol,
        action: order.action,
        totalQuantity: order.totalQuantity,
        orderType: order.orderType,
        lmtPrice: order.lmtPrice,
        auxPrice: order.auxPrice,
        status: orderState.status,
        filled: 0,
        remaining: order.totalQuantity,
        avgFillPrice: 0
      };
      this.orders.set(orderId, ibOrder);
      this.emit('openOrder', ibOrder);
    });

    // Position events
    this.ib.on('position', (account: string, contract: any, position: number, avgCost: number) => {
      if (position !== 0) {
        const positionData: IBPosition = {
          symbol: contract.symbol,
          position,
          marketPrice: 0,
          marketValue: 0,
          averageCost: avgCost,
          unrealizedPNL: 0,
          realizedPNL: 0,
          accountName: account
        };
        this.positions.set(contract.symbol, positionData);
        this.emit('position', positionData);
      }
    });

    this.ib.on('positionEnd', () => {
      this.emit('positionsUpdated', Array.from(this.positions.values()));
    });

    // Account summary events
    this.ib.on('accountSummary', (reqId: number, account: string, tag: string, value: string, currency: string) => {
      const summary: IBAccountSummary = { account, tag, value, currency };
      this.accountSummary.set(`${account}-${tag}`, summary);
      this.emit('accountSummary', summary);
    });

    this.ib.on('accountSummaryEnd', (reqId: number) => {
      this.emit('accountSummaryUpdated', Array.from(this.accountSummary.values()));
    });

    // Market data events
    this.ib.on('tickPrice', (tickerId: number, field: number, price: number, canAutoExecute: number) => {
      this.emit('marketData', { tickerId, field, price, type: 'price' });
    });

    this.ib.on('tickSize', (tickerId: number, field: number, size: number) => {
      this.emit('marketData', { tickerId, field, size, type: 'size' });
    });
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      this.once('connected', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      try {
        this.ib.connect();
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.ib && this.isConnected) {
      this.ib.disconnect();
    }
  }

  isConnectedToIB(): boolean {
    return this.isConnected;
  }

  // Account and Portfolio Methods
  requestAccountSummary(): void {
    if (!this.isConnected) return;
    this.ib.reqAccountSummary(1, 'All', '$LEDGER');
  }

  requestPositions(): void {
    if (!this.isConnected) return;
    this.ib.reqPositions();
  }

  requestOpenOrders(): void {
    if (!this.isConnected) return;
    this.ib.reqAllOpenOrders();
  }

  getPositions(): IBPosition[] {
    return Array.from(this.positions.values());
  }

  getOrders(): IBOrder[] {
    return Array.from(this.orders.values());
  }

  getAccountSummary(): IBAccountSummary[] {
    return Array.from(this.accountSummary.values());
  }

  // Trading Methods
  async placeOrder(symbol: string, action: 'BUY' | 'SELL', quantity: number, orderType: 'MKT' | 'LMT' | 'STP', limitPrice?: number, stopPrice?: number): Promise<number> {
    if (!this.isConnected) {
      throw new Error('Not connected to Interactive Brokers');
    }

    const contract = {
      symbol: symbol.toUpperCase(),
      secType: 'STK',
      exchange: 'SMART',
      currency: 'USD'
    };

    const order = {
      action,
      totalQuantity: quantity,
      orderType,
      lmtPrice: limitPrice,
      auxPrice: stopPrice
    };

    const orderId = this.nextOrderId++;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Order placement timeout'));
      }, 5000);

      const handleOrderStatus = (orderUpdate: IBOrder) => {
        if (orderUpdate.orderId === orderId) {
          clearTimeout(timeout);
          this.removeListener('orderStatus', handleOrderStatus);
          resolve(orderId);
        }
      };

      this.on('orderStatus', handleOrderStatus);

      try {
        this.ib.placeOrder(orderId, contract, order);
      } catch (error) {
        clearTimeout(timeout);
        this.removeListener('orderStatus', handleOrderStatus);
        reject(error);
      }
    });
  }

  async cancelOrder(orderId: number): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Not connected to Interactive Brokers');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Cancel order timeout'));
      }, 5000);

      const handleOrderStatus = (orderUpdate: IBOrder) => {
        if (orderUpdate.orderId === orderId && orderUpdate.status === 'Cancelled') {
          clearTimeout(timeout);
          this.removeListener('orderStatus', handleOrderStatus);
          resolve();
        }
      };

      this.on('orderStatus', handleOrderStatus);

      try {
        this.ib.cancelOrder(orderId);
      } catch (error) {
        clearTimeout(timeout);
        this.removeListener('orderStatus', handleOrderStatus);
        reject(error);
      }
    });
  }

  // Market Data Methods
  requestMarketData(symbol: string, tickerId: number): void {
    if (!this.isConnected) return;

    const contract = {
      symbol: symbol.toUpperCase(),
      secType: 'STK',
      exchange: 'SMART',
      currency: 'USD'
    };

    this.ib.reqMktData(tickerId, contract, '', false, false);
  }

  cancelMarketData(tickerId: number): void {
    if (!this.isConnected) return;
    this.ib.cancelMktData(tickerId);
  }

  // Utility Methods
  getConnectionStatus(): { connected: boolean; config: IBConfig } {
    return {
      connected: this.isConnected,
      config: {
        ...this.config,
        // Don't expose sensitive config details in production
      }
    };
  }
}

// Default configuration for paper trading
const defaultIBConfig: IBConfig = {
  host: process.env.IB_HOST || '127.0.0.1',
  port: parseInt(process.env.IB_PORT || '7497'), // 7497 for paper trading, 7496 for live
  clientId: parseInt(process.env.IB_CLIENT_ID || '1'),
  paperTrading: process.env.IB_PAPER_TRADING !== 'false'
};

// Singleton instance
let ibApiInstance: IBApiService | null = null;

export function getIBApiService(): IBApiService {
  if (!ibApiInstance) {
    ibApiInstance = new IBApiService(defaultIBConfig);
  }
  return ibApiInstance;
}

export function createIBApiService(config: IBConfig): IBApiService {
  return new IBApiService(config);
}

export {
  IBApiService,
  IBConfig,
  IBPosition,
  IBOrder,
  IBAccountSummary,
  MarketDataSnapshot
};