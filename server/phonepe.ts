import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

// PhonePe Configuration
const PHONEPE_CONFIG = {
  merchantId: process.env.PHONEPE_MERCHANT_ID || '',
  saltKey: process.env.PHONEPE_SALT_KEY || '',
  saltIndex: process.env.PHONEPE_SALT_INDEX || '1',
  baseUrl: process.env.NODE_ENV === 'production' 
    ? 'https://api.phonepe.com/apis/hermes/pg/v1'
    : 'https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1',
  statusUrl: process.env.NODE_ENV === 'production'
    ? 'https://api.phonepe.com/apis/hermes/pg/v1/status'
    : 'https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/status',
};

/**
 * Generate SHA256 checksum for PhonePe API requests
 * Format: base64Payload + endpoint + saltKey -> SHA256 -> checksum###saltIndex
 */
export function generateChecksum(payload: string, endpoint: string): string {
  const stringToHash = payload + endpoint + PHONEPE_CONFIG.saltKey;
  const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
  return `${sha256}###${PHONEPE_CONFIG.saltIndex}`;
}

/**
 * Generate unique transaction ID
 */
export function generateTransactionId(): string {
  const timestamp = Date.now();
  const uniqueId = uuidv4().split('-')[0];
  return `TXN_${timestamp}_${uniqueId}`;
}

/**
 * Payment Initiation Data
 */
export interface PaymentInitiationData {
  amount: number; // Amount in rupees
  userId: string;
  userName?: string;
  userEmail?: string;
  userMobile?: string;
  cartId?: string;
  itemType?: string; // 'mutual_fund', 'product', 'proposal'
  itemId?: string;
  redirectUrl?: string;
  callbackUrl?: string;
}

/**
 * PhonePe Payment Response
 */
export interface PhonePePaymentResponse {
  success: boolean;
  code: string;
  message: string;
  data?: {
    merchantId: string;
    merchantTransactionId: string;
    instrumentResponse?: {
      type: string;
      redirectInfo?: {
        url: string;
        method: string;
      };
    };
  };
}

/**
 * Initiate PhonePe payment
 */
export async function initiatePayment(data: PaymentInitiationData): Promise<{
  success: boolean;
  transactionId: string;
  paymentUrl?: string;
  message?: string;
  error?: string;
}> {
  try {
    const merchantTransactionId = generateTransactionId();
    const amountInPaise = Math.round(data.amount * 100);

    // Default redirect URL (frontend will handle this)
    const redirectUrl = data.redirectUrl || `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000'}/payment/status/${merchantTransactionId}`;
    const callbackUrl = data.callbackUrl || `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000'}/api/phonepe/callback`;

    // Payment payload according to PhonePe API
    const paymentData = {
      merchantId: PHONEPE_CONFIG.merchantId,
      merchantTransactionId: merchantTransactionId,
      merchantUserId: data.userId,
      amount: amountInPaise,
      redirectUrl: redirectUrl,
      redirectMode: 'POST',
      callbackUrl: callbackUrl,
      mobileNumber: data.userMobile || '',
      paymentInstrument: {
        type: 'PAY_PAGE' // PhonePe will show all payment options
      }
    };

    // Encode payload to base64
    const payloadBase64 = Buffer.from(JSON.stringify(paymentData)).toString('base64');

    // Generate checksum
    const checksum = generateChecksum(payloadBase64, '/pg/v1/pay');

    // Make API request to PhonePe
    const response = await axios.post<PhonePePaymentResponse>(
      `${PHONEPE_CONFIG.baseUrl}/pay`,
      {
        request: payloadBase64
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': checksum
        }
      }
    );

    if (response.data.success && response.data.data?.instrumentResponse?.redirectInfo?.url) {
      return {
        success: true,
        transactionId: merchantTransactionId,
        paymentUrl: response.data.data.instrumentResponse.redirectInfo.url,
        message: 'Payment initiated successfully'
      };
    } else {
      return {
        success: false,
        transactionId: merchantTransactionId,
        message: response.data.message || 'Payment initiation failed',
        error: response.data.code
      };
    }
  } catch (error: any) {
    console.error('PhonePe Payment Initiation Error:', error.response?.data || error.message);
    return {
      success: false,
      transactionId: '',
      message: 'Payment initiation failed',
      error: error.message
    };
  }
}

/**
 * PhonePe Status Response
 */
export interface PhonePeStatusResponse {
  success: boolean;
  code: string;
  message: string;
  data?: {
    merchantId: string;
    merchantTransactionId: string;
    transactionId: string;
    amount: number;
    state: string; // COMPLETED, FAILED, PENDING
    responseCode: string;
    paymentInstrument?: {
      type: string;
      cardType?: string;
      utr?: string;
    };
  };
}

/**
 * Check payment status
 */
export async function checkPaymentStatus(merchantTransactionId: string): Promise<{
  success: boolean;
  status: string;
  data?: any;
  error?: string;
}> {
  try {
    const endpoint = `/pg/v1/status/${PHONEPE_CONFIG.merchantId}/${merchantTransactionId}`;
    const checksum = generateChecksum('', endpoint);

    const response = await axios.get<PhonePeStatusResponse>(
      `${PHONEPE_CONFIG.statusUrl}/${PHONEPE_CONFIG.merchantId}/${merchantTransactionId}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': checksum,
          'X-MERCHANT-ID': PHONEPE_CONFIG.merchantId
        }
      }
    );

    if (response.data.success) {
      return {
        success: true,
        status: response.data.data?.state || 'UNKNOWN',
        data: response.data.data
      };
    } else {
      return {
        success: false,
        status: 'FAILED',
        error: response.data.message
      };
    }
  } catch (error: any) {
    console.error('PhonePe Status Check Error:', error.response?.data || error.message);
    return {
      success: false,
      status: 'ERROR',
      error: error.message
    };
  }
}

/**
 * Verify callback checksum
 */
export function verifyCallbackChecksum(base64Response: string, receivedChecksum: string): boolean {
  try {
    const [checksumHash, saltIndex] = receivedChecksum.split('###');
    const expectedChecksum = crypto
      .createHash('sha256')
      .update(base64Response + PHONEPE_CONFIG.saltKey)
      .digest('hex');
    
    return checksumHash === expectedChecksum && saltIndex === PHONEPE_CONFIG.saltIndex;
  } catch (error) {
    console.error('Checksum verification error:', error);
    return false;
  }
}

export default {
  generateChecksum,
  generateTransactionId,
  initiatePayment,
  checkPaymentStatus,
  verifyCallbackChecksum,
  PHONEPE_CONFIG
};
