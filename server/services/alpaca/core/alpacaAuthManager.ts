import axios from 'axios';
import { logger } from '../../../logger';

export class AlpacaAuthManager {
  private keyId: string;
  private secretKey: string;
  private isPaper: boolean;
  
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.keyId = process.env.ALPACA_BROKER_KEY_ID || process.env.ALPACA_KEY_ID || '';
    this.secretKey = process.env.ALPACA_BROKER_SECRET_KEY || process.env.ALPACA_SECRET_KEY || '';
    this.isPaper = process.env.ALPACA_ENV !== 'production';
  }

  get isConfigured(): boolean {
    return !!(this.keyId && this.secretKey);
  }

  getCredentials() {
    if (!this.isConfigured) {
      logger.warn('[AlpacaAuthManager] Credentials missing. Check GCP Secret Manager or environment variables.');
    }
    return {
      keyId: this.keyId,
      secretKey: this.secretKey,
    };
  }

  getBaseUrl(): string {
    return this.isPaper 
      ? 'https://broker-api.sandbox.alpaca.markets/v1' 
      : 'https://broker-api.alpaca.markets/v1';
  }

  getAuthUrl(): string {
    return this.isPaper
      ? 'https://authx.sandbox.alpaca.markets/v1/oauth2/token'
      : 'https://authx.alpaca.markets/v1/oauth2/token';
  }

  /**
   * Fetches a short-lived access token using Client Credentials flow
   * Tokens are typically valid for 15 minutes.
   */
  async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 30s buffer)
    if (this.accessToken && Date.now() < this.tokenExpiry - 30000) {
      return this.accessToken;
    }

    try {
      logger.info('[AlpacaAuthManager] Requesting new access token (Client Credentials flow)');
      
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');
      params.append('client_id', this.keyId);
      params.append('client_secret', this.secretKey);

      const response = await axios.post(this.getAuthUrl(), params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      const { access_token, expires_in } = response.data;
      
      this.accessToken = access_token;
      this.tokenExpiry = Date.now() + (expires_in * 1000);

      logger.info(`[AlpacaAuthManager] Token acquired. Expires in ${expires_in}s`);
      return this.accessToken!;
    } catch (error: any) {
      logger.error('[AlpacaAuthManager] Failed to fetch access token', error.response?.data || error.message);
      throw new Error(`Alpaca Auth Failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Gets headers for API requests. 
   * Transitioning from Basic Auth to Bearer tokens for Production readiness.
   */
  async getAuthHeaders() {
    const token = await this.getAccessToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }
}

export const alpacaAuthManager = new AlpacaAuthManager();
