import { logger } from '../../../logger';

export class AlpacaAuthManager {
  private keyId: string;
  private secretKey: string;
  private isPaper: boolean;

  constructor() {
    this.keyId = process.env.ALPACA_BROKER_KEY_ID || process.env.ALPACA_KEY_ID || '';
    this.secretKey = process.env.ALPACA_BROKER_SECRET_KEY || process.env.ALPACA_SECRET_KEY || '';
    // Default to true for safety if not explicitly false
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

  getMarketDataUrl(): string {
    return this.isPaper
      ? 'https://data.sandbox.alpaca.markets/v2'
      : 'https://data.alpaca.markets/v2';
  }

  getAuthHeaders() {
    const creds = this.getCredentials();
    return {
      'Authorization': `Basic ${Buffer.from(`${creds.keyId}:${creds.secretKey}`).toString('base64')}`,
      'Content-Type': 'application/json'
    };
  }
}

export const alpacaAuthManager = new AlpacaAuthManager();
