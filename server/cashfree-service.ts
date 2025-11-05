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
    this.appId = process.env.CASHFREE_CLIENT_ID || '';
    this.secretKey = process.env.CASHFREE_CLIENT_SECRET || '';
    this.environment = process.env.CASHFREE_ENVIRONMENT || 'SANDBOX';
    
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

    console.log(`✅ Cashfree service initialized (${this.environment} mode)`);
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
}

export const cashfreeService = new CashfreeService();
