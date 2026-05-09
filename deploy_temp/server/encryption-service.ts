import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

export class DecryptionError extends Error {
  constructor(message: string, public readonly originalError?: any) {
    super(message);
    this.name = 'DecryptionError';
  }
}

class EncryptionService {
  private masterKey: string;

  constructor() {
    this.masterKey = process.env.ENCRYPTION_MASTER_KEY || '';
    
    if (!this.masterKey) {
      console.error('❌ CRITICAL: ENCRYPTION_MASTER_KEY is not set. PII encryption is MANDATORY for production.');
      throw new Error('ENCRYPTION_MASTER_KEY environment variable is required for PII encryption');
    }
  }

  private deriveKey(salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(this.masterKey, salt, ITERATIONS, KEY_LENGTH, 'sha256');
  }

  encrypt(text: string | null | undefined): string | null {
    if (!text || text.trim() === '') {
      return null;
    }

    try {
      const salt = crypto.randomBytes(SALT_LENGTH);
      const key = this.deriveKey(salt);
      const iv = crypto.randomBytes(IV_LENGTH);
      
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      const result = Buffer.concat([
        salt,
        iv,
        authTag,
        Buffer.from(encrypted, 'hex')
      ]);
      
      return result.toString('base64');
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  decrypt(encryptedData: string | null | undefined): string | null {
    if (!encryptedData || encryptedData.trim() === '') {
      return null;
    }

    try {
      const buffer = Buffer.from(encryptedData, 'base64');
      
      const salt = buffer.slice(0, SALT_LENGTH);
      const iv = buffer.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
      const authTag = buffer.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
      const encrypted = buffer.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
      
      const key = this.deriveKey(salt);
      
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error: any) {
      console.error('Decryption error details:', error.message);
      // Use DecryptionError to allow callers to specifically handle this case
      throw new DecryptionError('Failed to decrypt data - potentially invalid key or corrupted data', error);
    }
  }

  encryptPII(data: {
    pan?: string | null;
    aadhaar?: string | null;
    passport?: string | null;
    drivingLicense?: string | null;
    voterId?: string | null;
    bankAccount?: string | null;
  }): {
    pan?: string | null;
    aadhaar?: string | null;
    passport?: string | null;
    drivingLicense?: string | null;
    voterId?: string | null;
    bankAccount?: string | null;
  } {
    return {
      pan: data.pan ? this.encrypt(data.pan) : null,
      aadhaar: data.aadhaar ? this.encrypt(data.aadhaar) : null,
      passport: data.passport ? this.encrypt(data.passport) : null,
      drivingLicense: data.drivingLicense ? this.encrypt(data.drivingLicense) : null,
      voterId: data.voterId ? this.encrypt(data.voterId) : null,
      bankAccount: data.bankAccount ? this.encrypt(data.bankAccount) : null,
    };
  }

  decryptPII(data: {
    pan?: string | null;
    aadhaar?: string | null;
    passport?: string | null;
    drivingLicense?: string | null;
    voterId?: string | null;
    bankAccount?: string | null;
  }): {
    pan?: string | null;
    aadhaar?: string | null;
    passport?: string | null;
    drivingLicense?: string | null;
    voterId?: string | null;
    bankAccount?: string | null;
  } {
    return {
      pan: data.pan ? this.decrypt(data.pan) : null,
      aadhaar: data.aadhaar ? this.decrypt(data.aadhaar) : null,
      passport: data.passport ? this.decrypt(data.passport) : null,
      drivingLicense: data.drivingLicense ? this.decrypt(data.drivingLicense) : null,
      voterId: data.voterId ? this.decrypt(data.voterId) : null,
      bankAccount: data.bankAccount ? this.decrypt(data.bankAccount) : null,
    };
  }

  hash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  hashForSearch(text: string): string {
    return crypto.createHash('sha256').update(text.toLowerCase().trim()).digest('hex');
  }
}

export const encryptionService = new EncryptionService();
