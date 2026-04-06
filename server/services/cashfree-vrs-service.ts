/**
 * Cashfree VRS (Verification & Risk Suite) — Secure ID Service
 *
 * Covers all Cashfree Secure ID product APIs:
 *   • Identity Documents  — PAN Lite, PAN 360, Driving License, Voter ID, Passport, Udyam
 *   • Business           — GSTIN verification
 *   • Banking            — Bank Account V2 (sync), IFSC, Reverse Penny Drop, UPI Penny Drop
 *   • Biometric / Face   — Face Liveness, Face Match, Name Match
 *
 * Credentials: CASHFREE_SECUREID_APP_ID / CASHFREE_SECUREID_SECRET_KEY
 * Docs: https://www.cashfree.com/docs/api-reference/vrs/overview
 */

import {
  getCashfreeSecureIDAppId,
  getCashfreeSecureIDSecretKey,
  getCashfreeSecureIDBaseUrl,
  hasCashfreeSecureIDCredentials,
} from '../utils/cashfree-config';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface VRSHeaders {
  'Content-Type': string;
  'x-client-id': string;
  'x-client-secret': string;
  'x-api-version'?: string;
}

export interface VRSResponse<T = Record<string, unknown>> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

// ─── Base helper ────────────────────────────────────────────────────────────

function getBaseUrl(): string {
  return getCashfreeSecureIDBaseUrl();
}

function getHeaders(apiVersion?: string): VRSHeaders {
  const headers: VRSHeaders = {
    'Content-Type': 'application/json',
    'x-client-id': getCashfreeSecureIDAppId(),
    'x-client-secret': getCashfreeSecureIDSecretKey(),
  };
  if (apiVersion) headers['x-api-version'] = apiVersion;
  return headers;
}

async function vrsPost<T>(
  path: string,
  body: Record<string, unknown>,
  apiVersion?: string
): Promise<VRSResponse<T>> {
  if (!hasCashfreeSecureIDCredentials()) {
    return { success: false, error: 'Cashfree Secure ID credentials not configured (CASHFREE_SECUREID_APP_ID / CASHFREE_SECUREID_SECRET_KEY)' };
  }
  try {
    const res = await fetch(`${getBaseUrl()}${path}`, {
      method: 'POST',
      headers: getHeaders(apiVersion) as Record<string, string>,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.message || data.error || `HTTP ${res.status}`, statusCode: res.status, data };
    }
    return { success: true, data, statusCode: res.status };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

function generateVerificationId(prefix = 'vrs'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1 — IDENTITY DOCUMENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * PAN Lite — verify PAN with optional name + DOB match
 * POST /verification/pan-lite
 * Returns: pan_status, name_match, dob_match, aadhaar_seeding_status
 */
export async function verifyPANLite(params: {
  pan: string;
  name?: string;
  dob?: string;
  verificationId?: string;
}): Promise<VRSResponse> {
  const body: Record<string, unknown> = {
    verification_id: params.verificationId || generateVerificationId('pan'),
    pan: params.pan.toUpperCase(),
  };
  if (params.name) body.name = params.name;
  if (params.dob) body.dob = params.dob;
  return vrsPost('/pan-lite', body);
}

/**
 * PAN 360 — comprehensive PAN with full profile data
 * POST /verification/pan-360
 */
export async function verifyPAN360(params: {
  pan: string;
  name?: string;
  verificationId?: string;
}): Promise<VRSResponse> {
  return vrsPost('/pan-360', {
    verification_id: params.verificationId || generateVerificationId('pan360'),
    pan: params.pan.toUpperCase(),
    ...(params.name && { name: params.name }),
  });
}

/**
 * Driving License verification
 * POST /verification/driving-license
 * Returns: holder name, type, issue date, expiry date, validity status
 */
export async function verifyDrivingLicense(params: {
  dlNumber: string;
  dob: string;
  name?: string;
  verificationId?: string;
}): Promise<VRSResponse> {
  const body: Record<string, unknown> = {
    verification_id: params.verificationId || generateVerificationId('dl'),
    dl_number: params.dlNumber,
    dob: params.dob,
  };
  if (params.name) body.name = params.name;
  return vrsPost('/driving-license', body);
}

/**
 * Voter ID (EPIC) verification
 * POST /verification/voter-id
 * Returns: name, DOB, gender, address, constituency
 */
export async function verifyVoterId(params: {
  epicNumber: string;
  name?: string;
  verificationId?: string;
}): Promise<VRSResponse> {
  const body: Record<string, unknown> = {
    verification_id: params.verificationId || generateVerificationId('vid'),
    epic_number: params.epicNumber,
  };
  if (params.name) body.name = params.name;
  return vrsPost('/voter-id', body);
}

/**
 * Passport verification
 * POST /verification/passport
 * Returns: holder name, nationality, type, validity dates
 */
export async function verifyPassport(params: {
  fileNumber: string;
  name: string;
  dob: string;
  verificationId?: string;
}): Promise<VRSResponse> {
  return vrsPost('/passport', {
    verification_id: params.verificationId || generateVerificationId('pp'),
    file_number: params.fileNumber,
    name: params.name,
    dob: params.dob,
  });
}

/**
 * Udyam (MSME) registration verification
 * POST /verification/udyam
 */
export async function verifyUdyam(params: {
  udyamNumber: string;
  verificationId?: string;
}): Promise<VRSResponse> {
  return vrsPost('/udyam', {
    verification_id: params.verificationId || generateVerificationId('udyam'),
    udyam: params.udyamNumber,
  });
}

/**
 * PAN to Udyam — fetch Udyam details using PAN
 * POST /verification/pan-to-udyam
 */
export async function fetchUdyamByPAN(params: {
  pan: string;
  verificationId?: string;
}): Promise<VRSResponse> {
  return vrsPost('/pan-to-udyam', {
    verification_id: params.verificationId || generateVerificationId('pan2udyam'),
    pan: params.pan.toUpperCase(),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2 — BUSINESS / GSTIN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GSTIN verification — KYB (Know Your Business)
 * POST /verification/gstin
 * Returns: business name, registration date, status, filing history
 */
export async function verifyGSTIN(params: {
  gstin: string;
  businessName?: string;
}): Promise<VRSResponse> {
  const body: Record<string, unknown> = { GSTIN: params.gstin.toUpperCase() };
  if (params.businessName) body.business_name = params.businessName;
  return vrsPost('/gstin', body);
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3 — BANKING VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Bank Account Verification V2 — synchronous penny drop
 * POST /verification/bank-account/sync
 * Returns: account holder name, account validity, name match score
 */
export async function verifyBankAccountV2(params: {
  bankAccount: string;
  ifsc: string;
  name?: string;
  phoneNumber?: string;
  verificationId?: string;
}): Promise<VRSResponse> {
  const body: Record<string, unknown> = {
    bank_account: params.bankAccount,
    ifsc: params.ifsc.toUpperCase(),
  };
  if (params.name) body.name = params.name;
  if (params.phoneNumber) body.phone_number = params.phoneNumber;
  if (params.verificationId) body.verification_id = params.verificationId;
  return vrsPost('/bank-account/sync', body);
}

/**
 * IFSC Code verification
 * POST /verification/ifsc
 * Returns: bank name, branch, NEFT/IMPS/RTGS status, address
 */
export async function verifyIFSC(params: {
  ifsc: string;
  verificationId?: string;
}): Promise<VRSResponse> {
  return vrsPost('/ifsc', {
    verification_id: params.verificationId || generateVerificationId('ifsc'),
    ifsc: params.ifsc.toUpperCase(),
  });
}

/**
 * Reverse Penny Drop — UPI-based bank account verification (customer pays ₹1 to verify)
 * POST /verification/reverse-penny-drop
 * Returns: UPI link for customer to complete the ₹1 payment
 */
export async function createReversePennyDrop(params: {
  name: string;
  verificationId?: string;
}): Promise<VRSResponse> {
  return vrsPost('/reverse-penny-drop', {
    verification_id: params.verificationId || generateVerificationId('rpd'),
    name: params.name,
  });
}

/**
 * UPI Penny Drop — verify VPA (UPI address) and retrieve account holder name
 * POST /verification/upi/penny-drop
 * Requires API version 2024-12-01
 */
export async function verifyUPIPennyDrop(params: {
  vpa: string;
  name?: string;
  userConsentTimestamp?: string;
  verificationId?: string;
}): Promise<VRSResponse> {
  return vrsPost('/upi/penny-drop', {
    verification_id: params.verificationId || generateVerificationId('upd'),
    vpa: params.vpa,
    ...(params.name && { name: params.name }),
    user_consent: {
      obtained: true,
      type: 'EXPLICIT',
      timestamp: params.userConsentTimestamp || new Date().toISOString(),
      purpose: 'Bank account verification via UPI penny drop',
    },
  }, '2024-12-01');
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4 — BIOMETRIC / FACE / NAME MATCHING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Face Liveness — detect spoofing, check if face is real
 * POST /verification/face-liveness (multipart/form-data)
 * Requires API version 2024-12-01
 * Returns: liveness boolean, liveness_score
 */
export async function checkFaceLiveness(params: {
  imageBase64: string;
  verificationId?: string;
}): Promise<VRSResponse> {
  if (!hasCashfreeSecureIDCredentials()) {
    return { success: false, error: 'Cashfree Secure ID credentials not configured' };
  }
  try {
    const formData = new FormData();
    formData.append('verification_id', params.verificationId || generateVerificationId('fl'));
    const imageBuffer = Buffer.from(params.imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
    formData.append('image', blob, 'face.jpg');

    const res = await fetch(`${getBaseUrl()}/face-liveness`, {
      method: 'POST',
      headers: {
        'x-client-id': getCashfreeSecureIDAppId(),
        'x-client-secret': getCashfreeSecureIDSecretKey(),
        'x-api-version': '2024-12-01',
      },
      body: formData,
    });
    const data = await res.json();
    return res.ok
      ? { success: true, data, statusCode: res.status }
      : { success: false, error: data.message || `HTTP ${res.status}`, statusCode: res.status, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Face Match — compare two face images
 * POST /verification/face-match (multipart/form-data)
 */
export async function matchFaces(params: {
  image1Base64: string;
  image2Base64: string;
  verificationId?: string;
}): Promise<VRSResponse> {
  if (!hasCashfreeSecureIDCredentials()) {
    return { success: false, error: 'Cashfree Secure ID credentials not configured' };
  }
  try {
    const formData = new FormData();
    formData.append('verification_id', params.verificationId || generateVerificationId('fm'));
    const toBlob = (b64: string) => {
      const buf = Buffer.from(b64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      return new Blob([buf], { type: 'image/jpeg' });
    };
    formData.append('image1', toBlob(params.image1Base64), 'image1.jpg');
    formData.append('image2', toBlob(params.image2Base64), 'image2.jpg');

    const res = await fetch(`${getBaseUrl()}/face-match`, {
      method: 'POST',
      headers: {
        'x-client-id': getCashfreeSecureIDAppId(),
        'x-client-secret': getCashfreeSecureIDSecretKey(),
        'x-api-version': '2024-12-01',
      },
      body: formData,
    });
    const data = await res.json();
    return res.ok
      ? { success: true, data, statusCode: res.status }
      : { success: false, error: data.message || `HTTP ${res.status}`, statusCode: res.status, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Name Match — fuzzy/variation-aware name matching
 * POST /verification/name-match
 * Returns: match boolean, match_score
 */
export async function matchNames(params: {
  name1: string;
  name2: string;
  verificationId?: string;
}): Promise<VRSResponse> {
  return vrsPost('/name-match', {
    verification_id: params.verificationId || generateVerificationId('nm'),
    name_1: params.name1,
    name_2: params.name2,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5 — SERVICE STATUS
// ═══════════════════════════════════════════════════════════════════════════

export interface VRSServiceStatus {
  configured: boolean;
  environment: string;
  baseUrl: string;
  availableAPIs: string[];
}

export function getVRSServiceStatus(): VRSServiceStatus {
  return {
    configured: hasCashfreeSecureIDCredentials(),
    environment: getCashfreeSecureIDBaseUrl().includes('sandbox') ? 'SANDBOX' : 'PRODUCTION',
    baseUrl: getCashfreeSecureIDBaseUrl(),
    availableAPIs: [
      'PAN Lite', 'PAN 360', 'Driving License', 'Voter ID', 'Passport', 'Udyam', 'PAN-to-Udyam',
      'GSTIN', 'Bank Account V2 (Sync)', 'IFSC', 'Reverse Penny Drop', 'UPI Penny Drop',
      'Face Liveness', 'Face Match', 'Name Match',
    ],
  };
}
