import crypto from 'crypto';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export interface PhonePePaymentRequest {
  amount: number;
  userId: string;
  phone?: string;
  name?: string;
  email?: string;
  callbackUrl?: string;
}

export interface PhonePePaymentResponse {
  success: boolean;
  code: string;
  message: string;
  data?: {
    merchantTransactionId: string;
    transactionId: string;
    instrumentResponse: {
      type: string;
      redirectInfo: {
        url: string;
        method: string;
      };
    };
  };
}

export interface PhonePeStatusResponse {
  success: boolean;
  code: string;
  message: string;
  data?: {
    merchantId: string;
    merchantTransactionId: string;
    transactionId: string;
    amount: number;
    state: string;
    responseCode: string;
    paymentInstrument: {
      type: string;
      utr?: string;
    };
  };
}

export class PhonePeService {
  private merchantId: string;
  private saltKey: string;
  private saltIndex: number;
  private baseUrl: string;
  private callbackUrl: string;

  constructor() {
    // Default to UAT credentials for testing
    this.merchantId = process.env.PHONEPE_MERCHANT_ID || 'PGTESTPAYUAT';
    this.saltKey = process.env.PHONEPE_SALT_KEY || '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399';
    this.saltIndex = parseInt(process.env.PHONEPE_SALT_INDEX || '1');
    this.baseUrl = process.env.PHONEPE_BASE_URL || 'https://api-preprod.phonepe.com/apis/pg-sandbox';
    this.callbackUrl = process.env.PHONEPE_CALLBACK_URL || 'http://localhost:5000/api/payments/phonepe/callback';
  }

  /**
   * Generate a unique transaction ID
   */
  generateTransactionId(): string {
    return `TXN_${Date.now()}_${uuidv4().substring(0, 8)}`;
  }

  /**
   * Generate checksum for PhonePe API
   */
  private generateChecksum(payload: string, endpoint: string): string {
    const string = payload + endpoint + this.saltKey;
    const sha256 = crypto.createHash('sha256').update(string).digest('hex');
    return sha256 + '###' + this.saltIndex;
  }

  /**
   * Initiate a payment transaction
   */
  async initiatePayment(paymentRequest: PhonePePaymentRequest): Promise<PhonePePaymentResponse> {
    try {
      const merchantTransactionId = this.generateTransactionId();
      const callbackUrl = paymentRequest.callbackUrl || this.callbackUrl;
      
      const paymentData = {
        merchantId: this.merchantId,
        merchantTransactionId: merchantTransactionId,
        merchantUserId: `MUID_${paymentRequest.userId}`,
        amount: Math.round(paymentRequest.amount * 100), // Convert to paise
        redirectUrl: `${callbackUrl}/${merchantTransactionId}`,
        redirectMode: 'POST',
        callbackUrl: `${callbackUrl}/${merchantTransactionId}`,
        mobileNumber: paymentRequest.phone || '',
        paymentInstrument: {
          type: 'PAY_PAGE'
        }
      };

      // Add optional fields if provided
      if (paymentRequest.name) {
        (paymentData as any).name = paymentRequest.name;
      }
      if (paymentRequest.email) {
        (paymentData as any).email = paymentRequest.email;
      }

      const payload = JSON.stringify(paymentData);
      const payloadMain = Buffer.from(payload).toString('base64');
      const endpoint = '/pg/v1/pay';
      const checksum = this.generateChecksum(payloadMain, endpoint);

      const options = {
        method: 'POST',
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-VERIFY': checksum
        },
        data: {
          request: payloadMain
        }
      };

      console.log('PhonePe Payment Request:', {
        merchantTransactionId,
        amount: paymentRequest.amount,
        userId: paymentRequest.userId
      });

      const response = await axios(options);
      
      if (response.data.success) {
        return {
          success: true,
          code: response.data.code,
          message: response.data.message,
          data: {
            merchantTransactionId,
            transactionId: response.data.data.transactionId,
            instrumentResponse: response.data.data.instrumentResponse
          }
        };
      } else {
        throw new Error(response.data.message || 'Payment initiation failed');
      }

    } catch (error: any) {
      console.error('PhonePe Payment Error:', error.message);
      return {
        success: false,
        code: 'PAYMENT_ERROR',
        message: error.message || 'Failed to initiate payment'
      };
    }
  }

  /**
   * Check payment status
   */
  async checkPaymentStatus(merchantTransactionId: string): Promise<PhonePeStatusResponse> {
    try {
      const endpoint = `/pg/v1/status/${this.merchantId}/${merchantTransactionId}`;
      const checksum = this.generateChecksum('', endpoint);

      const options = {
        method: 'GET',
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-VERIFY': checksum,
          'X-MERCHANT-ID': this.merchantId
        }
      };

      console.log('PhonePe Status Check:', { merchantTransactionId });

      const response = await axios(options);

      return {
        success: response.data.success,
        code: response.data.code,
        message: response.data.message,
        data: response.data.data
      };

    } catch (error: any) {
      console.error('PhonePe Status Check Error:', error.message);
      return {
        success: false,
        code: 'STATUS_ERROR',
        message: error.message || 'Failed to check payment status'
      };
    }
  }

  /**
   * Verify callback signature
   */
  verifyCallback(receivedChecksum: string, payload: string): boolean {
    try {
      const expectedChecksum = this.generateChecksum(payload, '');
      return receivedChecksum === expectedChecksum;
    } catch (error) {
      console.error('Callback verification error:', error);
      return false;
    }
  }

  /**
   * Process callback data
   */
  processCallback(callbackData: any) {
    try {
      // Decode the base64 payload
      const decodedPayload = Buffer.from(callbackData.response, 'base64').toString('utf-8');
      return JSON.parse(decodedPayload);
    } catch (error) {
      console.error('Callback processing error:', error);
      throw new Error('Invalid callback data format');
    }
  }

  /**
   * Get test credentials info
   */
  getTestCredentials() {
    return {
      merchantId: this.merchantId,
      environment: this.baseUrl.includes('preprod') ? 'UAT' : 'PRODUCTION',
      testCards: {
        cardNumber: '4242424242424242',
        expiryMonth: '12',
        expiryYear: '44',
        cvv: '936',
        otp: '123456'
      }
    };
  }
}

export const phonePeService = new PhonePeService();