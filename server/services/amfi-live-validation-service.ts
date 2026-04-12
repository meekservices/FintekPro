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

    // 3. KFintech Iris real-time fallback
    if (process.env.KFINTECH_API_KEY) {
      try {
        const apiResult = await this.lookupArnViaKfintech(normalizedArn);
        if (apiResult) return apiResult;
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

  // ─── AMFI Bulk Sync (called by daily cron) ─────────────────────────────────

  /**
   * Downloads AMFI's distributor bulk CSV and upserts into amfiDistributors table.
   * AMFI publishes this at: https://www.amfiindia.com/modules/AMFIDistributors
   * The file format: ARN,Name,ExpiryDate,Status
   *
   * NOTE: AMFI restricts automated scraping — use a data vendor (e.g., KFintech,
   * Karvy, or a licensed data aggregator) for production use.
   */
  async syncAmfiDistributors(): Promise<{ synced: number; errors: number }> {
    const AMFI_BULK_URL = process.env.AMFI_DISTRIBUTOR_BULK_URL;
    if (!AMFI_BULK_URL) {
      logger.warn('[AmfiSync] AMFI_DISTRIBUTOR_BULK_URL not set — skipping bulk sync. Set this to the licensed AMFI data endpoint.');
      return { synced: 0, errors: 0 };
    }

    let synced = 0;
    let errors = 0;

    try {
      const response = await axios.get(AMFI_BULK_URL, { timeout: 30_000 });
      const lines: string[] = (response.data as string).split('\n').filter(Boolean);

      for (const line of lines.slice(1)) { // skip header
        const [arnCode, distributorName, expiryStr, status, euinNumber] = line.split(',').map(f => f.trim());
        if (!arnCode || !this.arnPattern.test(arnCode)) continue;

        try {
          await db.insert(schema.amfiDistributors).values({
            arnCode,
            distributorName,
            euinNumber: euinNumber || null,
            status: status?.toLowerCase() === 'active' ? 'active' : 'lapsed',
            arnExpiryDate: expiryStr ? new Date(expiryStr) : null,
            lastSyncedAt: new Date(),
          }).onConflictDoUpdate({
            target: schema.amfiDistributors.arnCode,
            set: {
              distributorName,
              status: status?.toLowerCase() === 'active' ? 'active' : 'lapsed',
              arnExpiryDate: expiryStr ? new Date(expiryStr) : null,
              lastSyncedAt: new Date(),
            },
          });
          synced++;
        } catch (upsertErr) {
          errors++;
        }
      }

      logger.info('[AmfiSync] AMFI distributor sync complete', { synced, errors });
    } catch (fetchErr) {
      logger.error('[AmfiSync] Failed to fetch AMFI bulk distributor data', { error: fetchErr });
      errors++;
    }

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
