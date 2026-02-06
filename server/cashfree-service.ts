import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';

export interface CashfreePaymentRequest {
  amount: number;
  userId: string;
  phone?: string;
  name?: string;
  email?: string;
  returnUrl?: string;
}

export interface CashfreeOrderResponse {
  success: boolean;
  orderId?: string;
  paymentSessionId?: string;
  paymentUrl?: string;
  message?: string;
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
    this.appId = process.env.CASHFREE_APP_ID || '';
    this.secretKey = process.env.CASHFREE_SECRET_KEY || '';
    
    // Auto-detect environment: use explicit CASHFREE_ENVIRONMENT if set, otherwise use NODE_ENV
    if (process.env.CASHFREE_ENVIRONMENT) {
      this.environment = process.env.CASHFREE_ENVIRONMENT;
    } else {
      this.environment = process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX';
    }
    
    // Validate credentials are present
    if (!this.appId || !this.secretKey) {
      const isDev = process.env.NODE_ENV === 'development';
      if (isDev) {
        console.warn('⚠️ Cashfree credentials (CASHFREE_APP_ID, CASHFREE_SECRET_KEY) not configured');
        console.warn('⚠️ Cashfree payment and verification APIs will not function properly');
      } else {
        // In production, throw error if credentials are missing
        throw new Error('Cashfree credentials (CASHFREE_APP_ID, CASHFREE_SECRET_KEY) are required in production');
      }
    }
    
    // Set base URL based on environment
    this.baseUrl = this.environment === 'PRODUCTION' 
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg';

    // Create axios instance with default headers
    this.apiClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'x-client-id': this.appId,
        'x-client-secret': this.secretKey,
        'x-api-version': '2023-08-01',
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
   * Create a new order
   */
  async createOrder(paymentRequest: CashfreePaymentRequest): Promise<CashfreeOrderResponse> {
    try {
      const orderId = this.generateOrderId();
      const returnUrl = paymentRequest.returnUrl || 
        `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/api/payments/cashfree/callback`;

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
        }
      };

      console.log('Creating Cashfree order:', { orderId, amount: paymentRequest.amount });

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
      console.error('Cashfree order creation error:', {
        status: statusCode,
        data: errorData,
        message: error.message,
        appIdLength: this.appId?.length || 0,
        secretKeyLength: this.secretKey?.length || 0,
        environment: this.environment
      });
      
      // Provide more specific error messages
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
        message: userMessage
      };
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
   * Verify webhook signature
   * Cashfree uses HMAC-SHA256 for webhook signature verification
   */
  verifyWebhookSignature(signature: string, rawBody: string, timestamp: string): boolean {
    try {
      // Cashfree webhook signature format: timestamp.rawBody
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
   * Get test credentials info
   */
  getTestCredentials() {
    return {
      appId: this.appId,
      environment: this.environment,
      testCards: {
        cardNumber: '4111111111111111',
        expiryMonth: '12',
        expiryYear: '30',
        cvv: '123',
        cardHolder: 'Test User'
      },
      testUPI: 'test@payu'
    };
  }

  /**
   * Bank Account Verification (Penny Drop) using Cashfree Verification Suite
   */
  async verifyBankAccount(
    accountNumber: string,
    ifsc: string,
    accountHolderName: string
  ): Promise<BankVerificationResult> {
    // Check if running in production without credentials
    if (this.environment === 'PRODUCTION' && !this.hasValidCredentials()) {
      throw new Error('Cashfree credentials required for bank verification in production');
    }

    if (!this.hasValidCredentials()) {
      throw new Error('Cashfree credentials not configured. Set CASHFREE_APP_ID and CASHFREE_SECRET_KEY for bank verification.');
    }

    try {
      // Cashfree Verification Suite - Bank Account Verification endpoint
      const verificationUrl = this.environment === 'PRODUCTION'
        ? 'https://api.cashfree.com/verification/bank-account'
        : 'https://sandbox.cashfree.com/verification/bank-account';

      const requestBody = {
        bank_account: accountNumber,
        ifsc: ifsc.toUpperCase(),
        name: accountHolderName,
        phone: '' // Optional for some banks
      };

      console.log(`🏦 Cashfree: Verifying bank account ${accountNumber.slice(-4)} with IFSC ${ifsc}`);

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

        console.log(`✅ Bank verified. Name match: ${nameMatchScore}%`);

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

      return {
        success: false,
        verified: false,
        accountExists: false,
        message: data.message || 'Bank account verification failed'
      };

    } catch (error: any) {
      console.error('❌ Cashfree bank verification error:', error.response?.data || error.message);

      if (error.response?.data) {
        return {
          success: false,
          verified: false,
          accountExists: false,
          message: error.response.data.message || 'Verification failed',
          errorCode: error.response.data.code
        };
      }

      return {
        success: false,
        verified: false,
        accountExists: false,
        message: error.message || 'Bank verification service unavailable'
      };
    }
  }

  /**
   * Calculate name match score using Levenshtein distance
   * Returns similarity percentage (0-100)
   */
  private calculateNameMatchScore(name1: string, name2: string): number {
    if (!name1 || !name2) return 0;

    // Normalize: uppercase, remove special chars, trim
    const normalize = (str: string) =>
      str.toUpperCase()
        .replace(/[^A-Z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const n1 = normalize(name1);
    const n2 = normalize(name2);

    if (n1 === n2) return 100;

    // Levenshtein distance
    const matrix: number[][] = [];
    
    for (let i = 0; i <= n1.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= n2.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= n1.length; i++) {
      for (let j = 1; j <= n2.length; j++) {
        if (n1[i - 1] === n2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    const distance = matrix[n1.length][n2.length];
    const maxLength = Math.max(n1.length, n2.length);
    
    if (maxLength === 0) return 100;
    
    const similarity = ((maxLength - distance) / maxLength) * 100;
    return Math.round(similarity);
  }

  /**
   * Create eMandate for NACH (National Automated Clearing House)
   * Used for SIP (Systematic Investment Plan) auto-debit
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
    // Check if running in production without credentials
    if (this.environment === 'PRODUCTION' && !this.hasValidCredentials()) {
      throw new Error('Cashfree credentials required for eMandate creation in production');
    }

    if (!this.hasValidCredentials()) {
      throw new Error('Cashfree credentials not configured. Set CASHFREE_APP_ID and CASHFREE_SECRET_KEY for eMandate services.');
    }

    try {
      // Cashfree eMandate creation endpoint
      const eMandateUrl = this.environment === 'PRODUCTION'
        ? 'https://api.cashfree.com/pg/eligibility/emandate'
        : 'https://sandbox.cashfree.com/pg/eligibility/emandate';

      const mandateId = `mandate_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const start = startDate || new Date();
      const end = endDate || new Date(start.getTime() + 10 * 365 * 24 * 60 * 60 * 1000); // 10 years default

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
        authorization_mode: 'DEBIT_CARD', // or NET_BANKING
        return_url: `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/api/kyc/wizard/emandate-callback`
      };

      console.log(`📝 Cashfree: Creating eMandate for user ${userId}, max amount ₹${maxAmount}`);

      const response = await axios.post(eMandateUrl, requestBody, {
        headers: {
          'x-client-id': this.appId,
          'x-client-secret': this.secretKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const data = response.data;

      if (data.status === 'SUCCESS' || data.mandate_url) {
        console.log(`✅ eMandate created successfully: ${mandateId}`);

        return {
          success: true,
          mandateId: data.mandate_id || mandateId,
          mandateUrl: data.mandate_url,
          status: 'PENDING_AUTHORIZATION',
          message: 'eMandate created. User needs to authorize via bank'
        };
      }

      return {
        success: false,
        status: 'FAILED',
        message: data.message || 'eMandate creation failed'
      };

    } catch (error: any) {
      console.error('❌ Cashfree eMandate creation error:', error.response?.data || error.message);

      if (error.response?.data) {
        return {
          success: false,
          status: 'FAILED',
          message: error.response.data.message || 'eMandate creation failed',
          errorCode: error.response.data.code
        };
      }

      return {
        success: false,
        status: 'FAILED',
        message: error.message || 'eMandate service unavailable'
      };
    }
  }

  /**
   * Get eMandate status
   */
  async getEMandateStatus(mandateId: string): Promise<EMandateStatusResult> {
    if (!this.hasValidCredentials()) {
      throw new Error('Cashfree credentials not configured. Set CASHFREE_APP_ID and CASHFREE_SECRET_KEY for eMandate services.');
    }

    try {
      const statusUrl = this.environment === 'PRODUCTION'
        ? `https://api.cashfree.com/pg/eligibility/emandate/${mandateId}`
        : `https://sandbox.cashfree.com/pg/eligibility/emandate/${mandateId}`;

      const response = await axios.get(statusUrl, {
        headers: {
          'x-client-id': this.appId,
          'x-client-secret': this.secretKey
        },
        timeout: 15000
      });

      const data = response.data;

      return {
        success: true,
        mandateId: data.mandate_id,
        status: data.status || 'PENDING',
        authorizationDate: data.authorization_date,
        expiryDate: data.end_date,
        maxAmount: data.mandate_amount,
        frequency: data.frequency
      };

    } catch (error: any) {
      console.error('❌ eMandate status check error:', error.response?.data || error.message);

      return {
        success: false,
        status: 'UNKNOWN',
        message: error.response?.data?.message || error.message || 'Failed to fetch mandate status'
      };
    }
  }

  /**
   * Cancel eMandate
   */
  async cancelEMandate(mandateId: string): Promise<{ success: boolean; message: string }> {
    if (!this.hasValidCredentials()) {
      return {
        success: true,
        message: `[MOCK] eMandate ${mandateId} cancelled successfully`
      };
    }

    try {
      const cancelUrl = this.environment === 'PRODUCTION'
        ? `https://api.cashfree.com/pg/eligibility/emandate/${mandateId}/cancel`
        : `https://sandbox.cashfree.com/pg/eligibility/emandate/${mandateId}/cancel`;

      await axios.post(cancelUrl, {}, {
        headers: {
          'x-client-id': this.appId,
          'x-client-secret': this.secretKey
        },
        timeout: 15000
      });

      console.log(`✅ eMandate cancelled: ${mandateId}`);

      return {
        success: true,
        message: 'eMandate cancelled successfully'
      };

    } catch (error: any) {
      console.error('❌ eMandate cancellation error:', error.response?.data || error.message);

      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to cancel mandate'
      };
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
