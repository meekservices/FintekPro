import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { getAppBaseUrl } from './utils/app-url';
import {
  getCashfreePGAppId,
  getCashfreePGSecretKey,
  getCashfreePGEnvironment,
  getCashfreePGBaseUrl,
} from './utils/cashfree-config';

export interface CashfreePaymentRequest {
  amount: number;
  userId: string;
  phone?: string;
  name?: string;
  email?: string;
  returnUrl?: string;
  orderNote?: string;
  terminalId?: string;
}

export interface CashfreeOrderResponse {
  success: boolean;
  orderId?: string;
  paymentSessionId?: string;
  paymentUrl?: string;
  message?: string;
  /** HTTP status code from Cashfree — undefined means a network/transport error (no response received) */
  statusCode?: number;
  /** 'business' = Cashfree rejected the request (4xx), 'network' = transport/5xx failure */
  errorType?: 'business' | 'network';
}

export interface CashfreeOrderStatus {
  orderId: string;
  orderStatus: string;
  orderAmount: number;
  transactionId?: string;
  paymentMethod?: string;
}

export class CashfreeService {
  private appId: string;
  private secretKey: string;
  private environment: string;
  private baseUrl: string;
  private apiClient: AxiosInstance;

  constructor() {
    this.appId = getCashfreePGAppId();
    this.secretKey = getCashfreePGSecretKey();
    this.environment = getCashfreePGEnvironment();

    // Validate credentials are present
    if (!this.appId || !this.secretKey) {
      const isDev = process.env.NODE_ENV === 'development';
      if (isDev) {
        console.warn('⚠️ Cashfree PG credentials (CASHFREE_PG_APP_ID, CASHFREE_PG_SECRET_KEY) not configured');
        console.warn('⚠️ Cashfree Payment Gateway APIs will not function properly');
      } else {
        throw new Error('Cashfree PG credentials (CASHFREE_PG_APP_ID, CASHFREE_PG_SECRET_KEY) are required in production');
      }
    }

    // Set base URL based on environment
    this.baseUrl = getCashfreePGBaseUrl();

    // Create axios instance with default headers
    // UPGRADED to API Version 2025-01-01 (v5)
    this.apiClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'x-client-id': this.appId,
        'x-client-secret': this.secretKey,
        'x-api-version': '2025-01-01',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }

  /**
   * Check if service has valid credentials configured
   */
  hasValidCredentials(): boolean {
    return !!(this.appId && this.secretKey && this.appId.length > 0 && this.secretKey.length > 0);
  }

  /**
   * Generate a unique order ID
   */
  generateOrderId(): string {
    return `order_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Create a new order (v5 compliant)
   */
  async createOrder(paymentRequest: CashfreePaymentRequest): Promise<CashfreeOrderResponse> {
    try {
      const orderId = this.generateOrderId();
      const returnUrl = paymentRequest.returnUrl || `${getAppBaseUrl()}/api/payments/cashfree/callback`;

      const requestBody = {
        order_amount: paymentRequest.amount,
        order_currency: "INR",
        order_id: orderId,
        customer_details: {
          customer_id: paymentRequest.userId,
          customer_phone: paymentRequest.phone || "9999999999",
          customer_email: paymentRequest.email || `${paymentRequest.userId}@example.com`,
          customer_name: paymentRequest.name || "Customer"
        },
        order_meta: {
          return_url: `${returnUrl}?order_id={order_id}`
        },
        order_note: paymentRequest.orderNote,
        terminal_id: paymentRequest.terminalId
      };

      console.log('Creating Cashfree v5 order:', { orderId, amount: paymentRequest.amount });

      const response = await this.apiClient.post('/orders', requestBody);

      if (response.data) {
        const paymentUrl = this.environment === 'PRODUCTION' 
          ? `https://cashfree.com/pg/view/order`
          : `https://sandbox.cashfree.com/pg/view/order`;

        return {
          success: true,
          orderId: response.data.order_id,
          paymentSessionId: response.data.payment_session_id,
          paymentUrl: `${paymentUrl}?order_id=${response.data.order_id}&payment_session_id=${response.data.payment_session_id}`,
          message: 'Order created successfully'
        };
      } else {
        throw new Error('Failed to create order');
      }

    } catch (error: any) {
      const errorData = error.response?.data;
      const statusCode = error.response?.status;
      console.error('Cashfree v5 order creation error:', {
        status: statusCode,
        data: errorData,
        message: error.message
      });
      
      let userMessage = 'Failed to create order';
      if (statusCode === 401 || statusCode === 403) {
        userMessage = 'Payment gateway authentication failed. Please verify API credentials.';
      } else if (errorData?.message) {
        userMessage = errorData.message;
      } else if (error.message) {
        userMessage = error.message;
      }
      
      return {
        success: false,
        message: userMessage,
        statusCode,
        errorType: statusCode === undefined ? 'network' : statusCode >= 400 && statusCode < 500 ? 'business' : 'network',
      };
    }
  }

  /**
   * Create a payment session (for mobile/headless SDK flows)
   */
  async createPaymentSession(orderId: string): Promise<{ success: boolean; sessionId?: string; message?: string }> {
    try {
      const response = await this.apiClient.post(`/orders/${orderId}/sessions`);
      return {
        success: true,
        sessionId: response.data.payment_session_id,
        message: 'Session created successfully'
      };
    } catch (error: any) {
      console.error('Cashfree session creation error:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }

  /**
   * Fetch order status
   */
  async getOrderStatus(orderId: string): Promise<CashfreeOrderStatus | null> {
    try {
      const response = await this.apiClient.get(`/orders/${orderId}`);

      if (response.data) {
        return {
          orderId: response.data.order_id,
          orderStatus: response.data.order_status,
          orderAmount: response.data.order_amount,
          transactionId: response.data.cf_order_id,
          paymentMethod: response.data.payment_method
        };
      }

      return null;
    } catch (error: any) {
      console.error('Cashfree order status error:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Fetch all payments for an order
   */
  async fetchPaymentsForOrder(orderId: string): Promise<any[]> {
    try {
      const response = await this.apiClient.get(`/orders/${orderId}/payments`);
      return response.data || [];
    } catch (error: any) {
      console.error('Cashfree fetch payments error:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Create a refund
   */
  async createRefund(orderId: string, refundAmount: number, refundId?: string, refundNote?: string): Promise<any> {
    try {
      const payload = {
        refund_amount: refundAmount,
        refund_id: refundId || `ref_${Date.now()}`,
        refund_note: refundNote
      };
      const response = await this.apiClient.post(`/orders/${orderId}/refunds`, payload);
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error('Cashfree refund error:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }

  /**
   * Fetch settlements
   */
  async getSettlements(orderId?: string): Promise<any[]> {
    try {
      const path = orderId ? `/settlements?order_id=${orderId}` : '/settlements';
      const response = await this.apiClient.get(path);
      return response.data || [];
    } catch (error: any) {
      console.error('Cashfree settlements error:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Fetch reconciliation report
   */
  async getReconciliation(params: { from: string; to: string; contentType?: string }): Promise<any> {
    try {
      const response = await this.apiClient.post('/recon', params);
      return response.data;
    } catch (error: any) {
      console.error('Cashfree reconciliation error:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Verify webhook signature (HMAC-SHA256)
   */
  verifyWebhookSignature(signature: string, rawBody: string, timestamp: string): boolean {
    try {
      const signatureData = `${timestamp}.${rawBody}`;
      const computedSignature = crypto
        .createHmac('sha256', this.secretKey)
        .update(signatureData)
        .digest('base64');

      return computedSignature === signature;
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return false;
    }
  }

  /**
   * Legacy penny drop verification - using secureIDBaseUrl
   */
  async verifyBankAccount(
    accountNumber: string,
    ifsc: string,
    accountHolderName: string
  ): Promise<BankVerificationResult> {
    if (!this.hasValidCredentials()) {
      throw new Error('Cashfree credentials not configured.');
    }

    try {
      // Note: Penny drop usually sits on Verification API, but we keep the logic here for context
      const verificationUrl = this.environment === 'PRODUCTION'
        ? 'https://api.cashfree.com/verification/bank-account'
        : 'https://sandbox.cashfree.com/verification/bank-account';

      const requestBody = {
        bank_account: accountNumber,
        ifsc: ifsc.toUpperCase(),
        name: accountHolderName
      };

      const response = await axios.post(verificationUrl, requestBody, {
        headers: {
          'x-client-id': this.appId,
          'x-client-secret': this.secretKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const data = response.data;

      if (data.status === 'SUCCESS' || data.verification_status === 'SUCCESS') {
        const verifiedName = data.registered_name || data.name_at_bank || '';
        const nameMatchScore = this.calculateNameMatchScore(accountHolderName, verifiedName);

        return {
          success: true,
          verified: true,
          accountExists: true,
          verifiedName,
          nameMatchScore,
          accountStatus: data.account_status || 'active',
          transactionId: data.reference_id || data.transaction_id,
          message: 'Bank account verified successfully'
        };
      }

      return { success: false, verified: false, accountExists: false, message: data.message || 'Verification failed' };
    } catch (error: any) {
      console.error('Cashfree bank verification error:', error.response?.data || error.message);
      return { success: false, verified: false, accountExists: false, message: error.message || 'Verification service error' };
    }
  }

  private calculateNameMatchScore(name1: string, name2: string): number {
    if (!name1 || !name2) return 0;
    const normalize = (str: string) => str.toUpperCase().replace(/[^A-Z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    const n1 = normalize(name1);
    const n2 = normalize(name2);
    if (n1 === n2) return 100;

    const matrix = Array(n1.length + 1).fill(null).map(() => Array(n2.length + 1).fill(null));
    for (let i = 0; i <= n1.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= n2.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= n1.length; i++) {
      for (let j = 1; j <= n2.length; j++) {
        if (n1[i - 1] === n2[j - 1]) matrix[i][j] = matrix[i - 1][j - 1];
        else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
    const distance = matrix[n1.length][n2.length];
    const maxLength = Math.max(n1.length, n2.length);
    return Math.round(((maxLength - distance) / maxLength) * 100);
  }

  /**
   * v5 Eligible eMandate initiation
   */
  async createEMandate(
    userId: string,
    accountNumber: string,
    ifscCode: string,
    accountHolderName: string,
    maxAmount: number,
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' = 'MONTHLY',
    startDate?: Date,
    endDate?: Date
  ): Promise<EMandateCreateResult> {
    if (!this.hasValidCredentials()) throw new Error('Cashfree credentials not configured.');

    try {
      const eMandateUrl = this.environment === 'PRODUCTION'
        ? 'https://api.cashfree.com/pg/eligibility/emandate'
        : 'https://sandbox.cashfree.com/pg/eligibility/emandate';

      const mandateId = `mandate_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const start = startDate || new Date();
      const end = endDate || new Date(start.getTime() + 10 * 365 * 24 * 60 * 60 * 1000);

      const requestBody = {
        mandate_id: mandateId,
        customer_id: userId,
        mandate_amount: maxAmount,
        frequency,
        start_date: start.toISOString().split('T')[0],
        end_date: end.toISOString().split('T')[0],
        bank_account: {
          account_number: accountNumber,
          ifsc: ifscCode.toUpperCase(),
          account_holder_name: accountHolderName
        },
        authorization_mode: 'DEBIT_CARD',
        return_url: `${getAppBaseUrl()}/api/kyc/wizard/emandate-callback`
      };

      const response = await axios.post(eMandateUrl, requestBody, {
        headers: {
          'x-client-id': this.appId,
          'x-client-secret': this.secretKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (response.data.status === 'SUCCESS' || response.data.mandate_url) {
        return {
          success: true,
          mandateId: response.data.mandate_id || mandateId,
          mandateUrl: response.data.mandate_url,
          status: 'PENDING_AUTHORIZATION',
          message: 'eMandate created'
        };
      }
      return { success: false, status: 'FAILED', message: response.data.message || 'eMandate creation failed' };
    } catch (error: any) {
      console.error('Cashfree eMandate error:', error.response?.data || error.message);
      return { success: false, status: 'FAILED', message: error.message };
    }
  }

  async getEMandateStatus(mandateId: string): Promise<EMandateStatusResult> {
    try {
      const statusUrl = this.environment === 'PRODUCTION'
        ? `https://api.cashfree.com/pg/eligibility/emandate/${mandateId}`
        : `https://sandbox.cashfree.com/pg/eligibility/emandate/${mandateId}`;
      const response = await axios.get(statusUrl, {
        headers: { 'x-client-id': this.appId, 'x-client-secret': this.secretKey },
        timeout: 15000
      });
      return {
        success: true,
        mandateId: response.data.mandate_id,
        status: response.data.status || 'PENDING',
        authorizationDate: response.data.authorization_date,
        expiryDate: response.data.end_date,
        maxAmount: response.data.mandate_amount,
        frequency: response.data.frequency
      };
    } catch (error: any) {
      return { success: false, status: 'UNKNOWN', message: error.message };
    }
  }

  async cancelEMandate(mandateId: string): Promise<{ success: boolean; message: string }> {
    try {
      const cancelUrl = this.environment === 'PRODUCTION'
        ? `https://api.cashfree.com/pg/eligibility/emandate/${mandateId}/cancel`
        : `https://sandbox.cashfree.com/pg/eligibility/emandate/${mandateId}/cancel`;
      await axios.post(cancelUrl, {}, {
        headers: { 'x-client-id': this.appId, 'x-client-secret': this.secretKey },
        timeout: 15000
      });
      return { success: true, message: 'eMandate cancelled successfully' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}

export interface BankVerificationResult {
  success: boolean;
  verified: boolean;
  accountExists: boolean;
  verifiedName?: string;
  nameMatchScore?: number;
  accountStatus?: 'active' | 'inactive' | 'dormant';
  transactionId?: string;
  message?: string;
  errorCode?: string;
}

export interface EMandateCreateResult {
  success: boolean;
  mandateId?: string;
  mandateUrl?: string;
  status: 'PENDING_AUTHORIZATION' | 'ACTIVE' | 'FAILED' | 'CANCELLED';
  message?: string;
  errorCode?: string;
}

export interface EMandateStatusResult {
  success: boolean;
  mandateId?: string;
  status: 'PENDING' | 'ACTIVE' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'UNKNOWN';
  authorizationDate?: string;
  expiryDate?: string;
  maxAmount?: number;
  frequency?: string;
  message?: string;
}

export const cashfreeService = new CashfreeService();
