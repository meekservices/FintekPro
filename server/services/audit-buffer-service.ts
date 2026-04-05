/**
 * Audit Buffer Service
 * P0 — Buffered writes + file fallback to prevent missing audit logs
 *
 * Writes are buffered in memory (up to 200 entries or 2 seconds, whichever
 * comes first) and flushed to the DB in a single batch INSERT. When the DB
 * is unreachable the buffer is drained to a rotating file log so no entry
 * is ever silently dropped.
 */

import fs from 'fs';
import path from 'path';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../logger';

interface AuditEntry {
  userId?: string | null;
  action: string;
  category: string;
  details?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  outcome: 'success' | 'failure';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
}

const BUFFER_MAX = 200;
const FLUSH_INTERVAL_MS = 2000;
const FALLBACK_LOG_DIR = process.env.AUDIT_LOG_DIR || '/tmp/audit-fallback';
const FALLBACK_LOG_FILE = path.join(FALLBACK_LOG_DIR, 'audit-fallback.jsonl');

class AuditBufferService {
  private buffer: AuditEntry[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;
  private dbAvailable = true;

  constructor() {
    this.ensureFallbackDir();
    this.startFlushTimer();

    process.on('SIGTERM', () => this.flushSync());
    process.on('SIGINT', () => this.flushSync());
  }

  private ensureFallbackDir(): void {
    try {
      if (!fs.existsSync(FALLBACK_LOG_DIR)) {
        fs.mkdirSync(FALLBACK_LOG_DIR, { recursive: true });
      }
    } catch (err) {
      logger.warn('[AuditBuffer] Could not create fallback log directory', { dir: FALLBACK_LOG_DIR });
    }
  }

  private startFlushTimer(): void {
    this.timer = setInterval(() => {
      this.flush().catch((err) =>
        logger.error('[AuditBuffer] Flush timer error', { error: String(err) }),
      );
    }, FLUSH_INTERVAL_MS);

    if (this.timer.unref) this.timer.unref();
  }

  push(entry: Omit<AuditEntry, 'createdAt'>): void {
    this.buffer.push({ ...entry, createdAt: new Date() });

    if (this.buffer.length >= BUFFER_MAX) {
      this.flush().catch((err) =>
        logger.error('[AuditBuffer] Threshold flush error', { error: String(err) }),
      );
    }
  }

  async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) return;
    this.flushing = true;

    const batch = this.buffer.splice(0, this.buffer.length);
    try {
      await this.writeBatchToDb(batch);
      if (!this.dbAvailable) {
        logger.info('[AuditBuffer] DB connection restored — resuming normal writes');
        this.dbAvailable = true;
      }
    } catch (err) {
      this.dbAvailable = false;
      logger.warn('[AuditBuffer] DB write failed — writing to fallback file', {
        count: batch.length,
        error: String(err),
      });
      this.writeBatchToFile(batch);
    } finally {
      this.flushing = false;
    }
  }

  private async writeBatchToDb(batch: AuditEntry[]): Promise<void> {
    if (batch.length === 0) return;

    const values = batch
      .map((e) => {
        const details = e.details ? JSON.stringify(e.details) : null;
        return sql`(${e.userId ?? null}, ${e.action}, ${e.category}, ${details}, ${e.ipAddress ?? null}, ${e.userAgent ?? null}, ${e.outcome}, ${e.riskLevel}, ${e.createdAt})`;
      });

    await db.execute(
      sql`
        INSERT INTO audit_trail
          (user_id, action, category, details, ip_address, user_agent, outcome, risk_level, created_at)
        VALUES ${sql.join(values, sql`, `)}
        ON CONFLICT DO NOTHING
      `,
    );
  }

  private writeBatchToFile(batch: AuditEntry[]): void {
    try {
      const lines = batch.map((e) => JSON.stringify(e)).join('\n') + '\n';
      fs.appendFileSync(FALLBACK_LOG_FILE, lines, 'utf-8');

      const stats = fs.statSync(FALLBACK_LOG_FILE);
      if (stats.size > 50 * 1024 * 1024) {
        const rotated = FALLBACK_LOG_FILE.replace('.jsonl', `-${Date.now()}.jsonl`);
        fs.renameSync(FALLBACK_LOG_FILE, rotated);
        logger.info('[AuditBuffer] Rotated fallback log file', { rotated });
      }
    } catch (fileErr) {
      logger.error('[AuditBuffer] Cannot write to fallback file — entries lost!', {
        count: batch.length,
        error: String(fileErr),
      });
    }
  }

  private flushSync(): void {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0, this.buffer.length);
    this.writeBatchToFile(batch);
    logger.info('[AuditBuffer] SIGTERM flush — wrote remaining entries to fallback file', {
      count: batch.length,
    });
  }

  getStats(): { buffered: number; dbAvailable: boolean } {
    return { buffered: this.buffer.length, dbAvailable: this.dbAvailable };
  }
}

export const auditBufferService = new AuditBufferService();
