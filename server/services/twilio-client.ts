import twilio from 'twilio';
import { fetchWithTimeout } from '../utils/fetch-with-timeout';

let connectionSettings: any;
let cachedClient: any = null;
let cachedPhoneNumber: string | null = null;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetchWithTimeout(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=twilio',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      },
      timeoutMs: 10_000,
    }
  ).then(res => res.json()).then((data: any) => data.items?.[0]);

  if (!connectionSettings || !connectionSettings.settings.account_sid) {
    throw new Error('Twilio not connected');
  }
  
  const settings = connectionSettings.settings;
  return {
    accountSid: settings.account_sid,
    apiKey: settings.api_key,
    apiKeySecret: settings.api_key_secret,
    phoneNumber: settings.phone_number
  };
}

export async function getTwilioClient() {
  if (cachedClient) {
    return cachedClient;
  }
  const { accountSid, apiKey, apiKeySecret } = await getCredentials();
  
  // Handle different authentication modes:
  // 1. API Key auth (apiKey != accountSid): use apiKey + apiKeySecret
  // 2. Account SID auth (apiKey == accountSid): use accountSid + apiKeySecret as auth token
  if (apiKey && apiKey !== accountSid && apiKeySecret) {
    cachedClient = twilio(apiKey, apiKeySecret, {
      accountSid: accountSid
    });
  } else {
    // Direct account credentials
    cachedClient = twilio(accountSid, apiKeySecret);
  }
  
  console.log('✅ Twilio client initialized via Replit connector');
  return cachedClient;
}

export async function getTwilioFromPhoneNumber() {
  if (cachedPhoneNumber) {
    return cachedPhoneNumber;
  }
  const { phoneNumber } = await getCredentials();
  cachedPhoneNumber = phoneNumber;
  return phoneNumber;
}

export async function isTwilioConfigured(): Promise<boolean> {
  try {
    await getCredentials();
    return true;
  } catch {
    return false;
  }
}
