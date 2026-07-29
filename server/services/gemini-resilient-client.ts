/**
 * @file gemini-resilient-client.ts
 * @description Production-grade Gemini AI client with retry, Redis caching, token budgeting,
 *              and FASP advisory output persistence.
 *
 * Upgrades over bare gemini-service.ts:
 *   1. Exponential backoff retry (max 3) on 429/503
 *   2. Redis caching with configurable TTL (default 30 min)
 *   3. Token budget guard — rejects prompts > 50K chars
 *   4. FASP advisory output auto-persistence
 *   5. Structured latency/cost logging per call
 *
 * FASP-AI v3.0: every advisory call logged to fasp_advisory_outputs.
 */

import { GoogleGenAI } from "@google/genai";
import { logger } from "../logger";
import { db } from "../db";
import { faspAdvisoryOutputs } from "../../shared/schema";
import { FaspAIv2Service, UserSegment, AdvisoryType } from "./fasp-ai-v2-service";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// ── Redis client (gracefully absent) ─────────────────────────────────────────
let redisClient: any = null;
async function getRedis() {
  if (redisClient?.isOpen) return redisClient;
  try {
    if (!process.env.REDIS_URL) return null;
    const { createClient } = await import("redis");
    redisClient = createClient({
      url: process.env.REDIS_URL,
      socket: { connectTimeout: 2000, reconnectStrategy: false },
    });
    redisClient.on("error", () => { redisClient = null; });
    await Promise.race([
      redisClient.connect(),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("Redis timeout")), 2500),
      ),
    ]);
    return redisClient;
  } catch {
    redisClient = null;
    return null;
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_PROMPT_CHARS   = 50_000;   // token budget guard
const MAX_RETRIES        = 3;
const DEFAULT_CACHE_TTL  = 30 * 60; // 30 minutes in seconds

export interface GeminiCallOptions {
  /** Redis key for caching. If omitted, response is not cached. */
  cacheKey?: string;
  /** Redis TTL in seconds (default: 1800 / 30 min) */
  cacheTtl?: number;
  /** Max retries on transient failures (default: 3) */
  maxRetries?: number;
  /** If true, auto-persist output to fasp_advisory_outputs */
  faspPersist?: {
    advisoryType: AdvisoryType;
    userSegment: UserSegment;
    inputContext: Record<string, unknown>;
    userId?: string;
    advisorId?: string;
  };
}

/**
 * Calls Gemini with exponential backoff retry, Redis caching, and FASP persistence.
 *
 * @param prompt - The prompt string
 * @param schema - JSON schema for structured output
 * @param options - Caching, retry, and FASP persistence options
 * @returns Parsed JSON response
 */
export async function callGeminiResilient<T = Record<string, unknown>>(
  prompt: string,
  schema: object,
  options: GeminiCallOptions = {}
): Promise<T> {
  const t0 = Date.now();
  const { cacheKey, cacheTtl = DEFAULT_CACHE_TTL, maxRetries = MAX_RETRIES } = options;

  // 1. Token budget guard
  if (prompt.length > MAX_PROMPT_CHARS) {
    logger.warn("[GeminiResilient] Prompt exceeds token budget", {
      event: "GEMINI_TOKEN_BUDGET_EXCEEDED",
      user_id: "system",
      prompt_chars: prompt.length,
      max_chars: MAX_PROMPT_CHARS,
      latency_ms: 0,
      status: "rejected",
    });
    throw new Error(`Prompt too long: ${prompt.length} chars (max ${MAX_PROMPT_CHARS})`);
  }

  // 2. Redis cache check
  if (cacheKey) {
    const redis = await getRedis();
    if (redis) {
      try {
        const cached = await redis.get(`gemini:${cacheKey}`);
        if (cached) {
          logger.info("[GeminiResilient] Cache HIT", {
            event: "GEMINI_CACHE_HIT",
            user_id: "system",
            cache_key: cacheKey,
            latency_ms: Date.now() - t0,
            status: "success",
          });
          return JSON.parse(cached) as T;
        }
      } catch { /* cache miss is fine */ }
    }
  }

  // 3. Call with exponential backoff
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          responseMimeType: "application/json",
          responseSchema: schema as any,
        },
        contents: prompt,
      });

      const raw = response.text;
      if (!raw) throw new Error("Empty response from Gemini");
      const parsed = JSON.parse(raw) as T;

      // 4. Cache result
      if (cacheKey) {
        const redis = await getRedis();
        if (redis) {
          try {
            await redis.setEx(`gemini:${cacheKey}`, cacheTtl, JSON.stringify(parsed));
          } catch { /* non-fatal */ }
        }
      }

      const latency = Date.now() - t0;

      // 5. FASP advisory persistence
      if (options.faspPersist) {
        const { advisoryType, userSegment, inputContext, userId, advisorId } = options.faspPersist;
        const confidence = FaspAIv2Service.computeConfidence({
          responseLength: raw.length,
          hasStructuredData: true,
          factorCount: Object.keys(parsed as object).length,
          userSegment,
        });
        await db.insert(faspAdvisoryOutputs).values({
          advisoryType,
          userSegment,
          inputContext: inputContext as any,
          recommendation: JSON.stringify(parsed).substring(0, 2000),
          outputSnapshot: parsed as any,
          modelVersion: "FASP-AI-v3.0",
          baseModel: "gemini-2.5-flash",
          confidenceScore: confidence.score,
          confidenceBreakdown: confidence.breakdown as any,
          confidenceThreshold: confidence.threshold,
          meetsThreshold: confidence.meetsThreshold,
          humanReviewRequired: confidence.humanReviewRequired,
          sebiCircularRef: "SEBI/HO/IMD/2023/P/CIR/0188",
          source: "system",
          ...(userId ? { userId } : {}),
          ...(advisorId ? { advisorId } : {}),
        }).catch(err => {
          logger.warn("[GeminiResilient] FASP persist failed (non-fatal)", { error: err?.message });
        });
      }

      logger.info("[GeminiResilient] Call succeeded", {
        event: "GEMINI_CALL_SUCCESS",
        user_id: "system",
        attempt,
        prompt_chars: prompt.length,
        response_chars: raw.length,
        cached: false,
        latency_ms: latency,
        status: "success",
      });

      return parsed;
    } catch (err: any) {
      lastError = err;
      const isRetryable = err?.message?.includes("429") || err?.message?.includes("503") || err?.message?.includes("overloaded");
      if (!isRetryable || attempt === maxRetries) break;

      const backoff = Math.pow(2, attempt) * 500; // 1s, 2s, 4s
      logger.warn("[GeminiResilient] Retrying after error", {
        event: "GEMINI_RETRY",
        user_id: "system",
        attempt,
        backoff_ms: backoff,
        error: err?.message,
        latency_ms: Date.now() - t0,
        status: "retrying",
      });
      await new Promise(r => setTimeout(r, backoff));
    }
  }

  logger.error("[GeminiResilient] All retries exhausted", {
    event: "GEMINI_CALL_FAILED",
    user_id: "system",
    error: lastError?.message,
    latency_ms: Date.now() - t0,
    status: "failed",
  });
  throw lastError ?? new Error("Gemini call failed after retries");
}

/**
 * Invalidates a cached Gemini response.
 * Call after a rebalance applies to clear stale portfolio AI insight.
 */
export async function invalidateGeminiCache(cacheKey: string): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    try {
      await redis.del(`gemini:${cacheKey}`);
    } catch { /* non-fatal */ }
  }
}
