/**
 * Payment API Modernization Logic Verification
 * 
 * Verifies that the upgraded payment services generate payloads and hit endpoints
 * as per the latest provider documentation (Cashfree v5, Alpaca RTP, Iris Refinements).
 * 
 * Run with: npx tsx server/services/__tests__/payment-api-modernization.test.ts
 */

import { CashfreeService } from "../../cashfree-service";
import { AlpacaBrokerService } from "../alpaca-broker-service";
import { IrisKfintechService } from "../iris-kfintech-service";

// --- Mock Infrastructure ---

class MockAxios {
  lastRequest: any = null;
  defaults = { headers: { common: {} } };

  async post(url: string, body?: any, config?: any) {
    this.lastRequest = { method: 'POST', url, body, headers: config?.headers || {} };
    return { data: { success: true, payment_session_id: 'mock_session_123', order_id: 'mock_order_123' } };
  }
  async get(url: string, config?: any) {
    this.lastRequest = { method: 'GET', url, headers: config?.headers || {} };
    return { data: { success: true } };
  }
  async patch(url: string, body?: any, config?: any) {
    this.lastRequest = { method: 'PATCH', url, body, headers: config?.headers || {} };
    return { data: { success: true } };
  }
  async request(config: any) {
    this.lastRequest = { method: config.method, url: config.url, body: config.data, headers: config.headers || {} };
    return { data: { success: true } };
  }
  create() { return this; }
}

const mockAxios = new MockAxios();

// Helper to access private apiClient for testing
function setMockClient(service: any, client: any) {
  (service as any).apiClient = client;
  (service as any).client = client; // for Iris/Alpaca
}

// --- Test Suite ---

async function runTests() {
  console.log('\n🧪 Testing Payment API Modernization Logic\n');
  
  let passed = 0;
  let failed = 0;

  const runTest = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.log(`❌ FAIL: ${name}`);
      console.log(`   ${err.message}\n`);
      failed++;
    }
  };

  // --- Cashfree v5 Logic Verification ---
  await runTest('Cashfree v5: createOrder payload check', async () => {
    const service = new CashfreeService();
    setMockClient(service, mockAxios);

    await service.createOrder({
      amount: 100,
      userId: 'user_123',
      orderNote: 'Test Order'
    });

    const req = mockAxios.lastRequest;
    if (req.url !== '/orders') throw new Error('Incorrect endpoint');
    if (req.headers['x-api-version'] !== '2025-01-01') throw new Error('Incorrect API version header');
    if (req.body.customer_details.customer_id !== 'user_123') throw new Error('Missing customer_id in v5 payload');
    if (!req.body.order_meta.return_url.includes('order_id={order_id}')) throw new Error('Incorrect return_url format for v5');
  });

  await runTest('Cashfree v5: createRefund endpoint check', async () => {
    const service = new CashfreeService();
    setMockClient(service, mockAxios);

    await service.createRefund('order_123', 50);

    const req = mockAxios.lastRequest;
    if (req.url !== '/orders/order_123/refunds') throw new Error('Incorrect refund endpoint for v5');
    if (req.body.refund_amount !== 50) throw new Error('Incorrect refund amount');
  });

  // --- Alpaca RTP & Payment Logic Verification ---
  await runTest('Alpaca: createRtpTransfer payload check', async () => {
    const service = new AlpacaBrokerService();
    setMockClient(service, mockAxios);

    await service.createRtpTransfer('acc_123', {
      amount: '500.00',
      direction: 'INCOMING',
      relationship_id: 'rel_123'
    });

    const req = mockAxios.lastRequest;
    if (req.url !== '/v1/accounts/acc_123/transfers/rtp') throw new Error('Incorrect RTP endpoint');
    if (req.body.amount !== '500.00') throw new Error('Incorrect amount structure');
  });

  await runTest('Alpaca: listBankAccounts endpoint check', async () => {
    const service = new AlpacaBrokerService();
    setMockClient(service, mockAxios);

    await service.listBankAccounts('acc_123');

    const req = mockAxios.lastRequest;
    if (req.url !== '/v1/accounts/acc_123/bank_accounts') throw new Error('Incorrect bank accounts endpoint');
  });

  await runTest('Alpaca: getPortfolioHistoryWithResolution logic', async () => {
    const service = new AlpacaBrokerService();
    setMockClient(service, mockAxios);

    await service.getPortfolioHistoryWithResolution('acc_123', { timeframe: '5Min' });

    const req = mockAxios.lastRequest;
    if (!req.url.includes('/account/portfolio/history')) throw new Error('Incorrect history endpoint');
    // Check if the base URL builder used the correct trading base
  });

  // --- Iris (KFintech) Payment Logic Verification ---
  await runTest('Iris: getDirectPayStatus logic', async () => {
    const service = new IrisKfintechService();
    setMockClient(service, mockAxios);

    await service.getDirectPayStatus('PAN123', 'BANK123');

    const req = mockAxios.lastRequest;
    if (!req.url.includes('/sif/transactions/direct-pay-status')) throw new Error('Incorrect Direct Pay endpoint');
    if (!req.url.includes('pan=PAN123') || !req.url.includes('accountNo=BANK123')) throw new Error('Missing query parameters');
  });

  await runTest('Iris: listActiveMandatesByBank logic', async () => {
    const service = new IrisKfintechService();
    setMockClient(service, mockAxios);

    await service.listActiveMandatesByBank('PAN123', 'BANK123');

    const req = mockAxios.lastRequest;
    if (!req.url.includes('/sif/mandates/active')) throw new Error('Incorrect Mandates endpoint');
  });

  console.log('\n' + '='.repeat(50));
  console.log(`\n📊 Logic Verification Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(console.error);
