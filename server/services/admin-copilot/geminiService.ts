/**
 * geminiService.ts — Admin Copilot AI Engine
 * Wraps @google/genai with structured JSON output, FASP-AI v1.0 compliance fields,
 * retry logic (max 3, exponential backoff), and structured logging.
 *
 * Purpose : Single AI inference entry-point for all 9 admin copilot agents.
 * Inputs  : prompt string + optional schema descriptor
 * Outputs : typed JSON with confidence_score, model_version, timestamp appended
 * Edge    : Network failures → retry 3x; model errors → throw CopilotAIError
 */

import { GoogleGenAI } from '@google/genai';

const MODEL_VERSION = 'gemini-2.0-flash';
const MAX_RETRIES   = 3;

// FASP-AI v1.0 — mandatory on every AI output
export interface FaspAiMeta {
  confidence_score:    number;   // 0-1
  model_version:       string;
  calculation_timestamp: string;
  engine_version:      string;
}

export interface GeminiResponse<T = Record<string, unknown>> {
  data:    T;
  meta:    FaspAiMeta;
  success: boolean;
}

export class CopilotAIError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean = false,
    public readonly errorCode: string  = 'AI_INFERENCE_ERROR',
  ) {
    super(message);
    this.name = 'CopilotAIError';
  }
}

/** Exponential backoff: 200ms → 400ms → 800ms */
async function sleep(attempt: number): Promise<void> {
  return new Promise(r => setTimeout(r, 200 * Math.pow(2, attempt)));
}

function estimateConfidence(text: string): number {
  // Heuristic: longer, more structured responses → higher confidence
  const len = text.length;
  if (len > 2000) return 0.88;
  if (len > 800)  return 0.78;
  if (len > 200)  return 0.65;
  return 0.50;
}

export async function callGemini<T = Record<string, unknown>>(
  systemPrompt: string,
  userPrompt:   string,
  options: {
    parseJson?:     boolean;
    temperature?:   number;
    maxOutputTokens?: number;
  } = {},
): Promise<GeminiResponse<T>> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new CopilotAIError(
      'GEMINI_API_KEY not configured — set env var GEMINI_API_KEY or GOOGLE_AI_API_KEY',
      false,
      'MISSING_API_KEY',
    );
  }

  const ai     = new GoogleGenAI({ apiKey });
  const { parseJson = true, temperature = 0.3, maxOutputTokens = 4096 } = options;

  const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model:  MODEL_VERSION,
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        config: {
          temperature,
          maxOutputTokens,
          ...(parseJson ? { responseMimeType: 'application/json' } : {}),
        },
      });

      const rawText = response.text ?? '';

      let parsed: T;
      if (parseJson) {
        try {
          // Strip markdown code fences if present
          const clean = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
          parsed = JSON.parse(clean) as T;
        } catch {
          throw new CopilotAIError(
            `Gemini returned invalid JSON: ${rawText.slice(0, 200)}`,
            true,
            'INVALID_JSON_RESPONSE',
          );
        }
      } else {
        parsed = rawText as unknown as T;
      }

      const meta: FaspAiMeta = {
        confidence_score:      estimateConfidence(rawText),
        model_version:         MODEL_VERSION,
        calculation_timestamp: new Date().toISOString(),
        engine_version:        'admin-copilot-v1.0',
      };

      return { data: parsed, meta, success: true };

    } catch (err: any) {
      lastError = err;
      const isRetryable = err instanceof CopilotAIError
        ? err.retryable
        : (err.status === 429 || err.status === 503 || err.code === 'ECONNRESET');

      if (!isRetryable || attempt === MAX_RETRIES - 1) break;

      console.warn(`[CopilotAI] Attempt ${attempt + 1} failed — retrying in ${200 * Math.pow(2, attempt)}ms`, err.message);
      await sleep(attempt);
    }
  }

  throw new CopilotAIError(
    lastError?.message ?? 'Unknown AI inference error',
    false,
    'MAX_RETRIES_EXCEEDED',
  );
}
