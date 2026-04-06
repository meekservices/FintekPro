import axios from 'axios';
import crypto from 'crypto';

interface WebhookTestPayload {
  orderId: string;
  amount: number;
  status: 'PAID' | 'FAILED' | 'ACTIVE';
  userId?: string;
}

export class CashfreeWebhookTester {
  private secretKey: string;
  private baseUrl: string;

  constructor() {
    this.secretKey = process.env.CASHFREE_PG_SECRET_KEY || process.env.CASHFREE_SECRET_KEY || '';
    this.baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : 'http://localhost:5000';
  }

  /**
   * Generate HMAC signature for webhook verification
   */
  private generateSignature(rawBody: string, timestamp: string): string {
    const signatureData = `${timestamp}.${rawBody}`;
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(signatureData)
      .digest('base64');
  }

  /**
   * Create a test webhook payload
   */
  private createTestPayload(testData: WebhookTestPayload): any {
    return {
      type: testData.status === 'PAID' ? 'PAYMENT_SUCCESS_WEBHOOK' : 
            testData.status === 'FAILED' ? 'PAYMENT_FAILED_WEBHOOK' : 
            'PAYMENT_PENDING_WEBHOOK',
      data: {
        order: {
          order_id: testData.orderId,
          cf_order_id: `cf_${Date.now()}`,
          order_amount: testData.amount,
          order_currency: 'INR',
          order_status: testData.status,
          created_at: new Date().toISOString(),
          customer_details: {
            customer_id: testData.userId || 'test-user-123',
            customer_phone: '9876543210',
            customer_email: 'test@fintekpro.com',
            customer_name: 'Test User'
          }
        },
        payment: {
          payment_status: testData.status,
          payment_method: 'UPI',
          payment_amount: testData.amount,
          payment_time: new Date().toISOString(),
          payment_completion_time: testData.status === 'PAID' ? new Date().toISOString() : undefined
        }
      }
    };
  }

  /**
   * Send test webhook to your endpoint
   */
  async sendTestWebhook(testData: WebhookTestPayload): Promise<{
    success: boolean;
    statusCode?: number;
    response?: any;
    error?: string;
  }> {
    try {
      const payload = this.createTestPayload(testData);
      const rawBody = JSON.stringify(payload);
      const timestamp = Date.now().toString();
      const signature = this.generateSignature(rawBody, timestamp);

      console.log('\n🧪 Sending test webhook...');
      console.log('📍 URL:', `${this.baseUrl}/api/payments/cashfree/webhook`);
      console.log('📦 Order ID:', testData.orderId);
      console.log('💰 Amount:', testData.amount);
      console.log('📊 Status:', testData.status);
      console.log('🔐 Signature:', signature.substring(0, 20) + '...');

      const response = await axios.post(
        `${this.baseUrl}/api/payments/cashfree/webhook`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-signature': signature,
            'x-webhook-timestamp': timestamp
          }
        }
      );

      console.log('✅ Webhook delivered successfully!');
      console.log('📬 Response:', response.status, response.data);

      return {
        success: true,
        statusCode: response.status,
        response: response.data
      };

    } catch (error: any) {
      console.error('❌ Webhook test failed:', error.response?.data || error.message);
      return {
        success: false,
        statusCode: error.response?.status,
        response: error.response?.data,
        error: error.message
      };
    }
  }

  /**
   * Run a complete test suite with multiple scenarios
   */
  async runTestSuite(orderId: string): Promise<void> {
    console.log('\n🚀 Starting Cashfree Webhook Test Suite');
    console.log('═'.repeat(50));

    // Test 1: Successful payment
    console.log('\n📝 Test 1: Successful Payment');
    await this.sendTestWebhook({
      orderId,
      amount: 1000,
      status: 'PAID',
      userId: 'test-user-123'
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 2: Failed payment
    console.log('\n📝 Test 2: Failed Payment');
    await this.sendTestWebhook({
      orderId: `${orderId}_fail`,
      amount: 500,
      status: 'FAILED',
      userId: 'test-user-123'
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 3: Pending payment
    console.log('\n📝 Test 3: Pending Payment');
    await this.sendTestWebhook({
      orderId: `${orderId}_pending`,
      amount: 2000,
      status: 'ACTIVE',
      userId: 'test-user-123'
    });

    console.log('\n✨ Test suite completed!');
    console.log('═'.repeat(50));
  }
}

// Export singleton instance
export const webhookTester = new CashfreeWebhookTester();
