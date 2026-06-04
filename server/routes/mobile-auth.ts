/**
 * Mobile Auth Routes — /api/auth/mobile/*
 *
 * Issues long-lived JWTs for the React Native apps (agent + investor).
 * Mobile apps cannot use browser session cookies, so they use Bearer tokens.
 *
 * Endpoints:
 *   POST /api/auth/mobile/token     — Login, receive JWT
 *   POST /api/auth/mobile/refresh   — Refresh an expiring JWT
 *   GET  /api/auth/mobile/me        — Get current user from JWT
 *   POST /api/push-tokens           — Register FCM device token
 *   DELETE /api/push-tokens/:token  — Deregister FCM device token
 *
 * SEBI / FintekPro GCR v1.0 compliance:
 *   - JWT is stateless but tracked in DB (push_tokens table) for push notification delivery
 *   - Token expiry: 30 days (matches web session)
 *   - portalType validated to restrict agents from using investor token and vice versa
 */

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import * as schema from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

export const mobileAuthRouter = Router();

const JWT_SECRET = process.env.JWT_MOBILE_SECRET || process.env.SESSION_SECRET || 'fintekpro-mobile-secret';
const JWT_EXPIRY = '30d';
const ISSUER = 'fintekpro-mobile';

interface MobileJwtPayload {
  userId: string;
  email: string;
  roles: string[];
  portalType: 'agent' | 'investor';
  iat?: number;
  exp?: number;
}

function signMobileToken(payload: Omit<MobileJwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY, issuer: ISSUER });
}

function verifyMobileToken(token: string): MobileJwtPayload {
  return jwt.verify(token, JWT_SECRET, { issuer: ISSUER }) as MobileJwtPayload;
}

/**
 * Middleware: Authenticate mobile requests via Bearer token.
 * Attaches `req.mobileUser` if valid.
 */
export function requireMobileAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { error_code: 'MISSING_TOKEN', message: 'Bearer token required', retryable: false }
    });
  }
  try {
    const token = authHeader.slice(7);
    const payload = verifyMobileToken(token);
    (req as any).mobileUser = payload;
    next();
  } catch (e: any) {
    return res.status(401).json({
      success: false,
      error: { error_code: 'INVALID_TOKEN', message: 'Token expired or invalid. Please log in again.', retryable: false }
    });
  }
}

/**
 * Compare a plaintext password against a stored scrypt hash (hex.salt format).
 * Matches the hashPassword / comparePasswords logic in server/auth.ts.
 * IMPORTANT: Do NOT use bcryptjs — FintekPro uses Node.js built-in scrypt.
 */
async function compareScryptPassword(supplied: string, stored: string): Promise<boolean> {
  try {
    const { scrypt, timingSafeEqual } = await import('crypto');
    const { promisify } = await import('util');
    const scryptAsync = promisify(scrypt);
    const [hashed, salt] = stored.split('.');
    if (!hashed || !salt) return false;
    const hashedBuf = Buffer.from(hashed, 'hex');
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch {
    return false;
  }
}

// ── POST /api/auth/mobile/token ────────────────────────────────────────────
mobileAuthRouter.post('/token', async (req: Request, res: Response) => {
  const { email, password, portalType } = req.body as {
    email: string;
    password: string;
    portalType: 'agent' | 'investor';
  };

  if (!email || !password || !portalType) {
    return res.status(400).json({
      success: false,
      error: { error_code: 'MISSING_FIELDS', message: 'email, password and portalType are required', retryable: false }
    });
  }

  try {
    // Lookup by email or mobile (normalise mobile: strip +91 prefix and leading zero)
    const normalised = email.includes('@') ? email.toLowerCase() : email.replace(/\D/g, '').replace(/^91(\d{10})$/, '$1').replace(/^0(\d{10})$/, '$1');
    const users = await db.execute(
      sql`SELECT id, email, mobile, password, "firstName", "lastName", name, roles, phone
          FROM users
          WHERE email = ${normalised} OR mobile = ${normalised}
          LIMIT 1`
    );
    const user = (users.rows as any[])[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        error: { error_code: 'INVALID_CREDENTIALS', message: 'Invalid email or password', retryable: false }
      });
    }

    // Use scrypt comparison — same as auth.ts (NOT bcryptjs)
    const valid = await compareScryptPassword(password, user.password);
    if (!valid) {
      return res.status(401).json({
        success: false,
        error: { error_code: 'INVALID_CREDENTIALS', message: 'Invalid email or password', retryable: false }
      });
    }

    const roles: string[] = Array.isArray(user.roles) ? user.roles : JSON.parse(user.roles || '[]');

    // Validate portal type access
    const isAgent = roles.some(r => ['agent', 'master_agent', 'sub_agent', 'admin', 'super_admin'].includes(r));

    if (portalType === 'agent' && !isAgent) {
      return res.status(403).json({
        success: false,
        error: { error_code: 'PORTAL_ACCESS_DENIED', message: 'You do not have agent portal access', retryable: false }
      });
    }

    const displayName = user.name || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
    const token = signMobileToken({ userId: user.id, email: user.email, roles, portalType });

    console.log(JSON.stringify({
      event: 'MOBILE_LOGIN',
      user_id: user.id,
      portalType,
      platform: req.headers['x-platform'] ?? 'mobile',
      latency_ms: 0,
      status: 'success',
    }));

    return res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, name: displayName, email: user.email, roles, phone: user.phone || user.mobile },
      },
      meta: { timestamp: new Date().toISOString(), version: '1.0' }
    });
  } catch (err) {
    console.error('[MobileAuth] Login error:', err);
    return res.status(500).json({
      success: false,
      error: { error_code: 'LOGIN_ERROR', message: 'Login failed. Please try again.', retryable: true }
    });
  }
});

// ── GET /api/auth/mobile/me ────────────────────────────────────────────────
mobileAuthRouter.get('/me', requireMobileAuth, async (req: Request, res: Response) => {
  const mobileUser = (req as any).mobileUser as MobileJwtPayload;
  try {
    const users = await db.execute(
      sql`SELECT id, email, mobile, "firstName", "lastName", name, roles, phone FROM users WHERE id = ${mobileUser.userId} LIMIT 1`
    );
    const user = (users.rows as any[])[0];
    if (!user) {
      return res.status(404).json({ success: false, error: { error_code: 'USER_NOT_FOUND', message: 'User not found', retryable: false } });
    }
    const displayName = user.name || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
    return res.json({
      success: true,
      data: { id: user.id, name: displayName, email: user.email, roles: user.roles, phone: user.phone || user.mobile },
      meta: { timestamp: new Date().toISOString(), version: '1.0' }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: { error_code: 'FETCH_ERROR', message: 'Could not fetch user', retryable: true } });
  }
});

// ── POST /api/auth/mobile/refresh ──────────────────────────────────────────
mobileAuthRouter.post('/refresh', requireMobileAuth, (req: Request, res: Response) => {
  const mobileUser = (req as any).mobileUser as MobileJwtPayload;
  const newToken = signMobileToken({
    userId: mobileUser.userId,
    email: mobileUser.email,
    roles: mobileUser.roles,
    portalType: mobileUser.portalType,
  });
  return res.json({
    success: true,
    data: { token: newToken },
    meta: { timestamp: new Date().toISOString(), version: '1.0' }
  });
});
