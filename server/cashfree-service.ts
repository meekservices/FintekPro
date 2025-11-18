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
    this.environment = process.env.CASHFREE_ENVIRONMENT || 'SANDBOX';
    
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

    const credentialsStatus = this.appId && this.secretKey ? 'with credentials' : 'WITHOUT CREDENTIALS';
    console.log(`✅ Cashfree service initialized (${this.environment} mode) ${credentialsStatus}`);
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
      console.error('Cashfree order creation error:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to create order'
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

    // Use mocks in non-production environments when credentials are missing
    if (!this.hasValidCredentials()) {
      console.log('⚠️ Using mock bank verification (credentials not configured)');
      return this.mockBankVerification(accountNumber, ifsc, accountHolderName);
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
   * Mock bank verification for development/testing
   */
  private mockBankVerification(
    accountNumber: string,
    ifsc: string,
    accountHolderName: string
  ): BankVerificationResult {
    // Validate IFSC format
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(ifsc.toUpperCase())) {
      return {
        success: false,
        verified: false,
        accountExists: false,
        message: 'Invalid IFSC code format'
      };
    }

    // Validate account number format
    const accountRegex = /^[0-9]{9,18}$/;
    if (!accountRegex.test(accountNumber)) {
      return {
        success: false,
        verified: false,
        accountExists: false,
        message: 'Invalid account number format'
      };
    }

    // Mock successful verification
    const mockVerifiedName = accountHolderName.toUpperCase();
    const nameMatchScore = 100;

    console.log(`✅ [MOCK] Bank account verified: ${accountNumber.slice(-4)}`);

    return {
      success: true,
      verified: true,
      accountExists: true,
      verifiedName: mockVerifiedName,
      nameMatchScore,
      accountStatus: 'active',
      transactionId: `mock_txn_${Date.now()}`,
      message: 'Bank account verified successfully (MOCK)'
    };
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

export const cashfreeService = new CashfreeService();
