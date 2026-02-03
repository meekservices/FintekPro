/**
 * Sandbox API Test Script
 * Tests authentication and basic API functionality
 */

import axios from 'axios';

const SANDBOX_BASE_URL = 'https://api.sandbox.co.in';
const SANDBOX_API_KEY = process.env.SANDBOX_API_KEY;
const SANDBOX_API_SECRET = process.env.SANDBOX_API_SECRET;

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL';
  message: string;
  data?: any;
}

const results: TestResult[] = [];

async function testAuthentication(): Promise<string | null> {
  console.log('\n🔐 Testing Sandbox API Authentication...');
  
  if (!SANDBOX_API_KEY || !SANDBOX_API_SECRET) {
    results.push({
      test: 'Authentication',
      status: 'FAIL',
      message: 'SANDBOX_API_KEY or SANDBOX_API_SECRET not configured'
    });
    return null;
  }

  try {
    const response = await axios.post(
      `${SANDBOX_BASE_URL}/authenticate`,
      {
        x_api_key: SANDBOX_API_KEY,
        x_api_secret: SANDBOX_API_SECRET,
      },
      {
        timeout: 15000
      }
    );

    if (response.data?.access_token) {
      results.push({
        test: 'Authentication',
        status: 'PASS',
        message: `Token obtained, expires in ${response.data.expires_in}s`,
        data: {
          token_type: response.data.token_type,
          expires_in: response.data.expires_in
        }
      });
      console.log('✅ Authentication successful');
      return response.data.access_token;
    } else {
      results.push({
        test: 'Authentication',
        status: 'FAIL',
        message: 'No access token in response',
        data: response.data
      });
      return null;
    }
  } catch (error: any) {
    const errMsg = error.response?.data?.message || error.message;
    results.push({
      test: 'Authentication',
      status: 'FAIL',
      message: errMsg,
      data: error.response?.data
    });
    console.log('❌ Authentication failed:', errMsg);
    return null;
  }
}

async function testPANVerification(token: string): Promise<void> {
  console.log('\n📋 Testing PAN Verification endpoint...');
  
  try {
    const response = await axios.post(
      `${SANDBOX_BASE_URL}/pans/AAAAA0000A/verify`,
      {},
      {
        headers: {
          Authorization: token,
          'x-api-key': SANDBOX_API_KEY,
          'x-api-version': '2.0'
        },
        timeout: 15000
      }
    );

    results.push({
      test: 'PAN Verification',
      status: 'PASS',
      message: 'Endpoint accessible',
      data: response.data
    });
    console.log('✅ PAN endpoint accessible');
  } catch (error: any) {
    const status = error.response?.status;
    const errMsg = error.response?.data?.message || error.message;
    
    if (status === 400 || status === 422) {
      results.push({
        test: 'PAN Verification',
        status: 'PASS',
        message: 'Endpoint accessible (validation error expected for test PAN)',
        data: { status, error: errMsg }
      });
      console.log('✅ PAN endpoint accessible (validation error expected for test data)');
    } else {
      results.push({
        test: 'PAN Verification',
        status: 'FAIL',
        message: errMsg,
        data: error.response?.data
      });
      console.log('❌ PAN verification failed:', errMsg);
    }
  }
}

async function testBankAccountVerification(token: string): Promise<void> {
  console.log('\n🏦 Testing Bank Account Verification endpoint...');
  
  try {
    const response = await axios.get(
      `${SANDBOX_BASE_URL}/bank/0000000000/ifsc/SBIN0000001/verify`,
      {
        headers: {
          Authorization: token,
          'x-api-key': SANDBOX_API_KEY,
          'x-api-version': '2.0'
        },
        timeout: 15000
      }
    );

    results.push({
      test: 'Bank Account Verification',
      status: 'PASS',
      message: 'Endpoint accessible',
      data: response.data
    });
    console.log('✅ Bank verification endpoint accessible');
  } catch (error: any) {
    const status = error.response?.status;
    const errMsg = error.response?.data?.message || error.message;
    
    if (status === 400 || status === 422 || status === 404) {
      results.push({
        test: 'Bank Account Verification',
        status: 'PASS',
        message: 'Endpoint accessible (validation error expected for test data)',
        data: { status, error: errMsg }
      });
      console.log('✅ Bank endpoint accessible (validation error expected for test data)');
    } else {
      results.push({
        test: 'Bank Account Verification',
        status: 'FAIL',
        message: errMsg,
        data: error.response?.data
      });
      console.log('❌ Bank verification failed:', errMsg);
    }
  }
}

async function testGSTINVerification(token: string): Promise<void> {
  console.log('\n🧾 Testing GSTIN Verification endpoint...');
  
  try {
    const response = await axios.get(
      `${SANDBOX_BASE_URL}/gsp/public/gstin/27AADCB2230M1ZV`,
      {
        headers: {
          Authorization: token,
          'x-api-key': SANDBOX_API_KEY,
          'x-api-version': '2.0'
        },
        timeout: 15000
      }
    );

    results.push({
      test: 'GSTIN Verification',
      status: 'PASS',
      message: 'Endpoint accessible',
      data: response.data
    });
    console.log('✅ GSTIN endpoint accessible');
  } catch (error: any) {
    const status = error.response?.status;
    const errMsg = error.response?.data?.message || error.message;
    
    if (status === 400 || status === 422 || status === 404) {
      results.push({
        test: 'GSTIN Verification',
        status: 'PASS',
        message: 'Endpoint accessible (validation error expected for test data)',
        data: { status, error: errMsg }
      });
      console.log('✅ GSTIN endpoint accessible (validation error expected for test data)');
    } else {
      results.push({
        test: 'GSTIN Verification',
        status: 'FAIL',
        message: errMsg,
        data: error.response?.data
      });
      console.log('❌ GSTIN verification failed:', errMsg);
    }
  }
}

async function main() {
  console.log('============================================================');
  console.log('Sandbox.co.in API Test Suite');
  console.log('============================================================');
  console.log(`API Key configured: ${SANDBOX_API_KEY ? 'YES' : 'NO'}`);
  console.log(`API Secret configured: ${SANDBOX_API_SECRET ? 'YES' : 'NO'}`);

  const token = await testAuthentication();
  
  if (token) {
    await testPANVerification(token);
    await testBankAccountVerification(token);
    await testGSTINVerification(token);
  }

  console.log('\n============================================================');
  console.log('Test Results Summary');
  console.log('============================================================');
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  
  for (const result of results) {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${result.test}: ${result.message}`);
  }
  
  console.log('\n------------------------------------------------------------');
  console.log(`Total: ${results.length} tests | Passed: ${passed} | Failed: ${failed}`);
  console.log('============================================================');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
