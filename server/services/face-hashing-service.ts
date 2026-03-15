/**
 * Face Image Hashing Service
 * 
 * Hashes face images from OKYC for liveness check reuse without storing biometric data.
 * Uses SHA-256 for one-way hashing - cannot reverse to get original image.
 * 
 * Use cases:
 * - Compare face images from different verification attempts
 * - Detect duplicate KYC attempts
 * - Liveness check reuse without storing actual photos
 * 
 * Compliance:
 * - No biometric data storage (GDPR/DPDPA compliant)
 * - One-way hash prevents reconstruction
 * - Only hash comparison, not image recognition
 */

import crypto from 'crypto';
import { fetchWithTimeout } from '../utils/fetch-with-timeout';

interface HashResult {
  success: boolean;
  hash?: string;
  algorithm?: string;
  error?: string;
}

interface ComparisonResult {
  matches: boolean;
  confidence: number; // 0-100%
}

class FaceHashingService {
  private readonly ALGORITHM = 'SHA-256';
  
  /**
   * Hash a face image (base64 or buffer)
   * Returns a unique hash that can be compared later
   */
  hashFaceImage(imageData: string | Buffer): HashResult {
    try {
      if (!imageData) {
        return {
          success: false,
          error: 'No image data provided'
        };
      }

      // Convert base64 string to buffer if needed
      let buffer: Buffer;
      
      if (typeof imageData === 'string') {
        // Remove data:image prefix if present
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        buffer = imageData;
      }

      // Create SHA-256 hash
      const hash = crypto
        .createHash('sha256')
        .update(buffer)
        .digest('hex');

      return {
        success: true,
        hash,
        algorithm: this.ALGORITHM
      };
    } catch (error: any) {
      console.error('Face image hashing error:', error);
      return {
        success: false,
        error: error.message || 'Failed to hash face image'
      };
    }
  }

  /**
   * Hash a face image URL by downloading and hashing it
   * Useful when OKYC returns a photo URL instead of base64
   */
  async hashFaceImageFromUrl(imageUrl: string): Promise<HashResult> {
    try {
      if (!imageUrl) {
        return {
          success: false,
          error: 'No image URL provided'
        };
      }

      // Download image
      const response = await fetchWithTimeout(imageUrl, { timeoutMs: 15_000 });
      
      if (!response.ok) {
        return {
          success: false,
          error: `Failed to download image: ${response.statusText}`
        };
      }

      // Get image as buffer
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Hash the buffer
      return this.hashFaceImage(buffer);
    } catch (error: any) {
      console.error('Face image URL hashing error:', error);
      return {
        success: false,
        error: error.message || 'Failed to hash face image from URL'
      };
    }
  }

  /**
   * Compare two face image hashes
   * Returns exact match or confidence percentage
   */
  compareHashes(hash1: string, hash2: string): ComparisonResult {
    try {
      if (!hash1 || !hash2) {
        return { matches: false, confidence: 0 };
      }

      // Exact hash comparison
      const matches = hash1.toLowerCase() === hash2.toLowerCase();

      return {
        matches,
        confidence: matches ? 100 : 0
      };
    } catch (error) {
      console.error('Hash comparison error:', error);
      return { matches: false, confidence: 0 };
    }
  }

  /**
   * Verify if a face image matches a stored hash
   * Useful for liveness check reuse
   */
  async verifyFaceImage(
    newImageData: string | Buffer,
    storedHash: string
  ): Promise<ComparisonResult> {
    const hashResult = this.hashFaceImage(newImageData);
    
    if (!hashResult.success || !hashResult.hash) {
      return { matches: false, confidence: 0 };
    }

    return this.compareHashes(hashResult.hash, storedHash);
  }

  /**
   * Generate a unique fingerprint for a face image
   * Combines hash with metadata for enhanced uniqueness
   */
  generateFingerprint(
    imageData: string | Buffer,
    metadata?: {
      timestamp?: number;
      userId?: string;
      source?: string;
    }
  ): HashResult {
    try {
      const hashResult = this.hashFaceImage(imageData);
      
      if (!hashResult.success || !hashResult.hash) {
        return hashResult;
      }

      // Combine hash with metadata for additional uniqueness
      const fingerprintData = {
        imageHash: hashResult.hash,
        timestamp: metadata?.timestamp || Date.now(),
        userId: metadata?.userId || '',
        source: metadata?.source || 'unknown'
      };

      const fingerprint = crypto
        .createHash('sha256')
        .update(JSON.stringify(fingerprintData))
        .digest('hex');

      return {
        success: true,
        hash: fingerprint,
        algorithm: this.ALGORITHM
      };
    } catch (error: any) {
      console.error('Fingerprint generation error:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate fingerprint'
      };
    }
  }

  /**
   * Batch hash multiple face images
   * Useful when processing multiple verification attempts
   */
  async hashMultipleImages(
    images: Array<{ data: string | Buffer; id?: string }>
  ): Promise<Map<string, string>> {
    const hashMap = new Map<string, string>();

    for (const image of images) {
      const result = this.hashFaceImage(image.data);
      
      if (result.success && result.hash) {
        const id = image.id || `image_${hashMap.size + 1}`;
        hashMap.set(id, result.hash);
      }
    }

    return hashMap;
  }

  /**
   * Check if an image hash already exists (duplicate detection)
   * Returns true if hash is found in provided list
   */
  isDuplicateHash(newHash: string, existingHashes: string[]): boolean {
    try {
      return existingHashes.some(hash => 
        hash.toLowerCase() === newHash.toLowerCase()
      );
    } catch (error) {
      console.error('Duplicate hash check error:', error);
      return false;
    }
  }

  /**
   * Get algorithm information
   */
  getAlgorithmInfo(): { name: string; outputLength: number } {
    return {
      name: this.ALGORITHM,
      outputLength: 64 // SHA-256 produces 64-character hex string
    };
  }
}

export const faceHashingService = new FaceHashingService();
