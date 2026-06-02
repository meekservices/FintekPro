/**
 * rate-limiter.ts — Tiered Rate Limiting Middleware
 *
 * Purpose : Protect all endpoints from brute force, abuse, and cost overruns.
 * Strategy: Multiple named limiters — apply the tightest one per route group.
 *
 * Tiers:
 *   AUTH_LIMITER       — 20 req / 15 min (prevents OTP/password brute force)
 *   OTP_LIMITER        — 5 req / 15 min  (reduces Twilio/SMS cost abuse)
 *   AI_LIMITER         — 30 req / 60 sec (controls Gemini API spend)
 *   UPLOAD_LIMITER     — 10 req / 5 min  (KYC doc upload abuse prevention)
 *   ADMIN_COPILOT_LIMITER — 60 req / 60 sec (Zoho quota protection)
 *   GLOBAL_LIMITER     — 300 req / 60 sec (DDoS backstop)
 *
 * Inputs  : Express Request (uses IP or X-Forwarded-For behind Cloud Run proxy)
 * Outputs : 429 Too Many Requests with Retry-After header on breach
 * Edge    : Cloud Run is behind Google Frontend — use X-Forwarded-For for real IP.
 *           Trusted proxy is set globally in Express (app.set('trust proxy', 1)).
 */

import rateLimit, { type Options, type RateLimitInfo, ipKeyGenerator } from 'express-rate-limit';
import { type Request, type Response } from 'express';

// ── Standard 429 response shape ─────────────────────────────────────────────
function rateLimitHandler(req: Request, res: Response, _next: unknown, options: Options): void {
  const info = res.getHeader('RateLimit-Reset');
  res.status(429).json({
    success: false,
    error_code: 'RATE_LIMIT_EXCEEDED',
    message: options.message as string,
    retryable: true,
    retry_after_seconds: info ? Math.ceil((Number(info) * 1000 - Date.now()) / 1000) : 60,
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0',
    },
  });
}

// ── Base config shared across all limiters ───────────────────────────────────
const base: Partial<Options> = {
  standardHeaders: 'draft-8', // RateLimit-Policy, RateLimit headers (RFC 9110)
  legacyHeaders: false,
  handler: rateLimitHandler as Options['handler'],
  // Cloud Run: trust first proxy (Google Frontend)
  skip: (req) => {
    // Never limit health checks — Cloud Run startup probes must always pass
    return req.path === '/api/health' || req.path === '/api/boot-status';
  },
};

// ── AUTH limiter: 20 requests per 15 minutes ─────────────────────────────────
export const authLimiter = rateLimit({
  ...base,
  windowMs:  15 * 60 * 1000,
  max:       20,
  message:   'Too many authentication attempts. Please wait 15 minutes before retrying.',
  // ipKeyGenerator handles IPv4-mapped IPv6 (::ffff:x.x.x.x) correctly,
  // preventing ERR_ERL_KEY_GEN_IPV6 and ensuring IPv6 users can't bypass limits.
  keyGenerator: (req) => ipKeyGenerator(req),
});

// ── OTP limiter: 5 OTP requests per 15 minutes ───────────────────────────────
export const otpLimiter = rateLimit({
  ...base,
  windowMs:  15 * 60 * 1000,
  max:       5,
  message:   'Too many OTP requests. Please wait 15 minutes. If this is urgent, contact support.',
  keyGenerator: (req) => ipKeyGenerator(req),
});

// ── AI / Gemini limiter: 30 requests per minute ──────────────────────────────
export const aiLimiter = rateLimit({
  ...base,
  windowMs:  60 * 1000,
  max:       30,
  message:   'AI request limit reached. Please slow down — maximum 30 requests per minute.',
  keyGenerator: (req) => {
    // Key by user session if available, otherwise by IP.
    // This prevents one heavy user from affecting others on shared IP (e.g. office NAT).
    const userId = (req as any).user?.id || (req as any).session?.userId;
    if (userId) return `user:${userId}`;
    return ipKeyGenerator(req);
  },
});

// ── Admin Copilot limiter: 60 requests per minute ────────────────────────────
export const adminCopilotLimiter = rateLimit({
  ...base,
  windowMs:  60 * 1000,
  max:       60,
  message:   'Admin Copilot rate limit exceeded. Maximum 60 requests per minute to protect Zoho API quotas.',
  keyGenerator: (req) => {
    const userId = (req as any).user?.id || (req as any).session?.userId;
    return userId ? `admin:${userId}` : ipKeyGenerator(req);
  },
});

// ── Document upload limiter: 10 uploads per 5 minutes ────────────────────────
export const uploadLimiter = rateLimit({
  ...base,
  windowMs:  5 * 60 * 1000,
  max:       10,
  message:   'Too many document uploads. Maximum 10 uploads per 5 minutes.',
  keyGenerator: (req) => {
    const userId = (req as any).user?.id || (req as any).session?.userId;
    return userId ? `upload:${userId}` : ipKeyGenerator(req);
  },
});

// ── Global backstop: 300 requests per minute per IP ──────────────────────────
// Applied to ALL routes. Only kicks in during DDoS or runaway clients.
export const globalLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  max: 300,
  message: 'Too many requests from this IP. Please slow down.',
  keyGenerator: (req) => ipKeyGenerator(req),
});
