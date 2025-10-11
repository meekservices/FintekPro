import { Cashfree } from "cashfree-pg";

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

  constructor() {
    this.appId = process.env.CASHFREE_APP_ID || '';
    this.secretKey = process.env.CASHFREE_SECRET_KEY || '';
    this.environment = process.env.CASHFREE_ENVIRONMENT || 'SANDBOX';

    // Configure Cashfree SDK
    Cashfree.XClientId = this.appId;
    Cashfree.XClientSecret = this.secretKey;
    Cashfree.XEnvironment = this.environment === 'PRODUCTION' 
      ? Cashfree.Environment.PRODUCTION 
      : Cashfree.Environment.SANDBOX;
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

      const request = {
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

      const response = await Cashfree.PGCreateOrder("2023-08-01", request);

      if (response.data) {
        return {
          success: true,
          orderId: response.data.order_id,
          paymentSessionId: response.data.payment_session_id,
          paymentUrl: `https://${this.environment === 'PRODUCTION' ? '' : 'sandbox.'}cashfree.com/pg/view/order?order_id=${response.data.order_id}&payment_session_id=${response.data.payment_session_id}`,
          message: 'Order created successfully'
        };
      } else {
        throw new Error('Failed to create order');
      }

    } catch (error: any) {
      console.error('Cashfree order creation error:', error);
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
      const response = await Cashfree.PGFetchOrder("2023-08-01", orderId);

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
      console.error('Cashfree order status error:', error);
      return null;
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(signature: string, rawBody: string, timestamp: string): boolean {
    try {
      Cashfree.PGVerifyWebhookSignature(signature, rawBody, timestamp);
      return true;
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
      testUPI: 'success@razorpay'
    };
  }
}

export const cashfreeService = new CashfreeService();
