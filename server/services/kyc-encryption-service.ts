import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const key = process.env.KYC_ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!key) {
    const isProduction = process.env.NODE_ENV === 'production' || process.env.KYC_ENVIRONMENT === 'production';
    if (isProduction) {
      throw new Error('FATAL: KYC_ENCRYPTION_KEY or SESSION_SECRET must be set in production. Aadhaar/PAN encryption requires a secure key.');
    }
    console.warn('⚠️ KYC Encryption: Using dev-only fallback key. Set KYC_ENCRYPTION_KEY for production.');
    return crypto.scryptSync('fintekpro-dev-only-key-not-for-prod', 'fintekpro-kyc-salt-v2', 32);
  }
  return crypto.scryptSync(key, 'fintekpro-kyc-salt-v2', 32);
}

class KycEncryptionService {
  private key: Buffer;

  constructor() {
    this.key = getEncryptionKey();
    console.log('✅ KYC Encryption Service initialized (AES-256-GCM)');
  }

  encryptAadhaar(aadhaarNumber: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    let encrypted = cipher.update(aadhaarNumber, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  decryptAadhaar(encryptedData: string): string {
    try {
      const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      throw new Error('Failed to decrypt Aadhaar data - key mismatch or corrupted data');
    }
  }

  maskAadhaar(aadhaarNumber: string): string {
    if (aadhaarNumber.length < 4) return '****';
    return 'XXXX-XXXX-' + aadhaarNumber.slice(-4);
  }

  tokenizePAN(panNumber: string): string {
    const hash = crypto.createHmac('sha256', this.key).update(panNumber.toUpperCase()).digest('hex');
    return `PAN_TKN_${hash.substring(0, 16)}`;
  }

  verifyPANToken(panNumber: string, token: string): boolean {
    return this.tokenizePAN(panNumber) === token;
  }

  hashForAudit(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  generateRecordingHash(data: Buffer | string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  generateChecksum(data: string | Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

export const kycEncryptionService = new KycEncryptionService();
