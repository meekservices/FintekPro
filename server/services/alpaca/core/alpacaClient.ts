import axios, { AxiosInstance } from 'axios';
import { logger } from '../../../logger';
import { alpacaAuthManager } from './alpacaAuthManager';

export class AlpacaClient {
  private client: AxiosInstance;
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly MAX_FAILURES = 5;
  private readonly RESET_TIMEOUT = 60000; // 1 minute

  constructor() {
    this.client = axios.create({
      baseURL: alpacaAuthManager.getBaseUrl(),
      timeout: 30000,
    });

    // Request interceptor to attach dynamic headers
    this.client.interceptors.request.use((config) => {
      config.headers = {
        ...config.headers,
        ...alpacaAuthManager.getAuthHeaders()
      } as any;
      return config;
    });

    logger.info('[AlpacaClient] Resilient Broker Client initialized', { 
      baseUrl: alpacaAuthManager.getBaseUrl(),
      isPaper: alpacaAuthManager.getBaseUrl().includes('sandbox')
    });
  }

  private isCircuitOpen(): boolean {
    if (this.failureCount >= this.MAX_FAILURES) {
      if (Date.now() - this.lastFailureTime > this.RESET_TIMEOUT) {
        this.failureCount = 0;
        return false;
      }
      return true;
    }
    return false;
  }

  private recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.MAX_FAILURES) {
      logger.error('[AlpacaClient] Circuit Breaker OPEN. Too many failures.');
    }
  }

  private recordSuccess() {
    this.failureCount = 0;
  }

  async call<T = any>(
    endpoint: string, 
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET', 
    body?: any,
    retryCount = 0
  ): Promise<T> {
    if (this.isCircuitOpen()) {
      throw new Error('Alpaca API is currently unavailable (Circuit Breaker Open)');
    }

    try {
      const resp = await this.client.request<T>({
        url: endpoint,
        method,
        ...(body ? { data: body } : {}),
      });
      
      this.recordSuccess();
      return resp.data;
    } catch (err: any) {
      // Handle Rate Limiting (429)
      if (err.response?.status === 429 && retryCount < 3) {
        const resetTime = err.response.headers['rate-limit-reset'];
        const backoff = resetTime ? (parseInt(resetTime) * 1000) - Date.now() : Math.pow(2, retryCount) * 1000;
        logger.warn(`[AlpacaClient] Rate limited (429), retrying in ${backoff}ms...`);
        await new Promise(r => setTimeout(r, Math.max(backoff, 1000)));
        return this.call(endpoint, method, body, retryCount + 1);
      }

      if (err.response?.status >= 500 || err.code === 'ECONNABORTED') {
        this.recordFailure();
        if (retryCount < 2) {
          const backoff = Math.pow(2, retryCount) * 1000;
          logger.warn(`[AlpacaClient] API error 5xx, retrying in ${backoff}ms...`);
          await new Promise(r => setTimeout(r, backoff));
          return this.call(endpoint, method, body, retryCount + 1);
        }
      }

      throw err;
    }
  }

  // --- Core API Abstractions ---

  async createAccount(accountData: any) {
    return this.call('/accounts', 'POST', accountData);
  }

  async getAccount(accountId: string) {
    return this.call(`/accounts/${accountId}`);
  }

  async getPositions(accountId: string) {
    return this.call(`/trading/accounts/${accountId}/positions`);
  }

  async placeOrder(accountId: string, orderPayload: any) {
    // Broker API requires accountId in URL for trading
    return this.call(`/trading/accounts/${accountId}/orders`, 'POST', orderPayload);
  }

  async getOrders(accountId: string, params?: any) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/trading/accounts/${accountId}/orders${qs}`);
  }
}

export const alpacaClient = new AlpacaClient();
