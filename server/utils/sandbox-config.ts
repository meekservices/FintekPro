import axios from 'axios';

const SANDBOX_API_KEY = process.env.SANDBOX_API_KEY || '';
const SANDBOX_API_SECRET = process.env.SANDBOX_API_SECRET || '';

export function getSandboxBaseUrl(): string {
  if (process.env.SANDBOX_BASE_URL) return process.env.SANDBOX_BASE_URL;
  if (SANDBOX_API_KEY.startsWith('key_test')) return 'https://test-api.sandbox.co.in';
  if (SANDBOX_API_KEY.startsWith('key_live')) return 'https://api.sandbox.co.in';
  return 'https://api.sandbox.co.in';
}

export function getSandboxEnvironment(): 'TEST' | 'PRODUCTION' {
  return SANDBOX_API_KEY.startsWith('key_test') ? 'TEST' : 'PRODUCTION';
}

export function hasSandboxCredentials(): boolean {
  return !!(SANDBOX_API_KEY && SANDBOX_API_SECRET);
}

export function getSandboxApiKey(): string {
  return SANDBOX_API_KEY;
}

export function getSandboxApiSecret(): string {
  return SANDBOX_API_SECRET;
}

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

export async function getSandboxAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  if (!SANDBOX_API_KEY || !SANDBOX_API_SECRET) {
    throw new Error('Sandbox API credentials not configured (SANDBOX_API_KEY, SANDBOX_API_SECRET)');
  }

  const baseUrl = getSandboxBaseUrl();

  const response = await axios.post(
    `${baseUrl}/authenticate`,
    {},
    {
      headers: {
        'x-api-key': SANDBOX_API_KEY,
        'x-api-secret': SANDBOX_API_SECRET,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.data?.access_token) {
    throw new Error('Sandbox authentication succeeded but no access_token returned');
  }

  cachedToken = response.data.access_token;
  const expiresIn = response.data.expires_in || 86400;
  tokenExpiry = Date.now() + (expiresIn - 300) * 1000;

  return cachedToken!;
}

export function clearSandboxToken(): void {
  cachedToken = null;
  tokenExpiry = 0;
}

export function logSandboxInit(serviceName: string): void {
  const env = getSandboxEnvironment();
  const baseUrl = getSandboxBaseUrl();
  const hasCreds = hasSandboxCredentials();

  if (!hasCreds) {
    console.warn(`⚠️ [${serviceName}] Sandbox API credentials not configured`);
    return;
  }

  console.log(`✅ [${serviceName}] Initialized (${env} environment → ${baseUrl})`);
}
