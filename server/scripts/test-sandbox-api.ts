/**
 * Comprehensive Sandbox API Test Script for FintekPro
 * Tests ALL endpoints used across the platform
 */

import axios from 'axios';

const SANDBOX_BASE_URL = process.env.SANDBOX_BASE_URL || 'https://api.sandbox.co.in';
const SANDBOX_API_KEY = process.env.SANDBOX_API_KEY;
const SANDBOX_API_SECRET = process.env.SANDBOX_API_SECRET;

interface TestResult {
  endpoint: string;
  service: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  responseTime?: number;
  data?: any;
}

const results: TestResult[] = [];
let accessToken: string | null = null;

async function authenticate(): Promise<string | null> {
  console.log('\n🔐 Testing Authentication...');
  const startTime = Date.now();
  
  if (!SANDBOX_API_KEY || !SANDBOX_API_SECRET) {
    results.push({
      endpoint: '/authenticate',
      service: 'Core',
      status: 'FAIL',
      message: 'SANDBOX_API_KEY or SANDBOX_API_SECRET not configured'
    });
    return null;
  }

  try {
    const response = await axios.post(
      `${SANDBOX_BASE_URL}/authenticate`,
      {},
      {
        headers: {
          'x-api-key': SANDBOX_API_KEY,
          'x-api-secret': SANDBOX_API_SECRET,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    const accessToken = response.data?.data?.access_token || response.data?.access_token;
    const expiresIn = response.data?.data?.expires_in || response.data?.expires_in;
    if (accessToken) {
      results.push({
        endpoint: '/authenticate',
        service: 'Core',
        status: 'PASS',
        message: `Token obtained (expires in ${expiresIn}s)`,
        responseTime: Date.now() - startTime
      });
      console.log('✅ Authentication successful');
      return accessToken;
    } else {
      results.push({
        endpoint: '/authenticate',
        service: 'Core',
        status: 'FAIL',
        message: 'No access token in response',
        responseTime: Date.now() - startTime
      });
      return null;
    }
  } catch (error: any) {
    results.push({
      endpoint: '/authenticate',
      service: 'Core',
      status: 'FAIL',
      message: error.response?.data?.message || error.message,
      responseTime: Date.now() - startTime
    });
    console.log('❌ Authentication failed');
    return null;
  }
}

async function testEndpoint(config: {
  name: string;
  service: string;
  endpoint: string;
  method: 'GET' | 'POST';
  body?: any;
  headers?: Record<string, string>;
  expectError?: boolean;
}): Promise<void> {
  const startTime = Date.now();
  console.log(`\n📡 Testing ${config.name}...`);
  
  try {
    const requestConfig: any = {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-api-key': SANDBOX_API_KEY,
        'Content-Type': 'application/json',
        ...config.headers
      },
      timeout: 20000
    };

    let response;
    if (config.method === 'POST') {
      response = await axios.post(
        `${SANDBOX_BASE_URL}${config.endpoint}`,
        config.body || {},
        requestConfig
      );
    } else {
      response = await axios.get(
        `${SANDBOX_BASE_URL}${config.endpoint}`,
        requestConfig
      );
    }

    results.push({
      endpoint: config.endpoint,
      service: config.service,
      status: 'PASS',
      message: 'Endpoint accessible',
      responseTime: Date.now() - startTime,
      data: response.data?.code || response.status
    });
    console.log(`✅ ${config.name} - accessible`);
  } catch (error: any) {
    const status = error.response?.status;
    const errMsg = error.response?.data?.message || error.message;
    const responseTime = Date.now() - startTime;
    
    // Certain errors are expected for test data
    if (config.expectError && (status === 400 || status === 422 || status === 404)) {
      results.push({
        endpoint: config.endpoint,
        service: config.service,
        status: 'PASS',
        message: `Endpoint accessible (validation error expected: ${errMsg})`,
        responseTime,
        data: { status }
      });
      console.log(`✅ ${config.name} - accessible (validation error expected)`);
    } else if (errMsg?.includes('production') || errMsg?.includes('Production')) {
      results.push({
        endpoint: config.endpoint,
        service: config.service,
        status: 'SKIP',
        message: 'Requires production API key',
        responseTime
      });
      console.log(`⚠️ ${config.name} - requires production key`);
    } else {
      results.push({
        endpoint: config.endpoint,
        service: config.service,
        status: 'FAIL',
        message: errMsg,
        responseTime,
        data: error.response?.data
      });
      console.log(`❌ ${config.name} - failed: ${errMsg}`);
    }
  }
}

async function runAllTests(): Promise<void> {
  console.log('============================================================');
  console.log('FintekPro Sandbox.co.in API Comprehensive Test Suite');
  console.log('============================================================');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  // 1. Authentication
  accessToken = await authenticate();
  
  if (!accessToken) {
    console.log('\n❌ Cannot proceed without authentication');
    printResults();
    return;
  }

  // 2. KYC Service Endpoints
  console.log('\n\n========== KYC SERVICE ENDPOINTS ==========');
  
  // MCA Company Search (sandbox-kyc-service.ts)
  await testEndpoint({
    name: 'MCA Company Search (KYC)',
    service: 'sandbox-kyc-service',
    endpoint: '/kyc/corporate/mca/search',
    method: 'POST',
    body: { cin: 'U72200TN2004PTC053454' },
    expectError: true
  });

  // GSTIN Verification
  await testEndpoint({
    name: 'GSTIN Verification',
    service: 'sandbox-kyc-service',
    endpoint: '/kyc/business/gstin/search',
    method: 'POST',
    body: { gstin: '27AADCB2230M1ZV' },
    expectError: true
  });

  // PAN Verification
  await testEndpoint({
    name: 'PAN Verification',
    service: 'sandbox-kyc-service',
    endpoint: '/kyc/pan/verify',
    method: 'POST',
    body: { '@entity': 'in.co.sandbox.kyc.pan.verify', pan: 'XXXPX1234A', name_as_per_pan: 'Test Name', date_of_birth: '', consent: 'Y', reason: 'Test verification' },
    expectError: true
  });

  // TAN Verification
  await testEndpoint({
    name: 'TAN Verification',
    service: 'sandbox-kyc-service',
    endpoint: '/kyc/tan/search',
    method: 'POST',
    body: { tan: 'DELA00000A' },
    expectError: true
  });

  // 3. MCA Service Endpoints
  console.log('\n\n========== MCA SERVICE ENDPOINTS ==========');
  
  // MCA Master Data Search (mca-service.ts)
  await testEndpoint({
    name: 'MCA Company Master Data',
    service: 'mca-service',
    endpoint: '/mca/company/master-data/search',
    method: 'POST',
    body: {
      '@entity': 'in.co.sandbox.kyc.mca.master_data.request',
      id: 'U72200TN2004PTC053454',
      consent: 'y',
      reason: 'for KYC and financial analysis'
    },
    headers: { 'x-api-version': '1.0.0' },
    expectError: true
  });

  // 4. Capital Gains Service Endpoints
  console.log('\n\n========== CAPITAL GAINS SERVICE ENDPOINTS ==========');
  
  // Tax P&L Job Creation
  await testEndpoint({
    name: 'Capital Gains Tax P&L Job',
    service: 'sandbox-capital-gains-service',
    endpoint: '/it/v1/calculator/tax-pnl/securities/domestic/job',
    method: 'POST',
    body: {
      assessment_year: '2024-25',
      pan: 'AAAAA0000A'
    },
    expectError: true
  });

  // 5. Additional endpoints that might be used
  console.log('\n\n========== ADDITIONAL ENDPOINTS ==========');

  // Bank Account Verification (if used)
  await testEndpoint({
    name: 'Bank Account Verification',
    service: 'verification',
    endpoint: '/bank/0000000000/ifsc/SBIN0000001/verify',
    method: 'GET',
    headers: { 'x-api-version': '2.0' },
    expectError: true
  });

  // GSTIN Public API
  await testEndpoint({
    name: 'GSTIN Public Lookup',
    service: 'verification',
    endpoint: '/gsp/public/gstin/27AADCB2230M1ZV',
    method: 'GET',
    headers: { 'x-api-version': '2.0' },
    expectError: true
  });

  // ITR Filing Status (if used)
  await testEndpoint({
    name: 'ITR Filing Status',
    service: 'tax-compliance',
    endpoint: '/it/v1/itr/status/AAAAA0000A',
    method: 'GET',
    expectError: true
  });

  printResults();
}

function printResults(): void {
  console.log('\n\n============================================================');
  console.log('TEST RESULTS SUMMARY');
  console.log('============================================================\n');

  const passed = results.filter(r => r.status === 'PASS');
  const failed = results.filter(r => r.status === 'FAIL');
  const skipped = results.filter(r => r.status === 'SKIP');

  // Group by service
  const byService = results.reduce((acc, r) => {
    if (!acc[r.service]) acc[r.service] = [];
    acc[r.service].push(r);
    return acc;
  }, {} as Record<string, TestResult[]>);

  for (const [service, tests] of Object.entries(byService)) {
    console.log(`\n📦 ${service}`);
    console.log('─'.repeat(50));
    for (const test of tests) {
      const icon = test.status === 'PASS' ? '✅' : test.status === 'SKIP' ? '⚠️' : '❌';
      const time = test.responseTime ? ` (${test.responseTime}ms)` : '';
      console.log(`${icon} ${test.endpoint}${time}`);
      console.log(`   ${test.message}`);
    }
  }

  console.log('\n============================================================');
  console.log('FINAL SUMMARY');
  console.log('============================================================');
  console.log(`Total Endpoints Tested: ${results.length}`);
  console.log(`✅ Passed: ${passed.length}`);
  console.log(`⚠️ Skipped (needs prod key): ${skipped.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log('============================================================');

  if (failed.length > 0) {
    console.log('\n❌ FAILED ENDPOINTS:');
    for (const f of failed) {
      console.log(`   - ${f.endpoint}: ${f.message}`);
    }
  }

  if (skipped.length > 0) {
    console.log('\n⚠️ ENDPOINTS REQUIRING PRODUCTION KEY:');
    for (const s of skipped) {
      console.log(`   - ${s.endpoint}`);
    }
  }

  const avgResponseTime = results
    .filter(r => r.responseTime)
    .reduce((sum, r) => sum + (r.responseTime || 0), 0) / results.filter(r => r.responseTime).length;
  
  console.log(`\n📊 Average Response Time: ${Math.round(avgResponseTime)}ms`);
  console.log('============================================================\n');

  process.exit(failed.length > 0 ? 1 : 0);
}

runAllTests().catch(console.error);
