/**
 * Resource Ownership Guard Middleware
 * P1 — RBAC resource ownership checks for agent→client data access.
 *
 * Ensures agents can only read/write data for their own assigned clients.
 * Prevents horizontal privilege escalation where agent A accesses agent B's clients.
 *
 * Usage:
 *   app.get('/api/agent/client/:clientId/portfolio', requireOwnership('clientId'), handler)
 *   app.get('/api/agent/portfolio/:userId', requireOwnership('userId'), handler)
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../logger';
import { distributedCache } from '../utils/distributed-cache';

type IdSource = 'params' | 'body' | 'query';

interface OwnershipOptions {
  /** Name of the param/body/query field that contains the target user ID */
  targetUserIdField?: string;
  /** Where to read the field from */
  from?: IdSource;
  /** Allow admins/compliance to bypass ownership check */
  adminBypass?: boolean;
  /** Roles that are completely exempt from the ownership check */
  exemptRoles?: string[];
}

const AGENT_ROLES = new Set(['agent', 'sub_agent', 'associate', 'partner', 'partner_ops', 'master_agent']);
const ADMIN_ROLES = new Set(['superadmin', 'admin', 'compliance_officer', 'compliance_team', 'regulatory_auditor']);
const OWNERSHIP_CACHE_TTL = 300; // 5 minutes

async function isClientAssignedToAgent(agentId: string, clientId: string): Promise<boolean> {
  const cacheKey = `ownership:${agentId}:${clientId}`;
  const cached = await distributedCache.get(cacheKey);
  if (cached !== null) return cached === '1';

  try {
    const result = await db.execute(
      sql`SELECT 1 FROM users u WHERE u.id = ${clientId} AND u.agent_id = ${agentId} LIMIT 1`,
    );
    const assigned = (result as any).rows?.length > 0 || (result as any).length > 0;
    await distributedCache.set(cacheKey, assigned ? '1' : '0', OWNERSHIP_CACHE_TTL);
    return assigned;
  } catch (err) {
    logger.warn('[OwnershipGuard] DB check failed — failing closed to protect access control', {
      agentId,
      clientId,
      error: String(err),
    });
    return false; // fail-closed: deny access on DB error rather than grant it
  }
}

/** Invalidate ownership cache when agent assignment changes */
export function invalidateOwnershipCache(agentId: string, clientId: string): void {
  distributedCache.del(`ownership:${agentId}:${clientId}`).catch(() => {});
}

/**
 * Returns Express middleware that enforces resource ownership.
 *
 * @param targetUserIdField  The request field name containing the target user ID.
 *                           Defaults to 'userId'.
 * @param opts               Optional configuration.
 */
export function requireOwnership(
  targetUserIdField = 'userId',
  opts: OwnershipOptions = {},
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  const {
    from = 'params',
    adminBypass = true,
    exemptRoles = [],
  } = opts;

  const exemptSet = new Set([...exemptRoles]);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = req.user as any;
    if (!user) { res.status(401).json({ message: 'Unauthorized' }); return; }

    const userRoles: string[] = user.roles || (user.role ? [user.role] : ['user']);

    // Admins bypass ownership check
    if (adminBypass && userRoles.some((r) => ADMIN_ROLES.has(r))) {
      return next();
    }

    // Exempt roles bypass ownership check
    if (userRoles.some((r) => exemptSet.has(r))) {
      return next();
    }

    // Only apply ownership check to agent-type roles
    if (!userRoles.some((r) => AGENT_ROLES.has(r))) {
      return next();
    }

    // Extract target user ID
    let targetUserId: string | undefined;
    if (from === 'params') targetUserId = req.params[targetUserIdField];
    else if (from === 'body') targetUserId = req.body?.[targetUserIdField];
    else targetUserId = req.query[targetUserIdField] as string | undefined;

    if (!targetUserId) {
      // No target user ID — let the route handler validate itself
      return next();
    }

    // Agents are always allowed to access their own data
    if (targetUserId === user.id) return next();

    const allowed = await isClientAssignedToAgent(user.id, targetUserId);
    if (!allowed) {
      logger.warn('[OwnershipGuard] Access denied — client not assigned to agent', {
        agentId: user.id,
        clientId: targetUserId,
        path: req.path,
      });
      res.status(403).json({
        message: 'Access denied — this client is not assigned to you.',
        code: 'OWNERSHIP_VIOLATION',
      });
      return;
    }

    next();
  };
}

/**
 * Middleware that restricts any request where the body/params contain a
 * `userId` to only the user themselves or an admin/assigned agent.
 *
 * Shorthand for `requireOwnership('userId')` with params + body checking.
 */
export const requireSelfOrAgent = requireOwnership('userId', { from: 'params' });
