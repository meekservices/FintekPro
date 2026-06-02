/**
 * Firebase Admin / FCM Push Notification Service
 *
 * Architecture: The backend uses the existing PostgreSQL (Cloud SQL) as the
 * primary database. Firebase is used ONLY for push notification delivery (FCM).
 * No Firestore, no Firebase Auth — just FCM messaging.
 *
 * Auth: Uses Application Default Credentials (ADC) — the Cloud Run service
 * account (124901641600-compute@developer.gserviceaccount.com) has been granted
 * roles/firebase.admin, so no JSON key file is needed.
 *
 * FintekPro GCR v1.0: All notifications are logged with structured events.
 */

import * as admin from 'firebase-admin';
import { db } from '../db';
import { sql } from 'drizzle-orm';

// ── Firebase Init (singleton) ─────────────────────────────────────────────
let _app: admin.app.App | null = null;

function getFirebaseApp(): admin.app.App {
  if (_app) return _app;
  if (admin.apps.length > 0) {
    _app = admin.apps[0]!;
    return _app;
  }
  _app = admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'fintekpro',
  });
  console.log('[FCM] Firebase Admin SDK initialized with ADC (no key file required)');
  return _app;
}

// ── Types ──────────────────────────────────────────────────────────────────
export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

export interface PushResult {
  success: boolean;
  successCount: number;
  failureCount: number;
  errors: string[];
}

// ── Core Send Functions ────────────────────────────────────────────────────

/**
 * Send push notification to a single user (all their registered devices).
 * Automatically deregisters stale tokens that return NotRegistered.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<PushResult> {
  const start = Date.now();
  let successCount = 0;
  let failureCount = 0;
  const errors: string[] = [];

  try {
    // Fetch all active device tokens for this user
    const rows = await db.execute(
      sql`SELECT token, platform FROM push_tokens WHERE user_id = ${userId}`
    );
    const tokens = rows.rows as Array<{ token: string; platform: string }>;

    if (tokens.length === 0) {
      return { success: true, successCount: 0, failureCount: 0, errors: [] };
    }

    const app = getFirebaseApp();
    const messaging = admin.messaging(app);

    // Send to all tokens in parallel
    const results = await Promise.allSettled(
      tokens.map(async ({ token, platform }) => {
        const msg: admin.messaging.Message = {
          token,
          notification: {
            title: payload.title,
            body: payload.body,
            ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
          },
          data: payload.data ?? {},
          ...(platform === 'android' ? {
            android: {
              priority: 'high',
              notification: { channelId: 'fintekpro_default', color: '#D4A843' },
            },
          } : {}),
          ...(platform === 'ios' ? {
            apns: {
              payload: { aps: { sound: 'default', badge: 1 } },
            },
          } : {}),
        };
        return messaging.send(msg);
      })
    );

    // Process results, remove stale tokens
    const staleTokens: string[] = [];
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        successCount++;
      } else {
        failureCount++;
        const errMsg = result.reason?.message ?? 'Unknown error';
        errors.push(errMsg);
        if (errMsg.includes('registration-token-not-registered') ||
            errMsg.includes('invalid-registration-token')) {
          staleTokens.push(tokens[i].token);
        }
      }
    });

    // Clean up stale tokens
    if (staleTokens.length > 0) {
      await Promise.allSettled(
        staleTokens.map(t =>
          db.execute(sql`DELETE FROM push_tokens WHERE token = ${t}`)
        )
      );
      console.log(`[FCM] Removed ${staleTokens.length} stale token(s) for user ${userId}`);
    }

    console.log(JSON.stringify({
      event: 'FCM_PUSH_SENT',
      user_id: userId,
      title: payload.title,
      successCount,
      failureCount,
      latency_ms: Date.now() - start,
      status: failureCount === 0 ? 'success' : 'partial',
    }));

    return { success: failureCount === 0 || successCount > 0, successCount, failureCount, errors };
  } catch (err: any) {
    console.error('[FCM] Fatal push error:', err?.message);
    return { success: false, successCount: 0, failureCount: 1, errors: [err?.message] };
  }
}

/**
 * Send push notification to multiple users at once.
 * Used for broadcast notifications (e.g. market alerts, new picks).
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<PushResult> {
  const results = await Promise.allSettled(
    userIds.map(uid => sendPushToUser(uid, payload))
  );
  return results.reduce(
    (acc, r) => {
      if (r.status === 'fulfilled') {
        acc.successCount += r.value.successCount;
        acc.failureCount += r.value.failureCount;
        acc.errors.push(...r.value.errors);
      } else {
        acc.failureCount++;
        acc.errors.push(r.reason?.message ?? 'unknown');
      }
      return acc;
    },
    { success: true, successCount: 0, failureCount: 0, errors: [] } as PushResult
  );
}

// ── Notification Templates ─────────────────────────────────────────────────
// Typed notification helpers for FintekPro-specific events

/** Agent: new lead assigned */
export const notify = {
  /** Notify agent of a newly assigned lead */
  agentNewLead: (agentId: string, leadName: string) =>
    sendPushToUser(agentId, {
      title: '🎯 New Lead Assigned',
      body: `${leadName} has been assigned to you. Follow up now!`,
      data: { type: 'new_lead', screen: 'leads' },
    }),

  /** Notify agent of KYC approval */
  agentKYCApproved: (agentId: string, clientName: string) =>
    sendPushToUser(agentId, {
      title: '✅ KYC Approved',
      body: `${clientName}'s KYC has been verified successfully.`,
      data: { type: 'kyc_approved', screen: 'clients' },
    }),

  /** Notify agent of proposal accepted by client */
  agentProposalAccepted: (agentId: string, clientName: string, proposalAmount: string) =>
    sendPushToUser(agentId, {
      title: '🎉 Proposal Accepted!',
      body: `${clientName} accepted your ₹${proposalAmount} investment proposal.`,
      data: { type: 'proposal_accepted', screen: 'dashboard' },
    }),

  /** Notify agent of SIP failure for a client */
  agentSIPFailed: (agentId: string, clientName: string, sipName: string) =>
    sendPushToUser(agentId, {
      title: '⚠️ SIP Failed',
      body: `${clientName}'s SIP for ${sipName} could not be processed.`,
      data: { type: 'sip_failed', screen: 'clients' },
    }),

  /** Notify investor of portfolio milestone */
  investorPortfolioMilestone: (userId: string, milestone: string) =>
    sendPushToUser(userId, {
      title: '🏆 Portfolio Milestone!',
      body: milestone,
      data: { type: 'milestone', screen: 'portfolio' },
    }),

  /** Notify investor of SIP processed */
  investorSIPProcessed: (userId: string, fundName: string, amount: string) =>
    sendPushToUser(userId, {
      title: '✅ SIP Processed',
      body: `₹${amount} invested in ${fundName}`,
      data: { type: 'sip_processed', screen: 'sips' },
    }),

  /** Notify investor of goal achievement */
  investorGoalAchieved: (userId: string, goalName: string) =>
    sendPushToUser(userId, {
      title: '🎯 Goal Achieved!',
      body: `Congratulations! You've reached your "${goalName}" goal.`,
      data: { type: 'goal_achieved', screen: 'goals' },
    }),

  /** Broadcast: new pick of the day to all active agents */
  broadcastNewPick: (agentIds: string[], symbol: string, signal: string) =>
    sendPushToUsers(agentIds, {
      title: `📈 Pick of the Day: ${symbol}`,
      body: `Signal: ${signal} — Tap to view targets and share with clients.`,
      data: { type: 'new_pick', screen: 'picks' },
    }),

  /** Market alert to all opted-in investors */
  broadcastMarketAlert: (userIds: string[], message: string) =>
    sendPushToUsers(userIds, {
      title: '📊 Market Alert',
      body: message,
      data: { type: 'market_alert', screen: 'portfolio' },
    }),
};
