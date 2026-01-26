/**
 * Field-Level Encryption Utility
 * AES-256-GCM encryption for sensitive data (PAN, Aadhaar, etc.)
 * 
 * Security Features:
 * - AES-256-GCM authenticated encryption
 * - Random IV for each encryption
 * - HMAC-based key derivation
 * - Secure key storage via environment variable
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits
const SALT_LENGTH = 16; // 128 bits

class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionError';
  }
}

/**
 * Derive encryption key from master key using PBKDF2
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(masterKey, salt, 100000, KEY_LENGTH, 'sha256');
}

/**
 * Get the master encryption key from environment
 */
function getMasterKey(): string {
  const key = process.env.FIELD_ENCRYPTION_KEY;
  
  if (!key) {
    // In development, use a default key (NOT FOR PRODUCTION)
    if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
      console.warn('⚠️ [ENCRYPTION] Using default encryption key. Set FIELD_ENCRYPTION_KEY in production!');
      return 'dev-encryption-key-do-not-use-in-prod-32chars';
    }
    throw new EncryptionError('FIELD_ENCRYPTION_KEY environment variable is not set');
  }
  
  if (key.length < 32) {
    throw new EncryptionError('FIELD_ENCRYPTION_KEY must be at least 32 characters');
  }
  
  return key;
}

/**
 * Encrypt a string value using AES-256-GCM
 * Returns base64 encoded string: salt:iv:authTag:ciphertext
 */
export function encrypt(plaintext: string): string {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new EncryptionError('Plaintext must be a non-empty string');
  }

  try {
    const masterKey = getMasterKey();
    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = deriveKey(masterKey, salt);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    const authTag = cipher.getAuthTag();
    
    // Combine salt, iv, authTag, and ciphertext
    const combined = Buffer.concat([salt, iv, authTag, encrypted]);
    
    return combined.toString('base64');
  } catch (error: any) {
    if (error instanceof EncryptionError) throw error;
    throw new EncryptionError(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypt a base64 encoded encrypted string
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData || typeof encryptedData !== 'string') {
    throw new EncryptionError('Encrypted data must be a non-empty string');
  }

  try {
    const masterKey = getMasterKey();
    const combined = Buffer.from(encryptedData, 'base64');
    
    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
    
    const key = deriveKey(masterKey, salt);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  } catch (error: any) {
    if (error instanceof EncryptionError) throw error;
    throw new EncryptionError(`Decryption failed: ${error.message}`);
  }
}

/**
 * Check if a string appears to be encrypted (base64 with correct length)
 */
export function isEncrypted(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  
  // Minimum length for encrypted data: salt(16) + iv(16) + authTag(16) + min 1 byte ciphertext = 49 bytes
  // Base64 encoding increases size by ~33%
  try {
    const decoded = Buffer.from(value, 'base64');
    return decoded.length >= SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH + 1;
  } catch {
    return false;
  }
}

/**
 * Encrypt PAN number with format preservation for display
 * Returns: { encrypted: string, maskedDisplay: string }
 */
export function encryptPAN(pan: string): { encrypted: string; maskedDisplay: string } {
  if (!pan || typeof pan !== 'string') {
    throw new EncryptionError('PAN must be a non-empty string');
  }
  
  // Validate PAN format (10 alphanumeric characters)
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
  const normalizedPAN = pan.toUpperCase().trim();
  
  if (!panRegex.test(normalizedPAN)) {
    throw new EncryptionError('Invalid PAN format');
  }
  
  return {
    encrypted: encrypt(normalizedPAN),
    maskedDisplay: `${normalizedPAN.substring(0, 4)}****${normalizedPAN.substring(8)}`
  };
}

/**
 * Decrypt and validate PAN number
 */
export function decryptPAN(encryptedPAN: string): string {
  const pan = decrypt(encryptedPAN);
  
  // Validate decrypted PAN format
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
  if (!panRegex.test(pan)) {
    throw new EncryptionError('Decrypted data is not a valid PAN');
  }
  
  return pan;
}

/**
 * Encrypt Aadhaar number with format preservation for display
 * Returns: { encrypted: string, maskedDisplay: string }
 */
export function encryptAadhaar(aadhaar: string): { encrypted: string; maskedDisplay: string } {
  if (!aadhaar || typeof aadhaar !== 'string') {
    throw new EncryptionError('Aadhaar must be a non-empty string');
  }
  
  // Remove spaces and validate (12 digits)
  const normalizedAadhaar = aadhaar.replace(/\s/g, '');
  const aadhaarRegex = /^\d{12}$/;
  
  if (!aadhaarRegex.test(normalizedAadhaar)) {
    throw new EncryptionError('Invalid Aadhaar format');
  }
  
  return {
    encrypted: encrypt(normalizedAadhaar),
    maskedDisplay: `****-****-${normalizedAadhaar.substring(8)}`
  };
}

/**
 * Decrypt and validate Aadhaar number
 */
export function decryptAadhaar(encryptedAadhaar: string): string {
  const aadhaar = decrypt(encryptedAadhaar);
  
  // Validate decrypted Aadhaar format
  const aadhaarRegex = /^\d{12}$/;
  if (!aadhaarRegex.test(aadhaar)) {
    throw new EncryptionError('Decrypted data is not a valid Aadhaar');
  }
  
  return aadhaar;
}

/**
 * Hash a value for comparison (one-way)
 * Useful for lookups without decryption
 */
export function hashForLookup(value: string): string {
  if (!value || typeof value !== 'string') {
    throw new EncryptionError('Value must be a non-empty string');
  }
  
  const masterKey = getMasterKey();
  return crypto
    .createHmac('sha256', masterKey)
    .update(value.toUpperCase().trim())
    .digest('hex');
}

/**
 * Verify a value against its hash
 */
export function verifyHash(value: string, hash: string): boolean {
  return hashForLookup(value) === hash;
}

// Export the encryption error class
export { EncryptionError };
