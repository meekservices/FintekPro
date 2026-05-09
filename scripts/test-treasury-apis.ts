import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

async function testCashfree() {
  const id = process.env.CASHFREE_CLIENT_ID || process.env.CASHFREE_APP_ID;
  const secret = process.env.CASHFREE_CLIENT_SECRET || process.env.CASHFREE_SECRET_KEY;
  
  if (!id || !secret) return 'Missing Credentials (CASHFREE_CLIENT_ID/APP_ID or CASHFREE_CLIENT_SECRET/SECRET_KEY)';

  try {
    const isProd = process.env.CASHFREE_ENVIRONMENT === 'production';
    const url = isProd
      ? 'https://payout-api.cashfree.com/payout/v1.2/authorize'
      : 'https://payout-gamma.cashfree.com/payout/v1.2/authorize';
      
    console.log(`[Test] Connecting to Cashfree (${isProd ? 'Production' : 'Sandbox'})...`);
    
    const resp = await axios.post(url, {}, {
      headers: { 
        'X-Client-Id': id, 
        'X-Client-Secret': secret,
        'Content-Type': 'application/json'
      }
    });
    
    return resp.status === 200 ? 'Success' : `Failed (Status: ${resp.status})`;
  } catch (e: any) {
    return `Error: ${e.response?.status || e.message}${e.response?.data?.message ? ' - ' + e.response.data.message : ''}`;
  }
}

async function main() {
  console.log('--- FintekPro Treasury API Connectivity Test (Cashfree Only) ---');
  console.log('Cashfree Connection:', await testCashfree());
  console.log('--------------------------------------------------------------');
}

main();
