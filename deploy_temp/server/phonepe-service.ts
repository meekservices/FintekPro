import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import { getAppBaseUrl } from './utils/app-url';

export interface PhonePePaymentRequest {
  amount: number;
  userId: string;
  phone?: string;
  name?: string;
  email?: string;
  redirectUrl?: string;
}

export interface PhonePeOrderResponse {
  success: boolean;
  orderId?: string;
  merchantTransactionId?: string;
  instrumentResponse?: {
    redirectInfo?: {
      url: string;
      method: string;
    };
  };
  paymentUrl?: string;
  message?: string;
}

export interface PhonePeOrderStatus {
  merchantId: string;
  merchantTransactionId: string;
  transactionId?: string;
  amount: number;
  state: string;
  responseCode: string;
  paymentInstrument?: {
    type: string;
  };
}

export class PhonePeService {
  private merchantId: string;
  private saltKey: string;
  private saltIndex: string;
  private environment: string;
  private baseUrl: string;
  private apiClient: AxiosInstance;

  constructor() {
    this.merchantId = process.env.PHONEPE_MERCHANT_ID || '';
    this.saltKey = process.env.PHONEPE_SALT_KEY || '';
    this.saltIndex = process.env.PHONEPE_SALT_INDEX || '1';
    this.environment = process.env.PHONEPE_ENVIRONMENT || (process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX');
    
    // Set base URL based on environment
    this.baseUrl = this.environment === 'PRODUCTION' 
      ? 'https://api.phonepe.com/apis/hermes'
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

    // Create axios instance
    this.apiClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    console.log(`✅ PhonePe service initialized (${this.environment} mode)`);
  }

  /**
   * Generate SHA256 signature for X-VERIFY header
   */
  private generateSignature(base64Payload: string, endpoint: string): string {
    const stringToHash = base64Payload + endpoint + this.saltKey;
    const sha256Hash = crypto.createHash('sha256').update(stringToHash).digest('hex');
    return `${sha256Hash}###${this.saltIndex}`;
  }

  /**
   * Generate a unique merchant transaction ID
   */
  generateTransactionId(): string {
    return `TXN_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Create a new payment order
   */
  async createOrder(paymentRequest: PhonePePaymentRequest): Promise<PhonePeOrderResponse> {
    try {
      const merchantTransactionId = this.generateTransactionId();
      const callbackUrl = `${getAppBaseUrl()}/api/payments/phonepe/callback`;
      const redirectUrl = paymentRequest.redirectUrl || `${getAppBaseUrl()}/payment-success`;

      // Prepare payload
      const payload = {
        merchantId: this.merchantId,
        merchantTransactionId,
        merchantUserId: paymentRequest.userId,
        amount: Math.round(paymentRequest.amount * 100), // Convert to paise
        redirectUrl,
        redirectMode: 'POST',
        callbackUrl,
        mobileNumber: paymentRequest.phone || '9999999999',
        paymentInstrument: {
          type: 'PAY_PAGE'
        }
      };

      // Base64 encode payload
      const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');

      // Generate X-VERIFY header
      const endpoint = '/pg/v1/pay';
      const xVerify = this.generateSignature(payloadBase64, endpoint);

      // Make API request
      const response = await this.apiClient.post(endpoint, {
        request: payloadBase64
      }, {
        headers: {
          'X-VERIFY': xVerify
        }
      });

      const data = response.data;

      if (data.success && data.code === 'PAYMENT_INITIATED') {
        return {
          success: true,
          orderId: merchantTransactionId,
          merchantTransactionId,
          instrumentResponse: data.data?.instrumentResponse,
          paymentUrl: data.data?.instrumentResponse?.redirectInfo?.url,
          message: 'Payment initiated successfully'
        };
      }

      return {
        success: false,
        message: data.message || 'Failed to initiate payment'
      };

    } catch (error: any) {
      console.error('PhonePe order creation failed:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Payment initiation failed'
      };
    }
  }

  /**
   * Check payment status
   */
  async checkOrderStatus(merchantTransactionId: string): Promise<PhonePeOrderStatus | null> {
    try {
      const endpoint = `/pg/v1/status/${this.merchantId}/${merchantTransactionId}`;
      
      // Generate X-VERIFY header (for status check, no payload needed)
      const stringToHash = endpoint + this.saltKey;
      const sha256Hash = crypto.createHash('sha256').update(stringToHash).digest('hex');
      const xVerify = `${sha256Hash}###${this.saltIndex}`;

      const response = await this.apiClient.get(endpoint, {
        headers: {
          'X-VERIFY': xVerify
        }
      });

      const data = response.data;

      if (data.success && data.data) {
        return {
          merchantId: data.data.merchantId,
          merchantTransactionId: data.data.merchantTransactionId,
          transactionId: data.data.transactionId,
          amount: data.data.amount,
          state: data.data.state,
          responseCode: data.data.responseCode,
          paymentInstrument: data.data.paymentInstrument
        };
      }

      return null;
    } catch (error: any) {
      console.error('PhonePe status check failed:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Verify callback signature
   */
  verifyCallback(base64Response: string, receivedSignature: string): boolean {
    try {
      if (!this.saltKey) {
        console.error('[PhonePe] PHONEPE_SALT_KEY is not set — cannot verify callback signature');
        return false;
      }
      const expectedSignature = this.generateSignature(base64Response, '/pg/v1/callback');
      // Use timing-safe comparison to prevent timing-oracle attacks (SEBI CSCRF requirement)
      const expectedBuf = Buffer.from(expectedSignature, 'utf8');
      const receivedBuf = Buffer.from(receivedSignature, 'utf8');
      if (expectedBuf.length !== receivedBuf.length) return false;
      return crypto.timingSafeEqual(expectedBuf, receivedBuf);
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Decode callback response
   */
  decodeCallbackResponse(base64Response: string): any {
    try {
      const jsonString = Buffer.from(base64Response, 'base64').toString('utf-8');
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Failed to decode callback response:', error);
      return null;
    }
  }
}

// Export singleton instance
export const phonePeService = new PhonePeService();
