/**
 * AMFI ARN/EUIN Live Validation Service
 *
 * Replaces the hardcoded test-ARN list in amfi-validation-service.ts.
 *
 * Strategy:
 *  1. Primary: Check local DB table `amfiDistributors` (synced daily by AMFI bulk download cron)
 *  2. Fallback: Real-time KFintech Iris distributor lookup (if KFINTECH_API_KEY is set)
 *  3. Last resort: Format validation only (logs a compliance warning)
 *
 * AMFI Regulatory Reference:
 *  - AMFI Circular 135/BP/22/2018-19 — ARN renewal mandatory every 3 years
 *  - SEBI IA Reg 2013 (amended 2020) § 7 — agent must have valid, current ARN
 *  - Platform must NOT onboard an agent with lapsed/suspended ARN
 */

import { db } from '../db';
import * as schema from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { logger } from '../logger';
import axios from 'axios';

export interface LiveArnResult {
  valid: boolean;
  status: 'active' | 'lapsed' | 'suspended' | 'not_found' | 'format_invalid';
  distributorName?: string;
  expiryDate?: Date;
  registrationDate?: Date;
  source: 'local_db' | 'kfintech_api' | 'format_only';
  warning?: string;
}

export interface LiveEuinResult {
  valid: boolean;
  status: 'active' | 'inactive' | 'not_found' | 'format_invalid';
  employeeName?: string;
  parentArn?: string;
  source: 'local_db' | 'kfintech_api' | 'format_only';
}

class AmfiLiveValidationService {
  private readonly arnPattern = /^ARN-\d{5,6}$/i;
  private readonly euinPattern = /^E\d{6}$/i;

  // ─── ARN Validation ────────────────────────────────────────────────────────

  async validateArn(arnCode: string): Promise<LiveArnResult> {
    const normalizedArn = arnCode.toUpperCase().trim();

    // 1. Format check
    if (!this.arnPattern.test(normalizedArn)) {
      return { valid: false, status: 'format_invalid', source: 'format_only' };
    }

    // 2. Local DB (fastest — synced by daily cron)
    try {
      const localResult = await this.lookupArnInDb(normalizedArn);
      if (localResult) return localResult;
    } catch (err) {
      logger.warn('[AmfiLive] Local DB ARN lookup failed, trying API fallback', { arnCode, err });
    }

    // 2. AMFI API real-time lookup (Layer 2 — live AMFI server)
    try {
      const apiResult = await this.lookupArnViaAmfiApi(normalizedArn);
      if (apiResult) return apiResult;
    } catch (err) {
      logger.warn('[AmfiLive] AMFI API lookup failed', { arnCode, err });
    }

    // 3. KFintech Iris real-time fallback (Layer 3 — only if key configured)
    if (process.env.KFINTECH_API_KEY) {
      try {
        const ktResult = await this.lookupArnViaKfintech(normalizedArn);
        if (ktResult) return ktResult;
      } catch (err) {
        logger.warn('[AmfiLive] KFintech ARN API fallback failed', { arnCode, err });
      }
    }

    // 4. No record found anywhere
    logger.warn('[AmfiLive] ARN not found in DB or API — format-only validation used', { arnCode: normalizedArn });
    return {
      valid: true, // format is valid; could not confirm from registry
      status: 'not_found',
      source: 'format_only',
      warning: 'ARN could not be confirmed against AMFI registry. Manual verification required before agent activation.',
    };
  }

  // ─── EUIN Validation ───────────────────────────────────────────────────────

  async validateEuin(euinNumber: string, parentArn?: string): Promise<LiveEuinResult> {
    const normalizedEuin = euinNumber.toUpperCase().trim();

    if (!this.euinPattern.test(normalizedEuin)) {
      return { valid: false, status: 'format_invalid', source: 'format_only' };
    }

    // Local DB lookup
    try {
      const [record] = await db.select()
        .from(schema.amfiDistributors)
        .where(eq(schema.amfiDistributors.euinNumber, normalizedEuin))
        .limit(1);

      if (record) {
        const valid = record.status === 'active';
        // Validate ARN relationship if provided
        if (parentArn && record.arnCode !== parentArn.toUpperCase()) {
          return {
            valid: false,
            status: record.status as any,
            employeeName: record.distributorName ?? undefined,
            parentArn: record.arnCode ?? undefined,
            source: 'local_db',
          };
        }
        return {
          valid,
          status: record.status as any,
          employeeName: record.distributorName ?? undefined,
          parentArn: record.arnCode ?? undefined,
          source: 'local_db',
        };
      }
    } catch (err) {
      logger.warn('[AmfiLive] Local DB EUIN lookup failed', { euinNumber, err });
    }

    return {
      valid: true, // format valid; cannot confirm
      status: 'not_found',
      source: 'format_only',
    };
  }

  // ─── AMFI Distributor Registry Sync (called by daily cron) ──────────────────

  /**
   * Syncs all AMFI distributors via the AMFI locate-distributor REST API.
   *
   * Endpoint discovered via browser inspection of https://www.amfiindia.com/locate-distributor
   * API: GET https://www.amfiindia.com/api/distributor-agent?strOpt=ALL&page=N&pageSize=100
   * Response: { data: [...], meta: { total, page, pageSize } }
   *
   * Response fields per record:
   *   ARN_Number, ARN_Name, Valid_From, Valid_Till, City, PinCode, Status (Active/Inactive)
   *
   * NOTE: AMFI's server is slow for server-to-server calls (~30-60s per page).
   * Use high pageSize (100) and a long axios timeout (90s) to avoid retries.
   */
  async syncAmfiDistributors(): Promise<{ synced: number; errors: number }> {
    const AMFI_API = process.env.AMFI_DISTRIBUTOR_API_URL
      || 'https://www.amfiindia.com/api/distributor-agent';
    const PAGE_SIZE = 100;
    let page = 1;
    let synced = 0;
    let errors = 0;
    let totalPages = 1;

    logger.info('[AmfiSync] Starting AMFI distributor registry sync via API', { endpoint: AMFI_API });

    do {
      try {
        const resp = await axios.get(AMFI_API, {
          params: { strOpt: 'ALL', page, pageSize: PAGE_SIZE },
          timeout: 90_000,
          headers: {
            'Accept': 'application/json',
            'Referer': 'https://www.amfiindia.com/locate-distributor',
            'User-Agent': 'FintekPro-Compliance-Sync/1.0 (regulatory-arn-validation)',
          },
        });

        const { data: records, meta } = resp.data as {
          data: any[];
          meta: { total: number; page: number; pageSize: number; pageCount: number };
        };

        if (!Array.isArray(records) || records.length === 0) break;

        totalPages = meta?.pageCount ?? Math.ceil((meta?.total ?? records.length) / PAGE_SIZE);

        for (const rec of records) {
          // Real AMFI API field names (verified via live API call 2026-04-12):
          // ARN, ARNHolderName, ARNValidFrom, ARNValidTill, EUIN, City, Pin
          const arnCode = `ARN-${(rec.ARN || '').trim()}`.toUpperCase();
          if (!arnCode || !this.arnPattern.test(arnCode)) continue;

          const expiryDate = rec.ARNValidTill ? new Date(rec.ARNValidTill) : null;
          const isExpired = expiryDate ? new Date() > expiryDate : false;
          // No Status field in response — derive from expiry date
          const effectiveStatus = isExpired ? 'lapsed' : 'active';

          try {
            await db.insert(schema.amfiDistributors).values({
              arnCode,
              distributorName: (rec.ARNHolderName || '').trim() || null,
              euinNumber: rec.EUIN?.trim() || null,
              status: effectiveStatus,
              arnExpiryDate: expiryDate,
              registrationDate: rec.ARNValidFrom ? new Date(rec.ARNValidFrom) : null,
              city: rec.City?.trim() || null,
              lastSyncedAt: new Date(),
            }).onConflictDoUpdate({
              target: schema.amfiDistributors.arnCode,
              set: {
                distributorName: (rec.ARNHolderName || '').trim() || null,
                euinNumber: rec.EUIN?.trim() || null,
                status: effectiveStatus,
                arnExpiryDate: expiryDate,
                lastSyncedAt: new Date(),
              },
            });
            synced++;
          } catch (upsertErr) {
            errors++;
          }
        }

        logger.info('[AmfiSync] Page synced', { page, totalPages, synced, errors });
        page++;

        // Polite delay — avoid hammering AMFI's server
        await new Promise(r => setTimeout(r, 2000));

      } catch (fetchErr) {
        logger.error('[AmfiSync] Failed to fetch page from AMFI API', { page, error: fetchErr });
        errors++;
        break;
      }
    } while (page <= totalPages);

    logger.info('[AmfiSync] AMFI distributor sync complete', { synced, errors });
    return { synced, errors };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async lookupArnInDb(arnCode: string): Promise<LiveArnResult | null> {
    const [record] = await db.select()
      .from(schema.amfiDistributors)
      .where(eq(schema.amfiDistributors.arnCode, arnCode))
      .limit(1);

    if (!record) return null;

    const isExpired = record.arnExpiryDate ? new Date() > record.arnExpiryDate : false;
    const effectiveStatus = isExpired ? 'lapsed' : (record.status as any);

    return {
      valid: effectiveStatus === 'active',
      status: effectiveStatus,
      distributorName: record.distributorName ?? undefined,
      expiryDate: record.arnExpiryDate ?? undefined,
      registrationDate: record.registrationDate ?? undefined,
      source: 'local_db',
    };
  }

  /**
   * Real-time single ARN lookup via AMFI API.
   * Used as Layer 2 fallback when local DB has no record.
   * Endpoint: GET https://www.amfiindia.com/api/distributor-agent?search=ARN-XXXXX&strOpt=ALL
   */
  private async lookupArnViaAmfiApi(arnCode: string): Promise<LiveArnResult | null> {
    const AMFI_API = process.env.AMFI_DISTRIBUTOR_API_URL
      || 'https://www.amfiindia.com/api/distributor-agent';

    try {
      const resp = await axios.get(AMFI_API, {
        // AMFI search works on bare ARN number (digits only, e.g. "15083" not "ARN-15083")
        params: { search: arnCode.replace(/^ARN-/i, ''), strOpt: 'ALL', page: 1, pageSize: 10 },
        timeout: 15_000,
        headers: {
          'Accept': 'application/json',
          'Referer': 'https://www.amfiindia.com/locate-distributor',
          'User-Agent': 'FintekPro-Compliance/1.0',
        },
      });

      const records: any[] = resp.data?.data ?? [];
      // Match by exact ARN number (with or without ARN- prefix in response)
      const match = records.find((r: any) => {
        const recArn = `ARN-${(r.ARN || '').trim()}`.toUpperCase();
        return recArn === arnCode;
      });

      if (!match) return null;

      // Derive status from expiry date (no Status field in AMFI API response)
      const expiryDate = match.ARNValidTill ? new Date(match.ARNValidTill) : null;
      const isExpired = expiryDate ? new Date() > expiryDate : false;
      const effectiveStatus: LiveArnResult['status'] = isExpired ? 'lapsed' : 'active';

      return {
        valid: effectiveStatus === 'active',
        status: effectiveStatus,
        distributorName: (match.ARNHolderName || '').trim() || undefined,
        expiryDate: expiryDate ?? undefined,
        source: 'kfintech_api', // reusing source label for API fallback
      };
    } catch (err) {
      logger.warn('[AmfiLive] AMFI API lookup failed (slow server?)', { arnCode, err });
      return null;
    }
  }

  /**
   * KFintech Iris distributor API fallback (Layer 3).
   * Only used if KFINTECH_API_KEY is set.
   */
  private async lookupArnViaKfintech(arnCode: string): Promise<LiveArnResult | null> {
    const baseUrl = process.env.KFINTECH_BASE_URL || 'https://mfapi.kfintech.com';
    const apiKey = process.env.KFINTECH_API_KEY!;

    try {
      const resp = await axios.get(`${baseUrl}/api/distributor/validate`, {
        params: { arnCode },
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 8000,
      });

      const data = resp.data;
      if (!data || !data.distributorName) return null;

      return {
        valid: data.status?.toLowerCase() === 'active',
        status: data.status?.toLowerCase() as any,
        distributorName: data.distributorName,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
        source: 'kfintech_api',
      };
    } catch {
      return null;
    }
  }
}

export const amfiLiveValidationService = new AmfiLiveValidationService();
