/**
 * OTP Retry Throttling Service (Task 3)
 * 
 * Implements UIDAI-compliant rate limiting for Aadhaar OTP requests
 * - Max 3 attempts per session
 * - 60-second cooldown between retries
 * - 24-hour lockout after max attempts
 */

interface OTPAttempt {
  sessionId: string;
  userId: string;
  aadhaarHash: string;
  attempts: number;
  lastAttemptAt: Date;
  lockedUntil: Date | null;
  createdAt: Date;
}

class OTPThrottleService {
  private attempts: Map<string, OTPAttempt> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  private readonly MAX_ATTEMPTS = 3;
  private readonly COOLDOWN_SECONDS = 60;
  private readonly LOCKOUT_HOURS = 24;
  private readonly CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

  constructor() {
    this.startCleanupInterval();
  }

  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cleanupInterval = setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL_MS);
    console.log('🧹 [OTP Throttle] Cleanup interval started');
  }

  /**
   * Check if OTP request is allowed
   */
  canRequestOTP(sessionId: string, userId: string, aadhaarHash: string): {
    allowed: boolean;
    remainingAttempts: number;
    cooldownSeconds: number;
    lockedUntil: Date | null;
    message: string;
  } {
    const key = this.getKey(userId, aadhaarHash);
    const attempt = this.attempts.get(key);

    if (!attempt) {
      return {
        allowed: true,
        remainingAttempts: this.MAX_ATTEMPTS,
        cooldownSeconds: 0,
        lockedUntil: null,
        message: 'OTP request allowed'
      };
    }

    // Check if locked out
    if (attempt.lockedUntil && new Date() < attempt.lockedUntil) {
      const remainingLockout = Math.ceil((attempt.lockedUntil.getTime() - Date.now()) / 1000 / 60);
      return {
        allowed: false,
        remainingAttempts: 0,
        cooldownSeconds: 0,
        lockedUntil: attempt.lockedUntil,
        message: `Too many OTP attempts. Please try again in ${remainingLockout} minutes.`
      };
    }

    // Reset if lockout expired
    if (attempt.lockedUntil && new Date() >= attempt.lockedUntil) {
      this.attempts.delete(key);
      return {
        allowed: true,
        remainingAttempts: this.MAX_ATTEMPTS,
        cooldownSeconds: 0,
        lockedUntil: null,
        message: 'OTP request allowed'
      };
    }

    // Check cooldown period
    const timeSinceLastAttempt = (Date.now() - attempt.lastAttemptAt.getTime()) / 1000;
    if (timeSinceLastAttempt < this.COOLDOWN_SECONDS) {
      const remainingCooldown = Math.ceil(this.COOLDOWN_SECONDS - timeSinceLastAttempt);
      return {
        allowed: false,
        remainingAttempts: this.MAX_ATTEMPTS - attempt.attempts,
        cooldownSeconds: remainingCooldown,
        lockedUntil: null,
        message: `Please wait ${remainingCooldown} seconds before requesting another OTP.`
      };
    }

    // Check max attempts
    if (attempt.attempts >= this.MAX_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + this.LOCKOUT_HOURS * 60 * 60 * 1000);
      attempt.lockedUntil = lockedUntil;
      this.attempts.set(key, attempt);
      
      return {
        allowed: false,
        remainingAttempts: 0,
        cooldownSeconds: 0,
        lockedUntil,
        message: `Maximum OTP attempts exceeded. Please try again after ${this.LOCKOUT_HOURS} hours.`
      };
    }

    return {
      allowed: true,
      remainingAttempts: this.MAX_ATTEMPTS - attempt.attempts,
      cooldownSeconds: 0,
      lockedUntil: null,
      message: 'OTP request allowed'
    };
  }

  /**
   * Record an OTP request attempt
   */
  recordAttempt(sessionId: string, userId: string, aadhaarHash: string): void {
    const key = this.getKey(userId, aadhaarHash);
    const existing = this.attempts.get(key);

    if (existing) {
      existing.attempts += 1;
      existing.lastAttemptAt = new Date();
      existing.sessionId = sessionId;
      this.attempts.set(key, existing);
    } else {
      this.attempts.set(key, {
        sessionId,
        userId,
        aadhaarHash,
        attempts: 1,
        lastAttemptAt: new Date(),
        lockedUntil: null,
        createdAt: new Date()
      });
    }

    console.log(`📊 [OTP Throttle] Recorded attempt for user ${userId.substring(0, 8)}...: ${this.attempts.get(key)?.attempts}/${this.MAX_ATTEMPTS}`);
  }

  /**
   * Reset attempts after successful verification
   */
  resetAttempts(userId: string, aadhaarHash: string): void {
    const key = this.getKey(userId, aadhaarHash);
    this.attempts.delete(key);
    console.log(`✅ [OTP Throttle] Reset attempts for user ${userId.substring(0, 8)}...`);
  }

  /**
   * Get throttle status for audit
   */
  getThrottleStatus(userId: string, aadhaarHash: string): OTPAttempt | null {
    const key = this.getKey(userId, aadhaarHash);
    return this.attempts.get(key) || null;
  }

  /**
   * Clean up expired entries (call periodically)
   */
  cleanup(): void {
    const now = new Date();
    let cleaned = 0;

    for (const [key, attempt] of this.attempts.entries()) {
      // Remove entries older than 24 hours with no lockout
      const age = (now.getTime() - attempt.createdAt.getTime()) / 1000 / 60 / 60;
      if (age > 24 && !attempt.lockedUntil) {
        this.attempts.delete(key);
        cleaned++;
      }
      // Remove expired lockouts
      if (attempt.lockedUntil && now >= attempt.lockedUntil) {
        this.attempts.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 [OTP Throttle] Cleaned up ${cleaned} expired entries`);
    }
  }

  private getKey(userId: string, aadhaarHash: string): string {
    return `${userId}:${aadhaarHash}`;
  }

  /**
   * Hash Aadhaar number for storage (never store raw Aadhaar)
   */
  static hashAadhaar(aadhaarNumber: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(aadhaarNumber).digest('hex').substring(0, 16);
  }
}

export const otpThrottleService = new OTPThrottleService();
