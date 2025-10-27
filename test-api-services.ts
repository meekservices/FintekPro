/**
 * API Services Health Check Script
 * Tests Sandbox.co.in PAN verification and Cashfree OKYC Aadhaar verification
 */

import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

interface TestResult {
  service: string;
  status: 'OPERATIONAL' | 'FAILED' | 'NOT_CONFIGURED';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

// Test 1: Sandbox.co.in PAN Verification
async function testSandboxPAN(): Promise<TestResult> {
  const serviceName = 'Sandbox.co.in PAN Verification';
  
  try {
    const apiKey = process.env.SANDBOX_API_KEY;
    const apiSecret = process.env.SANDBOX_API_SECRET;
    
    if (!apiKey || !apiSecret) {
      return {
        service: serviceName,
        status: 'NOT_CONFIGURED',
        message: 'Missing SANDBOX_API_KEY or SANDBOX_API_SECRET environment variables'
      };
    }
    
    console.log('\n🔍 Testing Sandbox.co.in Authentication...');
    
    // Step 1: Authenticate
    const authResponse = await axios.post(
      'https://api.sandbox.co.in/authenticate',
      {
        x_api_key: apiKey,
        x_api_secret: apiSecret
      },
      { timeout: 10000 }
    );
    
    if (!authResponse.data.access_token) {
      throw new Error('No access token received');
    }
    
    const token = authResponse.data.access_token;
    console.log('✅ Authentication successful');
    console.log(`   Token expires in: ${authResponse.data.expires_in} seconds`);
    
    // Step 2: Test PAN verification with test data
    console.log('\n🔍 Testing PAN Verification endpoint...');
    
    // Using test PAN data (will likely fail verification but tests API connectivity)
    const panResponse = await axios.post(
      'https://api.sandbox.co.in/pans/verify',
      {
        pan: 'ABCDE1234F',
        name: 'Test User',
        dob: '1990-01-01'
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000,
        validateStatus: (status) => status < 500 // Accept 4xx as valid response
      }
    );
    
    console.log(`   API Response Code: ${panResponse.data.code || panResponse.status}`);
    console.log(`   API Message: ${panResponse.data.message || 'Success'}`);
    
    return {
      service: serviceName,
      status: 'OPERATIONAL',
      message: 'API is responding correctly. Authentication and endpoint connectivity verified.',
      details: {
        authenticated: true,
        tokenExpiry: authResponse.data.expires_in,
        apiEndpointReachable: true,
        responseCode: panResponse.data.code || panResponse.status
      }
    };
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    
    if (error.response) {
      return {
        service: serviceName,
        status: 'FAILED',
        message: `API Error: ${error.response.data?.message || error.message}`,
        details: {
          statusCode: error.response.status,
          errorData: error.response.data
        }
      };
    }
    
    if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return {
        service: serviceName,
        status: 'FAILED',
        message: 'Network error: Cannot reach Sandbox.co.in API. Check internet connection.',
        details: { errorCode: error.code }
      };
    }
    
    return {
      service: serviceName,
      status: 'FAILED',
      message: error.message,
      details: { error: error.toString() }
    };
  }
}

// Test 2: Cashfree OKYC Aadhaar Verification
async function testCashfreeOKYC(): Promise<TestResult> {
  const serviceName = 'Cashfree OKYC Aadhaar Verification';
  
  try {
    const appId = process.env.CASHFREE_APP_ID;
    const secretKey = process.env.CASHFREE_SECRET_KEY;
    const environment = process.env.CASHFREE_ENVIRONMENT || 'SANDBOX';
    
    if (!appId || !secretKey) {
      return {
        service: serviceName,
        status: 'NOT_CONFIGURED',
        message: 'Missing CASHFREE_APP_ID or CASHFREE_SECRET_KEY environment variables'
      };
    }
    
    const baseUrl = environment === 'PRODUCTION' 
      ? 'https://api.cashfree.com/verification'
      : 'https://sandbox.cashfree.com/verification';
    
    console.log(`\n🔍 Testing Cashfree OKYC (${environment} mode)...`);
    console.log(`   Base URL: ${baseUrl}`);
    
    // Test with invalid Aadhaar to verify API connectivity (should return error but proves connection works)
    const response = await axios.post(
      `${baseUrl}/offline-aadhaar/otp`,
      { aadhaar_number: '123456789012' }, // Test number
      {
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': appId,
          'x-client-secret': secretKey
        },
        timeout: 10000,
        validateStatus: (status) => status < 500 // Accept 4xx as valid response
      }
    );
    
    console.log(`   API Response Status: ${response.status}`);
    console.log(`   API Response: ${JSON.stringify(response.data).substring(0, 200)}`);
    
    // If we get a response (even error), API is reachable
    return {
      service: serviceName,
      status: 'OPERATIONAL',
      message: 'API is responding. Endpoint connectivity verified.',
      details: {
        environment,
        baseUrl,
        apiReachable: true,
        responseStatus: response.status,
        credentialsValid: response.status !== 401
      }
    };
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    
    if (error.response?.status === 401) {
      return {
        service: serviceName,
        status: 'FAILED',
        message: 'Authentication failed. Invalid CASHFREE_APP_ID or CASHFREE_SECRET_KEY.',
        details: {
          statusCode: 401,
          action: 'Verify credentials in Cashfree dashboard'
        }
      };
    }
    
    if (error.response) {
      return {
        service: serviceName,
        status: 'OPERATIONAL',
        message: 'API is reachable but returned an error (this is expected with test data)',
        details: {
          statusCode: error.response.status,
          errorMessage: error.response.data?.message || 'Unknown error'
        }
      };
    }
    
    if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return {
        service: serviceName,
        status: 'FAILED',
        message: 'Network error: Cannot reach Cashfree API. Check internet connection.',
        details: { errorCode: error.code }
      };
    }
    
    return {
      service: serviceName,
      status: 'FAILED',
      message: error.message,
      details: { error: error.toString() }
    };
  }
}

// Main test runner
async function runTests() {
  console.log('════════════════════════════════════════════════════════════');
  console.log('   API SERVICES HEALTH CHECK');
  console.log('════════════════════════════════════════════════════════════');
  
  // Run tests
  results.push(await testSandboxPAN());
  results.push(await testCashfreeOKYC());
  
  // Print summary
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('   TEST RESULTS SUMMARY');
  console.log('════════════════════════════════════════════════════════════\n');
  
  results.forEach((result, index) => {
    const statusIcon = result.status === 'OPERATIONAL' ? '✅' 
                     : result.status === 'FAILED' ? '❌' 
                     : '⚠️';
    
    console.log(`${index + 1}. ${statusIcon} ${result.service}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Message: ${result.message}`);
    
    if (result.details) {
      console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
    }
    console.log('');
  });
  
  // Overall status
  const allOperational = results.every(r => r.status === 'OPERATIONAL');
  const anyFailed = results.some(r => r.status === 'FAILED');
  
  console.log('════════════════════════════════════════════════════════════');
  if (allOperational) {
    console.log('✅ ALL SERVICES OPERATIONAL');
  } else if (anyFailed) {
    console.log('❌ SOME SERVICES FAILED - CHECK CONFIGURATION');
  } else {
    console.log('⚠️  SOME SERVICES NOT CONFIGURED');
  }
  console.log('════════════════════════════════════════════════════════════\n');
}

// Run the tests
runTests().catch(console.error);
